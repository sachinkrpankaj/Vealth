import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from './defaultData';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function migrateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // 1. Column migrations for existing databases
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN creditLimit INTEGER DEFAULT 0;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN billingDay INTEGER;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN dueDay INTEGER;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE categories ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE categories ADD COLUMN monthYear TEXT;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE categories ADD COLUMN color TEXT;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN metadata TEXT;');
  } catch {}


  // 2. Migration for foreign keys on transactions: assetId -> assets(id), liabilityId -> liabilities(id)
  let fkRows: Array<{ table: string }> = [];
  try {
    fkRows = await db.getAllAsync<{ table: string }>('PRAGMA foreign_key_list(transactions);');
  } catch {}

  const hasAssetFk = fkRows.some((r) => r.table?.toLowerCase() === 'assets');
  const hasLiabilityFk = fkRows.some((r) => r.table?.toLowerCase() === 'liabilities');

  if (!hasAssetFk || !hasLiabilityFk) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.withTransactionAsync(async () => {
      // Preserve historical category references by creating archived categories for any orphaned category IDs
      await db.execAsync(`
        INSERT OR IGNORE INTO categories (id, name, type, icon, color, isDefault, isArchived, createdAt)
        SELECT DISTINCT categoryId, 'Archived Category', 'EXPENSE', 'Folder', '#94A3B8', 0, 1, datetime('now')
        FROM transactions
        WHERE categoryId IS NOT NULL AND categoryId NOT IN (SELECT id FROM categories);

        UPDATE transactions SET accountId = NULL WHERE accountId IS NOT NULL AND accountId NOT IN (SELECT id FROM accounts);
        UPDATE transactions SET destinationAccountId = NULL WHERE destinationAccountId IS NOT NULL AND destinationAccountId NOT IN (SELECT id FROM accounts);
        UPDATE transactions SET personId = NULL WHERE personId IS NOT NULL AND personId NOT IN (SELECT id FROM people);
        UPDATE transactions SET assetId = NULL WHERE assetId IS NOT NULL AND assetId NOT IN (SELECT id FROM assets);
        UPDATE transactions SET liabilityId = NULL WHERE liabilityId IS NOT NULL AND liabilityId NOT IN (SELECT id FROM liabilities);
      `);

      // Create new table with complete foreign keys and safe ON DELETE RESTRICT behavior
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions_new (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          date TEXT NOT NULL,
          accountId TEXT,
          destinationAccountId TEXT,
          personId TEXT,
          categoryId TEXT,
          assetId TEXT,
          liabilityId TEXT,
          note TEXT,
          dueDate TEXT,
          metadata TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE RESTRICT,
          FOREIGN KEY (destinationAccountId) REFERENCES accounts(id) ON DELETE RESTRICT,
          FOREIGN KEY (personId) REFERENCES people(id) ON DELETE RESTRICT,
          FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT,
          FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE RESTRICT,
          FOREIGN KEY (liabilityId) REFERENCES liabilities(id) ON DELETE RESTRICT
        );

        INSERT INTO transactions_new (
          id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, metadata, createdAt, updatedAt, deletedAt
        )
        SELECT
          id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, NULL, createdAt, updatedAt, deletedAt
        FROM transactions;

        DROP TABLE transactions;

        ALTER TABLE transactions_new RENAME TO transactions;

        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
        CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId);
        CREATE INDEX IF NOT EXISTS idx_transactions_personId ON transactions(personId);
        CREATE INDEX IF NOT EXISTS idx_transactions_deletedAt ON transactions(deletedAt);
        CREATE INDEX IF NOT EXISTS idx_transactions_assetId ON transactions(assetId);
        CREATE INDEX IF NOT EXISTS idx_transactions_liabilityId ON transactions(liabilityId);
      `);
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync('vaelth.db');

    // Enable foreign keys and WAL mode
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.execAsync('PRAGMA journal_mode = WAL;');

    // Run schema creation
    await db.execAsync(CREATE_TABLES_SQL);

    // Run migrations
    await migrateDatabase(db);

    // Seed default categories if not existing
    const existingCats = await db.getAllAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM categories;'
    );
    if ((existingCats[0]?.count ?? 0) === 0) {
      const now = new Date().toISOString();
      const allDefaults = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES];

      for (const cat of allDefaults) {
        await db.runAsync(
          'INSERT INTO categories (id, name, type, icon, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?);',
          [cat.id, cat.name, cat.type, cat.icon, 1, now]
        );
      }
    }

    dbInstance = db;
    return db;
  })();

  // A failed open/migration must not permanently poison future attempts.
  initPromise.catch(() => { initPromise = null; });
  return initPromise;
}

export async function executeInTransaction<T>(
  action: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  let result: T;

  await db.withTransactionAsync(async () => {
    result = await action(db);
  });

  return result!;
}
