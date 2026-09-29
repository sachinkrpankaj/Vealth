import {
  Account,
  Asset,
  Person,
  Transaction,
} from '../../src/domain/finance/types';
import {
  calculateAccountBalance,
  calculatePersonDebt,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';
import { rupeeToMinor } from '../../src/domain/finance/currency';

describe('End-to-End Scenario Verification (Section 55)', () => {
  test('Complete 8-step financial lifecycle test', () => {
    // Starting Setup
    const cashAccount: Account = {
      id: 'cash-acc',
      name: 'Cash',
      type: 'CASH',
      openingBalance: rupeeToMinor(10000), // ₹10,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const bankAccount: Account = {
      id: 'bank-acc',
      name: 'Bank Account',
      type: 'BANK',
      openingBalance: rupeeToMinor(5000), // ₹5,000
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

    const transactions: Transaction[] = [];
    const physicalAssets: Asset[] = [];

    // Initial check
    let nw = calculateNetWorth({
      accounts: [cashAccount, bankAccount],
      people: [rahul, amit],
      physicalAssets,
      standaloneLiabilities: [],
      transactions,
      currentMonthStr: '2026-09',
    });
    expect(nw.netWorth).toBe(rupeeToMinor(15000));
    expect(nw.totalAssets).toBe(rupeeToMinor(15000));
    expect(nw.totalLiabilities).toBe(0);

    // 1. Receive salary ₹20,000
    transactions.push({
      id: 'tx-1',
      type: 'INCOME',
      amount: rupeeToMinor(20000),
      date: '2026-09-02',
      accountId: cashAccount.id,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    });

    // 2. Spend ₹3,000
    transactions.push({
      id: 'tx-2',
      type: 'EXPENSE',
      amount: rupeeToMinor(3000),
      date: '2026-09-03',
      accountId: cashAccount.id,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    });

    // 3. Lend Rahul ₹4,000
    transactions.push({
      id: 'tx-3',
      type: 'LEND',
      amount: rupeeToMinor(4000),
      date: '2026-09-04',
      accountId: cashAccount.id,
      personId: rahul.id,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });

    // 4. Borrow ₹5,000 from Amit
    transactions.push({
      id: 'tx-4',
      type: 'BORROW',
      amount: rupeeToMinor(5000),
      date: '2026-09-05',
      accountId: cashAccount.id,
      personId: amit.id,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });

    // 5. Rahul repays ₹2,000
    transactions.push({
      id: 'tx-5',
      type: 'REPAYMENT_RECEIVED',
      amount: rupeeToMinor(2000),
      date: '2026-09-06',
      accountId: cashAccount.id,
      personId: rahul.id,
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    });

    // 6. Repay Amit ₹1,000
    transactions.push({
      id: 'tx-6',
      type: 'REPAYMENT_MADE',
      amount: rupeeToMinor(1000),
      date: '2026-09-07',
      accountId: cashAccount.id,
      personId: amit.id,
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    });

    // 7. Transfer ₹2,000 from Bank to Cash
    transactions.push({
      id: 'tx-7',
      type: 'TRANSFER',
      amount: rupeeToMinor(2000),
      date: '2026-09-08',
      accountId: bankAccount.id,
      destinationAccountId: cashAccount.id,
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });

    // 8. Add asset worth ₹10,000
    physicalAssets.push({
      id: 'asset-1',
      name: 'Gold Ring',
      category: 'GOLD',
      currentValue: rupeeToMinor(10000),
      purchaseValue: rupeeToMinor(10000),
      purchaseDate: '2026-09-09',
      isArchived: false,
      createdAt: '2026-09-09T00:00:00.000Z',
      updatedAt: '2026-09-09T00:00:00.000Z',
    });

    // VERIFICATIONS
    // Account balances:
    // Cash = 10,000 + 20,000 - 3,000 - 4,000 + 5,000 + 2,000 - 1,000 + 2,000 = ₹31,000
    const finalCash = calculateAccountBalance(cashAccount, transactions);
    expect(finalCash).toBe(rupeeToMinor(31000));

    // Bank = 5,000 - 2,000 = ₹3,000
    const finalBank = calculateAccountBalance(bankAccount, transactions);
    expect(finalBank).toBe(rupeeToMinor(3000));

    // Rahul owes ₹2,000
    const rahulDebt = calculatePersonDebt(rahul, transactions);
    expect(rahulDebt.owedToYou).toBe(rupeeToMinor(2000));
    expect(rahulDebt.youOwe).toBe(0);

    // Amit is owed ₹4,000
    const amitDebt = calculatePersonDebt(amit, transactions);
    expect(amitDebt.youOwe).toBe(rupeeToMinor(4000));
    expect(amitDebt.owedToYou).toBe(0);

    // Net worth and Asset/Liability totals
    const finalNW = calculateNetWorth({
      accounts: [cashAccount, bankAccount],
      people: [rahul, amit],
      physicalAssets,
      standaloneLiabilities: [],
      transactions,
      currentMonthStr: '2026-09',
    });

    // Total Assets = Cash (31k) + Bank (3k) + Asset (10k) = ₹44,000 (Receivables separated from assets)
    expect(finalNW.totalAssets).toBe(rupeeToMinor(44000));
    expect(finalNW.totalReceivables).toBe(rupeeToMinor(2000));
    expect(finalNW.totalPhysicalAssets).toBe(rupeeToMinor(10000));

    // Total Liabilities = Standalone liabilities = 0 (Payables/debt separated from liabilities)
    expect(finalNW.totalLiabilities).toBe(0);
    expect(finalNW.totalPayables).toBe(rupeeToMinor(4000));

    // Net Worth = (44,000 + 2,000) - (0 + 4,000) = ₹42,000
    expect(finalNW.netWorth).toBe(rupeeToMinor(42000));

    // Monthly cashflow checks:
    // Income = Salary ₹20,000 (Repayment is NOT income!)
    expect(finalNW.incomeMonth).toBe(rupeeToMinor(20000));

    // Expenses = Spend ₹3,000 (Repayment made is NOT expense!)
    expect(finalNW.expenseMonth).toBe(rupeeToMinor(3000));

    // Net savings this month = 20,000 - 3,000 = ₹17,000
    expect(finalNW.netWorthChangeMonth).toBe(rupeeToMinor(17000));
  });
});
