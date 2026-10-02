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
import { getCurrentLocalMonthString, getTodayLocalDateString, parseLocalDate, formatDateIso } from '../../utils/dateUtils';

/**
 * Filter active (non-soft-deleted) transactions.
 */
export function getActiveTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => !tx.deletedAt);
}

/**
 * Normalizes an optional reference date into a YYYY-MM-DD local date string.
 * Defaults to today's local date.
 */
export function normalizeAsOfDate(asOfDate?: string | Date): string {
  if (asOfDate instanceof Date) return formatDateIso(asOfDate);
  if (typeof asOfDate === 'string' && asOfDate.trim().length > 0) return asOfDate.trim();
  return getTodayLocalDateString();
}

/**
 * Calculates the exact balance for a single account based on its opening balance
 * and all active transactions affecting it up to the requested reference date (defaults to today).
 * Future transactions do not affect current balances.
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
  asOfDate?: string | Date
): number {
  let balance = Math.round(account.openingBalance);
  const cutoff = normalizeAsOfDate(asOfDate);
  const activeTx = getActiveTransactions(transactions).filter((tx) => !cutoff || tx.date <= cutoff);

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
 * Calculates balances for all accounts in one fast pass up to the reference date.
 * Future transactions are excluded from current balance calculations.
 */
export function calculateAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
  asOfDate?: string | Date
): Map<string, number> {
  const map = new Map<string, number>();
  for (const acc of accounts) {
    map.set(acc.id, Math.round(acc.openingBalance));
  }

  const cutoff = normalizeAsOfDate(asOfDate);
  const activeTx = getActiveTransactions(transactions).filter((tx) => !cutoff || tx.date <= cutoff);
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

  const today = referenceDateStr ? normalizeAsOfDate(referenceDateStr) : getTodayLocalDateString();

  const activeTx = getActiveTransactions(transactions)
    .filter((tx) => tx.personId === personObj.id && tx.date <= today)
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
 * Calculates debt summaries for people up to the requested reference date.
 * If includeArchived is false, it returns all non-archived people PLUS any archived people
 * who have an outstanding balance (so active balances are never erased or hidden).
 */
export function calculateAllPersonDebts(
  people: Person[],
  transactions: Transaction[],
  referenceDateStr?: string,
  includeArchived = false
): PersonDebtSummary[] {
  const cutoff = referenceDateStr ? normalizeAsOfDate(referenceDateStr) : getTodayLocalDateString();
  const summaries = people.map((p) => calculatePersonDebt(p, transactions, cutoff));
  if (includeArchived) {
    return summaries;
  }
  // Include non-archived people PLUS any archived people who still have outstanding balance
  return summaries.filter((s) => !s.person.isArchived || s.owedToYou > 0 || s.youOwe > 0);
}

/**
 * Total receivables (sum of money owed to user across all people).
 * Always includes archived people with outstanding receivables so net worth is never corrupted.
 * Excludes future transactions.
 */
export function calculateTotalReceivables(
  people: Person[],
  transactions: Transaction[],
  asOfDate?: string | Date
): number {
  const cutoff = normalizeAsOfDate(asOfDate);
  const summaries = calculateAllPersonDebts(people, transactions, cutoff, true);
  return summaries.reduce((acc, curr) => addMinor(acc, curr.owedToYou), 0);
}

/**
 * Total payables (sum of money user owes across all people).
 * Always includes archived people with outstanding payables so net worth is never corrupted.
 * Excludes future transactions.
 */
export function calculateTotalPayables(
  people: Person[],
  transactions: Transaction[],
  asOfDate?: string | Date
): number {
  const cutoff = normalizeAsOfDate(asOfDate);
  const summaries = calculateAllPersonDebts(people, transactions, cutoff, true);
  return summaries.reduce((acc, curr) => addMinor(acc, curr.youOwe), 0);
}

/**
 * Total physical / investment standalone assets valuation.
 */
export function calculateTotalPhysicalAssets(assets: Asset[], asOfDateStr?: string): number {
  return assets
    .filter((a) => !a.isArchived)
    .filter((a) => !asOfDateStr || !a.createdAt || a.createdAt.slice(0, 10) <= asOfDateStr)
    .reduce((acc, curr) => addMinor(acc, Math.round(curr.currentValue)), 0);
}

/**
 * Total standalone liabilities (personal loans, credit debt not in accounts).
 * Deduplicates credit-card liabilities by explicit IDs/relations only, never by name.
 */
export function calculateTotalStandaloneLiabilities(
  liabilities: Liability[],
  accounts?: Account[],
  asOfDateStr?: string
): number {
  return liabilities
    .filter((l) => !l.isArchived)
    .filter((l) => !asOfDateStr || !l.createdAt || l.createdAt.slice(0, 10) <= asOfDateStr)
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
        asOfDate?: string | Date;
        startingNetWorth?: number;
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
  let asOfDateStr: string = getTodayLocalDateString();
  let explicitStartingNetWorth: number | undefined;

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
    explicitStartingNetWorth = paramsOrTx.startingNetWorth;
    if (paramsOrTx.asOfDate) {
      asOfDateStr = normalizeAsOfDate(paramsOrTx.asOfDate);
    } else if (paramsOrTx.referenceDate) {
      asOfDateStr = formatDateIso(paramsOrTx.referenceDate);
    } else if (paramsOrTx.currentMonthStr) {
      asOfDateStr = `${paramsOrTx.currentMonthStr}-31`;
    } else {
      asOfDateStr = getTodayLocalDateString();
    }
  }

  // Account balances as of reference date (excludes future transactions)
  const accountBalances = calculateAllAccountBalances(accounts, transactions, asOfDateStr);
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

  // Receivables & Payables as of reference date
  const totalReceivables = calculateTotalReceivables(people, transactions, asOfDateStr);
  const totalPayables = calculateTotalPayables(people, transactions, asOfDateStr);

  // Physical assets & liabilities as of reference date (deduplicating credit cards to prevent double counting)
  const totalPhysicalAssets = calculateTotalPhysicalAssets(physicalAssets, asOfDateStr);
  const totalStandaloneLiabilities = calculateTotalStandaloneLiabilities(
    standaloneLiabilities,
    accounts,
    asOfDateStr
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

  // Calculate this month's realized income & expenses up to asOfDateStr
  const targetMonth = currentMonthStr ?? asOfDateStr.slice(0, 7);
  const startOfMonth = `${targetMonth}-01`;
  let incomeMonth = 0;
  let expenseMonth = 0;

  const ccAccountIds = new Set(
    accounts.filter((a) => a.type === 'CREDIT_CARD').map((a) => a.id)
  );

  const activeTx = getActiveTransactions(transactions).filter((tx) => tx.date <= asOfDateStr);
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

  let startNetWorth = explicitStartingNetWorth;
  if (startNetWorth === undefined) {
    if (asOfDateStr < startOfMonth) {
      startNetWorth = netWorth;
    } else {
      // Calculate true Net Worth at start of month (before startOfMonth)
      const txBeforeStart = activeTx.filter((tx) => tx.date < startOfMonth);
      const accountBalancesStart = calculateAllAccountBalances(accounts, txBeforeStart, `${startOfMonth}`);
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

      const totalReceivablesStart = calculateTotalReceivables(people, txBeforeStart, `${startOfMonth}`);
      const totalPayablesStart = calculateTotalPayables(people, txBeforeStart, `${startOfMonth}`);

      // Restore book value of assets sold during target month up to asOfDate
      const salesByAssetId = new Map<string, number>();
      for (const sale of activeTx) {
        if (sale.date >= startOfMonth && sale.date <= asOfDateStr && sale.type === 'ASSET_SALE' && sale.assetId) {
          let bookValueSold = Math.abs(sale.amount);
          if (sale.metadata) {
            try {
              const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata;
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
      startNetWorth = subMinor(
        addMinor(totalAssetsStart, totalReceivablesStart),
        addMinor(totalLiabilitiesStart, totalPayablesStart)
      );
    }
  }

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
