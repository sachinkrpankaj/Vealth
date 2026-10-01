import {
  hashPin,
  hashPinLegacy,
  generateRandomSaltHex,
  pbkdf2HmacSha256,
  useSecurityStore,
} from '../../src/stores/useSecurityStore';
import {
  Account,
  Asset,
  Category,
  Liability,
  Person,
  Transaction,
} from '../../src/domain/finance/types';
import {
  calculateNetWorth,
  calculateAccountBalance,
} from '../../src/domain/finance/financialEngine';
import {
  getCreditCardBillingInfo,
} from '../../src/domain/finance/creditCardBilling';
import { repairMisclassifiedCreditCards } from '../../src/database/repositories/accountRepository';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../../src/database/repositories/transactionRepository';
import { openDatabaseAsync } from 'expo-sqlite';

const open = openDatabaseAsync as jest.Mock;

describe('Remaining Audit Fixes Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. PIN CRYPTOGRAPHY — REMOVE INSECURE FALLBACKS
  // =========================================================================
  describe('1. PIN Cryptography & Fail-Closed Behavior', () => {
    it('produces unique random salts for modern PIN hashes', async () => {
      const hash1 = await hashPin('1234');
      const hash2 = await hashPin('1234');

      expect(hash1.startsWith('pbkdf2:v1:')).toBe(true);
      expect(hash2.startsWith('pbkdf2:v1:')).toBe(true);

      const parts1 = hash1.split(':');
      const parts2 = hash2.split(':');

      // Salt must be a 32-character hex string (16 bytes)
      expect(parts1[2].length).toBe(32);
      expect(parts2[2].length).toBe(32);
      // Modern PIN hashes with the same PIN must have distinct unique salts
      expect(parts1[2]).not.toBe(parts2[2]);
      expect(hash1).not.toBe(hash2);
    });

    it('fails closed when no cryptographically secure random source is available', () => {
      const originalCrypto = globalThis.crypto;
      try {
        // Temporarily nullify CSPR sources
        Object.defineProperty(globalThis, 'crypto', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        expect(() => generateRandomSaltHex(16)).toThrow(
          /Cryptographically secure random number generator is unavailable/i
        );
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true,
        });
      }
    });

    it('pure JS standard PBKDF2 matches RFC 8018 vector exactly', () => {
      // Test vector with password 'password', salt 'salt', 1 iteration
      const passwordBytes = new TextEncoder().encode('password');
      const saltBytes = new TextEncoder().encode('salt');
      const derived = pbkdf2HmacSha256(passwordBytes, saltBytes, 1);
      // Standard RFC 6070 PBKDF2 HMAC-SHA256 test vector 1:
      expect(derived).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
    });

    it('migrates legacy static hashes to modern PBKDF2 on successful verification', async () => {
      const SecureStore = require('expo-secure-store');
      const legacyHash = await hashPinLegacy('9876');
      await SecureStore.setItemAsync('vaelth_security_pin_hash', legacyHash);

      const store = useSecurityStore.getState();
      const verified = await store.verifyPin('9876');
      expect(verified).toBe(true);

      const storedHash = await SecureStore.getItemAsync('vaelth_security_pin_hash');
      expect(storedHash?.startsWith('pbkdf2:v1:')).toBe(true);
      expect(storedHash).not.toBe(legacyHash);

      // Verify again with the new modern hash
      const verifiedAgain = await store.verifyPin('9876');
      expect(verifiedAgain).toBe(true);
    });

    it('PIN setup fails safely without saving if secure random generation fails', async () => {
      const originalCrypto = globalThis.crypto;
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync('vaelth_security_pin_hash');

      try {
        Object.defineProperty(globalThis, 'crypto', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        const store = useSecurityStore.getState();
        await expect(store.setPin('1234')).rejects.toThrow();

        // Must not have set any insecure PIN in store
        const saved = await SecureStore.getItemAsync('vaelth_security_pin_hash');
        expect(saved).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  // =========================================================================
  // 2. CREDIT CARD BILL PAYMENT — FINANCIAL SAFETY
  // =========================================================================
  describe('2. Credit Card Bill Payment Financial Safety', () => {
    const bankAccount: Account = {
      id: 'acc-bank',
      name: 'HDFC Savings',
      type: 'BANK',
      openingBalance: 5000000, // ₹50,000 (5000000 paise)
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const otherAccount: Account = {
      id: 'acc-other',
      name: 'Salary Wallet',
      type: 'OTHER',
      openingBalance: 2000000, // ₹20,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const cashAccount: Account = {
      id: 'acc-cash',
      name: 'Cash Pocket',
      type: 'CASH',
      openingBalance: 1000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const secondCreditCard: Account = {
      id: 'acc-cc-2',
      name: 'Axis Bank Credit Card',
      type: 'CREDIT_CARD',
      openingBalance: 0,
      creditLimit: 10000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const investmentAccount: Account = {
      id: 'acc-inv',
      name: 'Zerodha Equity',
      type: 'INVESTMENT',
      openingBalance: 10000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const targetCreditCard: Account = {
      id: 'acc-cc-target',
      name: 'ICICI Coral Credit Card',
      type: 'CREDIT_CARD',
      openingBalance: 0,
      creditLimit: 10000000, // ₹1,00,000 limit
      billingDay: 15,
      dueDay: 5,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('strictly excludes CASH, CREDIT_CARD, INVESTMENT, and the target card from eligible payment accounts', () => {
      const allAccounts = [
        bankAccount,
        otherAccount,
        cashAccount,
        secondCreditCard,
        investmentAccount,
        targetCreditCard,
      ];

      const eligibleAccounts = allAccounts.filter(
        (a) =>
          a.type !== 'CASH' &&
          a.type !== 'CREDIT_CARD' &&
          a.type !== 'INVESTMENT' &&
          a.id !== targetCreditCard.id &&
          !a.isArchived
      );

      expect(eligibleAccounts.length).toBe(2);
      expect(eligibleAccounts.map((a) => a.id).sort()).toEqual(['acc-bank', 'acc-other']);
      expect(eligibleAccounts.some((a) => a.type === 'CASH')).toBe(false);
      expect(eligibleAccounts.some((a) => a.type === 'CREDIT_CARD')).toBe(false);
      expect(eligibleAccounts.some((a) => a.type === 'INVESTMENT')).toBe(false);
      expect(eligibleAccounts.some((a) => a.id === targetCreditCard.id)).toBe(false);
    });

    it('bill payment via TRANSFER preserves Net Worth exactly (0 change in income, expense, or net worth)', () => {
      const cardExpense: Transaction = {
        id: 'tx-cc-exp',
        type: 'EXPENSE',
        amount: 2500000, // ₹25,000 spend on credit card
        date: '2026-09-10',
        accountId: targetCreditCard.id,
        createdAt: '2026-09-10',
        updatedAt: '2026-09-10',
      };

      const prePaymentNetWorth = calculateNetWorth({
        accounts: [bankAccount, targetCreditCard],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [cardExpense],
        referenceDate: new Date('2026-09-20'),
      });

      // Net worth before bill payment = Bank (₹50,000) - Card Liability (₹25,000) = ₹25,000
      expect(prePaymentNetWorth.netWorth).toBe(2500000);
      expect(prePaymentNetWorth.totalLiabilities).toBe(2500000);

      // Now record bill payment via TRANSFER from bank to card
      const billPaymentTx: Transaction = {
        id: 'tx-bill-pay',
        type: 'TRANSFER',
        amount: 2500000, // ₹25,000
        date: '2026-09-25',
        accountId: bankAccount.id,
        destinationAccountId: targetCreditCard.id,
        createdAt: '2026-09-25',
        updatedAt: '2026-09-25',
      };

      const allTx = [cardExpense, billPaymentTx];

      const postPaymentNetWorth = calculateNetWorth({
        accounts: [bankAccount, targetCreditCard],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: allTx,
        referenceDate: new Date('2026-09-26'),
      });

      // Bank balance reduced by 25,000; card liability reduced by 25,000
      // Net Worth remains EXACTLY ₹25,000 (change = 0)
      expect(postPaymentNetWorth.netWorth).toBe(2500000);
      expect(postPaymentNetWorth.totalLiabilities).toBe(0);
      expect(postPaymentNetWorth.totalAssets).toBe(2500000);

      // Card available credit restored and outstanding balance cleared exactly once
      const billingInfo = getCreditCardBillingInfo(
        targetCreditCard,
        allTx,
        new Date('2026-09-26')
      );
      expect(billingInfo.usedAmount).toBe(0);
      expect(billingInfo.remainingLimit).toBe(10000000);
      expect(billingInfo.unpaidBillAmount).toBe(0);
      expect(billingInfo.isBillActive).toBe(false);
    });

    it('supports partial payment and accurately divides billed vs unbilled spend', () => {
      // Billed expense before statement close (15th)
      const billedExpense: Transaction = {
        id: 'tx-billed',
        type: 'EXPENSE',
        amount: 2000000, // ₹20,000
        date: '2026-09-10',
        accountId: targetCreditCard.id,
        createdAt: '2026-09-10',
        updatedAt: '2026-09-10',
      };

      // Post-statement expense after statement close
      const postStatementExpense: Transaction = {
        id: 'tx-unbilled',
        type: 'EXPENSE',
        amount: 500000, // ₹5,000
        date: '2026-09-18',
        accountId: targetCreditCard.id,
        createdAt: '2026-09-18',
        updatedAt: '2026-09-18',
      };

      // Partial bill payment of ₹12,000 towards the ₹20,000 statement
      const partialPayment: Transaction = {
        id: 'tx-partial-pay',
        type: 'TRANSFER',
        amount: 1200000, // ₹12,000
        date: '2026-09-20',
        accountId: bankAccount.id,
        destinationAccountId: targetCreditCard.id,
        createdAt: '2026-09-20',
        updatedAt: '2026-09-20',
      };

      const allTx = [billedExpense, postStatementExpense, partialPayment];

      const billing = getCreditCardBillingInfo(
        targetCreditCard,
        allTx,
        new Date('2026-09-22')
      );

      // Total used = 20,000 + 5,000 - 12,000 = 13,000
      expect(billing.usedAmount).toBe(1300000);
      // Unpaid bill from statement = 20,000 - 12,000 = 8,000
      expect(billing.unpaidBillAmount).toBe(800000);
      // Unbilled spend = 5,000
      expect(billing.unbilledAmount).toBe(500000);
      expect(billing.isBillActive).toBe(true);
      expect(billing.remainingLimit).toBe(10000000 - 1300000);
    });
  });

  // =========================================================================
  // 3. CREDIT CARD BILLING MODEL & REFUND HANDLING
  // =========================================================================
  describe('3. Credit Card Billing Model & Refund Handling', () => {
    const creditCard: Account = {
      id: 'cc-test-1',
      name: 'Millennia Card',
      type: 'CREDIT_CARD',
      openingBalance: 0,
      creditLimit: 5000000, // ₹50,000
      billingDay: 20,
      dueDay: 5,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('ensures refunds/credits reduce card spend rather than creating artificial income', () => {
      const expenseTx: Transaction = {
        id: 'tx-card-exp',
        type: 'EXPENSE',
        amount: 1000000, // ₹10,000 spend
        date: '2026-10-05',
        accountId: creditCard.id,
        createdAt: '2026-10-05',
        updatedAt: '2026-10-05',
      };

      const refundTx: Transaction = {
        id: 'tx-card-refund',
        type: 'INCOME', // Merchant refund posted to card
        amount: 300000, // ₹3,000 refund
        date: '2026-10-10',
        accountId: creditCard.id,
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
      };

      const nw = calculateNetWorth({
        accounts: [creditCard],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [expenseTx, refundTx],
        currentMonthStr: '2026-10',
      });

      // Income must NOT be inflated to ₹3,000
      expect(nw.incomeMonth).toBe(0);
      // Expense must be offset: 10,000 - 3,000 = 7,000
      expect(nw.expenseMonth).toBe(700000);
      // Net liability on card is ₹7,000
      expect(nw.totalLiabilities).toBe(700000);
      expect(nw.netWorth).toBe(-700000);
    });

    it('allocates post-statement refunds to reduce unpaid statement debt', () => {
      // Statement generated on 2026-09-20 for ₹10,000
      const statementExpense: Transaction = {
        id: 'tx-stmt-exp',
        type: 'EXPENSE',
        amount: 1000000, // ₹10,000
        date: '2026-09-15',
        accountId: creditCard.id,
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
      };

      // Refund received after statement date on 2026-09-22
      const refundTx: Transaction = {
        id: 'tx-stmt-refund',
        type: 'INCOME',
        amount: 400000, // ₹4,000
        date: '2026-09-22',
        accountId: creditCard.id,
        createdAt: '2026-09-22',
        updatedAt: '2026-09-22',
      };

      const billing = getCreditCardBillingInfo(
        creditCard,
        [statementExpense, refundTx],
        new Date('2026-09-25')
      );

      // Refund of ₹4,000 directly reduces unpaid statement bill from 10,000 to 6,000
      expect(billing.usedAmount).toBe(600000);
      expect(billing.unpaidBillAmount).toBe(600000);
      expect(billing.unbilledAmount).toBe(0);
    });

    it('correctly handles multi-cycle billing rollover without double counting', () => {
      // Cycle 1: Aug 20 to Sep 20
      const cycle1Expense: Transaction = {
        id: 'tx-cycle-1',
        type: 'EXPENSE',
        amount: 800000, // ₹8,000
        date: '2026-08-25',
        accountId: creditCard.id,
        createdAt: '2026-08-25',
        updatedAt: '2026-08-25',
      };

      // Fully paid on Sep 1
      const cycle1Pay: Transaction = {
        id: 'tx-cycle-1-pay',
        type: 'TRANSFER',
        amount: 800000,
        date: '2026-09-01',
        destinationAccountId: creditCard.id,
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      };

      // Cycle 2: Sep 20 to Oct 20
      const cycle2Expense: Transaction = {
        id: 'tx-cycle-2',
        type: 'EXPENSE',
        amount: 500000, // ₹5,000
        date: '2026-09-25',
        accountId: creditCard.id,
        createdAt: '2026-09-25',
        updatedAt: '2026-09-25',
      };

      const allTx = [cycle1Expense, cycle1Pay, cycle2Expense];

      // Checked on Oct 5 (after Sep 20 close, but before Oct 20 close: expense on Sep 25 is unbilled)
      const billingOct5 = getCreditCardBillingInfo(
        creditCard,
        allTx,
        new Date('2026-10-05')
      );
      expect(billingOct5.usedAmount).toBe(500000);
      expect(billingOct5.unpaidBillAmount).toBe(0);
      expect(billingOct5.unbilledAmount).toBe(500000);

      // Checked on Oct 22 (after Oct 20 close: expense on Sep 25 is now billed)
      const billingOct22 = getCreditCardBillingInfo(
        creditCard,
        allTx,
        new Date('2026-10-22')
      );
      expect(billingOct22.usedAmount).toBe(500000);
      expect(billingOct22.unpaidBillAmount).toBe(500000);
      expect(billingOct22.unbilledAmount).toBe(0);
    });
  });

  // =========================================================================
  // 4. MISCLASSIFIED CREDIT CARD REPAIR SAFETY
  // =========================================================================
  describe('4. Misclassified Credit Card Repair Safety', () => {
    it('does NOT mutate a BANK account whose name contains "Credit Card"', async () => {
      const bankAccount: Account = {
        id: 'acc-bank-cc-name',
        name: 'HDFC Credit Card Auto-Debit Account',
        type: 'BANK',
        openingBalance: 1000000,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      // Run repair function
      await repairMisclassifiedCreditCards();

      // Account must retain its exact type without mutation
      expect(bankAccount.type).toBe('BANK');
      expect(bankAccount.type).not.toBe('CREDIT_CARD');
    });
  });

  // =========================================================================
  // 5. DATA / TRANSACTION SAFETY & ATOMIC REVERSALS
  // =========================================================================
  describe('5. Data & Transaction Safety (Reversal & Restoration)', () => {
    let db: any;
    let scoped: any;

    beforeEach(() => {
      scoped = {
        getFirstAsync: jest.fn(),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      };
      db = {
        execAsync: jest.fn(),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
        getAllAsync: jest.fn(async () => []),
        withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
        withExclusiveTransactionAsync: jest.fn(async (fn: any) => fn(scoped)),
      };
      open.mockResolvedValue(db);
    });

    it('full asset sale -> delete -> restores original book value and unarchives asset', async () => {
      // Original asset was ₹50,000, sold for ₹50,000 (remaining value 0, archived = 1)
      const metadata = JSON.stringify({
        assetBookValueBefore: 5000000,
        assetArchivedBefore: false,
        assetValueDeducted: 5000000,
        bookValueSold: 5000000,
      });

      scoped.getFirstAsync
        .mockResolvedValueOnce({
          id: 'tx-sale-full',
          type: 'ASSET_SALE',
          amount: 5000000,
          assetId: 'asset-gold',
          metadata,
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          currentValue: 0,
          isArchived: 1,
        });

      await deleteTransaction('tx-sale-full');

      expect(scoped.runAsync).toHaveBeenCalledWith(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [5000000, 0, expect.any(String), 'asset-gold']
      );
      expect(scoped.runAsync).toHaveBeenCalledWith(
        'UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL;',
        [expect.any(String), expect.any(String), 'tx-sale-full']
      );
    });

    it('repeated delete attempts are idempotent and do not reverse asset twice', async () => {
      // Transaction already deleted (deletedAt IS NOT NULL)
      scoped.getFirstAsync.mockResolvedValueOnce(null);

      await deleteTransaction('tx-already-deleted');

      // Asset table update must NOT be called
      expect(scoped.runAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE assets SET'),
        expect.anything()
      );
    });

    it('partial sale -> edit amount -> adjusts asset value accurately by delta', async () => {
      // Current sale is ₹10,000. Asset remaining is ₹40,000.
      // Update sale amount to ₹15,000 (net remaining should become ₹35,000)
      scoped.getFirstAsync
        .mockResolvedValueOnce({
          id: 'tx-sale-partial',
          type: 'ASSET_SALE',
          amount: 1000000, // ₹10,000
          assetId: 'asset-stocks',
          metadata: JSON.stringify({
            assetBookValueBefore: 5000000,
            assetValueDeducted: 1000000,
            bookValueSold: 1000000,
          }),
        })
        .mockResolvedValueOnce({
          currentValue: 4000000, // ₹40,000 remaining
          isArchived: 0,
        });

      await updateTransaction('tx-sale-partial', { amount: 1500000 });

      // Asset value adjusted: 40,000 + 10,000 - 15,000 = ₹35,000
      expect(scoped.runAsync).toHaveBeenCalledWith(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [3500000, 0, expect.any(String), 'asset-stocks']
      );
    });

    it('changing transaction type away from ASSET_SALE fully restores original asset', async () => {
      scoped.getFirstAsync
        .mockResolvedValueOnce({
          id: 'tx-switch-type',
          type: 'ASSET_SALE',
          amount: 2000000,
          assetId: 'asset-car',
          metadata: JSON.stringify({
            assetBookValueBefore: 2000000,
            assetArchivedBefore: false,
            assetValueDeducted: 2000000,
            bookValueSold: 2000000,
          }),
        })
        .mockResolvedValueOnce({
          currentValue: 0,
          isArchived: 1,
        });

      // Switch to ordinary EXPENSE
      await updateTransaction('tx-switch-type', {
        type: 'EXPENSE',
        assetId: undefined,
        amount: 2000000,
      });

      // Old asset must be restored
      expect(scoped.runAsync).toHaveBeenCalledWith(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [2000000, 0, expect.any(String), 'asset-car']
      );
    });

    it('changing assetId on ASSET_SALE restores old asset and applies deduction to new asset', async () => {
      scoped.getFirstAsync
        .mockResolvedValueOnce({
          id: 'tx-change-asset',
          type: 'ASSET_SALE',
          amount: 1000000,
          assetId: 'asset-old',
          metadata: JSON.stringify({
            assetBookValueBefore: 1000000,
            assetArchivedBefore: false,
            assetValueDeducted: 1000000,
            bookValueSold: 1000000,
          }),
        })
        // Step 1: restore old asset
        .mockResolvedValueOnce({
          currentValue: 0,
          isArchived: 1,
        })
        // Step 2: query new asset
        .mockResolvedValueOnce({
          currentValue: 3000000, // ₹30,000
          isArchived: 0,
        });

      await updateTransaction('tx-change-asset', {
        assetId: 'asset-new',
        amount: 1000000,
      });

      // Restores old asset
      expect(scoped.runAsync).toHaveBeenCalledWith(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [1000000, 0, expect.any(String), 'asset-old']
      );
      // Deducts from new asset: 30,000 - 10,000 = 20,000
      expect(scoped.runAsync).toHaveBeenCalledWith(
        'UPDATE assets SET currentValue = ?, isArchived = ?, updatedAt = ? WHERE id = ?;',
        [2000000, 0, expect.any(String), 'asset-new']
      );
    });
  });
});
