import {
  Account,
  Asset,
  DueDateStatus,
  Liability,
  NetWorthSummary,
  Person,
  PersonDebtSummary,
  Transaction,
} from './types';
import { addMinor, subMinor } from './currency';
import { getCreditCardBillingInfo } from './creditCardBilling';

/**
 * Filter active (non-soft-deleted) transactions.
 */
export function getActiveTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => !tx.deletedAt);
}

/**
 * Calculates the exact balance for a single account based on its opening balance
 * and all active transactions affecting it.
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  let balance = Math.round(account.openingBalance);
  const activeTx = getActiveTransactions(transactions);

  for (const tx of activeTx) {
    const amount = Math.abs(Math.round(tx.amount));

    // Source / Primary Account
    if (tx.accountId === account.id) {
      switch (tx.type) {
        case 'INCOME':
        case 'BORROW':
        case 'REPAYMENT_RECEIVED':
        case 'ASSET_SALE':
          balance = addMinor(balance, amount);
          break;

        case 'EXPENSE':
        case 'LEND':
        case 'REPAYMENT_MADE':
        case 'TRANSFER':
        case 'ASSET_PURCHASE':
          balance = subMinor(balance, amount);
          break;

        case 'OTHER':
        default:
          break;
      }
    }

    // Destination Account (Transfers)
    if (tx.destinationAccountId === account.id && tx.type === 'TRANSFER') {
      balance = addMinor(balance, amount);
    }
  }

  return balance;
}

/**
 * Calculates balances for all accounts in one fast pass.
 */
export function calculateAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const acc of accounts) {
    map.set(acc.id, Math.round(acc.openingBalance));
  }

  const activeTx = getActiveTransactions(transactions);
  for (const tx of activeTx) {
    const amount = Math.abs(Math.round(tx.amount));

    if (tx.accountId && map.has(tx.accountId)) {
      const current = map.get(tx.accountId)!;
      switch (tx.type) {
        case 'INCOME':
        case 'BORROW':
        case 'REPAYMENT_RECEIVED':
        case 'ASSET_SALE':
          map.set(tx.accountId, addMinor(current, amount));
          break;
        case 'EXPENSE':
        case 'LEND':
        case 'REPAYMENT_MADE':
        case 'TRANSFER':
        case 'ASSET_PURCHASE':
          map.set(tx.accountId, subMinor(current, amount));
          break;
      }
    }

    if (tx.destinationAccountId && tx.type === 'TRANSFER' && map.has(tx.destinationAccountId)) {
      const current = map.get(tx.destinationAccountId)!;
      map.set(tx.destinationAccountId, addMinor(current, amount));
    }
  }

  return map;
}

/**
 * Calculates the debt profile for a single person.
 */
export function calculatePersonDebt(
  person: Person,
  transactions: Transaction[],
  referenceDateStr?: string
): PersonDebtSummary {
  let owedToYou = 0; // Money person owes the user (receivable)
  let youOwe = 0;    // Money user owes person (payable)
  let nearestDueDate: string | undefined = undefined;
  let lastActivityDate: string | undefined = undefined;

  const activeTx = getActiveTransactions(transactions).filter(
    (tx) => tx.personId === person.id
  );

  for (const tx of activeTx) {
    const amount = Math.abs(Math.round(tx.amount));

    if (!lastActivityDate || tx.date > lastActivityDate) {
      lastActivityDate = tx.date;
    }

    if (tx.dueDate) {
      if (!nearestDueDate || tx.dueDate < nearestDueDate) {
        nearestDueDate = tx.dueDate;
      }
    }

    switch (tx.type) {
      case 'LEND':
        owedToYou = addMinor(owedToYou, amount);
        break;
      case 'REPAYMENT_RECEIVED':
        owedToYou = subMinor(owedToYou, amount);
        break;
      case 'BORROW':
        youOwe = addMinor(youOwe, amount);
        break;
      case 'REPAYMENT_MADE':
        youOwe = subMinor(youOwe, amount);
        break;
    }
  }

  // Handle over-repayment gracefully so it converts into the opposing balance
  // instead of becoming an unrecoverable negative phantom balance
  if (owedToYou < 0) {
    youOwe = addMinor(youOwe, Math.abs(owedToYou));
    owedToYou = 0;
  }
  if (youOwe < 0) {
    owedToYou = addMinor(owedToYou, Math.abs(youOwe));
    youOwe = 0;
  }

  const netBalance = subMinor(owedToYou, youOwe);

  // Determine Due Date Status
  const today = referenceDateStr ?? new Date().toISOString().split('T')[0];
  let dueStatus: DueDateStatus = 'NO_DUE_DATE';

  if (netBalance === 0) {
    dueStatus = 'SETTLED';
  } else if (nearestDueDate) {
    if (nearestDueDate < today) {
      dueStatus = 'OVERDUE';
    } else if (nearestDueDate === today) {
      dueStatus = 'DUE_TODAY';
    } else {
      const diffMs = new Date(nearestDueDate).getTime() - new Date(today).getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        dueStatus = 'DUE_SOON';
      } else {
        dueStatus = 'NO_DUE_DATE';
      }
    }
  }

  return {
    person,
    owedToYou,
    youOwe,
    netBalance,
    dueDate: nearestDueDate,
    dueStatus,
    lastActivityDate,
  };
}

/**
 * Calculates debt summaries for all people.
 */
export function calculateAllPersonDebts(
  people: Person[],
  transactions: Transaction[],
  referenceDateStr?: string
): PersonDebtSummary[] {
  return people
    .filter((p) => !p.isArchived)
    .map((p) => calculatePersonDebt(p, transactions, referenceDateStr));
}

/**
 * Total receivables (sum of money owed to user across all people).
 */
export function calculateTotalReceivables(
  people: Person[],
  transactions: Transaction[]
): number {
  const summaries = calculateAllPersonDebts(people, transactions);
  return summaries.reduce((acc, curr) => addMinor(acc, curr.owedToYou), 0);
}

/**
 * Total payables (sum of money user owes across all people).
 */
export function calculateTotalPayables(
  people: Person[],
  transactions: Transaction[]
): number {
  const summaries = calculateAllPersonDebts(people, transactions);
  return summaries.reduce((acc, curr) => addMinor(acc, curr.youOwe), 0);
}

/**
 * Total physical / investment standalone assets valuation.
 */
export function calculateTotalPhysicalAssets(assets: Asset[]): number {
  return assets
    .filter((a) => !a.isArchived)
    .reduce((acc, curr) => addMinor(acc, Math.round(curr.currentValue)), 0);
}

/**
 * Total standalone liabilities (personal loans, credit debt not in accounts).
 * Prevents double-counting if a credit card liability is already tracked via an account.
 */
export function calculateTotalStandaloneLiabilities(
  liabilities: Liability[],
  accounts?: Account[]
): number {
  return liabilities
    .filter((l) => !l.isArchived)
    .filter((l) => {
      if (
        accounts &&
        l.type === 'CREDIT_CARD' &&
        accounts.some(
          (a) =>
            a.type === 'CREDIT_CARD' &&
            (a.id === l.id || a.name.toLowerCase() === l.name.toLowerCase())
        )
      ) {
        return false;
      }
      return true;
    })
    .reduce((acc, curr) => addMinor(acc, Math.round(curr.amount)), 0);
}

/**
 * Master Net Worth calculation.
 * Formula: Net Worth = Total Assets - Total Liabilities
 *
 * Assets:
 * - Positive Account Balances (Cash, Bank, Investments, overpaid credit cards)
 * - Total Receivables (Money people owe user)
 * - Standalone Assets (Gold, Property, Vehicle, etc.)
 *
 * Liabilities:
 * - Negative Account Balances (Credit cards drawn, overdrafts)
 * - Total Payables (Money user owes people)
 * - Standalone Liabilities (Personal loans, etc. - deduplicated)
 */
export function calculateNetWorth(params: {
  accounts: Account[];
  people: Person[];
  physicalAssets: Asset[];
  standaloneLiabilities: Liability[];
  transactions: Transaction[];
  currentMonthStr?: string; // YYYY-MM
  referenceDate?: Date;
}): NetWorthSummary {
  const {
    accounts,
    people,
    physicalAssets,
    standaloneLiabilities,
    transactions,
    currentMonthStr,
  } = params;

  // Account balances
  const accountBalances = calculateAllAccountBalances(accounts, transactions);
  let totalPositiveAccounts = 0;
  let totalNegativeAccounts = 0;

  for (const acc of accounts) {
    const bal = accountBalances.get(acc.id) ?? 0;
    if (acc.type === 'CREDIT_CARD') {
      // Credit card limits are NEVER added to assets.
      // If balance is positive, it represents an overpaid surplus on the card.
      if (bal > 0) {
        totalPositiveAccounts = addMinor(totalPositiveAccounts, bal);
      } else if (bal < 0) {
        // Outstanding drawn balance is an active liability:
        // Expense on credit card reduces net worth immediately!
        // Payment via transfer from bank reduces liability and cash equally (net worth unchanged).
        totalNegativeAccounts = addMinor(totalNegativeAccounts, Math.abs(bal));
      }
    } else {
      if (bal >= 0) {
        totalPositiveAccounts = addMinor(totalPositiveAccounts, bal);
      } else {
        totalNegativeAccounts = addMinor(totalNegativeAccounts, Math.abs(bal));
      }
    }
  }

  // Receivables & Payables
  const totalReceivables = calculateTotalReceivables(people, transactions);
  const totalPayables = calculateTotalPayables(people, transactions);

  // Physical assets & liabilities (deduplicating credit cards to prevent double counting)
  const totalPhysicalAssets = calculateTotalPhysicalAssets(physicalAssets);
  const totalStandaloneLiabilities = calculateTotalStandaloneLiabilities(
    standaloneLiabilities,
    accounts
  );

  // Total Assets & Liabilities (Assets and Liabilities do not include personal credit/debt)
  const totalAssets = addMinor(
    totalPositiveAccounts,
    totalPhysicalAssets
  );

  const totalLiabilities = addMinor(
    totalNegativeAccounts,
    totalStandaloneLiabilities
  );

  // Net Worth includes Assets + Receivables (Credit to Collect) - Liabilities - Payables (Debt)
  const netWorth = subMinor(
    addMinor(totalAssets, totalReceivables),
    addMinor(totalLiabilities, totalPayables)
  );

  // Calculate this month's income & expenses
  const targetMonth = currentMonthStr ?? new Date().toISOString().slice(0, 7); // YYYY-MM
  let incomeMonth = 0;
  let expenseMonth = 0;

  const activeTx = getActiveTransactions(transactions);
  for (const tx of activeTx) {
    if (tx.date.startsWith(targetMonth)) {
      if (tx.type === 'INCOME') {
        incomeMonth = addMinor(incomeMonth, Math.abs(tx.amount));
      } else if (tx.type === 'EXPENSE') {
        expenseMonth = addMinor(expenseMonth, Math.abs(tx.amount));
      }
    }
  }

  const netWorthChangeMonth = subMinor(incomeMonth, expenseMonth);

  return {
    netWorth,
    totalAssets,
    totalLiabilities,
    totalAccountBalances: subMinor(totalPositiveAccounts, totalNegativeAccounts),
    totalReceivables,
    totalPayables,
    totalPhysicalAssets,
    totalStandaloneLiabilities,
    incomeMonth,
    expenseMonth,
    netWorthChangeMonth,
  };
}
