import {
  Account,
  Asset,
  Category,
  Liability,
  Transaction,
} from '../../src/domain/finance/types';
import {
  calculateNetWorth,
  calculateAssetValueAsOf,
  isAssetArchivedAsOf,
  calculateTotalPhysicalAssets,
  calculateTotalStandaloneLiabilities,
  calculateAccountBalance,
} from '../../src/domain/finance/financialEngine';
import {
  calculateMonthInsights,
  calculateCategoryInsights,
} from '../../src/domain/finance/spendingInsights';
import { getTodayLocalDateString, formatDateIso, parseLocalDate } from '../../src/utils/dateUtils';
import { escapeCSVField, generateTransactionsCSV } from '../../src/utils/csv';
import { runSafeMigration } from '../../src/database/db';

function shiftDate(date: string, days: number): string {
  const parsed = parseLocalDate(date)!;
  parsed.setDate(parsed.getDate() + days);
  return formatDateIso(parsed);
}

function makeTx(
  partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'date'>
): Transaction {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('Financial Integrity & Bug-Fix Audit Regression Suite', () => {
  const today = getTodayLocalDateString();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);
  const futureThisMonth = shiftDate(today, 5);
  const futureNextMonth = shiftDate(today, 40);

  // =========================================================================
  // 1. ASSET SALE ACCOUNTING
  // =========================================================================
  describe('1. Asset Sale Accounting Invariants', () => {
    const createBaseAsset = (id = 'ast-100k'): Asset => ({
      id,
      name: 'Test Vehicle',
      category: 'VEHICLE',
      currentValue: 10000000, // ₹100,000.00
      purchaseValue: 10000000,
      purchaseDate: '2026-01-01',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      valuationHistory: [
        {
          effectiveDate: '2026-01-01',
          value: 10000000,
          source: 'PURCHASE',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      archiveHistory: [
        {
          effectiveDate: '2026-01-01',
          isArchived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const baseAccount: Account = {
      id: 'acc-bank',
      name: 'Bank',
      type: 'BANK',
      openingBalance: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('Sale 1: ₹100k asset sold for ₹80k (Sale below book value -> ₹20k loss, asset becomes 0)', () => {
      const asset = createBaseAsset();
      const saleTx = makeTx({
        id: 'tx-sale-80k',
        type: 'ASSET_SALE',
        amount: 8000000, // ₹80,000 proceeds
        date: today,
        accountId: 'acc-bank',
        assetId: asset.id,
        metadata: JSON.stringify({
          assetBookValueBefore: 10000000,
          assetValueDeducted: 10000000,
          bookValueSold: 10000000,
          assetArchivedBefore: false,
          assetStateApplied: true,
        }),
      });

      // 1. Bank balance increases by sale proceeds (₹80,000)
      const bankBalance = calculateAccountBalance(baseAccount, [saleTx], today);
      expect(bankBalance).toBe(8000000);

      // 2. Asset book value decreases to 0 (NOT 100k - 80k = 20k)
      const remainingAssetValue = calculateAssetValueAsOf(asset, [saleTx], today);
      expect(remainingAssetValue).toBe(0);

      // 3. Asset becomes archived
      expect(isAssetArchivedAsOf(asset, today, [saleTx])).toBe(true);

      // 4. Net worth effect:
      // Initial: Bank(0) + Asset(100k) = ₹100k
      // After: Bank(80k) + Asset(0) = ₹80k
      // Net change = -₹20,000 (Loss of ₹20k)
      const currentMonth = today.slice(0, 7);
      const nw = calculateNetWorth({
        accounts: [baseAccount],
        people: [],
        physicalAssets: [{ ...asset, currentValue: 0, isArchived: true }],
        standaloneLiabilities: [],
        transactions: [saleTx],
        currentMonthStr: currentMonth,
        asOfDate: today,
      });

      expect(nw.netWorth).toBe(8000000);
      expect(nw.netWorthChangeMonth).toBe(-2000000); // -₹20,000 loss
    });

    it('Sale 2: ₹100k asset sold for ₹100k (Sale equal to book value -> 0 gain/loss, asset becomes 0)', () => {
      const asset = createBaseAsset();
      const saleTx = makeTx({
        id: 'tx-sale-100k',
        type: 'ASSET_SALE',
        amount: 10000000, // ₹100,000 proceeds
        date: today,
        accountId: 'acc-bank',
        assetId: asset.id,
        metadata: JSON.stringify({
          assetBookValueBefore: 10000000,
          assetValueDeducted: 10000000,
          bookValueSold: 10000000,
          assetArchivedBefore: false,
          assetStateApplied: true,
        }),
      });

      const bankBalance = calculateAccountBalance(baseAccount, [saleTx], today);
      expect(bankBalance).toBe(10000000);

      const remainingAssetValue = calculateAssetValueAsOf(asset, [saleTx], today);
      expect(remainingAssetValue).toBe(0);

      const currentMonth = today.slice(0, 7);
      const nw = calculateNetWorth({
        accounts: [baseAccount],
        people: [],
        physicalAssets: [{ ...asset, currentValue: 0, isArchived: true }],
        standaloneLiabilities: [],
        transactions: [saleTx],
        currentMonthStr: currentMonth,
        asOfDate: today,
      });

      expect(nw.netWorth).toBe(10000000);
      expect(nw.netWorthChangeMonth).toBe(0); // 0 gain/loss
    });

    it('Sale 3: ₹100k asset sold for ₹120k (Sale above book value -> ₹20k gain, asset becomes 0)', () => {
      const asset = createBaseAsset();
      const saleTx = makeTx({
        id: 'tx-sale-120k',
        type: 'ASSET_SALE',
        amount: 12000000, // ₹120,000 proceeds
        date: today,
        accountId: 'acc-bank',
        assetId: asset.id,
        metadata: JSON.stringify({
          assetBookValueBefore: 10000000,
          assetValueDeducted: 10000000,
          bookValueSold: 10000000,
          assetArchivedBefore: false,
          assetStateApplied: true,
        }),
      });

      const bankBalance = calculateAccountBalance(baseAccount, [saleTx], today);
      expect(bankBalance).toBe(12000000);

      const remainingAssetValue = calculateAssetValueAsOf(asset, [saleTx], today);
      expect(remainingAssetValue).toBe(0);

      const currentMonth = today.slice(0, 7);
      const nw = calculateNetWorth({
        accounts: [baseAccount],
        people: [],
        physicalAssets: [{ ...asset, currentValue: 0, isArchived: true }],
        standaloneLiabilities: [],
        transactions: [saleTx],
        currentMonthStr: currentMonth,
        asOfDate: today,
      });

      expect(nw.netWorth).toBe(12000000);
      expect(nw.netWorthChangeMonth).toBe(2000000); // +₹20,000 gain
    });

    it('Sale 4: Multiple transactions on the same asset (purchase -> partial sale -> final liquidation)', () => {
      const asset = createBaseAsset();
      const purchaseTx = makeTx({
        id: 'tx-p1',
        type: 'ASSET_PURCHASE',
        amount: 5000000,
        date: shiftDate(today, -10),
        accountId: 'acc-bank',
        assetId: asset.id,
      });
      const partialSaleTx = makeTx({
        id: 'tx-s1',
        type: 'ASSET_SALE',
        amount: 3500000,
        date: shiftDate(today, -5),
        accountId: 'acc-bank',
        assetId: asset.id,
        metadata: JSON.stringify({
          isPartialSale: true,
          bookValueSold: 3000000,
          assetValueDeducted: 3000000,
        }),
      });

      // 1. After purchase: 100k + 50k = 150k
      expect(calculateAssetValueAsOf(asset, [purchaseTx], shiftDate(today, -8))).toBe(15000000);

      // 2. After partial sale: 150k - 30k = 120k
      expect(calculateAssetValueAsOf(asset, [purchaseTx, partialSaleTx], shiftDate(today, -2))).toBe(12000000);
      expect(isAssetArchivedAsOf(asset, shiftDate(today, -2), [purchaseTx, partialSaleTx])).toBe(false);

      // 3. Final liquidation sale of remaining 120k for 100k cash
      const finalSaleTx = makeTx({
        id: 'tx-s2',
        type: 'ASSET_SALE',
        amount: 10000000,
        date: today,
        accountId: 'acc-bank',
        assetId: asset.id,
        metadata: JSON.stringify({
          bookValueSold: 12000000,
          assetValueDeducted: 12000000,
        }),
      });

      const allTxs = [purchaseTx, partialSaleTx, finalSaleTx];
      expect(calculateAssetValueAsOf(asset, allTxs, today)).toBe(0);
      expect(isAssetArchivedAsOf(asset, today, allTxs)).toBe(true);
    });

    it('Sale 5: Historical valuation before and after sale', () => {
      const asset = createBaseAsset();
      const saleDate = shiftDate(today, -3);
      const saleTx = makeTx({
        id: 'tx-sale-hist',
        type: 'ASSET_SALE',
        amount: 8000000,
        date: saleDate,
        accountId: 'acc-bank',
        assetId: asset.id,
      });

      // Day before sale: Asset was ₹100,000
      expect(calculateAssetValueAsOf(asset, [saleTx], shiftDate(saleDate, -1))).toBe(10000000);
      expect(isAssetArchivedAsOf(asset, shiftDate(saleDate, -1), [saleTx])).toBe(false);

      // On and after sale date: Asset is ₹0
      expect(calculateAssetValueAsOf(asset, [saleTx], saleDate)).toBe(0);
      expect(calculateAssetValueAsOf(asset, [saleTx], today)).toBe(0);
      expect(isAssetArchivedAsOf(asset, saleDate, [saleTx])).toBe(true);
    });
  });

  // =========================================================================
  // 2. CREDIT CARD LIABILITY DOUBLE-COUNTING
  // =========================================================================
  describe('2. Credit Card Liability Invariants', () => {
    it('Normal credit card account is counted exactly once in net worth', () => {
      const ccAccount: Account = {
        id: 'acc-cc',
        name: 'HDFC Regalia',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      // Spend ₹15,000 on credit card
      const ccExpense = makeTx({
        id: 'tx-cc-1',
        type: 'EXPENSE',
        amount: 1500000,
        date: today,
        accountId: 'acc-cc',
      });

      const nw = calculateNetWorth({
        accounts: [ccAccount],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [ccExpense],
      });

      // Outstanding CC liability = ₹15,000. Net worth = -₹15,000.
      expect(nw.totalLiabilities).toBe(1500000);
      expect(nw.netWorth).toBe(-1500000);
    });

    it('Duplicate standalone liability linked to credit card account is NEVER double-counted in net worth', () => {
      const ccAccount: Account = {
        id: 'acc-cc',
        name: 'HDFC Regalia',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const ccExpense = makeTx({
        id: 'tx-cc-1',
        type: 'EXPENSE',
        amount: 1500000,
        date: today,
        accountId: 'acc-cc',
      });
      // Duplicate standalone liability referencing the same account
      const standaloneCcLiability: Liability = {
        id: 'lib-cc-dup',
        name: 'HDFC Regalia Card Debt',
        type: 'CREDIT_CARD',
        amount: 1500000,
        isArchived: false,
        personId: undefined,
        note: 'acc-cc',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const nw = calculateNetWorth({
        accounts: [ccAccount],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [standaloneCcLiability],
        transactions: [ccExpense],
      });

      // Standalone liabilities that are CREDIT_CARD type are excluded when CC accounts exist
      expect(nw.totalLiabilities).toBe(1500000);
      expect(nw.netWorth).toBe(-1500000);
    });

    it('Credit card payment via TRANSFER reduces outstanding liability correctly', () => {
      const bankAccount: Account = {
        id: 'acc-bank',
        name: 'Bank',
        type: 'BANK',
        openingBalance: 5000000, // ₹50,000
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const ccAccount: Account = {
        id: 'acc-cc',
        name: 'HDFC Regalia',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const ccSpend = makeTx({
        id: 'tx-spend',
        type: 'EXPENSE',
        amount: 1000000,
        date: yesterday,
        accountId: 'acc-cc',
      });
      const ccPayment = makeTx({
        id: 'tx-pay',
        type: 'TRANSFER',
        amount: 1000000,
        date: today,
        accountId: 'acc-bank',
        destinationAccountId: 'acc-cc',
      });

      const transactions = [ccSpend, ccPayment];
      const bankBalance = calculateAccountBalance(bankAccount, transactions, today);
      const ccBalance = calculateAccountBalance(ccAccount, transactions, today);

      expect(bankBalance).toBe(4000000); // 50k - 10k = 40k
      expect(ccBalance).toBe(0); // 10k debt wiped out = 0

      const nw = calculateNetWorth({
        accounts: [bankAccount, ccAccount],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions,
      });

      expect(nw.totalLiabilities).toBe(0);
      expect(nw.netWorth).toBe(4000000);
    });
  });

  // =========================================================================
  // 3. ANALYTICS MUST NOT COUNT FUTURE TRANSACTIONS
  // =========================================================================
  describe('3. Analytics Future Transaction Exclusion', () => {
    it('Realized monthly income/expense/savings include past and today but exclude future transactions', () => {
      const todayTx = makeTx({
        id: 'tx-today',
        type: 'EXPENSE',
        amount: 10000, // ₹100
        date: today,
        categoryId: 'cat-food',
      });
      const yesterdayTx = makeTx({
        id: 'tx-yesterday',
        type: 'INCOME',
        amount: 50000, // ₹500
        date: yesterday,
        categoryId: 'cat-salary',
      });
      const tomorrowTx = makeTx({
        id: 'tx-tomorrow',
        type: 'EXPENSE',
        amount: 25000, // ₹250
        date: tomorrow,
        categoryId: 'cat-food',
      });
      const futureMonthTx = makeTx({
        id: 'tx-future-month',
        type: 'EXPENSE',
        amount: 90000, // ₹900
        date: futureNextMonth,
        categoryId: 'cat-travel',
      });

      const transactions = [todayTx, yesterdayTx, tomorrowTx, futureMonthTx];
      const currentMonth = today.slice(0, 7);

      const insights = calculateMonthInsights(currentMonth, transactions, []);

      // Realized expense in MonthInsights must only be today's 10000 (₹100), EXCLUDING tomorrow's 25000 (₹250)
      expect(insights.totalSpent).toBe(10000);

      // Category breakdown must NOT contain tomorrow's spending
      const foodCat = insights.categoryBreakdown.find((c) => c.id === 'cat-food');
      expect(foodCat).toBeDefined();
      expect(foodCat!.amount).toBe(10000); // Only today's 10000!

      // Category insights helper also enforces date <= today
      const mockCategory: Category = {
        id: 'cat-food',
        name: 'Food',
        icon: 'food',
        type: 'EXPENSE',
        isDefault: false,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const catInsights = calculateCategoryInsights('cat-food', 2026, transactions, [mockCategory]);
      expect(catInsights.yearlyTotal).toBe(10000);

      // Net worth calculation also respects realized monthly income and expense as of today
      const nw = calculateNetWorth({
        accounts: [],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions,
        referenceDate: new Date(),
      });
      expect(nw.incomeMonth).toBe(50000);
      expect(nw.expenseMonth).toBe(10000);
    });
  });

  // =========================================================================
  // 4. CSV SPREADSHEET FORMULA INJECTION
  // =========================================================================
  describe('4. CSV Spreadsheet Formula Injection Prevention', () => {
    it('Neutralizes dangerous formula injection characters while preserving valid numbers', () => {
      // Normal numbers must NOT be altered
      expect(escapeCSVField(-500.5)).toBe('-500.5');
      expect(escapeCSVField(1200)).toBe('1200');

      // Formula injection prefixes must be neutralized with a leading single-quote
      expect(escapeCSVField('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(escapeCSVField('@cmd|/c calc')).toBe("'@cmd|/c calc");
      expect(escapeCSVField('+12345CMD')).toBe("'+12345CMD");
      expect(escapeCSVField('-12345CMD')).toBe("'-12345CMD");
      expect(escapeCSVField('\tCMD')).toBe("'\tCMD");

      // Normal text with commas, quotes, and newlines must be properly quoted
      expect(escapeCSVField('Hello, World')).toBe('"Hello, World"');
      expect(escapeCSVField('Say "Hi"')).toBe('"Say ""Hi"""');
      expect(escapeCSVField('Line1\nLine2')).toBe('"Line1\nLine2"');
    });

    it('Protects transactions exported to CSV', () => {
      const maliciousTx = makeTx({
        id: 'tx-hack',
        type: 'EXPENSE',
        amount: 10000,
        date: today,
        note: '=cmd|\' /C calc\'!A0',
        categoryId: '+malicious_category',
      });

      const csv = generateTransactionsCSV([maliciousTx]);
      // Verify that note and category are safely escaped with leading single quotes
      expect(csv).toContain("'=cmd|' /C calc'!A0");
      expect(csv).toContain("'+malicious_category");
    });
  });

  // =========================================================================
  // 5. DATABASE MIGRATION ERROR HANDLING
  // =========================================================================
  describe('5. Database Migration Error Handling', () => {
    it('Tolerates idempotent errors (duplicate column / table exists)', async () => {
      const mockDb: any = {
        execAsync: jest.fn().mockRejectedValue(new Error('duplicate column name: testCol')),
      };

      // Must not throw for duplicate column
      await expect(runSafeMigration(mockDb, 'ALTER TABLE test ADD COLUMN testCol TEXT;', 'test step')).resolves.not.toThrow();
    });

    it('Strictly fails and throws on unexpected SQL syntax or integrity errors', async () => {
      const mockDb: any = {
        execAsync: jest.fn().mockRejectedValue(new Error('near "SYNTAX_ERROR": syntax error')),
      };

      await expect(runSafeMigration(mockDb, 'INVALID SQL STATEMENT;', 'test step')).rejects.toThrow(
        /syntax error/
      );
    });
  });

  // =========================================================================
  // 6. ARCHIVED ASSET & LIABILITY SUMMARY CONSISTENCY
  // =========================================================================
  describe('6. Archived Records Consistency Across Screens', () => {
    it('calculateTotalPhysicalAssets accurately counts only active assets', () => {
      const activeAsset: Asset = {
        id: 'ast-active',
        name: 'Active Car',
        category: 'VEHICLE',
        currentValue: 5000000,
        purchaseValue: 5000000,
        purchaseDate: '2026-01-01',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const archivedAsset: Asset = {
        id: 'ast-archived',
        name: 'Old Bike',
        category: 'VEHICLE',
        currentValue: 2000000,
        purchaseValue: 2000000,
        purchaseDate: '2025-01-01',
        isArchived: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const totalActive = calculateTotalPhysicalAssets([activeAsset, archivedAsset], today);
      expect(totalActive).toBe(5000000); // Only active asset included
    });

    it('calculateTotalStandaloneLiabilities excludes CC liabilities that link to credit card accounts', () => {
      const standaloneLoan: Liability = {
        id: 'lib-loan',
        name: 'Personal Loan',
        type: 'PERSONAL_LOAN',
        amount: 10000000,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const duplicateCcLiability: Liability = {
        id: 'lib-cc-dup',
        name: 'Credit Card',
        type: 'CREDIT_CARD',
        amount: 5000000,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const ccAccount: Account = {
        id: 'acc-cc',
        name: 'Card Account',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const total = calculateTotalStandaloneLiabilities(
        [standaloneLoan, duplicateCcLiability],
        [ccAccount]
      );

      // Must exclude duplicateCcLiability!
      expect(total).toBe(10000000);
    });
  });
});
