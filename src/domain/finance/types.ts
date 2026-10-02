export const ACCOUNT_TYPES = ['CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT', 'OTHER'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number; // minor units (paise)
  creditLimit?: number; // minor units (paise) for CREDIT_CARD
  billingDay?: number; // day of each month (1-31) when statement is generated
  dueDay?: number; // day of each month (1-31) when bill is due
  currency: string;
  color?: string;
  icon?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  avatarColor: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color?: string;
  isDefault: boolean;
  isArchived?: boolean;
  monthYear?: string | null; // e.g. '2026-10' for monthly General, null for custom global categories
  createdAt: string;
  updatedAt?: string;
}

export const TRANSACTION_TYPES = [
  'INCOME',
  'EXPENSE',
  'LEND',
  'BORROW',
  'REPAYMENT_RECEIVED',
  'REPAYMENT_MADE',
  'TRANSFER',
  'ASSET_PURCHASE',
  'ASSET_SALE',
  'OTHER',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // minor units (paise > 0)
  date: string; // ISO 8601 YYYY-MM-DD
  accountId?: string; // Source or primary account
  destinationAccountId?: string; // For transfers
  personId?: string; // Target person for LEND, BORROW, REPAYMENTS
  categoryId?: string | null;
  assetId?: string;
  liabilityId?: string;
  note?: string;
  dueDate?: string;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export const ASSET_CATEGORIES = ['GOLD', 'VEHICLE', 'PROPERTY', 'ELECTRONICS', 'INVESTMENT', 'CASH', 'OTHER'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  currentValue: number; // minor units (paise)
  purchaseValue: number; // minor units (paise)
  purchaseDate: string;
  note?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  valuationHistory?: AssetValuation[];
  archiveHistory?: AssetArchiveState[];
}

export interface AssetValuation {
  effectiveDate: string;
  value: number;
  source: AssetValuationSource;
  createdAt?: string;
}

export const ASSET_VALUATION_SOURCES = ['PURCHASE', 'MANUAL', 'LEGACY_BASELINE'] as const;
export type AssetValuationSource = (typeof ASSET_VALUATION_SOURCES)[number];

export interface AssetArchiveState {
  effectiveDate: string;
  isArchived: boolean;
  createdAt?: string;
}

export const LIABILITY_TYPES = ['PERSONAL_LOAN', 'CREDIT_CARD', 'BORROWED_MONEY', 'OTHER'] as const;
export type LiabilityType = (typeof LIABILITY_TYPES)[number];

export interface Liability {
  id: string;
  name: string;
  amount: number; // minor units (paise)
  type: LiabilityType;
  personId?: string;
  dueDate?: string;
  note?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  amountHistory?: LiabilityValuation[];
  archiveHistory?: LiabilityArchiveState[];
}

export interface LiabilityValuation {
  effectiveDate: string;
  amount: number;
  source: LiabilityValuationSource;
  createdAt?: string;
}

export const LIABILITY_VALUATION_SOURCES = ['CREATED', 'MANUAL', 'LEGACY_BASELINE'] as const;
export type LiabilityValuationSource = (typeof LIABILITY_VALUATION_SOURCES)[number];

export interface LiabilityArchiveState {
  effectiveDate: string;
  isArchived: boolean;
  createdAt?: string;
}

export type DueDateStatus = 'DUE_TODAY' | 'DUE_SOON' | 'OVERDUE' | 'NO_DUE_DATE' | 'SETTLED';

export interface PersonDebtSummary {
  person: Person;
  owedToYou: number; // Positive integer in paise: person owes user
  youOwe: number;    // Positive integer in paise: user owes person
  netBalance: number; // Positive = person owes user; Negative = user owes person
  dueDate?: string;
  dueStatus: DueDateStatus;
  lastActivityDate?: string;
}

export interface NetWorthSummary {
  netWorth: number; // minor units (paise)
  totalAssets: number;
  totalLiabilities: number;
  totalAccountBalances: number;
  totalReceivables: number;
  totalPayables: number;
  totalPhysicalAssets: number;
  totalStandaloneLiabilities: number;
  incomeMonth: number;
  expenseMonth: number;
  netWorthChangeMonth: number;
}

export interface FinancialEffect {
  sourceAccountDelta: number;
  destinationAccountDelta: number;
  receivableDelta: number;
  payableDelta: number;
  assetDelta: number;
  netWorthDelta: number;
  descriptionLines: string[];
  isFuture: boolean;
}

export const SHOPPING_ITEM_STATUSES = ['PENDING', 'PURCHASED', 'DISCARDED'] as const;
export type ShoppingItemStatus = (typeof SHOPPING_ITEM_STATUSES)[number];

export interface ShoppingList {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  note?: string | null;
  productUrl?: string | null;
  estimatedPrice?: number | null; // in paise
  status: ShoppingItemStatus;
  createdAt: string;
  updatedAt: string;
  purchasedAt?: string | null; // ISO / local date
  purchasePrice?: number | null; // in paise
  purchaseAccountId?: string | null;
  transactionId?: string | null;
  categoryId?: string | null;
}

export interface ShoppingListSummary {
  list: ShoppingList;
  pendingCount: number;
  purchasedCount: number;
  discardedCount: number;
  estimatedPendingTotal: number; // in paise
  purchasedTotal: number; // in paise
}

