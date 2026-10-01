export type AccountType = 'CASH' | 'BANK' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER';

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

export type CategoryType = 'INCOME' | 'EXPENSE';

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

export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'LEND'
  | 'BORROW'
  | 'REPAYMENT_RECEIVED'
  | 'REPAYMENT_MADE'
  | 'TRANSFER'
  | 'ASSET_PURCHASE'
  | 'ASSET_SALE'
  | 'OTHER';

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
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type AssetCategory = 'GOLD' | 'VEHICLE' | 'PROPERTY' | 'ELECTRONICS' | 'INVESTMENT' | 'CASH' | 'OTHER';

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
}

export type LiabilityType = 'PERSONAL_LOAN' | 'CREDIT_CARD' | 'BORROWED_MONEY' | 'OTHER';

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
}
