import { getDatabase } from '../db';
import { Transaction, TransactionType } from '../../domain/finance/types';

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  date: string;
  accountId: string | null;
  destinationAccountId: string | null;
  personId: string | null;
  categoryId: string | null;
  assetId: string | null;
  liabilityId: string | null;
  note: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function mapRowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type as TransactionType,
    amount: row.amount,
    date: row.date,
    accountId: row.accountId ?? undefined,
    destinationAccountId: row.destinationAccountId ?? undefined,
    personId: row.personId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    assetId: row.assetId ?? undefined,
    liabilityId: row.liabilityId ?? undefined,
    note: row.note ?? undefined,
    dueDate: row.dueDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

export interface TransactionFilter {
  type?: TransactionType | 'ALL';
  types?: TransactionType[];
  accountId?: string;
  personId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  query?: string;
  sortBy?: 'NEWEST' | 'OLDEST' | 'HIGHEST_AMOUNT' | 'LOWEST_AMOUNT';
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export async function getAllTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (!filter?.includeDeleted) {
    conditions.push('deletedAt IS NULL');
  }

  if (filter?.type && filter.type !== 'ALL') {
    conditions.push('type = ?');
    params.push(filter.type);
  }

  if (filter?.types && filter.types.length > 0) {
    const placeholders = filter.types.map(() => '?').join(',');
    conditions.push(`type IN (${placeholders})`);
    params.push(...filter.types);
  }

  if (filter?.accountId) {
    conditions.push('(accountId = ? OR destinationAccountId = ?)');
    params.push(filter.accountId, filter.accountId);
  }

  if (filter?.personId) {
    conditions.push('personId = ?');
    params.push(filter.personId);
  }

  if (filter?.categoryId) {
    conditions.push('categoryId = ?');
    params.push(filter.categoryId);
  }

  if (filter?.startDate) {
    conditions.push('date >= ?');
    params.push(filter.startDate);
  }

  if (filter?.endDate) {
    conditions.push('date <= ?');
    params.push(filter.endDate);
  }

  if (filter?.query) {
    conditions.push('(note LIKE ? OR id LIKE ?)');
    params.push(`%${filter.query}%`, `%${filter.query}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderClause = 'ORDER BY date DESC, createdAt DESC';
  if (filter?.sortBy === 'OLDEST') {
    orderClause = 'ORDER BY date ASC, createdAt ASC';
  } else if (filter?.sortBy === 'HIGHEST_AMOUNT') {
    orderClause = 'ORDER BY amount DESC';
  } else if (filter?.sortBy === 'LOWEST_AMOUNT') {
    orderClause = 'ORDER BY amount ASC';
  }

  let limitClause = '';
  if (filter?.limit) {
    limitClause = `LIMIT ${filter.limit}`;
    if (filter?.offset) {
      limitClause += ` OFFSET ${filter.offset}`;
    }
  }

  const sql = `SELECT * FROM transactions ${whereClause} ${orderClause} ${limitClause};`;
  const rows = await db.getAllAsync<TransactionRow>(sql, params);
  return rows.map(mapRowToTransaction);
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ?;',
    [id]
  );
  return row ? mapRowToTransaction(row) : null;
}

export async function createTransaction(
  tx: Omit<Transaction, 'createdAt' | 'updatedAt'>
): Promise<Transaction> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO transactions (id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      tx.id,
      tx.type,
      Math.round(Math.abs(tx.amount)),
      tx.date,
      tx.accountId ?? null,
      tx.destinationAccountId ?? null,
      tx.personId ?? null,
      tx.categoryId ?? null,
      tx.assetId ?? null,
      tx.liabilityId ?? null,
      tx.note ?? null,
      tx.dueDate ?? null,
      now,
      now,
      tx.deletedAt ?? null,
    ]
  );
  return { ...tx, createdAt: now, updatedAt: now };
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const current = await getTransactionById(id);
  if (!current) throw new Error(`Transaction ${id} not found`);

  const updated: Transaction = { ...current, ...updates, updatedAt: now };
  await db.runAsync(
    `UPDATE transactions SET type = ?, amount = ?, date = ?, accountId = ?, destinationAccountId = ?, personId = ?, categoryId = ?, assetId = ?, liabilityId = ?, note = ?, dueDate = ?, updatedAt = ?, deletedAt = ?
     WHERE id = ?;`,
    [
      updated.type,
      Math.round(Math.abs(updated.amount)),
      updated.date,
      updated.accountId ?? null,
      updated.destinationAccountId ?? null,
      updated.personId ?? null,
      updated.categoryId ?? null,
      updated.assetId ?? null,
      updated.liabilityId ?? null,
      updated.note ?? null,
      updated.dueDate ?? null,
      now,
      updated.deletedAt ?? null,
      id,
    ]
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.runAsync('UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ?;', [
    now,
    now,
    id,
  ]);
}
