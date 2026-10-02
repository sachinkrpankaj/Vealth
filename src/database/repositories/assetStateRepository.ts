import { SQLiteDatabase } from 'expo-sqlite';
import { Asset, AssetArchiveState, AssetValuation, Transaction } from '../../domain/finance/types';
import { calculateAssetValueAsOf, isAssetArchivedAsOf } from '../../domain/finance/financialEngine';
import { getTodayLocalDateString } from '../../utils/dateUtils';

interface AssetStateRow {
  id: string;
  name: string;
  category: Asset['category'];
  currentValue: number;
  purchaseValue: number;
  purchaseDate: string;
  note: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

interface AssetEventRow {
  id: string;
  type: string;
  amount: number;
  date: string;
  assetId: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface AssetArchiveRow {
  effectiveDate: string;
  isArchived: number;
  createdAt: string;
}

function compareTransactions(a: Transaction, b: Transaction): number {
  return a.date.localeCompare(b.date) ||
    (a.createdAt || '').localeCompare(b.createdAt || '') ||
    a.id.localeCompare(b.id);
}

function clearAssetMetadata(metadata: string | null): Record<string, unknown> {
  let value: Record<string, unknown> = {};
  if (metadata) {
    try {
      const parsed: unknown = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        value = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      // Invalid metadata is replaced by the canonical asset event metadata below.
    }
  }
  for (const key of [
    'assetBookValueBefore',
    'assetArchivedBefore',
    'assetValueDeducted',
    'bookValueSold',
    'assetValueAdded',
    'assetStateApplied',
  ]) delete value[key];
  return value;
}

function toTransaction(row: AssetEventRow): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction['type'],
    amount: row.amount,
    date: row.date,
    assetId: row.assetId ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

/**
 * Rebuilds derived asset metadata and today's materialized value from dated source
 * history. This is idempotent: it never applies an event as a delta to currentValue.
 * The returned IDs have valuation history and were reconciled; legacy assets without
 * that history remain on the transaction repository's compatibility path.
 */
export async function reconcileAssetState(
  txn: SQLiteDatabase,
  assetIds: Iterable<string | null | undefined>,
  now = new Date().toISOString(),
  today = getTodayLocalDateString()
): Promise<Set<string>> {
  const reconciled = new Set<string>();
  for (const assetId of new Set(Array.from(assetIds).filter((id): id is string => !!id))) {
    const valuationRows = await txn.getAllAsync<AssetValuation>(
      'SELECT effectiveDate, value, source, createdAt FROM asset_valuations WHERE assetId = ? ORDER BY effectiveDate, createdAt;',
      [assetId]
    );

    // Current value is not a safe historical baseline. Migrations and backup restore
    // create at least one valuation point; if a damaged/old database lacks one, leave
    // it to the compatibility path instead of guessing and double-counting events.
    if (!valuationRows.length) continue;

    const row = await txn.getFirstAsync<AssetStateRow>(
      'SELECT id, name, category, currentValue, purchaseValue, purchaseDate, note, isArchived, createdAt, updatedAt FROM assets WHERE id = ?;',
      [assetId]
    );
    if (!row) continue;

    const [archiveRows, eventRows] = await Promise.all([
      txn.getAllAsync<AssetArchiveRow>(
        'SELECT effectiveDate, isArchived, createdAt FROM asset_archive_history WHERE assetId = ? ORDER BY effectiveDate, createdAt;',
        [assetId]
      ),
      txn.getAllAsync<AssetEventRow>(
        `SELECT id, type, amount, date, assetId, metadata, createdAt, updatedAt, deletedAt
         FROM transactions WHERE assetId = ? AND deletedAt IS NULL
           AND type IN ('ASSET_PURCHASE', 'ASSET_SALE');`,
        [assetId]
      ),
    ]);

    const asset: Asset = {
      id: row.id,
      name: row.name,
      category: row.category,
      currentValue: row.currentValue,
      purchaseValue: row.purchaseValue,
      purchaseDate: row.purchaseDate,
      note: row.note ?? undefined,
      isArchived: row.isArchived === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      valuationHistory: valuationRows,
      archiveHistory: archiveRows.map((history) => ({
        ...history,
        isArchived: history.isArchived === 1,
      })),
    };
    const transactions = eventRows.map(toTransaction).sort(compareTransactions);

    for (let index = 0; index < transactions.length; index += 1) {
      const event = transactions[index];
      const preceding = transactions.slice(0, index);
      const archivedBefore = isAssetArchivedAsOf(asset, event.date, preceding);
      const applied = event.date <= today;
      const assetFields: Record<string, unknown> = { assetStateApplied: applied };

      if (event.type === 'ASSET_PURCHASE') {
        assetFields.assetValueAdded = Math.round(event.amount);
        assetFields.assetArchivedBefore = archivedBefore;
      } else if (applied) {
        const valueBefore = calculateAssetValueAsOf(asset, preceding, event.date);
        const deducted = Math.min(valueBefore, Math.max(0, Math.round(event.amount)));
        assetFields.assetBookValueBefore = valueBefore;
        assetFields.assetArchivedBefore = archivedBefore;
        assetFields.assetValueDeducted = deducted;
        assetFields.bookValueSold = deducted;
      }

      const metadata = JSON.stringify({ ...clearAssetMetadata(event.metadata ?? null), ...assetFields });
      if (metadata !== (event.metadata ?? null)) {
        await txn.runAsync('UPDATE transactions SET metadata = ? WHERE id = ?;', [metadata, event.id]);
        event.metadata = metadata;
      }
    }

    const currentValue = calculateAssetValueAsOf(asset, transactions, today);
    const isArchived = isAssetArchivedAsOf(asset, today, transactions);
    if (row.currentValue !== currentValue || row.isArchived !== (isArchived ? 1 : 0)) {
      await txn.runAsync(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [currentValue, isArchived ? 1 : 0, now, assetId]
      );
    }
    reconciled.add(assetId);
  }
  return reconciled;
}
