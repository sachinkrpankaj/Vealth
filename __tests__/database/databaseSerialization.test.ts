import { DatabaseOperationQueue, serializeDatabase } from '../../src/database/serializedDatabase';

describe('DatabaseOperationQueue & SQLite Serialization', () => {
  it('strictly serializes concurrent operations so at most one statement executes at a time', async () => {
    const queue = new DatabaseOperationQueue();
    let activeOperations = 0;
    let maxConcurrencyObserved = 0;
    const executionOrder: number[] = [];

    const makeQuery = (id: number, delayMs: number) => {
      return queue.enqueue(async () => {
        activeOperations++;
        maxConcurrencyObserved = Math.max(maxConcurrencyObserved, activeOperations);
        await new Promise((r) => setTimeout(r, delayMs));
        executionOrder.push(id);
        activeOperations--;
        return `result_${id}`;
      });
    };

    // Fire 10 concurrent operations simultaneously with Promise.all
    const promises = [
      makeQuery(1, 15),
      makeQuery(2, 10),
      makeQuery(3, 5),
      makeQuery(4, 20),
      makeQuery(5, 8),
      makeQuery(6, 12),
      makeQuery(7, 6),
      makeQuery(8, 14),
      makeQuery(9, 4),
      makeQuery(10, 10),
    ];

    const results = await Promise.all(promises);

    expect(maxConcurrencyObserved).toBe(1);
    expect(results).toEqual([
      'result_1',
      'result_2',
      'result_3',
      'result_4',
      'result_5',
      'result_6',
      'result_7',
      'result_8',
      'result_9',
      'result_10',
    ]);
    expect(executionOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('resumes and processes queued queries even if a query rejects with an error', async () => {
    const queue = new DatabaseOperationQueue();
    let op2Ran = false;

    const op1 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('Disk full or syntax error');
    });

    const op2 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      op2Ran = true;
      return 'recovered';
    });

    await expect(op1).rejects.toThrow('Disk full or syntax error');
    const result2 = await op2;

    expect(op2Ran).toBe(true);
    expect(result2).toBe('recovered');
  });

  it('serializes database methods on a decorated database handle', async () => {
    let activeStatementCount = 0;
    let maxStatementConcurrency = 0;

    const mockDb: any = {
      runAsync: jest.fn(async (sql: string, params?: any[]) => {
        activeStatementCount++;
        maxStatementConcurrency = Math.max(maxStatementConcurrency, activeStatementCount);
        await new Promise((r) => setTimeout(r, 15));
        activeStatementCount--;
        return { changes: 1, lastInsertRowId: 10 };
      }),
      getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
        activeStatementCount++;
        maxStatementConcurrency = Math.max(maxStatementConcurrency, activeStatementCount);
        await new Promise((r) => setTimeout(r, 10));
        activeStatementCount--;
        return [{ id: 1, name: 'Sample' }];
      }),
      getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
        activeStatementCount++;
        maxStatementConcurrency = Math.max(maxStatementConcurrency, activeStatementCount);
        await new Promise((r) => setTimeout(r, 8));
        activeStatementCount--;
        return { value: 'test' };
      }),
      execAsync: jest.fn(async (sql: string) => {
        activeStatementCount++;
        maxStatementConcurrency = Math.max(maxStatementConcurrency, activeStatementCount);
        await new Promise((r) => setTimeout(r, 5));
        activeStatementCount--;
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    // Call various database operations concurrently using Promise.all
    const [runRes, allRes, firstRes] = await Promise.all([
      serializedDb.runAsync('INSERT INTO t VALUES (1)'),
      serializedDb.getAllAsync('SELECT * FROM t'),
      serializedDb.getFirstAsync('SELECT val FROM t WHERE id = 1'),
    ]);

    expect(maxStatementConcurrency).toBe(1);
    expect(runRes).toEqual({ changes: 1, lastInsertRowId: 10 });
    expect(allRes).toEqual([{ id: 1, name: 'Sample' }]);
    expect(firstRes).toEqual({ value: 'test' });
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(1);
  });

  it('wraps child transaction handle with independent serialization in withExclusiveTransactionAsync', async () => {
    let txnActiveCount = 0;
    let maxTxnConcurrency = 0;

    const childTxn: any = {
      runAsync: jest.fn(async (sql: string) => {
        txnActiveCount++;
        maxTxnConcurrency = Math.max(maxTxnConcurrency, txnActiveCount);
        await new Promise((r) => setTimeout(r, 10));
        txnActiveCount--;
        return { changes: 1 };
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        txnActiveCount++;
        maxTxnConcurrency = Math.max(maxTxnConcurrency, txnActiveCount);
        await new Promise((r) => setTimeout(r, 10));
        txnActiveCount--;
        return [{ id: 'item' }];
      }),
    };

    const mockDb: any = {
      withExclusiveTransactionAsync: jest.fn(async (task: (txn: any) => Promise<void>) => {
        await task(childTxn);
      }),
    };

    const serializedDb = serializeDatabase(mockDb);

    await serializedDb.withExclusiveTransactionAsync(async (txn: any) => {
      // Execute two statements concurrently on txn
      const [r1, r2] = await Promise.all([
        txn.runAsync('UPDATE items SET status = 1'),
        txn.getAllAsync('SELECT * FROM items'),
      ]);

      expect(r1).toEqual({ changes: 1 });
      expect(r2).toEqual([{ id: 'item' }]);
    });

    expect(maxTxnConcurrency).toBe(1);
    expect(childTxn.runAsync).toHaveBeenCalledTimes(1);
    expect(childTxn.getAllAsync).toHaveBeenCalledTimes(1);
  });
});
