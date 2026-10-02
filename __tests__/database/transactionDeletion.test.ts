import { openDatabaseAsync } from 'expo-sqlite';
import { deleteTransaction } from '../../src/database/repositories/transactionRepository';

const open = openDatabaseAsync as jest.Mock;

describe('transaction deletion atomic asset reversal', () => {
  const tx = { id: 'tx', type: 'ASSET_SALE', amount: 700, assetId: 'asset' };
  let db: any;
  let scoped: any;
  beforeAll(async () => {
    scoped = {
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    db = {
      execAsync: jest.fn(),
      getAllAsync: jest.fn(async (sql: string) => sql.includes('foreign_key_list')
        ? [{ table: 'assets' }, { table: 'liabilities' }]
        : [{ count: 1 }]),
      withExclusiveTransactionAsync: jest.fn(async (fn: (txn: any) => Promise<void>) => fn(scoped)),
    };
    open.mockResolvedValue(db);
    // Initialize the singleton once with this mock DB.
    await deleteTransaction('missing');
  });
  beforeEach(() => {
    jest.clearAllMocks();
    scoped.runAsync.mockResolvedValue({ changes: 1 });
  });

  it('does not reverse a purchase valuation or reverse a deleted transaction twice', async () => {
    scoped.getFirstAsync.mockResolvedValueOnce({ ...tx, type: 'ASSET_PURCHASE' });
    await deleteTransaction('tx');
    expect(scoped.runAsync).toHaveBeenCalledTimes(1);
    expect(scoped.runAsync.mock.calls[0][0]).toContain('UPDATE transactions');
    scoped.getFirstAsync.mockResolvedValueOnce(null);
    await deleteTransaction('tx');
    expect(scoped.runAsync).toHaveBeenCalledTimes(1);
  });

  it('reverses partial sale and soft-deletes in one exclusive transaction', async () => {
    scoped.getFirstAsync.mockResolvedValueOnce(tx).mockResolvedValueOnce({ currentValue: 300, isArchived: 0 });
    await deleteTransaction('tx');
    expect(scoped.runAsync.mock.calls[0][1][0]).toBe(1000);
    expect(scoped.runAsync.mock.calls[1][0]).toContain('UPDATE transactions');
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('refuses to invent a book value for a fully liquidated sale', async () => {
    scoped.getFirstAsync.mockResolvedValueOnce(tx).mockResolvedValueOnce({ currentValue: 0, isArchived: 1 });
    await expect(deleteTransaction('tx')).rejects.toThrow('previous value was not recorded');
    expect(scoped.runAsync).not.toHaveBeenCalled();
  });

  it('propagates asset write failures without soft-deleting the transaction', async () => {
    scoped.getFirstAsync.mockResolvedValueOnce(tx).mockResolvedValueOnce({ currentValue: 300, isArchived: 0 });
    scoped.runAsync.mockRejectedValueOnce(new Error('disk full'));
    await expect(deleteTransaction('tx')).rejects.toThrow('disk full');
    expect(scoped.runAsync).toHaveBeenCalledTimes(1);
  });
});
