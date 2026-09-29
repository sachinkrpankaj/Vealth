import {
  Account,
  Asset,
  Liability,
  Person,
  Transaction,
} from '../../src/domain/finance/types';
import {
  calculateAccountBalance,
  calculatePersonDebt,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';
import { rupeeToMinor } from '../../src/domain/finance/currency';

describe('Financial Engine Accounting Rules (Tests 1 - 14)', () => {
  const cashAccount: Account = {
    id: 'acc-cash',
    name: 'Cash',
    type: 'CASH',
    openingBalance: 0,
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const bankAccount: Account = {
    id: 'acc-bank',
    name: 'SBI Bank',
    type: 'BANK',
    openingBalance: 0,
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const rahul: Person = {
    id: 'person-rahul',
    name: 'Rahul',
    avatarColor: '#10B981',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const amit: Person = {
    id: 'person-amit',
    name: 'Amit',
    avatarColor: '#6366F1',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  // Test 1: Income ₹10,000 -> Net worth increases ₹10,000
  test('Test 1: Income ₹10,000 increases cash and net worth by ₹10,000', () => {
    const tx: Transaction = {
      id: 'tx-1',
      type: 'INCOME',
      amount: rupeeToMinor(10000), // 1000000 paise
      date: '2026-09-02',
      accountId: cashAccount.id,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };

    const cashBal = calculateAccountBalance(cashAccount, [tx]);
    expect(cashBal).toBe(rupeeToMinor(10000));

    const nw = calculateNetWorth({
      accounts: [cashAccount],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    expect(nw.netWorth).toBe(rupeeToMinor(10000));
    expect(nw.totalAssets).toBe(rupeeToMinor(10000));
    expect(nw.totalLiabilities).toBe(0);
  });

  // Test 2: Expense ₹2,000 -> Net worth decreases ₹2,000
  test('Test 2: Expense ₹2,000 decreases cash and net worth by ₹2,000', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(10000) };
    const tx: Transaction = {
      id: 'tx-2',
      type: 'EXPENSE',
      amount: rupeeToMinor(2000),
      date: '2026-09-03',
      accountId: cashAccount.id,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    };

    const cashBal = calculateAccountBalance(openingCash, [tx]);
    expect(cashBal).toBe(rupeeToMinor(8000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    expect(nw.netWorth).toBe(rupeeToMinor(8000));
  });

  // Test 3: Lend ₹3,000 -> Cash decreases ₹3,000, Receivable increases ₹3,000, Net worth unchanged
  test('Test 3: Lend ₹3,000 decreases cash, increases receivable, net worth unchanged', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(10000) };
    const tx: Transaction = {
      id: 'tx-3',
      type: 'LEND',
      amount: rupeeToMinor(3000),
      date: '2026-09-04',
      accountId: openingCash.id,
      personId: rahul.id,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    };

    const cashBal = calculateAccountBalance(openingCash, [tx]);
    expect(cashBal).toBe(rupeeToMinor(7000));

    const debt = calculatePersonDebt(rahul, [tx]);
    expect(debt.owedToYou).toBe(rupeeToMinor(3000));
    expect(debt.youOwe).toBe(0);
    expect(debt.netBalance).toBe(rupeeToMinor(3000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [rahul],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    // Net worth was ₹10,000 before, and remains ₹10,000 (Cash 7,000 + Receivable 3,000)
    expect(nw.netWorth).toBe(rupeeToMinor(10000));
    expect(nw.totalReceivables).toBe(rupeeToMinor(3000));
    expect(nw.totalLiabilities).toBe(0);
  });

  // Test 4: Borrow ₹5,000 -> Cash increases ₹5,000, Liability increases ₹5,000, Net worth unchanged
  test('Test 4: Borrow ₹5,000 increases cash and liability, net worth unchanged', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(10000) };
    const tx: Transaction = {
      id: 'tx-4',
      type: 'BORROW',
      amount: rupeeToMinor(5000),
      date: '2026-09-05',
      accountId: openingCash.id,
      personId: amit.id,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };

    const cashBal = calculateAccountBalance(openingCash, [tx]);
    expect(cashBal).toBe(rupeeToMinor(15000));

    const debt = calculatePersonDebt(amit, [tx]);
    expect(debt.youOwe).toBe(rupeeToMinor(5000));
    expect(debt.owedToYou).toBe(0);
    expect(debt.netBalance).toBe(-rupeeToMinor(5000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [amit],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    // Cash: 15,000, Total Payables (Debt): 5,000, Liabilities: 0 -> Net Worth = 10,000 (Unchanged!)
    expect(nw.netWorth).toBe(rupeeToMinor(10000));
    expect(nw.totalAssets).toBe(rupeeToMinor(15000));
    expect(nw.totalPayables).toBe(rupeeToMinor(5000));
    expect(nw.totalLiabilities).toBe(0);
  });

  // Test 5: Receive ₹2,000 repayment -> Cash increases ₹2,000, Receivable decreases ₹2,000, No new income
  test('Test 5: Receive ₹2,000 repayment increases cash, decreases receivable, no income added', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(7000) };
    const lendTx: Transaction = {
      id: 'tx-lend',
      type: 'LEND',
      amount: rupeeToMinor(3000),
      date: '2026-09-01',
      accountId: openingCash.id,
      personId: rahul.id,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const repayTx: Transaction = {
      id: 'tx-repay',
      type: 'REPAYMENT_RECEIVED',
      amount: rupeeToMinor(2000),
      date: '2026-09-06',
      accountId: openingCash.id,
      personId: rahul.id,
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    };

    const transactions = [lendTx, repayTx];
    // Cash: 7000 - 3000 + 2000 = 6000
    const cashBal = calculateAccountBalance(openingCash, transactions);
    expect(cashBal).toBe(rupeeToMinor(6000));

    // Rahul owes 3000 - 2000 = 1000
    const debt = calculatePersonDebt(rahul, transactions);
    expect(debt.owedToYou).toBe(rupeeToMinor(1000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [rahul],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions,
    });
    // Cash 6,000 + Receivable 1,000 = 7,000 (Same as opening net worth)
    expect(nw.netWorth).toBe(rupeeToMinor(7000));
    // Income this month must NOT count repayments as income
    expect(nw.incomeMonth).toBe(0);
  });

  // Test 6: Pay ₹1,000 debt -> Cash decreases ₹1,000, Liability decreases ₹1,000, No new expense
  test('Test 6: Pay ₹1,000 debt decreases cash, decreases liability, not counted as expense', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(15000) };
    const borrowTx: Transaction = {
      id: 'tx-borrow',
      type: 'BORROW',
      amount: rupeeToMinor(5000),
      date: '2026-09-01',
      accountId: openingCash.id,
      personId: amit.id,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const repayTx: Transaction = {
      id: 'tx-pay-debt',
      type: 'REPAYMENT_MADE',
      amount: rupeeToMinor(1000),
      date: '2026-09-07',
      accountId: openingCash.id,
      personId: amit.id,
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    };

    const transactions = [borrowTx, repayTx];
    // Cash: 15,000 + 5,000 - 1,000 = 19,000
    const cashBal = calculateAccountBalance(openingCash, transactions);
    expect(cashBal).toBe(rupeeToMinor(19000));

    // User owes Amit: 5000 - 1000 = 4000
    const debt = calculatePersonDebt(amit, transactions);
    expect(debt.youOwe).toBe(rupeeToMinor(4000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [amit],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions,
    });
    // Net worth = 19,000 - 4,000 = 15,000 (unchanged from opening)
    expect(nw.netWorth).toBe(rupeeToMinor(15000));
    // Expense this month must NOT count repayment as expense
    expect(nw.expenseMonth).toBe(0);
  });

  // Test 7: Transfer ₹2,000 -> Source account decreases, destination increases, Net worth unchanged
  test('Test 7: Transfer ₹2,000 decreases source, increases destination, net worth unchanged', () => {
    const accBank: Account = { ...bankAccount, openingBalance: rupeeToMinor(10000) };
    const accCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(5000) };

    const tx: Transaction = {
      id: 'tx-transfer',
      type: 'TRANSFER',
      amount: rupeeToMinor(2000),
      date: '2026-09-08',
      accountId: accBank.id,
      destinationAccountId: accCash.id,
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    };

    const bankBal = calculateAccountBalance(accBank, [tx]);
    const cashBal = calculateAccountBalance(accCash, [tx]);

    expect(bankBal).toBe(rupeeToMinor(8000));
    expect(cashBal).toBe(rupeeToMinor(7000));

    const nw = calculateNetWorth({
      accounts: [accBank, accCash],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    // Net worth = 8000 + 7000 = 15000 (Unchanged!)
    expect(nw.netWorth).toBe(rupeeToMinor(15000));
    expect(nw.incomeMonth).toBe(0);
    expect(nw.expenseMonth).toBe(0);
  });

  // Test 8: Partial repayment maintains correct outstanding balance
  test('Test 8: Partial repayments track remaining balance accurately across multiple installments', () => {
    const lendTx: Transaction = {
      id: 'tx-lend',
      type: 'LEND',
      amount: rupeeToMinor(5000),
      date: '2026-09-01',
      accountId: cashAccount.id,
      personId: rahul.id,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const repay1: Transaction = {
      id: 'tx-repay-1',
      type: 'REPAYMENT_RECEIVED',
      amount: rupeeToMinor(2000),
      date: '2026-09-05',
      accountId: cashAccount.id,
      personId: rahul.id,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };

    let debt = calculatePersonDebt(rahul, [lendTx, repay1]);
    expect(debt.owedToYou).toBe(rupeeToMinor(3000));

    const repay2: Transaction = {
      id: 'tx-repay-2',
      type: 'REPAYMENT_RECEIVED',
      amount: rupeeToMinor(1500),
      date: '2026-09-10',
      accountId: cashAccount.id,
      personId: rahul.id,
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    };

    debt = calculatePersonDebt(rahul, [lendTx, repay1, repay2]);
    expect(debt.owedToYou).toBe(rupeeToMinor(1500));
  });

  // Test 9: Delete transaction reverses financial effect correctly
  test('Test 9: Deleting a transaction reverses its financial effect completely', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(10000) };
    const tx: Transaction = {
      id: 'tx-expense',
      type: 'EXPENSE',
      amount: rupeeToMinor(3000),
      date: '2026-09-05',
      accountId: openingCash.id,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };

    expect(calculateAccountBalance(openingCash, [tx])).toBe(rupeeToMinor(7000));

    // Soft delete transaction
    const deletedTx: Transaction = { ...tx, deletedAt: '2026-09-06T00:00:00.000Z' };
    expect(calculateAccountBalance(openingCash, [deletedTx])).toBe(rupeeToMinor(10000));
  });

  // Test 10: Edit transaction reconciles difference correctly
  test('Test 10: Editing a transaction reconciles balances correctly', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(10000) };
    const initialTx: Transaction = {
      id: 'tx-lend',
      type: 'LEND',
      amount: rupeeToMinor(2000),
      date: '2026-09-05',
      accountId: openingCash.id,
      personId: rahul.id,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };

    expect(calculateAccountBalance(openingCash, [initialTx])).toBe(rupeeToMinor(8000));
    expect(calculatePersonDebt(rahul, [initialTx]).owedToYou).toBe(rupeeToMinor(2000));

    // Edit to ₹3,000
    const editedTx: Transaction = {
      ...initialTx,
      amount: rupeeToMinor(3000),
      updatedAt: '2026-09-06T00:00:00.000Z',
    };

    expect(calculateAccountBalance(openingCash, [editedTx])).toBe(rupeeToMinor(7000));
    expect(calculatePersonDebt(rahul, [editedTx]).owedToYou).toBe(rupeeToMinor(3000));
  });

  // Test 11: Multiple people balances remain independent
  test('Test 11: Debts for multiple people remain strictly isolated', () => {
    const tx1: Transaction = {
      id: 'tx-rahul',
      type: 'LEND',
      amount: rupeeToMinor(4000),
      date: '2026-09-01',
      accountId: cashAccount.id,
      personId: rahul.id,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const tx2: Transaction = {
      id: 'tx-amit',
      type: 'BORROW',
      amount: rupeeToMinor(5000),
      date: '2026-09-02',
      accountId: cashAccount.id,
      personId: amit.id,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };

    const allTx = [tx1, tx2];
    const rahulDebt = calculatePersonDebt(rahul, allTx);
    const amitDebt = calculatePersonDebt(amit, allTx);

    expect(rahulDebt.owedToYou).toBe(rupeeToMinor(4000));
    expect(rahulDebt.youOwe).toBe(0);

    expect(amitDebt.owedToYou).toBe(0);
    expect(amitDebt.youOwe).toBe(rupeeToMinor(5000));
  });

  // Test 12: Multiple accounts remain independent
  test('Test 12: Balances across multiple accounts remain strictly isolated', () => {
    const accBank: Account = { ...bankAccount, openingBalance: rupeeToMinor(25000) };
    const accCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(5000) };

    const txBank: Transaction = {
      id: 'tx-bank-income',
      type: 'INCOME',
      amount: rupeeToMinor(10000),
      date: '2026-09-01',
      accountId: accBank.id,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const txCash: Transaction = {
      id: 'tx-cash-expense',
      type: 'EXPENSE',
      amount: rupeeToMinor(1500),
      date: '2026-09-02',
      accountId: accCash.id,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };

    const allTx = [txBank, txCash];
    expect(calculateAccountBalance(accBank, allTx)).toBe(rupeeToMinor(35000));
    expect(calculateAccountBalance(accCash, allTx)).toBe(rupeeToMinor(3500));
  });

  // Test 13: Asset purchase -> Cash decreases, Asset increases, Net worth unchanged
  test('Test 13: Asset purchase decreases cash, increases assets, net worth unchanged', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(20000) };
    const tx: Transaction = {
      id: 'tx-asset-buy',
      type: 'ASSET_PURCHASE',
      amount: rupeeToMinor(10000),
      date: '2026-09-05',
      accountId: openingCash.id,
      assetId: 'asset-gold',
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };

    const goldAsset: Asset = {
      id: 'asset-gold',
      name: '24k Gold Coin',
      category: 'GOLD',
      currentValue: rupeeToMinor(10000),
      purchaseValue: rupeeToMinor(10000),
      purchaseDate: '2026-09-05',
      isArchived: false,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };

    expect(calculateAccountBalance(openingCash, [tx])).toBe(rupeeToMinor(10000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [],
      physicalAssets: [goldAsset],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    // Cash 10,000 + Gold 10,000 = 20,000 (Net worth unchanged!)
    expect(nw.netWorth).toBe(rupeeToMinor(20000));
    expect(nw.totalPhysicalAssets).toBe(rupeeToMinor(10000));
  });

  // Test 14: Asset sale -> Cash increases, Asset decreases, Correct net-worth effect
  test('Test 14: Asset sale increases cash, decreases asset, reflects capital gain in net worth', () => {
    const openingCash: Account = { ...cashAccount, openingBalance: rupeeToMinor(10000) };
    // Gold bought for 10,000 sold for 12,000 (2,000 profit)
    const tx: Transaction = {
      id: 'tx-asset-sell',
      type: 'ASSET_SALE',
      amount: rupeeToMinor(12000), // sale proceeds
      date: '2026-09-06',
      accountId: openingCash.id,
      assetId: 'asset-gold',
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    };

    // After sale, asset is archived / value 0
    const goldSold: Asset = {
      id: 'asset-gold',
      name: 'Gold Coin',
      category: 'GOLD',
      currentValue: 0,
      purchaseValue: rupeeToMinor(10000),
      purchaseDate: '2026-09-01',
      isArchived: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    };

    expect(calculateAccountBalance(openingCash, [tx])).toBe(rupeeToMinor(22000));

    const nw = calculateNetWorth({
      accounts: [openingCash],
      people: [],
      physicalAssets: [goldSold],
      standaloneLiabilities: [],
      transactions: [tx],
    });
    // Cash: 10,000 + 12,000 = 22,000. Net worth before was 10k cash + 10k gold = 20k. Now 22k.
    expect(nw.netWorth).toBe(rupeeToMinor(22000));
  });
});
