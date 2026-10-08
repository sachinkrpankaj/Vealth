import { calculateCategoryAnalytics } from '../../src/domain/finance/categoryAnalytics';
import { Category, Transaction } from '../../src/domain/finance/types';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx', type: 'EXPENSE', amount: 10000, date: '2026-10-06',
  accountId: 'bank', createdAt: '', updatedAt: '', ...overrides,
});
const category = (overrides: Partial<Category>): Category => ({
  id: 'cat-1791302400000-a1', name: 'Home improvements', color: '#1A8B50',
  type: 'EXPENSE', icon: 'Home', isDefault: false, createdAt: '', ...overrides,
});

describe('analytics category display and aggregation', () => {
  it('resolves custom and archived category names and colors without deriving labels from IDs', () => {
    const categories = [category({}), category({ id: 'archived', name: 'Former category', isArchived: true, color: '#123456' })];
    const result = calculateCategoryAnalytics([
      transaction({ categoryId: categories[0].id, amount: 30000 }),
      transaction({ categoryId: 'archived' }),
    ], categories, '2026-10', '2026-10-07');
    expect(result.expenseItems).toEqual([
      { id: categories[0].id, name: 'Home improvements', color: '#1A8B50', amount: 30000, percentage: 75 },
      { id: 'archived', name: 'Former category', color: '#123456', amount: 10000, percentage: 25 },
    ]);
  });

  it('never exposes timestamps, UUIDs, or unknown raw category IDs', () => {
    const result = calculateCategoryAnalytics([
      transaction({ categoryId: 'cat-1791302400000-a1' }),
      transaction({ categoryId: 'f2afe48a-793b-4e21-9e7e-084b9f921e7e' }),
      transaction({ categoryId: null }),
    ], [], '2026-10', '2026-10-07');
    expect(result.expenseItems.map((item) => item.name)).toEqual(['Uncategorized', 'Uncategorized', 'General']);
  });

  it('preserves realized totals, separate income categories, and excludes deleted/future/non-cashflow rows', () => {
    const result = calculateCategoryAnalytics([
      transaction({}), transaction({ type: 'INCOME', amount: 70000, categoryId: 'salary' }),
      transaction({ type: 'TRANSFER', amount: 50000 }),
      transaction({ deletedAt: '2026-10-07' }), transaction({ date: '2026-10-08' }),
      transaction({ date: '2026-09-30' }),
    ], [category({ id: 'salary', name: 'Salary', type: 'INCOME', color: '#ABCDEF' })], '2026-10', '2026-10-07');
    expect(result.totalExpense).toBe(10000);
    expect(result.totalIncome).toBe(70000);
    expect(result.incomeItems[0]).toMatchObject({ name: 'Salary', color: '#ABCDEF', percentage: 100 });
  });
});
