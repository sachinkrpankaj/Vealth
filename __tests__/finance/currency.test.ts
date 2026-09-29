import {
  formatIndianNumber,
  formatRupee,
  formatRupeeCompact,
  getRupeeDigitCount,
  getMaskedDots,
  formatRupeeMasked,
  parseRupeeToMinor,
  addMinor,
  subMinor,
  rupeeToMinor,
  minorToRupee,
} from '../../src/domain/finance/currency';

describe('Currency and Minor Unit Arithmetic', () => {
  test('Indian number formatting separates hundreds, then thousands, then lakhs', () => {
    expect(formatIndianNumber(500)).toBe('500');
    expect(formatIndianNumber(2500)).toBe('2,500');
    expect(formatIndianNumber(25000)).toBe('25,000');
    expect(formatIndianNumber(125000)).toBe('1,25,000');
    expect(formatIndianNumber(1000000)).toBe('10,00,000');
  });

  test('formatRupee formats paise correctly to Indian Rupee strings', () => {
    expect(formatRupee(50000)).toBe('₹500');
    expect(formatRupee(250000)).toBe('₹2,500');
    expect(formatRupee(2500000)).toBe('₹25,000');
    expect(formatRupee(12500000)).toBe('₹1,25,000');
    expect(formatRupee(100000000)).toBe('₹10,00,000');
    expect(formatRupee(10050)).toBe('₹100.50');
    expect(formatRupee(-50000)).toBe('-₹500');
    expect(formatRupee(50000, { showSign: true })).toBe('+₹500');
  });

  test('formatRupeeCompact formats large sums cleanly', () => {
    expect(formatRupeeCompact(12500000)).toBe('₹1.25 L');
    expect(formatRupeeCompact(100000000)).toBe('₹10 L');
    expect(formatRupeeCompact(1500000000)).toBe('₹1.50 Cr');
  });

  test('parseRupeeToMinor handles rupees and paise without floating point inaccuracy', () => {
    expect(parseRupeeToMinor('₹100.50')).toBe(10050);
    expect(parseRupeeToMinor('1,25,000')).toBe(12500000);
    expect(parseRupeeToMinor('500')).toBe(50000);
    expect(parseRupeeToMinor('0.25')).toBe(25);
  });

  test('addMinor and subMinor avoid JS floating-point issues (0.1 + 0.2 problem)', () => {
    const item1 = 10; // 10 paise
    const item2 = 20; // 20 paise
    expect(addMinor(item1, item2)).toBe(30);

    const a = rupeeToMinor(100.10);
    const b = rupeeToMinor(50.05);
    expect(subMinor(a, b)).toBe(5005);
    expect(minorToRupee(5005)).toBe(50.05);
  });

  test('getRupeeDigitCount and getMaskedDots match exact rupee digits', () => {
    // 0 rupee -> 1 digit -> 1 dot
    expect(getRupeeDigitCount(0)).toBe(1);
    expect(getMaskedDots(0)).toBe('•');

    // 2-digit amounts (₹10 to ₹99) -> 2 dots
    expect(getRupeeDigitCount(1000)).toBe(2); // ₹10
    expect(getMaskedDots(1000)).toBe('••');
    expect(getRupeeDigitCount(5000)).toBe(2); // ₹50
    expect(getMaskedDots(5000)).toBe('••');
    expect(getRupeeDigitCount(9900)).toBe(2); // ₹99
    expect(getMaskedDots(9900)).toBe('••');

    // 3-digit amounts (₹100 to ₹999) -> 3 dots
    expect(getRupeeDigitCount(50000)).toBe(3); // ₹500
    expect(getMaskedDots(50000)).toBe('•••');

    // 4-digit amounts (₹1,000 to ₹9,999) -> 4 dots
    expect(getRupeeDigitCount(200000)).toBe(4); // ₹2,000
    expect(getMaskedDots(200000)).toBe('••••');
    expect(getRupeeDigitCount(300000)).toBe(4); // ₹3,000
    expect(getMaskedDots(300000)).toBe('••••');
    expect(getRupeeDigitCount(700000)).toBe(4); // ₹7,000
    expect(getMaskedDots(700000)).toBe('••••');

    // 5-digit amounts (₹10,000+) -> 5 dots
    expect(getRupeeDigitCount(1000000)).toBe(5); // ₹10,000
    expect(getMaskedDots(1000000)).toBe('•••••');
  });

  test('formatRupeeMasked produces correctly formatted privacy strings', () => {
    // ₹7,000 (4 digits) -> "₹ ••••"
    expect(formatRupeeMasked(700000)).toBe('₹ ••••');
    // ₹50 (2 digits) -> "₹ ••"
    expect(formatRupeeMasked(5000)).toBe('₹ ••');
    // ₹0 (1 digit) -> "₹ •"
    expect(formatRupeeMasked(0)).toBe('₹ •');

    // Options: without space
    expect(formatRupeeMasked(700000, { spaceAfterSymbol: false })).toBe('₹••••');
    expect(formatRupeeMasked(0, { spaceAfterSymbol: false })).toBe('₹•');

    // Options: showSign
    expect(formatRupeeMasked(0, { showSign: true, spaceAfterSymbol: false })).toBe('+₹•');
    expect(formatRupeeMasked(200000, { showSign: true, spaceAfterSymbol: false })).toBe('+₹••••');
    expect(formatRupeeMasked(-50000, { spaceAfterSymbol: false })).toBe('-₹•••');

    // Options: no symbol
    expect(formatRupeeMasked(5000, { symbol: '' })).toBe('••');
  });
});
