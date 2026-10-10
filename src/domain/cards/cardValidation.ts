import { PaymentNetwork } from '../../components/cards/PaymentNetworkLogo';
import { CardType } from './types';
import { Account } from '../finance/types';

/**
 * Removes spaces, hyphens, and any non-digit characters.
 */
export function cleanCardNumber(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Validates a number string using the Luhn Algorithm (Mod 10 check).
 */
export function validateLuhn(digits: string): boolean {
  const clean = cleanCardNumber(digits);
  if (clean.length < 11 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Automatically detects the payment network based on IIN / BIN prefixes.
 */
export function detectPaymentNetwork(digits: string): PaymentNetwork {
  const clean = cleanCardNumber(digits);
  if (!clean) return 'OTHER';

  // Discover 6011 specific prefix before RuPay 60
  if (clean.startsWith('6011')) {
    return 'DISCOVER';
  }

  // RuPay checks (60, 6521, 6522, 81, 82, 508, 353, 356)
  if (
    clean.startsWith('60') ||
    clean.startsWith('6521') ||
    clean.startsWith('6522') ||
    clean.startsWith('81') ||
    clean.startsWith('82') ||
    clean.startsWith('508')
  ) {
    return 'RUPAY';
  }

  // American Express (34, 37)
  if (clean.startsWith('34') || clean.startsWith('37')) {
    return 'AMEX';
  }

  // Visa (starts with 4)
  if (clean.startsWith('4')) {
    return 'VISA';
  }

  // Mastercard (51-55, 2221-2720)
  const prefix2 = parseInt(clean.substring(0, 2), 10);
  const prefix4 = parseInt(clean.substring(0, 4), 10);
  if ((prefix2 >= 51 && prefix2 <= 55) || (prefix4 >= 2221 && prefix4 <= 2720)) {
    return 'MASTERCARD';
  }

  // Diners Club (300-305, 36, 38)
  const prefix3 = parseInt(clean.substring(0, 3), 10);
  if ((prefix3 >= 300 && prefix3 <= 305) || prefix2 === 36 || prefix2 === 38) {
    return 'DINERS';
  }

  // JCB (3528-3589)
  if (prefix4 >= 3528 && prefix4 <= 3589) {
    return 'JCB';
  }

  // Discover (6011, 644-649, 65)
  if (clean.startsWith('6011') || clean.startsWith('65') || (prefix3 >= 644 && prefix3 <= 649)) {
    return 'DISCOVER';
  }

  return 'OTHER';
}

/**
 * Formats a card number with spaces for intuitive input display.
 * Amex: 4-6-5 format. Others: 4-4-4-4 format.
 */
export function formatCardNumberInput(digits: string, network?: PaymentNetwork): string {
  const clean = cleanCardNumber(digits);
  const net = network ?? detectPaymentNetwork(clean);

  if (net === 'AMEX') {
    // 4 - 6 - 5
    const p1 = clean.substring(0, 4);
    const p2 = clean.substring(4, 10);
    const p3 = clean.substring(10, 15);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }

  // Standard 4-digit blocks
  const parts: string[] = [];
  for (let i = 0; i < clean.length && i < 19; i += 4) {
    parts.push(clean.substring(i, i + 4));
  }
  return parts.join(' ');
}

/**
 * Returns a masked card number showing only the last 4 digits.
 */
export function formatMaskedCardNumber(lastFour: string, network?: PaymentNetwork): string {
  const safeFour = (lastFour || '').replace(/\D/g, '').padStart(4, '•');
  if (network === 'AMEX') {
    return `•••• •••••• •${safeFour}`;
  }
  return `•••• •••• •••• ${safeFour}`;
}

/**
 * Formats expiry month and 4-digit year into MM/YY string.
 */
export function formatExpiryString(month: number, year: number): string {
  const m = String(month).padStart(2, '0');
  const y = String(year).slice(-2);
  return `${m}/${y}`;
}

/**
 * Parses user input for expiry date (e.g. "08/28", "8/2028", "0828").
 */
export function parseExpiryString(input: string): { month: number; year: number } | null {
  if (!input) return null;
  const clean = input.replace(/\D/g, '');
  if (clean.length < 3 || clean.length > 6) return null;

  let month = 0;
  let year = 0;

  if (clean.length === 3) {
    // e.g. 828 -> 08/28
    month = parseInt(clean.substring(0, 1), 10);
    year = 2000 + parseInt(clean.substring(1, 3), 10);
  } else if (clean.length === 4) {
    // e.g. 0828 -> 08/28
    month = parseInt(clean.substring(0, 2), 10);
    year = 2000 + parseInt(clean.substring(2, 4), 10);
  } else if (clean.length === 6) {
    // e.g. 082028
    month = parseInt(clean.substring(0, 2), 10);
    year = parseInt(clean.substring(2, 6), 10);
  }

  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;

  return { month, year };
}

/**
 * Checks if the card has already expired based on current year/month.
 */
export function isCardExpired(month: number, year: number, referenceDate = new Date()): boolean {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1; // 1-indexed

  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  return false;
}

export interface CardValidationResult {
  isValid: boolean;
  errors: {
    cardholderName?: string;
    cardNumber?: string;
    expiry?: string;
    issuer?: string;
    linkedAccountId?: string;
    general?: string;
  };
}

/**
 * Validates card parameters and account linking constraints.
 */
export function validateCardDetails(params: {
  cardholderName: string;
  cardNumber?: string;
  expiryMonth: number;
  expiryYear: number;
  cardType: CardType;
  issuer?: string;
  requireIssuer?: boolean;
  linkedAccount?: Account | null;
  isEditing?: boolean;
}): CardValidationResult {
  const errors: CardValidationResult['errors'] = {};

  // 1. Cardholder name validation
  if (!params.cardholderName || !params.cardholderName.trim()) {
    errors.cardholderName = 'Cardholder name is required.';
  } else if (params.cardholderName.trim().length > 70) {
    errors.cardholderName = 'Cardholder name cannot exceed 70 characters.';
  }

  // 2. Card number validation (mandatory for new cards; optional on edit if keeping existing)
  if (params.cardNumber !== undefined) {
    const cleanNum = cleanCardNumber(params.cardNumber);
    if (!cleanNum) {
      errors.cardNumber = 'Card number is required.';
    } else if (cleanNum.length < 13 || cleanNum.length > 19) {
      errors.cardNumber = 'Card number must be between 13 and 19 digits.';
    } else if (!validateLuhn(cleanNum)) {
      errors.cardNumber = 'Card number is invalid (failed Luhn checksum).';
    }
  } else if (!params.isEditing) {
    errors.cardNumber = 'Card number is required.';
  }

  // 3. Expiry date validation
  if (
    !params.expiryMonth ||
    params.expiryMonth < 1 ||
    params.expiryMonth > 12 ||
    !params.expiryYear ||
    params.expiryYear < 2000 ||
    params.expiryYear > 2100
  ) {
    errors.expiry = 'Please provide a valid expiry date (MM/YY).';
  } else if (isCardExpired(params.expiryMonth, params.expiryYear)) {
    // Provide a warning or error for expired cards
    errors.expiry = 'Card is already expired.';
  }

  // 4. Linked Account validation
  if (params.cardType === 'DEBIT') {
    if (!params.linkedAccount) {
      errors.linkedAccountId = 'Debit cards must be linked to a Bank account.';
    } else if (params.linkedAccount.type !== 'BANK') {
      errors.linkedAccountId = 'Debit cards can only be linked to Bank accounts.';
    }
  } else if (params.cardType === 'CREDIT') {
    if (params.linkedAccount && params.linkedAccount.type !== 'CREDIT_CARD') {
      errors.linkedAccountId = 'Credit cards can only be linked to Credit Card accounts.';
    }
  }

  // 5. Bank / Card Issuer validation (required for Credit Cards when adding)
  if (params.cardType === 'CREDIT') {
    if (params.requireIssuer && (!params.issuer || !params.issuer.trim())) {
      errors.issuer = 'Bank / Card Issuer is required for credit cards.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
