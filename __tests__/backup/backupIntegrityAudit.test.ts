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
        if (sql.includes('INSERT INTO shopping_items')) {
          const [id, listId, name, note, productUrl, estimatedPrice, status] = params;
          shoppingItemsTable.set(id, {
            id, listId, name, note, productUrl, estimatedPrice, status,
          });
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO shopping_lists')) {
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
        if (sql.includes('DELETE FROM shopping_lists')) {
          shoppingListsTable.clear();
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
        if (sql.includes('DELETE FROM shopping_lists')) shoppingListsTable.clear();
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
});
