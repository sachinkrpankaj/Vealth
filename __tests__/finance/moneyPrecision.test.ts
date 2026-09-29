import {
  addMinor,
  subMinor,
  rupeeToMinor,
  minorToRupee,
  parseRupeeToMinor,
  formatRupee,
  formatIndianNumber,
} from '../../src/domain/finance/currency';

describe('Money Precision & Float Error Prevention Engine', () => {
  describe('Minor Unit (Paise) Integer Arithmetic', () => {
    it('prevents standard JavaScript floating point drift (0.1 + 0.2 != 0.3)', () => {
      // In standard JS floating point:
      // 0.1 + 0.2 = 0.30000000000000004
      const jsFloatSum = 0.1 + 0.2;
      expect(jsFloatSum).not.toBe(0.3);

      // In Vaelth minor unit integer arithmetic:
      // ₹0.10 = 10 paise, ₹0.20 = 20 paise
      const minor1 = rupeeToMinor(0.1);
      const minor2 = rupeeToMinor(0.2);
      const sumMinor = addMinor(minor1, minor2);

      expect(sumMinor).toBe(30); // Exactly 30 paise
      expect(minorToRupee(sumMinor)).toBe(0.3); // Exactly ₹0.30
    });

    it('remains perfectly precise over 10,000 repeated fractional transactions', () => {
      // 10,000 transactions of ₹0.33 (33 paise)
      let minorAccumulator = 0;
      let floatAccumulator = 0;

      for (let i = 0; i < 10000; i++) {
        minorAccumulator = addMinor(minorAccumulator, 33);
        floatAccumulator += 0.33;
      }

      // Minor unit accumulator is exact: 33 * 10,000 = 330,000 paise (₹3,300)
      expect(minorAccumulator).toBe(330000);
      expect(minorToRupee(minorAccumulator)).toBe(3300);

      // Standard float accumulator has accumulated floating point error
      expect(floatAccumulator).not.toBe(3300);
    });

    it('correctly handles subtraction and negative integer balances', () => {
      expect(subMinor(1000, 450)).toBe(550);
      expect(subMinor(500, 1200)).toBe(-700);
      expect(addMinor(-700, 700)).toBe(0);
      expect(addMinor(-500, -300)).toBe(-800);
    });

    it('safely rounds fractional inputs when converting from rupees to paise', () => {
      expect(rupeeToMinor(10.555)).toBe(1056);
      expect(rupeeToMinor(10.554)).toBe(1055);
      expect(rupeeToMinor(10.0)).toBe(1000);
    });
  });

  describe('parseRupeeToMinor Input Normalization', () => {
    it('parses unformatted strings, formatted strings, and decimals accurately', () => {
      expect(parseRupeeToMinor('100')).toBe(10000); // ₹100 = 10,000 paise
      expect(parseRupeeToMinor('100.50')).toBe(10050); // ₹100.50 = 10,050 paise
      expect(parseRupeeToMinor('100.5')).toBe(10050); // ₹100.5 = 10,050 paise
      expect(parseRupeeToMinor('100.05')).toBe(10005); // ₹100.05 = 10,005 paise
      expect(parseRupeeToMinor('₹1,25,000.75')).toBe(12500075);
      expect(parseRupeeToMinor('-500.25')).toBe(-50025);
      expect(parseRupeeToMinor('')).toBe(0);
    });
  });

  describe('formatIndianNumber and formatRupee', () => {
    it('formats Indian numbering system accurately for lakhs and crores', () => {
      expect(formatIndianNumber(500)).toBe('500');
      expect(formatIndianNumber(2500)).toBe('2,500');
      expect(formatIndianNumber(125000)).toBe('1,25,000');
      expect(formatIndianNumber(10000000)).toBe('1,00,00,000');
    });

    it('formats currency with paise only when non-zero or explicitly requested', () => {
      expect(formatRupee(1000000)).toBe('₹10,000');
      expect(formatRupee(1000050)).toBe('₹10,000.50');
      expect(formatRupee(1000000, { showPaise: true })).toBe('₹10,000.00');
      expect(formatRupee(-50000)).toBe('-₹500');
      expect(formatRupee(50000, { showSign: true })).toBe('+₹500');
    });
  });
});
