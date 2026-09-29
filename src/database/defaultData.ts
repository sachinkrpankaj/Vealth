import { Category } from '../domain/finance/types';

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'cat-salary', name: 'Salary', type: 'INCOME', icon: 'Briefcase', isDefault: true },
  { id: 'cat-freelance', name: 'Freelance', type: 'INCOME', icon: 'Laptop', isDefault: true },
  { id: 'cat-investment', name: 'Investment Returns', type: 'INCOME', icon: 'TrendingUp', isDefault: true },
  { id: 'cat-gift-in', name: 'Gift / Bonus', type: 'INCOME', icon: 'Gift', isDefault: true },
  { id: 'cat-refund', name: 'Refund', type: 'INCOME', icon: 'RotateCcw', isDefault: true },
  { id: 'cat-other-in', name: 'Other Income', type: 'INCOME', icon: 'PlusCircle', isDefault: true },
];

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'Utensils', isDefault: true },
  { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'Car', isDefault: true },
  { id: 'cat-shopping', name: 'Shopping', type: 'EXPENSE', icon: 'ShoppingBag', isDefault: true },
  { id: 'cat-bills', name: 'Bills & Utilities', type: 'EXPENSE', icon: 'Receipt', isDefault: true },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'EXPENSE', icon: 'Film', isDefault: true },
  { id: 'cat-education', name: 'Education', type: 'EXPENSE', icon: 'GraduationCap', isDefault: true },
  { id: 'cat-health', name: 'Health & Medical', type: 'EXPENSE', icon: 'HeartPulse', isDefault: true },
  { id: 'cat-travel', name: 'Travel', type: 'EXPENSE', icon: 'Plane', isDefault: true },
  { id: 'cat-subscriptions', name: 'Subscriptions', type: 'EXPENSE', icon: 'Tv', isDefault: true },
  { id: 'cat-personal', name: 'Personal Care', type: 'EXPENSE', icon: 'Smile', isDefault: true },
  { id: 'cat-other-exp', name: 'Other Expense', type: 'EXPENSE', icon: 'HelpCircle', isDefault: true },
];
