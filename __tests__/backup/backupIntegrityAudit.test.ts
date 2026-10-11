import {
  createBackupData,
  validateBackupData,
  restoreBackup,
} from '../../src/utils/backup';
import {
  createCard,
  getAllCards,
} from '../../src/database/repositories/cardRepository';
import {
  createAccount,
  getAllAccounts,
} from '../../src/database/repositories/accountRepository';
import { DatabaseSync } from 'node:sqlite';
import { CREATE_TABLES_SQL } from '../../src/database/schema';
import { _resetDatabaseForTesting } from '../../src/database/db';
import { openDatabaseAsync } from 'expo-sqlite';

const openMock = openDatabaseAsync as jest.Mock;

describe('Backup and Restore Integrity Audit Regression Tests', () => {
  let accountsTable: Map<string, any>;
  let cardsTable: Map<string, any>;
  let shoppingListsTable: Map<string, any>;
  let shoppingItemsTable: Map<string, any>;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    accountsTable = new Map();
    cardsTable = new Map();
    shoppingListsTable = new Map();
    shoppingItemsTable = new Map();

    mockDb = {
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts')) {
          return Array.from(accountsTable.values());
        }
        if (sql.includes('FROM cards')) {
          return Array.from(cardsTable.values());
        }
        if (sql.includes('FROM shopping_lists')) {
          return Array.from(shoppingListsTable.values());
        }
        if (sql.includes('FROM shopping_items')) {
          return Array.from(shoppingItemsTable.values());
        }
        return [];
      }),
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return accountsTable.get(params[0]) || null;
        }
        if (sql.includes('FROM cards WHERE id = ?')) {
          return cardsTable.get(params[0]) || null;
        }
        return null;
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO accounts') || sql.includes('INSERT OR REPLACE INTO accounts')) {
          const [id, name, type, openingBalance, creditLimit, billingDay, dueDay, currency] = params;
          accountsTable.set(id, {
            id, name, type, openingBalance, creditLimit, billingDay, dueDay, currency,
            isArchived: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO cards') || sql.includes('INSERT OR REPLACE INTO cards')) {
          const [
            id, cardholderName, cardType, network, encryptedCardNumber,
            lastFour, expiryMonth, expiryYear, cardNickname, linkedAccountId,
            colorTheme, issuer, createdAt, updatedAt
          ] = params;
          cardsTable.set(id, {
            id, cardholderName, cardType, network, encryptedCardNumber,
            lastFour, expiryMonth, expiryYear, cardNickname, linkedAccountId,
            colorTheme, issuer, isArchived: 0, createdAt, updatedAt
          });
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO shopping_items') || sql.includes('INSERT OR REPLACE INTO shopping_items')) {
          const [
            id, listId, name, note, productUrl, estimatedPrice, status,
            createdAt, updatedAt, purchasedAt, purchasePrice, purchaseAccountId,
            transactionId, categoryId
          ] = params;
          shoppingItemsTable.set(id, {
            id, listId, name, note, productUrl, estimatedPrice, status,
            createdAt, updatedAt, purchasedAt, purchasePrice, purchaseAccountId,
            transactionId, categoryId
          });
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO shopping_lists') || sql.includes('INSERT OR REPLACE INTO shopping_lists')) {
          const [id, name, isArchived, createdAt, updatedAt] = params;
          shoppingListsTable.set(id, {
            id, name, isArchived, createdAt, updatedAt,
          });
          return { changes: 1 };
        }
        if (sql.includes('UPDATE cards SET linkedAccountId = ? WHERE id = ?')) {
          const [accId, cardId] = params;
          const card = cardsTable.get(cardId);
          if (card) {
            card.linkedAccountId = accId;
          }
          return { changes: 1 };
        }
        if (sql.includes('UPDATE shopping_items SET purchaseAccountId = ?, transactionId = ?, categoryId = ? WHERE id = ?')) {
          const [purchaseAccountId, transactionId, categoryId, itemId] = params;
          const item = shoppingItemsTable.get(itemId);
          if (item) {
            item.purchaseAccountId = purchaseAccountId;
            item.transactionId = transactionId;
            item.categoryId = categoryId;
          }
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM cards WHERE id = ?')) {
          cardsTable.delete(params[0]);
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM cards')) {
          cardsTable.clear();
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM shopping_lists WHERE id NOT IN')) {
          const keepIds = new Set(params);
          for (const listId of Array.from(shoppingListsTable.keys())) {
            if (!keepIds.has(listId)) {
              shoppingListsTable.delete(listId);
              // In SQLite, deleting shopping_lists cascades to shopping_items
              for (const [itemId, item] of Array.from(shoppingItemsTable.entries())) {
                if (item.listId === listId) {
                  shoppingItemsTable.delete(itemId);
                }
              }
            }
          }
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM shopping_lists')) {
          shoppingListsTable.clear();
          // SQLite ON DELETE CASCADE: deleting shopping_lists cascades to all child items!
          shoppingItemsTable.clear();
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM shopping_items')) {
          shoppingItemsTable.clear();
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM accounts')) {
          accountsTable.clear();
          return { changes: 1 };
        }
        return { changes: 1 };
      }),
      execAsync: jest.fn(async (sql: string) => {
        if (sql.includes('DELETE FROM cards')) cardsTable.clear();
        if (sql.includes('DELETE FROM shopping_lists')) {
          shoppingListsTable.clear();
          // SQLite ON DELETE CASCADE: deleting shopping_lists cascades to all child items!
          shoppingItemsTable.clear();
        }
        if (sql.includes('DELETE FROM shopping_items')) shoppingItemsTable.clear();
        if (sql.includes('DELETE FROM accounts')) {
          accountsTable.clear();
          // Simulate SQLite cascading foreign-key action: ON DELETE SET NULL on cards and shopping items
          for (const card of cardsTable.values()) {
            card.linkedAccountId = null;
          }
          for (const item of shoppingItemsTable.values()) {
            item.purchaseAccountId = null;
            item.transactionId = null;
            item.categoryId = null;
          }
        }
      }),
      withTransactionAsync: jest.fn(async (cb: any) => cb()),
      withExclusiveTransactionAsync: jest.fn(async (cb: any) => cb(mockDb)),
    };

    openMock.mockResolvedValue(mockDb);
  });

  describe('1. Non-Destructive Legacy and Partial Backup Restore', () => {
    it('restoring legacy backup with matching account preserves existing cards and reconstructs links', async () => {
      // 1. Existing local state has a card and a bank account
      const bank = await createAccount({
        id: 'acc-existing-bank',
        name: 'HDFC Savings',
        type: 'BANK',
        openingBalance: 100000,
        currency: 'INR',
        isArchived: false,
      });

      const card = await createCard({
        cardholderName: 'Aarav Sharma',
        cardNumber: '6080123456789015',
        cardType: 'DEBIT',
        network: 'RUPAY',
        expiryMonth: 8,
        expiryYear: 2029,
        linkedAccountId: bank.id,
      });

      expect(cardsTable.size).toBe(1);

      // 2. Incoming legacy backup from schema v1 containing matching bank account
      const legacyBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-existing-bank',
              name: 'HDFC Savings',
              type: 'BANK',
              openingBalance: 100000,
              creditLimit: 0,
              currency: 'INR',
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          // cards, shoppingLists, shoppingItems are UNDEFINED (legacy schema)
        },
      };

      const validation = validateBackupData(legacyBackup);
      expect(validation.isValid).toBe(true);

      // 3. Perform restore
      await restoreBackup(legacyBackup);

      // 4. Assert non-destructive behavior: existing card NOT deleted and link reconstructed!
      expect(cardsTable.size).toBe(1);
      expect(cardsTable.has(card.id)).toBe(true);
      expect(cardsTable.get(card.id).cardholderName).toBe('Aarav Sharma');
      expect(cardsTable.get(card.id).linkedAccountId).toBe('acc-existing-bank');
    });

    it('aborts restoration when a retained card references an account missing from the incoming backup', async () => {
      // Local state has card linked to acc-local-bank
      accountsTable.set('acc-local-bank', {
        id: 'acc-local-bank',
        name: 'Local Bank',
        type: 'BANK',
      });
      cardsTable.set('card-1', {
        id: 'card-1',
        cardholderName: 'Pooja Verma',
        cardType: 'DEBIT',
        lastFour: '1234',
        linkedAccountId: 'acc-local-bank',
      });

      // Backup only has acc-other-bank
      const backupMissingAcc: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-other-bank',
              name: 'Other Bank',
              type: 'BANK',
              openingBalance: 1000,
              creditLimit: 0,
              currency: 'INR',
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
        },
      };

      await expect(restoreBackup(backupMissingAcc)).rejects.toThrow(
        /references account ID "acc-local-bank" which does not exist in the incoming backup/i
      );

      // Database modifications aborted: original local records remain untouched
      expect(cardsTable.has('card-1')).toBe(true);
      expect(cardsTable.get('card-1').linkedAccountId).toBe('acc-local-bank');
    });

    it('restores backup with shoppingLists present but shoppingItems omitted', async () => {
      // Local shopping items exist referencing list-1
      shoppingListsTable.set('list-1', { id: 'list-1', name: 'Groceries' });
      shoppingItemsTable.set('item-1', {
        id: 'item-1',
        listId: 'list-1',
        name: 'Apples',
        status: 'PENDING',
      });

      // Backup contains shoppingLists containing list-1, but shoppingItems is omitted
      const backupListsOnly: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingLists: [
            {
              id: 'list-1',
              name: 'Groceries Updated',
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      await restoreBackup(backupListsOnly);

      // shoppingItemsTable was NOT erased because shoppingItems was omitted in backup
      expect(shoppingItemsTable.size).toBe(1);
      expect(shoppingItemsTable.get('item-1').name).toBe('Apples');
    });

    it('aborts when retained shopping item references a list omitted from incoming backup', async () => {
      shoppingListsTable.set('list-old', { id: 'list-old', name: 'Old List' });
      shoppingItemsTable.set('item-old', {
        id: 'item-old',
        listId: 'list-old',
        name: 'Item Old',
        status: 'PENDING',
      });

      // Incoming backup has shoppingLists, but not list-old
      const backupNewListOnly: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingLists: [
            {
              id: 'list-new',
              name: 'New List',
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      await expect(restoreBackup(backupNewListOnly)).rejects.toThrow(
        /references shopping list ID "list-old" which is missing in the incoming backup/i
      );
    });

    it('restores backup with shoppingItems present but shoppingLists omitted when list exists locally', async () => {
      shoppingListsTable.set('list-local', { id: 'list-local', name: 'My List' });

      const backupItemsOnly: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingItems: [
            {
              id: 'item-incoming',
              listId: 'list-local',
              name: 'Milk',
              status: 'PENDING',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      await restoreBackup(backupItemsOnly);

      expect(shoppingListsTable.has('list-local')).toBe(true);
      expect(shoppingItemsTable.has('item-incoming')).toBe(true);
    });

    it('preserves shopping purchase links when shopping data is omitted but account/tx/category IDs match', async () => {
      // Local state has purchased item referencing acc-1, tx-1, cat-1
      shoppingItemsTable.set('item-purchased', {
        id: 'item-purchased',
        listId: 'list-1',
        name: 'Headphones',
        status: 'PURCHASED',
        purchasePrice: 5000,
        purchasedAt: '2025-05-10T12:00:00.000Z',
        purchaseAccountId: 'acc-1',
        transactionId: 'tx-1',
        categoryId: 'cat-1',
      });

      // Backup contains matching acc-1, cat-1, and tx-1 with consistent metadata
      const backupMatchingCore: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-05-10T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-1',
              name: 'Bank',
              type: 'BANK',
              openingBalance: 100000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          categories: [
            {
              id: 'cat-1',
              name: 'Electronics',
              type: 'EXPENSE',
              icon: 'tv',
              isDefault: false,
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          transactions: [
            {
              id: 'tx-1',
              type: 'EXPENSE',
              amount: 5000,
              date: '2025-05-10',
              accountId: 'acc-1',
              categoryId: 'cat-1',
              metadata: JSON.stringify({ shoppingItemId: 'item-purchased' }),
              createdAt: '2025-05-10T12:00:00.000Z',
              updatedAt: '2025-05-10T12:00:00.000Z',
            },
          ],
          people: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          // shopping data omitted in backup
        },
      };

      await restoreBackup(backupMatchingCore);

      const retainedItem = shoppingItemsTable.get('item-purchased');
      expect(retainedItem).toBeDefined();
      expect(retainedItem.purchaseAccountId).toBe('acc-1');
      expect(retainedItem.transactionId).toBe('tx-1');
      expect(retainedItem.categoryId).toBe('cat-1');
    });

    it('rolls back database modifications when failure occurs midway through transaction', async () => {
      mockDb.runAsync.mockImplementationOnce(async (sql: string) => {
        if (sql.includes('INSERT INTO accounts')) {
          throw new Error('Simulated SQLite disk write I/O error');
        }
      });

      const backup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-new',
              name: 'New Bank',
              type: 'BANK',
              openingBalance: 5000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
        },
      };

      await expect(restoreBackup(backup)).rejects.toThrow(/Simulated SQLite disk write I\/O error/);
    });
  });

  describe('2. Comprehensive Validation of Backup Import Data', () => {
    it('rejects backup with invalid payment network on a card record', () => {
      const invalidBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          cards: [
            {
              id: 'card-bad-net',
              cardholderName: 'Aarav Sharma',
              cardType: 'CREDIT',
              network: 'BITCOIN_NETWORK', // Invalid network
              encryptedCardNumber: 'aes-gcm:v1:abcd',
              lastFour: '1234',
              expiryMonth: 10,
              expiryYear: 2028,
              issuer: 'SBI Card',
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      const result = validateBackupData(invalidBackup);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('card wallet records');
    });

    it('rejects backup with debit card linked to non-BANK account', () => {
      const invalidBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-credit-card-1',
              name: 'Credit Card Account',
              type: 'CREDIT_CARD',
              openingBalance: 0,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          cards: [
            {
              id: 'card-debit-bad-link',
              cardholderName: 'Pooja Verma',
              cardType: 'DEBIT',
              network: 'RUPAY',
              encryptedCardNumber: 'aes-gcm:v1:abcd',
              lastFour: '1234',
              expiryMonth: 10,
              expiryYear: 2028,
              linkedAccountId: 'acc-credit-card-1', // Incompatible: debit card linked to CREDIT_CARD account
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      const result = validateBackupData(invalidBackup);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('card wallet records');
    });

    it('rejects backup with credit card missing both issuer and linked account', () => {
      const invalidBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          cards: [
            {
              id: 'card-cc-no-issuer',
              cardholderName: 'Aarav Sharma',
              cardType: 'CREDIT',
              network: 'VISA',
              encryptedCardNumber: 'aes-gcm:v1:abcd',
              lastFour: '1234',
              expiryMonth: 10,
              expiryYear: 2028,
              // Missing issuer AND missing linkedAccountId
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      const result = validateBackupData(invalidBackup);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('card wallet records');
    });
  });

  describe('3. Privacy & Authentication Material Exclusion', () => {
    it('backup export NEVER contains PIN hashes, passwords, or plaintext encryption keys', async () => {
      const backup = await createBackupData();
      const json = JSON.stringify(backup);

      // Verify sensitive authentication terms do not appear
      expect(json).not.toMatch(/"pinHash"/i);
      expect(json).not.toMatch(/"password"/i);
      expect(json).not.toMatch(/"biometric/i);
      expect(json).not.toMatch(/"failedAttempts"/i);
      expect(json).not.toMatch(/"lockoutUntil"/i);
    });
  });

  describe('4. Genuine SQLite Engine Cascading Behavior & Partial Backup Matrix', () => {
    let realAdapter: any;

    beforeEach(() => {
      _resetDatabaseForTesting();
      const rawDb = new DatabaseSync(':memory:');
      rawDb.exec('PRAGMA foreign_keys = ON;');
      rawDb.exec(CREATE_TABLES_SQL);

      const normalize = (params: any[] = []) =>
        params.map((p) => (p === undefined ? null : p));

      realAdapter = {
        execAsync: async (sql: string) => {
          rawDb.exec(sql);
        },
        runAsync: async (sql: string, params: any[] = []) => {
          const stmt = rawDb.prepare(sql);
          const res = stmt.run(...normalize(params));
          return {
            changes: Number(res.changes),
            lastInsertRowId: Number(res.lastInsertRowid),
          };
        },
        getAllAsync: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
          const stmt = rawDb.prepare(sql);
          return stmt.all(...normalize(params)) as T[];
        },
        getFirstAsync: async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
          const stmt = rawDb.prepare(sql);
          return (stmt.get(...normalize(params)) as T) || null;
        },
        withTransactionAsync: async (cb: (txn: any) => Promise<void>) => {
          rawDb.exec('BEGIN IMMEDIATE;');
          try {
            await cb(realAdapter);
            rawDb.exec('COMMIT;');
          } catch (err) {
            try { rawDb.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        },
        withExclusiveTransactionAsync: async (cb: (txn: any) => Promise<void>) => {
          rawDb.exec('BEGIN IMMEDIATE;');
          try {
            await cb(realAdapter);
            rawDb.exec('COMMIT;');
          } catch (err) {
            try { rawDb.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        },
        closeAsync: async () => {
          rawDb.close();
        },
        raw: rawDb,
      };

      openMock.mockResolvedValue(realAdapter);
    });

    afterEach(() => {
      _resetDatabaseForTesting();
      if (realAdapter?.raw) {
        try { realAdapter.raw.close(); } catch {}
      }
    });

    it('genuinely verifies SQLite foreign keys are ON and cascade is enforced', () => {
      const fkCheck = realAdapter.raw.prepare('PRAGMA foreign_keys;').get() as { foreign_keys: number };
      expect(fkCheck.foreign_keys).toBe(1);

      // Verify that deleting a list directly causes SQLite ON DELETE CASCADE on items
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('fk-test-list', 'List FK', 0, '2026-01-01', '2026-01-01');
        INSERT INTO shopping_items (id, listId, name, status, createdAt, updatedAt)
        VALUES ('fk-test-item', 'fk-test-list', 'Item FK', 'PENDING', '2026-01-01', '2026-01-01');
      `);

      const beforeCount = (realAdapter.raw.prepare("SELECT COUNT(*) as count FROM shopping_items WHERE id = 'fk-test-item';").get() as any).count;
      expect(beforeCount).toBe(1);

      realAdapter.raw.exec("DELETE FROM shopping_lists WHERE id = 'fk-test-list';");

      const afterCount = (realAdapter.raw.prepare("SELECT COUNT(*) as count FROM shopping_items WHERE id = 'fk-test-item';").get() as any).count;
      expect(afterCount).toBe(0);
    });

    it('partial backup matrix: shoppingLists only (shoppingItems omitted) preserves retained items without cascade loss', async () => {
      // 1. Seed real SQLite database with accounts, categories, transactions, lists, and items
      realAdapter.raw.exec(`
        INSERT INTO accounts (id, name, type, openingBalance, currency, isArchived, createdAt, updatedAt)
        VALUES ('acc-real-bank', 'HDFC Bank', 'BANK', 5000000, 'INR', 0, '2026-01-01', '2026-01-01');

        INSERT INTO categories (id, name, type, icon, color, isDefault, isArchived, createdAt)
        VALUES ('cat-real-groceries', 'Groceries', 'EXPENSE', 'ShoppingCart', '#10B981', 0, 0, '2026-01-01');

        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-supermarket', 'Weekly Groceries', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-hardware', 'Tools', 0, '2026-01-01', '2026-01-01');

        INSERT INTO transactions (id, type, amount, date, accountId, categoryId, note, metadata, createdAt, updatedAt)
        VALUES (
          'tx-real-apple', 'EXPENSE', 45000, '2026-05-15', 'acc-real-bank', 'cat-real-groceries',
          'Bought apples', '{"shoppingItemId":"item-real-apple"}', '2026-05-15T10:00:00.000Z', '2026-05-15T10:00:00.000Z'
        );

        INSERT INTO shopping_items (
          id, listId, name, note, status, createdAt, updatedAt,
          purchasedAt, purchasePrice, purchaseAccountId, transactionId, categoryId
        ) VALUES (
          'item-real-apple', 'list-supermarket', 'Organic Apples', 'Fresh harvest', 'PURCHASED',
          '2026-05-15T09:00:00.000Z', '2026-05-15T10:00:00.000Z',
          '2026-05-15T10:00:00.000Z', 45000, 'acc-real-bank', 'tx-real-apple', 'cat-real-groceries'
        );

        INSERT INTO shopping_items (
          id, listId, name, note, status, createdAt, updatedAt
        ) VALUES (
          'item-real-hammer', 'list-hardware', 'Steel Hammer', 'Heavy duty', 'PENDING',
          '2026-05-15T09:00:00.000Z', '2026-05-15T09:00:00.000Z'
        );
      `);

      // Verify initial setup in real SQLite
      const initialItemCount = (realAdapter.raw.prepare('SELECT COUNT(*) as c FROM shopping_items;').get() as any).c;
      expect(initialItemCount).toBe(2);

      // 2. Incoming backup contains shoppingLists (with updated metadata) but OMITS shoppingItems
      const backupListsOnly: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-real-bank',
              name: 'HDFC Bank Priority',
              type: 'BANK',
              openingBalance: 5000000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-05-15',
            },
          ],
          categories: [
            {
              id: 'cat-real-groceries',
              name: 'Groceries & Foods',
              type: 'EXPENSE',
              icon: 'ShoppingCart',
              color: '#10B981',
              isDefault: false,
              isArchived: false,
              createdAt: '2026-01-01',
            },
          ],
          transactions: [
            {
              id: 'tx-real-apple',
              type: 'EXPENSE',
              amount: 45000,
              date: '2026-05-15',
              accountId: 'acc-real-bank',
              categoryId: 'cat-real-groceries',
              metadata: JSON.stringify({ shoppingItemId: 'item-real-apple' }),
              createdAt: '2026-05-15T10:00:00.000Z',
              updatedAt: '2026-05-15T10:00:00.000Z',
            },
          ],
          people: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingLists: [
            {
              id: 'list-supermarket',
              name: 'Weekly Groceries (Renamed)',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-05-15',
            },
            {
              id: 'list-hardware',
              name: 'Tools & Workshop',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-05-15',
            },
          ],
          // shoppingItems is explicitly undefined (omitted)
        },
      };

      // 3. Perform restoration
      await restoreBackup(backupListsOnly);

      // 4. Inspect real SQLite database:
      // Verify shopping lists updated
      const updatedList = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-supermarket';").get() as any;
      expect(updatedList.name).toBe('Weekly Groceries (Renamed)');

      // CRITICAL ASSERTION: All retained shopping items MUST be preserved in real SQLite!
      const allItems = realAdapter.raw.prepare('SELECT * FROM shopping_items ORDER BY id ASC;').all() as any[];
      expect(allItems.length).toBe(2);

      const appleItem = allItems.find((i: any) => i.id === 'item-real-apple');
      expect(appleItem).toBeDefined();
      expect(appleItem.name).toBe('Organic Apples');
      expect(appleItem.listId).toBe('list-supermarket');
      expect(appleItem.status).toBe('PURCHASED');
      expect(appleItem.purchasePrice).toBe(45000);
      expect(appleItem.purchaseAccountId).toBe('acc-real-bank');
      expect(appleItem.transactionId).toBe('tx-real-apple');
      expect(appleItem.categoryId).toBe('cat-real-groceries');

      const hammerItem = allItems.find((i: any) => i.id === 'item-real-hammer');
      expect(hammerItem).toBeDefined();
      expect(hammerItem.name).toBe('Steel Hammer');
      expect(hammerItem.listId).toBe('list-hardware');
      expect(hammerItem.status).toBe('PENDING');
    });

    it('partial backup matrix: shoppingItems only (shoppingLists omitted) restores into retained lists', async () => {
      // 1. Seed real SQLite database with retained shopping list
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-existing', 'Local List', 0, '2026-01-01', '2026-01-01');
      `);

      // 2. Backup contains incoming item for list-existing, but omits shoppingLists
      const backupItemsOnly: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          // shoppingLists omitted
          shoppingItems: [
            {
              id: 'item-newly-imported',
              listId: 'list-existing',
              name: 'Almond Milk',
              status: 'PENDING',
              createdAt: '2026-05-15T12:00:00.000Z',
              updatedAt: '2026-05-15T12:00:00.000Z',
            },
          ],
        },
      };

      await restoreBackup(backupItemsOnly);

      const listInDb = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-existing';").get() as any;
      expect(listInDb).toBeDefined();
      expect(listInDb.name).toBe('Local List');

      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-newly-imported';").get() as any;
      expect(itemInDb).toBeDefined();
      expect(itemInDb.name).toBe('Almond Milk');
      expect(itemInDb.listId).toBe('list-existing');
    });

    it('partial backup matrix: both collections present replaces local shopping data', async () => {
      // 1. Seed real SQLite with old lists and old items
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-old-to-drop', 'Old List', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (id, listId, name, status, createdAt, updatedAt)
        VALUES ('item-old-to-drop', 'list-old-to-drop', 'Old Item', 'PENDING', '2026-01-01', '2026-01-01');
      `);

      // 2. Backup contains both shoppingLists and shoppingItems
      const backupBoth: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingLists: [
            {
              id: 'list-incoming-fresh',
              name: 'Fresh Incoming List',
              isArchived: false,
              createdAt: '2026-05-15T00:00:00.000Z',
              updatedAt: '2026-05-15T00:00:00.000Z',
            },
          ],
          shoppingItems: [
            {
              id: 'item-incoming-fresh',
              listId: 'list-incoming-fresh',
              name: 'Fresh Incoming Item',
              status: 'PENDING',
              createdAt: '2026-05-15T00:00:00.000Z',
              updatedAt: '2026-05-15T00:00:00.000Z',
            },
          ],
        },
      };

      await restoreBackup(backupBoth);

      const oldList = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-old-to-drop';").get();
      expect(oldList).toBeUndefined();

      const oldItem = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-old-to-drop';").get();
      expect(oldItem).toBeUndefined();

      const newList = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-incoming-fresh';").get() as any;
      expect(newList).toBeDefined();

      const newItem = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-incoming-fresh';").get() as any;
      expect(newItem).toBeDefined();
    });

    it('partial backup matrix: neither collection present preserves local shopping data and reconstructs links', async () => {
      // 1. Seed real SQLite with core financial data, lists, and items
      realAdapter.raw.exec(`
        INSERT INTO accounts (id, name, type, openingBalance, currency, isArchived, createdAt, updatedAt)
        VALUES ('acc-legacy-bank', 'Legacy Bank', 'BANK', 100000, 'INR', 0, '2026-01-01', '2026-01-01');

        INSERT INTO categories (id, name, type, icon, color, isDefault, isArchived, createdAt)
        VALUES ('cat-legacy-exp', 'Electronics', 'EXPENSE', 'Tv', '#3B82F6', 0, 0, '2026-01-01');

        INSERT INTO transactions (id, type, amount, date, accountId, categoryId, note, metadata, createdAt, updatedAt)
        VALUES (
          'tx-legacy-headphones', 'EXPENSE', 12000, '2026-03-01', 'acc-legacy-bank', 'cat-legacy-exp',
          'Sony Headphones', '{"shoppingItemId":"item-legacy-headphones"}', '2026-03-01T10:00:00.000Z', '2026-03-01T10:00:00.000Z'
        );

        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-legacy-wishlist', 'Wishlist', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (
          id, listId, name, status, createdAt, updatedAt,
          purchasedAt, purchasePrice, purchaseAccountId, transactionId, categoryId
        ) VALUES (
          'item-legacy-headphones', 'list-legacy-wishlist', 'Sony Headphones', 'PURCHASED',
          '2026-03-01T09:00:00.000Z', '2026-03-01T10:00:00.000Z',
          '2026-03-01T10:00:00.000Z', 12000, 'acc-legacy-bank', 'tx-legacy-headphones', 'cat-legacy-exp'
        );
      `);

      // 2. Incoming legacy backup (schema v1) containing accounts and transactions, but omitting shoppingLists and shoppingItems
      const legacyBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-legacy-bank',
              name: 'Legacy Bank Recreated',
              type: 'BANK',
              openingBalance: 100000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-05-15',
            },
          ],
          categories: [
            {
              id: 'cat-legacy-exp',
              name: 'Electronics Recreated',
              type: 'EXPENSE',
              icon: 'Tv',
              color: '#3B82F6',
              isDefault: false,
              isArchived: false,
              createdAt: '2026-01-01',
            },
          ],
          transactions: [
            {
              id: 'tx-legacy-headphones',
              type: 'EXPENSE',
              amount: 12000,
              date: '2026-03-01',
              accountId: 'acc-legacy-bank',
              categoryId: 'cat-legacy-exp',
              metadata: JSON.stringify({ shoppingItemId: 'item-legacy-headphones' }),
              createdAt: '2026-03-01T10:00:00.000Z',
              updatedAt: '2026-03-01T10:00:00.000Z',
            },
          ],
          people: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          // Both shopping collections omitted
        },
      };

      await restoreBackup(legacyBackup);

      // Verify list still exists
      const listInDb = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-legacy-wishlist';").get() as any;
      expect(listInDb).toBeDefined();

      // Verify item still exists and has its foreign keys intact
      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-legacy-headphones';").get() as any;
      expect(itemInDb).toBeDefined();
      expect(itemInDb.status).toBe('PURCHASED');
      expect(itemInDb.purchaseAccountId).toBe('acc-legacy-bank');
      expect(itemInDb.transactionId).toBe('tx-legacy-headphones');
      expect(itemInDb.categoryId).toBe('cat-legacy-exp');
    });

    it('missing reference safety: aborts and leaves real SQLite untouched when retained item references missing list', async () => {
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-local-only', 'Local List Only', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (id, listId, name, status, createdAt, updatedAt)
        VALUES ('item-orphan-risk', 'list-local-only', 'Unprotected Item', 'PENDING', '2026-01-01', '2026-01-01');
      `);

      // Incoming backup contains shoppingLists, but DOES NOT contain list-local-only
      const incompatibleBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingLists: [
            {
              id: 'list-different-one',
              name: 'Different List',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
        },
      };

      await expect(restoreBackup(incompatibleBackup)).rejects.toThrow(
        /references shopping list ID "list-local-only" which is missing in the incoming backup/i
      );

      // Verify that real SQLite was NOT modified
      const listInDb = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-local-only';").get();
      expect(listInDb).toBeDefined();

      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-orphan-risk';").get();
      expect(itemInDb).toBeDefined();
    });

    it('missing reference safety: aborts when retained purchased item references missing account', async () => {
      realAdapter.raw.exec(`
        INSERT INTO accounts (id, name, type, openingBalance, currency, isArchived, createdAt, updatedAt)
        VALUES ('acc-old-bank', 'Old Bank', 'BANK', 50000, 'INR', 0, '2026-01-01', '2026-01-01');

        INSERT INTO transactions (id, type, amount, date, accountId, note, metadata, createdAt, updatedAt)
        VALUES ('tx-old', 'EXPENSE', 5000, '2026-01-01', 'acc-old-bank', 'Note', '{"shoppingItemId":"item-p"}', '2026-01-01', '2026-01-01');

        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-1', 'List 1', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (
          id, listId, name, status, createdAt, updatedAt,
          purchasedAt, purchasePrice, purchaseAccountId, transactionId
        ) VALUES (
          'item-p', 'list-1', 'Item P', 'PURCHASED', '2026-01-01', '2026-01-01',
          '2026-01-01', 5000, 'acc-old-bank', 'tx-old'
        );
      `);

      // Backup only has acc-different-bank (missing acc-old-bank)
      const incompatibleBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-different-bank',
              name: 'Different Bank',
              type: 'BANK',
              openingBalance: 10000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
          categories: [],
          transactions: [],
          people: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
        },
      };

      await expect(restoreBackup(incompatibleBackup)).rejects.toThrow(
        /references account ID "acc-old-bank" which does not exist in the incoming backup/i
      );

      // Verify that real SQLite was NOT modified
      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-p';").get() as any;
      expect(itemInDb).toBeDefined();
      expect(itemInDb.purchaseAccountId).toBe('acc-old-bank');
    });

    it('rollback safety: failed restoration rolls back real SQLite transaction without data loss', async () => {
      // 1. Seed real SQLite database
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-survivor', 'Survivor List', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (id, listId, name, status, createdAt, updatedAt)
        VALUES ('item-survivor', 'list-survivor', 'Survivor Item', 'PENDING', '2026-01-01', '2026-01-01');
      `);

      const validBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-attempt',
              name: 'Attempt Bank',
              type: 'BANK',
              openingBalance: 10000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
          categories: [],
          transactions: [],
          people: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
        },
      };

      // 2. Force an I/O disk failure inside the transaction
      const originalRunAsync = realAdapter.runAsync;
      realAdapter.runAsync = jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO accounts')) {
          throw new Error('Real SQLite Disk Write I/O Failure midway through transaction');
        }
        return originalRunAsync(sql, params);
      });

      // 3. Attempt restoration
      await expect(restoreBackup(validBackup)).rejects.toThrow(
        /Real SQLite Disk Write I\/O Failure/
      );

      // 4. Verify transaction rolled back: original records in real SQLite are completely intact!
      const listInDb = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-survivor';").get();
      expect(listInDb).toBeDefined();

      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-survivor';").get();
      expect(itemInDb).toBeDefined();
    });

    it('fails closed and aborts before destructive operations when reading retained cards query fails', async () => {
      realAdapter.raw.exec(`
        INSERT INTO accounts (id, name, type, openingBalance, currency, isArchived, createdAt, updatedAt)
        VALUES ('acc-fail-test', 'Local Bank', 'BANK', 10000, 'INR', 0, '2026-01-01', '2026-01-01');

        INSERT INTO cards (
          id, cardholderName, cardType, network, encryptedCardNumber, lastFour,
          expiryMonth, expiryYear, linkedAccountId, isArchived, createdAt, updatedAt
        ) VALUES (
          'card-fail-test', 'John Doe', 'DEBIT', 'VISA', 'aes-gcm:v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef', '1234',
          12, 2028, 'acc-fail-test', 0, '2026-01-01', '2026-01-01'
        );
      `);

      const originalGetAllAsync = realAdapter.getAllAsync;
      realAdapter.getAllAsync = jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM cards')) {
          throw new Error('Simulated SQLite disk read error for cards');
        }
        return originalGetAllAsync(sql, params);
      });

      const incomingBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          // cards omitted: requires reading retained cards
        },
      };

      await expect(restoreBackup(incomingBackup)).rejects.toThrow(
        /failed to read retained cards from local database.*Simulated SQLite disk read error for cards/i
      );

      // Verify NO destructive operations occurred: account and card are untouched in real SQLite!
      const cardInDb = realAdapter.raw.prepare("SELECT * FROM cards WHERE id = 'card-fail-test';").get();
      expect(cardInDb).toBeDefined();

      const accInDb = realAdapter.raw.prepare("SELECT * FROM accounts WHERE id = 'acc-fail-test';").get();
      expect(accInDb).toBeDefined();
    });

    it('fails closed and aborts before destructive operations when reading retained shopping lists query fails', async () => {
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-fail-test', 'Important List', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (id, listId, name, status, createdAt, updatedAt)
        VALUES ('item-fail-test', 'list-fail-test', 'Important Item', 'PENDING', '2026-01-01', '2026-01-01');
      `);

      const originalGetAllAsync = realAdapter.getAllAsync;
      realAdapter.getAllAsync = jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM shopping_lists')) {
          throw new Error('Simulated SQLite disk read error for shopping lists');
        }
        return originalGetAllAsync(sql, params);
      });

      const incomingBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
        },
      };

      await expect(restoreBackup(incomingBackup)).rejects.toThrow(
        /failed to read retained shopping lists from local database.*Simulated SQLite disk read error for shopping lists/i
      );

      // Verify NO destructive operations occurred: list and item are untouched in real SQLite!
      const listInDb = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-fail-test';").get();
      expect(listInDb).toBeDefined();

      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-fail-test';").get();
      expect(itemInDb).toBeDefined();
    });

    it('fails closed and aborts before destructive operations when reading retained shopping items query fails', async () => {
      realAdapter.raw.exec(`
        INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
        VALUES ('list-items-fail', 'Groceries', 0, '2026-01-01', '2026-01-01');

        INSERT INTO shopping_items (id, listId, name, status, createdAt, updatedAt)
        VALUES ('item-items-fail', 'list-items-fail', 'Apples', 'PENDING', '2026-01-01', '2026-01-01');
      `);

      const originalGetAllAsync = realAdapter.getAllAsync;
      realAdapter.getAllAsync = jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM shopping_items')) {
          throw new Error('Simulated SQLite disk read error for shopping items');
        }
        return originalGetAllAsync(sql, params);
      });

      const incomingBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-05-15T12:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          snapshots: [],
          settings: {},
          shoppingLists: [
            {
              id: 'list-items-fail',
              name: 'Groceries Updated',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-05-15',
            },
          ],
          // shoppingItems omitted
        },
      };

      await expect(restoreBackup(incomingBackup)).rejects.toThrow(
        /failed to read retained shopping items from local database.*Simulated SQLite disk read error for shopping items/i
      );

      // Verify NO destructive operations occurred: list still has original name, item still exists!
      const listInDb = realAdapter.raw.prepare("SELECT * FROM shopping_lists WHERE id = 'list-items-fail';").get() as any;
      expect(listInDb.name).toBe('Groceries');

      const itemInDb = realAdapter.raw.prepare("SELECT * FROM shopping_items WHERE id = 'item-items-fail';").get();
      expect(itemInDb).toBeDefined();
    });
  });
});
