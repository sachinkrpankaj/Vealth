import { openDatabaseAsync } from 'expo-sqlite';
import {
  restoreShoppingItem,
} from '../../src/database/repositories/shoppingRepository';
import {
  updateTransaction,
  deleteTransaction,
} from '../../src/database/repositories/transactionRepository';

const open = openDatabaseAsync as jest.Mock;

describe('6, 7, 8. Shopping ↔ Transaction Synchronization & Safe Reversal — Regression Tests', () => {
  let db: any;
  let scoped: any;

  beforeAll(async () => {
    scoped = {
      getFirstAsync: jest.fn(),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getAllAsync: jest.fn(async () => []),
    };

    db = {
      execAsync: jest.fn(),
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
      withExclusiveTransactionAsync: jest.fn(async (fn: any) => fn(scoped)),
    };

    open.mockResolvedValue(db);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scoped.runAsync.mockResolvedValue({ changes: 1 });
    db.runAsync.mockResolvedValue({ changes: 1 });
    scoped.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM accounts WHERE id = ?')) {
        return { id: 'acc-bank', name: 'Bank', type: 'BANK', isArchived: 0 };
      }
      if (sql.includes('FROM categories WHERE id = ?')) {
        return { id: 'cat-household', type: 'EXPENSE', isArchived: 0 };
      }
      if (sql.includes('FROM shopping_items WHERE transactionId = ?')) {
        return {
          id: 'item-oil', status: 'PURCHASED', transactionId: 'tx-purchase-1',
          purchasePrice: 150000, purchasedAt: '2026-10-01',
          purchaseAccountId: 'acc-bank', categoryId: 'cat-groceries',
        };
      }
      return null;
    });
  });

  it('updateTransaction atomically updates linked shopping item when transaction financial fields change', async () => {
    scoped.getFirstAsync.mockResolvedValueOnce({
      id: 'tx-purchase-1',
      type: 'EXPENSE',
      amount: 150000, // ₹1,500
      date: '2026-10-01',
      accountId: 'acc-bank',
      categoryId: 'cat-groceries',
      metadata: JSON.stringify({ shoppingItemId: 'item-oil' }),
      deletedAt: null,
    });

    await updateTransaction('tx-purchase-1', {
      amount: 180000,
      date: '2026-10-02',
      categoryId: 'cat-household',
    });

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE shopping_items'),
      [180000, '2026-10-02', 'acc-bank', 'cat-household', expect.any(String), 'item-oil', 'tx-purchase-1']
    );

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE transactions SET'),
      expect.arrayContaining([180000, '2026-10-02', 'tx-purchase-1'])
    );
  });

  it('deleteTransaction reverts linked shopping item to PENDING and clears purchase fields', async () => {
    scoped.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM transactions WHERE id = ?')) {
        return {
          id: 'tx-purchase-delete', type: 'EXPENSE', amount: 250000,
          date: '2026-10-01', metadata: JSON.stringify({ shoppingItemId: 'item-milk' }),
          deletedAt: null,
        };
      }
      if (sql.includes('FROM shopping_items WHERE transactionId = ?')) {
        return {
          id: 'item-milk', status: 'PURCHASED', transactionId: 'tx-purchase-delete',
          purchasePrice: 250000, purchasedAt: '2026-10-01',
          purchaseAccountId: null, categoryId: null,
        };
      }
      return null;
    });

    await deleteTransaction('tx-purchase-delete');

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PENDING'"),
      [expect.any(String), 'item-milk', 'tx-purchase-delete']
    );

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE transactions SET deletedAt = ?'),
      [expect.any(String), expect.any(String), 'tx-purchase-delete']
    );
  });

  it('restoreShoppingItem safely soft-deletes linked transaction and clears purchase fields when restoring a PURCHASED item', async () => {
    const purchasedItem = {
      id: 'item-bought',
      listId: 'list-1',
      name: 'Coffee Beans',
      status: 'PURCHASED',
      estimatedPrice: 50000,
      purchasePrice: 55000,
      purchasedAt: '2026-10-01T10:00:00.000Z',
      purchaseAccountId: 'acc-bank',
      transactionId: 'tx-coffee',
      categoryId: 'cat-groceries',
      isArchived: 0,
      sortOrder: 1,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    scoped.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM shopping_items WHERE id = ?')) return purchasedItem;
      if (sql.includes('FROM shopping_items WHERE transactionId = ?')) return purchasedItem;
      if (sql.includes('FROM transactions WHERE id = ?')) {
        return {
          id: 'tx-coffee',
          type: 'EXPENSE',
          amount: 55000,
          date: '2026-10-01',
          accountId: 'acc-bank',
          categoryId: 'cat-groceries',
          metadata: JSON.stringify({ shoppingItemId: 'item-bought' }),
          deletedAt: null,
        };
      }
      return null;
    });

    await restoreShoppingItem('item-bought');

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE transactions SET deletedAt = ?'),
      [expect.any(String), expect.any(String), 'tx-coffee']
    );

    expect(scoped.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PENDING'"),
      expect.arrayContaining([expect.any(String), 'item-bought'])
    );
  });
});
