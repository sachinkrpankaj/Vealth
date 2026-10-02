import { openDatabaseAsync } from 'expo-sqlite';
import { restoreShoppingItem } from '../../src/database/repositories/shoppingRepository';

const open = openDatabaseAsync as jest.Mock;

describe('restoreShoppingItem transaction boundary', () => {
  let item: any;
  let transaction: any;
  let db: any;
  let scoped: any;
  let failure: 'transaction-delete' | 'final-item-update' | null;

  beforeAll(() => {
    scoped = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM shopping_items WHERE id = ?')) return item?.id === params[0] ? item : null;
        if (sql.includes('FROM shopping_items WHERE transactionId = ?')) {
          return item?.transactionId === params[0] ? item : null;
        }
        if (sql.includes('FROM transactions WHERE id = ?')) {
          return transaction?.id === params[0] ? transaction : null;
        }
        return null;
      }),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (failure === 'transaction-delete' && sql.includes('UPDATE transactions SET deletedAt = ?')) {
          throw new Error('transaction write failed');
        }
        if (failure === 'final-item-update' && sql.includes('SET status = \'PENDING\'') && !sql.includes('transactionId = ?')) {
          throw new Error('shopping item write failed');
        }
        if (sql.includes('SET status = \'PENDING\'')) {
          item.status = 'PENDING';
          item.purchasedAt = null;
          item.purchasePrice = null;
          item.purchaseAccountId = null;
          item.transactionId = null;
          item.categoryId = null;
        } else if (sql.includes('UPDATE transactions SET deletedAt = ?')) {
          transaction.deletedAt = params[0];
        }
        return { changes: 1 };
      }),
    };
    db = {
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('PRAGMA foreign_key_list')) return [{ table: 'assets' }, { table: 'liabilities' }];
        if (sql.includes('SELECT COUNT(*) as count FROM categories')) return [{ count: 1 }];
        return [];
      }),
      withTransactionAsync: jest.fn(async (callback: (txn: any) => Promise<void>) => {
        const savedItem = structuredClone(item);
        const savedTransaction = structuredClone(transaction);
        try {
          await callback(db);
        } catch (error) {
          item = savedItem;
          transaction = savedTransaction;
          throw error;
        }
      }),
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: any) => Promise<void>) => {
        const savedItem = structuredClone(item);
        const savedTransaction = structuredClone(transaction);
        try {
          await callback(scoped);
        } catch (error) {
          item = savedItem;
          transaction = savedTransaction;
          throw error;
        }
      }),
    };
    open.mockResolvedValue(db);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    failure = null;
    item = {
      id: 'item-1', status: 'PURCHASED', transactionId: 'tx-1',
      purchasedAt: '2026-10-01T12:00:00.000Z', purchasePrice: 50000,
      purchaseAccountId: 'bank', categoryId: null,
    };
    transaction = {
      id: 'tx-1', type: 'EXPENSE', amount: 50000, date: '2026-10-01',
      accountId: 'bank', categoryId: null, metadata: JSON.stringify({ shoppingItemId: 'item-1' }),
      deletedAt: null,
    };
  });

  it('restores the shopping item and soft-deletes its transaction in one exclusive transaction', async () => {
    await restoreShoppingItem('item-1');

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(item).toMatchObject({ status: 'PENDING', transactionId: null, purchasePrice: null });
    expect(transaction.deletedAt).toEqual(expect.any(String));
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('keeps repeated restore and already-PENDING restore harmless', async () => {
    await restoreShoppingItem('item-1');
    scoped.runAsync.mockClear();
    await restoreShoppingItem('item-1');
    expect(scoped.runAsync).not.toHaveBeenCalled();

    item = { ...item, id: 'item-pending', status: 'PENDING', transactionId: null };
    await restoreShoppingItem('item-pending');
    expect(scoped.runAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['transaction-delete', 'transaction write failed'],
    ['final-item-update', 'shopping item write failed'],
  ] as const)('rolls both records back when the %s write fails', async (failAt, message) => {
    failure = failAt;

    await expect(restoreShoppingItem('item-1')).rejects.toThrow(message);

    expect(item).toMatchObject({ status: 'PURCHASED', transactionId: 'tx-1', purchasePrice: 50000 });
    expect(transaction).toMatchObject({ deletedAt: null });
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });
});
