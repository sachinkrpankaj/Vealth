import { Account, Transaction } from './types';
import { addMinor, subMinor } from './currency';

function getActiveTx(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => !tx.deletedAt);
}

function getCardBalance(account: Account, transactions: Transaction[]): number {
  let balance = Math.round(account.openingBalance ?? 0);
  const activeTx = getActiveTx(transactions);

  for (const tx of activeTx) {
    const amount = Math.abs(Math.round(tx.amount));

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
      }
    }

    if (tx.destinationAccountId === account.id && tx.type === 'TRANSFER') {
      balance = addMinor(balance, amount);
    }
  }

  return balance;
}

export interface CreditCardBillingInfo {
  creditLimit: number; // total limit in paise
  usedAmount: number; // total currently drawn in paise (>= 0)
  remainingLimit: number; // creditLimit - usedAmount (>= 0)
  unpaidBillAmount: number; // amount billed and unpaid in paise (>= 0)
  unbilledAmount: number; // spend incurred after last billing date in paise (>= 0)
  billingDay: number; // day of month (1-31)
  dueDay: number; // day of month (1-31)
  lastBillingDate: string; // YYYY-MM-DD
  nextBillingDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD for the current/last bill
  isBillActive: boolean; // whether unpaidBillAmount > 0
  isOverdue: boolean; // whether reference date > dueDate and unpaidBillAmount > 0
}

/**
 * Returns ordinal string for a day of month, e.g. 1 -> "1st", 2 -> "2nd", 23 -> "23rd".
 */
export function formatDayOrdinal(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) return `${day}st`;
  if (j === 2 && k !== 12) return `${day}nd`;
  if (j === 3 && k !== 13) return `${day}rd`;
  return `${day}th`;
}

/**
 * Helper to get number of days in a given year and month (0-indexed).
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Format local Date to YYYY-MM-DD string without UTC conversion offset.
 */
function toLocalIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates complete billing cycle metrics for a credit card account.
 */
export function getCreditCardBillingInfo(
  account: Account,
  transactions: Transaction[],
  referenceDate: Date = new Date()
): CreditCardBillingInfo {
  const creditLimit = Math.max(0, account.creditLimit ?? 0);
  const billingDay = Math.min(31, Math.max(1, account.billingDay ?? 1));
  const dueDay = Math.min(31, Math.max(1, account.dueDay ?? 20));

  // Current balance of card (starts at 0; expenses make it negative, payments positive)
  const currentBalance = getCardBalance(account, transactions);
  const usedAmount = Math.max(0, -currentBalance);
  const remainingLimit = Math.max(0, creditLimit - usedAmount);

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const refDateStr = toLocalIsoDate(refYear, refMonth, refDay);

  // Billing days beyond the length of a month occur on its final day.
  let lastBillingYear = refYear;
  let lastBillingMonth = refMonth;
  const thisMonthBillingDay = Math.min(billingDay, getDaysInMonth(refYear, refMonth));
  if (refDay < thisMonthBillingDay) {
    lastBillingMonth -= 1;
    if (lastBillingMonth < 0) {
      lastBillingMonth = 11;
      lastBillingYear -= 1;
    }
  }
  const lastBillingDate = toLocalIsoDate(
    lastBillingYear, lastBillingMonth,
    Math.min(billingDay, getDaysInMonth(lastBillingYear, lastBillingMonth))
  );

  let nextBillingYear = lastBillingYear;
  let nextBillingMonth = lastBillingMonth + 1;
  if (nextBillingMonth > 11) {
    nextBillingMonth = 0;
    nextBillingYear += 1;
  }
  const nextBillingDate = toLocalIsoDate(
    nextBillingYear, nextBillingMonth,
    Math.min(billingDay, getDaysInMonth(nextBillingYear, nextBillingMonth))
  );

  // 3. Determine due date for the statement generated on lastBillingDate
  let dueYear = lastBillingYear;
  let dueMonth = lastBillingMonth;

  if (dueDay <= billingDay) {
    // Due date falls in the following month (standard card cycle)
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  const daysInDueMonth = getDaysInMonth(dueYear, dueMonth);
  const clampedDueDay = Math.min(dueDay, daysInDueMonth);
  const dueDate = toLocalIsoDate(dueYear, dueMonth, clampedDueDay);

  // 4. Calculate unpaid billed amount
  if (usedAmount === 0) {
    return {
      creditLimit,
      usedAmount: 0,
      remainingLimit: creditLimit,
      unpaidBillAmount: 0,
      unbilledAmount: 0,
      billingDay,
      dueDay,
      lastBillingDate,
      nextBillingDate,
      dueDate,
      isBillActive: false,
      isOverdue: false,
    };
  }

  // Active transactions
  const activeTx = getActiveTx(transactions);

  // Net debt incurred on or before lastBillingDate
  let billedBalance = Math.round(account.openingBalance ?? 0);
  let postBillingCredits = 0;

  for (const tx of activeTx) {
    const amount = Math.abs(Math.round(tx.amount));

    if (tx.accountId === account.id) {
      if (tx.date <= lastBillingDate) {
        if (['EXPENSE', 'LEND', 'REPAYMENT_MADE', 'TRANSFER', 'ASSET_PURCHASE'].includes(tx.type)) {
          billedBalance = subMinor(billedBalance, amount);
        } else if (['INCOME', 'BORROW', 'REPAYMENT_RECEIVED', 'ASSET_SALE'].includes(tx.type)) {
          billedBalance = addMinor(billedBalance, amount);
        }
      } else {
        // Credits/refunds posted after billing date reduce statement debt
        if (['INCOME', 'REPAYMENT_RECEIVED', 'ASSET_SALE'].includes(tx.type)) {
          postBillingCredits = addMinor(postBillingCredits, amount);
        }
      }
    }

    // Destination transfers (bill payments into card account)
    if (tx.destinationAccountId === account.id && tx.type === 'TRANSFER') {
      if (tx.date <= lastBillingDate) {
        billedBalance = addMinor(billedBalance, amount);
      } else {
        postBillingCredits = addMinor(postBillingCredits, amount);
      }
    }
  }

  const billedDebt = Math.max(0, -billedBalance);
  // Any payments and credits (refunds/transfers) made after statement date reduce this billed statement debt
  const unpaidBillAmount = Math.max(
    0,
    Math.min(usedAmount, subMinor(billedDebt, postBillingCredits))
  );
  // Unbilled spend represents post-statement charges (cleanly partitioned without double counting)
  const unbilledAmount = Math.max(0, subMinor(usedAmount, unpaidBillAmount));
  const isBillActive = unpaidBillAmount > 0;
  const isOverdue = isBillActive && refDateStr > dueDate;

  return {
    creditLimit,
    usedAmount,
    remainingLimit,
    unpaidBillAmount,
    unbilledAmount,
    billingDay,
    dueDay,
    lastBillingDate,
    nextBillingDate,
    dueDate,
    isBillActive,
    isOverdue,
  };
}
