import { getDatabase } from '../db';
import { Category, CategoryType } from '../../domain/finance/types';

interface CategoryRow {
  id: string;
  name: string;
  type: string;
  icon: string;
  isDefault: number;
  createdAt: string;
}

function mapRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type as CategoryType,
    icon: row.icon,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
  };
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY isDefault DESC, name ASC;'
  );
  return rows.map(mapRowToCategory);
}

export async function getCategoriesByType(type: CategoryType): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE type = ? ORDER BY isDefault DESC, name ASC;',
    [type]
  );
  return rows.map(mapRowToCategory);
}

export async function createCategory(category: Omit<Category, 'createdAt'>): Promise<Category> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO categories (id, name, type, icon, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?);',
    [category.id, category.name, category.type, category.icon, category.isDefault ? 1 : 0, now]
  );
  return { ...category, createdAt: now };
}
