import { openDatabaseAsync } from 'expo-sqlite';
import {
  validateIncomeAccountType,
  validateTransactionRequiredFields,
} from '../../src/domain/finance/validator';
import {
  createTransaction,
  updateTransaction,
} from '../../src/database/repositories/transactionRepository';

const open = openDatabaseAsync as jest.Mock;

describe('Income Transaction - Credit Card Restriction Regression Tests', () => {
  describe('Domain Validator: validateIncomeAccountType', () => {
    test('rejects CREDIT_CARD for income', () => {
      const result = validateIncomeAccountType('CREDIT_CARD');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/credit card cannot be used as the receiving account for income/i);
    });

    test('accepts valid asset accounts for income', () => {
      expect(validateIncomeAccountType('BANK').isValid).toBe(true);
      expect(validateIncomeAccountType('CASH').isValid).toBe(true);
      expect(validateIncomeAccountType('INVESTMENT').isValid).toBe(true);
      expect(validateIncomeAccountType('OTHER').isValid).toBe(true);
    });
  });

  describe('Domain Validator: validateTransactionRequiredFields', () => {
    test('rejects INCOME transaction when accountType is CREDIT_CARD', () => {
      const res = validateTransactionRequiredFields({
        type: 'INCOME',
        amount: 500000,
        date: '2026-10-05',
        accountId: 'acc-credit-card',
        accountType: 'CREDIT_CARD',
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/credit card cannot be used as the receiving account for income/i);
    });

    test('accepts INCOME transaction when accountType is BANK', () => {
      const res = validateTransactionRequiredFields({
        type: 'INCOME',
        amount: 500000,
        date: '2026-10-05',
        accountId: 'acc-bank',
        accountType: 'BANK',
      });
      expect(res.isValid).toBe(true);
    });

    test('accepts INCOME transaction when accountType is CASH', () => {
      const res = validateTransactionRequiredFields({
        type: 'INCOME',
        amount: 500000,
        date: '2026-10-05',
        accountId: 'acc-cash',
        accountType: 'CASH',
      });
      expect(res.isValid).toBe(true);
    });

    test('allows EXPENSE transactions on CREDIT_CARD accounts', () => {
      const res = validateTransactionRequiredFields({
        type: 'EXPENSE',
        amount: 150000,
        date: '2026-10-05',
        accountId: 'acc-credit-card',
        accountType: 'CREDIT_CARD',
      });
      expect(res.isValid).toBe(true);
    });
  });

  describe('Repository Validation: createTransaction and updateTransaction', () => {
    let accounts: any[];
    let transactions: any[];
    let scoped: any;
    let db: any;

    beforeEach(() => {
      accounts = [
        {
          id: 'acc-cc',
          name: 'Coral Card',
          type: 'CREDIT_CARD',
          openingBalance: 0,
          currency: 'INR',
          isArchived: 0,
        },
        {
          id: 'acc-bank',
          name: 'SBI Bank',
          type: 'BANK',
          openingBalance: 100000,
          currency: 'INR',
          isArchived: 0,
        },
      ];
      transactions = [];

      scoped = {
        getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('FROM transactions WHERE id = ?')) {
            return transactions.find((tx) => tx.id === params[0]) || null;
          }
          if (sql.includes('FROM accounts WHERE id = ?')) {
            return accounts.find((row) => row.id === params[0]) || null;
          }
          if (sql.includes('FROM shopping_items')) return null;
          return null;
        }),
        getAllAsync: jest.fn(async () => []),
        runAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('INSERT INTO transactions')) {
            transactions.push({
              id: params[0],
              type: params[1],
              amount: params[2],
              date: params[3],
              accountId: params[4],
              destinationAccountId: params[5],
              personId: params[6],
              categoryId: params[7],
              assetId: params[8],
              liabilityId: params[9],
              note: params[10],
              dueDate: params[11],
              metadata: params[12],
              createdAt: params[13],
              updatedAt: params[14],
              deletedAt: params[15],
            });
          }
          if (sql.includes('UPDATE transactions SET type = ?')) {
            const row = transactions.find((tx) => tx.id === params[14]);
            if (row) {
              Object.assign(row, {
                type: params[0],
                amount: params[1],
                date: params[2],
                accountId: params[3],
                destinationAccountId: params[4],
                personId: params[5],
                categoryId: params[6],
                assetId: params[7],
                liabilityId: params[8],
                note: params[9],
                dueDate: params[10],
                metadata: params[11],
                updatedAt: params[12],
                deletedAt: params[13],
              });
            }
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
        withExclusiveTransactionAsync: jest.fn(async (cb: any) => cb(scoped)),
        withTransactionAsync: jest.fn(async (cb: any) => cb()),
      };

      open.mockResolvedValue(db);
    });

    test('throws error when creating an INCOME transaction pointing to a CREDIT_CARD account', async () => {
      await expect(
        createTransaction({
          id: 'tx-inc-cc',
          type: 'INCOME',
          amount: 250000,
          date: '2026-10-05',
          accountId: 'acc-cc',
        })
      ).rejects.toThrow(/credit card cannot be used as the receiving account for income/i);
    });

    test('successfully creates an INCOME transaction pointing to a BANK account', async () => {
      await expect(
        createTransaction({
          id: 'tx-inc-bank',
          type: 'INCOME',
          amount: 250000,
          date: '2026-10-05',
          accountId: 'acc-bank',
        })
      ).resolves.not.toThrow();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('tx-inc-bank');
      expect(transactions[0].accountId).toBe('acc-bank');
    });

    test('throws error when updating an existing transaction to INCOME with a CREDIT_CARD account', async () => {
      transactions.push({
        id: 'tx-exp-1',
        type: 'EXPENSE',
        amount: 10000,
        date: '2026-10-05',
        accountId: 'acc-cc',
      });

      await expect(
        updateTransaction('tx-exp-1', {
          type: 'INCOME',
          accountId: 'acc-cc',
        })
      ).rejects.toThrow(/credit card cannot be used as the receiving account for income/i);
    });
  });
});
