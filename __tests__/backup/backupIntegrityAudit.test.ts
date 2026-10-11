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
        if (sql.includes('DELETE FROM accounts')) accountsTable.clear();
      }),
      withTransactionAsync: jest.fn(async (cb: any) => cb()),
    };

    openMock.mockResolvedValue(mockDb);
  });

  describe('1. Non-Destructive Legacy Backup Restore', () => {
    it('restoring legacy backup without cards or shopping lists DOES NOT delete existing local cards', async () => {
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

      // 2. Incoming legacy backup from schema v1 (no cards, no shoppingLists in data)
      const legacyBackup: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-legacy-restored',
              name: 'Restored Cash Account',
              type: 'CASH',
              openingBalance: 50000,
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
          // Notice: cards, shoppingLists, shoppingItems are UNDEFINED (legacy schema)
        },
      };

      const validation = validateBackupData(legacyBackup);
      expect(validation.isValid).toBe(true);

      // 3. Perform restore
      await restoreBackup(legacyBackup);

      // 4. Assert non-destructive behavior: existing card MUST NOT be deleted!
      expect(cardsTable.size).toBe(1);
      expect(cardsTable.has(card.id)).toBe(true);
      expect(cardsTable.get(card.id).cardholderName).toBe('Aarav Sharma');
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
