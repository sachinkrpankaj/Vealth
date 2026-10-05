import { getDatabase } from '../db';
import { SQLiteDatabase } from 'expo-sqlite';
import { ShoppingList, ShoppingItem, ShoppingListSummary, ShoppingItemStatus, Transaction } from '../../domain/finance/types';
import { assertShoppingItemTransition } from '../../domain/finance/shoppingState';
import { formatDateIso, getTodayLocalDateString, parseLocalDate } from '../../utils/dateUtils';
import { formatRupee } from '../../domain/finance/currency';
import { generateEntityId } from '../../utils/idGenerator';
import {
  deleteTransactionInTransaction,
  validateTransactionForInsertInTransaction,
} from './transactionRepository';

interface ShoppingListRow {
  id: string;
  name: string;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

interface ShoppingItemRow {
  id: string;
  listId: string;
  name: string;
  note: string | null;
  productUrl: string | null;
  estimatedPrice: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  purchasedAt: string | null;
  purchasePrice: number | null;
  purchaseAccountId: string | null;
  transactionId: string | null;
  categoryId: string | null;
}

function generateUniqueId(prefix: string): string {
  return generateEntityId(prefix);
}

export function normalizeProductUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      throw new Error('Invalid URL format');
    }
    return withProtocol;
  } catch {
    throw new Error('Please enter a valid web URL for the product link.');
  }
}

function mapRowToShoppingList(row: ShoppingListRow): ShoppingList {
  return {
    id: row.id,
    name: row.name,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRowToShoppingItem(row: ShoppingItemRow): ShoppingItem {
  return {
    id: row.id,
    listId: row.listId,
    name: row.name,
    note: row.note ?? undefined,
    productUrl: row.productUrl ?? undefined,
    estimatedPrice: row.estimatedPrice != null ? row.estimatedPrice : undefined,
    status: row.status as ShoppingItemStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    purchasedAt: row.purchasedAt ?? undefined,
    purchasePrice: row.purchasePrice != null ? row.purchasePrice : undefined,
    purchaseAccountId: row.purchaseAccountId ?? undefined,
    transactionId: row.transactionId ?? undefined,
    categoryId: row.categoryId ?? undefined,
  };
}

async function assertActiveShoppingList(txn: SQLiteDatabase, listId: string): Promise<ShoppingListRow> {
  const list = await txn.getFirstAsync<ShoppingListRow>(
    'SELECT * FROM shopping_lists WHERE id = ?;',
    [listId]
  );
  if (!list) throw new Error(`Shopping list "${listId}" not found.`);
  if (list.isArchived === 1) {
    throw new Error('Archived shopping lists are read-only. Unarchive the list to make changes.');
  }
  return list;
}

async function assertUniqueActiveListName(
  txn: SQLiteDatabase,
  name: string,
  excludeId?: string
): Promise<void> {
  const duplicate = excludeId
    ? await txn.getFirstAsync<{ id: string }>(
        `SELECT id FROM shopping_lists
         WHERE id <> ? AND isArchived = 0 AND lower(trim(name)) = lower(?);`,
        [excludeId, name]
      )
    : await txn.getFirstAsync<{ id: string }>(
        `SELECT id FROM shopping_lists
         WHERE isArchived = 0 AND lower(trim(name)) = lower(?);`,
        [name]
      );
  if (duplicate) throw new Error(`A shopping list named "${name}" already exists.`);
}

// ============================================================================
// SHOPPING LIST OPERATIONS
// ============================================================================

export async function getAllShoppingLists(includeArchived = false): Promise<ShoppingList[]> {
  const db = await getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM shopping_lists ORDER BY isArchived ASC, createdAt DESC;'
    : 'SELECT * FROM shopping_lists WHERE isArchived = 0 ORDER BY createdAt DESC;';
  const rows = await db.getAllAsync<ShoppingListRow>(sql);
  return rows.map(mapRowToShoppingList);
}

export async function getShoppingListById(id: string): Promise<ShoppingList | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ShoppingListRow>(
    'SELECT * FROM shopping_lists WHERE id = ?;',
    [id]
  );
  return row ? mapRowToShoppingList(row) : null;
}

export async function createShoppingList(name: string): Promise<ShoppingList> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Shopping list name cannot be blank.');
  }

  const db = await getDatabase();
  const id = generateUniqueId('list');
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await assertUniqueActiveListName(txn, trimmed);
    await txn.runAsync(
      `INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
       VALUES (?, ?, 0, ?, ?);`,
      [id, trimmed, now, now]
    );
  });

  return {
    id,
    name: trimmed,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateShoppingList(
  id: string,
  updates: { name?: string; isArchived?: boolean }
): Promise<ShoppingList> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  let updatedList: ShoppingList | null = null;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<ShoppingListRow>(
      'SELECT * FROM shopping_lists WHERE id = ?;',
      [id]
    );
    if (!current) throw new Error(`Shopping list with id "${id}" not found.`);

    const newName = updates.name !== undefined ? updates.name.trim() : current.name;
    if (!newName) throw new Error('Shopping list name cannot be blank.');
    const isArchived = updates.isArchived !== undefined ? updates.isArchived : current.isArchived === 1;
    if (current.isArchived === 1 && newName !== current.name) {
      throw new Error('Archived shopping lists are read-only. Unarchive the list before renaming it.');
    }
    if (current.isArchived === 1 && isArchived) {
      updatedList = mapRowToShoppingList(current);
      return;
    }
    if (!isArchived) await assertUniqueActiveListName(txn, newName, id);

    await txn.runAsync(
      `UPDATE shopping_lists SET name = ?, isArchived = ?, updatedAt = ? WHERE id = ?;`,
      [newName, isArchived ? 1 : 0, now, id]
    );
    updatedList = {
      id,
      name: newName,
      isArchived,
      createdAt: current.createdAt,
      updatedAt: now,
    };
  });
  if (!updatedList) throw new Error('Failed to update shopping list.');
  return updatedList;
}

export async function archiveShoppingList(id: string, isArchived = true): Promise<void> {
  await updateShoppingList(id, { isArchived });
}

export async function deleteShoppingList(
  id: string
): Promise<{ deleted: boolean; archivedInstead: boolean; message: string }> {
  const db = await getDatabase();
  let result: { deleted: boolean; archivedInstead: boolean; message: string } | null = null;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const list = await txn.getFirstAsync<ShoppingListRow>('SELECT * FROM shopping_lists WHERE id = ?;', [id]);
    if (!list) throw new Error(`Shopping list with id "${id}" not found.`);
    if (list.isArchived === 1) {
      throw new Error('Archived shopping lists are read-only. Unarchive the list before deleting it.');
    }
    const purchasedRef = await txn.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM shopping_items
       WHERE listId = ? AND (status = 'PURCHASED' OR transactionId IS NOT NULL);`,
      [id]
    );
    if ((purchasedRef?.count ?? 0) > 0) {
      await txn.runAsync('UPDATE shopping_lists SET isArchived = 1, updatedAt = ? WHERE id = ?;', [new Date().toISOString(), id]);
      result = {
        deleted: false,
        archivedInstead: true,
        message: `"${list.name}" contains purchased items with financial history and was safely archived instead of deleted.`,
      };
      return;
    }
    await txn.runAsync('DELETE FROM shopping_items WHERE listId = ?;', [id]);
    await txn.runAsync('DELETE FROM shopping_lists WHERE id = ?;', [id]);
    result = {
      deleted: true,
      archivedInstead: false,
      message: `Shopping list "${list.name}" was permanently deleted.`,
    };
  });
  if (!result) throw new Error('Failed to delete shopping list.');
  return result;
}

export async function getShoppingListSummaries(includeArchived = false): Promise<ShoppingListSummary[]> {
  const lists = await getAllShoppingLists(includeArchived);
  const db = await getDatabase();

  const allItems = await db.getAllAsync<ShoppingItemRow>(
    'SELECT * FROM shopping_items;'
  );

  // Group items by listId
  const itemsByList = new Map<string, ShoppingItemRow[]>();
  for (const item of allItems) {
    const arr = itemsByList.get(item.listId) || [];
    arr.push(item);
    itemsByList.set(item.listId, arr);
  }

  return lists.map((list) => {
    const items = itemsByList.get(list.id) || [];
    let pendingCount = 0;
    let purchasedCount = 0;
    let discardedCount = 0;
    let estimatedPendingTotal = 0;
    let purchasedTotal = 0;

    for (const item of items) {
      if (item.status === 'PENDING') {
        pendingCount += 1;
        if (item.estimatedPrice != null && item.estimatedPrice > 0) {
          estimatedPendingTotal += item.estimatedPrice;
        }
      } else if (item.status === 'PURCHASED') {
        purchasedCount += 1;
        if (item.purchasePrice != null && item.purchasePrice > 0) {
          purchasedTotal += item.purchasePrice;
        }
      } else if (item.status === 'DISCARDED') {
        discardedCount += 1;
      }
    }

    return {
      list,
      pendingCount,
      purchasedCount,
      discardedCount,
      estimatedPendingTotal,
      purchasedTotal,
    };
  });
}

// ============================================================================
// SHOPPING ITEM OPERATIONS
// ============================================================================

export async function getShoppingItemsByListId(listId: string): Promise<ShoppingItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ShoppingItemRow>(
    `SELECT * FROM shopping_items
     WHERE listId = ?
     ORDER BY
       CASE status
         WHEN 'PENDING' THEN 1
         WHEN 'PURCHASED' THEN 2
         WHEN 'DISCARDED' THEN 3
         ELSE 4
       END ASC,
       createdAt DESC;`,
    [listId]
  );
  return rows.map(mapRowToShoppingItem);
}

export async function getAllShoppingItems(): Promise<ShoppingItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ShoppingItemRow>(
    'SELECT * FROM shopping_items ORDER BY createdAt DESC;'
  );
  return rows.map(mapRowToShoppingItem);
}

export async function getShoppingItemById(id: string): Promise<ShoppingItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ShoppingItemRow>(
    'SELECT * FROM shopping_items WHERE id = ?;',
    [id]
  );
  return row ? mapRowToShoppingItem(row) : null;
}

export async function createShoppingItem(params: {
  listId: string;
  name: string;
  note?: string;
  productUrl?: string;
  estimatedPrice?: number;
}): Promise<ShoppingItem> {
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    throw new Error('Product name cannot be blank.');
  }

  const db = await getDatabase();

  const id = generateUniqueId('item');
  const now = new Date().toISOString();
  const estPrice =
    params.estimatedPrice != null && Number.isSafeInteger(params.estimatedPrice) && params.estimatedPrice > 0
      ? params.estimatedPrice
      : null;
  const trimmedNote = params.note?.trim() || null;
  const trimmedUrl = normalizeProductUrl(params.productUrl);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await assertActiveShoppingList(txn, params.listId);
    await txn.runAsync(
      `INSERT INTO shopping_items (
         id, listId, name, note, productUrl, estimatedPrice,
         status, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?);`,
      [id, params.listId, trimmedName, trimmedNote, trimmedUrl, estPrice, now, now]
    );
  });

  return {
    id,
    listId: params.listId,
    name: trimmedName,
    note: trimmedNote ?? undefined,
    productUrl: trimmedUrl ?? undefined,
    estimatedPrice: estPrice ?? undefined,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateShoppingItem(
  id: string,
  updates: {
    name?: string;
    note?: string | null;
    productUrl?: string | null;
    estimatedPrice?: number | null;
  }
): Promise<ShoppingItem> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  let result: ShoppingItem | null = null;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<ShoppingItemRow>('SELECT * FROM shopping_items WHERE id = ?;', [id]);
    if (!row) throw new Error(`Shopping item "${id}" not found.`);
    const current = mapRowToShoppingItem(row);
    await assertActiveShoppingList(txn, current.listId);
    if (current.status !== 'PENDING') {
      throw new Error('Only pending shopping items can be edited. Restore the item first.');
    }
    const newName = updates.name !== undefined ? updates.name.trim() : current.name;
    if (!newName) throw new Error('Product name cannot be blank.');
    const newNote = updates.note !== undefined ? updates.note?.trim() || null : (current.note ?? null);
    const newUrl = updates.productUrl !== undefined ? normalizeProductUrl(updates.productUrl) : (current.productUrl ?? null);
    const newEstPrice = updates.estimatedPrice !== undefined
      ? (updates.estimatedPrice != null && Number.isSafeInteger(updates.estimatedPrice) && updates.estimatedPrice > 0
          ? updates.estimatedPrice : null)
      : (current.estimatedPrice ?? null);
    await txn.runAsync(
      `UPDATE shopping_items SET name = ?, note = ?, productUrl = ?, estimatedPrice = ?, updatedAt = ? WHERE id = ?;`,
      [newName, newNote, newUrl, newEstPrice, now, id]
    );
    result = {
      ...current,
      name: newName,
      note: newNote ?? undefined,
      productUrl: newUrl ?? undefined,
      estimatedPrice: newEstPrice ?? undefined,
      updatedAt: now,
    };
  });
  if (!result) throw new Error('Failed to update shopping item.');
  return result;
}

export async function discardShoppingItem(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<ShoppingItemRow>('SELECT * FROM shopping_items WHERE id = ?;', [id]);
    if (!current) throw new Error(`Shopping item "${id}" not found.`);
    await assertActiveShoppingList(txn, current.listId);
    if (current.status === 'PURCHASED' || current.transactionId) {
      throw new Error('Cannot discard an already purchased shopping item.');
    }
    assertShoppingItemTransition(current.status as ShoppingItemStatus, 'DISCARDED');
    if (current.status === 'DISCARDED') return;
    await txn.runAsync(
      `UPDATE shopping_items SET status = 'DISCARDED', updatedAt = ? WHERE id = ? AND transactionId IS NULL AND status = 'PENDING';`,
      [now, id]
    );
  });
}

export async function restoreShoppingItem(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<ShoppingItemRow>(
      'SELECT * FROM shopping_items WHERE id = ?;',
      [id]
    );
    if (!current) throw new Error(`Shopping item "${id}" not found.`);
    await assertActiveShoppingList(txn, current.listId);
    if (current.status === 'PENDING') return;
    assertShoppingItemTransition(current.status as ShoppingItemStatus, 'PENDING');

    if (current.status === 'PURCHASED' && !current.transactionId) {
      throw new Error('Cannot restore shopping item because its purchase transaction is missing.');
    }

    if (current.status === 'PURCHASED' && current.transactionId) {
      const linked = await txn.getFirstAsync<{
        id: string;
        type: string;
        amount: number;
        date: string;
        accountId: string | null;
        categoryId: string | null;
        metadata: string | null;
        deletedAt: string | null;
      }>('SELECT id, type, amount, date, accountId, categoryId, metadata, deletedAt FROM transactions WHERE id = ?;', [current.transactionId]);
      if (!linked) {
        throw new Error('Cannot restore shopping item because its linked transaction is missing.');
      }
      if (
        linked.type !== 'EXPENSE' ||
        String(current.purchasedAt || '').slice(0, 10) !== linked.date ||
        current.purchasePrice !== linked.amount ||
        (current.purchaseAccountId ?? null) !== (linked.accountId ?? null) ||
        (current.categoryId ?? null) !== (linked.categoryId ?? null)
      ) {
        throw new Error('Cannot restore shopping item because its linked transaction is inconsistent.');
      }
      if (!linked.deletedAt) {
        let metadata: any = null;
        try { metadata = linked.metadata ? JSON.parse(linked.metadata) : null; } catch {}
        if (
          metadata?.shoppingItemId !== id ||
          (metadata.shoppingListId !== undefined && metadata.shoppingListId !== current.listId) ||
          (metadata.productName !== undefined && metadata.productName !== current.name)
        ) {
          throw new Error('Cannot restore shopping item because its linked transaction is inconsistent.');
        }
        await deleteTransactionInTransaction(txn, current.transactionId, now);
      }
    }

    await txn.runAsync(
      `UPDATE shopping_items
       SET status = 'PENDING', purchasedAt = NULL, purchasePrice = NULL,
           purchaseAccountId = NULL, transactionId = NULL, categoryId = NULL, updatedAt = ?
       WHERE id = ?;`,
      [now, id]
    );
  });
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<ShoppingItemRow>('SELECT * FROM shopping_items WHERE id = ?;', [id]);
    if (!current) throw new Error(`Shopping item "${id}" not found.`);
    await assertActiveShoppingList(txn, current.listId);
    if (current.status === 'PURCHASED' || current.transactionId) {
      throw new Error('Cannot delete a purchased shopping item with a linked financial transaction. Preserving history.');
    }
    await txn.runAsync(
      `DELETE FROM shopping_items WHERE id = ? AND transactionId IS NULL AND status <> 'PURCHASED';`,
      [id]
    );
  });
}

/**
 * Purchases a shopping item atomically:
 * 1. Validates purchase price, spendable account, source balance, category.
 * 2. Creates standard EXPENSE transaction in `transactions`.
 * 3. Updates shopping item to `PURCHASED` with all references.
 * Everything executes in one atomic SQLite transaction with complete rollback on error.
 */
export async function purchaseShoppingItem(params: {
  itemId: string;
  purchasePrice: number; // in paise
  purchaseAccountId: string;
  categoryId?: string | null;
  purchaseDate?: string;
  customNote?: string;
}): Promise<{ shoppingItem: ShoppingItem; transactionId: string }> {
  const { itemId, purchasePrice, purchaseAccountId, categoryId, purchaseDate, customNote } = params;

  if (!Number.isSafeInteger(purchasePrice) || purchasePrice <= 0) {
    throw new Error('Please enter a valid purchase price greater than zero.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  const txDate = purchaseDate || formatDateIso(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate) || !parseLocalDate(txDate)) {
    throw new Error('Purchase date must be a valid calendar date in YYYY-MM-DD format.');
  }
  if (txDate > getTodayLocalDateString()) {
    throw new Error('Purchase date cannot be in the future.');
  }
  const txId = generateUniqueId('tx');

  let updatedItem: ShoppingItem | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    // 1. Verify shopping item
    const itemRow = await txn.getFirstAsync<ShoppingItemRow>(
      'SELECT * FROM shopping_items WHERE id = ?;',
      [itemId]
    );
    if (!itemRow) {
      throw new Error(`Shopping item "${itemId}" not found.`);
    }
    await assertActiveShoppingList(txn, itemRow.listId);
    if (itemRow.status === 'PURCHASED') {
      throw new Error('This item has already been marked as purchased.');
    }
    assertShoppingItemTransition(itemRow.status as ShoppingItemStatus, 'PURCHASED');

    // 2. Verify account and spendability
    const account = await txn.getFirstAsync<{
      id: string;
      name: string;
      type: string;
      openingBalance: number;
      creditLimit: number | null;
      isArchived: number;
    }>(
      'SELECT id, name, type, openingBalance, creditLimit, isArchived FROM accounts WHERE id = ?;',
      [purchaseAccountId]
    );
    if (!account) {
      throw new Error('Selected payment account was not found.');
    }
    if (account.isArchived === 1) {
      throw new Error(`Account "${account.name}" is archived and cannot be used for spending.`);
    }
    if (account.type === 'INVESTMENT') {
      throw new Error('Investment accounts cannot be used as a direct funding source.');
    }

    // 3. Verify source balance / available credit
    // Validate against the account balance on the selected purchase date.
    const txCredits = await txn.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE deletedAt IS NULL AND (
         (accountId = ? AND type IN ('INCOME', 'BORROW', 'REPAYMENT_RECEIVED', 'ASSET_SALE'))
         OR (destinationAccountId = ? AND type = 'TRANSFER')
       ) AND date <= ?;`,
      [purchaseAccountId, purchaseAccountId, txDate]
    );
    const txDebits = await txn.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE deletedAt IS NULL AND accountId = ? AND type IN (
         'EXPENSE', 'LEND', 'REPAYMENT_MADE', 'TRANSFER', 'ASSET_PURCHASE'
       ) AND date <= ?;`,
      [purchaseAccountId, txDate]
    );

    const currentBalance =
      Math.round(account.openingBalance) +
      Math.round(txCredits?.total ?? 0) -
      Math.round(txDebits?.total ?? 0);

    if (account.type === 'CREDIT_CARD') {
      const creditLimit = Math.max(0, account.creditLimit ?? 0);
      const usedAmount = Math.max(0, -currentBalance);
      const availableCredit = Math.max(0, creditLimit - usedAmount);
      if (availableCredit < purchasePrice) {
        throw new Error(
          `Insufficient credit limit: Credit card "${account.name}" has only ${formatRupee(availableCredit)} available credit, but this purchase requires ${formatRupee(purchasePrice)}.`
        );
      }
    } else {
      if (currentBalance < purchasePrice) {
        throw new Error(
          `Insufficient balance: Account "${account.name}" has only ${formatRupee(currentBalance)}, but this purchase requires ${formatRupee(purchasePrice)}.`
        );
      }
    }

    // 4. Verify category if provided
    let verifiedCategoryId: string | null = null;
    if (categoryId && categoryId.trim() !== '') {
      const category = await txn.getFirstAsync<{ id: string; name: string; type: string; isArchived: number }>(
        'SELECT id, name, type, isArchived FROM categories WHERE id = ?;',
        [categoryId.trim()]
      );
      if (!category) {
        throw new Error('Selected category was not found.');
      }
      if (category.type !== 'EXPENSE') {
        throw new Error('Shopping purchases must use an Expense category.');
      }
      if (category.isArchived === 1) {
        throw new Error('Archived categories cannot be used for new shopping purchases.');
      }
      verifiedCategoryId = category.id;
    }

    // 5. Create normal Vaelth EXPENSE transaction
    const txNote = customNote?.trim() || `Shopping: ${itemRow.name}`;
    const txMetadata = JSON.stringify({
      shoppingItemId: itemId,
      shoppingListId: itemRow.listId,
      productName: itemRow.name,
    });

    const transaction: Transaction = {
      id: txId,
      type: 'EXPENSE',
      amount: purchasePrice,
      date: txDate,
      accountId: purchaseAccountId,
      categoryId: verifiedCategoryId,
      note: txNote,
      metadata: txMetadata,
      createdAt: now,
      updatedAt: now,
    };
    await validateTransactionForInsertInTransaction(txn, transaction);

    await txn.runAsync(
      `INSERT INTO transactions (
         id, type, amount, date, accountId, destinationAccountId, personId,
         categoryId, assetId, liabilityId, note, dueDate, metadata,
         createdAt, updatedAt, deletedAt
       ) VALUES (?, 'EXPENSE', ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, NULL, ?, ?, ?, NULL);`,
      [txId, purchasePrice, txDate, purchaseAccountId, verifiedCategoryId, txNote, txMetadata, now, now]
    );

    // 6. Update shopping item
    await txn.runAsync(
      `UPDATE shopping_items
       SET status = 'PURCHASED',
           purchasedAt = ?,
           purchasePrice = ?,
           purchaseAccountId = ?,
           transactionId = ?,
           categoryId = ?,
           updatedAt = ?
       WHERE id = ?;`,
      [txDate, purchasePrice, purchaseAccountId, txId, verifiedCategoryId, now, itemId]
    );

    updatedItem = {
      id: itemId,
      listId: itemRow.listId,
      name: itemRow.name,
      note: itemRow.note ?? undefined,
      productUrl: itemRow.productUrl ?? undefined,
      estimatedPrice: itemRow.estimatedPrice ?? undefined,
      status: 'PURCHASED',
      createdAt: itemRow.createdAt,
      updatedAt: now,
      purchasedAt: txDate,
      purchasePrice,
      purchaseAccountId,
      transactionId: txId,
      categoryId: verifiedCategoryId ?? undefined,
    };
  });

  if (!updatedItem) {
    throw new Error('Failed to record purchase.');
  }

  return { shoppingItem: updatedItem, transactionId: txId };
}
