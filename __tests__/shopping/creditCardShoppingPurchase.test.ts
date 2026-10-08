import { openDatabaseAsync } from 'expo-sqlite';
import {
  createShoppingList,
  createShoppingItem,
  purchaseShoppingItem,
  restoreShoppingItem,
} from '../../src/database/repositories/shoppingRepository';
import { calculateNetWorth, calculateAllAccountBalances } from '../../src/domain/finance/financialEngine';
import { getCreditCardBillingInfo } from '../../src/domain/finance/creditCardBilling';
import { Account, Transaction, ShoppingItem } from '../../src/domain/finance/types';
import { getTodayLocalDateString } from '../../src/utils/dateUtils';

const openMock = openDatabaseAsync as jest.Mock;

describe('Shopping List - Credit Card & Cash/Bank Purchase Integration', () => {
  let mockDb: any;
  let mockTxn: any;

  let shoppingListsTable: any[] = [];
  let shoppingItemsTable: any[] = [];
  let accountsTable: any[] = [];
  let categoriesTable: any[] = [];
  let transactionsTable: any[] = [];

  beforeEach(() => {
    shoppingListsTable = [];
    shoppingItemsTable = [];
    transactionsTable = [];

    accountsTable = [
      {
        id: 'acc-bank',
        name: 'HDFC Bank',
        type: 'BANK',
        openingBalance: 500000, // ₹5,000.00
        creditLimit: 0,
        isArchived: 0,
      },
      {
        id: 'acc-cash',
        name: 'Wallet Cash',
        type: 'CASH',
        openingBalance: 100000, // ₹1,000.00
        creditLimit: 0,
        isArchived: 0,
      },
      {
        id: 'acc-cc',
        name: 'ICICI Amazon Pay Card',
        type: 'CREDIT_CARD',
        openingBalance: 0,
        creditLimit: 1000000, // ₹10,000.00 credit limit
        isArchived: 0,
      },
      {
        id: 'acc-invest',
        name: 'Groww Mutual Funds',
        type: 'INVESTMENT',
        openingBalance: 2000000,
        creditLimit: 0,
        isArchived: 0,
      },
    ];

    categoriesTable = [
      { id: 'cat-shopping', name: 'Shopping', type: 'EXPENSE', isArchived: 0 },
      { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', isArchived: 0 },
    ];

    mockTxn = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();

        if (normalized.includes('FROM shopping_items WHERE id = ?')) {
          return shoppingItemsTable.find((i) => i.id === params[0]) || null;
        }
        if (normalized.includes('FROM shopping_items WHERE transactionId = ?')) {
          return shoppingItemsTable.find((i) => i.transactionId === params[0]) || null;
        }
        if (normalized.includes('FROM shopping_lists WHERE id = ?')) {
          return shoppingListsTable.find((l) => l.id === params[0]) || null;
        }
        if (normalized.includes('FROM transactions WHERE id = ?')) {
          return transactionsTable.find((t) => t.id === params[0]) || null;
        }
        if (normalized.includes('FROM accounts WHERE id = ?')) {
          return accountsTable.find((a) => a.id === params[0]) || null;
        }
        if (normalized.includes('FROM categories WHERE id = ?')) {
          return categoriesTable.find((c) => c.id === params[0]) || null;
        }
        if (/type IN\s*\(\s*'INCOME'/.test(normalized)) {
          const accId = params[0];
          const credits = transactionsTable
            .filter(
              (t) =>
                !t.deletedAt &&
                t.date <= params[2] &&
                ((t.accountId === accId && ['INCOME', 'BORROW', 'REPAYMENT_RECEIVED', 'ASSET_SALE'].includes(t.type)) ||
                  (t.destinationAccountId === accId && t.type === 'TRANSFER'))
            )
            .reduce((sum, t) => sum + t.amount, 0);
          return { total: credits };
        }
        if (/type IN\s*\(\s*'EXPENSE'/.test(normalized)) {
          const accId = params[0];
          const debits = transactionsTable
            .filter(
              (t) =>
                !t.deletedAt &&
                t.date <= params[1] &&
                t.accountId === accId &&
                ['EXPENSE', 'LEND', 'REPAYMENT_MADE', 'TRANSFER', 'ASSET_PURCHASE'].includes(t.type)
            )
            .reduce((sum, t) => sum + t.amount, 0);
          return { total: debits };
        }
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts')) {
          return accountsTable;
        }
        return [];
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();

        if (normalized.includes('INSERT INTO transactions')) {
          const [id, amount, date, accountId, categoryId, note, metadata, createdAt, updatedAt] = params;
          transactionsTable.push({
            id,
            type: 'EXPENSE',
            amount,
            date,
            accountId,
            destinationAccountId: null,
            personId: null,
            categoryId,
            assetId: null,
            liabilityId: null,
            note,
            dueDate: null,
            metadata,
            createdAt,
            updatedAt,
            deletedAt: null,
          });
          return { changes: 1 };
        }

        if (normalized.includes("SET status = 'PURCHASED'")) {
          const [purchasedAt, purchasePrice, purchaseAccountId, transactionId, categoryId, updatedAt, id] = params;
          const item = shoppingItemsTable.find((i) => i.id === id);
          if (item) {
            item.status = 'PURCHASED';
            item.purchasedAt = purchasedAt;
            item.purchasePrice = purchasePrice;
            item.purchaseAccountId = purchaseAccountId;
            item.transactionId = transactionId;
            item.categoryId = categoryId;
            item.updatedAt = updatedAt;
          }
          return { changes: 1 };
        }

        if (normalized.includes("SET status = 'PENDING'")) {
          const [updatedAt, id] = params;
          const item = shoppingItemsTable.find((i) => i.id === id);
          if (item) {
            item.status = 'PENDING';
            item.purchasedAt = null;
            item.purchasePrice = null;
            item.purchaseAccountId = null;
            item.transactionId = null;
            item.categoryId = null;
            item.updatedAt = updatedAt;
          }
          return { changes: 1 };
        }

        if (normalized.includes('UPDATE transactions SET deletedAt = ?')) {
          const [deletedAt, updatedAt, id] = params;
          const tx = transactionsTable.find((t) => t.id === id);
          if (tx) {
            tx.deletedAt = deletedAt;
          }
          return { changes: 1 };
        }

        return { changes: 1 };
      }),
    };

    mockDb = {
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (cb: (txn: any) => Promise<any>) => cb(mockTxn)),
      withExclusiveTransactionAsync: jest.fn(async (cb: (txn: any) => Promise<any>) => cb(mockTxn)),
    };

    openMock.mockResolvedValue(mockDb);
  });

  const getCardAvailableCredit = (cardAccId: string) => {
    const card = accountsTable.find((a) => a.id === cardAccId);
    if (!card) return 0;
    return getCreditCardBillingInfo(card as Account, transactionsTable as Transaction[]).remainingLimit;
  };

  test('1. Bank Purchase: records expense, deducts bank balance, leaves credit card intact', async () => {
    shoppingListsTable.push({ id: 'list-1', name: 'Weekly Essentials', isArchived: 0 });
    shoppingItemsTable.push({
      id: 'item-groceries',
      listId: 'list-1',
      name: 'Organic Milk & Eggs',
      estimatedPrice: 25000,
      status: 'PENDING',
    });

    const today = getTodayLocalDateString();
    const result = await purchaseShoppingItem({
      itemId: 'item-groceries',
      purchasePrice: 25000, // ₹250.00
      purchaseAccountId: 'acc-bank',
      categoryId: 'cat-groceries',
      purchaseDate: today,
    });

    expect(result.shoppingItem.status).toBe('PURCHASED');
    expect(result.shoppingItem.purchaseAccountId).toBe('acc-bank');
    expect(transactionsTable).toHaveLength(1);
    expect(transactionsTable[0].type).toBe('EXPENSE');
    expect(transactionsTable[0].amount).toBe(25000);
    expect(transactionsTable[0].accountId).toBe('acc-bank');

    // Net worth check (only cash + bank accounts)
    const activeBankAndCash = accountsTable
      .filter((a) => a.type === 'BANK' || a.type === 'CASH')
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        openingBalance: a.openingBalance,
        creditLimit: a.creditLimit,
        currency: 'INR',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        isArchived: !!a.isArchived,
      }));
    const nw = calculateNetWorth({
      accounts: activeBankAndCash,
      transactions: transactionsTable as Transaction[],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      asOfDate: today,
    });
    // Initial bank (5000) + cash (1000) - expense (250) = 5750.
    expect(nw.netWorth).toBe(575000);
  });

  test('2. Credit Card Purchase: records expense on card, updates utilization & available credit correctly', async () => {
    shoppingListsTable.push({ id: 'list-1', name: 'Electronics List', isArchived: 0 });
    shoppingItemsTable.push({
      id: 'item-headphones',
      listId: 'list-1',
      name: 'Wireless Headphones',
      estimatedPrice: 400000,
      status: 'PENDING',
    });

    const initialAvail = getCardAvailableCredit('acc-cc');
    expect(initialAvail).toBe(1000000); // Full ₹10,000 available

    const today = getTodayLocalDateString();
    const result = await purchaseShoppingItem({
      itemId: 'item-headphones',
      purchasePrice: 400000, // ₹4,000.00
      purchaseAccountId: 'acc-cc',
      categoryId: 'cat-shopping',
      purchaseDate: today,
      customNote: 'ANC Headphones purchase',
    });

    expect(result.shoppingItem.status).toBe('PURCHASED');
    expect(result.shoppingItem.purchaseAccountId).toBe('acc-cc');
    expect(result.shoppingItem.transactionId).toBe(result.transactionId);

    // Verify transaction
    expect(transactionsTable).toHaveLength(1);
    const tx = transactionsTable[0];
    expect(tx.type).toBe('EXPENSE');
    expect(tx.amount).toBe(400000);
    expect(tx.accountId).toBe('acc-cc');
    expect(tx.note).toBe('ANC Headphones purchase');

    // Available credit must drop by ₹4,000 to ₹6,000
    const updatedAvail = getCardAvailableCredit('acc-cc');
    expect(updatedAvail).toBe(600000); // ₹6,000 remaining limit

    // Cash and bank accounts must NOT be touched
    const activeTestAccounts: Account[] = accountsTable
      .filter((a) => a.type === 'BANK' || a.type === 'CASH' || a.type === 'CREDIT_CARD')
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        openingBalance: a.openingBalance,
        creditLimit: a.creditLimit,
        currency: 'INR',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        isArchived: !!a.isArchived,
      }));
    const balances = calculateAllAccountBalances(activeTestAccounts, transactionsTable as Transaction[], today);
    expect(balances.get('acc-bank')).toBe(500000); // Unchanged ₹5,000
    expect(balances.get('acc-cash')).toBe(100000); // Unchanged ₹1,000
    expect(balances.get('acc-cc')).toBe(-400000); // Card balance is -₹4,000 (liability)

    // Net worth: Assets (Bank 5000 + Cash 1000) - Liabilities (Card 4000) = 2000
    const nw = calculateNetWorth({
      accounts: activeTestAccounts,
      transactions: transactionsTable as Transaction[],
      people: [],
      physicalAssets: [],
      standaloneLiabilities: [],
      asOfDate: today,
    });
    expect(nw.totalAssets).toBe(600000);
    expect(nw.totalLiabilities).toBe(400000);
    expect(nw.netWorth).toBe(200000);
  });

  test('3. Credit Card Limit Enforcement: rejects purchase exceeding available credit', async () => {
    shoppingListsTable.push({ id: 'list-1', name: 'Expensive Gear', isArchived: 0 });
    shoppingItemsTable.push({
      id: 'item-laptop',
      listId: 'list-1',
      name: 'MacBook Pro',
      estimatedPrice: 1500000,
      status: 'PENDING',
    });

    const today = getTodayLocalDateString();
    // Card has ₹10,000 limit, purchase is ₹15,000
    await expect(
      purchaseShoppingItem({
        itemId: 'item-laptop',
        purchasePrice: 1500000,
        purchaseAccountId: 'acc-cc',
        purchaseDate: today,
      })
    ).rejects.toThrow(/Insufficient credit limit/i);

    // Item must remain PENDING and no transaction created
    expect(shoppingItemsTable[0].status).toBe('PENDING');
    expect(transactionsTable).toHaveLength(0);
  });

  test('4. Investment Account Rejection: rejects funding directly from investment accounts', async () => {
    shoppingListsTable.push({ id: 'list-1', name: 'List', isArchived: 0 });
    shoppingItemsTable.push({
      id: 'item-1',
      listId: 'list-1',
      name: 'Item',
      status: 'PENDING',
    });

    const today = getTodayLocalDateString();
    await expect(
      purchaseShoppingItem({
        itemId: 'item-1',
        purchasePrice: 10000,
        purchaseAccountId: 'acc-invest',
        purchaseDate: today,
      })
    ).rejects.toThrow(/Investment accounts cannot be used as a direct funding source/i);
  });

  test('5. Restore / Unmark: unmarking credit card purchase restores available credit atomically', async () => {
    shoppingListsTable.push({ id: 'list-1', name: 'List', isArchived: 0 });
    shoppingItemsTable.push({
      id: 'item-shoes',
      listId: 'list-1',
      name: 'Running Shoes',
      estimatedPrice: 300000,
      status: 'PENDING',
    });

    const today = getTodayLocalDateString();
    const purchaseResult = await purchaseShoppingItem({
      itemId: 'item-shoes',
      purchasePrice: 300000,
      purchaseAccountId: 'acc-cc',
      purchaseDate: today,
    });

    expect(getCardAvailableCredit('acc-cc')).toBe(700000);
    expect(transactionsTable[0].deletedAt).toBeNull();

    // Now restore item to pending
    await restoreShoppingItem('item-shoes');

    expect(shoppingItemsTable[0].status).toBe('PENDING');
    expect(shoppingItemsTable[0].transactionId).toBeNull();
    expect(shoppingItemsTable[0].purchasePrice).toBeNull();
    expect(transactionsTable[0].deletedAt).toBeTruthy();

    // Available credit must be fully restored to ₹10,000
    expect(getCardAvailableCredit('acc-cc')).toBe(1000000);
  });

  test('backdated card purchases use credit available on the purchase date, excluding later bill payments', async () => {
    shoppingListsTable.push({ id: 'list-1', name: 'List', isArchived: 0 });
    shoppingItemsTable.push({ id: 'backdated', listId: 'list-1', name: 'Historical purchase', status: 'PENDING' });
    transactionsTable.push(
      { id: 'old-spending', type: 'EXPENSE', accountId: 'acc-cc', amount: 900000, date: '2026-09-01' },
      { id: 'later-payment', type: 'TRANSFER', accountId: 'acc-bank', destinationAccountId: 'acc-cc', amount: 800000, date: '2026-09-20' }
    );
    await expect(purchaseShoppingItem({
      itemId: 'backdated', purchasePrice: 200000, purchaseAccountId: 'acc-cc', purchaseDate: '2026-09-10',
    })).rejects.toThrow(/Insufficient credit limit/i);
    expect(transactionsTable).toHaveLength(2);
    expect(shoppingItemsTable[0].status).toBe('PENDING');
  });

  test('credit card purchase and reversal preserve opening debt and agree with billing and net worth', async () => {
    const card = accountsTable.find((account) => account.id === 'acc-cc');
    card.openingBalance = -200000;
    shoppingListsTable.push({ id: 'list-1', name: 'List', isArchived: 0 });
    shoppingItemsTable.push({ id: 'opening-debt', listId: 'list-1', name: 'Purchase', status: 'PENDING' });
    const financialSummary = () => calculateNetWorth({
      accounts: accountsTable.filter((account) => account.type !== 'INVESTMENT') as Account[],
      transactions: transactionsTable as Transaction[], people: [], physicalAssets: [], standaloneLiabilities: [],
    });
    const before = financialSummary();
    await purchaseShoppingItem({
      itemId: 'opening-debt', purchasePrice: 300000, purchaseAccountId: 'acc-cc', purchaseDate: getTodayLocalDateString(),
    });
    expect(getCardAvailableCredit('acc-cc')).toBe(500000);
    expect(financialSummary()).toMatchObject({
      totalAssets: before.totalAssets, totalLiabilities: before.totalLiabilities + 300000, netWorth: before.netWorth - 300000,
    });
    await restoreShoppingItem('opening-debt');
    expect(getCardAvailableCredit('acc-cc')).toBe(800000);
    expect(financialSummary()).toMatchObject({
      totalAssets: before.totalAssets, totalLiabilities: before.totalLiabilities, netWorth: before.netWorth,
    });
  });
});
