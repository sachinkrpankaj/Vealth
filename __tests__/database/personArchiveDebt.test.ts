import { Person, Transaction } from '../../src/domain/finance/types';
import {
  calculatePersonDebt,
  calculateAllPersonDebts,
  calculateTotalReceivables,
  calculateTotalPayables,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';

describe('5. Person Archive + Outstanding Debt Accounting Safety — Regression Tests', () => {
  const TODAY = '2026-10-02';

  const activePersonWithDebt: Person = {
    id: 'person-active-debt',
    name: 'Aakash',
    avatarColor: '#3B82F6',
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const archivedPersonWithReceivable: Person = {
    id: 'person-archived-owed',
    name: 'Rahul (Archived)',
    avatarColor: '#10B981',
    isArchived: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-10-01',
  };

  const archivedPersonWithPayable: Person = {
    id: 'person-archived-you-owe',
    name: 'Vikram (Archived)',
    avatarColor: '#F59E0B',
    isArchived: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-10-01',
  };

  const archivedPersonZeroDebt: Person = {
    id: 'person-archived-settled',
    name: 'Neha (Settled & Archived)',
    avatarColor: '#8B5CF6',
    isArchived: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-10-01',
  };

  const lendToRahul: Transaction = {
    id: 'tx-lend-rahul',
    type: 'LEND',
    amount: 5000000, // ₹50,000 Rahul owes user
    date: '2026-09-01',
    personId: archivedPersonWithReceivable.id,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const borrowFromVikram: Transaction = {
    id: 'tx-borrow-vikram',
    type: 'BORROW',
    amount: 2000000, // ₹20,000 user owes Vikram
    date: '2026-09-10',
    personId: archivedPersonWithPayable.id,
    createdAt: '2026-09-10',
    updatedAt: '2026-09-10',
  };

  const settledLend: Transaction = {
    id: 'tx-settled-lend',
    type: 'LEND',
    amount: 1000000,
    date: '2026-08-01',
    personId: archivedPersonZeroDebt.id,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  };

  const settledRepay: Transaction = {
    id: 'tx-settled-repay',
    type: 'REPAYMENT_RECEIVED',
    amount: 1000000,
    date: '2026-08-15',
    personId: archivedPersonZeroDebt.id,
    createdAt: '2026-08-15',
    updatedAt: '2026-08-15',
  };

  const allPeople = [
    activePersonWithDebt,
    archivedPersonWithReceivable,
    archivedPersonWithPayable,
    archivedPersonZeroDebt,
  ];

  const allTx = [lendToRahul, borrowFromVikram, settledLend, settledRepay];

  it('preserves outstanding receivables from archived persons in calculateTotalReceivables', () => {
    // ₹50,000 owed by Rahul must NOT disappear when Rahul is archived
    const receivables = calculateTotalReceivables(allPeople, allTx, TODAY);
    expect(receivables).toBe(5000000);
  });

  it('preserves outstanding payables to archived persons in calculateTotalPayables', () => {
    // ₹20,000 user owes Vikram must NOT disappear when Vikram is archived
    const payables = calculateTotalPayables(allPeople, allTx, TODAY);
    expect(payables).toBe(2000000);
  });

  it('includes active balances from archived persons in net worth calculation', () => {
    const nw = calculateNetWorth({
      accounts: [],
      people: allPeople,
      physicalAssets: [],
      standaloneLiabilities: [],
      transactions: allTx,
      asOfDate: TODAY,
    });

    // Net worth = Assets (0) + Receivables (50,000) - Liabilities (0) - Payables (20,000) = +30,000 (3,000,000 paise)
    expect(nw.totalReceivables).toBe(5000000);
    expect(nw.totalPayables).toBe(2000000);
    expect(nw.netWorth).toBe(3000000);
  });

  it('calculateAllPersonDebts returns active people PLUS archived people with outstanding balances', () => {
    const debts = calculateAllPersonDebts(allPeople, allTx, TODAY);

    // Should include:
    // 1. activePersonWithDebt (active)
    // 2. archivedPersonWithReceivable (archived, but owes 50,000)
    // 3. archivedPersonWithPayable (archived, but owed 20,000)
    // Should EXCLUDE:
    // archivedPersonZeroDebt (archived and 0 balance)
    expect(debts.some((d) => d.person.id === archivedPersonWithReceivable.id)).toBe(true);
    expect(debts.some((d) => d.person.id === archivedPersonWithPayable.id)).toBe(true);
    expect(debts.some((d) => d.person.id === archivedPersonZeroDebt.id)).toBe(false);

    const rahulDebt = debts.find((d) => d.person.id === archivedPersonWithReceivable.id);
    expect(rahulDebt?.owedToYou).toBe(5000000);

    const vikramDebt = debts.find((d) => d.person.id === archivedPersonWithPayable.id);
    expect(vikramDebt?.youOwe).toBe(2000000);
  });
});
