import { calculateFinancialEffect } from '../../src/domain/finance/accountingRules';
import { Transaction } from '../../src/domain/finance/types';

const AS_OF = '2026-10-03';
const FUTURE = '2026-10-10';

function effectFor(type: Transaction['type'], fields: Partial<Transaction> = {}) {
  const transaction: Transaction = {
    id: `future-${type}`,
    type,
    amount: 2500,
    date: FUTURE,
    createdAt: `${AS_OF}T10:00:00.000Z`,
    updatedAt: `${AS_OF}T10:00:00.000Z`,
    ...fields,
  };
  return calculateFinancialEffect(transaction, { referenceDate: AS_OF });
}

describe('future-dated transaction detail effects', () => {
  it('labels future expenses as scheduled while keeping their transaction-date delta', () => {
    const effect = effectFor('EXPENSE', { accountId: 'bank' });
    expect(effect.isFuture).toBe(true);
    expect(effect.sourceAccountDelta).toBe(-2500);
    expect(effect.netWorthDelta).toBe(-2500);
    expect(effect.descriptionLines[0]).toContain('Scheduled effect');
    expect(effect.descriptionLines[0]).toContain('not included in current balances or net worth yet');
  });

  it('labels future income as scheduled without presenting it as current net worth', () => {
    const effect = effectFor('INCOME', { accountId: 'bank' });
    expect(effect.isFuture).toBe(true);
    expect(effect.sourceAccountDelta).toBe(2500);
    expect(effect.netWorthDelta).toBe(2500);
    expect(effect.descriptionLines[0]).toContain('Scheduled effect');
  });

  it('labels future transfers as scheduled and shows both transaction-date account deltas', () => {
    const effect = effectFor('TRANSFER', { accountId: 'bank', destinationAccountId: 'cash' });
    expect(effect.isFuture).toBe(true);
    expect(effect.sourceAccountDelta).toBe(-2500);
    expect(effect.destinationAccountDelta).toBe(2500);
    expect(effect.netWorthDelta).toBe(0);
  });

  it.each(['ASSET_PURCHASE', 'ASSET_SALE'] as const)(
    'labels future %s as scheduled and preserves the dated asset delta',
    (type) => {
      const effect = effectFor(type, {
        accountId: 'bank',
        assetId: 'asset-1',
        metadata: type === 'ASSET_SALE' ? JSON.stringify({ bookValueSold: 2000 }) : undefined,
      });
      expect(effect.isFuture).toBe(true);
      expect(effect.descriptionLines[0]).toContain('Scheduled effect');
      if (type === 'ASSET_PURCHASE') expect(effect.assetDelta).toBe(2500);
      else expect(effect.assetDelta).toBe(-2000);
    }
  );

  it('keeps current and historical effects marked as realized', () => {
    const current = calculateFinancialEffect(
      {
        id: 'today-expense', type: 'EXPENSE', amount: 100, date: AS_OF,
        createdAt: `${AS_OF}T10:00:00.000Z`, updatedAt: `${AS_OF}T10:00:00.000Z`,
      },
      { referenceDate: AS_OF }
    );
    expect(current.isFuture).toBe(false);
    expect(current.descriptionLines[0]).not.toContain('Scheduled effect');
  });
});
