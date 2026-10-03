import { getDatabase } from '../db';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  AccountType,
  Transaction,
  TransactionType,
  TRANSACTION_TYPES,
  ACCOUNT_TYPES,
} from '../../domain/finance/types';
import { getTodayLocalDateString, parseLocalDate } from '../../utils/dateUtils';
import { validateTransactionRequiredFields } from '../../domain/finance/validator';
import { ShoppingItemStatus } from '../../domain/finance/types';
import { assertShoppingItemTransition } from '../../domain/finance/shoppingState';
import { reconcileAssetState } from './assetStateRepository';

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

interface LinkedShoppingItemRow {
  id: string;
  listId: string;
  name: string;
  status: string;
  transactionId: string | null;
  purchasePrice: number | null;
  purchasedAt: string | null;
  purchaseAccountId: string | null;
  categoryId: string | null;
}

function shoppingPurchaseMatchesTransaction(
  item: LinkedShoppingItemRow,
  transaction: Pick<Transaction, 'amount' | 'date' | 'accountId' | 'categoryId'>
): boolean {
  return (
    item.purchasePrice === transaction.amount &&
    String(item.purchasedAt || '').slice(0, 10) === transaction.date &&
    (item.purchaseAccountId ?? null) === (transaction.accountId ?? null) &&
    (item.categoryId ?? null) === (transaction.categoryId ?? null)
  );
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

const VALID_TRANSACTION_TYPES = new Set<TransactionType>(TRANSACTION_TYPES);

const PERSON_TRANSACTION_TYPES = new Set<TransactionType>([
  'LEND', 'BORROW', 'REPAYMENT_RECEIVED', 'REPAYMENT_MADE',
]);
const ASSET_TRANSACTION_TYPES = new Set<TransactionType>(['ASSET_PURCHASE', 'ASSET_SALE']);

function metadataObject(metadata?: string | null): Record<string, any> | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getShoppingItemId(metadata?: string | null): string | null {
  const value = metadataObject(metadata)?.shoppingItemId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isValidOptionalDate(date?: string): boolean {
  return !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && !!parseLocalDate(date));
}

async function validateFinalTransaction(
  txn: SQLiteDatabase,
  tx: Transaction,
  options: { existing?: Transaction; excludeId?: string } = {}
): Promise<void> {
  if (!VALID_TRANSACTION_TYPES.has(tx.type)) throw new Error(`Invalid transaction type: ${tx.type}`);
  if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) {
    throw new Error('Transaction amount must be a positive safe integer in paise.');
  }
  const required = validateTransactionRequiredFields(tx);
  if (!required.isValid) throw new Error(required.error || 'Transaction is missing required fields.');
  if (!isValidOptionalDate(tx.dueDate)) {
    throw new Error('Due date must be a valid calendar date in YYYY-MM-DD format.');
  }

  if (tx.type !== 'TRANSFER' && tx.destinationAccountId) {
    throw new Error(`${tx.type} cannot have a destination account.`);
  }
  if (!PERSON_TRANSACTION_TYPES.has(tx.type) && tx.personId) {
    throw new Error(`${tx.type} cannot reference a person.`);
  }
  if (!ASSET_TRANSACTION_TYPES.has(tx.type) && tx.assetId) {
    throw new Error(`${tx.type} cannot reference an asset.`);
  }
  if (tx.type !== 'EXPENSE' && tx.type !== 'INCOME' && tx.categoryId) {
    throw new Error(`${tx.type} cannot reference a category.`);
  }

  const existing = options.existing;
  const accounts = new Map<string, { id: string; name: string; type: string; isArchived: number }>();
  const accountReferences = [
    { id: tx.accountId, existingId: existing?.accountId, role: 'source' },
    { id: tx.destinationAccountId, existingId: existing?.destinationAccountId, role: 'destination' },
  ].filter(
    (reference): reference is { id: string; existingId: string | undefined; role: string } =>
      !!reference.id
  );
  for (const reference of accountReferences) {
    const accountId = reference.id;
    if (accounts.has(accountId)) continue;
    const row = await txn.getFirstAsync<{ id: string; name: string; type: string; isArchived: number }>(
      'SELECT id, name, type, isArchived FROM accounts WHERE id = ?;',
      [accountId]
    );
    if (!row) throw new Error(`Account "${accountId}" does not exist.`);
    if (!ACCOUNT_TYPES.includes(row.type as AccountType)) {
      throw new Error(`Account "${accountId}" has an unsupported account type.`);
    }
    accounts.set(accountId, row);
    if (row.isArchived === 1 && accountId !== reference.existingId) {
      throw new Error(`Account "${row.name}" is archived and cannot be used.`);
    }
  }
  if (tx.type === 'TRANSFER' && tx.accountId === tx.destinationAccountId) {
    throw new Error('Transfer source and destination accounts must be different.');
  }
  if (tx.type === 'TRANSFER' && accounts.get(tx.accountId!)?.type === 'CREDIT_CARD') {
    throw new Error('A transfer cannot be funded from a credit-card account.');
  }
  if (
    tx.type === 'TRANSFER' &&
    accounts.get(tx.destinationAccountId!)?.type === 'CREDIT_CARD' &&
    ['CASH', 'INVESTMENT'].includes(accounts.get(tx.accountId!)?.type || '')
  ) {
    throw new Error('Credit-card bill payments must use a bank or other non-cash funding account.');
  }
  if (
    tx.type === 'TRANSFER' &&
    accounts.get(tx.destinationAccountId!)?.type === 'CREDIT_CARD' &&
    tx.date > getTodayLocalDateString()
  ) {
    throw new Error('Credit-card bill payment date cannot be in the future.');
  }

  if (tx.personId) {
    const person = await txn.getFirstAsync<{ id: string; name: string; isArchived: number }>(
      'SELECT id, name, isArchived FROM people WHERE id = ?;',
      [tx.personId]
    );
    if (!person) throw new Error(`Person "${tx.personId}" does not exist.`);
    const isRepayment = tx.type === 'REPAYMENT_RECEIVED' || tx.type === 'REPAYMENT_MADE';
    const sameExistingPerson = tx.personId === existing?.personId;
    if (person.isArchived === 1 && !sameExistingPerson && !isRepayment) {
      throw new Error(`Person "${person.name}" is archived and cannot be used for a new debt.`);
    }

    if (isRepayment) {
      const rows = await txn.getAllAsync<{ type: string; amount: number }>(
        `SELECT type, amount FROM transactions
         WHERE personId = ? AND deletedAt IS NULL AND id <> COALESCE(?, '') AND date <= ?;`,
        [tx.personId, options.excludeId ?? null, tx.date]
      );
      const debtType = tx.type === 'REPAYMENT_RECEIVED' ? 'LEND' : 'BORROW';
      let outstanding = 0;
      for (const row of rows) {
        if (row.type === debtType) outstanding += row.amount;
        else if (row.type === tx.type) outstanding -= row.amount;
      }
      if (outstanding <= 0) throw new Error('There is no outstanding balance recorded to repay.');
      if (tx.amount > outstanding) {
        throw new Error(`Repayment amount exceeds outstanding balance of ${outstanding}.`);
      }
    }
  }

  if (tx.categoryId) {
    const category = await txn.getFirstAsync<{ id: string; type: string; isArchived: number }>(
      'SELECT id, type, isArchived FROM categories WHERE id = ?;',
      [tx.categoryId]
    );
    if (!category) throw new Error(`Category "${tx.categoryId}" does not exist.`);
    const expectedType = tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    if (category.type !== expectedType) throw new Error(`${tx.type} requires a ${expectedType} category.`);
    if (category.isArchived === 1 && tx.categoryId !== existing?.categoryId) {
      throw new Error(`Category "${tx.categoryId}" is archived and cannot be selected.`);
    }
  }

  if (tx.liabilityId) {
    const liability = await txn.getFirstAsync<{ id: string; isArchived: number }>(
      'SELECT id, isArchived FROM liabilities WHERE id = ?;',
      [tx.liabilityId]
    );
    if (!liability) throw new Error(`Liability "${tx.liabilityId}" does not exist.`);
    if (liability.isArchived === 1 && tx.liabilityId !== existing?.liabilityId) {
      throw new Error(`Liability "${tx.liabilityId}" is archived and cannot be selected.`);
    }
  }

  if (ASSET_TRANSACTION_TYPES.has(tx.type)) {
    const asset = await txn.getFirstAsync<{ id: string; isArchived: number }>(
      'SELECT id, isArchived FROM assets WHERE id = ?;',
      [tx.assetId!]
    );
    if (!asset) throw new Error(`Asset "${tx.assetId}" does not exist.`);
    if (tx.type === 'ASSET_SALE' && asset.isArchived === 1 && tx.assetId !== existing?.assetId) {
      throw new Error('An archived asset cannot be sold.');
    }
  }
}

async function validateShoppingLinkForCreate(
  txn: SQLiteDatabase,
  tx: Transaction
): Promise<string | null> {
  const itemId = getShoppingItemId(tx.metadata);
  if (!itemId) return null;
  if (tx.type !== 'EXPENSE') throw new Error('Shopping purchases must be EXPENSE transactions.');
  const item = await txn.getFirstAsync<LinkedShoppingItemRow>(
    'SELECT * FROM shopping_items WHERE id = ?;',
    [itemId]
  );
  if (!item) throw new Error(`Shopping item "${itemId}" does not exist.`);
  const list = await txn.getFirstAsync<{ id: string; isArchived: number }>(
    'SELECT id, isArchived FROM shopping_lists WHERE id = ?;',
    [item.listId]
  );
  if (!list) throw new Error(`Shopping list "${item.listId}" does not exist.`);
  if (list.isArchived === 1) {
    throw new Error('Archived shopping lists are read-only. Unarchive the list before purchasing items.');
  }
  if (tx.date > getTodayLocalDateString()) {
    throw new Error('Shopping purchase date cannot be in the future.');
  }
  if (item.status !== 'PENDING' || item.transactionId) {
    throw new Error('Shopping item is already linked to a purchase.');
  }
  assertShoppingItemTransition(item.status as ShoppingItemStatus, 'PURCHASED');
  const existingRows = await txn.getAllAsync<{ id: string; metadata: string | null }>(
    'SELECT id, metadata FROM transactions WHERE deletedAt IS NULL AND metadata IS NOT NULL;'
  );
  if (existingRows.some((row) => getShoppingItemId(row.metadata) === itemId)) {
    throw new Error('Shopping item already has an active transaction.');
  }
  return itemId;
}

export async function validateTransactionForInsertInTransaction(
  txn: SQLiteDatabase,
  tx: Transaction
): Promise<string | null> {
  if (tx.deletedAt) throw new Error('New transactions cannot be created as deleted.');
  await validateFinalTransaction(txn, tx);
  return validateShoppingLinkForCreate(txn, tx);
}

async function validateShoppingLinkForUpdate(
  txn: SQLiteDatabase,
  txId: string,
  current: Transaction,
  updated: Transaction
): Promise<string | null> {
  const itemByTransaction = await txn.getFirstAsync<LinkedShoppingItemRow>(
    'SELECT * FROM shopping_items WHERE transactionId = ?;',
    [txId]
  );
  const oldMetadataId = getShoppingItemId(current.metadata);
  const newMetadataId = getShoppingItemId(updated.metadata);
  const linkedItemId = itemByTransaction?.id ?? null;

  if (oldMetadataId !== linkedItemId) {
    throw new Error('Shopping purchase transaction and item references are inconsistent.');
  }
  if (!linkedItemId) {
    if (newMetadataId) throw new Error('An existing transaction cannot be relinked to a shopping item.');
    return null;
  }
  if (updated.type !== 'EXPENSE') {
    throw new Error('A linked shopping purchase must remain an EXPENSE transaction.');
  }
  if (newMetadataId !== linkedItemId) {
    throw new Error('A linked shopping transaction cannot be detached or relinked.');
  }
  if (itemByTransaction?.status !== 'PURCHASED' || itemByTransaction.transactionId !== txId) {
    throw new Error('Linked shopping item is not in a purchased state.');
  }
  const list = await txn.getFirstAsync<{ id: string; isArchived: number }>(
    'SELECT id, isArchived FROM shopping_lists WHERE id = ?;',
    [itemByTransaction.listId]
  );
  if (!list) throw new Error(`Shopping list "${itemByTransaction.listId}" does not exist.`);
  if (list.isArchived === 1) {
    throw new Error('Transactions linked to an archived shopping list are read-only. Unarchive the list first.');
  }
  if (!shoppingPurchaseMatchesTransaction(itemByTransaction, current)) {
    throw new Error('Shopping purchase values do not match the linked transaction.');
  }
  const currentMetadata = metadataObject(current.metadata) || {};
  const updatedMetadata = metadataObject(updated.metadata) || {};
  for (const [key, canonicalValue] of [
    ['shoppingItemId', linkedItemId],
    ['shoppingListId', itemByTransaction.listId],
    ['productName', itemByTransaction.name],
  ] as const) {
    if (currentMetadata[key] !== undefined && currentMetadata[key] !== canonicalValue) {
      throw new Error('Shopping purchase metadata does not match the linked item.');
    }
    if (updatedMetadata[key] !== currentMetadata[key]) {
      throw new Error('Shopping purchase metadata cannot be changed independently of the linked item.');
    }
  }
  return linkedItemId;
}

function mergeAssetMetadata(
  metadata: string | null | undefined,
  assetFields: Record<string, unknown>
): string {
  return JSON.stringify({ ...(metadataObject(metadata) || {}), ...assetFields });
}

function clearAssetMetadata(metadata?: string | null): string | null {
  const value = metadataObject(metadata);
  if (!value) return metadata ?? null;
  const isPartial = value.isPartialSale === true;
  for (const key of [
    'assetBookValueBefore', 'assetArchivedBefore', 'assetValueDeducted',
    'assetValueAdded', 'assetStateApplied',
    ...(isPartial ? [] : ['bookValueSold']),
  ]) delete value[key];
  return Object.keys(value).length ? JSON.stringify(value) : null;
}

function assetEffectWasApplied(tx: Transaction): boolean {
  const metadata = metadataObject(tx.metadata);
  if (typeof metadata?.assetStateApplied === 'boolean') return metadata.assetStateApplied;
  // Older versions applied all asset transactions when they were recorded.
  return !tx.date || tx.date <= getTodayLocalDateString();
}

async function reverseAssetEffect(
  txn: SQLiteDatabase,
  tx: Transaction,
  now: string
): Promise<void> {
  if (!ASSET_TRANSACTION_TYPES.has(tx.type) || !tx.assetId || !assetEffectWasApplied(tx)) return;
  const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
    'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
    [tx.assetId]
  );
  if (!asset) return;

  const metadata = metadataObject(tx.metadata) || {};
  if (tx.type === 'ASSET_SALE') {
    if (!hasRecordedAssetMetadata(tx)) {
      if (asset.isArchived === 1 && asset.currentValue === 0) {
        throw new Error('Cannot safely reverse asset sale: previous value was not recorded.');
      }
      if (asset.currentValue > 0) {
        const restoredValue = asset.currentValue + Math.round(Math.abs(tx.amount));
        await txn.runAsync(
          'UPDATE assets SET currentValue = ?, isArchived = 0, updatedAt = ? WHERE id = ?;',
          [restoredValue, now, tx.assetId]
        );
      }
      return;
    }
    const restoredValue = Math.max(0, asset.currentValue + getAssetDeductedValue(tx));
    const restoredArchived = restoredValue > 0 ? 0 : (metadata.assetArchivedBefore ? 1 : asset.isArchived);
    await txn.runAsync(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [restoredValue, restoredArchived, now, tx.assetId]
    );
  } else if (typeof metadata.assetValueAdded === 'number') {
    const restoredValue = Math.max(0, asset.currentValue - metadata.assetValueAdded);
    const restoredArchived = metadata.assetArchivedBefore ? 1 : 0;
    await txn.runAsync(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [restoredValue, restoredArchived, now, tx.assetId]
    );
  }
}

async function applyAssetEffect(
  txn: SQLiteDatabase,
  tx: Transaction,
  now: string
): Promise<string | null> {
  if (!ASSET_TRANSACTION_TYPES.has(tx.type) || !tx.assetId) return tx.metadata ?? null;
  const cleanMetadata = clearAssetMetadata(tx.metadata);
  const asset = await txn.getFirstAsync<{ currentValue: number; isArchived: number }>(
    'SELECT currentValue, isArchived FROM assets WHERE id = ?;',
    [tx.assetId]
  );
  if (!asset) throw new Error(`Asset "${tx.assetId}" does not exist.`);

  const effectiveNow = tx.date <= getTodayLocalDateString();
  if (!effectiveNow) {
    const meta = metadataObject(tx.metadata);
    return mergeAssetMetadata(cleanMetadata, {
      assetStateApplied: false,
      ...(tx.type === 'ASSET_PURCHASE' ? { assetValueAdded: tx.amount, assetArchivedBefore: asset.isArchived === 1 } : {}),
      ...(tx.type === 'ASSET_SALE' && meta?.bookValueSold !== undefined ? { bookValueSold: meta.bookValueSold } : {}),
      ...(tx.type === 'ASSET_SALE' && meta?.isPartialSale !== undefined ? { isPartialSale: meta.isPartialSale } : {}),
    });
  }

  if (tx.type === 'ASSET_SALE') {
    const meta = metadataObject(tx.metadata);
    const isPartial = meta?.isPartialSale === true || (typeof meta?.bookValueSold === 'number' && meta.bookValueSold < asset.currentValue);
    const valueDeducted = typeof meta?.bookValueSold === 'number'
      ? Math.min(asset.currentValue, Math.max(0, Math.round(meta.bookValueSold)))
      : asset.currentValue;
    const newAssetValue = Math.max(0, asset.currentValue - valueDeducted);
    const newArchived = newAssetValue === 0 ? 1 : asset.isArchived;
    await txn.runAsync(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [newAssetValue, newArchived, now, tx.assetId]
    );
    return mergeAssetMetadata(cleanMetadata, {
      assetBookValueBefore: asset.currentValue,
      assetArchivedBefore: asset.isArchived === 1,
      assetValueDeducted: valueDeducted,
      bookValueSold: valueDeducted,
      assetStateApplied: true,
      ...(isPartial ? { isPartialSale: true } : {}),
    });
  }

  await txn.runAsync(
    'UPDATE assets SET currentValue = currentValue + ?, isArchived = 0, updatedAt = ? WHERE id = ?;',
    [tx.amount, now, tx.assetId]
  );
  return mergeAssetMetadata(cleanMetadata, {
    assetValueAdded: tx.amount,
    assetArchivedBefore: asset.isArchived === 1,
    assetStateApplied: true,
  });
}

export async function createTransaction(
  tx: Omit<Transaction, 'createdAt' | 'updatedAt'>
): Promise<Transaction> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  let metadata = tx.metadata ?? null;
  const newTransaction: Transaction = { ...tx, createdAt: now, updatedAt: now, metadata: metadata ?? undefined };

  await db.withExclusiveTransactionAsync(async (txn) => {
    const today = getTodayLocalDateString();
    const reconciledAssets = await reconcileAssetState(
      txn,
      ASSET_TRANSACTION_TYPES.has(newTransaction.type) ? [newTransaction.assetId] : [],
      now,
      today
    );
    const shoppingItemId = await validateTransactionForInsertInTransaction(txn, newTransaction);
    if (shoppingItemId) {
      const linkedItem = await txn.getFirstAsync<{ id: string; listId: string; name: string }>(
        'SELECT id, listId, name FROM shopping_items WHERE id = ?;',
        [shoppingItemId]
      );
      if (!linkedItem) throw new Error(`Shopping item "${shoppingItemId}" does not exist.`);
      const canonicalMetadata = {
        ...(metadataObject(metadata) || {}),
        shoppingItemId,
        shoppingListId: linkedItem.listId,
        productName: linkedItem.name,
      };
      metadata = JSON.stringify(canonicalMetadata);
      newTransaction.metadata = metadata;
    }
    // Assets with dated valuation history are materialized from source events after
    // insertion. Only pre-history databases use the legacy incremental fallback.
    if (ASSET_TRANSACTION_TYPES.has(newTransaction.type) && !reconciledAssets.has(newTransaction.assetId!)) {
      metadata = await applyAssetEffect(txn, { ...newTransaction, metadata: metadata ?? undefined }, now);
    } else if (ASSET_TRANSACTION_TYPES.has(newTransaction.type)) {
      metadata = clearAssetMetadata(metadata);
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

    if (ASSET_TRANSACTION_TYPES.has(newTransaction.type) && reconciledAssets.has(newTransaction.assetId!)) {
      await reconcileAssetState(txn, [newTransaction.assetId], now, today);
      const materialized = await txn.getFirstAsync<{ metadata: string | null }>(
        'SELECT metadata FROM transactions WHERE id = ?;',
        [newTransaction.id]
      );
      metadata = materialized?.metadata ?? null;
    }

    if (shoppingItemId) {
      const linked = await txn.runAsync(
        `UPDATE shopping_items SET status = 'PURCHASED', purchasedAt = ?, purchasePrice = ?,
           purchaseAccountId = ?, transactionId = ?, categoryId = ?, updatedAt = ?
         WHERE id = ? AND status = 'PENDING' AND transactionId IS NULL;`,
        [tx.date, tx.amount, tx.accountId ?? null, tx.id, tx.categoryId ?? null, now, shoppingItemId]
      );
      if (linked.changes !== 1) throw new Error('Shopping item changed before its purchase was recorded.');
    }
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
    const effectiveDate = updates.date !== undefined
      ? updates.date
      : current.date || getTodayLocalDateString();
    const currentTransaction = mapRowToTransaction(current);
    const updated: Transaction = {
      ...currentTransaction,
      ...updates,
      id: currentTransaction.id,
      createdAt: currentTransaction.createdAt,
      deletedAt: currentTransaction.deletedAt,
      date: effectiveDate,
      updatedAt: now,
    };

    if (
      currentTransaction.type === 'ASSET_SALE' &&
      updates.amount !== undefined &&
      updates.metadata === undefined &&
      currentTransaction.metadata
    ) {
      const meta = metadataObject(currentTransaction.metadata);
      if (meta && typeof meta.bookValueSold === 'number' && meta.bookValueSold === currentTransaction.amount) {
        meta.bookValueSold = updates.amount;
        updated.metadata = JSON.stringify(meta);
      }
    }

    if (updated.type !== currentTransaction.type) {
      if (updated.type !== 'TRANSFER') updated.destinationAccountId = undefined;
      if (!PERSON_TRANSACTION_TYPES.has(updated.type)) updated.personId = undefined;
      if (!ASSET_TRANSACTION_TYPES.has(updated.type)) {
        updated.assetId = undefined;
        updated.metadata = clearAssetMetadata(updated.metadata);
      }
      if (updated.type !== 'EXPENSE' && updated.type !== 'INCOME') updated.categoryId = undefined;
    }

    const today = getTodayLocalDateString();
    const reconciledAssets = await reconcileAssetState(
      txn,
      [currentTransaction.assetId, updated.assetId],
      now,
      today
    );

    await validateFinalTransaction(txn, updated, { existing: currentTransaction, excludeId: id });
    const shoppingItemId = await validateShoppingLinkForUpdate(
      txn,
      id,
      currentTransaction,
      updated
    );

    if (
      ASSET_TRANSACTION_TYPES.has(currentTransaction.type) &&
      currentTransaction.assetId &&
      !reconciledAssets.has(currentTransaction.assetId)
    ) {
      await reverseAssetEffect(txn, currentTransaction, now);
    }
    if (ASSET_TRANSACTION_TYPES.has(updated.type) && updated.assetId) {
      if (reconciledAssets.has(updated.assetId)) {
        updated.metadata = clearAssetMetadata(updated.metadata) ?? undefined;
      } else {
        updated.metadata = await applyAssetEffect(txn, updated, now) ?? undefined;
      }
    }

    if (shoppingItemId) {
      const result = await txn.runAsync(
        `UPDATE shopping_items SET purchasePrice = ?, purchasedAt = ?, purchaseAccountId = ?,
           categoryId = ?, updatedAt = ?
         WHERE id = ? AND transactionId = ? AND status = 'PURCHASED';`,
        [updated.amount, updated.date, updated.accountId ?? null, updated.categoryId ?? null, now, shoppingItemId, id]
      );
      if (result.changes !== 1) throw new Error('Linked shopping item changed before the transaction update.');
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

    await reconcileAssetState(
      txn,
      [currentTransaction.assetId, updated.assetId],
      now,
      today
    );
  });
}

export async function deleteTransactionInTransaction(
  txn: SQLiteDatabase,
  id: string,
  now: string = new Date().toISOString()
): Promise<void> {
    const tx = await txn.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? AND deletedAt IS NULL;',
      [id]
    );
    if (!tx) return; // Idempotent: repeated deletes do not reverse an asset twice.

    const transaction = mapRowToTransaction(tx);
    const reconciledAssets = await reconcileAssetState(txn, [transaction.assetId], now);
    if (
      ASSET_TRANSACTION_TYPES.has(transaction.type) &&
      transaction.assetId &&
      !reconciledAssets.has(transaction.assetId)
    ) {
      await reverseAssetEffect(txn, transaction, now);
    }

    // 2. Keep both sides of any shopping purchase relationship consistent.
    const linkedShoppingItem = await txn.getFirstAsync<LinkedShoppingItemRow>(
      'SELECT id, listId, name, status, transactionId, purchasePrice, purchasedAt, purchaseAccountId, categoryId FROM shopping_items WHERE transactionId = ?;',
      [id]
    );
    const metadataShoppingItemId = getShoppingItemId(tx.metadata);
    if (metadataShoppingItemId !== (linkedShoppingItem?.id ?? null)) {
      throw new Error('Shopping purchase transaction and item references are inconsistent.');
    }
    if (linkedShoppingItem) {
      if (tx.type !== 'EXPENSE' || linkedShoppingItem.status !== 'PURCHASED') {
        throw new Error('Cannot delete a transaction with an inconsistent shopping purchase link.');
      }
      if (!shoppingPurchaseMatchesTransaction(linkedShoppingItem, mapRowToTransaction(tx))) {
        throw new Error('Shopping purchase values do not match the linked transaction.');
      }
      assertShoppingItemTransition(linkedShoppingItem.status as ShoppingItemStatus, 'PENDING');
      const list = await txn.getFirstAsync<{ id: string; isArchived: number }>(
        'SELECT id, isArchived FROM shopping_lists WHERE id = ?;',
        [linkedShoppingItem.listId]
      );
      if (!list) throw new Error(`Shopping list "${linkedShoppingItem.listId}" does not exist.`);
      if (list.isArchived === 1) {
        throw new Error('Transactions linked to an archived shopping list are read-only. Unarchive the list first.');
      }
      const linkResult = await txn.runAsync(
        `UPDATE shopping_items
         SET status = 'PENDING',
             purchasedAt = NULL,
             purchasePrice = NULL,
             purchaseAccountId = NULL,
             transactionId = NULL,
             categoryId = NULL,
             updatedAt = ?
         WHERE id = ? AND transactionId = ? AND status = 'PURCHASED';`,
        [now, linkedShoppingItem.id, id]
      );
      if (linkResult.changes !== 1) throw new Error('Linked shopping item could not be reset.');
    }

    // 3. Soft-delete the transaction
    await txn.runAsync(
      'UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL;',
      [now, now, id]
    );
    await reconcileAssetState(txn, [transaction.assetId], now);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync((txn) => deleteTransactionInTransaction(txn, id));
}
