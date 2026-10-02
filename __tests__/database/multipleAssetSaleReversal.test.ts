import { openDatabaseAsync } from 'expo-sqlite';
import {
  deleteTransaction,
  updateTransaction,
} from '../../src/database/repositories/transactionRepository';

const open = openDatabaseAsync as jest.Mock;

describe('3. Multiple Asset-Sale Reversal & Integrity — Comprehensive Regression Tests', () => {
  let db: any;
  let scoped: any;
  let mockAsset: { id: string; currentValue: number; isArchived: number };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsset = {
      id: 'ast-portfolio',
      currentValue: 4000000, // ₹40,000 remaining after sales
      isArchived: 0,
    };

    scoped = {
      getFirstAsync: jest.fn(),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };

    db = {
      execAsync: jest.fn(),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (sql.includes('count FROM categories')) {
          return [{ count: 1 }];
        }
        return [];
      }),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
      withExclusiveTransactionAsync: jest.fn(async (fn: (txn: any) => Promise<void>) => fn(scoped)),
    };

    open.mockResolvedValue(db);
  });

  /**
   * Scenario:
   * Initial Asset = ₹100,000
   * Sale A = ₹40,000 (Asset becomes ₹60,000, metadata: bookValueSold = 40,000)
   * Sale B = ₹20,000 (Asset becomes ₹40,000, metadata: bookValueSold = 20,000)
   */

  it('deleting Sale A restores only its recorded book value (₹40,000), leaving asset at ₹80,000 (NOT ₹100,000)', async () => {
    // Current asset is at ₹40,000
    // Deleting Sale A (amount 40,000) must result in 40,000 + 40,000 = 80,000
    const saleA = {
      id: 'tx-sale-a',
      type: 'ASSET_SALE',
      amount: 4000000, // ₹40,000
      assetId: 'ast-portfolio',
      metadata: JSON.stringify({
        assetBookValueBefore: 10000000,
        assetValueDeducted: 4000000,
        bookValueSold: 4000000,
      }),
      deletedAt: null,
    };

    scoped.getFirstAsync
      .mockResolvedValueOnce(saleA) // tx
      .mockResolvedValueOnce({ currentValue: 4000000, isArchived: 0 }); // asset

    await deleteTransaction('tx-sale-a');

    expect(scoped.runAsync).toHaveBeenCalledWith(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [8000000, 0, expect.any(String), 'ast-portfolio']
    );

    expect(scoped.runAsync).toHaveBeenCalledWith(
      'UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL;',
      [expect.any(String), expect.any(String), 'tx-sale-a']
    );
  });

  it('deleting Sale B restores only ₹20,000, leaving asset at ₹60,000', async () => {
    // Current asset is at ₹40,000
    // Deleting Sale B (amount 20,000) must result in 40,000 + 20,000 = 60,000
    const saleB = {
      id: 'tx-sale-b',
      type: 'ASSET_SALE',
      amount: 2000000, // ₹20,000
      assetId: 'ast-portfolio',
      metadata: JSON.stringify({
        assetBookValueBefore: 6000000,
        assetValueDeducted: 2000000,
        bookValueSold: 2000000,
      }),
      deletedAt: null,
    };

    scoped.getFirstAsync
      .mockResolvedValueOnce(saleB)
      .mockResolvedValueOnce({ currentValue: 4000000, isArchived: 0 });

    await deleteTransaction('tx-sale-b');

    expect(scoped.runAsync).toHaveBeenCalledWith(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [6000000, 0, expect.any(String), 'ast-portfolio']
    );
  });

  it('deleting middle sale in a 3-sale series correctly adds back exactly the middle sale book value', async () => {
    // Sale 1: ₹30,000
    // Sale 2 (middle): ₹25,000
    // Sale 3: ₹15,000
    // Current asset remaining: ₹30,000
    // Deleting middle sale (Sale 2) should yield 30,000 + 25,000 = ₹55,000
    const middleSale = {
      id: 'tx-sale-mid',
      type: 'ASSET_SALE',
      amount: 2500000,
      assetId: 'ast-portfolio',
      metadata: JSON.stringify({
        assetBookValueBefore: 7000000,
        assetValueDeducted: 2500000,
        bookValueSold: 2500000,
      }),
      deletedAt: null,
    };

    scoped.getFirstAsync
      .mockResolvedValueOnce(middleSale)
      .mockResolvedValueOnce({ currentValue: 3000000, isArchived: 0 });

    await deleteTransaction('tx-sale-mid');

    expect(scoped.runAsync).toHaveBeenCalledWith(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [5500000, 0, expect.any(String), 'ast-portfolio']
    );
  });

  it('editing sale amount adjusts asset valuation by exact net delta', async () => {
    // Existing sale of ₹20,000 on asset with remaining ₹40,000
    // User updates sale to ₹35,000 (+₹15,000 delta) -> remaining becomes ₹25,000
    const existingSale = {
      id: 'tx-sale-edit',
      type: 'ASSET_SALE',
      amount: 2000000,
      date: '2026-10-01',
      assetId: 'ast-portfolio',
      metadata: JSON.stringify({
        assetBookValueBefore: 6000000,
        assetValueDeducted: 2000000,
        bookValueSold: 2000000,
      }),
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    scoped.getFirstAsync
      .mockResolvedValueOnce(existingSale)
      .mockResolvedValueOnce({ currentValue: 4000000, isArchived: 0 });

    await updateTransaction('tx-sale-edit', { amount: 3500000 });

    expect(scoped.runAsync).toHaveBeenCalledWith(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [2500000, 0, expect.any(String), 'ast-portfolio']
    );
  });

  it('reversing a full liquidation sale automatically unarchives the asset', async () => {
    // Asset was fully liquidated to 0 and archived
    const liquidationSale = {
      id: 'tx-liquidate',
      type: 'ASSET_SALE',
      amount: 10000000, // ₹1,00,000
      assetId: 'ast-portfolio',
      metadata: JSON.stringify({
        assetBookValueBefore: 10000000,
        assetValueDeducted: 10000000,
        bookValueSold: 10000000,
      }),
      deletedAt: null,
    };

    scoped.getFirstAsync
      .mockResolvedValueOnce(liquidationSale)
      .mockResolvedValueOnce({ currentValue: 0, isArchived: 1 });

    await deleteTransaction('tx-liquidate');

    // Asset restored to ₹1,00,000 and unarchived (isArchived = 0)
    expect(scoped.runAsync).toHaveBeenCalledWith(
      'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
      [10000000, 0, expect.any(String), 'ast-portfolio']
    );
  });
});
