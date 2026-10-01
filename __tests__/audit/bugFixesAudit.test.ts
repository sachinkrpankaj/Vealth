import { formatRupee, formatIndianNumber, formatRupeeCompact, getRupeeDigitCount } from '../../src/domain/finance/currency';
import { calculateCountStep, easeOutCubic } from '../../src/utils/animationMath';
import { formatDateIso, getCurrentLocalMonthString } from '../../src/utils/dateUtils';
import { generateTransactionsCSV } from '../../src/utils/csv';
import { Transaction } from '../../src/domain/finance/types';

describe('Comprehensive Bug Fixes Audit', () => {
  describe('1. NaN and Non-Finite Number Guards in Currency Formatters', () => {
    it('returns ₹0 for NaN, Infinity, -Infinity, undefined, null in formatRupee', () => {
      expect(formatRupee(NaN)).toBe('₹0');
      expect(formatRupee(Infinity)).toBe('₹0');
      expect(formatRupee(-Infinity)).toBe('₹0');
      expect(formatRupee(undefined as any)).toBe('₹0');
      expect(formatRupee(null as any)).toBe('₹0');
    });

    it('returns "0" for NaN, Infinity, -Infinity in formatIndianNumber', () => {
      expect(formatIndianNumber(NaN)).toBe('0');
      expect(formatIndianNumber(Infinity)).toBe('0');
      expect(formatIndianNumber(-Infinity)).toBe('0');
      expect(formatIndianNumber(undefined as any)).toBe('0');
      expect(formatIndianNumber(null as any)).toBe('0');
    });

    it('returns ₹0 for NaN, Infinity in formatRupeeCompact', () => {
      expect(formatRupeeCompact(NaN)).toBe('₹0');
      expect(formatRupeeCompact(Infinity)).toBe('₹0');
      expect(formatRupeeCompact(-Infinity)).toBe('₹0');
      expect(formatRupeeCompact(undefined as any)).toBe('₹0');
    });

    it('returns 1 for getRupeeDigitCount with invalid inputs', () => {
      expect(getRupeeDigitCount(NaN)).toBe(1);
      expect(getRupeeDigitCount(Infinity)).toBe(1);
      expect(getRupeeDigitCount(undefined as any)).toBe(1);
    });

    it('correctly formats valid monetary amounts in paise', () => {
      expect(formatRupee(100000)).toBe('₹1,000');
      expect(formatRupee(100050)).toBe('₹1,000.50');
      expect(formatRupee(-50000)).toBe('-₹500');
      expect(formatRupee(0)).toBe('₹0');
    });
  });

  describe('2. Animation Math NaN & Zero Division Hardening', () => {
    it('handles calculateCountStep with zero, negative, NaN or non-finite durations safely', () => {
      expect(calculateCountStep(0, 1000, 0, 0).currentVal).toBe(1000);
      expect(calculateCountStep(0, 1000, -100, 10).currentVal).toBe(0);
      expect(calculateCountStep(0, 1000, NaN, 10).currentVal).toBe(1000);
      expect(calculateCountStep(0, 1000, 1000, NaN).currentVal).toBe(1000);
      expect(calculateCountStep(NaN, 1000, 1000, 500).currentVal).toBe(1000);
      expect(calculateCountStep(0, NaN, 1000, 500).currentVal).toBe(0);
    });

    it('easeOutCubic returns 0 for non-finite or negative inputs and 1 for >= 1', () => {
      expect(easeOutCubic(NaN)).toBe(0);
      expect(easeOutCubic(-0.5)).toBe(0);
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
      expect(easeOutCubic(1.5)).toBe(1);
      expect(easeOutCubic(Infinity)).toBe(1);
    });
  });

  describe('3. Local Date and IST Midnight Boundary', () => {
    it('formatDateIso correctly formats dates with 2-digit padding', () => {
      const d1 = new Date(2026, 0, 5); // Jan 5, 2026
      expect(formatDateIso(d1)).toBe('2026-01-05');

      const d2 = new Date(2026, 9, 31); // Oct 31, 2026
      expect(formatDateIso(d2)).toBe('2026-10-31');
    });

    it('getCurrentLocalMonthString returns YYYY-MM matching local time', () => {
      const currentMonth = getCurrentLocalMonthString();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(currentMonth).toBe(expected);
    });
  });

  describe('4. CSV Export Data Formatting & Escaping', () => {
    it('escapes fields with commas, quotes, and newlines correctly', () => {
      const mockTx: Transaction = {
        id: 'tx-1',
        type: 'EXPENSE',
        amount: 50000, // ₹500
        date: '2026-10-01',
        accountId: 'acc-1',
        note: 'Dinner, "with colleagues"\nand drinks',
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      };

      const csv = generateTransactionsCSV([mockTx]);
      expect(csv).toContain('"Dinner, ""with colleagues""\nand drinks"');
      expect(csv).toContain('500.00');
    });
  });
});
