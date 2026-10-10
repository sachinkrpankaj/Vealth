import {
  cleanCardNumber,
  validateLuhn,
  detectPaymentNetwork,
  formatCardNumberInput,
  formatMaskedCardNumber,
  parseExpiryString,
  formatExpiryString,
  isCardExpired,
  validateCardDetails,
} from '../../src/domain/cards/cardValidation';
import { Account } from '../../src/domain/finance/types';

describe('Card Wallet — Validation & Formatting Unit Tests', () => {
  describe('Luhn Algorithm and Number Cleaning', () => {
    it('cleans non-digit characters correctly', () => {
      expect(cleanCardNumber('4532-0150 9821 1234')).toBe('4532015098211234');
      expect(cleanCardNumber('  ')).toBe('');
      expect(cleanCardNumber('abc')).toBe('');
    });

    it('validates genuine card numbers using Luhn checksum', () => {
      // Standard valid test card numbers (well-known Luhn compliant test vectors)
      expect(validateLuhn('4532015012345671')).toBe(true);
      expect(validateLuhn('49927398716')).toBe(true);
      expect(validateLuhn('79927398713')).toBe(true);

      // Invalid card numbers
      expect(validateLuhn('4532015012345675')).toBe(false);
      expect(validateLuhn('79927398714')).toBe(false);
      expect(validateLuhn('123')).toBe(false); // Too short
    });
  });

  describe('Payment Network Auto-Detection', () => {
    it('detects Visa cards starting with 4', () => {
      expect(detectPaymentNetwork('4532015012345671')).toBe('VISA');
    });

    it('detects Mastercard cards (51-55 and 2221-2720)', () => {
      expect(detectPaymentNetwork('5100000000000000')).toBe('MASTERCARD');
      expect(detectPaymentNetwork('5500000000000000')).toBe('MASTERCARD');
      expect(detectPaymentNetwork('2221000000000000')).toBe('MASTERCARD');
    });

    it('detects RuPay cards', () => {
      expect(detectPaymentNetwork('6080000000000000')).toBe('RUPAY');
      expect(detectPaymentNetwork('6521000000000000')).toBe('RUPAY');
      expect(detectPaymentNetwork('8100000000000000')).toBe('RUPAY');
      expect(detectPaymentNetwork('5080000000000000')).toBe('RUPAY');
    });

    it('detects American Express cards (34, 37)', () => {
      expect(detectPaymentNetwork('340000000000000')).toBe('AMEX');
      expect(detectPaymentNetwork('370000000000000')).toBe('AMEX');
    });

    it('detects Discover cards', () => {
      expect(detectPaymentNetwork('6011000000000000')).toBe('DISCOVER');
      expect(detectPaymentNetwork('6500000000000000')).toBe('DISCOVER');
    });

    it('detects Diners Club cards', () => {
      expect(detectPaymentNetwork('30000000000000')).toBe('DINERS');
      expect(detectPaymentNetwork('36000000000000')).toBe('DINERS');
    });

    it('detects JCB cards', () => {
      expect(detectPaymentNetwork('3528000000000000')).toBe('JCB');
    });

    it('falls back to OTHER for unrecognized prefixes', () => {
      expect(detectPaymentNetwork('9999000000000000')).toBe('OTHER');
    });
  });

  describe('Card Number Formatting & Masking', () => {
    it('formats 16-digit cards into 4-digit groups', () => {
      expect(formatCardNumberInput('4532015098211234', 'VISA')).toBe('4532 0150 9821 1234');
    });

    it('formats Amex cards into 4-6-5 groups', () => {
      expect(formatCardNumberInput('378282246310005', 'AMEX')).toBe('3782 822463 10005');
    });

    it('formats masked card number showing only last 4 digits', () => {
      expect(formatMaskedCardNumber('1234', 'VISA')).toBe('•••• •••• •••• 1234');
      expect(formatMaskedCardNumber('1005', 'AMEX')).toBe('•••• •••••• •1005');
    });
  });

  describe('Expiry Date Handling', () => {
    it('parses various MM/YY inputs accurately', () => {
      expect(parseExpiryString('08/28')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('1229')).toEqual({ month: 12, year: 2029 });
      expect(parseExpiryString('526')).toEqual({ month: 5, year: 2026 });
      expect(parseExpiryString('invalid')).toBeNull();
      expect(parseExpiryString('14/28')).toBeNull(); // Month > 12
    });

    it('formats expiry date to MM/YY', () => {
      expect(formatExpiryString(8, 2028)).toBe('08/28');
      expect(formatExpiryString(11, 2030)).toBe('11/30');
    });

    it('detects expired cards accurately', () => {
      const refDate = new Date(2026, 9, 1); // Oct 2026
      expect(isCardExpired(5, 2024, refDate)).toBe(true); // Past year
      expect(isCardExpired(8, 2026, refDate)).toBe(true); // Past month in current year
      expect(isCardExpired(10, 2026, refDate)).toBe(false); // Current month is valid
      expect(isCardExpired(12, 2028, refDate)).toBe(false); // Future year
    });
  });

  describe('Account Linking and Form Constraints', () => {
    const bankAccount: Account = {
      id: 'acc-bank-1',
      name: 'HDFC Savings',
      type: 'BANK',
      openingBalance: 5000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const ccAccount: Account = {
      id: 'acc-cc-1',
      name: 'HDFC Regalia CC',
      type: 'CREDIT_CARD',
      openingBalance: 0,
      creditLimit: 50000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('requires a Bank account link for Debit cards', () => {
      const resWithoutAccount = validateCardDetails({
        cardholderName: 'John Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'DEBIT',
        linkedAccount: null,
      });
      expect(resWithoutAccount.isValid).toBe(false);
      expect(resWithoutAccount.errors.linkedAccountId).toMatch(/must be linked to a Bank account/i);

      const resWithWrongType = validateCardDetails({
        cardholderName: 'John Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'DEBIT',
        linkedAccount: ccAccount,
      });
      expect(resWithWrongType.isValid).toBe(false);
      expect(resWithWrongType.errors.linkedAccountId).toMatch(/only be linked to Bank accounts/i);

      const resValid = validateCardDetails({
        cardholderName: 'John Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'DEBIT',
        linkedAccount: bankAccount,
      });
      expect(resValid.isValid).toBe(true);
    });

    it('allows Credit cards to be unlinked, but rejects non-credit accounts', () => {
      const resUnlinked = validateCardDetails({
        cardholderName: 'Jane Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'CREDIT',
        linkedAccount: null,
      });
      expect(resUnlinked.isValid).toBe(true);

      const resWithBank = validateCardDetails({
        cardholderName: 'Jane Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'CREDIT',
        linkedAccount: bankAccount,
      });
      expect(resWithBank.isValid).toBe(false);
      expect(resWithBank.errors.linkedAccountId).toMatch(/only be linked to Credit Card accounts/i);
    });

    it('enforces required bank / issuer when adding credit card with requireIssuer flag', () => {
      const resWithoutIssuer = validateCardDetails({
        cardholderName: 'Jane Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'CREDIT',
        requireIssuer: true,
      });
      expect(resWithoutIssuer.isValid).toBe(false);
      expect(resWithoutIssuer.errors.issuer).toMatch(/bank \/ card issuer is required/i);

      const resWithIssuer = validateCardDetails({
        cardholderName: 'Jane Doe',
        cardNumber: '4532015012345671',
        expiryMonth: 12,
        expiryYear: 2029,
        cardType: 'CREDIT',
        issuer: 'HDFC Bank',
        requireIssuer: true,
      });
      expect(resWithIssuer.isValid).toBe(true);
      expect(resWithIssuer.errors.issuer).toBeUndefined();
    });
  });
});
