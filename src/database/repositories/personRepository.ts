import { getDatabase } from '../db';
import { Person } from '../../domain/finance/types';

interface PersonRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  avatarColor: string;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

function mapRowToPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    note: row.note ?? undefined,
    avatarColor: row.avatarColor,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAllPeople(includeArchived = false): Promise<Person[]> {
  const db = await getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM people ORDER BY name ASC;'
    : 'SELECT * FROM people WHERE isArchived = 0 ORDER BY name ASC;';
  const rows = await db.getAllAsync<PersonRow>(sql);
  return rows.map(mapRowToPerson);
}

export async function getPersonById(id: string): Promise<Person | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PersonRow>('SELECT * FROM people WHERE id = ?;', [id]);
  return row ? mapRowToPerson(row) : null;
}

export async function createPerson(
  person: Omit<Person, 'createdAt' | 'updatedAt'>
): Promise<Person> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO people (id, name, phone, email, note, avatarColor, isArchived, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      person.id,
      person.name,
      person.phone ?? null,
      person.email ?? null,
      person.note ?? null,
      person.avatarColor,
      person.isArchived ? 1 : 0,
      now,
      now,
    ]
  );
  return { ...person, createdAt: now, updatedAt: now };
}

export async function updatePerson(id: string, updates: Partial<Person>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const current = await getPersonById(id);
  if (!current) throw new Error(`Person ${id} not found`);

  const updated: Person = { ...current, ...updates, updatedAt: now };
  await db.runAsync(
    `UPDATE people SET name = ?, phone = ?, email = ?, note = ?, avatarColor = ?, isArchived = ?, updatedAt = ?
     WHERE id = ?;`,
    [
      updated.name,
      updated.phone ?? null,
      updated.email ?? null,
      updated.note ?? null,
      updated.avatarColor,
      updated.isArchived ? 1 : 0,
      now,
      id,
    ]
  );
}

export async function archivePerson(id: string): Promise<void> {
  await updatePerson(id, { isArchived: true });
}

export async function deletePerson(id: string): Promise<void> {
  const db = await getDatabase();
  const txRef = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE personId = ?;',
    [id]
  );
  if ((txRef?.count ?? 0) > 0) {
    await db.runAsync('UPDATE people SET isArchived = 1, updatedAt = ? WHERE id = ?;', [
      new Date().toISOString(),
      id,
    ]);
  } else {
    await db.runAsync('DELETE FROM people WHERE id = ?;', [id]);
  }
}
