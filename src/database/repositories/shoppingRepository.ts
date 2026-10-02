import { getDatabase } from '../db';
import { ShoppingList, ShoppingItem, ShoppingListSummary, ShoppingItemStatus } from '../../domain/finance/types';
import { formatDateIso, parseLocalDate } from '../../utils/dateUtils';
import { formatRupee } from '../../domain/finance/currency';
import { generateEntityId } from '../../utils/idGenerator';
import { deleteTransaction } from './transactionRepository';

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

  await db.runAsync(
    `INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
     VALUES (?, ?, 0, ?, ?);`,
    [id, trimmed, now, now]
  );

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
  const current = await getShoppingListById(id);
  if (!current) {
    throw new Error(`Shopping list with id "${id}" not found.`);
  }

  const newName = updates.name !== undefined ? updates.name.trim() : current.name;
  if (!newName) {
    throw new Error('Shopping list name cannot be blank.');
  }

  const isArchived = updates.isArchived !== undefined ? updates.isArchived : current.isArchived;
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE shopping_lists
     SET name = ?, isArchived = ?, updatedAt = ?
     WHERE id = ?;`,
    [newName, isArchived ? 1 : 0, now, id]
  );

  return {
    id,
    name: newName,
    isArchived,
    createdAt: current.createdAt,
    updatedAt: now,
  };
}

export async function archiveShoppingList(id: string, isArchived = true): Promise<void> {
  await updateShoppingList(id, { isArchived });
}

export async function deleteShoppingList(
  id: string
): Promise<{ deleted: boolean; archivedInstead: boolean; message: string }> {
  const db = await getDatabase();
  const list = await getShoppingListById(id);
  if (!list) {
    throw new Error(`Shopping list with id "${id}" not found.`);
  }

  // Check if any items in this list are purchased or linked to financial transactions
  const purchasedRef = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM shopping_items
     WHERE listId = ? AND (status = 'PURCHASED' OR transactionId IS NOT NULL);`,
    [id]
  );

  if ((purchasedRef?.count ?? 0) > 0) {
    // Cannot hard delete because it contains financial history. Safely archive instead.
    await archiveShoppingList(id, true);
    return {
      deleted: false,
      archivedInstead: true,
      message: `"${list.name}" contains purchased items with financial history and was safely archived instead of deleted.`,
    };
  }

  // Safe to delete because no purchased items or financial transactions exist
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM shopping_items WHERE listId = ?;', [id]);
    await txn.runAsync('DELETE FROM shopping_lists WHERE id = ?;', [id]);
  });

  return {
    deleted: true,
    archivedInstead: false,
    message: `Shopping list "${list.name}" was permanently deleted.`,
  };
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
  const list = await getShoppingListById(params.listId);
  if (!list) {
    throw new Error(`Shopping list "${params.listId}" not found.`);
  }

  const id = generateUniqueId('item');
  const now = new Date().toISOString();
  const estPrice =
    params.estimatedPrice != null && Number.isSafeInteger(params.estimatedPrice) && params.estimatedPrice > 0
      ? params.estimatedPrice
      : null;
  const trimmedNote = params.note?.trim() || null;
  const trimmedUrl = normalizeProductUrl(params.productUrl);

  await db.runAsync(
    `INSERT INTO shopping_items (
       id, listId, name, note, productUrl, estimatedPrice,
       status, createdAt, updatedAt
     ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?);`,
    [id, params.listId, trimmedName, trimmedNote, trimmedUrl, estPrice, now, now]
  );

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
  const current = await getShoppingItemById(id);
  if (!current) {
    throw new Error(`Shopping item "${id}" not found.`);
  }

  const newName = updates.name !== undefined ? updates.name.trim() : current.name;
  if (!newName) {
    throw new Error('Product name cannot be blank.');
  }

  const newNote = updates.note !== undefined ? updates.note?.trim() || null : (current.note ?? null);
  const newUrl = updates.productUrl !== undefined ? normalizeProductUrl(updates.productUrl) : (current.productUrl ?? null);
  const newEstPrice =
    updates.estimatedPrice !== undefined
      ? (updates.estimatedPrice != null && Number.isSafeInteger(updates.estimatedPrice) && updates.estimatedPrice > 0
          ? updates.estimatedPrice
          : null)
      : (current.estimatedPrice ?? null);

  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE shopping_items
     SET name = ?, note = ?, productUrl = ?, estimatedPrice = ?, updatedAt = ?
     WHERE id = ?;`,
    [newName, newNote, newUrl, newEstPrice, now, id]
  );

  return {
    ...current,
    name: newName,
    note: newNote ?? undefined,
    productUrl: newUrl ?? undefined,
    estimatedPrice: newEstPrice ?? undefined,
    updatedAt: now,
  };
}

export async function discardShoppingItem(id: string): Promise<void> {
  const db = await getDatabase();
  const current = await getShoppingItemById(id);
  if (!current) {
    throw new Error(`Shopping item "${id}" not found.`);
  }

  if (current.status === 'PURCHASED') {
    throw new Error('Cannot discard an already purchased shopping item.');
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE shopping_items SET status = 'DISCARDED', updatedAt = ? WHERE id = ?;`,
    [now, id]
  );
}

export async function restoreShoppingItem(id: string): Promise<void> {
  const db = await getDatabase();
  const current = await getShoppingItemById(id);
  if (!current) {
    throw new Error(`Shopping item "${id}" not found.`);
  }

  const now = new Date().toISOString();

  if (current.status === 'PURCHASED') {
    // Transactional reversal: soft-delete the linked financial transaction so financial state stays in sync
    if (current.transactionId) {
      await deleteTransaction(current.transactionId);
    }
    await db.runAsync(
      `UPDATE shopping_items
       SET status = 'PENDING',
           purchasedAt = NULL,
           purchasePrice = NULL,
           purchaseAccountId = NULL,
           transactionId = NULL,
           categoryId = NULL,
           updatedAt = ?
       WHERE id = ?;`,
      [now, id]
    );
  } else {
    // Normal restore from DISCARDED
    await db.runAsync(
      `UPDATE shopping_items SET status = 'PENDING', updatedAt = ? WHERE id = ?;`,
      [now, id]
    );
  }
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const db = await getDatabase();
  const current = await getShoppingItemById(id);
  if (!current) {
    throw new Error(`Shopping item "${id}" not found.`);
  }

  if (current.status === 'PURCHASED' || current.transactionId) {
    throw new Error('Cannot delete a purchased shopping item with a linked financial transaction. Preserving history.');
  }

  await db.runAsync('DELETE FROM shopping_items WHERE id = ?;', [id]);
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
    if (itemRow.status === 'PURCHASED') {
      throw new Error('This item has already been marked as purchased.');
    }

    // 2. Verify account and spendability
    const account = await txn.getFirstAsync<{ id: string; name: string; type: string; openingBalance: number; isArchived: number }>(
      'SELECT id, name, type, openingBalance, isArchived FROM accounts WHERE id = ?;',
      [purchaseAccountId]
    );
    if (!account) {
      throw new Error('Selected payment account was not found.');
    }
    if (account.isArchived === 1) {
      throw new Error(`Account "${account.name}" is archived and cannot be used for spending.`);
    }
    if (account.type === 'CREDIT_CARD' || account.type === 'INVESTMENT') {
      throw new Error(`Account type "${account.type}" cannot be used as a direct funding source.`);
    }

    // 3. Verify source balance
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

    if (currentBalance < purchasePrice) {
      throw new Error(
        `Insufficient balance: Account "${account.name}" has only ${formatRupee(currentBalance)}, but this purchase requires ${formatRupee(purchasePrice)}.`
      );
    }

    // 4. Verify category if provided
    let verifiedCategoryId: string | null = null;
    if (categoryId && categoryId.trim() !== '') {
      const category = await txn.getFirstAsync<{ id: string; name: string; type: string }>(
        'SELECT id, name, type FROM categories WHERE id = ?;',
        [categoryId.trim()]
      );
      if (!category) {
        throw new Error('Selected category was not found.');
      }
      if (category.type !== 'EXPENSE') {
        throw new Error('Shopping purchases must use an Expense category.');
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
