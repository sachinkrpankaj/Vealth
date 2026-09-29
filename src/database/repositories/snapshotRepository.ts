import { getDatabase } from '../db';

export interface NetWorthSnapshotRecord {
  id: string;
  date: string; // YYYY-MM-DD
  netWorth: number; // minor units (paise)
  totalAssets: number;
  totalLiabilities: number;
  totalReceivables: number;
  totalPayables: number;
  createdAt: string;
}

export async function getAllSnapshots(): Promise<NetWorthSnapshotRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NetWorthSnapshotRecord>(
    'SELECT * FROM net_worth_snapshots ORDER BY date ASC;'
  );
  return rows;
}

export async function getSnapshotsForRange(days: number): Promise<NetWorthSnapshotRecord[]> {
  const db = await getDatabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const rows = await db.getAllAsync<NetWorthSnapshotRecord>(
    'SELECT * FROM net_worth_snapshots WHERE date >= ? ORDER BY date ASC;',
    [cutoffStr]
  );
  return rows;
}

export async function recordSnapshot(
  snapshot: Omit<NetWorthSnapshotRecord, 'id' | 'createdAt'>
): Promise<void> {
  const db = await getDatabase();
  const id = `snap-${snapshot.date}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO net_worth_snapshots (id, date, netWorth, totalAssets, totalLiabilities, totalReceivables, totalPayables, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       netWorth = excluded.netWorth,
       totalAssets = excluded.totalAssets,
       totalLiabilities = excluded.totalLiabilities,
       totalReceivables = excluded.totalReceivables,
       totalPayables = excluded.totalPayables;`,
    [
      id,
      snapshot.date,
      Math.round(snapshot.netWorth),
      Math.round(snapshot.totalAssets),
      Math.round(snapshot.totalLiabilities),
      Math.round(snapshot.totalReceivables),
      Math.round(snapshot.totalPayables),
      now,
    ]
  );
}
