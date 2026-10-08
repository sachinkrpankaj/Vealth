import { formatRupee, formatRupeeMasked } from '../../src/domain/finance/currency';
import { calculateFinancialEffect } from '../../src/domain/finance/accountingRules';
import { Transaction } from '../../src/domain/finance/types';

describe('Currency and Sign Formatting Regression Audit (Problem 5)', () => {
  it('formats positive values with exactly one plus sign when showSign is true', () => {
    const formatted = formatRupee(1943300, { showSign: true, spaceAfterSymbol: false });
    expect(formatted).toBe('+₹19,433');
    expect(formatted.startsWith('++')).toBe(false);
    expect(formatted.match(/\+/g)?.length).toBe(1);
  });

  it('formats negative values with exactly one minus sign when showSign is true', () => {
    const formatted = formatRupee(-50000, { showSign: true, spaceAfterSymbol: false });
    expect(formatted).toBe('-₹500');
    expect(formatted.startsWith('--')).toBe(false);
    expect(formatted.match(/-/g)?.length).toBe(1);
  });

  it('formats zero without any sign prefix even when showSign is true', () => {
    const formatted = formatRupee(0, { showSign: true, spaceAfterSymbol: false });
    expect(formatted).toBe('₹0');
    expect(formatted.includes('+')).toBe(false);
    expect(formatted.includes('-')).toBe(false);
    expect(formatRupeeMasked(0, { showSign: true })).toBe('₹ •');
    expect(formatRupeeMasked(-0, { showSign: true })).toBe('₹ •');
  });

  it('formats masked amounts with single sign prefix', () => {
    const maskedPositive = formatRupeeMasked(1943300, { showSign: true, spaceAfterSymbol: false });
    expect(maskedPositive).toBe('+₹•••••');
    expect(maskedPositive.startsWith('++')).toBe(false);

    const maskedNegative = formatRupeeMasked(-50000, { showSign: true, spaceAfterSymbol: false });
    expect(maskedNegative).toBe('-₹•••');
    expect(maskedNegative.startsWith('--')).toBe(false);
  });

  it('produces single sign in accounting rules asset sale gain and loss', () => {
    const gainTx: Transaction = {
      id: 'tx-gain',
      type: 'ASSET_SALE',
      amount: 1500000, // sold for 15,000
      date: '2026-10-04',
      accountId: 'acc-1',
      assetId: 'asset-1',
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-04T00:00:00.000Z',
    };

    const gainEffect = calculateFinancialEffect(gainTx, {
      accountName: 'Bank',
      assetName: 'Gold',
      assetBookValue: 1000000, // bought for 10,000 -> gain of 5,000
    });

    const netWorthLine = gainEffect.descriptionLines.find((l) => l.startsWith('Net Worth:'));
    expect(netWorthLine).toBe('Net Worth: +₹5,000');
    expect(netWorthLine?.includes('++')).toBe(false);

    const lossTx: Transaction = {
      id: 'tx-loss',
      type: 'ASSET_SALE',
      amount: 800000, // sold for 8,000
      date: '2026-10-04',
      accountId: 'acc-1',
      assetId: 'asset-1',
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-04T00:00:00.000Z',
    };

    const lossEffect = calculateFinancialEffect(lossTx, {
      accountName: 'Bank',
      assetName: 'Laptop',
      assetBookValue: 1000000, // bought for 10,000 -> loss of 2,000
    });

    const lossNetWorthLine = lossEffect.descriptionLines.find((l) => l.startsWith('Net Worth:'));
    expect(lossNetWorthLine).toBe('Net Worth: -₹2,000');
    expect(lossNetWorthLine?.includes('--')).toBe(false);
  });
});
