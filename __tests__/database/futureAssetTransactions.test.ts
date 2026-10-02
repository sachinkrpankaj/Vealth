import { openDatabaseAsync } from 'expo-sqlite';
import { createTransaction, deleteTransaction, updateTransaction } from '../../src/database/repositories/transactionRepository';
import { formatDateIso, getTodayLocalDateString } from '../../src/utils/dateUtils';

const open = openDatabaseAsync as jest.Mock;

describe('future asset transaction persistence', () => {
  let asset: { id: string; currentValue: number; isArchived: number };
  let transactions: any[];
  let scoped: any;
  let db: any;

  const futureDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    return formatDateIso(date);
  };

  beforeAll(() => {
    asset = { id: 'asset-future', currentValue: 100000, isArchived: 0 };
    transactions = [];
    scoped = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return { id: params[0], name: 'Bank', type: 'BANK', isArchived: 0 };
        }
        if (sql.includes('FROM assets WHERE id = ?')) return { ...asset };
        if (sql.includes('FROM transactions WHERE id = ?')) {
          return transactions.find((transaction) => transaction.id === params[0]) || null;
        }
        if (sql.includes('FROM shopping_items')) return null;
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM transactions')) return transactions.filter((transaction) => !transaction.deletedAt);
        return [];
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO transactions')) {
          transactions.push({
            id: params[0], type: params[1], amount: params[2], date: params[3],
            accountId: params[4], destinationAccountId: params[5], personId: params[6],
            categoryId: params[7], assetId: params[8], liabilityId: params[9], note: params[10],
            dueDate: params[11], metadata: params[12], createdAt: params[13],
            updatedAt: params[14], deletedAt: params[15],
          });
        } else if (sql.includes('UPDATE transactions SET deletedAt = ?')) {
          const transaction = transactions.find((entry) => entry.id === params[2]);
          if (transaction) transaction.deletedAt = params[0];
        } else if (sql.includes('UPDATE transactions SET type = ?')) {
          const transaction = transactions.find((entry) => entry.id === params[14]);
          if (transaction) {
            Object.assign(transaction, {
              type: params[0], amount: params[1], date: params[2], accountId: params[3],
              destinationAccountId: params[4], personId: params[5], categoryId: params[6],
              assetId: params[7], liabilityId: params[8], note: params[9], dueDate: params[10],
              metadata: params[11], updatedAt: params[12], deletedAt: params[13],
            });
          }
        } else if (sql.includes('UPDATE assets SET currentValue = ?')) {
          asset.currentValue = params[0];
          if (typeof params[1] === 'number') asset.isArchived = params[1];
        }
        return { changes: 1 };
      }),
    };
    db = {
      execAsync: jest.fn(),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('PRAGMA foreign_key_list')) return [{ table: 'assets' }, { table: 'liabilities' }];
        if (sql.includes('SELECT COUNT(*) as count FROM categories')) return [{ count: 1 }];
        return [];
      }),
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: any) => Promise<void>) => callback(scoped)),
    };
    open.mockResolvedValue(db);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    asset.currentValue = 100000;
    asset.isArchived = 0;
    transactions = [];
  });

  it('does not mutate today’s asset value when a future sale is created', async () => {
    const created = await createTransaction({
      id: 'future-sale', type: 'ASSET_SALE', amount: 30000, date: futureDate(),
      accountId: 'bank', assetId: asset.id,
    });

    expect(asset.currentValue).toBe(100000);
    expect(scoped.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE assets SET'), expect.anything());
    expect(JSON.parse(created.metadata || '{}').assetStateApplied).toBe(false);
  });

  it('does not mutate today’s asset value when a future purchase is created', async () => {
    const created = await createTransaction({
      id: 'future-purchase', type: 'ASSET_PURCHASE', amount: 30000, date: futureDate(),
      accountId: 'bank', assetId: asset.id,
    });

    expect(asset.currentValue).toBe(100000);
    expect(scoped.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE assets SET'), expect.anything());
    expect(JSON.parse(created.metadata || '{}').assetStateApplied).toBe(false);
  });

  it('updates and deletes a future transaction without applying or reversing its value early', async () => {
    const date = futureDate();
    await createTransaction({
      id: 'future-sale', type: 'ASSET_SALE', amount: 30000, date,
      accountId: 'bank', assetId: asset.id,
    });
    scoped.runAsync.mockClear();

    await updateTransaction('future-sale', { amount: 45000 });
    await deleteTransaction('future-sale');

    expect(asset.currentValue).toBe(100000);
    expect(scoped.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE assets SET'), expect.anything());
    expect(transactions[0].deletedAt).toEqual(expect.any(String));
    expect(date > getTodayLocalDateString()).toBe(true);
  });
});
