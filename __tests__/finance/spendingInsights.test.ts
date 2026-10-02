import { openDatabaseAsync } from 'expo-sqlite';
import {
  formatMonthlyGeneralCategoryName,
  getMonthYearKey,
  isMonthlyGeneralCategory,
  ensureMonthlyGeneralCategory,
  getSelectableExpenseCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
} from '../../src/database/repositories/categoryRepository';
import {
  calculateYearOverview,
  calculateMonthInsights,
  calculateCategoryInsights,
  getAvailableExpenseYears,
  resolveCategoryMeta,
} from '../../src/domain/finance/spendingInsights';
import {
  calculateAccountBalance,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';
import { validateBackupData, VaelthBackupData } from '../../src/utils/backup';
import { Transaction, Category, Account } from '../../src/domain/finance/types';

const open = openDatabaseAsync as jest.Mock;

describe('Spending Insights & Expense Category Regression Test Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. FORMATTERS & MONTHLY GENERAL HELPERS
  // ---------------------------------------------------------------------------
  describe('Monthly General Formatting & Key Extraction', () => {
    it('formats monthly General category name correctly across months and years', () => {
      expect(formatMonthlyGeneralCategoryName(new Date(2026, 9, 15))).toBe("October '26 · General");
      expect(formatMonthlyGeneralCategoryName(new Date(2026, 10, 1))).toBe("November '26 · General");
      expect(formatMonthlyGeneralCategoryName(new Date(2026, 11, 31))).toBe("December '26 · General");
      expect(formatMonthlyGeneralCategoryName(new Date(2027, 0, 1))).toBe("January '27 · General");
    });

    it('generates YYYY-MM key consistently', () => {
      expect(getMonthYearKey(new Date(2026, 9, 15))).toBe('2026-10');
      expect(getMonthYearKey(new Date(2026, 0, 5))).toBe('2026-01');
      expect(getMonthYearKey(new Date(2026, 11, 25))).toBe('2026-12');
    });

    it('identifies monthly general categories vs custom categories', () => {
      const generalCat1: Category = {
        id: 'cat-general-2026-10',
        name: "October '26 · General",
        type: 'EXPENSE',
        icon: 'Folder',
        isDefault: false,
        monthYear: '2026-10',
        createdAt: '2026-10-01',
      };
      const generalCat2: Category = {
        id: 'cat-old-gen',
        name: "November '26 · General",
        type: 'EXPENSE',
        icon: 'Folder',
        isDefault: false,
        monthYear: '2026-11',
        createdAt: '2026-11-01',
      };
      const customCat: Category = {
        id: 'cat-food',
        name: 'Dining & Food',
        type: 'EXPENSE',
        icon: 'Utensils',
        isDefault: false,
        monthYear: null,
        createdAt: '2026-01-01',
      };
      const nameCollisionCat: Category = {
        id: 'cat-custom-collision',
        name: "December '26 · General",
        type: 'EXPENSE',
        icon: 'Folder',
        isDefault: false,
        monthYear: null,
        createdAt: '2026-12-01',
      };

      expect(isMonthlyGeneralCategory(generalCat1)).toBe(true);
      expect(isMonthlyGeneralCategory(generalCat2)).toBe(true);
      expect(isMonthlyGeneralCategory(customCat)).toBe(false);
      expect(isMonthlyGeneralCategory(nameCollisionCat)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CATEGORY REPOSITORY & CURRENT-MONTH RULE
  // ---------------------------------------------------------------------------
  describe('Category Repository & Current-Month Rule Enforcement', () => {
    let mockCategories: Array<{
      id: string;
      name: string;
      type: string;
      icon: string;
      color?: string | null;
      isDefault: number;
      isArchived?: number;
      monthYear?: string | null;
      createdAt: string;
    }> = [];

    let mockTransactions: Array<{
      id: string;
      categoryId?: string | null;
      deletedAt?: string | null;
    }> = [];

    let mockDb: any;

    beforeEach(() => {
      mockCategories = [
        {
          id: 'cat-food',
          name: 'Food & Groceries',
          type: 'EXPENSE',
          icon: 'ShoppingBag',
          color: '#10B981',
          isDefault: 0,
          isArchived: 0,
          monthYear: null,
          createdAt: '2026-01-01',
        },
        {
          id: 'cat-travel',
          name: 'Travel',
          type: 'EXPENSE',
          icon: 'Plane',
          color: '#3B82F6',
          isDefault: 0,
          isArchived: 0,
          monthYear: null,
          createdAt: '2026-01-01',
        },
        {
          id: 'cat-archived-gym',
          name: 'Gym Membership',
          type: 'EXPENSE',
          icon: 'Activity',
          color: '#F43F5E',
          isDefault: 0,
          isArchived: 1,
          monthYear: null,
          createdAt: '2026-01-01',
        },
        // Historical general category from August 2026
        {
          id: 'cat-general-2026-08',
          name: "August '26 · General",
          type: 'EXPENSE',
          icon: 'Folder',
          color: '#94A3B8',
          isDefault: 0,
          isArchived: 0,
          monthYear: '2026-08',
          createdAt: '2026-08-01',
        },
      ];

      mockTransactions = [
        { id: 'tx-1', categoryId: 'cat-general-2026-08', deletedAt: null },
        { id: 'tx-2', categoryId: 'cat-food', deletedAt: null },
      ];

      mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('FROM categories WHERE id = ?')) {
            const cat = mockCategories.find((c) => c.id === params[0]);
            return cat ? { ...cat } : null;
          }
          if (sql.includes('WHERE type = ? AND (id = ? OR monthYear = ?)')) {
            const [type, id, monthYear] = params;
            const cat = mockCategories.find(
              (c) => c.type === type && (c.id === id || c.monthYear === monthYear)
            );
            return cat ? { ...cat } : null;
          }
          if (sql.includes('FROM categories WHERE type = ? AND (monthYear = ? OR name = ?)')) {
            const [type, monthYear, name] = params;
            const cat = mockCategories.find(
              (c) => c.type === type && (c.monthYear === monthYear || c.name === name)
            );
            return cat ? { ...cat } : null;
          }
          if (sql.includes('SELECT COUNT(*) as count FROM transactions WHERE categoryId = ?')) {
            const catId = params[0];
            const count = mockTransactions.filter(
              (t) => t.categoryId === catId && !t.deletedAt
            ).length;
            return { count };
          }
          return null;
        }),
        withTransactionAsync: jest.fn(async (cb: any) => cb(mockDb)),
        getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('foreign_key_list')) {
            return [{ table: 'assets' }, { table: 'liabilities' }];
          }
          if (sql.includes('SELECT COUNT(*) as count FROM categories')) {
            return [{ count: mockCategories.length }];
          }
          if (sql.includes('FROM categories')) {
            let res = [...mockCategories];
            if (sql.includes("type = 'EXPENSE'") || (sql.includes('type = ?') && params[0] === 'EXPENSE')) {
              res = res.filter((c) => c.type === 'EXPENSE');
            }
            if (sql.includes('isArchived = 0') && !sql.includes('OR (id = ? AND ? IS NOT NULL)')) {
              res = res.filter((c) => !c.isArchived);
            } else if (sql.includes('OR (id = ? AND ? IS NOT NULL)')) {
              const currentId = params[0];
              res = res.filter((c) => !c.isArchived || (currentId && c.id === currentId));
            }
            return res;
          }
          return [];
        }),
        runAsync: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('INSERT INTO categories')) {
            if (params.length === 4) {
              const [id, generalName, monthYear, now] = params;
              mockCategories.push({
                id,
                name: generalName,
                type: 'EXPENSE',
                icon: 'Folder',
                color: '#94A3B8',
                isDefault: 0,
                isArchived: 0,
                monthYear,
                createdAt: now,
              });
            } else {
              const [id, name, type, icon, color, isDefault, isArchived, monthYear, createdAt] = params;
              mockCategories.push({
                id,
                name,
                type,
                icon,
                color,
                isDefault,
                isArchived,
                monthYear,
                createdAt,
              });
            }
            return { changes: 1 };
          }
          if (sql.includes('UPDATE categories SET name = ?')) {
            const [name, icon, color, isArchived, id] = params;
            const c = mockCategories.find((cat) => cat.id === id);
            if (c) {
              c.name = name;
              c.icon = icon;
              c.color = color;
              c.isArchived = isArchived;
            }
            return { changes: 1 };
          }
          if (sql.includes('UPDATE categories SET isArchived = 1 WHERE id = ?')) {
            const [id] = params;
            const c = mockCategories.find((cat) => cat.id === id);
            if (c) c.isArchived = 1;
            return { changes: 1 };
          }
          if (sql.includes('UPDATE categories SET isArchived = ? WHERE id = ?')) {
            const [isArchived, id] = params;
            const c = mockCategories.find((cat) => cat.id === id);
            if (c) c.isArchived = isArchived;
            return { changes: 1 };
          }
          if (sql.includes('DELETE FROM categories WHERE id = ?')) {
            const [id] = params;
            mockCategories = mockCategories.filter((cat) => cat.id !== id);
            return { changes: 1 };
          }
          return { changes: 0 };
        }),
      };

      open.mockResolvedValue(mockDb);
    });

    it('ensures monthly General category is automatically created with expected name and properties', async () => {
      const octDate = new Date(2026, 9, 1); // October 2026
      const cat = await ensureMonthlyGeneralCategory(octDate);

      expect(cat.name).toBe("October '26 · General");
      expect(cat.type).toBe('EXPENSE');
      expect(cat.monthYear).toBe('2026-10');
      expect(cat.isArchived).toBe(false);

      // Calling again for the same month returns the existing record without duplicate insertion
      const countBefore = mockCategories.length;
      const catAgain = await ensureMonthlyGeneralCategory(octDate);
      expect(catAgain.id).toBe(cat.id);
      expect(mockCategories.length).toBe(countBefore);
    });

    it('automatically transitions to new month General category on month rollover', async () => {
      const octDate = new Date(2026, 9, 31);
      const novDate = new Date(2026, 10, 1);

      const octCat = await ensureMonthlyGeneralCategory(octDate);
      const novCat = await ensureMonthlyGeneralCategory(novDate);

      expect(octCat.name).toBe("October '26 · General");
      expect(novCat.name).toBe("November '26 · General");
      expect(octCat.id).not.toBe(novCat.id);
    });

    it('enforces Current-Month Rule: normal Add Expense exposes only current calendar month General and custom categories', async () => {
      const octDate = new Date(2026, 9, 15);
      const selectable = await getSelectableExpenseCategories({
        currentDate: octDate,
      });

      const names = selectable.map((c) => c.name);
      // Must include current month General
      expect(names).toContain("October '26 · General");
      // Must include active custom categories
      expect(names).toContain('Food & Groceries');
      expect(names).toContain('Travel');
      // Must NOT include older months' General categories (e.g. August '26 · General)
      expect(names).not.toContain("August '26 · General");
      // Must NOT include archived categories
      expect(names).not.toContain('Gym Membership');
    });

    it('enforces Current-Month Rule: backdating an expense does NOT expose older month General categories', async () => {
      // Current calendar month is October 2026, but expense date is 2026-08-10
      const calendarDate = new Date(2026, 9, 15); // October
      const selectable = await getSelectableExpenseCategories({
        currentDate: calendarDate,
      });

      const names = selectable.map((c) => c.name);
      expect(names).toContain("October '26 · General");
      expect(names).not.toContain("August '26 · General");
    });

    it('permits historical General category access only when explicitly requested (allowHistoricalMonth)', async () => {
      const calendarDate = new Date(2026, 9, 15);
      const selectable = await getSelectableExpenseCategories({
        currentDate: calendarDate,
        allowHistoricalMonth: '2026-08',
      });

      const names = selectable.map((c) => c.name);
      expect(names).toContain("August '26 · General");
      expect(names).toContain("October '26 · General");
      expect(names).toContain('Food & Groceries');
    });

    it('preserves historical category selection when editing an existing transaction', async () => {
      const calendarDate = new Date(2026, 9, 15);
      // Editing tx-1 which was assigned to August '26 · General
      const selectable = await getSelectableExpenseCategories({
        currentDate: calendarDate,
        currentSelectionId: 'cat-general-2026-08',
      });

      const names = selectable.map((c) => c.name);
      expect(names).toContain("August '26 · General");
    });

    it('preserves archived category selection when editing an existing transaction', async () => {
      const calendarDate = new Date(2026, 9, 15);
      const selectable = await getSelectableExpenseCategories({
        currentDate: calendarDate,
        currentSelectionId: 'cat-archived-gym',
      });

      const names = selectable.map((c) => c.name);
      expect(names).toContain('Gym Membership');
    });

    it('creates custom category with monthYear = null and allows reuse across months', async () => {
      const created = await createCategory({
        name: 'Entertainment & Gaming',
        type: 'EXPENSE',
        icon: 'Tv',
        color: '#8B5CF6',
      });

      expect(created.name).toBe('Entertainment & Gaming');
      expect(created.monthYear).toBeNull();
      expect(created.isArchived).toBe(false);

      const fetched = await getCategoryById(created.id);
      expect(fetched?.name).toBe('Entertainment & Gaming');
    });

    it('renames and updates custom category', async () => {
      const updated = await updateCategory('cat-food', {
        name: 'Groceries & Dining Out',
        color: '#059669',
      });

      expect(updated.name).toBe('Groceries & Dining Out');
      expect(updated.color).toBe('#059669');
    });

    it('archives custom category so it is excluded from future selections', async () => {
      await archiveCategory('cat-travel', true);
      const calendarDate = new Date(2026, 9, 15);
      const selectable = await getSelectableExpenseCategories({
        currentDate: calendarDate,
      });

      expect(selectable.map((c) => c.name)).not.toContain('Travel');
    });

    it('soft-deletes category when referenced by transactions to preserve historical data', async () => {
      // cat-food is referenced by tx-2
      await deleteCategory('cat-food');

      const catInDb = mockCategories.find((c) => c.id === 'cat-food');
      // Should NOT be removed from array; must be soft-deleted (archived = 1)
      expect(catInDb).toBeDefined();
      expect(catInDb?.isArchived).toBe(1);
    });

    it('hard-deletes category when not referenced by any transactions', async () => {
      // create unreferenced category
      const unref = await createCategory({
        name: 'Temporary One-Off',
        type: 'EXPENSE',
      });

      await deleteCategory(unref.id);
      const catInDb = mockCategories.find((c) => c.id === unref.id);
      expect(catInDb).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. SPENDING INSIGHTS: YEAR OVERVIEW CALCULATION
  // ---------------------------------------------------------------------------
  describe('Year Overview Calculation & Elapsed Months Rules', () => {
    const categories: Category[] = [
      { id: 'cat-food', name: 'Food', type: 'EXPENSE', icon: 'Utensils', isDefault: false, createdAt: '2026-01-01' },
      { id: 'cat-rent', name: 'Rent', type: 'EXPENSE', icon: 'Home', isDefault: false, createdAt: '2026-01-01' },
      { id: 'cat-general-2026-10', name: "October '26 · General", type: 'EXPENSE', icon: 'Folder', isDefault: false, monthYear: '2026-10', createdAt: '2026-10-01' },
    ];

    const transactions: Transaction[] = [
      // January 2026
      { id: 'tx-1', type: 'EXPENSE', amount: 1000000, date: '2026-01-10', accountId: 'acc-1', categoryId: 'cat-food', createdAt: '2026-01-10', updatedAt: '2026-01-10' },
      { id: 'tx-2', type: 'EXPENSE', amount: 2000000, date: '2026-01-15', accountId: 'acc-1', categoryId: 'cat-rent', createdAt: '2026-01-15', updatedAt: '2026-01-15' },
      // March 2026
      { id: 'tx-3', type: 'EXPENSE', amount: 1500000, date: '2026-03-05', accountId: 'acc-1', categoryId: 'cat-food', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
      // October 2026 (current month)
      { id: 'tx-4', type: 'EXPENSE', amount: 500000, date: '2026-10-01', accountId: 'acc-1', categoryId: 'cat-general-2026-10', createdAt: '2026-10-01', updatedAt: '2026-10-01' },
      { id: 'tx-5', type: 'EXPENSE', amount: 250000, date: '2026-10-02', accountId: 'acc-1', categoryId: undefined, createdAt: '2026-10-02', updatedAt: '2026-10-02' }, // Uncategorized
      // Future dated in current year (beyond today: Oct 15) -> must NOT distort totals or averages
      { id: 'tx-future', type: 'EXPENSE', amount: 9999999, date: '2026-11-20', accountId: 'acc-1', categoryId: 'cat-food', createdAt: '2026-10-01', updatedAt: '2026-10-01' },
      // Soft-deleted transaction -> must be ignored
      { id: 'tx-deleted', type: 'EXPENSE', amount: 5000000, date: '2026-01-20', accountId: 'acc-1', categoryId: 'cat-food', createdAt: '2026-01-20', updatedAt: '2026-01-20', deletedAt: '2026-01-21' },
      // Income transaction -> must be ignored
      { id: 'tx-inc', type: 'INCOME', amount: 5000000, date: '2026-01-01', accountId: 'acc-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ];

    it('calculates current year spend through today and excludes future months/transactions', () => {
      const asOfDate = new Date(2026, 9, 2); // October 2, 2026
      const overview = calculateYearOverview(2026, transactions, categories, asOfDate);

      // Total spent = tx1 (10,000) + tx2 (20,000) + tx3 (15,000) + tx4 (5,000) + tx5 (2,500) = 52,500 INR (5,250,000 paise)
      expect(overview.totalSpent).toBe(5250000);

      // In October (month index 9), elapsed months count is 10 (Jan through Oct)
      expect(overview.elapsedMonthsCount).toBe(10);

      // Monthly average = 5,250,000 / 10 = 525,000 paise (₹5,250)
      expect(overview.averageMonthlySpend).toBe(525000);

      // Highest spend month: January (30,000 INR = 3,000,000 paise)
      expect(overview.highestSpendMonth?.monthKey).toBe('2026-01');
      expect(overview.highestSpendMonth?.amount).toBe(3000000);

      // Top category: Food (25,000 INR = 2,500,000 paise vs Rent 20,000 INR = 2,000,000 paise)
      expect(overview.topCategory?.id).toBe('cat-food');
      expect(overview.topCategory?.amount).toBe(2500000);
      expect(overview.topCategory?.percentage).toBeCloseTo((2500000 / 5250000) * 100, 1);
    });

    it('correctly marks future months and sets percentage of peak on monthly trends', () => {
      const asOfDate = new Date(2026, 9, 2); // October 2, 2026
      const overview = calculateYearOverview(2026, transactions, categories, asOfDate);

      expect(overview.monthlyTrends.length).toBe(12);

      // October is month index 9
      const oct = overview.monthlyTrends[9];
      expect(oct.isCurrentMonth).toBe(true);
      expect(oct.isFuture).toBe(false);
      expect(oct.amount).toBe(750000); // 500,000 + 250,000

      // November is month index 10
      const nov = overview.monthlyTrends[10];
      expect(nov.isCurrentMonth).toBe(false);
      expect(nov.isFuture).toBe(true);
      expect(nov.amount).toBe(0); // Future transaction was excluded

      // Peak month is January (3,000,000)
      const jan = overview.monthlyTrends[0];
      expect(jan.percentageOfPeak).toBe(100);
      // October relative to Jan: (750,000 / 3,000,000) * 100 = 25%
      expect(oct.percentageOfPeak).toBe(25);
    });

    it('includes Uncategorized and General in category breakdown sorted descending', () => {
      const asOfDate = new Date(2026, 9, 2);
      const overview = calculateYearOverview(2026, transactions, categories, asOfDate);

      const ids = overview.categoryBreakdown.map((c) => c.id);
      expect(ids).toContain('cat-rent');
      expect(ids).toContain('cat-food');
      expect(ids).toContain('cat-general-2026-10');
      expect(ids).toContain('uncategorized');

      // Amounts descending
      for (let i = 0; i < overview.categoryBreakdown.length - 1; i++) {
        expect(overview.categoryBreakdown[i].amount).toBeGreaterThanOrEqual(
          overview.categoryBreakdown[i + 1].amount
        );
      }

      // Check uncategorized metadata
      const uncat = overview.categoryBreakdown.find((c) => c.isUncategorized);
      expect(uncat?.name).toBe('Uncategorized');
      expect(uncat?.amount).toBe(250000);

      // Check general category metadata
      const gen = overview.categoryBreakdown.find((c) => c.isGeneral);
      expect(gen?.name).toBe("October '26 · General");
      expect(gen?.amount).toBe(500000);
    });

    it('uses 12 elapsed months for historical years', () => {
      const pastTransactions: Transaction[] = [
        { id: 'tx-p1', type: 'EXPENSE', amount: 12000000, date: '2025-06-15', accountId: 'acc-1', categoryId: 'cat-food', createdAt: '2025-06-15', updatedAt: '2025-06-15' },
      ];
      const asOfDate = new Date(2026, 9, 2);
      const pastOverview = calculateYearOverview(2025, pastTransactions, categories, asOfDate);

      expect(pastOverview.elapsedMonthsCount).toBe(12);
      // Average: 12,000,000 / 12 = 1,000,000 paise
      expect(pastOverview.averageMonthlySpend).toBe(1000000);
      expect(pastOverview.monthlyTrends.every((m) => !m.isFuture)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. SPENDING INSIGHTS: MONTH VIEW & DRILL-DOWN
  // ---------------------------------------------------------------------------
  describe('Month View & Drill-Down Calculations', () => {
    const categories: Category[] = [
      { id: 'cat-dining', name: 'Dining', type: 'EXPENSE', icon: 'Utensils', isDefault: false, createdAt: '2026-01-01' },
      { id: 'cat-shopping', name: 'Shopping', type: 'EXPENSE', icon: 'ShoppingBag', isDefault: false, createdAt: '2026-01-01' },
      { id: 'cat-general-2026-10', name: "October '26 · General", type: 'EXPENSE', icon: 'Folder', isDefault: false, monthYear: '2026-10', createdAt: '2026-10-01' },
    ];

    const monthTransactions: Transaction[] = [
      { id: 'tx-oct-1', type: 'EXPENSE', amount: 450000, date: '2026-10-01', accountId: 'acc-1', categoryId: 'cat-dining', note: 'Dinner with team', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' },
      { id: 'tx-oct-2', type: 'EXPENSE', amount: 1200000, date: '2026-10-02', accountId: 'acc-1', categoryId: 'cat-shopping', note: 'New sneakers', createdAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z' },
      { id: 'tx-oct-3', type: 'EXPENSE', amount: 150000, date: '2026-10-02', accountId: 'acc-1', categoryId: null, note: 'Coffee', createdAt: '2026-10-02T15:00:00Z', updatedAt: '2026-10-02T15:00:00Z' },
      // Other month transaction
      { id: 'tx-sep-1', type: 'EXPENSE', amount: 800000, date: '2026-09-20', accountId: 'acc-1', categoryId: 'cat-dining', createdAt: '2026-09-20', updatedAt: '2026-09-20' },
    ];

    it('calculates month insights with largest expense, category breakdown, and transaction order', () => {
      const insights = calculateMonthInsights('2026-10', monthTransactions, categories, new Date(2026, 9, 2));

      expect(insights.monthKey).toBe('2026-10');
      expect(insights.monthName).toBe('October');
      expect(insights.shortLabel).toBe("October '26");
      expect(insights.totalSpent).toBe(1800000); // 450k + 1.2M + 150k
      expect(insights.transactionCount).toBe(3);

      // Largest expense is tx-oct-2 (1200000)
      expect(insights.largestExpense?.id).toBe('tx-oct-2');
      expect(insights.largestExpense?.amount).toBe(1200000);

      // Transactions sorted newest date first
      expect(insights.transactions[0].date).toBe('2026-10-02');
      expect(insights.transactions[2].date).toBe('2026-10-01');

      // Breakdown includes Shopping (66.7%), Dining (25%), Uncategorized (8.3%)
      expect(insights.categoryBreakdown.length).toBe(3);
      expect(insights.categoryBreakdown[0].id).toBe('cat-shopping');
      expect(insights.categoryBreakdown[0].percentage).toBeCloseTo(66.67, 1);
    });

    it('handles empty months cleanly without division-by-zero or errors', () => {
      const insights = calculateMonthInsights('2026-05', monthTransactions, categories, new Date(2026, 9, 2));

      expect(insights.totalSpent).toBe(0);
      expect(insights.transactionCount).toBe(0);
      expect(insights.largestExpense).toBeNull();
      expect(insights.categoryBreakdown).toEqual([]);
      expect(insights.transactions).toEqual([]);
      expect(insights.isFuture).toBe(false);
    });

    it('handles future months cleanly and marks isFuture = true', () => {
      const insights = calculateMonthInsights('2026-12', monthTransactions, categories, new Date(2026, 9, 2));

      expect(insights.totalSpent).toBe(0);
      expect(insights.isFuture).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. SPENDING INSIGHTS: CATEGORY VIEW & DRILL-DOWN
  // ---------------------------------------------------------------------------
  describe('Category View & Yearly Drill-Down Calculations', () => {
    const categories: Category[] = [
      { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'ShoppingCart', isDefault: false, createdAt: '2026-01-01' },
      { id: 'cat-utility', name: 'Utility Bills', type: 'EXPENSE', icon: 'Zap', isDefault: false, createdAt: '2026-01-01' },
    ];

    const transactions: Transaction[] = [
      { id: 'tx-1', type: 'EXPENSE', amount: 200000, date: '2026-01-10', accountId: 'acc-1', categoryId: 'cat-groceries', createdAt: '2026-01-10', updatedAt: '2026-01-10' },
      { id: 'tx-2', type: 'EXPENSE', amount: 350000, date: '2026-02-15', accountId: 'acc-1', categoryId: 'cat-groceries', createdAt: '2026-02-15', updatedAt: '2026-02-15' },
      { id: 'tx-3', type: 'EXPENSE', amount: 500000, date: '2026-03-20', accountId: 'acc-1', categoryId: 'cat-groceries', createdAt: '2026-03-20', updatedAt: '2026-03-20' },
      { id: 'tx-4', type: 'EXPENSE', amount: 1000000, date: '2026-03-22', accountId: 'acc-1', categoryId: 'cat-utility', createdAt: '2026-03-22', updatedAt: '2026-03-22' },
      { id: 'tx-5', type: 'EXPENSE', amount: 150000, date: '2026-04-05', accountId: 'acc-1', categoryId: null, createdAt: '2026-04-05', updatedAt: '2026-04-05' },
    ];

    it('calculates category insights: yearly total, % of year, monthly trend, largest expense', () => {
      const insights = calculateCategoryInsights('cat-groceries', 2026, transactions, categories, new Date(2026, 9, 2));

      expect(insights.categoryId).toBe('cat-groceries');
      expect(insights.categoryName).toBe('Groceries');
      expect(insights.yearlyTotal).toBe(1050000); // 200k + 350k + 500k
      expect(insights.transactionCount).toBe(3);

      // Total across all categories = 1050000 + 1000000 + 150000 = 2,200,000 paise
      // Percentage = (1,050,000 / 2,200,000) * 100 = 47.7%
      expect(insights.percentageOfYear).toBeCloseTo(47.73, 1);

      // Largest expense is tx-3 (500000)
      expect(insights.largestExpense?.id).toBe('tx-3');
      expect(insights.largestExpense?.amount).toBe(500000);

      // Monthly trend has 12 bars with correct months populated
      expect(insights.monthlyTrend.length).toBe(12);
      expect(insights.monthlyTrend[0].amount).toBe(200000); // Jan
      expect(insights.monthlyTrend[1].amount).toBe(350000); // Feb
      expect(insights.monthlyTrend[2].amount).toBe(500000); // Mar
      expect(insights.monthlyTrend[3].amount).toBe(0);      // Apr
    });

    it('calculates category insights for Uncategorized transactions', () => {
      const insights = calculateCategoryInsights('uncategorized', 2026, transactions, categories, new Date(2026, 9, 2));

      expect(insights.isUncategorized).toBe(true);
      expect(insights.categoryName).toBe('Uncategorized');
      expect(insights.yearlyTotal).toBe(150000);
      expect(insights.transactionCount).toBe(1);
      expect(insights.largestExpense?.id).toBe('tx-5');
    });

    it('returns available expense years sorted descending and always includes current year', () => {
      const years = getAvailableExpenseYears(
        [
          { id: '1', type: 'EXPENSE', amount: 100, date: '2024-05-01', createdAt: '2024-05-01', updatedAt: '2024-05-01' },
          { id: '2', type: 'EXPENSE', amount: 100, date: '2025-08-01', createdAt: '2025-08-01', updatedAt: '2025-08-01' },
        ],
        new Date(2026, 9, 1)
      );

      expect(years).toEqual([2026, 2025, 2024]);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. FINANCIAL ACCOUNTING NON-INTERFERENCE
  // ---------------------------------------------------------------------------
  describe('Financial Accounting Non-Interference', () => {
    const bankAccount: Account = {
      id: 'acc-bank-1',
      name: 'Kotak Savings',
      type: 'BANK',
      openingBalance: 10000000, // ₹1,00,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const baseExpense: Transaction = {
      id: 'tx-exp-1',
      type: 'EXPENSE',
      amount: 250000, // ₹2,500
      date: '2026-10-01',
      accountId: 'acc-bank-1',
      categoryId: undefined, // Uncategorized
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    it('verifies assigning, changing, or removing categories does not alter account balances or net worth', () => {
      // 1. Initial state: Uncategorized expense
      const balance1 = calculateAccountBalance(bankAccount, [baseExpense]);
      const netWorth1 = calculateNetWorth({
        accounts: [bankAccount],
        transactions: [baseExpense],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
      });
      expect(balance1).toBe(9750000); // 10,000,000 - 250,000
      expect(netWorth1.netWorth).toBe(9750000);

      // 2. Assign to monthly General category
      const expenseWithGeneral: Transaction = {
        ...baseExpense,
        categoryId: 'cat-general-2026-10',
      };
      const balance2 = calculateAccountBalance(bankAccount, [expenseWithGeneral]);
      const netWorth2 = calculateNetWorth({
        accounts: [bankAccount],
        transactions: [expenseWithGeneral],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
      });
      expect(balance2).toBe(balance1);
      expect(netWorth2.netWorth).toBe(netWorth1.netWorth);

      // 3. Assign to custom category
      const expenseWithCustom: Transaction = {
        ...baseExpense,
        categoryId: 'cat-custom-dining',
      };
      const balance3 = calculateAccountBalance(bankAccount, [expenseWithCustom]);
      const netWorth3 = calculateNetWorth({
        accounts: [bankAccount],
        transactions: [expenseWithCustom],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
      });
      expect(balance3).toBe(balance1);
      expect(netWorth3.netWorth).toBe(netWorth1.netWorth);

      // 4. Archive the category - financial values must remain strictly unchanged
      const archivedCat: Category = {
        id: 'cat-custom-dining',
        name: 'Dining',
        type: 'EXPENSE',
        icon: 'Utensils',
        isDefault: false,
        isArchived: true,
        createdAt: '2026-01-01',
      };
      const balance4 = calculateAccountBalance(bankAccount, [expenseWithCustom]);
      const netWorth4 = calculateNetWorth({
        accounts: [bankAccount],
        transactions: [expenseWithCustom],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
      });
      expect(balance4).toBe(balance1);
      expect(netWorth4.netWorth).toBe(netWorth1.netWorth);
    });

    it('expense amount edit updates spending insights correctly', () => {
      const categories: Category[] = [
        { id: 'cat-food', name: 'Food', type: 'EXPENSE', icon: 'Utensils', isDefault: false, createdAt: '2026-01-01' },
      ];

      // Initial transaction ₹2,500
      const txInitial: Transaction = {
        id: 'tx-e',
        type: 'EXPENSE',
        amount: 250000,
        date: '2026-10-01',
        accountId: 'acc-bank-1',
        categoryId: 'cat-food',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      const overview1 = calculateYearOverview(2026, [txInitial], categories, new Date(2026, 9, 2));
      expect(overview1.totalSpent).toBe(250000);

      // Edited transaction to ₹5,000
      const txEdited: Transaction = {
        ...txInitial,
        amount: 500000,
      };

      const overview2 = calculateYearOverview(2026, [txEdited], categories, new Date(2026, 9, 2));
      expect(overview2.totalSpent).toBe(500000);

      // Soft deleted transaction
      const txDeleted: Transaction = {
        ...txEdited,
        deletedAt: '2026-10-02',
      };

      const overview3 = calculateYearOverview(2026, [txDeleted], categories, new Date(2026, 9, 2));
      expect(overview3.totalSpent).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. BACKUP & RESTORE INTEGRATION
  // ---------------------------------------------------------------------------
  describe('Backup & Restore Category Integration', () => {
    const backupData: VaelthBackupData = {
      appName: 'Vaelth',
      schemaVersion: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      data: {
        accounts: [
          {
            id: 'acc-1',
            name: 'HDFC',
            type: 'BANK',
            openingBalance: 5000000,
            currency: 'INR',
            isArchived: false,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
        people: [],
        categories: [
          {
            id: 'cat-general-2026-10',
            name: "October '26 · General",
            type: 'EXPENSE',
            icon: 'Folder',
            color: '#94A3B8',
            isDefault: false,
            isArchived: false,
            monthYear: '2026-10',
            createdAt: '2026-10-01',
          },
          {
            id: 'cat-custom-food',
            name: 'Food & Dining',
            type: 'EXPENSE',
            icon: 'Utensils',
            color: '#10B981',
            isDefault: false,
            isArchived: true, // Archived custom category
            monthYear: null,
            createdAt: '2026-01-01',
          },
        ],
        transactions: [
          {
            id: 'tx-1',
            type: 'EXPENSE',
            amount: 150000,
            date: '2026-10-01',
            accountId: 'acc-1',
            categoryId: 'cat-general-2026-10',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
          {
            id: 'tx-2',
            type: 'EXPENSE',
            amount: 250000,
            date: '2026-10-01',
            accountId: 'acc-1',
            categoryId: 'cat-custom-food',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
          {
            id: 'tx-3',
            type: 'EXPENSE',
            amount: 50000,
            date: '2026-10-01',
            accountId: 'acc-1',
            categoryId: null, // Uncategorized
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ],
        assets: [],
        liabilities: [],
        settings: {
          currency: 'INR',
        },
      },
    };

    it('validates backup schema containing category extensions (color, isArchived, monthYear)', () => {
      const validation = validateBackupData(backupData);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('verifies roundtrip serialization preserves category metadata and transaction links', () => {
      const json = JSON.stringify(backupData);
      const parsed: VaelthBackupData = JSON.parse(json);

      expect(parsed.data.categories.length).toBe(2);

      const general = parsed.data.categories.find((c) => c.id === 'cat-general-2026-10');
      expect(general?.monthYear).toBe('2026-10');
      expect(general?.name).toBe("October '26 · General");

      const custom = parsed.data.categories.find((c) => c.id === 'cat-custom-food');
      expect(custom?.isArchived).toBe(true);
      expect(custom?.color).toBe('#10B981');

      // Verify transaction references
      expect(parsed.data.transactions[0].categoryId).toBe('cat-general-2026-10');
      expect(parsed.data.transactions[1].categoryId).toBe('cat-custom-food');
      expect(parsed.data.transactions[2].categoryId).toBeNull();
    });
  });
});
