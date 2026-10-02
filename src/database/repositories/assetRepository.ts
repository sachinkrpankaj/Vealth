import { getDatabase } from '../db';
import { Asset, AssetArchiveState, AssetCategory, AssetValuation, Transaction, ASSET_CATEGORIES } from '../../domain/finance/types';
import { calculateAssetValueAsOf, isAssetArchivedAsOf } from '../../domain/finance/financialEngine';
import { getTodayLocalDateString, parseLocalDate } from '../../utils/dateUtils';
import { generateEntityId } from '../../utils/idGenerator';

interface AssetRow {
  id: string;
  name: string;
  category: string;
  currentValue: number;
  purchaseValue: number;
  purchaseDate: string;
  note: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

interface AssetValuationRow {
  assetId: string;
  effectiveDate: string;
  value: number;
  source: AssetValuation['source'];
  createdAt: string;
}

interface AssetArchiveRow {
  assetId: string;
  effectiveDate: string;
  isArchived: number;
  createdAt: string;
}

interface AssetTransactionRow {
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

function mapRowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    category: row.category as AssetCategory,
    currentValue: row.currentValue,
    purchaseValue: row.purchaseValue,
    purchaseDate: row.purchaseDate,
    note: row.note ?? undefined,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function hydrateAssets(rows: AssetRow[]): Promise<Asset[]> {
  const assets = rows.map(mapRowToAsset);
  if (!assets.length) return assets;

  const db = await getDatabase();
  const placeholders = assets.map(() => '?').join(', ');
  const ids = assets.map((asset) => asset.id);
  const [valuationRows, archiveRows, transactionRows] = await Promise.all([
    db.getAllAsync<AssetValuationRow>(
      `SELECT assetId, effectiveDate, value, source, createdAt FROM asset_valuations WHERE assetId IN (${placeholders}) ORDER BY effectiveDate, createdAt;`,
      ids
    ),
    db.getAllAsync<AssetArchiveRow>(
      `SELECT assetId, effectiveDate, isArchived, createdAt FROM asset_archive_history WHERE assetId IN (${placeholders}) ORDER BY effectiveDate, createdAt;`,
      ids
    ),
    db.getAllAsync<AssetTransactionRow>(
      `SELECT id, type, amount, date, assetId, metadata, createdAt, updatedAt, deletedAt
       FROM transactions WHERE assetId IN (${placeholders}) AND deletedAt IS NULL
         AND type IN ('ASSET_PURCHASE', 'ASSET_SALE') ORDER BY date, createdAt;`,
      ids
    ),
  ]);

  const valuationsByAsset = new Map<string, AssetValuation[]>();
  for (const row of valuationRows) {
    const values = valuationsByAsset.get(row.assetId) || [];
    values.push({
      effectiveDate: row.effectiveDate,
      value: row.value,
      source: row.source,
      createdAt: row.createdAt,
    });
    valuationsByAsset.set(row.assetId, values);
  }

  const archivesByAsset = new Map<string, AssetArchiveState[]>();
  for (const row of archiveRows) {
    const values = archivesByAsset.get(row.assetId) || [];
    values.push({
      effectiveDate: row.effectiveDate,
      isArchived: row.isArchived === 1,
      createdAt: row.createdAt,
    });
    archivesByAsset.set(row.assetId, values);
  }

  const transactions: Transaction[] = transactionRows.map((row) => ({
    id: row.id,
    type: row.type as Transaction['type'],
    amount: row.amount,
    date: row.date,
    assetId: row.assetId ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined,
  }));
  const today = getTodayLocalDateString();

  return assets.map((asset) => {
    const valuationHistory = valuationsByAsset.get(asset.id) || [];
    const hydrated: Asset = {
      ...asset,
      valuationHistory,
      archiveHistory: archivesByAsset.get(asset.id) || [],
    };
    if (valuationHistory.length) {
      hydrated.currentValue = calculateAssetValueAsOf(hydrated, transactions, today);
      hydrated.isArchived =
        isAssetArchivedAsOf(hydrated, today, transactions) ||
        (hydrated.currentValue === 0 &&
          transactions.some(
            (tx) => tx.assetId === hydrated.id && tx.type === 'ASSET_SALE' && tx.date <= today
          ));
    }
    return hydrated;
  });
}

async function recordValuation(
  db: Awaited<ReturnType<typeof getDatabase>>,
  assetId: string,
  effectiveDate: string,
  value: number,
  source: AssetValuation['source'],
  createdAt: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO asset_valuations (id, assetId, effectiveDate, value, source, createdAt)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [generateEntityId('assetval'), assetId, effectiveDate, Math.round(value), source, createdAt]
  );
}

async function recordArchiveState(
  db: Awaited<ReturnType<typeof getDatabase>>,
  assetId: string,
  effectiveDate: string,
  isArchived: boolean,
  createdAt: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO asset_archive_history (id, assetId, effectiveDate, isArchived, createdAt)
     VALUES (?, ?, ?, ?, ?);`,
    [generateEntityId('assetstate'), assetId, effectiveDate, isArchived ? 1 : 0, createdAt]
  );
}

export async function getAllAssets(includeArchived = false): Promise<Asset[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY createdAt DESC;');
  const assets = await hydrateAssets(rows);
  return includeArchived ? assets : assets.filter((asset) => !asset.isArchived);
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?;', [id]);
  if (!row) return null;
  const [asset] = await hydrateAssets([row]);
  return asset;
}

export async function createAsset(asset: Omit<Asset, 'createdAt' | 'updatedAt'>): Promise<Asset> {
  if (!ASSET_CATEGORIES.includes(asset.category)) throw new Error(`Invalid asset category: ${asset.category}`);
  if (!Number.isSafeInteger(asset.currentValue) || asset.currentValue < 0) {
    throw new Error('Asset value must be a non-negative integer in paise.');
  }
  if (!Number.isSafeInteger(asset.purchaseValue) || asset.purchaseValue < 0) {
    throw new Error('Asset purchase value must be a non-negative integer in paise.');
  }
  if (!parseLocalDate(asset.purchaseDate)) throw new Error('Asset purchase date must be a valid YYYY-MM-DD date.');
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = getTodayLocalDateString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO assets (id, name, category, currentValue, purchaseValue, purchaseDate, note, isArchived, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        asset.id,
        asset.name,
        asset.category,
        Math.round(asset.currentValue),
        Math.round(asset.purchaseValue),
        asset.purchaseDate,
        asset.note ?? null,
        asset.isArchived ? 1 : 0,
        now,
        now,
      ]
    );
    await recordValuation(txn, asset.id, asset.purchaseDate, asset.purchaseValue, 'PURCHASE', now);
    if (today >= asset.purchaseDate) {
      await recordValuation(txn, asset.id, today, asset.currentValue, 'MANUAL', now);
    }
    await recordArchiveState(txn, asset.id, today, asset.isArchived, now);
  });
  return { ...asset, createdAt: now, updatedAt: now };
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<void> {
  const db = await getDatabase();
  if (updates.category && !ASSET_CATEGORIES.includes(updates.category)) {
    throw new Error(`Invalid asset category: ${updates.category}`);
  }
  if (updates.currentValue !== undefined && (!Number.isSafeInteger(updates.currentValue) || updates.currentValue < 0)) {
    throw new Error('Asset value must be a non-negative integer in paise.');
  }
  if (updates.purchaseValue !== undefined && (!Number.isSafeInteger(updates.purchaseValue) || updates.purchaseValue < 0)) {
    throw new Error('Asset purchase value must be a non-negative integer in paise.');
  }
  if (updates.purchaseDate !== undefined && !parseLocalDate(updates.purchaseDate)) {
    throw new Error('Asset purchase date must be a valid YYYY-MM-DD date.');
  }
  const now = new Date().toISOString();
  const today = getTodayLocalDateString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const currentRow = await txn.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?;', [id]);
    if (!currentRow) throw new Error(`Asset ${id} not found`);
    const current = mapRowToAsset(currentRow);
    const updated: Asset = { ...current, ...updates, updatedAt: now };
    await txn.runAsync(
      `UPDATE assets SET name = ?, category = ?, currentValue = ?, purchaseValue = ?, purchaseDate = ?, note = ?, isArchived = ?, updatedAt = ?
       WHERE id = ?;`,
      [
        updated.name,
        updated.category,
        Math.round(updated.currentValue),
        Math.round(updated.purchaseValue),
        updated.purchaseDate,
        updated.note ?? null,
        updated.isArchived ? 1 : 0,
        now,
        id,
      ]
    );
    if (updates.currentValue !== undefined) {
      await recordValuation(txn, id, today, updated.currentValue, 'MANUAL', now);
    }
    if (updates.isArchived !== undefined && updated.isArchived !== current.isArchived) {
      await recordArchiveState(txn, id, today, updated.isArchived, now);
    }
  });
}

export async function archiveAsset(id: string): Promise<void> {
  await updateAsset(id, { isArchived: true });
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDatabase();
  const txRef = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE assetId = ?;',
    [id]
  );
  if ((txRef?.count ?? 0) > 0) {
    const now = new Date().toISOString();
    const today = getTodayLocalDateString();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('UPDATE assets SET isArchived = 1, updatedAt = ? WHERE id = ?;', [now, id]);
      await recordArchiveState(txn, id, today, true, now);
    });
  } else {
    await db.runAsync('DELETE FROM assets WHERE id = ?;', [id]);
  }
}
