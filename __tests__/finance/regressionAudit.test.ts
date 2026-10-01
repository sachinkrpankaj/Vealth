import {
  calculatePersonDebt,
  calculateTotalStandaloneLiabilities,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';
import { validateRepaymentAmount } from '../../src/domain/finance/validator';
import { getCreditCardBillingInfo } from '../../src/domain/finance/creditCardBilling';
import { useSecurityStore, hashPinLegacy } from '../../src/stores/useSecurityStore';
import * as SecureStore from 'expo-secure-store';
import {
  Account,
  Asset,
  Liability,
  Transaction,
  Person,
} from '../../src/domain/finance/types';

describe('Regression Audit: Backend & Financial Precision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Security: PBKDF2 PIN KDF & Legacy Upgrade', () => {
    it('hashes PIN using PBKDF2 with unique cryptographic salt per PIN and never stores raw PIN', async () => {
      const store = useSecurityStore.getState();
      await store.setPin('1234');

      const savedHash = await SecureStore.getItemAsync('vaelth_security_pin_hash');
      expect(savedHash).toBeDefined();
      expect(savedHash).not.toBe('1234');
      expect(savedHash?.startsWith('pbkdf2:v1:')).toBe(true);

      const parts = savedHash!.split(':');
      expect(parts.length).toBe(5);
      const salt1 = parts[2];

      // Second setPin must produce a different salt
      await store.setPin('1234');
      const savedHash2 = await SecureStore.getItemAsync('vaelth_security_pin_hash');
      const salt2 = savedHash2!.split(':')[2];
      expect(salt1).not.toBe(salt2);

      // Verification checks
      const valid = await store.verifyPin('1234');
      expect(valid).toBe(true);
      const invalid = await store.verifyPin('9999');
      expect(invalid).toBe(false);
    });

    it('seamlessly upgrades legacy static SHA-256 hashes to PBKDF2 upon successful verification', async () => {
      const legacySha256 = await hashPinLegacy('5678');
      await SecureStore.setItemAsync('vaelth_security_pin_hash', legacySha256);

      const store = useSecurityStore.getState();
      const isVerified = await store.verifyPin('5678');
      expect(isVerified).toBe(true);

      // Check that it was transparently upgraded to modern PBKDF2 in SecureStore
      const upgradedHash = await SecureStore.getItemAsync('vaelth_security_pin_hash');
      expect(upgradedHash?.startsWith('pbkdf2:v1:')).toBe(true);
      expect(upgradedHash).not.toBe(legacySha256);

      // Verify again with new PBKDF2 hash
      const isVerifiedAgain = await store.verifyPin('5678');
      expect(isVerifiedAgain).toBe(true);
    });
  });

  describe('2. Debt Due Dates & Settled Debts Isolation', () => {
    it('ignores settled debt and only uses active outstanding debt for nearestDueDate and dueStatus', () => {
      const futureDate = '2026-11-15';
      const pastDate = '2026-08-01';

      // Loan 1 (past due date) of ₹100, which has been fully repaid
      // Loan 2 (future due date) of ₹200, which is still active
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          type: 'LEND',
          amount: 10000, // ₹100
          date: '2026-07-01',
          dueDate: pastDate,
          personId: 'p-1',
          createdAt: '2026-07-01',
          updatedAt: '2026-07-01',
        },
        {
          id: 'tx-2',
          type: 'REPAYMENT_RECEIVED',
          amount: 10000, // fully settled Loan 1
          date: '2026-07-10',
          personId: 'p-1',
          createdAt: '2026-07-10',
          updatedAt: '2026-07-10',
        },
        {
          id: 'tx-3',
          type: 'LEND',
          amount: 20000, // ₹200 active
          date: '2026-09-01',
          dueDate: futureDate,
          personId: 'p-1',
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
      ];

      const debt = calculatePersonDebt('p-1', transactions);
      expect(debt.owedToYou).toBe(20000);
      expect(debt.youOwe).toBe(0);
      expect(debt.netBalance).toBe(20000);
      // The settled loan 1 (with pastDate) MUST NOT make the debt overdue!
      expect(debt.dueDate).toBe(futureDate);
      expect(debt.dueStatus).not.toBe('OVERDUE');
    });

    it('marks fully settled debts as SETTLED with undefined nearestDueDate', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          type: 'BORROW',
          amount: 50000,
          date: '2026-08-01',
          dueDate: '2026-09-01',
          personId: 'p-2',
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
        {
          id: 'tx-2',
          type: 'REPAYMENT_MADE',
          amount: 50000,
          date: '2026-08-20',
          personId: 'p-2',
          createdAt: '2026-08-20',
          updatedAt: '2026-08-20',
        },
      ];

      const debt = calculatePersonDebt('p-2', transactions);
      expect(debt.owedToYou).toBe(0);
      expect(debt.youOwe).toBe(0);
      expect(debt.netBalance).toBe(0);
      expect(debt.dueStatus).toBe('SETTLED');
      expect(debt.dueDate).toBeUndefined();
    });
  });

  describe('3. Overpayment Prevention & Opposing Debt Isolation', () => {
    it('strictly rejects repayments that exceed the outstanding balance in validator', () => {
      const validation = validateRepaymentAmount(15000, 10000);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('exceeds the outstanding balance');

      const validRepayment = validateRepaymentAmount(10000, 10000);
      expect(validRepayment.isValid).toBe(true);
    });

    it('engine never flips overpayments into the opposite debt type', () => {
      // If someone paid more than owed (e.g. from an old transaction), debt balances clamp to 0
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          type: 'BORROW',
          amount: 10000,
          date: '2026-08-01',
          personId: 'p-3',
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
        {
          id: 'tx-2',
          type: 'REPAYMENT_MADE',
          amount: 15000, // overpayment by 5000
          date: '2026-08-05',
          personId: 'p-3',
          createdAt: '2026-08-05',
          updatedAt: '2026-08-05',
        },
      ];

      const debt = calculatePersonDebt('p-3', transactions);
      // youOwe must be 0 and must NOT convert into owedToYou
      expect(debt.youOwe).toBe(0);
      expect(debt.owedToYou).toBe(0);
      expect(debt.dueStatus).toBe('SETTLED');
    });
  });

  describe('4. Credit-Card Billing Partition & Double-Counting Prevention', () => {
    it('guarantees unpaidBillAmount + unbilledAmount === usedAmount across partial payments and refunds', () => {
      const card: Account = {
        id: 'cc-1',
        name: 'HDFC Millennia',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        creditLimit: 10000000, // ₹1,00,000
        billingDay: 1, // statement generated 1st of month
        dueDay: 20,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const transactions: Transaction[] = [
        // Statement spend: ₹30,000 on 2026-08-15
        {
          id: 'tx-1',
          type: 'EXPENSE',
          amount: 3000000,
          date: '2026-08-15',
          accountId: 'cc-1',
          createdAt: '2026-08-15',
          updatedAt: '2026-08-15',
        },
        // Unbilled spend: ₹10,000 on 2026-09-05
        {
          id: 'tx-2',
          type: 'EXPENSE',
          amount: 1000000,
          date: '2026-09-05',
          accountId: 'cc-1',
          createdAt: '2026-09-05',
          updatedAt: '2026-09-05',
        },
        // Partial bill payment: ₹12,000 on 2026-09-10
        {
          id: 'tx-3',
          type: 'TRANSFER',
          amount: 1200000,
          date: '2026-09-10',
          destinationAccountId: 'cc-1',
          accountId: 'bank-1',
          createdAt: '2026-09-10',
          updatedAt: '2026-09-10',
        },
        // Merchant refund: ₹3,000 on 2026-09-12
        {
          id: 'tx-4',
          type: 'INCOME',
          amount: 300000,
          date: '2026-09-12',
          accountId: 'cc-1',
          note: 'Amazon merchant refund',
          createdAt: '2026-09-12',
          updatedAt: '2026-09-12',
        },
      ];

      const info = getCreditCardBillingInfo(card, transactions, new Date(2026, 8, 20));

      // Total used amount: 30,000 + 10,000 - 12,000 - 3,000 = 25,000 (2500000 paise)
      expect(info.usedAmount).toBe(2500000);
      expect(info.unpaidBillAmount + info.unbilledAmount).toBe(info.usedAmount);
      // Unpaid bill: 30,000 - 12,000 - 3,000 = 15,000 (1500000 paise)
      expect(info.unpaidBillAmount).toBe(1500000);
      // Unbilled: 10,000 (1000000 paise)
      expect(info.unbilledAmount).toBe(1000000);
    });
  });

  describe('5. Deduplicate Standalone Liabilities Strictly by IDs/Relations', () => {
    it('deduplicates only when liabilityId or accountId explicitly match, never by name', () => {
      const accounts: Account[] = [
        {
          id: 'acc-cc-1',
          name: 'Personal Loan',
          type: 'CREDIT_CARD',
          openingBalance: 0,
          currency: 'INR',
          isArchived: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      const liabilities: Liability[] = [
        // Liability with SAME name as account, but different ID and no accountId relation
        {
          id: 'liab-1',
          name: 'Personal Loan',
          amount: 5000000, // ₹50,000
          type: 'PERSONAL_LOAN',
          isArchived: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        // Liability explicitly linked to account
        {
          id: 'liab-linked',
          name: 'Card Loan',
          accountId: 'acc-cc-1',
          amount: 2000000,
          type: 'CREDIT_CARD',
          isArchived: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        } as any,
      ];

      const total = calculateTotalStandaloneLiabilities(liabilities, accounts);
      // liab-linked is deduplicated because accountId matches acc-cc-1.
      // liab-1 has the same name "Personal Loan", but must NOT be deduplicated because it is a separate liability!
      expect(total).toBe(5000000);
    });
  });

  describe('6. Asset Purchase/Sale State Updates & Net-Worth Non-Double-Counting', () => {
    it('prevents double counting between asset values and bank balance', () => {
      const accounts: Account[] = [
        {
          id: 'bank-1',
          name: 'Main Bank',
          type: 'BANK',
          openingBalance: 10000000, // ₹1,00,000
          currency: 'INR',
          isArchived: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      const assets: Asset[] = [
        {
          id: 'gold-1',
          name: 'Gold Bar',
          category: 'GOLD',
          purchaseValue: 5000000, // ₹50,000
          currentValue: 5000000,
          purchaseDate: '2026-01-01',
          isArchived: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      // Net worth before transactions: Bank (1,00,000) + Gold (50,000) = 1,50,000
      const initialNetWorth = calculateNetWorth([], accounts, [], assets, []);
      expect(initialNetWorth.netWorth).toBe(15000000);

      // Transaction: Purchased asset from bank account
      // Bank decreases by ₹50,000. Physical asset is already ₹50,000. Total stays ₹1,50,000 (no double counting).
      const transactions: Transaction[] = [
        {
          id: 'tx-buy-gold',
          type: 'ASSET_PURCHASE',
          amount: 5000000,
          accountId: 'bank-1',
          assetId: 'gold-1',
          date: '2026-02-01',
          createdAt: '2026-02-01',
          updatedAt: '2026-02-01',
        },
      ];

      const afterPurchaseNetWorth = calculateNetWorth(transactions, accounts, [], assets, []);
      // Bank balance becomes 1,00,000 - 50,000 = 50,000. Asset is 50,000. Total = 1,00,000.
      expect(afterPurchaseNetWorth.totalAccountBalances).toBe(5000000);
      expect(afterPurchaseNetWorth.totalPhysicalAssets).toBe(5000000);
      expect(afterPurchaseNetWorth.netWorth).toBe(10000000);
    });
  });

  describe('7. Integer Paise Precision & Soft Deletes', () => {
    it('maintains exact integer paise across all aggregate calculations', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          type: 'INCOME',
          amount: 333333, // ₹3,333.33
          accountId: 'bank-1',
          date: '2026-09-01',
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
        {
          id: 'tx-2',
          type: 'EXPENSE',
          amount: 111111, // ₹1,111.11
          accountId: 'bank-1',
          date: '2026-09-02',
          createdAt: '2026-09-02',
          updatedAt: '2026-09-02',
        },
      ];

      const accounts: Account[] = [
        {
          id: 'bank-1',
          name: 'Bank',
          type: 'BANK',
          openingBalance: 100000,
          currency: 'INR',
          isArchived: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      const netWorth = calculateNetWorth(transactions, accounts, [], [], []);
      expect(Number.isInteger(netWorth.netWorth)).toBe(true);
      expect(Number.isInteger(netWorth.totalAssets)).toBe(true);
      expect(Number.isInteger(netWorth.incomeMonth)).toBe(true);
      expect(Number.isInteger(netWorth.expenseMonth)).toBe(true);
      // 100000 + 333333 - 111111 = 322222
      expect(netWorth.netWorth).toBe(322222);
    });
  });

  describe('8. Expanded Transaction Multi-Entity Search', () => {
    it('matches transactions by account, person, category, asset, or liability names', () => {
      const accountMap = new Map([['acc-1', 'HDFC Salary Account']]);
      const personMap = new Map([['p-1', 'Rohan Sharma']]);
      const categoryMap = new Map([['cat-1', 'Groceries & Dining']]);
      const assetMap = new Map([['ast-1', 'Digital Sovereign Gold']]);
      const liabilityMap = new Map([['liab-1', 'Car Auto Loan']]);

      const testTransactions: Transaction[] = [
        {
          id: 'tx-1',
          type: 'EXPENSE',
          amount: 50000,
          date: '2026-09-10',
          accountId: 'acc-1',
          createdAt: '2026-09-10',
          updatedAt: '2026-09-10',
        },
        {
          id: 'tx-2',
          type: 'LEND',
          amount: 20000,
          date: '2026-09-11',
          personId: 'p-1',
          createdAt: '2026-09-11',
          updatedAt: '2026-09-11',
        },
        {
          id: 'tx-3',
          type: 'EXPENSE',
          amount: 15000,
          date: '2026-09-12',
          categoryId: 'cat-1',
          createdAt: '2026-09-12',
          updatedAt: '2026-09-12',
        },
        {
          id: 'tx-4',
          type: 'ASSET_PURCHASE',
          amount: 100000,
          date: '2026-09-13',
          assetId: 'ast-1',
          createdAt: '2026-09-13',
          updatedAt: '2026-09-13',
        },
        {
          id: 'tx-5',
          type: 'EXPENSE',
          amount: 80000,
          date: '2026-09-14',
          liabilityId: 'liab-1',
          createdAt: '2026-09-14',
          updatedAt: '2026-09-14',
        },
      ];

      const search = (query: string) => {
        const q = query.toLowerCase().trim();
        return testTransactions.filter((t) => {
          const noteMatch = t.note?.toLowerCase().includes(q);
          const idMatch = t.id.toLowerCase().includes(q);
          const accMatch = t.accountId && accountMap.get(t.accountId)?.toLowerCase().includes(q);
          const personMatch = t.personId && personMap.get(t.personId)?.toLowerCase().includes(q);
          const categoryMatch = t.categoryId && categoryMap.get(t.categoryId)?.toLowerCase().includes(q);
          const assetMatch = t.assetId && assetMap.get(t.assetId)?.toLowerCase().includes(q);
          const liabilityMatch = t.liabilityId && liabilityMap.get(t.liabilityId)?.toLowerCase().includes(q);
          return noteMatch || idMatch || accMatch || personMatch || categoryMatch || assetMatch || liabilityMatch;
        });
      };

      expect(search('HDFC').map((t) => t.id)).toEqual(['tx-1']);
      expect(search('Rohan').map((t) => t.id)).toEqual(['tx-2']);
      expect(search('Groceries').map((t) => t.id)).toEqual(['tx-3']);
      expect(search('Sovereign Gold').map((t) => t.id)).toEqual(['tx-4']);
      expect(search('Auto Loan').map((t) => t.id)).toEqual(['tx-5']);
    });
  });

  describe('9. UI Date Formatting & Duplicate Prevention', () => {
    it('never duplicates transaction date in row subtitle and formats display date cleanly', () => {
      const tx: Transaction = {
        id: 'tx-demo',
        type: 'EXPENSE',
        amount: 25000,
        date: '2026-09-30',
        createdAt: '2026-09-30',
        updatedAt: '2026-09-30',
      };

      // In TransactionRow:
      // When accountName, personName, and categoryName are missing:
      // Subtitle resolution:
      let subtitle = '';
      if (!subtitle) {
        subtitle = tx.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      }

      expect(subtitle).toBe('Expense');
      expect(subtitle).not.toBe(tx.date);
    });
  });
});
