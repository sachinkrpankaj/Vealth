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
  getActiveTransactions,
} from '../../src/domain/finance/financialEngine';
import { validateRepaymentAmount } from '../../src/domain/finance/validator';

describe('Transaction Lifecycle: CREATE, EDIT, and DELETE Reversals', () => {
  const bankAccount: Account = {
    id: 'acc-bank',
    name: 'HDFC Savings',
    type: 'BANK',
    openingBalance: 5000000, // ₹50,000 (5,000,000 paise)
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const cashAccount: Account = {
    id: 'acc-cash',
    name: 'Cash In Hand',
    type: 'CASH',
    openingBalance: 1000000, // ₹10,000 (1,000,000 paise)
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const creditCard: Account = {
    id: 'acc-cc',
    name: 'Amazon ICICI Credit Card',
    type: 'CREDIT_CARD',
    openingBalance: 0,
    creditLimit: 10000000, // ₹1,00,000 limit
    billingDay: 15,
    dueDay: 5,
    currency: 'INR',
    isArchived: false,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const personVikram: Person = {
    id: 'person-vikram',
    name: 'Vikram',
    avatarColor: '#10B981',
    isArchived: false,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const laptopAsset: Asset = {
    id: 'asset-macbook',
    name: 'MacBook Pro',
    category: 'ELECTRONICS',
    currentValue: 15000000, // ₹1,50,000
    purchaseValue: 15000000,
    purchaseDate: '2026-09-01',
    isArchived: false,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const baseAccounts = [bankAccount, cashAccount, creditCard];
  const basePeople = [personVikram];
  const baseAssets = [laptopAsset];
  const baseLiabilities: Liability[] = [];

  const getBaselineNetWorth = () =>
    calculateNetWorth({
      accounts: baseAccounts,
      people: basePeople,
      physicalAssets: baseAssets,
      standaloneLiabilities: baseLiabilities,
      transactions: [],
    });

  // Baseline Net Worth: Bank (50k) + Cash (10k) + MacBook (150k) = ₹2,10,000 (21,000,000 paise)
  const baselineNW = 21000000;

  it('verifies baseline net worth matches initial assets with no transactions', () => {
    const nw = getBaselineNetWorth();
    expect(nw.netWorth).toBe(baselineNW);
    expect(nw.totalAssets).toBe(baselineNW);
    expect(nw.totalLiabilities).toBe(0);
  });

  describe('1. INCOME Lifecycle', () => {
    const initialTx: Transaction = {
      id: 'tx-inc-1',
      type: 'INCOME',
      amount: 2500000, // ₹25,000
      date: '2026-09-05',
      accountId: bankAccount.id,
      createdAt: '2026-09-05',
      updatedAt: '2026-09-05',
    };

    it('CREATE: increases bank account balance and net worth', () => {
      const bal = calculateAccountBalance(bankAccount, [initialTx]);
      expect(bal).toBe(7500000); // 50k + 25k = 75k

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [initialTx],
      });
      expect(nw.netWorth).toBe(baselineNW + 2500000);
    });

    it('EDIT: reverses old amount and applies new amount', () => {
      const editedTx: Transaction = {
        ...initialTx,
        amount: 3000000, // Changed from ₹25,000 to ₹30,000
        updatedAt: '2026-09-06',
      };

      const bal = calculateAccountBalance(bankAccount, [editedTx]);
      expect(bal).toBe(8000000); // 50k + 30k = 80k

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [editedTx],
      });
      expect(nw.netWorth).toBe(baselineNW + 3000000);
    });

    it('DELETE: soft-delete fully reverses income effect', () => {
      const deletedTx: Transaction = {
        ...initialTx,
        deletedAt: '2026-09-07T00:00:00.000Z',
      };

      const bal = calculateAccountBalance(bankAccount, [deletedTx]);
      expect(bal).toBe(bankAccount.openingBalance);

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [deletedTx],
      });
      expect(nw.netWorth).toBe(baselineNW);
    });
  });

  describe('2. EXPENSE Lifecycle (Cash & Credit Card)', () => {
    it('CREATE, EDIT, DELETE on Cash account', () => {
      const expTx: Transaction = {
        id: 'tx-exp-1',
        type: 'EXPENSE',
        amount: 400000, // ₹4,000
        date: '2026-09-05',
        accountId: cashAccount.id,
        createdAt: '2026-09-05',
        updatedAt: '2026-09-05',
      };

      // CREATE
      expect(calculateAccountBalance(cashAccount, [expTx])).toBe(600000); // 10k - 4k = 6k
      let nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [expTx],
      });
      expect(nw.netWorth).toBe(baselineNW - 400000);

      // EDIT to ₹6,000
      const editedExp = { ...expTx, amount: 600000 };
      expect(calculateAccountBalance(cashAccount, [editedExp])).toBe(400000); // 10k - 6k = 4k
      nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [editedExp],
      });
      expect(nw.netWorth).toBe(baselineNW - 600000);

      // DELETE
      const deletedExp = { ...editedExp, deletedAt: '2026-09-08' };
      expect(calculateAccountBalance(cashAccount, [deletedExp])).toBe(cashAccount.openingBalance);
      nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [deletedExp],
      });
      expect(nw.netWorth).toBe(baselineNW);
    });

    it('CREATE, EDIT, DELETE on Credit Card immediately updates liabilities & net worth', () => {
      const ccExpTx: Transaction = {
        id: 'tx-cc-1',
        type: 'EXPENSE',
        amount: 1500000, // ₹15,000 spent on CC
        date: '2026-09-05',
        accountId: creditCard.id,
        createdAt: '2026-09-05',
        updatedAt: '2026-09-05',
      };

      // CREATE: Credit card balance becomes -15,000 (liability)
      expect(calculateAccountBalance(creditCard, [ccExpTx])).toBe(-1500000);
      let nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [ccExpTx],
      });
      expect(nw.totalLiabilities).toBe(1500000);
      expect(nw.netWorth).toBe(baselineNW - 1500000);

      // EDIT: Change spend to ₹20,000
      const editedCcExp = { ...ccExpTx, amount: 2000000 };
      expect(calculateAccountBalance(creditCard, [editedCcExp])).toBe(-2000000);
      nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [editedCcExp],
      });
      expect(nw.totalLiabilities).toBe(2000000);
      expect(nw.netWorth).toBe(baselineNW - 2000000);

      // DELETE: Restores credit card balance to 0 and clears liability
      const deletedCcExp = { ...editedCcExp, deletedAt: '2026-09-09' };
      expect(calculateAccountBalance(creditCard, [deletedCcExp])).toBe(0);
      nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [deletedCcExp],
      });
      expect(nw.totalLiabilities).toBe(0);
      expect(nw.netWorth).toBe(baselineNW);
    });
  });

  describe('3. LEND and REPAYMENT_RECEIVED Lifecycle', () => {
    const lendTx: Transaction = {
      id: 'tx-lend-1',
      type: 'LEND',
      amount: 1000000, // Lent ₹10,000 to Vikram from Bank
      date: '2026-09-02',
      accountId: bankAccount.id,
      personId: personVikram.id,
      createdAt: '2026-09-02',
      updatedAt: '2026-09-02',
    };

    it('LEND: cash decreases, receivable increases, net worth unchanged', () => {
      const bankBal = calculateAccountBalance(bankAccount, [lendTx]);
      expect(bankBal).toBe(4000000); // 50k - 10k = 40k

      const debt = calculatePersonDebt(personVikram, [lendTx]);
      expect(debt.owedToYou).toBe(1000000);
      expect(debt.youOwe).toBe(0);

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [lendTx],
      });
      expect(nw.netWorth).toBe(baselineNW); // Net worth invariant
      expect(nw.totalReceivables).toBe(1000000);
    });

    it('REPAYMENT_RECEIVED: partial repayment decreases receivable, increases cash, not income', () => {
      const partialRepayTx: Transaction = {
        id: 'tx-repay-1',
        type: 'REPAYMENT_RECEIVED',
        amount: 400000, // Vikram repays ₹4,000 into Cash wallet
        date: '2026-09-05',
        accountId: cashAccount.id,
        personId: personVikram.id,
        createdAt: '2026-09-05',
        updatedAt: '2026-09-05',
      };

      const allTx = [lendTx, partialRepayTx];

      // Cash wallet balance increased by 4k (10k + 4k = 14k)
      expect(calculateAccountBalance(cashAccount, allTx)).toBe(1400000);

      // Vikram now owes ₹6,000 (10k - 4k)
      const debt = calculatePersonDebt(personVikram, allTx);
      expect(debt.owedToYou).toBe(600000);

      // Net worth still unchanged
      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: allTx,
      });
      expect(nw.netWorth).toBe(baselineNW);
      expect(nw.incomeMonth).toBe(0); // NOT counted as income
    });

    it('PREVENT OVER-REPAYMENT: validator rejects repayment exceeding outstanding debt', () => {
      const currentOwed = 600000; // ₹6,000 remaining
      const validCheck = validateRepaymentAmount(500000, currentOwed);
      expect(validCheck.isValid).toBe(true);

      const fullCheck = validateRepaymentAmount(600000, currentOwed);
      expect(fullCheck.isValid).toBe(true);

      const overCheck = validateRepaymentAmount(700000, currentOwed);
      expect(overCheck.isValid).toBe(false);
      expect(overCheck.error).toContain('exceeds the outstanding balance');
    });

    it('DELETE of repayment restores the original receivable', () => {
      const repayTx: Transaction = {
        id: 'tx-repay-1',
        type: 'REPAYMENT_RECEIVED',
        amount: 400000,
        date: '2026-09-05',
        accountId: cashAccount.id,
        personId: personVikram.id,
        deletedAt: '2026-09-07',
        createdAt: '2026-09-05',
        updatedAt: '2026-09-07',
      };

      const allTx = [lendTx, repayTx];
      // Repayment is deleted -> Vikram owes full 10k again
      const debt = calculatePersonDebt(personVikram, allTx);
      expect(debt.owedToYou).toBe(1000000);
      expect(calculateAccountBalance(cashAccount, allTx)).toBe(cashAccount.openingBalance);
    });
  });

  describe('4. BORROW and REPAYMENT_MADE Lifecycle', () => {
    const borrowTx: Transaction = {
      id: 'tx-borrow-1',
      type: 'BORROW',
      amount: 800000, // Borrow ₹8,000 from Vikram into Bank
      date: '2026-09-03',
      accountId: bankAccount.id,
      personId: personVikram.id,
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    };

    it('BORROW: increases cash and liability, net worth unchanged', () => {
      expect(calculateAccountBalance(bankAccount, [borrowTx])).toBe(5800000);
      const debt = calculatePersonDebt(personVikram, [borrowTx]);
      expect(debt.youOwe).toBe(800000);

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [borrowTx],
      });
      expect(nw.netWorth).toBe(baselineNW); // Invariant
      expect(nw.totalPayables).toBe(800000);
    });

    it('REPAYMENT_MADE: decreases cash and liability, not an expense', () => {
      const repayTx: Transaction = {
        id: 'tx-repay-made-1',
        type: 'REPAYMENT_MADE',
        amount: 500000, // Pay ₹5,000 back from Cash
        date: '2026-09-06',
        accountId: cashAccount.id,
        personId: personVikram.id,
        createdAt: '2026-09-06',
        updatedAt: '2026-09-06',
      };

      const allTx = [borrowTx, repayTx];
      expect(calculateAccountBalance(cashAccount, allTx)).toBe(500000); // 10k - 5k = 5k
      const debt = calculatePersonDebt(personVikram, allTx);
      expect(debt.youOwe).toBe(300000); // 8k - 5k = 3k remaining

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: allTx,
      });
      expect(nw.netWorth).toBe(baselineNW);
      expect(nw.expenseMonth).toBe(0); // NOT an expense
    });
  });

  describe('5. TRANSFER Lifecycle (Bank to Credit Card Bill Payment)', () => {
    it('Paying credit card bill via TRANSFER leaves Net Worth unchanged and restores available credit', () => {
      // 1. Credit card expense
      const ccExpense: Transaction = {
        id: 'tx-cc-spend',
        type: 'EXPENSE',
        amount: 3000000, // ₹30,000 spend
        date: '2026-09-04',
        accountId: creditCard.id,
        createdAt: '2026-09-04',
        updatedAt: '2026-09-04',
      };

      // 2. Transfer from Bank to Credit Card to pay bill
      const transferBillPayment: Transaction = {
        id: 'tx-transfer-bill',
        type: 'TRANSFER',
        amount: 3000000, // ₹30,000
        date: '2026-09-10',
        accountId: bankAccount.id,
        destinationAccountId: creditCard.id,
        createdAt: '2026-09-10',
        updatedAt: '2026-09-10',
      };

      const beforePayment = [ccExpense];
      const nwBefore = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: beforePayment,
      });
      expect(nwBefore.netWorth).toBe(baselineNW - 3000000); // Decreased by expense

      const afterPayment = [ccExpense, transferBillPayment];

      // Bank account reduced by 30k (50k - 30k = 20k)
      expect(calculateAccountBalance(bankAccount, afterPayment)).toBe(2000000);

      // Credit card balance is back to 0
      expect(calculateAccountBalance(creditCard, afterPayment)).toBe(0);

      // Net Worth after transfer bill payment is UNCHANGED from before payment:
      const nwAfter = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: baseAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: afterPayment,
      });
      expect(nwAfter.netWorth).toBe(nwBefore.netWorth); // Bank cash down by 30k, CC liability down by 30k -> Net 0 delta
      expect(nwAfter.totalLiabilities).toBe(0);
    });
  });

  describe('6. ASSET_PURCHASE and ASSET_SALE Lifecycle', () => {
    it('ASSET_PURCHASE: decreases cash, increases assets, net worth unchanged', () => {
      const goldAsset: Asset = {
        id: 'asset-gold',
        name: 'Gold Coin 10g',
        category: 'GOLD',
        currentValue: 7500000, // ₹75,000
        purchaseValue: 7500000,
        purchaseDate: '2026-09-05',
        isArchived: false,
        createdAt: '2026-09-05',
        updatedAt: '2026-09-05',
      };

      const buyGoldTx: Transaction = {
        id: 'tx-buy-gold',
        type: 'ASSET_PURCHASE',
        amount: 7500000, // ₹75,000 paid from Bank
        date: '2026-09-05',
        accountId: bankAccount.id,
        assetId: goldAsset.id,
        createdAt: '2026-09-05',
        updatedAt: '2026-09-05',
      };

      const updatedAccounts = baseAccounts;
      const updatedAssets = [...baseAssets, goldAsset];

      const bankBal = calculateAccountBalance(bankAccount, [buyGoldTx]);
      expect(bankBal).toBe(5000000 - 7500000); // -25,000 (overdrawn or reduced)

      const nw = calculateNetWorth({
        accounts: updatedAccounts,
        people: basePeople,
        physicalAssets: updatedAssets,
        standaloneLiabilities: baseLiabilities,
        transactions: [buyGoldTx],
      });
      // Net worth is unchanged: bank balance dropped by 75k, asset increased by 75k
      expect(nw.netWorth).toBe(baselineNW);
    });

    it('ASSET_SALE: selling asset for more than book value generates capital gain in net worth', () => {
      // Sell MacBook (book value ₹1,50,000) for ₹1,60,000 (₹10,000 capital gain)
      const sellTx: Transaction = {
        id: 'tx-sell-macbook',
        type: 'ASSET_SALE',
        amount: 16000000, // ₹1,60,000 received into Bank
        date: '2026-09-12',
        accountId: bankAccount.id,
        assetId: laptopAsset.id,
        createdAt: '2026-09-12',
        updatedAt: '2026-09-12',
      };

      // Bank account increases by sale price
      expect(calculateAccountBalance(bankAccount, [sellTx])).toBe(5000000 + 16000000); // 21,000,000

      // Laptop asset is now sold/archived (currentValue = 0 in active assets)
      const activeAssetsWithoutSold = baseAssets.filter((a) => a.id !== laptopAsset.id);

      const nw = calculateNetWorth({
        accounts: baseAccounts,
        people: basePeople,
        physicalAssets: activeAssetsWithoutSold,
        standaloneLiabilities: baseLiabilities,
        transactions: [sellTx],
      });
      // Net worth increased by exactly the capital gain (₹10,000 = 1,000,000 paise)
      expect(nw.netWorth).toBe(baselineNW + 1000000);
    });
  });
});
