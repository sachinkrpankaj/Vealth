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
    conditions.push('t.deletedAt IS NULL');
  }

  if (filter?.type && filter.type !== 'ALL') {
    conditions.push('t.type = ?');
    params.push(filter.type);
  }

  if (filter?.types && filter.types.length > 0) {
    const placeholders = filter.types.map(() => '?').join(',');
    conditions.push(`t.type IN (${placeholders})`);
    params.push(...filter.types);
  }

  if (filter?.accountId) {
    conditions.push('(t.accountId = ? OR t.destinationAccountId = ?)');
    params.push(filter.accountId, filter.accountId);
  }

  if (filter?.personId) {
    conditions.push('t.personId = ?');
    params.push(filter.personId);
  }

  if (filter?.categoryId) {
    conditions.push('t.categoryId = ?');
    params.push(filter.categoryId);
  }

  if (filter?.startDate) {
    conditions.push('t.date >= ?');
    params.push(filter.startDate);
  }

  if (filter?.endDate) {
    conditions.push('t.date <= ?');
    params.push(filter.endDate);
  }

  if (filter?.query) {
    const q = `%${filter.query}%`;
    conditions.push(
      '(t.note LIKE ? OR t.id LIKE ? OR a.name LIKE ? OR da.name LIKE ? OR p.name LIKE ? OR c.name LIKE ? OR ast.name LIKE ? OR l.name LIKE ?)'
    );
    params.push(q, q, q, q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderClause = 'ORDER BY t.date DESC, t.createdAt DESC';
  if (filter?.sortBy === 'OLDEST') {
    orderClause = 'ORDER BY t.date ASC, t.createdAt ASC';
  } else if (filter?.sortBy === 'HIGHEST_AMOUNT') {
    orderClause = 'ORDER BY t.amount DESC';
  } else if (filter?.sortBy === 'LOWEST_AMOUNT') {
    orderClause = 'ORDER BY t.amount ASC';
  }

  let limitClause = '';
  if (filter?.limit) {
    limitClause = `LIMIT ${filter.limit}`;
    if (filter?.offset) {
      limitClause += ` OFFSET ${filter.offset}`;
    }
  }

  const sql = `
    SELECT t.* FROM transactions t
    LEFT JOIN accounts a ON t.accountId = a.id
    LEFT JOIN accounts da ON t.destinationAccountId = da.id
    LEFT JOIN people p ON t.personId = p.id
    LEFT JOIN categories c ON t.categoryId = c.id
    LEFT JOIN assets ast ON t.assetId = ast.id
    LEFT JOIN liabilities l ON t.liabilityId = l.id
    ${whereClause} ${orderClause} ${limitClause};
  `;
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
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ?;',
      [id]
    );
    if (!current) throw new Error(`Transaction ${id} not found`);

    const now = new Date().toISOString();
    const updated: Transaction = { ...mapRowToTransaction(current), ...updates, updatedAt: now };

    // If an ASSET_SALE amount is updated, adjust the underlying asset valuation accordingly
    if (
      current.type === 'ASSET_SALE' &&
      current.assetId &&
      updates.amount !== undefined &&
      Math.round(Math.abs(updates.amount)) !== current.amount
    ) {
      const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
        'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
        [current.assetId]
      );
      if (asset) {
        const delta = Math.round(Math.abs(updates.amount)) - current.amount;
        // delta > 0: user increased sale amount, asset decreases further
        // delta < 0: user decreased sale amount, asset gains back value
        const newAssetValue = Math.max(0, asset.currentValue - delta);
        const newArchived = newAssetValue === 0 && (asset.isArchived === 1 || delta > 0) ? 1 : 0;
        await txn.runAsync(
          'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
          [newAssetValue, newArchived, now, current.assetId]
        );
      }
    }

    await txn.runAsync(
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
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  // The read, reversal and soft delete must commit together. Unlike withTransactionAsync,
  // exclusive transactions do not admit unrelated queries into this transaction.
  await db.withExclusiveTransactionAsync(async (txn) => {
    const tx = await txn.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? AND deletedAt IS NULL;',
      [id]
    );
    if (!tx) return; // Repeated deletes must not reverse an asset twice.

    const now = new Date().toISOString();
    if (tx.assetId && tx.type === 'ASSET_SALE') {
      const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
        'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
        [tx.assetId]
      );
      if (!asset) throw new Error(`Asset ${tx.assetId} not found`);
      // A full sale discarded the original book value. Sale proceeds are not book value,
      // so guessing here would silently corrupt net worth. Partial sales remain reversible.
      if (asset.isArchived || asset.currentValue === 0) {
        throw new Error('Cannot reverse a fully liquidated asset sale: its previous value was not recorded.');
      }
      await txn.runAsync(
        'UPDATE assets SET currentValue = ?, updatedAt = ? WHERE id = ?;',
        [asset.currentValue + tx.amount, now, tx.assetId]
      );
    }
    // Creating ASSET_PURCHASE never increases currentValue: it only unarchives an
    // existing asset. Subtracting the purchase price on delete destroys its valuation.
    await txn.runAsync('UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL;', [
      now, now, id,
    ]);
  });
}
