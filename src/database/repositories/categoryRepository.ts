import { getDatabase } from '../db';
import { Category, CategoryType, CATEGORY_TYPES } from '../../domain/finance/types';

interface CategoryRow {
  id: string;
  name: string;
  type: string;
  icon: string;
  color?: string | null;
  isDefault: number;
  isArchived?: number | null;
  monthYear?: string | null;
  createdAt: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatMonthlyGeneralCategoryName(date: Date = new Date()): string {
  const monthName = MONTH_NAMES[date.getMonth()];
  const yy = String(date.getFullYear()).slice(-2);
  return `${monthName} '${yy} · General`;
}

export function getMonthYearKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function isMonthlyGeneralCategory(category: Category): boolean {
  return typeof category.monthYear === 'string' && category.monthYear.trim().length > 0;
}

function mapRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type as CategoryType,
    icon: row.icon || 'Folder',
    color: row.color || undefined,
    isDefault: row.isDefault === 1,
    isArchived: row.isArchived === 1,
    monthYear: row.monthYear || null,
    createdAt: row.createdAt,
  };
}

export async function getAllCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDatabase();
  const query = includeArchived
    ? 'SELECT * FROM categories ORDER BY isDefault DESC, name ASC;'
    : 'SELECT * FROM categories WHERE isArchived = 0 OR isArchived IS NULL ORDER BY isDefault DESC, name ASC;';
  const rows = await db.getAllAsync<CategoryRow>(query);
  return rows.map(mapRowToCategory);
}

export async function getCategoriesByType(
  type: CategoryType,
  includeArchived = false
): Promise<Category[]> {
  const db = await getDatabase();
  const query = includeArchived
    ? 'SELECT * FROM categories WHERE type = ? ORDER BY isDefault DESC, name ASC;'
    : 'SELECT * FROM categories WHERE type = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY isDefault DESC, name ASC;';
  const rows = await db.getAllAsync<CategoryRow>(query, [type]);
  return rows.map(mapRowToCategory);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?;',
    [id]
  );
  return row ? mapRowToCategory(row) : null;
}

import { generateEntityId } from '../../utils/idGenerator';

/**
 * Ensures the monthly fallback General category exists for the given date/month.
 * Identified strictly by structured id and monthYear, never by display name matching.
 * Name pattern: "<Month> '<YY> · General" (e.g. "November '26 · General")
 */
export async function ensureMonthlyGeneralCategory(date: Date = new Date()): Promise<Category> {
  const db = await getDatabase();
  const monthYear = getMonthYearKey(date);
  const generalName = formatMonthlyGeneralCategoryName(date);
  const id = `cat-general-${monthYear}`;

  const existing = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?;',
    [id]
  );

  if (existing) {
    // If it existed without monthYear set, update it
    if (existing.type !== 'EXPENSE' || existing.monthYear !== monthYear) {
      await db.runAsync(
        "UPDATE categories SET type = 'EXPENSE', monthYear = ? WHERE id = ?;",
        [monthYear, id]
      );
      existing.type = 'EXPENSE';
      existing.monthYear = monthYear;
    }
    return mapRowToCategory(existing);
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO categories (id, name, type, icon, color, isDefault, isArchived, monthYear, createdAt)
     VALUES (?, ?, 'EXPENSE', 'Folder', '#94A3B8', 0, 0, ?, ?);`,
    [id, generalName, monthYear, now]
  );

  const canonical = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?;',
    [id]
  );
  if (!canonical) throw new Error(`Unable to ensure monthly General category ${id}.`);
  if (canonical.type !== 'EXPENSE' || canonical.monthYear !== monthYear) {
    await db.runAsync(
      "UPDATE categories SET type = 'EXPENSE', monthYear = ? WHERE id = ?;",
      [monthYear, id]
    );
    canonical.type = 'EXPENSE';
    canonical.monthYear = monthYear;
  }
  return mapRowToCategory(canonical);
}

export interface GetSelectableCategoriesOptions {
  allowHistoricalMonth?: string | null; // e.g. '2026-08' when invoked from a historical month's insights
  currentSelectionId?: string | null;  // Include currently assigned category even if archived
  currentDate?: Date;                  // Mockable calendar date
}

/**
 * CURRENT-MONTH RULE:
 * - Normal Add Expense shows only the CURRENT calendar month's General category.
 * - Previous months' General categories must NOT appear in normal Add Expense.
 * - Backdating an expense must NOT expose an older month's General category in normal Add Expense.
 * - Previous-month General categories remain preserved and can only be used/edited from that month's Spending Insights page.
 */
export async function getSelectableExpenseCategories(
  options: GetSelectableCategoriesOptions = {}
): Promise<Category[]> {
  const db = await getDatabase();
  const refDate = options.currentDate || new Date();
  const currentMonthGeneral = await ensureMonthlyGeneralCategory(refDate);
  const currentMonthKey = currentMonthGeneral.monthYear || getMonthYearKey(refDate);

  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories 
     WHERE type = 'EXPENSE'
       AND (
         (isArchived = 0 OR isArchived IS NULL)
         OR (id = ? AND ? IS NOT NULL)
       )
     ORDER BY name ASC;`,
    [options.currentSelectionId || null, options.currentSelectionId || null]
  );

  const all = rows.map(mapRowToCategory);

  // Filter according to the Current-Month Rule:
  // 1. Current calendar month's General category is always included.
  // 2. Global custom categories (monthYear is null/empty) are always included (if not archived, or if currently selected).
  // 3. Historical General categories (monthYear is set and != currentMonthKey) are EXCLUDED,
  //    UNLESS explicitly allowed via options.allowHistoricalMonth or if it matches options.currentSelectionId.
  const filtered = all.filter((cat) => {
    if (!cat.monthYear) {
      // Global custom category
      return true;
    }
    if (cat.monthYear === currentMonthKey) {
      // Current calendar month General category
      return true;
    }
    if (options.allowHistoricalMonth && cat.monthYear === options.allowHistoricalMonth) {
      // Allowed from specific historical month's Spending Insights page
      return true;
    }
    if (options.currentSelectionId && cat.id === options.currentSelectionId) {
      // Preserve currently assigned historical category when editing an existing transaction
      return true;
    }
    return false;
  });

  // Sort so current month General is first, then allowed historical General (if any), then custom categories
  filtered.sort((a, b) => {
    if (a.monthYear === currentMonthKey) return -1;
    if (b.monthYear === currentMonthKey) return 1;
    if (a.monthYear && !b.monthYear) return -1;
    if (!a.monthYear && b.monthYear) return 1;
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

export async function createCategory(data: {
  id?: string;
  name: string;
  type?: CategoryType;
  icon?: string;
  color?: string;
  isDefault?: boolean;
  monthYear?: string | null;
}): Promise<Category> {
  const db = await getDatabase();
  const id = data.id || generateEntityId('cat');
  const now = new Date().toISOString();
  if (!data.name || !data.name.trim()) {
    throw new Error('Category name cannot be blank.');
  }
  const type = data.type || 'EXPENSE';
  if (!CATEGORY_TYPES.includes(type)) throw new Error(`Invalid category type: ${type}`);
  const icon = data.icon || 'Folder';
  const isDefault = data.isDefault ? 1 : 0;
  const isArchived = 0;
  const monthYear = data.monthYear || null;
  const color = data.color || null;

  await db.runAsync(
    `INSERT INTO categories (id, name, type, icon, color, isDefault, isArchived, monthYear, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [id, data.name.trim(), type, icon, color, isDefault, isArchived, monthYear, now]
  );

  return {
    id,
    name: data.name.trim(),
    type,
    icon,
    color: color || undefined,
    isDefault: !!data.isDefault,
    isArchived: false,
    monthYear,
    createdAt: now,
  };
}

export async function updateCategory(
  id: string,
  updates: {
    name?: string;
    icon?: string;
    color?: string;
    isArchived?: boolean;
  }
): Promise<Category> {
  const db = await getDatabase();
  const existing = await getCategoryById(id);
  if (!existing) {
    throw new Error(`Category not found: ${id}`);
  }

  if (updates.name !== undefined && !updates.name.trim()) {
    throw new Error('Category name cannot be blank.');
  }
  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const icon = updates.icon !== undefined ? updates.icon : existing.icon;
  const color = updates.color !== undefined ? updates.color : existing.color;
  const isArchived = updates.isArchived !== undefined ? (updates.isArchived ? 1 : 0) : (existing.isArchived ? 1 : 0);

  await db.runAsync(
    `UPDATE categories 
     SET name = ?, icon = ?, color = ?, isArchived = ?
     WHERE id = ?;`,
    [name, icon, color || null, isArchived, id]
  );

  return {
    ...existing,
    name,
    icon,
    color,
    isArchived: isArchived === 1,
  };
}

export async function archiveCategory(id: string, isArchived: boolean = true): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE categories SET isArchived = ? WHERE id = ?;',
    [isArchived ? 1 : 0, id]
  );
}

/**
 * Soft-deletes category by archiving if referenced by transactions,
 * or deletes if no transactions reference it.
 */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDatabase();
  const txRef = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE categoryId = ?;',
    [id]
  );

  if ((txRef?.count ?? 0) > 0) {
    // Preserve historical category assignments by soft-deleting (archiving)
    await db.runAsync('UPDATE categories SET isArchived = 1 WHERE id = ?;', [id]);
  } else {
    await db.runAsync('DELETE FROM categories WHERE id = ?;', [id]);
  }
}
