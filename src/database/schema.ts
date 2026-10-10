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
  color TEXT,
  isDefault INTEGER NOT NULL DEFAULT 0,
  isArchived INTEGER NOT NULL DEFAULT 0,
  monthYear TEXT, -- e.g. '2026-10' for monthly General fallback, null for custom global categories
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

CREATE TABLE IF NOT EXISTS asset_valuations (
  id TEXT PRIMARY KEY,
  assetId TEXT NOT NULL,
  effectiveDate TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 0),
  source TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_archive_history (
  id TEXT PRIMARY KEY,
  assetId TEXT NOT NULL,
  effectiveDate TEXT NOT NULL,
  isArchived INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS liability_valuations (
  id TEXT PRIMARY KEY,
  liabilityId TEXT NOT NULL,
  effectiveDate TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  source TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (liabilityId) REFERENCES liabilities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS liability_archive_history (
  id TEXT PRIMARY KEY,
  liabilityId TEXT NOT NULL,
  effectiveDate TEXT NOT NULL,
  isArchived INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (liabilityId) REFERENCES liabilities(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  listId TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  productUrl TEXT,
  estimatedPrice INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  purchasedAt TEXT,
  purchasePrice INTEGER,
  purchaseAccountId TEXT,
  transactionId TEXT,
  categoryId TEXT,
  FOREIGN KEY (listId) REFERENCES shopping_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (purchaseAccountId) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId);
CREATE INDEX IF NOT EXISTS idx_transactions_personId ON transactions(personId);
CREATE INDEX IF NOT EXISTS idx_transactions_deletedAt ON transactions(deletedAt);
CREATE INDEX IF NOT EXISTS idx_transactions_assetId ON transactions(assetId);
CREATE INDEX IF NOT EXISTS idx_transactions_liabilityId ON transactions(liabilityId);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON net_worth_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_asset_date ON asset_valuations(assetId, effectiveDate, createdAt);
CREATE INDEX IF NOT EXISTS idx_asset_archive_history_asset_date ON asset_archive_history(assetId, effectiveDate, createdAt);
CREATE INDEX IF NOT EXISTS idx_liability_valuations_liability_date ON liability_valuations(liabilityId, effectiveDate, createdAt);
CREATE INDEX IF NOT EXISTS idx_liability_archive_history_liability_date ON liability_archive_history(liabilityId, effectiveDate, createdAt);
CREATE INDEX IF NOT EXISTS idx_shopping_items_listId ON shopping_items(listId);
CREATE INDEX IF NOT EXISTS idx_shopping_items_status ON shopping_items(status);
CREATE INDEX IF NOT EXISTS idx_shopping_items_transactionId ON shopping_items(transactionId);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_isArchived ON shopping_lists(isArchived);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  cardholderName TEXT NOT NULL,
  cardType TEXT NOT NULL, -- 'CREDIT' | 'DEBIT'
  network TEXT NOT NULL, -- 'VISA' | 'MASTERCARD' | 'RUPAY' | 'AMEX' | 'DISCOVER' | 'DINERS' | 'JCB' | 'OTHER'
  encryptedCardNumber TEXT NOT NULL,
  lastFour TEXT NOT NULL,
  expiryMonth INTEGER NOT NULL,
  expiryYear INTEGER NOT NULL,
  cardNickname TEXT,
  linkedAccountId TEXT,
  colorTheme TEXT,
  issuer TEXT,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (linkedAccountId) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_cardType ON cards(cardType);
CREATE INDEX IF NOT EXISTS idx_cards_linkedAccountId ON cards(linkedAccountId);
CREATE INDEX IF NOT EXISTS idx_cards_isArchived ON cards(isArchived);
`;
