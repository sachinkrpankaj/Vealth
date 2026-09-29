import { Account, Transaction, Person, Asset, Liability } from '../../src/domain/finance/types';
import { getCreditCardBillingInfo, formatDayOrdinal } from '../../src/domain/finance/creditCardBilling';
import { calculateNetWorth, calculateAccountBalance } from '../../src/domain/finance/financialEngine';

describe('Credit Card Billing & Net Worth Accounting Engine', () => {
  const dummyPerson: Person[] = [];
  const dummyAssets: Asset[] = [];
  const dummyLiabilities: Liability[] = [];

  const bankAccount: Account = {
    id: 'bank-1',
    name: 'HDFC Salary Account',
    type: 'BANK',
    openingBalance: 10000000, // ₹1,00,000 (100k paise)
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const cashAccount: Account = {
    id: 'cash-1',
    name: 'Cash Wallet',
    type: 'CASH',
    openingBalance: 500000, // ₹5,000
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const creditCard: Account = {
    id: 'cc-1',
    name: 'ICICI Sapphiro Credit Card',
    type: 'CREDIT_CARD',
    openingBalance: 0,
    creditLimit: 5000000, // ₹50,000 limit
    billingDay: 20, // 20th of every month
    dueDay: 5, // 5th of every month
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('formats ordinal days correctly', () => {
    expect(formatDayOrdinal(1)).toBe('1st');
    expect(formatDayOrdinal(2)).toBe('2nd');
    expect(formatDayOrdinal(3)).toBe('3rd');
    expect(formatDayOrdinal(4)).toBe('4th');
    expect(formatDayOrdinal(20)).toBe('20th');
    expect(formatDayOrdinal(21)).toBe('21st');
    expect(formatDayOrdinal(22)).toBe('22nd');
    expect(formatDayOrdinal(23)).toBe('23rd');
    expect(formatDayOrdinal(31)).toBe('31st');
  });

  it('RULE 1: Credit limit is NOT added to net worth assets upon creation', () => {
    const netWorth = calculateNetWorth({
      accounts: [bankAccount, cashAccount, creditCard],
      people: dummyPerson,
      physicalAssets: dummyAssets,
      standaloneLiabilities: dummyLiabilities,
      transactions: [],
      referenceDate: new Date('2026-09-15'),
    });

    // Net worth should ONLY include bank (₹1,00,000) + cash (₹5,000) = ₹1,05,000 (10500000 paise).
    // The ₹50,000 credit limit MUST NOT be counted!
    expect(netWorth.totalAssets).toBe(10500000);
    expect(netWorth.totalLiabilities).toBe(0);
    expect(netWorth.netWorth).toBe(10500000);
  });

  it('RULE 2: Adding an expense on credit card reduces remaining limit immediately', () => {
    const expenseTx: Transaction = {
      id: 'tx-1',
      type: 'EXPENSE',
      amount: 1200000, // ₹12,000
      date: '2026-09-10',
      accountId: creditCard.id,
      createdAt: '2026-09-10',
      updatedAt: '2026-09-10',
    };

    const cardBal = calculateAccountBalance(creditCard, [expenseTx]);
    expect(cardBal).toBe(-1200000);

    const billingInfo = getCreditCardBillingInfo(
      creditCard,
      [expenseTx],
      new Date('2026-09-15')
    );

    expect(billingInfo.creditLimit).toBe(5000000); // ₹50,000
    expect(billingInfo.usedAmount).toBe(1200000); // ₹12,000
    expect(billingInfo.remainingLimit).toBe(3800000); // ₹38,000 remaining
  });

  it('RULE 3: Before billing date, used amount shows as unbilled in billing info, and is immediately counted as a liability in Net Worth', () => {
    // Expense occurred on 2026-09-10.
    // Billing day is 20th. Today is 2026-09-15 (before 20th).
    const expenseTx: Transaction = {
      id: 'tx-1',
      type: 'EXPENSE',
      amount: 1200000, // ₹12,000
      date: '2026-09-10',
      accountId: creditCard.id,
      createdAt: '2026-09-10',
      updatedAt: '2026-09-10',
    };

    const billingInfo = getCreditCardBillingInfo(
      creditCard,
      [expenseTx],
      new Date('2026-09-15')
    );

    // Unbilled spend, unpaid bill is 0 for billing statement
    expect(billingInfo.unpaidBillAmount).toBe(0);
    expect(billingInfo.unbilledAmount).toBe(1200000);
    expect(billingInfo.isBillActive).toBe(false);

    // Net worth calculation on 2026-09-15:
    // An expense must immediately reduce net worth via credit card liability
    const netWorth = calculateNetWorth({
      accounts: [bankAccount, cashAccount, creditCard],
      people: dummyPerson,
      physicalAssets: dummyAssets,
      standaloneLiabilities: dummyLiabilities,
      transactions: [expenseTx],
      referenceDate: new Date('2026-09-15'),
    });

    expect(netWorth.totalLiabilities).toBe(1200000);
    expect(netWorth.netWorth).toBe(9300000);
  });

  it('RULE 4: On/after billing date, used amount shows as unpaid bill and IS deducted from Net Worth', () => {
    // Expense on 2026-09-10. Billing day is 20th.
    // Reference date is 2026-09-20 (billing day) or 2026-09-22 (after billing day).
    const expenseTx: Transaction = {
      id: 'tx-1',
      type: 'EXPENSE',
      amount: 1200000, // ₹12,000
      date: '2026-09-10',
      accountId: creditCard.id,
      createdAt: '2026-09-10',
      updatedAt: '2026-09-10',
    };

    const billingInfo = getCreditCardBillingInfo(
      creditCard,
      [expenseTx],
      new Date('2026-09-22')
    );

    expect(billingInfo.unpaidBillAmount).toBe(1200000); // ₹12,000 unpaid bill
    expect(billingInfo.isBillActive).toBe(true);
    expect(billingInfo.dueDate).toBe('2026-10-05'); // due Oct 5th

    // Net worth on 2026-09-22:
    const netWorth = calculateNetWorth({
      accounts: [bankAccount, cashAccount, creditCard],
      people: dummyPerson,
      physicalAssets: dummyAssets,
      standaloneLiabilities: dummyLiabilities,
      transactions: [expenseTx],
      referenceDate: new Date('2026-09-22'),
    });

    // Unpaid bill of ₹12,000 is now a liability!
    // Net worth = 10500000 - 1200000 = 9300000 (₹93,000)
    expect(netWorth.totalLiabilities).toBe(1200000);
    expect(netWorth.netWorth).toBe(9300000);
  });

  it('RULE 5: Paying bill via TRANSFER from Bank account restores limit and clears unpaid bill', () => {
    const expenseTx: Transaction = {
      id: 'tx-1',
      type: 'EXPENSE',
      amount: 1200000, // ₹12,000
      date: '2026-09-10',
      accountId: creditCard.id,
      createdAt: '2026-09-10',
      updatedAt: '2026-09-10',
    };

    // Payment made on 2026-09-25 from bankAccount
    const paymentTx: Transaction = {
      id: 'tx-2',
      type: 'TRANSFER',
      amount: 1200000, // ₹12,000
      date: '2026-09-25',
      accountId: bankAccount.id, // source bank account
      destinationAccountId: creditCard.id, // destination credit card
      createdAt: '2026-09-25',
      updatedAt: '2026-09-25',
    };

    const allTx = [expenseTx, paymentTx];

    // Bank account balance is reduced by ₹12,000
    const bankBal = calculateAccountBalance(bankAccount, allTx);
    expect(bankBal).toBe(10000000 - 1200000); // 8800000 (₹88,000)

    // Credit card balance is restored to 0
    const cardBal = calculateAccountBalance(creditCard, allTx);
    expect(cardBal).toBe(0);

    // Remaining limit returns to full ₹50,000
    const billingInfo = getCreditCardBillingInfo(
      creditCard,
      allTx,
      new Date('2026-09-26')
    );
    expect(billingInfo.usedAmount).toBe(0);
    expect(billingInfo.remainingLimit).toBe(5000000);
    expect(billingInfo.unpaidBillAmount).toBe(0);
    expect(billingInfo.isBillActive).toBe(false);

    // Net worth after bill payment:
    // Assets: Bank (88,000) + Cash (5,000) = ₹93,000
    // Liabilities: 0
    // Net Worth: ₹93,000
    const netWorth = calculateNetWorth({
      accounts: [bankAccount, cashAccount, creditCard],
      people: dummyPerson,
      physicalAssets: dummyAssets,
      standaloneLiabilities: dummyLiabilities,
      transactions: allTx,
      referenceDate: new Date('2026-09-26'),
    });
    expect(netWorth.totalLiabilities).toBe(0);
    expect(netWorth.netWorth).toBe(9300000);
  });

  it('RULE 6: Cash accounts are strictly excluded from payment options', () => {
    const allAccounts = [bankAccount, cashAccount, creditCard];
    const eligiblePaymentAccounts = allAccounts.filter(
      (a) => a.type !== 'CASH' && a.id !== creditCard.id && !a.isArchived
    );

    expect(eligiblePaymentAccounts.length).toBe(1);
    expect(eligiblePaymentAccounts[0].id).toBe(bankAccount.id);
    expect(eligiblePaymentAccounts.some((a) => a.type === 'CASH')).toBe(false);
  });
});
