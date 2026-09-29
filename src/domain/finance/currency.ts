/**
 * Currency utilities for Vaelth.
 * All monetary values are handled as integer minor units (paise).
 * 1 Rupee (₹) = 100 paise.
 * JavaScript floating-point arithmetic is never used directly for financial balance math.
 */

/**
 * Formats a major integer into Indian numbering format:
 * e.g., 500 -> "500", 2500 -> "2,500", 125000 -> "1,25,000", 1000000 -> "10,00,000"
 */
export function formatIndianNumber(num: number): string {
  const isNegative = num < 0;
  const absNum = Math.abs(Math.floor(num));
  const str = absNum.toString();

  if (str.length <= 3) {
    return (isNegative ? '-' : '') + str;
  }

  const lastThree = str.slice(-3);
  const remaining = str.slice(0, -3);
  const formattedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return (isNegative ? '-' : '') + formattedRemaining + ',' + lastThree;
}

export interface FormatRupeeOptions {
  showPaise?: boolean; // force show .00 or not (default: show if non-zero)
  showSign?: boolean;  // explicitly show '+' for positive amounts
  symbol?: string;     // default: '₹'
  spaceAfterSymbol?: boolean; // whether to put a space after symbol
}

/**
 * Formats minor units (paise) to Indian Rupee representation.
 * Example:
 * 10050 -> "₹100.50"
 * 12850000 -> "₹1,28,500"
 * -50000 -> "-₹500"
 */
export function formatRupee(minorUnits: number, options?: FormatRupeeOptions): string {
  const symbol = options?.symbol ?? '₹';
  const showSign = options?.showSign ?? false;
  const showPaise = options?.showPaise;
  const space = options?.spaceAfterSymbol && symbol ? ' ' : '';

  const isNegative = minorUnits < 0;
  const absMinor = Math.abs(Math.round(minorUnits));
  const rupees = Math.floor(absMinor / 100);
  const paise = absMinor % 100;

  let formatted = formatIndianNumber(rupees);

  if (showPaise === true || (showPaise === undefined && paise > 0)) {
    formatted += '.' + paise.toString().padStart(2, '0');
  }

  if (isNegative) {
    return `-${symbol}${space}${formatted}`;
  } else if (showSign && minorUnits > 0) {
    return `+${symbol}${space}${formatted}`;
  } else {
    return `${symbol}${space}${formatted}`;
  }
}

/**
 * Compact Indian format for large sums:
 * e.g., ₹1.25 L, ₹10 L, ₹1.5 Cr
 */
export function formatRupeeCompact(minorUnits: number): string {
  const isNegative = minorUnits < 0;
  const absRupees = Math.abs(Math.round(minorUnits)) / 100;

  let formatted = '';
  if (absRupees >= 10000000) {
    const cr = absRupees / 10000000;
    formatted = (cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)) + ' Cr';
  } else if (absRupees >= 100000) {
    const lakh = absRupees / 100000;
    formatted = (lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(2)) + ' L';
  } else if (absRupees >= 1000) {
    const k = absRupees / 1000;
    formatted = (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  } else {
    return formatRupee(minorUnits);
  }

  return (isNegative ? '-₹' : '₹') + formatted;
}

/**
 * Returns the exact count of whole rupee digits in a minorUnits (paise) amount.
 * E.g.:
 * 0 paise (₹0) -> 1 digit
 * 5000 paise (₹50) -> 2 digits
 * 50000 paise (₹500) -> 3 digits
 * 200000 paise (₹2,000) -> 4 digits
 * 700000 paise (₹7,000) -> 4 digits
 * 1000000 paise (₹10,000) -> 5 digits
 */
export function getRupeeDigitCount(minorUnits: number): number {
  const absMinor = Math.abs(Math.round(minorUnits));
  const rupees = Math.floor(absMinor / 100);
  return Math.max(1, rupees.toString().length);
}

/**
 * Returns privacy masking dots whose count strictly matches the number of digits
 * in the rupee amount (e.g., 2-digit amount -> "••", 4-digit amount -> "••••").
 */
export function getMaskedDots(minorUnits: number): string {
  const count = getRupeeDigitCount(minorUnits);
  return '•'.repeat(count);
}

export interface FormatRupeeMaskedOptions {
  symbol?: string; // default: '₹'
  showSign?: boolean; // default: false
  spaceAfterSymbol?: boolean; // default: true
}

/**
 * Formats a minorUnits (paise) amount into a masked privacy string
 * with exact digit-matching dots.
 * E.g.:
 * ₹7,000 (4 digits) -> "₹ ••••"
 * ₹50 (2 digits) -> "₹ ••"
 * ₹0 (1 digit) -> "₹ •"
 */
export function formatRupeeMasked(
  minorUnits: number,
  options?: FormatRupeeMaskedOptions
): string {
  const symbol = options?.symbol !== undefined ? options.symbol : '₹';
  const showSign = options?.showSign ?? false;
  const space = options?.spaceAfterSymbol !== false && symbol ? ' ' : '';

  const isNegative = minorUnits < 0;
  const dots = getMaskedDots(minorUnits);

  let prefix = '';
  if (isNegative) {
    prefix = '-';
  } else if (showSign && minorUnits >= 0) {
    prefix = '+';
  }

  if (symbol) {
    return `${prefix}${symbol}${space}${dots}`;
  }
  return `${prefix}${dots}`;
}

/**
 * Parses user input string (e.g. "₹1,25,000.50", "125000", "500.25") into integer paise.
 * Throws or returns 0 on invalid input.
 */
export function parseRupeeToMinor(input: string): number {
  if (!input) return 0;
  // Remove currency symbol, commas, spaces
  const cleaned = input.replace(/[₹,$\s]/g, '').trim();
  if (!cleaned) return 0;

  const parts = cleaned.split('.');
  const rupeePart = parseInt(parts[0], 10) || 0;
  let paisePart = 0;

  if (parts.length > 1) {
    const paiseStr = (parts[1] + '00').slice(0, 2);
    paisePart = parseInt(paiseStr, 10) || 0;
  }

  const sign = cleaned.startsWith('-') ? -1 : 1;
  const absRupees = Math.abs(rupeePart);
  return sign * (absRupees * 100 + paisePart);
}

/**
 * Safe minor-unit arithmetic operations
 */
export function addMinor(...amounts: number[]): number {
  return amounts.reduce((acc, curr) => Math.round(acc) + Math.round(curr), 0);
}

export function subMinor(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export function rupeeToMinor(rupees: number): number {
  return Math.round(rupees * 100);
}

export function minorToRupee(minor: number): number {
  return minor / 100;
}
