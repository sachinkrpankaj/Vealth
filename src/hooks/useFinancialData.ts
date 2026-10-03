import { useState, useEffect, useCallback } from 'react';
import {
  Account,
  Asset,
  Category,
  Liability,
  NetWorthSummary,
  Person,
  PersonDebtSummary,
  Transaction,
} from '../domain/finance/types';
import { getAllAccounts } from '../database/repositories/accountRepository';
import { getAllPeople } from '../database/repositories/personRepository';
import { getAllTransactions } from '../database/repositories/transactionRepository';
import { getAllAssets } from '../database/repositories/assetRepository';
import { getAllLiabilities } from '../database/repositories/liabilityRepository';
import { getAllCategories } from '../database/repositories/categoryRepository';
import { recordSnapshot } from '../database/repositories/snapshotRepository';
import { getSetting } from '../database/repositories/settingsRepository';
import {
  calculateAllAccountBalances,
  calculateAllPersonDebts,
  calculateNetWorth,
} from '../domain/finance/financialEngine';
import { formatDateIso } from '../utils/dateUtils';

export interface FinancialDataState {
  isLoading: boolean;
  error: string | null;
  userName: string;
  accounts: Account[];
  accountBalances: Map<string, number>;
  people: Person[];
  personDebts: PersonDebtSummary[];
  physicalAssets: Asset[];
  standaloneLiabilities: Liability[];
  categories: Category[];
  transactions: Transaction[];
  netWorth: NetWorthSummary;
  refresh: () => Promise<void>;
}

export function useFinancialData(): FinancialDataState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [physicalAssets, setPhysicalAssets] = useState<Asset[]>([]);
  const [standaloneLiabilities, setStandaloneLiabilities] = useState<Liability[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const accs = await getAllAccounts(true);
      const ppl = await getAllPeople(true);
      const txs = await getAllTransactions();
      const asts = await getAllAssets(true);
      const libs = await getAllLiabilities(true);
      const cats = await getAllCategories(true);
      const storedName = await getSetting('user_name');

      setAccounts(accs);
      setPeople(ppl);
      setTransactions(txs);
      setCategories(cats);
      if (storedName) {
        setUserName(storedName);
      }
      setPhysicalAssets(asts);
      setStandaloneLiabilities(libs);

      // Record daily net-worth snapshot using local date
      const today = formatDateIso(new Date());
      const nw = calculateNetWorth({
        accounts: accs,
        people: ppl,
        physicalAssets: asts,
        standaloneLiabilities: libs,
        transactions: txs,
      });

      try {
        await recordSnapshot({
          date: today,
          netWorth: nw.netWorth,
          totalAssets: nw.totalAssets,
          totalLiabilities: nw.totalLiabilities,
          totalReceivables: nw.totalReceivables,
          totalPayables: nw.totalPayables,
        });
      } catch (e) {
        // Snapshot recording warning should not break UI
        console.warn('Snapshot recording warning:', e);
      }
    } catch (err: any) {
      console.error('Error loading financial data:', err);
      setError(err?.message ?? 'Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accountBalances = calculateAllAccountBalances(accounts, transactions);
  const personDebts = calculateAllPersonDebts(people, transactions);
  const netWorth = calculateNetWorth({
    accounts,
    people,
    physicalAssets,
    standaloneLiabilities,
    transactions,
  });

  return {
    isLoading,
    error,
    userName,
    accounts,
    accountBalances,
    people,
    personDebts,
    categories,
    physicalAssets,
    standaloneLiabilities,
    transactions,
    netWorth,
    refresh,
  };
}
