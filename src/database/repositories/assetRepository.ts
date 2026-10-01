import { getDatabase } from '../db';
import { Asset, AssetCategory } from '../../domain/finance/types';

interface AssetRow {
  id: string;
  name: string;
  category: string;
  currentValue: number;
  purchaseValue: number;
  purchaseDate: string;
  note: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

function mapRowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    category: row.category as AssetCategory,
    currentValue: row.currentValue,
    purchaseValue: row.purchaseValue,
    purchaseDate: row.purchaseDate,
    note: row.note ?? undefined,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAllAssets(includeArchived = false): Promise<Asset[]> {
  const db = await getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM assets ORDER BY createdAt DESC;'
    : 'SELECT * FROM assets WHERE isArchived = 0 ORDER BY createdAt DESC;';
  const rows = await db.getAllAsync<AssetRow>(sql);
  return rows.map(mapRowToAsset);
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?;', [id]);
  return row ? mapRowToAsset(row) : null;
}

export async function createAsset(asset: Omit<Asset, 'createdAt' | 'updatedAt'>): Promise<Asset> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO assets (id, name, category, currentValue, purchaseValue, purchaseDate, note, isArchived, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      asset.id,
      asset.name,
      asset.category,
      Math.round(asset.currentValue),
      Math.round(asset.purchaseValue),
      asset.purchaseDate,
      asset.note ?? null,
      asset.isArchived ? 1 : 0,
      now,
      now,
    ]
  );
  return { ...asset, createdAt: now, updatedAt: now };
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const current = await getAssetById(id);
  if (!current) throw new Error(`Asset ${id} not found`);

  const updated: Asset = { ...current, ...updates, updatedAt: now };
  await db.runAsync(
    `UPDATE assets SET name = ?, category = ?, currentValue = ?, purchaseValue = ?, purchaseDate = ?, note = ?, isArchived = ?, updatedAt = ?
     WHERE id = ?;`,
    [
      updated.name,
      updated.category,
      Math.round(updated.currentValue),
      Math.round(updated.purchaseValue),
      updated.purchaseDate,
      updated.note ?? null,
      updated.isArchived ? 1 : 0,
      now,
      id,
    ]
  );
}

export async function archiveAsset(id: string): Promise<void> {
  await updateAsset(id, { isArchived: true });
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDatabase();
  const txRef = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE assetId = ? AND deletedAt IS NULL;',
    [id]
  );
  if ((txRef?.count ?? 0) > 0) {
    // Preserve transaction history by archiving
    await db.runAsync('UPDATE assets SET isArchived = 1, updatedAt = ? WHERE id = ?;', [
      new Date().toISOString(),
      id,
    ]);
  } else {
    await db.runAsync('DELETE FROM assets WHERE id = ?;', [id]);
  }
}
