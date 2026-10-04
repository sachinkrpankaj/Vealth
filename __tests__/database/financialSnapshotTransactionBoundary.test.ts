import { openDatabaseAsync } from 'expo-sqlite';
import { fetchFinancialSnapshot } from '../../src/hooks/useFinancialData';
import { getAllAssets } from '../../src/database/repositories/assetRepository';
import { _resetDatabaseForTesting } from '../../src/database/db';

const openMock = openDatabaseAsync as jest.Mock;

describe('Financial Snapshot Transaction Boundary Regression Test', () => {
  let activeTransactionCount = 0;
  let totalTransactionsStarted = 0;
  let totalExclusiveTransactionsStarted = 0;
  let mockDb: any;

  // Mock tables
  let assetsTable: any[] = [];
  let assetValuationsTable: any[] = [];
  let accountsTable: any[] = [];
  let peopleTable: any[] = [];
  let liabilitiesTable: any[] = [];
  let categoriesTable: any[] = [];
  let transactionsTable: any[] = [];

  beforeEach(() => {
    _resetDatabaseForTesting();
    jest.clearAllMocks();

    activeTransactionCount = 0;
    totalTransactionsStarted = 0;
    totalExclusiveTransactionsStarted = 0;

    assetsTable = [
      {
        id: 'asset-gold-1',
        name: 'Physical Gold 24K',
        category: 'PRECIOUS_METAL',
        currentValue: 150000,
        purchaseValue: 120000,
        purchaseDate: '2026-01-10',
        note: null,
        isArchived: 0,
        createdAt: '2026-01-10T10:00:00.000Z',
        updatedAt: '2026-01-10T10:00:00.000Z',
      },
    ];

    assetValuationsTable = [
      {
        id: 'val-1',
        assetId: 'asset-gold-1',
        effectiveDate: '2026-01-10',
        value: 120000,
        source: 'PURCHASE',
        createdAt: '2026-01-10T10:00:00.000Z',
      },
    ];

    accountsTable = [
      {
        id: 'acc-1',
        name: 'HDFC Savings',
        type: 'BANK',
        openingBalance: 100000,
        isArchived: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    peopleTable = [
      {
        id: 'person-1',
        name: 'Rahul',
        isArchived: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    liabilitiesTable = [
      {
        id: 'lib-1',
        name: 'Personal Loan',
        amount: 50000,
        type: 'PERSONAL_LOAN',
        isArchived: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    categoriesTable = [
      {
        id: 'cat-invest',
        name: 'Investment',
        type: 'EXPENSE',
        icon: 'trending-up',
        isDefault: 1,
        isArchived: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    transactionsTable = [
      {
        id: 'tx-1',
        type: 'ASSET_PURCHASE',
        amount: 120000,
        date: '2026-01-10',
        accountId: 'acc-1',
        assetId: 'asset-gold-1',
        metadata: null,
        createdAt: '2026-01-10T10:00:00.000Z',
        updatedAt: '2026-01-10T10:00:00.000Z',
        deletedAt: null,
      },
    ];

    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM app_settings WHERE key = ?')) {
          if (params[0] === 'user_name') {
            return { value: 'vealth User' };
          }
          return null;
        }
        if (sql.includes('FROM assets WHERE id = ?')) {
          return assetsTable.find((a) => a.id === params[0]) || null;
        }
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('PRAGMA foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (sql.includes('COUNT(*) as count FROM categories')) {
          return [{ count: 1 }];
        }
        if (sql.includes('FROM assets')) {
          return [...assetsTable];
        }
        if (sql.includes('FROM asset_valuations')) {
          return [...assetValuationsTable];
        }
        if (sql.includes('FROM asset_archive_history')) {
          return [];
        }
        if (sql.includes('FROM accounts')) {
          return [...accountsTable];
        }
        if (sql.includes('FROM people')) {
          return [...peopleTable];
        }
        if (sql.includes('FROM liabilities')) {
          return [...liabilitiesTable];
        }
        if (sql.includes('FROM categories')) {
          return [...categoriesTable];
        }
        if (sql.includes('FROM transactions')) {
          return [...transactionsTable];
        }
        return [];
      }),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
        if (activeTransactionCount > 0) {
          throw new Error('Cannot start a transaction within a transaction.');
        }
        activeTransactionCount++;
        totalTransactionsStarted++;
        try {
          return await task();
        } finally {
          activeTransactionCount--;
        }
      }),
      withExclusiveTransactionAsync: jest.fn(async (task: (txn: any) => Promise<void>) => {
        if (activeTransactionCount > 0) {
          throw new Error('Cannot start a transaction within a transaction.');
        }
        activeTransactionCount++;
        totalExclusiveTransactionsStarted++;
        try {
          return await task(mockDb);
        } finally {
          activeTransactionCount--;
        }
      }),
      closeAsync: jest.fn().mockResolvedValue(undefined),
    };

    openMock.mockResolvedValue(mockDb);
  });

  it('proves fetchFinancialSnapshot() executes within exactly ONE transaction boundary without nested transactions', async () => {
    // When fetching financial snapshot:
    // It must not crash with "Cannot start a transaction within a transaction."
    // even though assets exist and require reconcileAssetState().
    const snapshot = await fetchFinancialSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot.userName).toBe('vealth User');
    expect(snapshot.accounts).toHaveLength(1);
    expect(snapshot.people).toHaveLength(1);
    expect(snapshot.physicalAssets).toHaveLength(1);
    expect(snapshot.physicalAssets[0].id).toBe('asset-gold-1');
    expect(snapshot.standaloneLiabilities).toHaveLength(1);
    expect(snapshot.categories).toHaveLength(1);
    expect(snapshot.transactions).toHaveLength(1);

    // Assert strict single transaction boundary invariants
    expect(totalTransactionsStarted).toBe(1);
    expect(totalExclusiveTransactionsStarted).toBe(0);
    expect(activeTransactionCount).toBe(0);
  });

  it('fails if getAllAssets(true) is called without executor inside an active transaction (proves regression guard catches nested transactions)', async () => {
    // This verifies our test harness accurately simulates the SQLite native error:
    // Calling getAllAssets(true) without passing the active transaction executor
    // triggers db.withExclusiveTransactionAsync, which must throw.
    await mockDb.withTransactionAsync(async () => {
      await expect(getAllAssets(true)).rejects.toThrow(
        'Cannot start a transaction within a transaction.'
      );
    });
  });

  it('deduplicates concurrent fetchFinancialSnapshot() calls to share the same transaction boundary', async () => {
    const [snap1, snap2, snap3] = await Promise.all([
      fetchFinancialSnapshot(),
      fetchFinancialSnapshot(),
      fetchFinancialSnapshot(),
    ]);

    expect(snap1).toBe(snap2);
    expect(snap2).toBe(snap3);
    expect(snap1.userName).toBe('vealth User');

    // Only 1 transaction boundary opened for all 3 concurrent requests
    expect(totalTransactionsStarted).toBe(1);
    expect(totalExclusiveTransactionsStarted).toBe(0);
    expect(activeTransactionCount).toBe(0);
  });
});
