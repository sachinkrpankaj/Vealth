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
import { getCurrentLocalMonthString, getTodayLocalDateString, parseLocalDate } from '../../utils/dateUtils';

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
 * Only outstanding debt affects due status; settled debt is ignored.
 * Overpayments are prevented from converting into opposite debt types.
 */
export function calculatePersonDebt(
  person: Person | string,
  transactions: Transaction[],
  referenceDateStr?: string
): PersonDebtSummary {
  const personObj: Person =
    typeof person === 'string'
      ? {
          id: person,
          name: person,
          isArchived: false,
          avatarColor: '#6366F1',
          createdAt: '',
          updatedAt: '',
        }
      : person;

  let owedToYou = 0; // Money person owes the user (receivable)
  let youOwe = 0;    // Money user owes person (payable)
  let lastActivityDate: string | undefined = undefined;

  const activeTx = getActiveTransactions(transactions)
    .filter((tx) => tx.personId === personObj.id)
    .sort((a, b) => (a.date === b.date ? (a.createdAt || '').localeCompare(b.createdAt || '') : a.date.localeCompare(b.date)));

  // Track individual debt tranches so payments extinguish debts in FIFO order.
  // This ensures that when a past debt is repaid, its due date is fully settled and ignored.
  interface DebtTranche {
    id: string;
    unpaidAmount: number;
    dueDate?: string;
  }

  const outstandingLendTranches: DebtTranche[] = [];
  const outstandingBorrowTranches: DebtTranche[] = [];

  for (const tx of activeTx) {
    const amount = Math.abs(Math.round(tx.amount));

    if (!lastActivityDate || tx.date > lastActivityDate) {
      lastActivityDate = tx.date;
    }

    switch (tx.type) {
      case 'LEND':
        owedToYou = addMinor(owedToYou, amount);
        outstandingLendTranches.push({
          id: tx.id,
          unpaidAmount: amount,
          dueDate: tx.dueDate,
        });
        break;

      case 'REPAYMENT_RECEIVED': {
        owedToYou = subMinor(owedToYou, amount);
        // Extinguish lend tranches FIFO
        let rem = amount;
        for (const tranche of outstandingLendTranches) {
          if (rem <= 0) break;
          const pay = Math.min(tranche.unpaidAmount, rem);
          tranche.unpaidAmount = subMinor(tranche.unpaidAmount, pay);
          rem = subMinor(rem, pay);
        }
        break;
      }

      case 'BORROW':
        youOwe = addMinor(youOwe, amount);
        outstandingBorrowTranches.push({
          id: tx.id,
          unpaidAmount: amount,
          dueDate: tx.dueDate,
        });
        break;

      case 'REPAYMENT_MADE': {
        youOwe = subMinor(youOwe, amount);
        // Extinguish borrow tranches FIFO
        let rem = amount;
        for (const tranche of outstandingBorrowTranches) {
          if (rem <= 0) break;
          const pay = Math.min(tranche.unpaidAmount, rem);
          tranche.unpaidAmount = subMinor(tranche.unpaidAmount, pay);
          rem = subMinor(rem, pay);
        }
        break;
      }
    }
  }

  // Prevent/reject invalid overpayments: clamp to zero, never convert to the opposite debt type
  owedToYou = Math.max(0, owedToYou);
  youOwe = Math.max(0, youOwe);

  const netBalance = subMinor(owedToYou, youOwe);
  const today = referenceDateStr ?? getTodayLocalDateString();
  let dueStatus: DueDateStatus = 'NO_DUE_DATE';
  let nearestDueDate: string | undefined = undefined;

  if (netBalance === 0) {
    // Completely settled: settled debt must be ignored and have no due date!
    dueStatus = 'SETTLED';
    nearestDueDate = undefined;
  } else {
    // Only outstanding tranches on the NET side affect due date status
    const eligibleTranches: DebtTranche[] = [];
    if (netBalance > 0) {
      // The person owes user on net; only lend tranches define their due date to pay user
      for (const t of outstandingLendTranches) {
        if (t.unpaidAmount > 0 && t.dueDate) {
          eligibleTranches.push(t);
        }
      }
    } else if (netBalance < 0) {
      // The user owes this person on net; only borrow tranches define user's due date to pay them
      for (const t of outstandingBorrowTranches) {
        if (t.unpaidAmount > 0 && t.dueDate) {
          eligibleTranches.push(t);
        }
      }
    }

    for (const t of eligibleTranches) {
      if (t.dueDate) {
        if (!nearestDueDate || t.dueDate < nearestDueDate) {
          nearestDueDate = t.dueDate;
        }
      }
    }

    if (nearestDueDate) {
      if (nearestDueDate < today) {
        dueStatus = 'OVERDUE';
      } else if (nearestDueDate === today) {
        dueStatus = 'DUE_TODAY';
      } else {
        const dueTs = parseLocalDate(nearestDueDate)?.getTime() ?? 0;
        const todayTs = parseLocalDate(today)?.getTime() ?? 0;
        const diffMs = dueTs - todayTs;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          dueStatus = 'DUE_SOON';
        } else {
          dueStatus = 'NO_DUE_DATE';
        }
      }
    }
  }

  return {
    person: personObj,
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
 * Deduplicates credit-card liabilities by explicit IDs/relations only, never by name.
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
            (a.id === l.id || (a as any).liabilityId === l.id || (l as any).accountId === a.id)
        )
      ) {
        return false;
      }
      return true;
    })
    .reduce(
      (acc, curr) =>
        addMinor(
          acc,
          Math.round(curr.amount ?? (curr as any).remainingAmount ?? (curr as any).totalAmount ?? 0)
        ),
      0
    );
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
export function calculateNetWorth(
  paramsOrTx:
    | {
        accounts: Account[];
        people: Person[];
        physicalAssets: Asset[];
        standaloneLiabilities: Liability[];
        transactions: Transaction[];
        currentMonthStr?: string; // YYYY-MM
        referenceDate?: Date;
      }
    | Transaction[],
  accountsPos?: Account[],
  peoplePos?: Person[],
  physicalAssetsPos?: Asset[],
  standaloneLiabilitiesPos?: Liability[]
): NetWorthSummary {
  let accounts: Account[] = [];
  let people: Person[] = [];
  let physicalAssets: Asset[] = [];
  let standaloneLiabilities: Liability[] = [];
  let transactions: Transaction[] = [];
  let currentMonthStr: string | undefined;

  if (Array.isArray(paramsOrTx)) {
    transactions = paramsOrTx;
    accounts = accountsPos || [];
    people = peoplePos || [];
    physicalAssets = physicalAssetsPos || [];
    standaloneLiabilities = standaloneLiabilitiesPos || [];
  } else {
    accounts = paramsOrTx.accounts || [];
    people = paramsOrTx.people || [];
    physicalAssets = paramsOrTx.physicalAssets || [];
    standaloneLiabilities = paramsOrTx.standaloneLiabilities || [];
    transactions = paramsOrTx.transactions || [];
    currentMonthStr = paramsOrTx.currentMonthStr;
  }

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
  const targetMonth = currentMonthStr ?? getCurrentLocalMonthString(); // YYYY-MM
  const startOfMonth = `${targetMonth}-01`;
  let incomeMonth = 0;
  let expenseMonth = 0;

  const ccAccountIds = new Set(
    accounts.filter((a) => a.type === 'CREDIT_CARD').map((a) => a.id)
  );

  const activeTx = getActiveTransactions(transactions);
  for (const tx of activeTx) {
    if (tx.date.startsWith(targetMonth)) {
      if (tx.type === 'INCOME') {
        if (tx.accountId && ccAccountIds.has(tx.accountId)) {
          // Refunds and statement credits on credit cards reduce card spending rather than inflating income
          expenseMonth = Math.max(0, subMinor(expenseMonth, Math.abs(tx.amount)));
        } else {
          incomeMonth = addMinor(incomeMonth, Math.abs(tx.amount));
        }
      } else if (tx.type === 'EXPENSE') {
        expenseMonth = addMinor(expenseMonth, Math.abs(tx.amount));
      }
    }
  }

  // Calculate true Net Worth at start of month (before startOfMonth)
  const txBeforeStart = activeTx.filter((tx) => tx.date < startOfMonth);
  const accountBalancesStart = calculateAllAccountBalances(accounts, txBeforeStart);
  let totalPositiveAccountsStart = 0;
  let totalNegativeAccountsStart = 0;
  for (const acc of accounts) {
    const bal = accountBalancesStart.get(acc.id) ?? 0;
    if (acc.type === 'CREDIT_CARD') {
      if (bal > 0) totalPositiveAccountsStart = addMinor(totalPositiveAccountsStart, bal);
      else if (bal < 0) totalNegativeAccountsStart = addMinor(totalNegativeAccountsStart, Math.abs(bal));
    } else {
      if (bal >= 0) totalPositiveAccountsStart = addMinor(totalPositiveAccountsStart, bal);
      else if (bal < 0) totalNegativeAccountsStart = addMinor(totalNegativeAccountsStart, Math.abs(bal));
    }
  }

  const totalReceivablesStart = calculateTotalReceivables(people, txBeforeStart);
  const totalPayablesStart = calculateTotalPayables(people, txBeforeStart);

  // Restore book value of assets sold during or after target month
  const salesByAssetId = new Map<string, number>();
  for (const sale of activeTx) {
    if (sale.date >= startOfMonth && sale.type === 'ASSET_SALE' && sale.assetId) {
      let bookValueSold = Math.abs(sale.amount);
      if (sale.metadata) {
        try {
          const meta = JSON.parse(sale.metadata);
          if (meta.bookValueSold !== undefined) bookValueSold = meta.bookValueSold;
          else if (meta.assetValueDeducted !== undefined) bookValueSold = meta.assetValueDeducted;
        } catch {}
      }
      salesByAssetId.set(sale.assetId, addMinor(salesByAssetId.get(sale.assetId) ?? 0, bookValueSold));
    }
  }

  let totalPhysicalAssetsStart = 0;
  for (const ast of physicalAssets) {
    if (ast.createdAt && ast.createdAt.slice(0, 10) >= startOfMonth) {
      continue;
    }
    const soldInOrAfter = salesByAssetId.get(ast.id) ?? 0;
    const initialVal = addMinor(Math.round(ast.currentValue), soldInOrAfter);
    totalPhysicalAssetsStart = addMinor(totalPhysicalAssetsStart, initialVal);
  }

  let totalStandaloneLiabilitiesStart = 0;
  for (const l of standaloneLiabilities) {
    if (l.isArchived) continue;
    if (l.createdAt && l.createdAt.slice(0, 10) >= startOfMonth) continue;
    if (
      accounts &&
      l.type === 'CREDIT_CARD' &&
      accounts.some((a) => a.type === 'CREDIT_CARD' && (a.id === l.id || (a as any).liabilityId === l.id || (l as any).accountId === a.id))
    ) {
      continue;
    }
    totalStandaloneLiabilitiesStart = addMinor(
      totalStandaloneLiabilitiesStart,
      Math.round(l.amount ?? (l as any).remainingAmount ?? (l as any).totalAmount ?? 0)
    );
  }

  const totalAssetsStart = addMinor(totalPositiveAccountsStart, totalPhysicalAssetsStart);
  const totalLiabilitiesStart = addMinor(totalNegativeAccountsStart, totalStandaloneLiabilitiesStart);
  const startNetWorth = subMinor(
    addMinor(totalAssetsStart, totalReceivablesStart),
    addMinor(totalLiabilitiesStart, totalPayablesStart)
  );

  const netWorthChangeMonth = subMinor(netWorth, startNetWorth);

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
