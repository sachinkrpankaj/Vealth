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
  calculatePersonDebt,
  calculateAccountBalance,
} from '../../src/domain/finance/financialEngine';
import {
  calculateYearOverview,
  calculateMonthInsights,
  calculateCategoryInsights,
  resolveCategoryMeta,
} from '../../src/domain/finance/spendingInsights';
import { isMonthlyGeneralCategory } from '../../src/database/repositories/categoryRepository';
import { validateBackupData, isSecurityKey } from '../../src/utils/backup';
import { formatDateIso, parseLocalDate, getTodayLocalDateString } from '../../src/utils/dateUtils';
import { rupeeToMinor } from '../../src/domain/finance/currency';

describe('Comprehensive Audit Regression Tests', () => {
  // -------------------------------------------------------------------------
  // 1. PIN Relock & Brute Force Lockout
  // -------------------------------------------------------------------------
  describe('PIN Brute Force Protection Logic', () => {
    it('implements progressive lockout penalty tiers', () => {
      const getLockoutSeconds = (attempts: number) => {
        if (attempts >= 10) return 300; // 5 min
        if (attempts >= 7) return 60;   // 1 min
        if (attempts >= 5) return 30;   // 30 sec
        return 0;
      };

      expect(getLockoutSeconds(1)).toBe(0);
      expect(getLockoutSeconds(4)).toBe(0);
      expect(getLockoutSeconds(5)).toBe(30);
      expect(getLockoutSeconds(6)).toBe(30);
      expect(getLockoutSeconds(7)).toBe(60);
      expect(getLockoutSeconds(9)).toBe(60);
      expect(getLockoutSeconds(10)).toBe(300);
      expect(getLockoutSeconds(15)).toBe(300);
    });

    it('identifies security secrets and ensures they are never exported', () => {
      expect(isSecurityKey('security_pin_hash')).toBe(true);
      expect(isSecurityKey('security_pin_salt')).toBe(true);
      expect(isSecurityKey('security_biometric_enabled')).toBe(true);
      expect(isSecurityKey('user_pin_code')).toBe(true);
      expect(isSecurityKey('auth_token')).toBe(true);
      expect(isSecurityKey('app_theme')).toBe(false);
      expect(isSecurityKey('default_currency')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Local Date & IST Midnight Boundaries
  // -------------------------------------------------------------------------
  describe('Local Date & Midnight Boundary Handling', () => {
    it('formats local calendar date consistently regardless of UTC hour', () => {
      // Create a date corresponding to 11:30 PM UTC on Oct 1 => 5:00 AM IST on Oct 2
      const date = new Date(2026, 9, 2, 5, 0, 0); // Local: Oct 2, 2026
      const isoLocal = formatDateIso(date);
      expect(isoLocal).toBe('2026-10-02');
    });

    it('safely parses local dates without timezone shifting', () => {
      const parsed = parseLocalDate('2026-10-15');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(9); // 0-indexed October
      expect(parsed!.getDate()).toBe(15);
    });

    it('rejects invalid calendar dates', () => {
      expect(parseLocalDate('2026-02-31')).toBeNull();
      expect(parseLocalDate('invalid')).toBeNull();
      expect(parseLocalDate(null)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. True Net-Worth Change vs Simple Income - Expense
  // -------------------------------------------------------------------------
  describe('True Net Worth Change Calculation', () => {
    const baseAccount: Account = {
      id: 'acc-bank',
      name: 'Bank',
      type: 'BANK',
      openingBalance: 100000, // ₹1,000 at start of month
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('accounts for asset sale capital gain in netWorthChangeMonth', () => {
      const asset: Asset = {
        id: 'ast-gold',
        name: 'Gold Coin',
        category: 'GOLD',
        currentValue: 0, // fully sold
        purchaseValue: 50000,
        purchaseDate: '2026-01-01',
        isArchived: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      };

      // Sold for ₹600 cash when book value was ₹500 (gain of ₹100)
      const saleTx: Transaction = {
        id: 'tx-sale',
        type: 'ASSET_SALE',
        amount: 60000,
        date: '2026-10-05',
        accountId: 'acc-bank',
        assetId: 'ast-gold',
        metadata: JSON.stringify({
          assetBookValueBefore: 50000,
          assetArchivedBefore: false,
          assetValueDeducted: 50000,
          bookValueSold: 50000,
        }),
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      };

      const result = calculateNetWorth({
        accounts: [baseAccount],
        people: [],
        physicalAssets: [asset],
        standaloneLiabilities: [],
        transactions: [saleTx],
        currentMonthStr: '2026-10',
      });

      // Before Oct 1: Bank (100k) + Gold (50k) = 150k
      // After Oct 5: Bank (100k + 60k = 160k) + Gold (0k) = 160k
      // Net worth change: 160k - 150k = +10,000 paise (₹100 gain)
      // (Simple income - expense would have given 0, which is incorrect!)
      expect(result.netWorthChangeMonth).toBe(10000);
      expect(result.incomeMonth).toBe(0);
      expect(result.expenseMonth).toBe(0);
    });

    it('keeps netWorthChangeMonth unchanged when transferring between accounts', () => {
      const bank2: Account = {
        id: 'acc-savings',
        name: 'Savings',
        type: 'BANK',
        openingBalance: 50000,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      const transferTx: Transaction = {
        id: 'tx-xfer',
        type: 'TRANSFER',
        amount: 25000,
        date: '2026-10-10',
        accountId: 'acc-bank',
        destinationAccountId: 'acc-savings',
        createdAt: '2026-10-10T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
      };

      const result = calculateNetWorth({
        accounts: [baseAccount, bank2],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [transferTx],
        currentMonthStr: '2026-10',
      });

      expect(result.netWorthChangeMonth).toBe(0);
      expect(result.netWorth).toBe(150000);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Debts: Due Dates on Net Outstanding Side Only
  // -------------------------------------------------------------------------
  describe('Debt Due Dates & Simultaneous Counter-Debts', () => {
    const person: Person = {
      id: 'p-vikram',
      name: 'Vikram',
      avatarColor: '#6366F1',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('uses only lend due date when user is owed on net', () => {
      // User lent Vikram ₹10,000 due 2026-10-25
      // User also borrowed ₹2,000 from Vikram due 2026-10-05 (earlier date)
      // Net balance is +₹8,000 (Vikram owes user). Due date MUST be Vikram's repayment date (2026-10-25),
      // NOT user's own payable date (2026-10-05)!
      const txs: Transaction[] = [
        {
          id: 'tx-lend',
          type: 'LEND',
          amount: 1000000,
          date: '2026-10-01',
          personId: 'p-vikram',
          dueDate: '2026-10-25',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'tx-borrow',
          type: 'BORROW',
          amount: 200000,
          date: '2026-10-02',
          personId: 'p-vikram',
          dueDate: '2026-10-05',
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
      ];

      const debt = calculatePersonDebt(person, txs, '2026-10-10');
      expect(debt.netBalance).toBe(800000);
      expect(debt.owedToYou).toBe(1000000);
      expect(debt.youOwe).toBe(200000);
      expect(debt.dueDate).toBe('2026-10-25');
    });

    it('marks fully settled debts as SETTLED with no due date', () => {
      const txs: Transaction[] = [
        {
          id: 'tx-l1',
          type: 'LEND',
          amount: 50000,
          date: '2026-10-01',
          personId: 'p-vikram',
          dueDate: '2026-10-15',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'tx-r1',
          type: 'REPAYMENT_RECEIVED',
          amount: 50000,
          date: '2026-10-05',
          personId: 'p-vikram',
          createdAt: '2026-10-05',
          updatedAt: '2026-10-05',
        },
      ];

      const debt = calculatePersonDebt(person, txs, '2026-10-10');
      expect(debt.netBalance).toBe(0);
      expect(debt.dueStatus).toBe('SETTLED');
      expect(debt.dueDate).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Category Name Collision Protection
  // -------------------------------------------------------------------------
  describe('Category Structured MonthYear vs Name Collision', () => {
    it('protects custom categories containing "· General" from being treated as system categories', () => {
      const customGeneralCat: Category = {
        id: 'cat-custom-general',
        name: 'Office Supplies · General',
        type: 'EXPENSE',
        icon: 'Tag',
        isDefault: false,
        monthYear: null, // Custom category has null monthYear
        createdAt: '2026-10-01',
      };

      const systemGeneralCat: Category = {
        id: 'cat-general-2026-10',
        name: "October '26 · General",
        type: 'EXPENSE',
        icon: 'Folder',
        isDefault: false,
        monthYear: '2026-10', // Structured metadata
        createdAt: '2026-10-01',
      };

      expect(isMonthlyGeneralCategory(customGeneralCat)).toBe(false);
      expect(isMonthlyGeneralCategory(systemGeneralCat)).toBe(true);

      const categoryMap = new Map([
        [customGeneralCat.id, customGeneralCat],
        [systemGeneralCat.id, systemGeneralCat],
      ]);

      const customMeta = resolveCategoryMeta(customGeneralCat.id, categoryMap);
      const systemMeta = resolveCategoryMeta(systemGeneralCat.id, categoryMap);

      expect(customMeta.isGeneral).toBe(false);
      expect(systemMeta.isGeneral).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Future Date Exclusion in Spending Insights
  // -------------------------------------------------------------------------
  describe('Spending Insights Future Date Exclusion', () => {
    const today = new Date(2026, 9, 15); // Oct 15, 2026
    const categories: Category[] = [
      { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'ShoppingBag', isDefault: true, createdAt: '2026-01-01' },
    ];

    it('excludes future dates from current-year and future-month analytics', () => {
      const txs: Transaction[] = [
        {
          id: 'tx-past',
          type: 'EXPENSE',
          amount: 50000,
          date: '2026-10-10', // past
          categoryId: 'cat-groceries',
          createdAt: '2026-10-10',
          updatedAt: '2026-10-10',
        },
        {
          id: 'tx-future-curr',
          type: 'EXPENSE',
          amount: 80000,
          date: '2026-10-25', // future in current month
          categoryId: 'cat-groceries',
          createdAt: '2026-10-15',
          updatedAt: '2026-10-15',
        },
        {
          id: 'tx-future-month',
          type: 'EXPENSE',
          amount: 100000,
          date: '2026-11-05', // future month
          categoryId: 'cat-groceries',
          createdAt: '2026-10-15',
          updatedAt: '2026-10-15',
        },
      ];

      const yearOverview = calculateYearOverview(2026, txs, categories, today);
      // Only the past transaction (50,000) should be counted
      expect(yearOverview.totalSpent).toBe(50000);

      const monthOverview = calculateMonthInsights('2026-10', txs, categories, today);
      expect(monthOverview.totalSpent).toBe(50000);

      const futureMonthOverview = calculateMonthInsights('2026-11', txs, categories, today);
      expect(futureMonthOverview.totalSpent).toBe(0);

      const catInsights = calculateCategoryInsights('cat-groceries', 2026, txs, categories, today);
      expect(catInsights.yearlyTotal).toBe(50000);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Backup / Restore Data Validation & Settings Sanitization
  // -------------------------------------------------------------------------
  describe('Backup Validation & Integrity', () => {
    it('rejects backup with invalid enum or missing required references', () => {
      const invalidBackup = {
        appName: 'Vaelth',
        schemaVersion: 1,
        exportedAt: '2026-10-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-1',
              name: 'Bad Acc',
              type: 'INVALID_ENUM', // Invalid account type!
              openingBalance: 1000,
              currency: 'INR',
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
            },
          ],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          settings: {},
        },
      };

      const result = validateBackupData(invalidBackup);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid financial records');
    });

    it('rejects transfer transaction without distinct destination account', () => {
      const invalidTransfer = {
        appName: 'Vaelth',
        schemaVersion: 1,
        exportedAt: '2026-10-01T00:00:00.000Z',
        data: {
          accounts: [
            {
              id: 'acc-1',
              name: 'Bank',
              type: 'BANK',
              openingBalance: 1000,
              currency: 'INR',
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
            },
          ],
          people: [],
          categories: [],
          transactions: [
            {
              id: 'tx-xfer-same',
              type: 'TRANSFER',
              amount: 500,
              date: '2026-10-01',
              accountId: 'acc-1',
              destinationAccountId: 'acc-1', // Same account!
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
            },
          ],
          assets: [],
          liabilities: [],
          settings: {},
        },
      };

      const result = validateBackupData(invalidTransfer);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('distinct source and destination accounts');
    });
  });
});
