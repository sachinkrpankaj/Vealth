import {
  serializeDatabase,
  _setTransactionStorageForTesting,
  getActiveTransaction,
  serializeTransactionHandle,
  DatabaseOperationQueue,
} from '../../src/database/serializedDatabase';
import { fetchFinancialSnapshot } from '../../src/hooks/useFinancialData';
import { createAccount } from '../../src/database/repositories/accountRepository';
import { createTransaction } from '../../src/database/repositories/transactionRepository';
import { getDatabase, _resetDatabaseForTesting } from '../../src/database/db';

describe('Production Persistence Deadlock & Lifecycle Regression (Mobile / Hermes Simulation)', () => {
  let originalStorage: any;

  beforeEach(() => {
    _resetDatabaseForTesting();
    // Simulate React Native / Hermes environment where AsyncLocalStorage is null
    _setTransactionStorageForTesting(null);
  });

  afterEach(() => {
    // Restore default
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AsyncLocalStorage } = require('async_hooks');
      _setTransactionStorageForTesting(new AsyncLocalStorage());
    } catch {
      _setTransactionStorageForTesting(null);
    }
  });

  it('guarantees withTransactionAsync executes BEGIN, queries, and COMMIT without deadlocking when AsyncLocalStorage is unavailable', async () => {
    const executedQueries: string[] = [];

    // Emulate expo-sqlite's exact withTransactionAsync implementation which calls this.execAsync
    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
      }),
      runAsync: jest.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        return { changes: 1, lastInsertRowId: 1 };
      }),
      getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        return [{ id: 'row1' }];
      }),
      getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        return { count: 1 };
      }),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    // Run withTransactionAsync without AsyncLocalStorage
    let taskCompleted = false;
    const txnPromise = serializedDb.withTransactionAsync(async (txn?: any) => {
      const executor = txn || serializedDb;
      // Execute read and write queries inside transaction
      await executor.runAsync('INSERT INTO accounts VALUES (1)');
      await executor.getAllAsync('SELECT * FROM accounts');
      // Also query directly on serializedDb to prove reentrancy
      await serializedDb.getFirstAsync('SELECT count(*) FROM accounts');
      taskCompleted = true;
    });

    // Enforce a strict timeout: a deadlock would hang indefinitely
    await Promise.race([
      txnPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadlock detected: withTransactionAsync did not resolve within 2s')), 2000)
      ),
    ]);

    expect(taskCompleted).toBe(true);
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('INSERT INTO accounts VALUES (1)');
    expect(executedQueries).toContain('SELECT * FROM accounts');
    expect(executedQueries).toContain('SELECT count(*) FROM accounts');
    expect(executedQueries).toContain('COMMIT');
    expect(getActiveTransaction(serializedDb)).toBeNull();
  });

  it('guarantees rollback executes and unblocks subsequent queries when a transaction fails without AsyncLocalStorage', async () => {
    const executedQueries: string[] = [];

    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
      }),
      runAsync: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
        return { changes: 1 };
      }),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    // Fail inside transaction
    const failingTxn = serializedDb.withTransactionAsync(async (txn?: any) => {
      await (txn || serializedDb).runAsync('INSERT INTO accounts VALUES (1)');
      throw new Error('Database constraint violation: duplicate ID');
    });

    await expect(failingTxn).rejects.toThrow('Database constraint violation: duplicate ID');

    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('INSERT INTO accounts VALUES (1)');
    expect(executedQueries).toContain('ROLLBACK');
    expect(executedQueries).not.toContain('COMMIT');
    expect(getActiveTransaction(serializedDb)).toBeNull();

    // Verify queue is completely healthy and processes subsequent write operations
    const nextWrite = await serializedDb.runAsync('INSERT INTO accounts VALUES (2)');
    expect(nextWrite).toEqual({ changes: 1 });
    expect(executedQueries).toContain('INSERT INTO accounts VALUES (2)');
  });

  it('routes queries on db inside withExclusiveTransactionAsync to the transaction handle without deadlocking', async () => {
    const txnQueries: string[] = [];
    const rootQueries: string[] = [];

    const childTxn: any = {
      runAsync: jest.fn(async (sql: string) => {
        txnQueries.push(sql);
        return { changes: 1 };
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        txnQueries.push(sql);
        return { id: 'child-row' };
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        txnQueries.push(sql);
        return [{ id: 'child-all' }];
      }),
    };

    const mockDb: any = {
      runAsync: jest.fn(async (sql: string) => {
        rootQueries.push(sql);
        return { changes: 1 };
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        rootQueries.push(sql);
        return { id: 'root-row' };
      }),
      withExclusiveTransactionAsync: jest.fn(async (task: (txn: any) => Promise<any>) => {
        return await task(childTxn);
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    let finished = false;
    const testPromise = serializedDb.withExclusiveTransactionAsync(async (txn: any) => {
      // 1. Direct call on transaction handle
      await txn.runAsync('UPDATE tx SET status = 1');
      // 2. Call on serializedDb inside transaction — should route to childTxn rather than deadlocking behind db queue
      const row = await serializedDb.getFirstAsync('SELECT * FROM tx WHERE id = 1');
      expect(row).toEqual({ id: 'child-row' });
      // 3. Nested withExclusiveTransactionAsync — should pass through reentrantly
      await serializedDb.withExclusiveTransactionAsync(async (nestedTxn: any) => {
        await nestedTxn.runAsync('UPDATE tx SET nested = 1');
      });
      finished = true;
    });

    await Promise.race([
      testPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadlock detected in withExclusiveTransactionAsync')), 2000)
      ),
    ]);

    expect(finished).toBe(true);
    expect(txnQueries).toContain('UPDATE tx SET status = 1');
    expect(txnQueries).toContain('SELECT * FROM tx WHERE id = 1');
    expect(txnQueries).toContain('UPDATE tx SET nested = 1');
    // Root DB was not touched directly, preventing cross-connection locks
    expect(rootQueries).toHaveLength(0);
    expect(getActiveTransaction(serializedDb)).toBeNull();
  });

  it('proves fetchFinancialSnapshot completes and does not deadlock when invoked concurrently without AsyncLocalStorage', async () => {
    const mockDb: any = {
      execAsync: jest.fn(async () => {}),
      runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('accounts')) return [{ id: 'acc1', name: 'Cash', type: 'CASH', openingBalance: 1000, isArchived: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' }];
        if (sql.includes('people')) return [];
        if (sql.includes('transactions')) return [];
        if (sql.includes('assets')) return [];
        if (sql.includes('liabilities')) return [];
        if (sql.includes('categories')) return [{ count: 10 }];
        return [];
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('app_settings')) return { value: 'Tester' };
        return null;
      }),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const sqlite = require('expo-sqlite');
    jest.spyOn(sqlite, 'openDatabaseAsync').mockResolvedValue(mockDb);

    // Call fetchFinancialSnapshot concurrently
    const [snap1, snap2] = await Promise.all([
      fetchFinancialSnapshot(),
      fetchFinancialSnapshot(),
    ]);

    expect(snap1).toBeDefined();
    expect(snap1.accounts).toHaveLength(1);
    expect(snap1.accounts[0].name).toBe('Cash');
    expect(snap1.userName).toBe('Tester');
    expect(snap2).toBe(snap1); // Deduplicated in-flight
  });

  it('guarantees financial writes (createAccount, createTransaction) execute and persist without deadlocking on Hermes', async () => {
    const executedQueries: string[] = [];
    const accountsTable: any[] = [];
    const transactionsTable: any[] = [];

    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
      }),
      runAsync: jest.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        if (sql.includes('INSERT INTO accounts')) {
          accountsTable.push({ id: params?.[0], name: params?.[1], type: params?.[2] });
        } else if (sql.includes('INSERT INTO transactions')) {
          transactionsTable.push({ id: params?.[0], type: params?.[1], amount: params?.[2] });
        }
        return { changes: 1, lastInsertRowId: 1 };
      }),
      getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        if (sql.includes('categories')) return [{ count: 10 }];
        if (sql.includes('FROM accounts')) return accountsTable;
        if (sql.includes('FROM transactions')) return transactionsTable;
        return [];
      }),
      getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return accountsTable.find((a) => a.id === params?.[0]) || null;
        }
        return null;
      }),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const sqlite = require('expo-sqlite');
    jest.spyOn(sqlite, 'openDatabaseAsync').mockResolvedValue(mockDb);

    // 1. Create an account
    const acc = await createAccount({
      id: 'acc_test_1',
      name: 'Salary Account',
      type: 'BANK',
      openingBalance: 50000,
      currency: 'INR',
      isArchived: false,
    });
    expect(acc.name).toBe('Salary Account');

    // 2. Create an income transaction
    const txIncome = await createTransaction({
      id: 'tx_income_1',
      type: 'INCOME',
      amount: 50000,
      date: '2026-10-10',
      accountId: 'acc_test_1',
      note: 'Monthly salary',
    });
    expect(txIncome.amount).toBe(50000);

    // 3. Create an expense transaction
    const txExpense = await createTransaction({
      id: 'tx_expense_1',
      type: 'EXPENSE',
      amount: 2500,
      date: '2026-10-10',
      accountId: 'acc_test_1',
      note: 'Groceries',
    });
    expect(txExpense.amount).toBe(2500);

    expect(accountsTable).toHaveLength(1);
    expect(transactionsTable).toHaveLength(2);
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('COMMIT');
  });

  it('verifies loading state cleanup in save handlers when persistence operations reject without deadlocking future writes', async () => {
    let isSaving = false;
    let errorMessage: string | null = null;

    const mockDb: any = {
      execAsync: jest.fn(async () => {}),
      runAsync: jest.fn(async (sql: string) => {
        if (sql.includes('failing_table')) {
          throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
        }
        return { changes: 1 };
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('categories')) return [{ count: 10 }];
        return [];
      }),
      getFirstAsync: jest.fn(async () => null),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const sqlite = require('expo-sqlite');
    jest.spyOn(sqlite, 'openDatabaseAsync').mockResolvedValue(mockDb);

    const db = await getDatabase();

    // Emulate UI save handler pattern with try/catch/finally
    const saveHandler = async () => {
      try {
        isSaving = true;
        errorMessage = null;
        await db.runAsync('INSERT INTO failing_table VALUES (1)');
      } catch (err: any) {
        errorMessage = err.message;
      } finally {
        isSaving = false;
      }
    };

    await saveHandler();

    // Verify loading spinner is cleared and error surfaced
    expect(isSaving).toBe(false);
    expect(errorMessage).toBe('SQLITE_CONSTRAINT: UNIQUE constraint failed');

    // Verify subsequent save operation executes successfully without being blocked
    let nextSaveSuccess = false;
    const nextSaveHandler = async () => {
      try {
        isSaving = true;
        await db.runAsync('INSERT INTO healthy_table VALUES (2)');
        nextSaveSuccess = true;
      } finally {
        isSaving = false;
      }
    };

    await nextSaveHandler();
    expect(isSaving).toBe(false);
    expect(nextSaveSuccess).toBe(true);
  });

  it('guarantees DatabaseOperationQueue executes safely with primitive or throwing unref timer handles (React Native Hermes compatibility)', async () => {
    // 1. Primitive numeric timer ID (React Native / Hermes engine)
    const spyNumeric = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any, ms: any) => {
      return 98765 as any;
    }) as any);
    const queue1 = new DatabaseOperationQueue();
    const result1 = await queue1.enqueue(async () => 'hermes_number_timer');
    expect(result1).toBe('hermes_number_timer');
    spyNumeric.mockRestore();

    // 2. Object timer handle without unref method
    const spyNoUnref = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any, ms: any) => {
      return { id: 'rn_timer_object' } as any;
    }) as any);
    const queue2 = new DatabaseOperationQueue();
    const result2 = await queue2.enqueue(async () => 'no_unref_timer');
    expect(result2).toBe('no_unref_timer');
    spyNoUnref.mockRestore();

    // 3. Object timer handle with throwing unref method (broken polyfill safeguard)
    const spyThrowing = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any, ms: any) => {
      return {
        unref: () => {
          throw new Error('Platform does not support unref()');
        },
      } as any;
    }) as any);
    const queue3 = new DatabaseOperationQueue();
    const result3 = await queue3.enqueue(async () => 'throwing_unref_timer');
    expect(result3).toBe('throwing_unref_timer');
    spyThrowing.mockRestore();
  });

  it('guarantees deterministic transaction isolation and prevents lost updates across concurrent transactions on Hermes', async () => {
    const balances: Record<string, number> = { acc1: 1000, acc2: 500 };
    const executionTrace: string[] = [];

    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executionTrace.push(sql);
      }),
      runAsync: jest.fn(async (sql: string, params?: any[]) => {
        executionTrace.push(`RUN: ${sql} [${params?.join(', ') || ''}]`);
        return { changes: 1 };
      }),
      getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
        const accId = params?.[0];
        executionTrace.push(`GET: ${sql} [${accId}]`);
        return { balance: balances[accId] };
      }),
      getAllAsync: jest.fn(async () => []),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    // Tx1: Transfer 200 from acc1 to acc2 with an async delay in between
    const tx1 = serializedDb.withTransactionAsync(async (txn?: any) => {
      const exec = txn || serializedDb;
      const acc1Row: any = await exec.getFirstAsync('SELECT balance FROM accounts WHERE id = ?', ['acc1']);
      // Simulate real-world asynchronous work / reconciliation inside transaction
      await new Promise((resolve) => setTimeout(resolve, 20));
      balances.acc1 = acc1Row.balance - 200;
      await exec.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [balances.acc1, 'acc1']);

      const acc2Row: any = await exec.getFirstAsync('SELECT balance FROM accounts WHERE id = ?', ['acc2']);
      balances.acc2 = acc2Row.balance + 200;
      await exec.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [balances.acc2, 'acc2']);
    });

    // Tx2: Concurrently triggered transaction that deposits 300 to acc1
    const tx2 = serializedDb.withTransactionAsync(async (txn?: any) => {
      const exec = txn || serializedDb;
      const acc1Row: any = await exec.getFirstAsync('SELECT balance FROM accounts WHERE id = ?', ['acc1']);
      balances.acc1 = acc1Row.balance + 300;
      await exec.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [balances.acc1, 'acc1']);
    });

    // Run both concurrently
    await Promise.all([tx1, tx2]);

    // Final balances must be strictly consistent and conserved
    expect(balances.acc1).toBe(1100); // 1000 - 200 + 300
    expect(balances.acc2).toBe(700);  // 500 + 200
    expect(balances.acc1 + balances.acc2).toBe(1800); // Initial was 1500 + 300 deposit = 1800

    // Trace verifies BEGIN -> queries -> COMMIT sequences did not interleave
    const beginIndices = executionTrace.map((val, idx) => (val === 'BEGIN' ? idx : -1)).filter((idx) => idx !== -1);
    const commitIndices = executionTrace.map((val, idx) => (val === 'COMMIT' ? idx : -1)).filter((idx) => idx !== -1);

    expect(beginIndices).toHaveLength(2);
    expect(commitIndices).toHaveLength(2);
    // First transaction committed before second transaction began
    expect(commitIndices[0]).toBeLessThan(beginIndices[1]);
  });

  it('verifies withExclusiveTransactionAsync fallback when native exclusive transactions are unavailable', async () => {
    const executedQueries: string[] = [];

    // Mock database that only provides withTransactionAsync (no withExclusiveTransactionAsync)
    const mockDb: any = {
      execAsync: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
      }),
      runAsync: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
        return { changes: 1 };
      }),
      withTransactionAsync: jest.fn(async function (this: any, task: () => Promise<void>) {
        try {
          await this.execAsync('BEGIN');
          await task();
          await this.execAsync('COMMIT');
        } catch (e) {
          await this.execAsync('ROLLBACK');
          throw e;
        }
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    // Verify fallback is attached
    expect(typeof (serializedDb as any).withExclusiveTransactionAsync).toBe('function');

    let taskExecuted = false;
    await (serializedDb as any).withExclusiveTransactionAsync(async (txn: any) => {
      expect(txn).toBeDefined();
      await txn.runAsync('INSERT INTO fallback_test VALUES (1)');
      // Nested transaction pass-through
      await txn.withExclusiveTransactionAsync(async (nested: any) => {
        await nested.runAsync('INSERT INTO fallback_test VALUES (2)');
      });
      taskExecuted = true;
    });

    expect(taskExecuted).toBe(true);
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('INSERT INTO fallback_test VALUES (1)');
    expect(executedQueries).toContain('INSERT INTO fallback_test VALUES (2)');
    expect(executedQueries).toContain('COMMIT');
  });

  it('verifies transaction-handle re-entrancy and cleanup of INSIDE_TXN_EXEC_KEY even if inner operations fail', async () => {
    const mockDb: any = {
      runAsync: jest.fn(async (sql: string) => {
        if (sql.includes('fail')) {
          throw new Error('Inner query failure');
        }
        return { changes: 1 };
      }),
    };

    const serializedTxn = serializeTransactionHandle(mockDb, mockDb);

    // 1. Successful query execution
    await serializedTxn.runAsync('INSERT INTO t1 VALUES (1)');
    expect((mockDb as any).__vaelth_inside_txn_exec__).toBe(false);

    // 2. Failing query execution
    await expect(serializedTxn.runAsync('INSERT INTO t1_fail VALUES (2)')).rejects.toThrow('Inner query failure');
    // Guard flag must be cleanly restored to false even after rejection
    expect((mockDb as any).__vaelth_inside_txn_exec__).toBe(false);

    // 3. Subsequent query succeeds without re-entrancy leakage
    const res = await serializedTxn.runAsync('INSERT INTO t1 VALUES (3)');
    expect(res).toEqual({ changes: 1 });
    expect((mockDb as any).__vaelth_inside_txn_exec__).toBe(false);
  });
});
