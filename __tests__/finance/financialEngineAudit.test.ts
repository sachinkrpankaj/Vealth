import {
  calculateNetWorth,
  calculatePersonDebt,
  calculateTotalStandaloneLiabilities,
} from '../../src/domain/finance/financialEngine';
import { parseExpiryString } from '../../src/domain/cards/cardValidation';
import {
  Account,
  Person,
  Transaction,
  Liability,
} from '../../src/domain/finance/types';
import { getTodayLocalDateString } from '../../src/utils/dateUtils';

describe('Financial Engine Audit & Accounting Correctness Regression Tests', () => {
  const today = getTodayLocalDateString();
  const currentMonth = today.slice(0, 7);

  const ccAccount: Account = {
    id: 'acc-hdfc-cc',
    name: 'HDFC Regalia Credit Card',
    type: 'CREDIT_CARD',
    openingBalance: 0,
    creditLimit: 20000000,
    currency: 'INR',
    isArchived: false,
    createdAt: `${currentMonth}-01T00:00:00.000Z`,
    updatedAt: `${currentMonth}-01T00:00:00.000Z`,
  };

  const bankAccount: Account = {
    id: 'acc-bank-main',
    name: 'Main Checking Bank',
    type: 'BANK',
    openingBalance: 50000000,
    currency: 'INR',
    isArchived: false,
    createdAt: `${currentMonth}-01T00:00:00.000Z`,
    updatedAt: `${currentMonth}-01T00:00:00.000Z`,
  };

  describe('1. Credit Card Refund Handling & Order Independence', () => {
    it('calculates monthly expenses and refund offsets identically regardless of transaction array ordering', () => {
      const expenseTx: Transaction = {
        id: 'tx-cc-exp-1',
        type: 'EXPENSE',
        amount: 1000000, // ₹10,000 expense
        date: `${currentMonth}-05`,
        accountId: ccAccount.id,
        createdAt: `${currentMonth}-05T10:00:00.000Z`,
        updatedAt: `${currentMonth}-05T10:00:00.000Z`,
      };

      const refundTx: Transaction = {
        id: 'tx-cc-ref-1',
        type: 'INCOME',
        amount: 300000, // ₹3,000 refund on CC
        date: `${currentMonth}-02`, // Occurred earlier in the month
        accountId: ccAccount.id,
        createdAt: `${currentMonth}-02T10:00:00.000Z`,
        updatedAt: `${currentMonth}-02T10:00:00.000Z`,
      };

      // Order A: refund occurs before expense in array
      const nwOrderA = calculateNetWorth({
        accounts: [ccAccount, bankAccount],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [refundTx, expenseTx],
      });

      // Order B: expense occurs before refund in array
      const nwOrderB = calculateNetWorth({
        accounts: [ccAccount, bankAccount],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [expenseTx, refundTx],
      });

      // Assert complete order-independence
      expect(nwOrderA.expenseMonth).toBe(nwOrderB.expenseMonth);
      expect(nwOrderA.incomeMonth).toBe(nwOrderB.incomeMonth);

      // Refund of 3,000 offsets expense of 10,000 -> net expense is 7,000
      expect(nwOrderA.expenseMonth).toBe(700000);
      expect(nwOrderA.incomeMonth).toBe(0);
    });

    it('credits excess refunds beyond total monthly expenses to income without discarding money', () => {
      const smallExpense: Transaction = {
        id: 'tx-cc-small-exp',
        type: 'EXPENSE',
        amount: 200000, // ₹2,000
        date: `${currentMonth}-03`,
        accountId: ccAccount.id,
        createdAt: `${currentMonth}-03T10:00:00.000Z`,
        updatedAt: `${currentMonth}-03T10:00:00.000Z`,
      };

      const bigRefund: Transaction = {
        id: 'tx-cc-big-ref',
        type: 'INCOME',
        amount: 500000, // ₹5,000 refund
        date: `${currentMonth}-01`,
        accountId: ccAccount.id,
        createdAt: `${currentMonth}-01T10:00:00.000Z`,
        updatedAt: `${currentMonth}-01T10:00:00.000Z`,
      };

      const nw = calculateNetWorth({
        accounts: [ccAccount],
        people: [],
        physicalAssets: [],
        standaloneLiabilities: [],
        transactions: [bigRefund, smallExpense],
      });

      // Expense is reduced to 0
      expect(nw.expenseMonth).toBe(0);
      // Excess refund of ₹3,000 is preserved in incomeMonth
      expect(nw.incomeMonth).toBe(300000);
    });
  });

  describe('2. Standalone Liability Deduplication & Unrelated Credit Cards', () => {
    it('does NOT omit unrelated credit-card liabilities merely because a separate credit-card account exists', () => {
      const sbiCcAccount: Account = {
        id: 'acc-sbi-cc',
        name: 'SBI Card Account',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      // Unrelated credit card liability (e.g. Axis Magnus not modeled as an account)
      const unrelatedAxisLiability: Liability = {
        id: 'lib-axis-card',
        name: 'Axis Magnus Outstanding',
        type: 'CREDIT_CARD',
        amount: 4500000, // ₹45,000
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const total = calculateTotalStandaloneLiabilities(
        [unrelatedAxisLiability],
        [sbiCcAccount]
      );

      // Unrelated liability MUST be preserved!
      expect(total).toBe(4500000);
    });

    it('deduplicates standalone credit-card liability ONLY when explicitly linked via accountId, keeping same-name/notes in total', () => {
      const hdfcAccount: Account = {
        id: 'acc-hdfc-card',
        name: 'HDFC Millennia',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const linkedByIdLiability: Liability = {
        id: 'lib-linked-by-id',
        name: 'Millennia Card Debt',
        type: 'CREDIT_CARD',
        amount: 2000000,
        accountId: hdfcAccount.id,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const unlinkedByNoteLiability: Liability = {
        id: 'lib-linked-by-note',
        name: 'Credit Card Bill',
        type: 'CREDIT_CARD',
        amount: 3000000,
        note: 'acc-hdfc-card',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const unlinkedByNameLiability: Liability = {
        id: 'lib-linked-by-name',
        name: 'HDFC Millennia',
        type: 'CREDIT_CARD',
        amount: 1500000,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const total = calculateTotalStandaloneLiabilities(
        [linkedByIdLiability, unlinkedByNoteLiability, unlinkedByNameLiability],
        [hdfcAccount]
      );

      // Only linkedByIdLiability is deduplicated via accountId.
      // Unrelated liabilities with matching notes or identical names must remain in total liabilities (3000000 + 1500000 = 4500000)
      expect(total).toBe(4500000);
    });
  });

  describe('3. Debt Due-Date Status Rules', () => {
    const person: Person = {
      id: 'person-test-1',
      name: 'Rohan Gupta',
      avatarColor: '#4F46E5',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('reports UPCOMING when due date is more than 7 days in the future', () => {
      // Due in 15 days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const dueDateStr = futureDate.toISOString().slice(0, 10);

      const lendTx: Transaction = {
        id: 'tx-lend-upcoming',
        type: 'LEND',
        amount: 500000,
        date: today,
        personId: person.id,
        dueDate: dueDateStr,
        createdAt: `${today}T10:00:00.000Z`,
        updatedAt: `${today}T10:00:00.000Z`,
      };

      const summary = calculatePersonDebt(person, [lendTx], today);
      expect(summary.dueStatus).toBe('UPCOMING');
      expect(summary.dueDate).toBe(dueDateStr);
    });

    it('reports DUE_SOON when due date is between 1 and 7 days in the future', () => {
      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 3);
      const dueDateStr = nearFutureDate.toISOString().slice(0, 10);

      const lendTx: Transaction = {
        id: 'tx-lend-soon',
        type: 'LEND',
        amount: 500000,
        date: today,
        personId: person.id,
        dueDate: dueDateStr,
        createdAt: `${today}T10:00:00.000Z`,
        updatedAt: `${today}T10:00:00.000Z`,
      };

      const summary = calculatePersonDebt(person, [lendTx], today);
      expect(summary.dueStatus).toBe('DUE_SOON');
      expect(summary.dueDate).toBe(dueDateStr);
    });

    it('reports DUE_TODAY when due date is today', () => {
      const lendTx: Transaction = {
        id: 'tx-lend-today',
        type: 'LEND',
        amount: 500000,
        date: today,
        personId: person.id,
        dueDate: today,
        createdAt: `${today}T10:00:00.000Z`,
        updatedAt: `${today}T10:00:00.000Z`,
      };

      const summary = calculatePersonDebt(person, [lendTx], today);
      expect(summary.dueStatus).toBe('DUE_TODAY');
      expect(summary.dueDate).toBe(today);
    });

    it('reports OVERDUE when due date is in the past', () => {
      const pastDate = '2026-01-01';
      const lendTx: Transaction = {
        id: 'tx-lend-overdue',
        type: 'LEND',
        amount: 500000,
        date: pastDate,
        personId: person.id,
        dueDate: pastDate,
        createdAt: `${pastDate}T10:00:00.000Z`,
        updatedAt: `${pastDate}T10:00:00.000Z`,
      };

      const summary = calculatePersonDebt(person, [lendTx], today);
      expect(summary.dueStatus).toBe('OVERDUE');
      expect(summary.dueDate).toBe(pastDate);
    });

    it('reports SETTLED when net balance is 0 even if transactions had due dates', () => {
      const lendTx: Transaction = {
        id: 'tx-lend-settled',
        type: 'LEND',
        amount: 500000,
        date: '2026-01-01',
        personId: person.id,
        dueDate: '2026-01-10',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };

      const repayTx: Transaction = {
        id: 'tx-repay-settled',
        type: 'REPAYMENT_RECEIVED',
        amount: 500000,
        date: '2026-01-05',
        personId: person.id,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: '2026-01-05T10:00:00.000Z',
      };

      const summary = calculatePersonDebt(person, [lendTx, repayTx], today);
      expect(summary.netBalance).toBe(0);
      expect(summary.dueStatus).toBe('SETTLED');
      expect(summary.dueDate).toBeUndefined();
    });

    it('does NOT mark opposing receivables and payables as SETTLED when net balance is 0 but gross balances remain', () => {
      const lendTx: Transaction = {
        id: 'tx-lend-opposing',
        type: 'LEND',
        amount: 500000,
        date: '2026-01-01',
        personId: person.id,
        dueDate: '2026-01-10',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };

      const borrowTx: Transaction = {
        id: 'tx-borrow-opposing',
        type: 'BORROW',
        amount: 500000,
        date: '2026-01-01',
        personId: person.id,
        dueDate: '2026-01-15',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };

      const summary = calculatePersonDebt(person, [lendTx, borrowTx], today);
      expect(summary.netBalance).toBe(0);
      expect(summary.owedToYou).toBe(500000);
      expect(summary.youOwe).toBe(500000);
      expect(summary.dueStatus).not.toBe('SETTLED');
    });
  });

  describe('4. Expiry Date Parser Format Compatibility', () => {
    it('correctly parses all supported date formats', () => {
      expect(parseExpiryString('08/28')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('8/2028')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('0828')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('8/28')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('08/2028')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('82028')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('082028')).toEqual({ month: 8, year: 2028 });
      expect(parseExpiryString('12/29')).toEqual({ month: 12, year: 2029 });
    });

    it('rejects invalid months, years, or corrupt inputs', () => {
      expect(parseExpiryString('')).toBeNull();
      expect(parseExpiryString('13/28')).toBeNull(); // Month 13
      expect(parseExpiryString('00/28')).toBeNull(); // Month 0
      expect(parseExpiryString('08/1999')).toBeNull(); // Year before 2000
      expect(parseExpiryString('08/2105')).toBeNull(); // Year after 2100
      expect(parseExpiryString('abc')).toBeNull();
    });
  });
});
