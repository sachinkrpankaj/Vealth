export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'CASH' | 'BANK' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER'
  openingBalance INTEGER NOT NULL DEFAULT 0, -- minor units (paise)
  creditLimit INTEGER DEFAULT 0, -- minor units (paise)
  billingDay INTEGER, -- 1-31 recurring day of month
  dueDay INTEGER, -- 1-31 recurring day of month
  currency TEXT NOT NULL DEFAULT 'INR',
  color TEXT,
  icon TEXT,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  note TEXT,
  avatarColor TEXT NOT NULL,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'INCOME' | 'EXPENSE'
  icon TEXT NOT NULL,
  isDefault INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'INCOME'|'EXPENSE'|'LEND'|'BORROW'|'REPAYMENT_RECEIVED'|'REPAYMENT_MADE'|'TRANSFER'|'ASSET_PURCHASE'|'ASSET_SALE'|'OTHER'
  amount INTEGER NOT NULL, -- minor units (paise > 0)
  date TEXT NOT NULL, -- YYYY-MM-DD
  accountId TEXT, -- Source or primary account
  destinationAccountId TEXT, -- Destination for transfers
  personId TEXT, -- Target person for debt tracking
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

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'GOLD'|'VEHICLE'|'PROPERTY'|'ELECTRONICS'|'INVESTMENT'|'CASH'|'OTHER'
  currentValue INTEGER NOT NULL, -- minor units (paise)
  purchaseValue INTEGER NOT NULL,
  purchaseDate TEXT NOT NULL,
  note TEXT,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL, -- minor units (paise)
  type TEXT NOT NULL, -- 'PERSONAL_LOAN'|'CREDIT_CARD'|'BORROWED_MONEY'|'OTHER'
  personId TEXT,
  dueDate TEXT,
  note TEXT,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (personId) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  netWorth INTEGER NOT NULL,
  totalAssets INTEGER NOT NULL,
  totalLiabilities INTEGER NOT NULL,
  totalReceivables INTEGER NOT NULL,
  totalPayables INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId);
CREATE INDEX IF NOT EXISTS idx_transactions_personId ON transactions(personId);
CREATE INDEX IF NOT EXISTS idx_transactions_deletedAt ON transactions(deletedAt);
CREATE INDEX IF NOT EXISTS idx_transactions_assetId ON transactions(assetId);
CREATE INDEX IF NOT EXISTS idx_transactions_liabilityId ON transactions(liabilityId);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON net_worth_snapshots(date);
`;
