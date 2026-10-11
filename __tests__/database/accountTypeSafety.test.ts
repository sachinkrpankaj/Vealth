import { openDatabaseAsync } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';
import { CREATE_TABLES_SQL } from '../../src/database/schema';
import { _resetDatabaseForTesting } from '../../src/database/db';
import {
  createAccount,
  getAllAccounts,
  updateAccount,
  deleteAccount,
} from '../../src/database/repositories/accountRepository';
import {
  calculateNetWorth,
  calculateTotalStandaloneLiabilities,
} from '../../src/domain/finance/financialEngine';
import { Liability } from '../../src/domain/finance/types';

const open = openDatabaseAsync as jest.Mock;

describe('Account Repository Type Safety & Non-Destructive Reads', () => {
  let db: any;

  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (sql.includes('count FROM categories')) {
          return [{ count: 1 }];
        }
        return [];
      }),
      runAsync: jest.fn(),
      execAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
    };
    open.mockResolvedValue(db);
  });

  it('getAllAccounts performs pure read and does NOT issue UPDATE statements', async () => {
    const mockRows = [
      {
        id: 'acc-1',
        name: 'HDFC Debit Card',
        type: 'BANK',
        openingBalance: 100000,
        creditLimit: null,
        billingDay: null,
        dueDay: null,
        currency: 'INR',
        color: null,
        icon: null,
        isArchived: 0,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 'acc-2',
        name: 'Amazon Gift Card',
        type: 'OTHER',
        openingBalance: 50000,
        creditLimit: null,
        billingDay: null,
        dueDay: null,
        currency: 'INR',
        color: null,
        icon: null,
        isArchived: 0,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ];

    db.getAllAsync = jest.fn(async (sql: string) => {
      if (sql.includes('foreign_key_list')) {
        return [{ table: 'assets' }, { table: 'liabilities' }];
      }
      if (sql.includes('count FROM categories')) {
        return [{ count: 1 }];
      }
      if (sql.includes('FROM accounts')) {
        return mockRows;
      }
      return [];
    });

    const accounts = await getAllAccounts();

    // Verify pure read: NO db.runAsync calls to update accounts
    expect(db.runAsync).not.toHaveBeenCalled();

    // Verify account types were preserved exactly
    expect(accounts[0].name).toBe('HDFC Debit Card');
    expect(accounts[0].type).toBe('BANK');

    expect(accounts[1].name).toBe('Amazon Gift Card');
    expect(accounts[1].type).toBe('OTHER');
  });

  describe('Credit-Card Liability Accounting & Real SQLite Integrity', () => {
    let rawDb: DatabaseSync;
    let realAdapter: any;

    beforeEach(() => {
      _resetDatabaseForTesting();
      rawDb = new DatabaseSync(':memory:');
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

      open.mockResolvedValue(realAdapter);
    });

    afterEach(() => {
      _resetDatabaseForTesting();
      if (rawDb) {
        try { rawDb.close(); } catch {}
      }
    });

    it('enforces SQLite foreign keys are active', () => {
      const fk = rawDb.prepare('PRAGMA foreign_keys;').get() as { foreign_keys: number };
      expect(fk.foreign_keys).toBe(1);
    });

    it('prevents switching CREDIT_CARD to BANK when a linked liability references it and preserves Net Worth without double-counting', async () => {
      // 1. Create a credit card account with openingBalance 0
      await createAccount({
        id: 'acc-hdfc-cc',
        name: 'HDFC Millennia Credit Card',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
      });

      // 2. Insert a credit card liability linked to this account
      rawDb.exec(`
        INSERT INTO liabilities (id, name, type, amount, accountId, isArchived, createdAt, updatedAt)
        VALUES ('liab-cc-hdfc', 'HDFC Millennia Liability', 'CREDIT_CARD', 50000, 'acc-hdfc-cc', 0, '2026-10-01', '2026-10-01');
      `);

      // 3. Verify initial state and Net Worth
      let accounts = await getAllAccounts();
      const liabilityRow: any = rawDb.prepare("SELECT * FROM liabilities WHERE id = 'liab-cc-hdfc';").get();
      const liabilities: Liability[] = [{
        id: liabilityRow.id,
        name: liabilityRow.name,
        type: liabilityRow.type,
        amount: liabilityRow.amount,
        accountId: liabilityRow.accountId,
        isArchived: false,
        createdAt: liabilityRow.createdAt,
        updatedAt: liabilityRow.updatedAt,
      }];

      // Because the liability is linked to a CREDIT_CARD account (accountId = 'acc-hdfc-cc'),
      // calculateTotalStandaloneLiabilities deduplicates it (returns 0).
      const initialStandaloneLiab = calculateTotalStandaloneLiabilities(liabilities, accounts);
      expect(initialStandaloneLiab).toBe(0);

      const initialNetWorth = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: liabilities,
        transactions: [],
      });
      // Initial Net Worth is 0 (0 account balance, 0 deduplicated liability)
      expect(initialNetWorth.netWorth).toBe(0);
      expect(initialNetWorth.totalLiabilities).toBe(0);

      // 4. Attempt to change account type from CREDIT_CARD to BANK
      await expect(
        updateAccount('acc-hdfc-cc', { type: 'BANK' })
      ).rejects.toThrow(/linked liability "HDFC Millennia Liability" references this account/i);

      // 5. Verify the account type in real SQLite was NOT changed
      const accountInDb: any = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-hdfc-cc';").get();
      expect(accountInDb.type).toBe('CREDIT_CARD');

      // 6. Verify Net Worth after failed attempt: Still 0, no double-counting or orphaned liability
      accounts = await getAllAccounts();
      const postStandaloneLiab = calculateTotalStandaloneLiabilities(liabilities, accounts);
      expect(postStandaloneLiab).toBe(0);

      const postNetWorth = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: liabilities,
        transactions: [],
      });
      expect(postNetWorth.netWorth).toBe(0);
      expect(postNetWorth.totalLiabilities).toBe(0);
    });

    it('rejects changing account from BANK to CREDIT_CARD when it has a nonzero opening balance', async () => {
      await createAccount({
        id: 'acc-savings',
        name: 'ICICI Savings Bank',
        type: 'BANK',
        openingBalance: 75000, // +750.00
        currency: 'INR',
        isArchived: false,
      });

      let accounts = await getAllAccounts();
      const nwBefore = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [],
      });
      expect(nwBefore.netWorth).toBe(75000);
      expect(nwBefore.totalAssets).toBe(75000);

      // Attempt 1: Just change type
      await expect(
        updateAccount('acc-savings', { type: 'CREDIT_CARD' })
      ).rejects.toThrow(/nonzero opening balance/i);

      // Attempt 2: Attempt to set openingBalance: 0 at the same time to bypass check
      await expect(
        updateAccount('acc-savings', { type: 'CREDIT_CARD', openingBalance: 0 })
      ).rejects.toThrow(/nonzero opening balance/i);

      // Verify real SQLite was untouched
      const dbRow: any = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-savings';").get();
      expect(dbRow.type).toBe('BANK');
      expect(dbRow.openingBalance).toBe(75000);

      accounts = await getAllAccounts();
      const nwAfter = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [],
      });
      expect(nwAfter.netWorth).toBe(75000);
    });

    it('rejects changing account from CREDIT_CARD to BANK when it has a nonzero opening balance', async () => {
      await createAccount({
        id: 'acc-sbi-card',
        name: 'SBI Credit Card',
        type: 'CREDIT_CARD',
        openingBalance: -40000, // -400.00 debt
        currency: 'INR',
        isArchived: false,
      });

      let accounts = await getAllAccounts();
      const nwBefore = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [],
      });
      expect(nwBefore.netWorth).toBe(-40000);
      expect(nwBefore.totalLiabilities).toBe(40000);

      // Attempt 1: Change type
      await expect(
        updateAccount('acc-sbi-card', { type: 'BANK' })
      ).rejects.toThrow(/nonzero opening balance/i);

      // Attempt 2: Change type while passing openingBalance: 0
      await expect(
        updateAccount('acc-sbi-card', { type: 'BANK', openingBalance: 0 })
      ).rejects.toThrow(/nonzero opening balance/i);

      // Verify real SQLite was untouched
      const dbRow: any = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-sbi-card';").get();
      expect(dbRow.type).toBe('CREDIT_CARD');
      expect(dbRow.openingBalance).toBe(-40000);

      accounts = await getAllAccounts();
      const nwAfter = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [],
      });
      expect(nwAfter.netWorth).toBe(-40000);
      expect(nwAfter.totalLiabilities).toBe(40000);
    });

    it('rejects changing account type between CREDIT_CARD and asset when transactions are recorded', async () => {
      await createAccount({
        id: 'acc-tx-test',
        name: 'Test Account',
        type: 'BANK',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
      });

      rawDb.exec(`
        INSERT INTO categories (id, name, type, icon, color, isDefault, isArchived, createdAt)
        VALUES ('cat-misc', 'Misc', 'EXPENSE', 'Tag', '#888', 0, 0, '2026-10-01');

        INSERT INTO transactions (id, type, amount, date, accountId, categoryId, createdAt, updatedAt)
        VALUES ('tx-1', 'EXPENSE', 1000, '2026-10-05', 'acc-tx-test', 'cat-misc', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z');
      `);

      await expect(
        updateAccount('acc-tx-test', { type: 'CREDIT_CARD' })
      ).rejects.toThrow(/transactions are recorded for it/i);

      const dbRow: any = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-tx-test';").get();
      expect(dbRow.type).toBe('BANK');
    });

    it('rejects deleting account referenced by a liability', async () => {
      await createAccount({
        id: 'acc-liab-ref',
        name: 'Linked CC Account',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
      });

      rawDb.exec(`
        INSERT INTO liabilities (id, name, type, amount, accountId, isArchived, createdAt, updatedAt)
        VALUES ('liab-ref-1', 'Car Loan Linked CC', 'CREDIT_CARD', 100000, 'acc-liab-ref', 0, '2026-10-01', '2026-10-01');
      `);

      await expect(deleteAccount('acc-liab-ref')).rejects.toThrow(
        /referenced by one or more liabilities/i
      );

      const dbRow = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-liab-ref';").get();
      expect(dbRow).toBeDefined();
    });

    it('allows changing between asset types (BANK to CASH) with nonzero opening balance without affecting Net Worth', async () => {
      await createAccount({
        id: 'acc-asset-convert',
        name: 'Emergency Fund',
        type: 'BANK',
        openingBalance: 120000, // +1200.00
        currency: 'INR',
        isArchived: false,
      });

      let accounts = await getAllAccounts();
      const nwBefore = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [],
      });
      expect(nwBefore.netWorth).toBe(120000);

      // Switching BANK to CASH is between asset accounts, so opening balance is valid
      await updateAccount('acc-asset-convert', { type: 'CASH' });

      const dbRow: any = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-asset-convert';").get();
      expect(dbRow.type).toBe('CASH');
      expect(dbRow.openingBalance).toBe(120000);

      accounts = await getAllAccounts();
      const nwAfter = calculateNetWorth({
        accounts,
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [],
      });
      expect(nwAfter.netWorth).toBe(120000);
    });

    it('allows switching CREDIT_CARD to BANK if linked liability is unlinked and opening balance is 0', async () => {
      await createAccount({
        id: 'acc-unlink-cc',
        name: 'Axis CC',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
      });

      rawDb.exec(`
        INSERT INTO liabilities (id, name, type, amount, accountId, isArchived, createdAt, updatedAt)
        VALUES ('liab-axis', 'Axis Liability', 'CREDIT_CARD', 20000, 'acc-unlink-cc', 0, '2026-10-01', '2026-10-01');
      `);

      // First attempt fails because liability is linked
      await expect(
        updateAccount('acc-unlink-cc', { type: 'BANK' })
      ).rejects.toThrow(/linked liability/i);

      // Unlink liability
      rawDb.exec("UPDATE liabilities SET accountId = NULL WHERE id = 'liab-axis';");

      // Now switching succeeds
      await updateAccount('acc-unlink-cc', { type: 'BANK' });

      const dbRow: any = rawDb.prepare("SELECT * FROM accounts WHERE id = 'acc-unlink-cc';").get();
      expect(dbRow.type).toBe('BANK');
    });
  });
});
