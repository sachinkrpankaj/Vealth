import { openDatabaseAsync } from 'expo-sqlite';
import { deleteAsset } from '../../src/database/repositories/assetRepository';
import { deleteLiability } from '../../src/database/repositories/liabilityRepository';

const open = openDatabaseAsync as jest.Mock;

describe('Asset & Liability Deletion Guard', () => {
  let db: any;

  beforeAll(async () => {
    db = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM liabilities WHERE id = ?')) {
          return {
            id: params[0], name: 'Personal loan', amount: 250000,
            type: 'PERSONAL_LOAN', personId: null, dueDate: null,
            note: null, isArchived: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
          };
        }
        return { count: 0 };
      }),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (sql.includes('count FROM categories')) {
          return [{ count: 1 }];
        }
        return [];
      }),
      execAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
      withExclusiveTransactionAsync: jest.fn(async (fn: any) => fn(db)),
    };
    open.mockResolvedValue(db);
    // Warm up the singleton
    await deleteAsset('warmup');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.runAsync.mockResolvedValue({ changes: 1 });
  });

  describe('deleteAsset', () => {
    it('safely archives asset when transactions reference it', async () => {
      // Transactions count > 0
      db.getFirstAsync.mockResolvedValueOnce({ count: 3 });

      await deleteAsset('asset-1');

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE assets SET isArchived = 1'),
        expect.arrayContaining(['asset-1'])
      );
    });

    it('hard deletes asset when no transactions reference it', async () => {
      // Transactions count = 0
      db.getFirstAsync.mockResolvedValueOnce({ count: 0 });

      await deleteAsset('asset-2');

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM assets WHERE id = ?'),
        ['asset-2']
      );
    });
  });

  describe('deleteLiability', () => {
    it('safely archives liability when transactions reference it', async () => {
      db.getFirstAsync.mockResolvedValueOnce({ count: 2 });

      await deleteLiability('lib-1');

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE liabilities SET name = ?'),
        expect.arrayContaining([1, 'lib-1'])
      );
    });

    it('hard deletes liability when no transactions reference it', async () => {
      db.getFirstAsync.mockResolvedValueOnce({ count: 0 });

      await deleteLiability('lib-2');

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM liabilities WHERE id = ?'),
        ['lib-2']
      );
    });
  });
});
