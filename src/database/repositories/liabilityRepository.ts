import { getDatabase } from '../db';
import { Liability, LiabilityType } from '../../domain/finance/types';

interface LiabilityRow {
  id: string;
  name: string;
  amount: number;
  type: string;
  personId: string | null;
  dueDate: string | null;
  note: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

function mapRowToLiability(row: LiabilityRow): Liability {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    type: row.type as LiabilityType,
    personId: row.personId ?? undefined,
    dueDate: row.dueDate ?? undefined,
    note: row.note ?? undefined,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAllLiabilities(includeArchived = false): Promise<Liability[]> {
  const db = await getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM liabilities ORDER BY createdAt DESC;'
    : 'SELECT * FROM liabilities WHERE isArchived = 0 ORDER BY createdAt DESC;';
  const rows = await db.getAllAsync<LiabilityRow>(sql);
  return rows.map(mapRowToLiability);
}

export async function getLiabilityById(id: string): Promise<Liability | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LiabilityRow>('SELECT * FROM liabilities WHERE id = ?;', [id]);
  return row ? mapRowToLiability(row) : null;
}

export async function createLiability(
  liability: Omit<Liability, 'createdAt' | 'updatedAt'>
): Promise<Liability> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO liabilities (id, name, amount, type, personId, dueDate, note, isArchived, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      liability.id,
      liability.name,
      Math.round(liability.amount),
      liability.type,
      liability.personId ?? null,
      liability.dueDate ?? null,
      liability.note ?? null,
      liability.isArchived ? 1 : 0,
      now,
      now,
    ]
  );
  return { ...liability, createdAt: now, updatedAt: now };
}

export async function updateLiability(id: string, updates: Partial<Liability>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const current = await getLiabilityById(id);
  if (!current) throw new Error(`Liability ${id} not found`);

  const updated: Liability = { ...current, ...updates, updatedAt: now };
  await db.runAsync(
    `UPDATE liabilities SET name = ?, amount = ?, type = ?, personId = ?, dueDate = ?, note = ?, isArchived = ?, updatedAt = ?
     WHERE id = ?;`,
    [
      updated.name,
      Math.round(updated.amount),
      updated.type,
      updated.personId ?? null,
      updated.dueDate ?? null,
      updated.note ?? null,
      updated.isArchived ? 1 : 0,
      now,
      id,
    ]
  );
}

export async function archiveLiability(id: string): Promise<void> {
  await updateLiability(id, { isArchived: true });
}
