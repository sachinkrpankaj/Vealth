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

  // 2. Migration for foreign keys on transactions: assetId -> assets(id), liabilityId -> liabilities(id)
  const fkRows = await db.getAllAsync<{ table: string }>('PRAGMA foreign_key_list(transactions);');
  const hasAssetFk = fkRows.some((r) => r.table === 'assets');
  const hasLiabilityFk = fkRows.some((r) => r.table === 'liabilities');

  if (!hasAssetFk || !hasLiabilityFk) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.withTransactionAsync(async () => {
      // Nullify any dangling assetId or liabilityId that do not exist in target tables
      await db.execAsync(`
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
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE RESTRICT,
          FOREIGN KEY (destinationAccountId) REFERENCES accounts(id) ON DELETE RESTRICT,
          FOREIGN KEY (personId) REFERENCES people(id) ON DELETE RESTRICT,
          FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
          FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE RESTRICT,
          FOREIGN KEY (liabilityId) REFERENCES liabilities(id) ON DELETE RESTRICT
        );

        INSERT INTO transactions_new (
          id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, createdAt, updatedAt, deletedAt
        )
        SELECT
          id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, createdAt, updatedAt, deletedAt
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
    await db.execAsync('PRAGMA foreign_keys = ON;');
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
