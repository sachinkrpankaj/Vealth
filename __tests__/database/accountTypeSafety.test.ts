import { openDatabaseAsync } from 'expo-sqlite';
import { getAllAccounts } from '../../src/database/repositories/accountRepository';

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
});
