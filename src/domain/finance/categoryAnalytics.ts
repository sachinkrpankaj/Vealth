import { Category, Transaction } from './types';

export interface CategoryTotal {
  id: string;
  name: string;
  color?: string;
  amount: number;
  percentage: number;
}

/** Resolve display metadata from persisted categories, including archived history. */
export function calculateCategoryAnalytics(
  transactions: Transaction[],
  categories: Category[],
  month: string,
  asOfDate: string
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const expenseMap = new Map<string, number>();
  const incomeMap = new Map<string, number>();
  let totalExpense = 0;
  let totalIncome = 0;

  for (const transaction of transactions) {
    if (transaction.deletedAt || transaction.date.slice(0, 7) !== month || transaction.date > asOfDate) continue;
    const amount = Math.abs(transaction.amount);
    const key = transaction.categoryId || '';
    if (transaction.type === 'EXPENSE') {
      totalExpense += amount;
      expenseMap.set(key, (expenseMap.get(key) ?? 0) + amount);
    } else if (transaction.type === 'INCOME') {
      totalIncome += amount;
      incomeMap.set(key, (incomeMap.get(key) ?? 0) + amount);
    }
  }

  const toItems = (totals: Map<string, number>, total: number): CategoryTotal[] =>
    Array.from(totals, ([id, amount]) => {
      const category = categoryMap.get(id);
      return {
        id,
        // An ID cannot reliably reconstruct a deleted/imported category's name.
        name: category?.name || (id ? 'Uncategorized' : 'General'),
        color: category?.color,
        amount,
        percentage: total > 0 ? amount / total * 100 : 0,
      };
    }).sort((left, right) => right.amount - left.amount);

  return {
    expenseItems: toItems(expenseMap, totalExpense),
    incomeItems: toItems(incomeMap, totalIncome),
    totalExpense,
    totalIncome,
  };
}
