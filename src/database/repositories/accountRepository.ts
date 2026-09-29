import { getDatabase } from '../db';
import { Account, AccountType } from '../../domain/finance/types';

interface AccountRow {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  creditLimit: number | null;
  billingDay: number | null;
  dueDay: number | null;
  currency: string;
  color: string | null;
  icon: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

function mapRowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    openingBalance: row.openingBalance,
    creditLimit: row.creditLimit ?? undefined,
    billingDay: row.billingDay ?? undefined,
    dueDay: row.dueDay ?? undefined,
    currency: row.currency,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAllAccounts(includeArchived = false): Promise<Account[]> {
  const db = await getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM accounts ORDER BY createdAt ASC;'
    : 'SELECT * FROM accounts WHERE isArchived = 0 ORDER BY createdAt ASC;';
  const rows = await db.getAllAsync<AccountRow>(sql);
  return rows.map(mapRowToAccount);
}

export async function getAccountById(id: string): Promise<Account | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?;', [id]);
  return row ? mapRowToAccount(row) : null;
}

export async function createAccount(
  account: Omit<Account, 'createdAt' | 'updatedAt'>
): Promise<Account> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, openingBalance, creditLimit, billingDay, dueDay, currency, color, icon, isArchived, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      account.id,
      account.name,
      account.type,
      Math.round(account.openingBalance ?? 0),
      account.creditLimit ? Math.round(account.creditLimit) : 0,
      account.billingDay ?? null,
      account.dueDay ?? null,
      account.currency ?? 'INR',
      account.color ?? null,
      account.icon ?? null,
      account.isArchived ? 1 : 0,
      now,
      now,
    ]
  );
  return { ...account, createdAt: now, updatedAt: now };
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const current = await getAccountById(id);
  if (!current) throw new Error(`Account ${id} not found`);

  const updated: Account = { ...current, ...updates, updatedAt: now };
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, openingBalance = ?, creditLimit = ?, billingDay = ?, dueDay = ?, currency = ?, color = ?, icon = ?, isArchived = ?, updatedAt = ?
     WHERE id = ?;`,
    [
      updated.name,
      updated.type,
      Math.round(updated.openingBalance ?? 0),
      updated.creditLimit ? Math.round(updated.creditLimit) : 0,
      updated.billingDay ?? null,
      updated.dueDay ?? null,
      updated.currency,
      updated.color ?? null,
      updated.icon ?? null,
      updated.isArchived ? 1 : 0,
      now,
      id,
    ]
  );
}

export async function archiveAccount(id: string): Promise<void> {
  await updateAccount(id, { isArchived: true });
}
