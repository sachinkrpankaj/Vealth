import { openDatabaseAsync } from 'expo-sqlite';
import { validateDueDate } from '../../src/domain/finance/validator';
import {
  createTransaction,
  updateTransaction,
} from '../../src/database/repositories/transactionRepository';
import { validateBackupData, createBackupData } from '../../src/utils/backup';
import { getTodayLocalDateString, formatDateIso } from '../../src/utils/dateUtils';
import { calculateAccountBalance, calculateNetWorth } from '../../src/domain/finance/financialEngine';
import appJson from '../../app.json';

const open = openDatabaseAsync as jest.Mock;

describe('Vealth Final Audit & Data Integrity Invariants', () => {
  describe('1. Due Date Invariants (validateDueDate)', () => {
    const txDate = '2026-10-04';

    it('accepts missing, null, or empty due dates', () => {
      expect(validateDueDate(undefined, txDate)).toEqual({ isValid: true });
      expect(validateDueDate(null, txDate)).toEqual({ isValid: true });
      expect(validateDueDate('', txDate)).toEqual({ isValid: true });
      expect(validateDueDate('   ', txDate)).toEqual({ isValid: true });
    });

    it('rejects malformed date strings', () => {
      const res = validateDueDate('2026-13-45', txDate);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('valid calendar date');
    });

    it('rejects earlier due date (dueDate < transaction.date)', () => {
      const res = validateDueDate('2026-10-03', txDate);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Due date cannot be earlier than the transaction date');
    });

    it('accepts same due date (dueDate === transaction.date)', () => {
      const res = validateDueDate('2026-10-04', txDate);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('accepts later due date (dueDate > transaction.date)', () => {
      const res = validateDueDate('2026-10-25', txDate);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe('2. Repository-Level Due Date & Archived Record Protection', () => {
    let accounts: any[];
    let people: any[];
    let categories: any[];
    let assets: any[];
    let liabilities: any[];
    let transactions: any[];
    let db: any;
    let scoped: any;

    beforeAll(() => {
      scoped = {
        getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('FROM transactions WHERE id = ?')) return transactions.find((tx) => tx.id === params[0]) || null;
          if (sql.includes('FROM accounts WHERE id = ?')) return accounts.find((row) => row.id === params[0]) || null;
          if (sql.includes('FROM people WHERE id = ?')) return people.find((row) => row.id === params[0]) || null;
          if (sql.includes('FROM categories WHERE id = ?')) return categories.find((row) => row.id === params[0]) || null;
          if (sql.includes('FROM assets WHERE id = ?')) return assets.find((row) => row.id === params[0]) || null;
          if (sql.includes('FROM liabilities WHERE id = ?')) return liabilities.find((row) => row.id === params[0]) || null;
          if (sql.includes('FROM shopping_items')) return null;
          return null;
        }),
        getAllAsync: jest.fn(async () => []),
        runAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('INSERT INTO transactions')) {
            transactions.push({
              id: params[0], type: params[1], amount: params[2], date: params[3], accountId: params[4],
              destinationAccountId: params[5], personId: params[6], categoryId: params[7], assetId: params[8],
              liabilityId: params[9], note: params[10], dueDate: params[11], metadata: params[12],
              createdAt: params[13], updatedAt: params[14], deletedAt: params[15],
            });
          }
          if (sql.includes('UPDATE transactions SET type = ?')) {
            const row = transactions.find((tx) => tx.id === params[14]);
            if (row) Object.assign(row, {
              type: params[0], amount: params[1], date: params[2], accountId: params[3],
              destinationAccountId: params[4], personId: params[5], categoryId: params[6], assetId: params[7],
              liabilityId: params[8], note: params[9], dueDate: params[10], metadata: params[11],
              updatedAt: params[12], deletedAt: params[13],
            });
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
      accounts = [
        { id: 'acc-active', name: 'Active Bank', type: 'BANK', isArchived: 0 },
        { id: 'acc-archived', name: 'Closed Bank', type: 'BANK', isArchived: 1 },
      ];
      people = [
        { id: 'person-active', name: 'Active Person', isArchived: 0 },
        { id: 'person-archived', name: 'Archived Person', isArchived: 1 },
      ];
      categories = [
        { id: 'cat-active', type: 'EXPENSE', isArchived: 0 },
      ];
      assets = [
        { id: 'asset-active', currentValue: 500000, isArchived: 0 },
        { id: 'asset-archived', currentValue: 0, isArchived: 1 },
      ];
      liabilities = [];
      transactions = [
        {
          id: 'historical-tx',
          type: 'EXPENSE',
          amount: 25000,
          date: '2026-09-01',
          accountId: 'acc-archived',
          destinationAccountId: null,
          personId: null,
          categoryId: 'cat-active',
          assetId: null,
          liabilityId: null,
          note: 'Historical expense',
          dueDate: null,
          metadata: null,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
          deletedAt: null,
        },
        {
          id: 'lend-with-due',
          type: 'LEND',
          amount: 50000,
          date: '2026-10-01',
          accountId: 'acc-active',
          destinationAccountId: null,
          personId: 'person-active',
          categoryId: null,
          assetId: null,
          liabilityId: null,
          note: 'Loan to active contact',
          dueDate: '2026-10-15',
          metadata: null,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
          deletedAt: null,
        },
      ];
    });

    it('rejects creating a transaction with dueDate earlier than transaction date', async () => {
      await expect(
        createTransaction({
          id: 'bad-due-date',
          type: 'LEND',
          amount: 10000,
          date: '2026-10-04',
          accountId: 'acc-active',
          personId: 'person-active',
          dueDate: '2026-10-02', // earlier than date!
        })
      ).rejects.toThrow('Due date cannot be earlier than the transaction date.');
    });

    it('allows creating a transaction with dueDate equal to transaction date', async () => {
      const created = await createTransaction({
        id: 'same-due-date',
        type: 'LEND',
        amount: 10000,
        date: '2026-10-04',
        accountId: 'acc-active',
        personId: 'person-active',
        dueDate: '2026-10-04',
      });
      expect(created.dueDate).toBe('2026-10-04');
    });

    it('allows creating a transaction with dueDate later than transaction date', async () => {
      const created = await createTransaction({
        id: 'future-due-date',
        type: 'LEND',
        amount: 10000,
        date: '2026-10-04',
        accountId: 'acc-active',
        personId: 'person-active',
        dueDate: '2026-10-20',
      });
      expect(created.dueDate).toBe('2026-10-20');
    });

    it('allows creating a transaction without a dueDate', async () => {
      const created = await createTransaction({
        id: 'no-due-date',
        type: 'EXPENSE',
        amount: 10000,
        date: '2026-10-04',
        accountId: 'acc-active',
        categoryId: 'cat-active',
      });
      expect(created.dueDate).toBeUndefined();
    });

    it('rejects updating transaction to have a dueDate earlier than date', async () => {
      await expect(
        updateTransaction('lend-with-due', {
          dueDate: '2026-09-20', // earlier than tx date 2026-10-01
        })
      ).rejects.toThrow('Due date cannot be earlier than the transaction date.');
    });

    it('rejects creating a new transaction with an archived account', async () => {
      await expect(
        createTransaction({
          id: 'tx-with-archived-account',
          type: 'EXPENSE',
          amount: 5000,
          date: '2026-10-04',
          accountId: 'acc-archived',
          categoryId: 'cat-active',
        })
      ).rejects.toThrow('is archived and cannot be used');
    });

    it('rejects creating a new transaction with an archived person for a new loan', async () => {
      await expect(
        createTransaction({
          id: 'tx-with-archived-person',
          type: 'LEND',
          amount: 5000,
          date: '2026-10-04',
          accountId: 'acc-active',
          personId: 'person-archived',
        })
      ).rejects.toThrow('is archived and cannot be used for a new debt');
    });

    it('rejects creating a purchase with an archived asset', async () => {
      await expect(
        createTransaction({
          id: 'tx-buy-archived-asset',
          type: 'ASSET_PURCHASE',
          amount: 50000,
          date: '2026-10-04',
          accountId: 'acc-active',
          assetId: 'asset-archived',
        })
      ).rejects.toThrow('An archived asset cannot be purchased.');
    });

    it('preserves archived references when editing historical transactions without changing the archived entity', async () => {
      // Editing amount and note on a transaction that references an archived account
      await updateTransaction('historical-tx', {
        amount: 30000,
        note: 'Updated historical note',
      });
      const updated = transactions.find((tx) => tx.id === 'historical-tx');
      expect(updated.amount).toBe(30000);
      expect(updated.note).toBe('Updated historical note');
      expect(updated.accountId).toBe('acc-archived');
    });

    it('rejects changing an existing transaction to an archived account', async () => {
      await expect(
        updateTransaction('lend-with-due', {
          accountId: 'acc-archived',
        })
      ).rejects.toThrow('is archived and cannot be used');
    });
  });

  describe('3. User-Facing Branding & Compatibility', () => {
    it('enforces vealth as the user-facing application name in app.json', () => {
      expect(appJson.expo.name).toBe('vealth');
    });

    it('validates backup data created with vealth', () => {
      const vealthBackup = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-10-04T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          settings: {},
        },
      };
      const result = validateBackupData(vealthBackup);
      expect(result.isValid).toBe(true);
    });

    it('preserves backward compatibility by accepting legacy Vealth and Vaelth backup files', () => {
      const vealthUpperBackup = {
        appName: 'Vealth',
        schemaVersion: 1,
        exportedAt: '2026-10-04T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          settings: {},
        },
      };
      expect(validateBackupData(vealthUpperBackup).isValid).toBe(true);

      const legacyBackup = {
        appName: 'Vaelth',
        schemaVersion: 1,
        exportedAt: '2026-09-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          settings: {},
        },
      };
      expect(validateBackupData(legacyBackup).isValid).toBe(true);
    });

    it('createBackupData produces appName vealth', async () => {
      const backup = await createBackupData();
      expect(backup.appName).toBe('vealth');
      expect(validateBackupData(backup).isValid).toBe(true);
    });
  });

  describe('4. Future Transactions Consistency', () => {
    it('allows creating future-dated transactions without altering today balances or net worth', async () => {
      const today = getTodayLocalDateString();
      const futureDate = '2026-12-31';
      expect(futureDate > today).toBe(true);

      const created = await createTransaction({
        id: 'tx-future-expense',
        type: 'EXPENSE',
        amount: 25000,
        date: futureDate,
        accountId: 'acc-active',
      });

      expect(created.id).toBe('tx-future-expense');
      expect(created.date).toBe(futureDate);

      // Verify that today's balance calculation excludes the future transaction
      const account = {
        id: 'acc-active',
        name: 'Active Bank',
        type: 'BANK' as const,
        openingBalance: 100000,
        currency: 'INR' as const,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const balanceToday = calculateAccountBalance(account, [created], today);
      expect(balanceToday).toBe(100000); // Unchanged

      const netWorthToday = calculateNetWorth({
        accounts: [account],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [created],
        asOfDate: today,
      });
      expect(netWorthToday.netWorth).toBe(100000); // Unchanged

      // On the future date, it takes effect
      const balanceFuture = calculateAccountBalance(account, [created], futureDate);
      expect(balanceFuture).toBe(75000);
    });
  });
});
