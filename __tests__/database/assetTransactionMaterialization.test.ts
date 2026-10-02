import { openDatabaseAsync } from 'expo-sqlite';
import { getAssetById } from '../../src/database/repositories/assetRepository';
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../../src/database/repositories/transactionRepository';
import { calculateAssetValueAsOf } from '../../src/domain/finance/financialEngine';
import { Asset, Transaction } from '../../src/domain/finance/types';
import { formatDateIso, getTodayLocalDateString, parseLocalDate } from '../../src/utils/dateUtils';

const open = openDatabaseAsync as jest.Mock;

interface TestAsset {
  id: string;
  name: string;
  category: 'OTHER';
  currentValue: number;
  purchaseValue: number;
  purchaseDate: string;
  note: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

interface TestTransaction {
  id: string;
  type: string;
  amount: number;
  date: string;
  accountId: string | null;
  destinationAccountId: string | null;
  personId: string | null;
  categoryId: string | null;
  assetId: string | null;
  liabilityId: string | null;
  note: string | null;
  dueDate: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function shiftDate(date: string, days: number): string {
  const value = parseLocalDate(date)!;
  value.setDate(value.getDate() + days);
  return formatDateIso(value);
}

function metadataOf(tx: TestTransaction): Record<string, unknown> {
  return JSON.parse(tx.metadata || '{}');
}

describe('asset transaction event materialization', () => {
  let assets: Record<string, TestAsset>;
  let valuations: Record<string, Array<{ effectiveDate: string; value: number; source: string; createdAt: string }>>;
  let archives: Record<string, Array<{ effectiveDate: string; isArchived: number; createdAt: string }>>;
  let transactions: TestTransaction[];
  let database: any;
  let scoped: any;

  function addAsset(id: string, value = 100000): void {
    const today = getTodayLocalDateString();
    const baselineDate = shiftDate(today, -30);
    const baselineCreatedAt = `${baselineDate}T00:00:00.000Z`;
    assets[id] = {
      id,
      name: id,
      category: 'OTHER',
      currentValue: value,
      purchaseValue: value,
      purchaseDate: baselineDate,
      note: null,
      isArchived: 0,
      createdAt: baselineCreatedAt,
      updatedAt: baselineCreatedAt,
    };
    valuations[id] = [{
      effectiveDate: baselineDate,
      value,
      source: 'PURCHASE',
      createdAt: baselineCreatedAt,
    }];
    archives[id] = [{
      effectiveDate: baselineDate,
      isArchived: 0,
      createdAt: baselineCreatedAt,
    }];
  }

  function rowsForSql(sql: string, params: any[] = []): any[] {
    if (sql.includes('FROM asset_valuations')) return (valuations[params[0]] || []).map((row) => ({ ...row }));
    if (sql.includes('FROM asset_archive_history')) return (archives[params[0]] || []).map((row) => ({ ...row }));
    if (sql.includes('FROM transactions')) {
      const [assetId] = params;
      return transactions
        .filter((tx) => !tx.deletedAt && (!sql.includes('assetId = ?') || tx.assetId === assetId))
        .filter((tx) => !sql.includes("type IN ('ASSET_PURCHASE', 'ASSET_SALE')") ||
          tx.type === 'ASSET_PURCHASE' || tx.type === 'ASSET_SALE')
        .map((row) => ({ ...row }));
    }
    return [];
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 2, 12, 0, 0));
    assets = {};
    valuations = {};
    archives = {};
    transactions = [];
    addAsset('asset-a');
    addAsset('asset-b');

    scoped = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return { id: params[0], name: 'Bank', type: 'BANK', isArchived: 0 };
        }
        if (sql.includes('FROM assets WHERE id = ?')) return assets[params[0]] ? { ...assets[params[0]] } : null;
        if (sql.includes('FROM transactions WHERE id = ?')) {
          const tx = transactions.find((row) => row.id === params[0]);
          return tx && (!sql.includes('deletedAt IS NULL') || !tx.deletedAt) ? { ...tx } : null;
        }
        if (sql.includes('FROM shopping_items')) return null;
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => rowsForSql(sql, params)),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO transactions')) {
          transactions.push({
            id: params[0], type: params[1], amount: params[2], date: params[3],
            accountId: params[4], destinationAccountId: params[5], personId: params[6],
            categoryId: params[7], assetId: params[8], liabilityId: params[9], note: params[10],
            dueDate: params[11], metadata: params[12], createdAt: params[13],
            updatedAt: params[14], deletedAt: params[15],
          });
        } else if (sql.includes('UPDATE transactions SET metadata = ?')) {
          const tx = transactions.find((row) => row.id === params[1]);
          if (tx) tx.metadata = params[0];
        } else if (sql.includes('UPDATE transactions SET deletedAt = ?')) {
          const tx = transactions.find((row) => row.id === params[2]);
          if (tx) tx.deletedAt = params[0];
        } else if (sql.includes('UPDATE transactions SET type = ?')) {
          const tx = transactions.find((row) => row.id === params[14]);
          if (tx) Object.assign(tx, {
            type: params[0], amount: params[1], date: params[2], accountId: params[3],
            destinationAccountId: params[4], personId: params[5], categoryId: params[6],
            assetId: params[7], liabilityId: params[8], note: params[9], dueDate: params[10],
            metadata: params[11], updatedAt: params[12], deletedAt: params[13],
          });
        } else if (sql.includes('UPDATE assets SET currentValue = ?')) {
          const asset = assets[params[3]];
          if (asset) {
            asset.currentValue = params[0];
            asset.isArchived = params[1];
            asset.updatedAt = params[2];
          }
        }
        return { changes: 1 };
      }),
    };

    database = {
      execAsync: jest.fn(),
      getFirstAsync: scoped.getFirstAsync,
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('PRAGMA foreign_key_list')) return [{ table: 'assets' }, { table: 'liabilities' }];
        if (sql.includes('SELECT COUNT(*) as count FROM categories')) return [{ count: 1 }];
        if (sql.includes('FROM assets')) return Object.values(assets).map((row) => ({ ...row }));
        return rowsForSql(sql, params);
      }),
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: any) => Promise<void>) => callback(scoped)),
    };
    open.mockResolvedValue(database);
  });

  afterEach(() => jest.useRealTimers());

  async function createAssetTx(
    id: string,
    type: 'ASSET_PURCHASE' | 'ASSET_SALE',
    amount: number,
    date: string,
    assetId = 'asset-a'
  ): Promise<void> {
    await createTransaction({ id, type, amount, date, accountId: 'bank', assetId });
  }

  function moveTodayTo(date: string): void {
    const localDate = parseLocalDate(date)!;
    localDate.setHours(12, 0, 0, 0);
    jest.setSystemTime(localDate);
  }

  function calculatedValue(assetId = 'asset-a'): number {
    const row = assets[assetId];
    const asset: Asset = {
      ...row,
      note: row.note ?? undefined,
      isArchived: row.isArchived === 1,
      valuationHistory: valuations[assetId] as Asset['valuationHistory'],
      archiveHistory: archives[assetId].map((entry) => ({ ...entry, isArchived: entry.isArchived === 1 })),
    };
    const active: Transaction[] = transactions
      .filter((tx) => !tx.deletedAt && tx.assetId === assetId)
      .map((tx) => ({
        id: tx.id,
        type: tx.type as Transaction['type'],
        amount: tx.amount,
        date: tx.date,
        assetId: tx.assetId ?? undefined,
        metadata: tx.metadata ?? undefined,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      }));
    return calculateAssetValueAsOf(asset, active, getTodayLocalDateString());
  }

  it('applies an elapsed future sale before creating a current sale and caps book value to the true balance', async () => {
    const futureDate = shiftDate(getTodayLocalDateString(), 2);
    await createAssetTx('future-sale', 'ASSET_SALE', 30000, futureDate);
    expect(assets['asset-a'].currentValue).toBe(100000);

    moveTodayTo(futureDate);
    await createTransaction({
      id: 'current-sale', type: 'ASSET_SALE', amount: 80000, date: getTodayLocalDateString(),
      accountId: 'bank', assetId: 'asset-a',
    });

    expect(assets['asset-a'].currentValue).toBe(0);
    expect(assets['asset-a'].isArchived).toBe(1);
    expect(metadataOf(transactions.find((tx) => tx.id === 'current-sale')!)).toMatchObject({
      assetBookValueBefore: 70000,
      assetValueDeducted: 70000,
      bookValueSold: 70000,
      assetArchivedBefore: false,
      assetStateApplied: true,
    });
  });

  it('applies an elapsed future purchase before a current sale', async () => {
    const futureDate = shiftDate(getTodayLocalDateString(), 2);
    await createAssetTx('future-purchase', 'ASSET_PURCHASE', 30000, futureDate);
    moveTodayTo(futureDate);
    await createTransaction({
      id: 'current-sale', type: 'ASSET_SALE', amount: 120000, date: getTodayLocalDateString(),
      accountId: 'bank', assetId: 'asset-a',
    });

    expect(assets['asset-a'].currentValue).toBe(10000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'current-sale')!)).toMatchObject({
      assetBookValueBefore: 130000,
      assetValueDeducted: 120000,
      bookValueSold: 120000,
    });
  });

  it('rebuilds later effective sales when a current sale is edited after a future sale takes effect', async () => {
    const futureDate = shiftDate(getTodayLocalDateString(), 2);
    await createAssetTx('future-sale', 'ASSET_SALE', 30000, futureDate);
    moveTodayTo(futureDate);
    await createAssetTx('current-sale', 'ASSET_SALE', 10000, getTodayLocalDateString());

    await updateTransaction('current-sale', { amount: 20000 });

    expect(assets['asset-a'].currentValue).toBe(50000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'current-sale')!)).toMatchObject({
      assetBookValueBefore: 70000,
      assetValueDeducted: 20000,
      bookValueSold: 20000,
    });
  });

  it('rebuilds the asset when a current sale is deleted after a future sale takes effect', async () => {
    const futureDate = shiftDate(getTodayLocalDateString(), 2);
    await createAssetTx('future-sale', 'ASSET_SALE', 30000, futureDate);
    moveTodayTo(futureDate);
    await createAssetTx('current-sale', 'ASSET_SALE', 20000, getTodayLocalDateString());

    await deleteTransaction('current-sale');

    expect(assets['asset-a'].currentValue).toBe(70000);
    expect(calculatedValue()).toBe(70000);
  });

  it('replays several future events in effective-date order, regardless of insertion order', async () => {
    const today = getTodayLocalDateString();
    const day1 = shiftDate(today, 1);
    const day2 = shiftDate(today, 2);
    const day3 = shiftDate(today, 3);
    await createAssetTx('sale-late', 'ASSET_SALE', 50000, day3);
    await createAssetTx('purchase-first', 'ASSET_PURCHASE', 40000, day1);
    await createAssetTx('sale-middle', 'ASSET_SALE', 20000, day2);
    moveTodayTo(day3);

    await getAssetById('asset-a');

    expect(assets['asset-a'].currentValue).toBe(70000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'sale-middle')!)).toMatchObject({
      assetBookValueBefore: 140000,
      assetValueDeducted: 20000,
      assetStateApplied: true,
    });
    expect(metadataOf(transactions.find((tx) => tx.id === 'sale-late')!)).toMatchObject({
      assetBookValueBefore: 120000,
      assetValueDeducted: 50000,
      assetStateApplied: true,
    });
  });

  it('keeps the persisted asset row equal to calculateAssetValueAsOf after the effective date', async () => {
    const futureDate = shiftDate(getTodayLocalDateString(), 1);
    await createAssetTx('future-sale', 'ASSET_SALE', 30000, futureDate);
    moveTodayTo(futureDate);

    const asset = await getAssetById('asset-a');

    expect(asset?.currentValue).toBe(70000);
    expect(assets['asset-a'].currentValue).toBe(calculatedValue());
  });

  it('makes repeated reconciliation idempotent', async () => {
    const futureDate = shiftDate(getTodayLocalDateString(), 1);
    await createAssetTx('future-sale', 'ASSET_SALE', 30000, futureDate);
    moveTodayTo(futureDate);

    await getAssetById('asset-a');
    const rowAfterFirstRead = { ...assets['asset-a'] };
    const metadataAfterFirstRead = transactions.map((tx) => tx.metadata);
    scoped.runAsync.mockClear();
    await getAssetById('asset-a');

    expect(assets['asset-a']).toEqual(rowAfterFirstRead);
    expect(transactions.map((tx) => tx.metadata)).toEqual(metadataAfterFirstRead);
    expect(scoped.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE assets SET'), expect.anything());
    expect(scoped.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE transactions SET metadata'), expect.anything());
  });

  it('rebuilds both assets when a sale is moved to a different asset', async () => {
    const today = getTodayLocalDateString();
    await createAssetTx('sale', 'ASSET_SALE', 20000, today, 'asset-a');

    await updateTransaction('sale', { assetId: 'asset-b' });

    expect(assets['asset-a'].currentValue).toBe(100000);
    expect(assets['asset-b'].currentValue).toBe(80000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'sale')!)).toMatchObject({
      assetBookValueBefore: 100000,
      assetValueDeducted: 20000,
    });
  });

  it('rebuilds the asset when an effective sale changes transaction type', async () => {
    await createAssetTx('sale', 'ASSET_SALE', 20000, getTodayLocalDateString());

    await updateTransaction('sale', { type: 'ASSET_PURCHASE' });

    expect(assets['asset-a'].currentValue).toBe(120000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'sale')!)).toMatchObject({
      assetValueAdded: 20000,
      assetStateApplied: true,
    });
    expect(metadataOf(transactions.find((tx) => tx.id === 'sale')!)).not.toHaveProperty('bookValueSold');
  });

  it('rebuilds chronological metadata when deleting the first or second of two effective sales', async () => {
    const today = getTodayLocalDateString();
    await createAssetTx('a-sale-first', 'ASSET_SALE', 30000, today, 'asset-a');
    await createAssetTx('a-sale-second', 'ASSET_SALE', 20000, today, 'asset-a');
    await createAssetTx('b-sale-first', 'ASSET_SALE', 30000, today, 'asset-b');
    await createAssetTx('b-sale-second', 'ASSET_SALE', 20000, today, 'asset-b');

    await deleteTransaction('a-sale-first');
    await deleteTransaction('b-sale-second');

    expect(assets['asset-a'].currentValue).toBe(80000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'a-sale-second')!)).toMatchObject({
      assetBookValueBefore: 100000,
      assetValueDeducted: 20000,
    });
    expect(assets['asset-b'].currentValue).toBe(70000);
  });

  it('recomputes the later sale deduction when an earlier effective sale amount changes', async () => {
    const today = getTodayLocalDateString();
    await createAssetTx('sale-first', 'ASSET_SALE', 30000, today);
    await createAssetTx('sale-second', 'ASSET_SALE', 20000, today);

    await updateTransaction('sale-first', { amount: 50000 });

    expect(assets['asset-a'].currentValue).toBe(30000);
    expect(metadataOf(transactions.find((tx) => tx.id === 'sale-second')!)).toMatchObject({
      assetBookValueBefore: 50000,
      assetValueDeducted: 20000,
      bookValueSold: 20000,
    });
  });
});
