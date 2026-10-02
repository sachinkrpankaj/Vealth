import { openDatabaseAsync } from 'expo-sqlite';
import { updateTransaction } from '../../src/database/repositories/transactionRepository';

const open = openDatabaseAsync as jest.Mock;

describe('Atomic Transaction Update & Asset Reversal', () => {
  let db: any;
  let scoped: any;
  let currentAssetValue: number;

  beforeEach(() => {
    jest.clearAllMocks();
    currentAssetValue = 40000;
    scoped = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return { id: 'acc-1', name: 'Main bank', type: 'BANK', isArchived: 0 };
        }
        if (sql.includes('FROM assets WHERE id = ?')) {
          return { id: 'ast-laptop', currentValue: currentAssetValue, isArchived: 0 };
        }
        if (sql.includes('FROM shopping_items WHERE transactionId = ?')) return null;
        return null;
      }),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('UPDATE assets SET currentValue = ?')) {
          currentAssetValue = params[0];
        }
        return { changes: 1 };
      }),
    };
    db = {
      execAsync: jest.fn(),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (sql.includes('count FROM categories')) {
          return [{ count: 1 }];
        }
        return [];
      }),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
      withExclusiveTransactionAsync: jest.fn(async (fn: (txn: any) => Promise<void>) => fn(scoped)),
    };
    open.mockResolvedValue(db);
  });

  it('runs updateTransaction inside withExclusiveTransactionAsync', async () => {
    scoped.getFirstAsync.mockResolvedValueOnce({
      id: 'tx-1',
      type: 'EXPENSE',
      amount: 500,
      date: '2026-10-01',
      accountId: 'acc-1',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    });

    await updateTransaction('tx-1', { amount: 800, note: 'Updated note' });

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE transactions SET'),
      expect.arrayContaining([800, 'Updated note', 'tx-1'])
    );
  });

  it('adjusts asset valuation atomically when an ASSET_SALE transaction amount changes', async () => {
    // Current sale was ₹100, asset remaining value is ₹400
    scoped.getFirstAsync.mockResolvedValueOnce({
        id: 'tx-sale-1',
        type: 'ASSET_SALE',
        amount: 10000,
        date: '2026-10-01',
        accountId: 'acc-1',
        assetId: 'ast-laptop',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });

    // User increases the sale amount from ₹100 to ₹150 (+₹50 delta)
    // The asset remaining value should decrease from ₹400 to ₹350
    await updateTransaction('tx-sale-1', { amount: 15000 });

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE assets SET currentValue = ?'),
      expect.arrayContaining([35000, 0, expect.any(String), 'ast-laptop'])
    );

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE transactions SET'),
      expect.arrayContaining([15000, 'tx-sale-1'])
    );
  });

  it('restores asset valuation atomically when an ASSET_SALE transaction amount decreases', async () => {
    // Current sale was ₹200, asset remaining value is ₹100
    currentAssetValue = 10000;
    scoped.getFirstAsync.mockResolvedValueOnce({
        id: 'tx-sale-2',
        type: 'ASSET_SALE',
        amount: 20000,
        date: '2026-10-01',
        accountId: 'acc-1',
        assetId: 'ast-laptop',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });

    // User decreases the sale amount from ₹200 to ₹120 (-₹80 delta)
    // The asset remaining value should increase from ₹100 to ₹180
    await updateTransaction('tx-sale-2', { amount: 12000 });

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE assets SET currentValue = ?'),
      expect.arrayContaining([18000, 0, expect.any(String), 'ast-laptop'])
    );
  });
});
