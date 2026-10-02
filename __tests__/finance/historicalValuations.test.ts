import { Asset, Liability, Transaction } from '../../src/domain/finance/types';
import { calculateAssetValueAsOf, calculateNetWorth } from '../../src/domain/finance/financialEngine';

const asset: Asset = {
  id: 'asset-home',
  name: 'Home',
  category: 'PROPERTY',
  currentValue: 200000,
  purchaseValue: 150000,
  purchaseDate: '2026-09-30',
  isArchived: false,
  createdAt: '2026-09-30T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
  valuationHistory: [
    { effectiveDate: '2026-09-30', value: 150000, source: 'PURCHASE', createdAt: '2026-09-30T09:00:00.000Z' },
    { effectiveDate: '2026-10-02', value: 200000, source: 'MANUAL', createdAt: '2026-10-02T09:00:00.000Z' },
  ],
  archiveHistory: [{ effectiveDate: '2026-09-30', isArchived: false, createdAt: '2026-09-30T09:00:00.000Z' }],
};

function netWorth(asOfDate: string, physicalAssets: Asset[], transactions: Transaction[] = [], liabilities: Liability[] = []) {
  return calculateNetWorth({
    accounts: [], people: [], physicalAssets, standaloneLiabilities: liabilities,
    transactions, asOfDate, currentMonthStr: asOfDate.slice(0, 7),
  });
}

describe('dated asset and liability values', () => {
  it('uses the latest manual valuation effective on or before the requested date', () => {
    expect(netWorth('2026-10-01', [asset]).netWorth).toBe(150000);
    expect(netWorth('2026-10-02', [asset]).netWorth).toBe(200000);
  });

  it('calculates month-to-month change from dated valuations', () => {
    const result = netWorth('2026-10-02', [asset]);
    expect(result.netWorth).toBe(200000);
    expect(result.netWorthChangeMonth).toBe(50000);
  });

  it('applies asset sale and purchase events only on or after their effective date', () => {
    const baseAsset: Asset = {
      ...asset,
      currentValue: 100000,
      purchaseValue: 100000,
      purchaseDate: '2026-10-01',
      createdAt: '2026-10-01T08:00:00.000Z',
      valuationHistory: [
        { effectiveDate: '2026-10-01', value: 100000, source: 'MANUAL', createdAt: '2026-10-01T09:00:00.000Z' },
      ],
    };
    const transactions: Transaction[] = [
      { id: 'sale', type: 'ASSET_SALE', amount: 30000, date: '2026-10-03', assetId: baseAsset.id, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z' },
      { id: 'purchase', type: 'ASSET_PURCHASE', amount: 10000, date: '2026-10-04', assetId: baseAsset.id, createdAt: '2026-10-01T11:00:00.000Z', updatedAt: '2026-10-01T11:00:00.000Z' },
    ];
    expect(netWorth('2026-10-02', [baseAsset], transactions).totalPhysicalAssets).toBe(100000);
    expect(netWorth('2026-10-03', [baseAsset], transactions).totalPhysicalAssets).toBe(70000);
    expect(netWorth('2026-10-04', [baseAsset], transactions).totalPhysicalAssets).toBe(80000);
    expect(netWorth('2026-10-04', [baseAsset], transactions).totalPhysicalAssets).toBe(80000);
  });

  it('replays sale values from active events after an earlier sale is removed or edited', () => {
    const baseAsset: Asset = {
      ...asset,
      currentValue: 100000,
      purchaseValue: 100000,
      purchaseDate: '2026-10-01',
      createdAt: '2026-10-01T08:00:00.000Z',
      valuationHistory: [
        { effectiveDate: '2026-10-01', value: 100000, source: 'PURCHASE', createdAt: '2026-10-01T08:00:00.000Z' },
      ],
    };
    const firstSale: Transaction = {
      id: 'sale-a', type: 'ASSET_SALE', amount: 30000, date: '2026-10-02', assetId: baseAsset.id,
      createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
    };
    const secondSale: Transaction = {
      id: 'sale-b', type: 'ASSET_SALE', amount: 80000, date: '2026-10-03', assetId: baseAsset.id,
      metadata: JSON.stringify({ bookValueSold: 80000 }),
      createdAt: '2026-10-01T11:00:00.000Z', updatedAt: '2026-10-01T11:00:00.000Z',
    };

    expect(netWorth('2026-10-03', [baseAsset], [firstSale, secondSale]).totalPhysicalAssets).toBe(0);
    // The second sale now consumes 80,000 of the original 100,000 basis.
    expect(netWorth('2026-10-03', [baseAsset], [secondSale]).totalPhysicalAssets).toBe(20000);
    const editedSecondSale = { ...secondSale, amount: 50000 };
    expect(netWorth('2026-10-03', [baseAsset], [firstSale, editedSecondSale]).totalPhysicalAssets).toBe(20000);
  });

  it('reconstructs only legacy history supported by purchase and update dates', () => {
    const legacySoldAsset: Asset = {
      ...asset,
      currentValue: 0,
      purchaseValue: 50000,
      purchaseDate: '2026-01-01',
      isArchived: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
      valuationHistory: undefined,
      archiveHistory: undefined,
    };
    const sale: Transaction = {
      id: 'legacy-sale', type: 'ASSET_SALE', amount: 60000, date: '2026-10-05', assetId: legacySoldAsset.id,
      createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
    };

    expect(netWorth('2026-09-30', [legacySoldAsset], [sale]).totalPhysicalAssets).toBe(50000);
    expect(netWorth('2026-10-06', [legacySoldAsset], [sale]).totalPhysicalAssets).toBe(0);
  });

  it('uses dated liability amounts instead of today’s mutable amount', () => {
    const liability: Liability = {
      id: 'loan', name: 'Loan', amount: 60000, type: 'PERSONAL_LOAN', isArchived: false,
      createdAt: '2026-09-30T09:00:00.000Z', updatedAt: '2026-10-02T09:00:00.000Z',
      amountHistory: [
        { effectiveDate: '2026-09-30', amount: 100000, source: 'CREATED', createdAt: '2026-09-30T09:00:00.000Z' },
        { effectiveDate: '2026-10-02', amount: 60000, source: 'MANUAL', createdAt: '2026-10-02T09:00:00.000Z' },
      ],
      archiveHistory: [{ effectiveDate: '2026-09-30', isArchived: false }],
    };
    expect(netWorth('2026-10-01', [], [], [liability]).netWorth).toBe(-100000);
    expect(netWorth('2026-10-02', [], [], [liability]).netWorth).toBe(-60000);
    expect(netWorth('2026-10-02', [], [], [liability]).netWorthChangeMonth).toBe(40000);
  });
});
