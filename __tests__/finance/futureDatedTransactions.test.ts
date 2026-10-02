import {
  Account,
  Asset,
  Person,
  Transaction,
} from '../../src/domain/finance/types';
import {
  calculateAccountBalance,
  calculateAllAccountBalances,
  calculatePersonDebt,
  calculateTotalReceivables,
  calculateTotalPayables,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';
import { getCreditCardBillingInfo } from '../../src/domain/finance/creditCardBilling';

describe('1. Future-Dated Transactions Invariants — Comprehensive Regression Tests', () => {
  const TODAY = '2026-10-02';
  const FUTURE_DATE = '2026-10-20';
  const PAST_DATE = '2026-09-15';
  const NEXT_YEAR = '2027-01-15';

  const bankAccount: Account = {
    id: 'acc-bank',
    name: 'Main Bank',
    type: 'BANK',
    openingBalance: 10000000, // ₹1,00,000 (1 crore paise)
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const savingsAccount: Account = {
    id: 'acc-savings',
    name: 'Savings Bank',
    type: 'BANK',
    openingBalance: 5000000, // ₹50,000
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const creditCard: Account = {
    id: 'acc-cc',
    name: 'Rewards Card',
    type: 'CREDIT_CARD',
    openingBalance: 0,
    creditLimit: 20000000, // ₹2,00,000
    billingDay: 15,
    dueDay: 5,
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const person: Person = {
    id: 'person-rahul',
    name: 'Rahul',
    avatarColor: '#10B981',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const physicalAsset: Asset = {
    id: 'ast-laptop',
    name: 'MacBook Pro',
    category: 'ELECTRONICS',
    currentValue: 15000000, // ₹1,50,000
    purchaseValue: 15000000,
    purchaseDate: '2026-01-01',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('excludes future INCOME from current balance and current net worth', () => {
    const futureIncome: Transaction = {
      id: 'tx-future-inc',
      type: 'INCOME',
      amount: 2500000, // ₹25,000
      date: FUTURE_DATE,
      accountId: bankAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    // As of today (2026-10-02)
    const currentBalance = calculateAccountBalance(bankAccount, [futureIncome], TODAY);
    expect(currentBalance).toBe(10000000); // Unchanged from opening balance

    const nwToday = calculateNetWorth({
      accounts: [bankAccount],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [futureIncome],
      asOfDate: TODAY,
    });
    expect(nwToday.totalAssets).toBe(10000000);
    expect(nwToday.netWorth).toBe(10000000);

    // On the future date itself (2026-10-20), it MUST be included
    const futureBalance = calculateAccountBalance(bankAccount, [futureIncome], FUTURE_DATE);
    expect(futureBalance).toBe(12500000);

    const nwFuture = calculateNetWorth({
      accounts: [bankAccount],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [futureIncome],
      asOfDate: FUTURE_DATE,
    });
    expect(nwFuture.netWorth).toBe(12500000);
  });

  it('excludes future EXPENSE from current balance, current net worth, and credit card utilization', () => {
    const futureBankExpense: Transaction = {
      id: 'tx-future-bank-exp',
      type: 'EXPENSE',
      amount: 1000000, // ₹10,000
      date: FUTURE_DATE,
      accountId: bankAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const futureCardExpense: Transaction = {
      id: 'tx-future-cc-exp',
      type: 'EXPENSE',
      amount: 4000000, // ₹40,000
      date: FUTURE_DATE,
      accountId: creditCard.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const allTx = [futureBankExpense, futureCardExpense];

    // Bank balance today is NOT reduced
    expect(calculateAccountBalance(bankAccount, allTx, TODAY)).toBe(10000000);

    // Credit card balance today is NOT drawn
    expect(calculateAccountBalance(creditCard, allTx, TODAY)).toBe(0);

    // Credit card billing today shows 0 used and full available limit
    const ccBilling = getCreditCardBillingInfo(creditCard, allTx, new Date(TODAY));
    expect(ccBilling.usedAmount).toBe(0);
    expect(ccBilling.remainingLimit).toBe(20000000);

    // Net worth today remains unaffected
    const nwToday = calculateNetWorth({
      accounts: [bankAccount, creditCard],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: allTx,
      asOfDate: TODAY,
    });
    expect(nwToday.totalLiabilities).toBe(0);
    expect(nwToday.netWorth).toBe(10000000);
  });

  it('excludes future TRANSFER from both source and destination account balances', () => {
    const futureTransfer: Transaction = {
      id: 'tx-future-xfer',
      type: 'TRANSFER',
      amount: 3000000, // ₹30,000
      date: FUTURE_DATE,
      accountId: bankAccount.id,
      destinationAccountId: savingsAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const balancesToday = calculateAllAccountBalances(
      [bankAccount, savingsAccount],
      [futureTransfer],
      TODAY
    );
    expect(balancesToday.get(bankAccount.id)).toBe(10000000);
    expect(balancesToday.get(savingsAccount.id)).toBe(5000000);

    const balancesFuture = calculateAllAccountBalances(
      [bankAccount, savingsAccount],
      [futureTransfer],
      FUTURE_DATE
    );
    expect(balancesFuture.get(bankAccount.id)).toBe(7000000);
    expect(balancesFuture.get(savingsAccount.id)).toBe(8000000);
  });

  it('excludes future LEND, BORROW, and REPAYMENTS from current debts and receivables/payables', () => {
    const pastLend: Transaction = {
      id: 'tx-past-lend',
      type: 'LEND',
      amount: 500000, // ₹5,000
      date: PAST_DATE,
      personId: person.id,
      accountId: bankAccount.id,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
    };

    const futureLend: Transaction = {
      id: 'tx-future-lend',
      type: 'LEND',
      amount: 1000000, // ₹10,000
      date: FUTURE_DATE,
      personId: person.id,
      accountId: bankAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const futureRepayment: Transaction = {
      id: 'tx-future-repay',
      type: 'REPAYMENT_RECEIVED',
      amount: 500000, // ₹5,000
      date: NEXT_YEAR,
      personId: person.id,
      accountId: bankAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const txs = [pastLend, futureLend, futureRepayment];

    // Person debt calculation as of today only reflects past lend
    const debtToday = calculatePersonDebt(person, txs, TODAY);
    expect(debtToday.owedToYou).toBe(500000);
    expect(debtToday.youOwe).toBe(0);

    const totalReceivablesToday = calculateTotalReceivables([person], txs, TODAY);
    expect(totalReceivablesToday).toBe(500000);

    // As of FUTURE_DATE: 5,000 + 10,000 = 15,000
    const debtFuture = calculatePersonDebt(person, txs, FUTURE_DATE);
    expect(debtFuture.owedToYou).toBe(1500000);

    // As of NEXT_YEAR: 15,000 - 5,000 = 10,000
    const debtNextYear = calculatePersonDebt(person, txs, NEXT_YEAR);
    expect(debtNextYear.owedToYou).toBe(1000000);
  });

  it('excludes future transactions across month and year boundaries correctly', () => {
    const dec31Tx: Transaction = {
      id: 'tx-dec-31',
      type: 'EXPENSE',
      amount: 200000, // ₹2,000
      date: '2026-12-31',
      accountId: bankAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const jan2Tx: Transaction = {
      id: 'tx-jan-02',
      type: 'INCOME',
      amount: 800000, // ₹8,000
      date: '2027-01-02',
      accountId: bankAccount.id,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const txs = [dec31Tx, jan2Tx];

    // On 2026-12-30: Neither transaction is included
    expect(calculateAccountBalance(bankAccount, txs, '2026-12-30')).toBe(10000000);

    // On 2026-12-31: Only dec31Tx is included
    expect(calculateAccountBalance(bankAccount, txs, '2026-12-31')).toBe(9800000);

    // On 2027-01-01: Only dec31Tx is included
    expect(calculateAccountBalance(bankAccount, txs, '2027-01-01')).toBe(9800000);

    // On 2027-01-02: Both transactions are included: 10,000,000 - 200,000 + 800,000 = 10,600,000
    expect(calculateAccountBalance(bankAccount, txs, '2027-01-02')).toBe(10600000);
  });
});
