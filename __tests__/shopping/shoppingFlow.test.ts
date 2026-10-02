import { openDatabaseAsync } from 'expo-sqlite';
import {
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  deleteShoppingList,
  getShoppingListById,
  getAllShoppingLists,
  getShoppingListSummaries,
  createShoppingItem,
  updateShoppingItem,
  discardShoppingItem,
  restoreShoppingItem,
  deleteShoppingItem,
  getShoppingItemById,
  getShoppingItemsByListId,
  purchaseShoppingItem,
  normalizeProductUrl,
} from '../../src/database/repositories/shoppingRepository';

const openMock = openDatabaseAsync as jest.Mock;

describe('Shopping Feature Flow & Financial Integration', () => {
  let mockDb: any;
  let mockTxn: any;

  // In-memory mock tables
  let shoppingListsTable: any[] = [];
  let shoppingItemsTable: any[] = [];
  let accountsTable: any[] = [];
  let categoriesTable: any[] = [];
  let transactionsTable: any[] = [];

  beforeEach(() => {
    shoppingListsTable = [];
    shoppingItemsTable = [];
    accountsTable = [
      {
        id: 'acc-bank-1',
        name: 'HDFC Savings',
        type: 'BANK',
        openingBalance: 1000000, // ₹10,000.00 in paise
        isArchived: 0,
      },
      {
        id: 'acc-cash-1',
        name: 'Wallet Cash',
        type: 'CASH',
        openingBalance: 50000, // ₹500.00 in paise
        isArchived: 0,
      },
      {
        id: 'acc-archived-1',
        name: 'Old Closed Bank',
        type: 'BANK',
        openingBalance: 500000,
        isArchived: 1,
      },
      {
        id: 'acc-credit-1',
        name: 'Axis Credit Card',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        isArchived: 0,
      },
      {
        id: 'acc-inv-1',
        name: 'Zerodha Demat',
        type: 'INVESTMENT',
        openingBalance: 2000000,
        isArchived: 0,
      },
    ];
    categoriesTable = [
      { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', isArchived: 0 },
      { id: 'cat-electronics', name: 'Electronics', type: 'EXPENSE', isArchived: 0 },
      { id: 'cat-household', name: 'Household', type: 'EXPENSE', isArchived: 0 },
      { id: 'cat-salary', name: 'Salary', type: 'INCOME', isArchived: 0 },
    ];
    transactionsTable = [];

    mockTxn = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM shopping_items WHERE id = ?')) {
          return shoppingItemsTable.find((i) => i.id === params[0]) || null;
        }
        if (sql.includes('FROM shopping_items WHERE transactionId = ?')) {
          return shoppingItemsTable.find((i) => i.transactionId === params[0]) || null;
        }
        if (sql.includes('FROM shopping_lists WHERE id = ?')) {
          return shoppingListsTable.find((l) => l.id === params[0]) || null;
        }
        if (sql.includes('COUNT(*) as count FROM shopping_items')) {
          const count = shoppingItemsTable.filter(
            (item) => item.listId === params[0] && (item.status === 'PURCHASED' || item.transactionId != null)
          ).length;
          return { count };
        }
        if (sql.includes('FROM transactions WHERE id = ?')) {
          return transactionsTable.find((t) => t.id === params[0]) || null;
        }
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return accountsTable.find((a) => a.id === params[0]) || null;
        }
        if (sql.includes('FROM categories WHERE id = ?')) {
          return categoriesTable.find((c) => c.id === params[0]) || null;
        }
        if (sql.includes("type IN ('INCOME'")) {
          // Credits to account
          const accId = params[0];
          const credits = transactionsTable
            .filter(
              (t) =>
                !t.deletedAt &&
                ((t.accountId === accId && ['INCOME', 'BORROW', 'REPAYMENT_RECEIVED', 'ASSET_SALE'].includes(t.type)) ||
                  (t.destinationAccountId === accId && t.type === 'TRANSFER'))
            )
            .reduce((sum, t) => sum + t.amount, 0);
          return { total: credits };
        }
        if (sql.includes("type IN ('EXPENSE'")) {
          // Debits from account
          const accId = params[0];
          const debits = transactionsTable
            .filter(
              (t) =>
                !t.deletedAt &&
                t.accountId === accId &&
                ['EXPENSE', 'LEND', 'REPAYMENT_MADE', 'TRANSFER', 'ASSET_PURCHASE'].includes(t.type)
            )
            .reduce((sum, t) => sum + t.amount, 0);
          return { total: debits };
        }
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM transactions')) {
          return transactionsTable.filter((transaction) => !transaction.deletedAt);
        }
        return [];
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO transactions')) {
          transactionsTable.push({
            id: params[0],
            type: 'EXPENSE',
            amount: params[1],
            date: params[2],
            accountId: params[3],
            categoryId: params[4],
            note: params[5],
            metadata: params[6],
            createdAt: params[7],
            updatedAt: params[8],
            deletedAt: null,
          });
          return { changes: 1 };
        }
        if (sql.includes('UPDATE transactions SET deletedAt = ?')) {
          const transaction = transactionsTable.find((t) => t.id === params[2]);
          if (transaction) transaction.deletedAt = params[0];
          return { changes: 1 };
        }
        if (sql.includes('UPDATE shopping_lists SET isArchived = 1')) {
          const list = shoppingListsTable.find((l) => l.id === params[1]);
          if (list) { list.isArchived = 1; list.updatedAt = params[0]; }
          return { changes: 1 };
        }
        if (sql.includes("SET status = 'PURCHASED'")) {
          // [txDate, purchasePrice, purchaseAccountId, txId, categoryId, now, itemId]
          const itemId = params[6];
          const item = shoppingItemsTable.find((i) => i.id === itemId);
          if (item) {
            item.status = 'PURCHASED';
            item.purchasedAt = params[0];
            item.purchasePrice = params[1];
            item.purchaseAccountId = params[2];
            item.transactionId = params[3];
            item.categoryId = params[4];
            item.updatedAt = params[5];
          }
          return { changes: 1 };
        }
        if (sql.includes("SET status = 'DISCARDED'")) {
          const item = shoppingItemsTable.find((i) => i.id === params[1]);
          if (item) { item.status = 'DISCARDED'; item.updatedAt = params[0]; }
          return { changes: 1 };
        }
        if (sql.includes("SET status = 'PENDING'")) {
          const item = shoppingItemsTable.find((i) => i.id === params[1]);
          if (item) {
            item.status = 'PENDING';
            item.purchasedAt = null;
            item.purchasePrice = null;
            item.purchaseAccountId = null;
            item.transactionId = null;
            item.categoryId = null;
            item.updatedAt = params[0];
          }
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM shopping_items WHERE listId = ?')) {
          shoppingItemsTable = shoppingItemsTable.filter((i) => i.listId !== params[0]);
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM shopping_lists WHERE id = ?')) {
          shoppingListsTable = shoppingListsTable.filter((l) => l.id !== params[0]);
          return { changes: 1 };
        }
        return { changes: 1 };
      }),
    };

    mockDb = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const norm = sql.replace(/\s+/g, ' ').trim();
        if (norm.includes('FROM shopping_lists WHERE id = ?')) {
          return shoppingListsTable.find((l) => l.id === params[0]) || null;
        }
        if (norm.includes('FROM shopping_items WHERE id = ?')) {
          return shoppingItemsTable.find((i) => i.id === params[0]) || null;
        }
        if (norm.includes("FROM shopping_items WHERE listId = ? AND (status = 'PURCHASED' OR transactionId IS NOT NULL)")) {
          const listId = params[0];
          const count = shoppingItemsTable.filter(
            (i) => i.listId === listId && (i.status === 'PURCHASED' || i.transactionId != null)
          ).length;
          return { count };
        }
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const norm = sql.replace(/\s+/g, ' ').trim();
        if (norm.includes('PRAGMA foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (norm.includes('FROM shopping_lists')) {
          if (norm.includes('WHERE isArchived = 0')) {
            return shoppingListsTable.filter((l) => l.isArchived === 0);
          }
          return [...shoppingListsTable];
        }
        if (norm.includes('FROM shopping_items')) {
          if (norm.includes('WHERE listId = ?')) {
            return shoppingItemsTable.filter((i) => i.listId === params[0]);
          }
          return [...shoppingItemsTable];
        }
        return [];
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const norm = sql.replace(/\s+/g, ' ').trim();
        if (norm.includes('INSERT INTO shopping_lists')) {
          shoppingListsTable.push({
            id: params[0],
            name: params[1],
            isArchived: 0,
            createdAt: params[2],
            updatedAt: params[3],
          });
          return { changes: 1 };
        }
        if (norm.includes('UPDATE shopping_lists')) {
          const list = shoppingListsTable.find((l) => l.id === params[3]);
          if (list) {
            list.name = params[0];
            list.isArchived = params[1];
            list.updatedAt = params[2];
          }
          return { changes: 1 };
        }
        if (norm.includes('INSERT INTO shopping_items')) {
          shoppingItemsTable.push({
            id: params[0],
            listId: params[1],
            name: params[2],
            note: params[3],
            productUrl: params[4],
            estimatedPrice: params[5],
            status: 'PENDING',
            createdAt: params[6],
            updatedAt: params[7],
            purchasedAt: null,
            purchasePrice: null,
            purchaseAccountId: null,
            transactionId: null,
            categoryId: null,
          });
          return { changes: 1 };
        }
        if (norm.includes('UPDATE shopping_items SET name = ?, note = ?, productUrl = ?, estimatedPrice = ?, updatedAt = ? WHERE id = ?')) {
          const item = shoppingItemsTable.find((i) => i.id === params[5]);
          if (item) {
            item.name = params[0];
            item.note = params[1];
            item.productUrl = params[2];
            item.estimatedPrice = params[3];
            item.updatedAt = params[4];
          }
          return { changes: 1 };
        }
        if (norm.includes("UPDATE shopping_items SET status = 'DISCARDED'")) {
          const item = shoppingItemsTable.find((i) => i.id === params[1]);
          if (item) {
            item.status = 'DISCARDED';
            item.updatedAt = params[0];
          }
          return { changes: 1 };
        }
        if (norm.includes("UPDATE shopping_items SET status = 'PENDING'")) {
          const item = shoppingItemsTable.find((i) => i.id === params[1]);
          if (item) {
            item.status = 'PENDING';
            item.updatedAt = params[0];
          }
          return { changes: 1 };
        }
        if (norm.includes('DELETE FROM shopping_items WHERE id = ?')) {
          shoppingItemsTable = shoppingItemsTable.filter((i) => i.id !== params[0]);
          return { changes: 1 };
        }
        return { changes: 1 };
      }),
      withExclusiveTransactionAsync: jest.fn(async (cb: (txn: any) => Promise<any>) => {
        return cb(mockTxn);
      }),
      execAsync: jest.fn(),
    };

    openMock.mockResolvedValue(mockDb);
  });

  describe('1. Shopping Lists CRUD & Safe Deletion', () => {
    it('creates a shopping list with valid name and default active state', async () => {
      const list = await createShoppingList('  Groceries  ');
      expect(list.id).toBeDefined();
      expect(list.name).toBe('Groceries');
      expect(list.isArchived).toBe(false);
      expect(shoppingListsTable).toHaveLength(1);
      expect(shoppingListsTable[0].name).toBe('Groceries');
    });

    it('rejects blank or whitespace shopping list names', async () => {
      await expect(createShoppingList('')).rejects.toThrow('Shopping list name cannot be blank.');
      await expect(createShoppingList('   ')).rejects.toThrow('Shopping list name cannot be blank.');
    });

    it('renames a shopping list and updates updatedAt', async () => {
      const list = await createShoppingList('Needs');
      const updated = await updateShoppingList(list.id, { name: 'Monthly Needs' });
      expect(updated.name).toBe('Monthly Needs');
      expect(shoppingListsTable[0].name).toBe('Monthly Needs');
    });

    it('archives a shopping list', async () => {
      const list = await createShoppingList('Electronics');
      await archiveShoppingList(list.id, true);
      expect(shoppingListsTable[0].isArchived).toBe(1);
    });

    it('hard deletes a list when it contains NO purchased items or transactions', async () => {
      const list = await createShoppingList('Temporary List');
      // Add a pending item
      await createShoppingItem({ listId: list.id, name: 'Socks' });

      mockTxn.runAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('DELETE FROM shopping_items WHERE listId = ?')) {
          shoppingItemsTable = shoppingItemsTable.filter((i) => i.listId !== params[0]);
        }
        if (sql.includes('DELETE FROM shopping_lists WHERE id = ?')) {
          shoppingListsTable = shoppingListsTable.filter((l) => l.id !== params[0]);
        }
        return { changes: 1 };
      });

      const result = await deleteShoppingList(list.id);
      expect(result.deleted).toBe(true);
      expect(result.archivedInstead).toBe(false);
      expect(shoppingListsTable).toHaveLength(0);
      expect(shoppingItemsTable).toHaveLength(0);
    });

    it('prevents hard deletion and safely archives if list contains PURCHASED items', async () => {
      const list = await createShoppingList('Diwali Shopping');
      // Put a purchased item in table
      shoppingItemsTable.push({
        id: 'item-purchased-1',
        listId: list.id,
        name: 'Sweet Box',
        status: 'PURCHASED',
        transactionId: 'tx-123',
        purchasePrice: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await deleteShoppingList(list.id);
      expect(result.deleted).toBe(false);
      expect(result.archivedInstead).toBe(true);
      expect(result.message).toContain('safely archived instead of deleted');
      // List was archived, not deleted
      expect(shoppingListsTable[0].isArchived).toBe(1);
      // Items and transaction reference preserved
      expect(shoppingItemsTable).toHaveLength(1);
      expect(shoppingItemsTable[0].transactionId).toBe('tx-123');
    });
  });

  describe('2. Shopping Items Lifecycle', () => {
    let testListId: string;

    beforeEach(async () => {
      const list = await createShoppingList('Work Station');
      testListId = list.id;
    });

    it('creates an item with name, optional estimated price, note, and URL', async () => {
      const item = await createShoppingItem({
        listId: testListId,
        name: 'Mechanical Keyboard',
        estimatedPrice: 350000, // ₹3,500.00
        note: 'Cherry MX Brown switches',
        productUrl: 'https://keychron.in/k2',
      });

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Mechanical Keyboard');
      expect(item.estimatedPrice).toBe(350000);
      expect(item.status).toBe('PENDING');
      expect(item.productUrl).toBe('https://keychron.in/k2');
      expect(item.note).toBe('Cherry MX Brown switches');
    });

    it('creates an item without optional fields', async () => {
      const item = await createShoppingItem({
        listId: testListId,
        name: 'HDMI Cable',
      });

      expect(item.id).toBeDefined();
      expect(item.name).toBe('HDMI Cable');
      expect(item.estimatedPrice).toBeUndefined();
      expect(item.note).toBeUndefined();
      expect(item.productUrl).toBeUndefined();
      expect(item.status).toBe('PENDING');
    });

    it('rejects blank item name or non-existent list', async () => {
      await expect(
        createShoppingItem({ listId: testListId, name: '   ' })
      ).rejects.toThrow('Product name cannot be blank.');

      await expect(
        createShoppingItem({ listId: 'missing-list', name: 'Valid Item' })
      ).rejects.toThrow('Shopping list "missing-list" not found.');
    });

    it('updates pending item details', async () => {
      const item = await createShoppingItem({
        listId: testListId,
        name: 'Monitor Arm',
      });

      const updated = await updateShoppingItem(item.id, {
        name: 'Dual Monitor Arm',
        estimatedPrice: 420000,
        note: 'Supports 32 inch screens',
      });

      expect(updated.name).toBe('Dual Monitor Arm');
      expect(updated.estimatedPrice).toBe(420000);
      expect(updated.note).toBe('Supports 32 inch screens');
    });

    it('discards an item and allows restoring it back to PENDING', async () => {
      const item = await createShoppingItem({
        listId: testListId,
        name: 'Fancy Desk Mat',
      });

      // Discard
      await discardShoppingItem(item.id);
      expect(shoppingItemsTable[0].status).toBe('DISCARDED');
      // No financial transaction created
      expect(transactionsTable).toHaveLength(0);

      // Restore
      await restoreShoppingItem(item.id);
      expect(shoppingItemsTable[0].status).toBe('PENDING');
    });

    it('cannot discard an already purchased item', async () => {
      shoppingItemsTable.push({
        id: 'purchased-item',
        listId: testListId,
        name: 'Sold Item',
        status: 'PURCHASED',
        transactionId: 'tx-999',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(discardShoppingItem('purchased-item')).rejects.toThrow(
        'Cannot discard an already purchased shopping item.'
      );
    });

    it('cannot delete a purchased item with financial history', async () => {
      shoppingItemsTable.push({
        id: 'purchased-item',
        listId: testListId,
        name: 'Sold Item',
        status: 'PURCHASED',
        transactionId: 'tx-999',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(deleteShoppingItem('purchased-item')).rejects.toThrow(
        'Cannot delete a purchased shopping item with a linked financial transaction. Preserving history.'
      );
    });
  });

  describe('3. Purchase Flow & Financial Transactions', () => {
    let testListId: string;
    let testItemId: string;

    beforeEach(async () => {
      const list = await createShoppingList('Home Tech');
      testListId = list.id;
      const item = await createShoppingItem({
        listId: testListId,
        name: 'Webcam 1080p',
        estimatedPrice: 250000, // ₹2,500
      });
      testItemId = item.id;
    });

    it('rejects invalid or non-positive purchase price', async () => {
      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 0,
          purchaseAccountId: 'acc-bank-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('Please enter a valid purchase price greater than zero.');

      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: -500,
          purchaseAccountId: 'acc-bank-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('Please enter a valid purchase price greater than zero.');
    });

    it('rejects archived account as funding source', async () => {
      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 150000,
          purchaseAccountId: 'acc-archived-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('is archived and cannot be used for spending');
    });

    it('rejects CREDIT_CARD and INVESTMENT accounts directly', async () => {
      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 150000,
          purchaseAccountId: 'acc-credit-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('cannot be used as a direct funding source');

      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 150000,
          purchaseAccountId: 'acc-inv-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('cannot be used as a direct funding source');
    });

    it('rejects purchase when account balance is insufficient', async () => {
      // Wallet cash has only 50000 paise (₹500.00). Attempt purchase of ₹1,200.00 (120000 paise)
      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 120000,
          purchaseAccountId: 'acc-cash-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('Insufficient balance');

      // Verify item remains PENDING
      expect(shoppingItemsTable[0].status).toBe('PENDING');
      // No transaction was created
      expect(transactionsTable).toHaveLength(0);
    });

    it('rejects non-EXPENSE category', async () => {
      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 200000,
          purchaseAccountId: 'acc-bank-1',
          categoryId: 'cat-salary', // INCOME category
        })
      ).rejects.toThrow('Shopping purchases must use an Expense category.');
    });

    it('successfully purchases item: creates exactly 1 EXPENSE transaction and links it', async () => {
      const result = await purchaseShoppingItem({
        itemId: testItemId,
        purchasePrice: 229900, // ₹2,299.00
        purchaseAccountId: 'acc-bank-1',
        categoryId: 'cat-electronics',
        purchaseDate: '2026-10-01',
      });

      expect(result.shoppingItem.status).toBe('PURCHASED');
      expect(result.shoppingItem.purchasePrice).toBe(229900);
      expect(result.shoppingItem.transactionId).toBeDefined();
      expect(result.shoppingItem.purchaseAccountId).toBe('acc-bank-1');
      expect(result.shoppingItem.categoryId).toBe('cat-electronics');
      expect(result.transactionId).toBe(result.shoppingItem.transactionId);

      // Verify the transaction created in transactions table
      expect(transactionsTable).toHaveLength(1);
      const tx = transactionsTable[0];
      expect(tx.id).toBe(result.transactionId);
      expect(tx.type).toBe('EXPENSE');
      expect(tx.amount).toBe(229900);
      expect(tx.accountId).toBe('acc-bank-1');
      expect(tx.categoryId).toBe('cat-electronics');
      expect(tx.date).toBe('2026-10-01');
      expect(tx.note).toBe('Shopping: Webcam 1080p');
      expect(JSON.parse(tx.metadata)).toEqual({
        shoppingItemId: testItemId,
        shoppingListId: testListId,
        productName: 'Webcam 1080p',
      });
    });

    it('rejects duplicate purchase attempt for already purchased item', async () => {
      // First purchase succeeds
      await purchaseShoppingItem({
        itemId: testItemId,
        purchasePrice: 229900,
        purchaseAccountId: 'acc-bank-1',
        categoryId: 'cat-electronics',
      });

      // Second purchase on same item should fail
      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 229900,
          purchaseAccountId: 'acc-bank-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('This item has already been marked as purchased.');

      // Only 1 transaction exists
      expect(transactionsTable).toHaveLength(1);
    });

    it('atomic rollback leaves item PENDING if transaction creation fails', async () => {
      // Simulate database failure during transaction insertion
      mockTxn.runAsync.mockImplementationOnce(async (sql: string) => {
        if (sql.includes('INSERT INTO transactions')) {
          throw new Error('Database disk error');
        }
        return { changes: 1 };
      });

      await expect(
        purchaseShoppingItem({
          itemId: testItemId,
          purchasePrice: 150000,
          purchaseAccountId: 'acc-bank-1',
          categoryId: 'cat-electronics',
        })
      ).rejects.toThrow('Database disk error');

      // Shopping item status must remain PENDING
      expect(shoppingItemsTable[0].status).toBe('PENDING');
      expect(shoppingItemsTable[0].transactionId).toBeNull();
      expect(transactionsTable).toHaveLength(0);
    });
  });

  describe('4. Product URL Normalization & Validation', () => {
    it('normalizes valid domains by prepending https://', () => {
      expect(normalizeProductUrl('amazon.in/dp/B08N5WRWNW')).toBe('https://amazon.in/dp/B08N5WRWNW');
      expect(normalizeProductUrl('http://myshop.com/item')).toBe('http://myshop.com/item');
      expect(normalizeProductUrl('https://store.google.com/product/pixel')).toBe('https://store.google.com/product/pixel');
    });

    it('handles null, undefined, or empty URLs safely', () => {
      expect(normalizeProductUrl(undefined)).toBeNull();
      expect(normalizeProductUrl(null)).toBeNull();
      expect(normalizeProductUrl('   ')).toBeNull();
    });

    it('rejects invalid URL strings', () => {
      expect(() => normalizeProductUrl('not-a-valid-url')).toThrow('Please enter a valid web URL');
      expect(() => normalizeProductUrl('http://')).toThrow('Please enter a valid web URL');
    });
  });

  describe('5. List Summaries and Financial Calculations', () => {
    it('computes accurate summaries for pending items, purchased items, and totals', async () => {
      const list = await createShoppingList('Monthly Essentials');

      // Item 1: Pending with estimated price ₹1,000 (100000 paise)
      shoppingItemsTable.push({
        id: 'i1',
        listId: list.id,
        name: 'Oil',
        status: 'PENDING',
        estimatedPrice: 100000,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });

      // Item 2: Pending without estimated price
      shoppingItemsTable.push({
        id: 'i2',
        listId: list.id,
        name: 'Salt',
        status: 'PENDING',
        estimatedPrice: null,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });

      // Item 3: Purchased for ₹2,450 (245000 paise)
      shoppingItemsTable.push({
        id: 'i3',
        listId: list.id,
        name: 'Basmati Rice 10kg',
        status: 'PURCHASED',
        estimatedPrice: 260000,
        purchasePrice: 245000,
        purchaseAccountId: 'acc-bank-1',
        transactionId: 'tx-rice',
        categoryId: 'cat-groceries',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });

      // Item 4: Discarded
      shoppingItemsTable.push({
        id: 'i4',
        listId: list.id,
        name: 'Unneeded Snack',
        status: 'DISCARDED',
        estimatedPrice: 50000,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });

      const summaries = await getShoppingListSummaries(false);
      expect(summaries).toHaveLength(1);
      const summary = summaries[0];

      expect(summary.pendingCount).toBe(2); // i1 and i2
      expect(summary.purchasedCount).toBe(1); // i3
      // Estimated pending total only includes pending items with estimatedPrice
      expect(summary.estimatedPendingTotal).toBe(100000);
      // Purchased total comes from actual purchasePrice
      expect(summary.purchasedTotal).toBe(245000);
    });
  });
});
