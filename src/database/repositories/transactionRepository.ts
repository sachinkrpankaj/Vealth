import { getDatabase } from '../db';
import { Transaction, TransactionType } from '../../domain/finance/types';
import { getTodayLocalDateString } from '../../utils/dateUtils';

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
  metadata: string | null;
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
    metadata: row.metadata ?? undefined,
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

export async function getTransactionById(
  id: string,
  includeDeleted = false
): Promise<Transaction | null> {
  const db = await getDatabase();
  const sql = includeDeleted
    ? 'SELECT * FROM transactions WHERE id = ?;'
    : 'SELECT * FROM transactions WHERE id = ? AND deletedAt IS NULL;';
  const row = await db.getFirstAsync<TransactionRow>(sql, [id]);
  return row ? mapRowToTransaction(row) : null;
}

function hasRecordedAssetMetadata(tx: { metadata?: string | null }): boolean {
  if (!tx.metadata) return false;
  try {
    const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
    return (
      (typeof meta.assetValueDeducted === 'number' && !isNaN(meta.assetValueDeducted)) ||
      (typeof meta.bookValueSold === 'number' && !isNaN(meta.bookValueSold))
    );
  } catch {
    return false;
  }
}

function getAssetDeductedValue(tx: { amount: number; metadata?: string | null }): number {
  if (tx.metadata) {
    try {
      const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
      if (typeof meta.assetValueDeducted === 'number' && !isNaN(meta.assetValueDeducted)) {
        return meta.assetValueDeducted;
      }
      if (typeof meta.bookValueSold === 'number' && !isNaN(meta.bookValueSold)) {
        return meta.bookValueSold;
      }
    } catch {}
  }
  return Math.round(Math.abs(tx.amount));
}

const VALID_TRANSACTION_TYPES = new Set<TransactionType>([
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'LEND',
  'BORROW',
  'REPAYMENT_RECEIVED',
  'REPAYMENT_MADE',
  'ASSET_PURCHASE',
  'ASSET_SALE',
]);

export async function createTransaction(
  tx: Omit<Transaction, 'createdAt' | 'updatedAt'>
): Promise<Transaction> {
  // 1. Strict validation
  if (!VALID_TRANSACTION_TYPES.has(tx.type)) {
    throw new Error(`Invalid transaction type: ${tx.type}`);
  }
  if (!Number.isFinite(tx.amount) || !Number.isSafeInteger(tx.amount) || tx.amount <= 0) {
    throw new Error('Transaction amount must be a positive safe integer in paise.');
  }
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
    throw new Error('Transaction date must be a valid calendar date in YYYY-MM-DD format.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  let metadata = tx.metadata ?? null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    // 2. Validate accounts and entity references
    if (tx.accountId) {
      const account = await txn.getFirstAsync<{ id: string; name: string; type: string; isArchived: number }>(
        'SELECT id, name, type, isArchived FROM accounts WHERE id = ?;',
        [tx.accountId]
      );
      if (!account) throw new Error(`Account "${tx.accountId}" does not exist.`);

      const isSpendingType =
        tx.type === 'EXPENSE' ||
        tx.type === 'LEND' ||
        tx.type === 'REPAYMENT_MADE' ||
        tx.type === 'ASSET_PURCHASE';

      if (isSpendingType && account.isArchived === 1) {
        throw new Error(`Account "${account.name}" is archived and cannot be used for spending.`);
      }
      if (tx.type === 'TRANSFER' && account.isArchived === 1) {
        throw new Error(`Source account "${account.name}" is archived and cannot transfer funds.`);
      }
    } else if (tx.type !== 'TRANSFER') {
      if (tx.type === 'INCOME' || tx.type === 'EXPENSE' || tx.type === 'ASSET_PURCHASE' || tx.type === 'ASSET_SALE') {
        throw new Error(`${tx.type} requires a valid accountId.`);
      }
    }

    if (tx.type === 'TRANSFER') {
      if (!tx.accountId || !tx.destinationAccountId) {
        throw new Error('Transfer requires both source and destination accounts.');
      }
      if (tx.accountId === tx.destinationAccountId) {
        throw new Error('Transfer source and destination accounts must be different.');
      }
      const destAccount = await txn.getFirstAsync<{ id: string; name: string; isArchived: number }>(
        'SELECT id, name, isArchived FROM accounts WHERE id = ?;',
        [tx.destinationAccountId]
      );
      if (!destAccount) throw new Error(`Destination account "${tx.destinationAccountId}" does not exist.`);
      if (destAccount.isArchived === 1) {
        throw new Error(`Destination account "${destAccount.name}" is archived and cannot receive funds.`);
      }
    }

    if (tx.personId) {
      const person = await txn.getFirstAsync<{ id: string; name: string }>(
        'SELECT id, name FROM people WHERE id = ?;',
        [tx.personId]
      );
      if (!person) throw new Error(`Person "${tx.personId}" does not exist.`);

      if (tx.type === 'REPAYMENT_RECEIVED' || tx.type === 'REPAYMENT_MADE') {
        const activeTx = await txn.getAllAsync<TransactionRow>(
          'SELECT * FROM transactions WHERE personId = ? AND deletedAt IS NULL;',
          [tx.personId]
        );
        let debtBalance = 0;
        for (const t of activeTx) {
          if (tx.type === 'REPAYMENT_RECEIVED') {
            if (t.type === 'LEND') debtBalance += t.amount;
            else if (t.type === 'REPAYMENT_RECEIVED') debtBalance -= t.amount;
          } else {
            if (t.type === 'BORROW') debtBalance += t.amount;
            else if (t.type === 'REPAYMENT_MADE') debtBalance -= t.amount;
          }
        }
        if (debtBalance <= 0) {
          throw new Error('There is no outstanding balance recorded to repay.');
        }
        if (tx.amount > debtBalance) {
          throw new Error(`Repayment amount exceeds outstanding balance of ${debtBalance}.`);
        }
      }
    } else if (
      tx.type === 'LEND' ||
      tx.type === 'BORROW' ||
      tx.type === 'REPAYMENT_RECEIVED' ||
      tx.type === 'REPAYMENT_MADE'
    ) {
      throw new Error(`${tx.type} requires a valid personId.`);
    }

    if (tx.type === 'ASSET_PURCHASE' || tx.type === 'ASSET_SALE') {
      if (!tx.assetId) throw new Error(`${tx.type} requires a valid assetId.`);
    }

    // 3. Asset side-effects
    if (tx.type === 'ASSET_SALE' && tx.assetId) {
      const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
        'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
        [tx.assetId]
      );
      if (!asset) throw new Error(`Asset "${tx.assetId}" does not exist.`);

      const valueDeducted = Math.min(asset.currentValue, tx.amount);
      if (!metadata) {
        metadata = JSON.stringify({
          assetBookValueBefore: asset.currentValue,
          assetArchivedBefore: asset.isArchived === 1,
          assetValueDeducted: valueDeducted,
          bookValueSold: valueDeducted,
        });
      }
      const newAssetValue = Math.max(0, asset.currentValue - valueDeducted);
      const newArchived = newAssetValue === 0 ? 1 : asset.isArchived;
      await txn.runAsync(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [newAssetValue, newArchived, now, tx.assetId]
      );
    } else if (tx.type === 'ASSET_PURCHASE' && tx.assetId) {
      const asset = await txn.getFirstAsync<{ id: string; isArchived: number }>(
        'SELECT id, isArchived FROM assets WHERE id = ?;',
        [tx.assetId]
      );
      if (!asset) throw new Error(`Asset "${tx.assetId}" does not exist.`);
      await txn.runAsync(
        'UPDATE assets SET isArchived = 0, updatedAt = ? WHERE id = ? AND isArchived = 1;',
        [now, tx.assetId]
      );
    }

    // 4. Insert transaction
    await txn.runAsync(
      `INSERT INTO transactions (id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, metadata, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        tx.id,
        tx.type,
        tx.amount,
        tx.date,
        tx.accountId ?? null,
        tx.destinationAccountId ?? null,
        tx.personId ?? null,
        tx.categoryId ?? null,
        tx.assetId ?? null,
        tx.liabilityId ?? null,
        tx.note ?? null,
        tx.dueDate ?? null,
        metadata,
        now,
        now,
        tx.deletedAt ?? null,
      ]
    );
  });
  return { ...tx, metadata: metadata ?? undefined, createdAt: now, updatedAt: now };
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ?;',
      [id]
    );
    if (!current) throw new Error(`Transaction ${id} not found`);
    if (current.deletedAt) {
      throw new Error(`Cannot update deleted transaction ${id}`);
    }

    const now = new Date().toISOString();
    const effectiveDate = updates.date || current.date || getTodayLocalDateString();
    if (updates.date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.date)) {
      throw new Error('Transaction date must be a valid calendar date in YYYY-MM-DD format.');
    }
    const updated: Transaction = {
      ...mapRowToTransaction(current),
      ...updates,
      date: effectiveDate,
      updatedAt: now,
    };

    if (!VALID_TRANSACTION_TYPES.has(updated.type)) {
      throw new Error(`Invalid transaction type: ${updated.type}`);
    }
    if (!Number.isFinite(updated.amount) || !Number.isSafeInteger(updated.amount) || updated.amount <= 0) {
      throw new Error('Transaction amount must be a positive safe integer in paise.');
    }

    // Asset effect handling:
    // If updating the sale amount on the exact same asset, compute delta atomically
    if (
      current.type === 'ASSET_SALE' &&
      updated.type === 'ASSET_SALE' &&
      current.assetId &&
      current.assetId === updated.assetId
    ) {
      const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
        'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
        [current.assetId]
      );
      if (asset) {
        const oldDeducted = getAssetDeductedValue(current);
        const restoredBase = asset.currentValue + oldDeducted;
        const newDeducted = Math.min(restoredBase, updated.amount);
        const newAssetValue = Math.max(0, restoredBase - newDeducted);
        const newArchived = newAssetValue === 0 ? 1 : (restoredBase > 0 ? 0 : asset.isArchived);
        await txn.runAsync(
          'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
          [newAssetValue, newArchived, now, current.assetId]
        );
        updated.metadata = JSON.stringify({
          assetBookValueBefore: restoredBase,
          assetArchivedBefore: restoredBase === 0,
          assetValueDeducted: newDeducted,
          bookValueSold: newDeducted,
        });
      }
    } else {
      // Step 1: Reversal of old transaction asset effects
      if (current.type === 'ASSET_SALE' && current.assetId) {
        const oldAsset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
          'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
          [current.assetId]
        );
        if (oldAsset) {
          const valToRestore = getAssetDeductedValue(current);
          const restoredValue = Math.max(0, oldAsset.currentValue + valToRestore);
          const restoredArchived = restoredValue > 0 ? 0 : 1;
          await txn.runAsync(
            'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
            [restoredValue, restoredArchived, now, current.assetId]
          );
        }
      }

      // Step 2: Application of new transaction asset effects
      if (updated.type === 'ASSET_SALE' && updated.assetId) {
        const targetAsset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
          'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
          [updated.assetId]
        );
        if (targetAsset) {
          const valueDeducted = Math.min(targetAsset.currentValue, updated.amount);
          const newAssetValue = Math.max(0, targetAsset.currentValue - valueDeducted);
          const newArchived = newAssetValue === 0 ? 1 : targetAsset.isArchived;
          await txn.runAsync(
            'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
            [newAssetValue, newArchived, now, updated.assetId]
          );
          updated.metadata = JSON.stringify({
            assetBookValueBefore: targetAsset.currentValue,
            assetArchivedBefore: targetAsset.isArchived === 1,
            assetValueDeducted: valueDeducted,
            bookValueSold: valueDeducted,
          });
        }
      } else if (updated.type === 'ASSET_PURCHASE' && updated.assetId) {
        await txn.runAsync(
          'UPDATE assets SET isArchived = 0, updatedAt = ? WHERE id = ? AND isArchived = 1;',
          [now, updated.assetId]
        );
      }
    }

    // Step 3: Synchronize linked shopping item if this transaction is linked to one
    if (updated.type === 'EXPENSE' || (updated.metadata && updated.metadata.includes('shoppingItemId'))) {
      await txn.runAsync(
        `UPDATE shopping_items
         SET purchasePrice = ?,
             purchasedAt = ?,
             purchaseAccountId = ?,
             categoryId = ?,
             updatedAt = ?
         WHERE transactionId = ?;`,
        [
          updated.amount,
          updated.date,
          updated.accountId ?? null,
          updated.categoryId ?? null,
          now,
          id,
        ]
      );
    }

    // Step 4: Persist updated transaction
    await txn.runAsync(
      `UPDATE transactions SET type = ?, amount = ?, date = ?, accountId = ?, destinationAccountId = ?, personId = ?, categoryId = ?, assetId = ?, liabilityId = ?, note = ?, dueDate = ?, metadata = ?, updatedAt = ?, deletedAt = ?
       WHERE id = ?;`,
      [
        updated.type,
        updated.amount,
        updated.date,
        updated.accountId ?? null,
        updated.destinationAccountId ?? null,
        updated.personId ?? null,
        updated.categoryId ?? null,
        updated.assetId ?? null,
        updated.liabilityId ?? null,
        updated.note ?? null,
        updated.dueDate ?? null,
        updated.metadata ?? null,
        now,
        updated.deletedAt ?? null,
        id,
      ]
    );
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const tx = await txn.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? AND deletedAt IS NULL;',
      [id]
    );
    if (!tx) return; // Idempotent: repeated deletes do not reverse an asset twice.

    const now = new Date().toISOString();

    // 1. Deterministic asset sale reversal
    if (tx.assetId && tx.type === 'ASSET_SALE') {
      const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
        'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
        [tx.assetId]
      );
      if (asset) {
        if (asset.isArchived === 1 && asset.currentValue === 0 && !hasRecordedAssetMetadata(tx)) {
          throw new Error('Cannot safely reverse asset sale: previous value was not recorded.');
        }
        const valToRestore = getAssetDeductedValue(tx);
        const restoredValue = Math.max(0, asset.currentValue + valToRestore);
        const restoredArchived = restoredValue > 0 ? 0 : 1;
        await txn.runAsync(
          'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
          [restoredValue, restoredArchived, now, tx.assetId]
        );
      }
    }

    // 2. Synchronize linked shopping item if this transaction was linked to one
    if (tx.type === 'EXPENSE' || (tx.metadata && tx.metadata.includes('shoppingItemId'))) {
      await txn.runAsync(
        `UPDATE shopping_items
         SET status = 'PENDING',
             purchasedAt = NULL,
             purchasePrice = NULL,
             purchaseAccountId = NULL,
             transactionId = NULL,
             categoryId = NULL,
             updatedAt = ?
         WHERE transactionId = ?;`,
        [now, id]
      );
    }

    // 3. Soft-delete the transaction
    await txn.runAsync(
      'UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL;',
      [now, now, id]
    );
  });
}
