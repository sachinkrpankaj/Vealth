import { Transaction, Category } from './types';

export interface MonthlySpendTrend {
  monthIndex: number; // 0 - 11
  monthKey: string;   // YYYY-MM
  monthName: string;  // e.g. "January"
  shortLabel: string; // e.g. "Jan '26"
  amount: number;     // minor units (paise)
  transactionCount: number;
  isCurrentMonth: boolean;
  isFuture: boolean;
  percentageOfPeak: number; // 0 - 100 for visual chart bar heights
}

export interface CategorySpendSummary {
  id: string;
  name: string;
  icon: string;
  color?: string;
  amount: number; // minor units (paise)
  percentage: number; // 0 - 100
  transactionCount: number;
  isGeneral: boolean;
  isUncategorized: boolean;
}

export interface YearOverviewInsights {
  year: number;
  totalSpent: number; // minor units (paise)
  averageMonthlySpend: number; // minor units (paise)
  elapsedMonthsCount: number;
  highestSpendMonth: {
    monthKey: string;
    monthName: string;
    shortLabel: string;
    amount: number;
  } | null;
  topCategory: CategorySpendSummary | null;
  monthlyTrends: MonthlySpendTrend[];
  categoryBreakdown: CategorySpendSummary[];
}

export interface MonthInsights {
  year: number;
  monthIndex: number; // 0 - 11
  monthKey: string;   // YYYY-MM
  monthName: string;  // e.g. "October"
  shortLabel: string; // e.g. "October '26"
  totalSpent: number; // minor units
  transactionCount: number;
  largestExpense: Transaction | null;
  categoryBreakdown: CategorySpendSummary[];
  transactions: Transaction[];
  isCurrentMonth: boolean;
  isFuture: boolean;
}

export interface CategoryInsights {
  categoryId: string;
  categoryName: string;
  category: Category | null;
  isGeneral: boolean;
  isUncategorized: boolean;
  year: number;
  yearlyTotal: number;
  percentageOfYear: number;
  transactionCount: number;
  largestExpense: Transaction | null;
  monthlyTrend: MonthlySpendTrend[];
  transactions: Transaction[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function getLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Extracts all distinct calendar years with expense transactions, including current year.
 * Sorted descending (e.g. [2026, 2025, 2024]).
 */
export function getAvailableExpenseYears(
  transactions: Transaction[],
  currentDate: Date = new Date()
): number[] {
  const years = new Set<number>();
  years.add(currentDate.getFullYear());

  for (const tx of transactions) {
    if (tx.deletedAt || tx.type !== 'EXPENSE') continue;
    if (tx.date && tx.date.length >= 4) {
      const y = parseInt(tx.date.slice(0, 4), 10);
      if (!isNaN(y) && y > 2000 && y < 2100) {
        years.add(y);
      }
    }
  }

  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Resolves category metadata for a given category ID or fallback to uncategorized.
 */
export function resolveCategoryMeta(
  categoryId: string | null | undefined,
  categoryMap: Map<string, Category>
): {
  id: string;
  name: string;
  icon: string;
  color: string;
  isGeneral: boolean;
  isUncategorized: boolean;
} {
  if (!categoryId) {
    return {
      id: 'uncategorized',
      name: 'Uncategorized',
      icon: 'HelpCircle',
      color: '#94A3B8',
      isGeneral: false,
      isUncategorized: true,
    };
  }

  const cat = categoryMap.get(categoryId);
  if (!cat) {
    return {
      id: categoryId,
      name: categoryId.startsWith('cat-') ? categoryId.replace('cat-', '').replace(/-/g, ' ') : categoryId,
      icon: 'Folder',
      color: '#A855F7',
      isGeneral: false,
      isUncategorized: false,
    };
  }

  const isGeneral = typeof cat.monthYear === 'string' && cat.monthYear.trim().length > 0;

  return {
    id: cat.id,
    name: cat.name,
    icon: cat.icon || (isGeneral ? 'Folder' : 'Tag'),
    color: cat.color || (isGeneral ? '#94A3B8' : '#6366F1'),
    isGeneral,
    isUncategorized: false,
  };
}

/**
 * Calculates complete Year Overview spending insights.
 * Strict rule: Current-year analytics include only data through today; future months must not distort totals/averages.
 */
export function calculateYearOverview(
  year: number,
  transactions: Transaction[],
  categories: Category[],
  currentDate: Date = new Date()
): YearOverviewInsights {
  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth();
  const todayStr = getLocalDateStr(currentDate); // Local YYYY-MM-DD
  const yyStr = String(year).slice(-2);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Determine elapsed months count for current vs historical year
  let elapsedMonthsCount = 12;
  if (year === currentYear) {
    elapsedMonthsCount = currentMonthIdx + 1; // e.g. Oct is index 9 => 10 elapsed months
  } else if (year > currentYear) {
    elapsedMonthsCount = 0;
  }

  // Filter valid expenses for this year
  const yearExpenses = transactions.filter((tx) => {
    if (tx.deletedAt || tx.type !== 'EXPENSE') return false;
    if (!tx.date || !tx.date.startsWith(`${year}-`)) return false;
    // Ignore any future-dated transactions beyond today to prevent distortion
    if (tx.date > todayStr) return false;
    return true;
  });

  // Calculate monthly aggregates
  const monthlyAmounts = new Array<number>(12).fill(0);
  const monthlyCounts = new Array<number>(12).fill(0);

  // Category map for year
  const catAmounts = new Map<string, { amount: number; count: number }>();
  let totalSpent = 0;

  for (const tx of yearExpenses) {
    const amt = Math.max(0, Math.round(tx.amount));
    totalSpent += amt;

    const mIdx = parseInt(tx.date.slice(5, 7), 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      monthlyAmounts[mIdx] += amt;
      monthlyCounts[mIdx] += 1;
    }

    const catKey = tx.categoryId || 'uncategorized';
    const existing = catAmounts.get(catKey) || { amount: 0, count: 0 };
    existing.amount += amt;
    existing.count += 1;
    catAmounts.set(catKey, existing);
  }

  // Peak monthly spend for relative bar chart heights
  const peakMonthlySpend = Math.max(1, ...monthlyAmounts);

  // Construct monthly trends
  const monthlyTrends: MonthlySpendTrend[] = [];
  let highestSpendMonth: YearOverviewInsights['highestSpendMonth'] = null;
  let maxMonthAmount = -1;

  for (let m = 0; m < 12; m++) {
    const mmStr = String(m + 1).padStart(2, '0');
    const monthKey = `${year}-${mmStr}`;
    const monthName = MONTH_NAMES[m];
    const shortLabel = `${MONTH_SHORT_NAMES[m]} '${yyStr}`;
    const amount = monthlyAmounts[m];
    const isCurrentMonth = year === currentYear && m === currentMonthIdx;
    const isFuture = year === currentYear ? m > currentMonthIdx : year > currentYear;

    if (!isFuture && amount > maxMonthAmount && amount > 0) {
      maxMonthAmount = amount;
      highestSpendMonth = {
        monthKey,
        monthName,
        shortLabel,
        amount,
      };
    }

    monthlyTrends.push({
      monthIndex: m,
      monthKey,
      monthName,
      shortLabel,
      amount,
      transactionCount: monthlyCounts[m],
      isCurrentMonth,
      isFuture,
      percentageOfPeak: peakMonthlySpend > 0 ? Math.round((amount / peakMonthlySpend) * 100) : 0,
    });
  }

  // Construct category breakdown sorted descending
  const categoryBreakdown: CategorySpendSummary[] = Array.from(catAmounts.entries())
    .map(([catId, data]) => {
      const meta = resolveCategoryMeta(catId === 'uncategorized' ? null : catId, categoryMap);
      return {
        id: meta.id,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        amount: data.amount,
        percentage: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
        transactionCount: data.count,
        isGeneral: meta.isGeneral,
        isUncategorized: meta.isUncategorized,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const topCategory = categoryBreakdown.length > 0 && categoryBreakdown[0].amount > 0
    ? categoryBreakdown[0]
    : null;

  const averageMonthlySpend = elapsedMonthsCount > 0
    ? Math.round(totalSpent / elapsedMonthsCount)
    : 0;

  return {
    year,
    totalSpent,
    averageMonthlySpend,
    elapsedMonthsCount,
    highestSpendMonth,
    topCategory,
    monthlyTrends,
    categoryBreakdown,
  };
}

/**
 * Calculates complete Month View insights for a specific month.
 */
export function calculateMonthInsights(
  monthKey: string, // YYYY-MM
  transactions: Transaction[],
  categories: Category[],
  currentDate: Date = new Date()
): MonthInsights {
  const parts = monthKey.split('-');
  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;

  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth();
  const todayStr = getLocalDateStr(currentDate);
  const yyStr = String(year).slice(-2);

  const isCurrentMonth = year === currentYear && monthIndex === currentMonthIdx;
  const isFuture = year === currentYear ? monthIndex > currentMonthIdx : year > currentYear;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Filter transactions for this month
  const monthTransactions = transactions.filter((tx) => {
    if (tx.deletedAt || tx.type !== 'EXPENSE') return false;
    if (!tx.date || !tx.date.startsWith(`${monthKey}-`)) return false;
    // Don't count future-dated transactions
    if (tx.date > todayStr) return false;
    return true;
  });

  // Sort transactions newest date first
  monthTransactions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  let totalSpent = 0;
  let largestExpense: Transaction | null = null;
  let maxExpenseAmt = -1;

  const catAmounts = new Map<string, { amount: number; count: number }>();

  for (const tx of monthTransactions) {
    const amt = Math.max(0, Math.round(tx.amount));
    totalSpent += amt;

    if (amt > maxExpenseAmt) {
      maxExpenseAmt = amt;
      largestExpense = tx;
    }

    const catKey = tx.categoryId || 'uncategorized';
    const existing = catAmounts.get(catKey) || { amount: 0, count: 0 };
    existing.amount += amt;
    existing.count += 1;
    catAmounts.set(catKey, existing);
  }

  const categoryBreakdown: CategorySpendSummary[] = Array.from(catAmounts.entries())
    .map(([catId, data]) => {
      const meta = resolveCategoryMeta(catId === 'uncategorized' ? null : catId, categoryMap);
      return {
        id: meta.id,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        amount: data.amount,
        percentage: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
        transactionCount: data.count,
        isGeneral: meta.isGeneral,
        isUncategorized: meta.isUncategorized,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    year,
    monthIndex,
    monthKey,
    monthName: MONTH_NAMES[monthIndex],
    shortLabel: `${MONTH_NAMES[monthIndex]} '${yyStr}`,
    totalSpent,
    transactionCount: monthTransactions.length,
    largestExpense,
    categoryBreakdown,
    transactions: monthTransactions,
    isCurrentMonth,
    isFuture,
  };
}

/**
 * Calculates complete Category View insights for a specific category within a year.
 */
export function calculateCategoryInsights(
  categoryId: string, // category id or 'uncategorized'
  year: number,
  transactions: Transaction[],
  categories: Category[],
  currentDate: Date = new Date()
): CategoryInsights {
  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth();
  const todayStr = getLocalDateStr(currentDate);
  const yyStr = String(year).slice(-2);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const meta = resolveCategoryMeta(categoryId === 'uncategorized' ? null : categoryId, categoryMap);
  const category = categoryMap.get(categoryId) || null;

  // Filter expenses matching this category and year
  const matchingTx: Transaction[] = [];
  const monthlyAmounts = new Array<number>(12).fill(0);
  const monthlyCounts = new Array<number>(12).fill(0);

  let yearlyTotal = 0;
  let yearTotalAllCategories = 0;
  let largestExpense: Transaction | null = null;
  let maxAmt = -1;

  for (const tx of transactions) {
    if (tx.deletedAt || tx.type !== 'EXPENSE') continue;
    if (!tx.date || !tx.date.startsWith(`${year}-`)) continue;
    if (tx.date > todayStr) continue;

    const amt = Math.max(0, Math.round(tx.amount));
    yearTotalAllCategories += amt;

    const matches = categoryId === 'uncategorized'
      ? (!tx.categoryId || tx.categoryId === 'uncategorized')
      : tx.categoryId === categoryId;

    if (matches) {
      matchingTx.push(tx);
      yearlyTotal += amt;

      const mIdx = parseInt(tx.date.slice(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        monthlyAmounts[mIdx] += amt;
        monthlyCounts[mIdx] += 1;
      }

      if (amt > maxAmt) {
        maxAmt = amt;
        largestExpense = tx;
      }
    }
  }

  // Sort matching transactions newest first
  matchingTx.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const peakMonthlySpend = Math.max(1, ...monthlyAmounts);

  const monthlyTrend: MonthlySpendTrend[] = [];
  for (let m = 0; m < 12; m++) {
    const mmStr = String(m + 1).padStart(2, '0');
    const monthKey = `${year}-${mmStr}`;
    const monthName = MONTH_NAMES[m];
    const shortLabel = `${MONTH_SHORT_NAMES[m]} '${yyStr}`;
    const amount = monthlyAmounts[m];
    const isCurrentMonth = year === currentYear && m === currentMonthIdx;
    const isFuture = year === currentYear ? m > currentMonthIdx : year > currentYear;

    monthlyTrend.push({
      monthIndex: m,
      monthKey,
      monthName,
      shortLabel,
      amount,
      transactionCount: monthlyCounts[m],
      isCurrentMonth,
      isFuture,
      percentageOfPeak: peakMonthlySpend > 0 ? Math.round((amount / peakMonthlySpend) * 100) : 0,
    });
  }

  const percentageOfYear = yearTotalAllCategories > 0
    ? (yearlyTotal / yearTotalAllCategories) * 100
    : 0;

  return {
    categoryId: meta.id,
    categoryName: meta.name,
    category,
    isGeneral: meta.isGeneral,
    isUncategorized: meta.isUncategorized,
    year,
    yearlyTotal,
    percentageOfYear,
    transactionCount: matchingTx.length,
    largestExpense,
    monthlyTrend,
    transactions: matchingTx,
  };
}
