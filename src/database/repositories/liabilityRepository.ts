import { getDatabase } from '../db';
import {
  Liability,
  LiabilityArchiveState,
  LiabilityType,
  LiabilityValuation,
  LIABILITY_TYPES,
} from '../../domain/finance/types';
import { generateEntityId } from '../../utils/idGenerator';
import { getTodayLocalDateString, parseLocalDate } from '../../utils/dateUtils';

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

async function recordAmount(
  txn: Awaited<ReturnType<typeof getDatabase>>,
  liabilityId: string,
  effectiveDate: string,
  amount: number,
  source: LiabilityValuation['source'],
  createdAt: string
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO liability_valuations (id, liabilityId, effectiveDate, amount, source, createdAt)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [generateEntityId('liabval'), liabilityId, effectiveDate, Math.round(amount), source, createdAt]
  );
}

async function recordArchiveState(
  txn: Awaited<ReturnType<typeof getDatabase>>,
  liabilityId: string,
  effectiveDate: string,
  isArchived: boolean,
  createdAt: string
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO liability_archive_history (id, liabilityId, effectiveDate, isArchived, createdAt)
     VALUES (?, ?, ?, ?, ?);`,
    [generateEntityId('liabstate'), liabilityId, effectiveDate, isArchived ? 1 : 0, createdAt]
  );
}

async function hydrateLiabilities(rows: LiabilityRow[]): Promise<Liability[]> {
  const liabilities = rows.map(mapRowToLiability);
  if (!liabilities.length) return liabilities;
  const db = await getDatabase();
  const placeholders = liabilities.map(() => '?').join(', ');
  const ids = liabilities.map((liability) => liability.id);
  const [amountRows, archiveRows] = await Promise.all([
    db.getAllAsync<{
      liabilityId: string;
      effectiveDate: string;
      amount: number;
      source: LiabilityValuation['source'];
      createdAt: string;
    }>(
      `SELECT liabilityId, effectiveDate, amount, source, createdAt FROM liability_valuations WHERE liabilityId IN (${placeholders}) ORDER BY effectiveDate, createdAt;`,
      ids
    ),
    db.getAllAsync<{
      liabilityId: string;
      effectiveDate: string;
      isArchived: number;
      createdAt: string;
    }>(
      `SELECT liabilityId, effectiveDate, isArchived, createdAt FROM liability_archive_history WHERE liabilityId IN (${placeholders}) ORDER BY effectiveDate, createdAt;`,
      ids
    ),
  ]);
  const amounts = new Map<string, LiabilityValuation[]>();
  for (const row of amountRows) {
    const history = amounts.get(row.liabilityId) || [];
    history.push({
      effectiveDate: row.effectiveDate,
      amount: row.amount,
      source: row.source,
      createdAt: row.createdAt,
    });
    amounts.set(row.liabilityId, history);
  }
  const archives = new Map<string, LiabilityArchiveState[]>();
  for (const row of archiveRows) {
    const history = archives.get(row.liabilityId) || [];
    history.push({
      effectiveDate: row.effectiveDate,
      isArchived: row.isArchived === 1,
      createdAt: row.createdAt,
    });
    archives.set(row.liabilityId, history);
  }
  return liabilities.map((liability) => ({
    ...liability,
    amountHistory: amounts.get(liability.id) || [],
    archiveHistory: archives.get(liability.id) || [],
  }));
}

export async function getAllLiabilities(includeArchived = false): Promise<Liability[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LiabilityRow>('SELECT * FROM liabilities ORDER BY createdAt DESC;');
  const liabilities = await hydrateLiabilities(rows);
  return includeArchived ? liabilities : liabilities.filter((liability) => !liability.isArchived);
}

export async function getLiabilityById(id: string): Promise<Liability | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LiabilityRow>('SELECT * FROM liabilities WHERE id = ?;', [id]);
  if (!row) return null;
  const [liability] = await hydrateLiabilities([row]);
  return liability;
}

export async function createLiability(
  liability: Omit<Liability, 'createdAt' | 'updatedAt'>
): Promise<Liability> {
  if (!LIABILITY_TYPES.includes(liability.type)) throw new Error(`Invalid liability type: ${liability.type}`);
  if (!Number.isSafeInteger(liability.amount) || liability.amount < 0) {
    throw new Error('Liability amount must be a non-negative integer in paise.');
  }
  if (liability.dueDate && !parseLocalDate(liability.dueDate)) {
    throw new Error('Liability due date must be a valid YYYY-MM-DD date.');
  }
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = getTodayLocalDateString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
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
    await recordAmount(txn, liability.id, today, liability.amount, 'CREATED', now);
    await recordArchiveState(txn, liability.id, today, liability.isArchived, now);
  });
  return { ...liability, createdAt: now, updatedAt: now };
}

export async function updateLiability(id: string, updates: Partial<Liability>): Promise<void> {
  const db = await getDatabase();
  if (updates.type && !LIABILITY_TYPES.includes(updates.type)) {
    throw new Error(`Invalid liability type: ${updates.type}`);
  }
  if (updates.amount !== undefined && (!Number.isSafeInteger(updates.amount) || updates.amount < 0)) {
    throw new Error('Liability amount must be a non-negative integer in paise.');
  }
  if (updates.dueDate && !parseLocalDate(updates.dueDate)) {
    throw new Error('Liability due date must be a valid YYYY-MM-DD date.');
  }
  const now = new Date().toISOString();
  const today = getTodayLocalDateString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<LiabilityRow>('SELECT * FROM liabilities WHERE id = ?;', [id]);
    if (!row) throw new Error(`Liability ${id} not found`);
    const current = mapRowToLiability(row);
    const updated: Liability = { ...current, ...updates, updatedAt: now };
    await txn.runAsync(
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
    if (updates.amount !== undefined && updated.amount !== current.amount) {
      await recordAmount(txn, id, today, updated.amount, 'MANUAL', now);
    }
    if (updates.isArchived !== undefined && updated.isArchived !== current.isArchived) {
      await recordArchiveState(txn, id, today, updated.isArchived, now);
    }
  });
}

export async function archiveLiability(id: string): Promise<void> {
  await updateLiability(id, { isArchived: true });
}

export async function deleteLiability(id: string): Promise<void> {
  const db = await getDatabase();
  const txRef = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE liabilityId = ?;',
    [id]
  );
  if ((txRef?.count ?? 0) > 0) {
    await updateLiability(id, { isArchived: true });
  } else {
    await db.runAsync('DELETE FROM liabilities WHERE id = ?;', [id]);
  }
}
