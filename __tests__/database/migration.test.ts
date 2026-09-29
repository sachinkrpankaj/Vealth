import { migrateDatabase } from '../../src/database/db';
import { CREATE_TABLES_SQL } from '../../src/database/schema';

describe('Database Schema & Migration Engine', () => {
  it('schema definition includes ON DELETE RESTRICT foreign keys for assetId and liabilityId', () => {
    expect(CREATE_TABLES_SQL).toContain(
      'FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE RESTRICT'
    );
    expect(CREATE_TABLES_SQL).toContain(
      'FOREIGN KEY (liabilityId) REFERENCES liabilities(id) ON DELETE RESTRICT'
    );
    expect(CREATE_TABLES_SQL).toContain(
      'FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE RESTRICT'
    );
    expect(CREATE_TABLES_SQL).toContain(
      'FOREIGN KEY (personId) REFERENCES people(id) ON DELETE RESTRICT'
    );
  });

  it('runs column migrations and skips table recreation if foreign keys already exist', async () => {
    const executedSql: string[] = [];
    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executedSql.push(sql);
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('PRAGMA foreign_key_list(transactions)')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        return [];
      }),
      withTransactionAsync: jest.fn(),
    };

    await migrateDatabase(mockDb);

    // Should attempt column migrations
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      'ALTER TABLE accounts ADD COLUMN creditLimit INTEGER DEFAULT 0;'
    );
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      'ALTER TABLE accounts ADD COLUMN billingDay INTEGER;'
    );
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      'ALTER TABLE accounts ADD COLUMN dueDay INTEGER;'
    );

    // Because assets and liabilities FKs are present, withTransactionAsync is NOT called
    expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('performs full table recreation and data migration when foreign keys are missing', async () => {
    const executedSql: string[] = [];
    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executedSql.push(sql);
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('PRAGMA foreign_key_list(transactions)')) {
          // Missing assetId and liabilityId foreign keys (old schema)
          return [{ table: 'accounts' }, { table: 'people' }, { table: 'categories' }];
        }
        return [];
      }),
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    await migrateDatabase(mockDb);

    // Turned foreign keys OFF before table swap
    expect(executedSql).toContain('PRAGMA foreign_keys = OFF;');

    // Cleaned dangling IDs
    const danglingCleanSql = executedSql.find((sql) =>
      sql.includes('UPDATE transactions SET assetId = NULL')
    );
    expect(danglingCleanSql).toBeDefined();
    expect(danglingCleanSql).toContain(
      'UPDATE transactions SET liabilityId = NULL WHERE liabilityId IS NOT NULL AND liabilityId NOT IN (SELECT id FROM liabilities);'
    );

    // Created transactions_new with RESTRICT foreign keys
    const createNewSql = executedSql.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS transactions_new'));
    expect(createNewSql).toBeDefined();
    expect(createNewSql).toContain('FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE RESTRICT');
    expect(createNewSql).toContain('FOREIGN KEY (liabilityId) REFERENCES liabilities(id) ON DELETE RESTRICT');

    // Data copied and table swapped
    expect(createNewSql).toContain('INSERT INTO transactions_new');
    expect(createNewSql).toContain('DROP TABLE transactions;');
    expect(createNewSql).toContain('ALTER TABLE transactions_new RENAME TO transactions;');

    // Indexes recreated
    expect(createNewSql).toContain('CREATE INDEX IF NOT EXISTS idx_transactions_assetId ON transactions(assetId);');
    expect(createNewSql).toContain('CREATE INDEX IF NOT EXISTS idx_transactions_liabilityId ON transactions(liabilityId);');

    // Re-enabled foreign keys
    expect(executedSql).toContain('PRAGMA foreign_keys = ON;');
  });

  it('tolerates already existing columns without throwing', async () => {
    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        if (sql.startsWith('ALTER TABLE accounts ADD COLUMN')) {
          throw new Error('duplicate column name: creditLimit');
        }
      }),
      getAllAsync: jest.fn(async () => [{ table: 'assets' }, { table: 'liabilities' }]),
      withTransactionAsync: jest.fn(),
    };

    await expect(migrateDatabase(mockDb)).resolves.not.toThrow();
  });
});
