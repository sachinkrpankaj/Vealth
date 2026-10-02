import { openDatabaseAsync } from 'expo-sqlite';
import { createTransaction, updateTransaction } from '../../src/database/repositories/transactionRepository';
import { getTodayLocalDateString } from '../../src/utils/dateUtils';

const open = openDatabaseAsync as jest.Mock;

describe('authoritative final transaction validation', () => {
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
      { id: 'bank', name: 'Bank', type: 'BANK', isArchived: 0 },
      { id: 'archived-bank', name: 'Closed', type: 'BANK', isArchived: 1 },
    ];
    people = [{ id: 'person-1', name: 'Alex', isArchived: 0 }];
    categories = [
      { id: 'expense', type: 'EXPENSE', isArchived: 0 },
      { id: 'income', type: 'INCOME', isArchived: 0 },
    ];
    assets = [
      { id: 'asset-1', currentValue: 100000, isArchived: 0 },
      { id: 'asset-archived', currentValue: 0, isArchived: 1 },
    ];
    liabilities = [{ id: 'liability-1', isArchived: 0 }];
    transactions = [
      {
        id: 'expense-tx', type: 'EXPENSE', amount: 1000, date: getTodayLocalDateString(),
        accountId: 'bank', destinationAccountId: null, personId: null, categoryId: 'expense',
        assetId: null, liabilityId: null, note: null, dueDate: null, metadata: null,
        createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null,
      },
      {
        id: 'lend-tx', type: 'LEND', amount: 1000, date: getTodayLocalDateString(),
        accountId: 'bank', destinationAccountId: null, personId: 'person-1', categoryId: null,
        assetId: null, liabilityId: null, note: null, dueDate: null, metadata: null,
        createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null,
      },
      {
        id: 'sale-tx', type: 'ASSET_SALE', amount: 1000, date: getTodayLocalDateString(),
        accountId: 'bank', destinationAccountId: null, personId: null, categoryId: null,
        assetId: 'asset-1', liabilityId: null, note: null, dueDate: null, metadata: null,
        createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null,
      },
    ];
  });

  it('rejects missing or archived accounts on both create and update', async () => {
    await expect(createTransaction({
      id: 'bad-create', type: 'EXPENSE', amount: 100, date: getTodayLocalDateString(), accountId: 'missing',
    })).rejects.toThrow('does not exist');

    await expect(updateTransaction('expense-tx', { accountId: 'missing' })).rejects.toThrow('does not exist');
    await expect(updateTransaction('expense-tx', { accountId: 'archived-bank' })).rejects.toThrow('archived');
  });

  it('rejects invalid final person, category, asset, and liability references', async () => {
    await expect(updateTransaction('lend-tx', { personId: 'missing-person' })).rejects.toThrow('does not exist');
    await expect(updateTransaction('expense-tx', { categoryId: 'income' })).rejects.toThrow('requires a EXPENSE category');
    await expect(updateTransaction('sale-tx', { assetId: 'asset-archived' })).rejects.toThrow('archived');
    await expect(updateTransaction('expense-tx', { liabilityId: 'missing-liability' })).rejects.toThrow('does not exist');
  });

  it('rejects invalid transaction types and accepts a valid final-state edit', async () => {
    await expect(updateTransaction('expense-tx', { type: 'NOT_A_TYPE' as any })).rejects.toThrow('Invalid transaction type');
    await expect(updateTransaction('expense-tx', { date: '' })).rejects.toThrow('valid calendar date');

    await updateTransaction('expense-tx', { amount: 2500, note: 'Updated' });
    expect(transactions.find((tx) => tx.id === 'expense-tx')).toMatchObject({ amount: 2500, note: 'Updated' });
  });

  it('clears stale asset fields and sale metadata when changing transaction type', async () => {
    const sale = transactions.find((tx) => tx.id === 'sale-tx');
    sale.metadata = JSON.stringify({ bookValueSold: 1000, assetStateApplied: true });

    await updateTransaction('sale-tx', { type: 'EXPENSE' });

    expect(sale).toMatchObject({ type: 'EXPENSE', assetId: null, metadata: null });
  });
});
