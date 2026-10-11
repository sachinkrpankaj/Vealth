import {
  DatabaseOperationQueue,
  serializeDatabase,
} from '../../src/database/serializedDatabase';

describe('SQLite Concurrency, Atomicity & Serialization Audit Regression Tests', () => {
  describe('1. Re-entrancy Safety & Nested Transaction Execution', () => {
    it('executes statements inside withTransactionAsync without deadlocking', async () => {
      const mockRawDb: any = {
        runAsync: jest.fn(async (sql: string) => ({ changes: 1 })),
        withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
          return task();
        }),
      };

      const db = serializeDatabase(mockRawDb);

      let result = '';
      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE accounts SET openingBalance = 1000 WHERE id = 1');
        result = 'success';
      });

      expect(result).toBe('success');
      expect(mockRawDb.runAsync).toHaveBeenCalledTimes(1);
    });

    it('safely flattens nested withTransactionAsync calls on serialized database handle', async () => {
      let outerStarted = false;
      let innerCompleted = false;

      let nativeTransactionsStarted = 0;

      const mockRawDb: any = {
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
        withTransactionAsync: async (task: () => Promise<void>) => {
          nativeTransactionsStarted++;
          return task();
        },
      };

      const db = serializeDatabase(mockRawDb);

      await db.withTransactionAsync(async () => {
        outerStarted = true;
        // Nested transaction call inside active transaction
        await db.withTransactionAsync(async () => {
          await db.runAsync('INSERT INTO logs VALUES ("nested")');
          innerCompleted = true;
        });
      });

      expect(outerStarted).toBe(true);
      expect(innerCompleted).toBe(true);
      // withTransactionAsync at native level called only ONCE for outer transaction
      expect(nativeTransactionsStarted).toBe(1);
    });
  });

  describe('2. Concurrent Transaction Serialization', () => {
    it('serializes concurrent withExclusiveTransactionAsync tasks so they run strictly one at a time', async () => {
      let activeTxnCount = 0;
      let maxTxnConcurrency = 0;
      const order: number[] = [];

      const mockRawDb: any = {
        withExclusiveTransactionAsync: jest.fn(async (task: (txn: any) => Promise<void>) => {
          activeTxnCount++;
          maxTxnConcurrency = Math.max(maxTxnConcurrency, activeTxnCount);
          const txn = {
            runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
          };
          try {
            await task(txn);
          } finally {
            activeTxnCount--;
          }
        }),
      };

      const db = serializeDatabase(mockRawDb);

      const runTask = (id: number, delayMs: number) => {
        return db.withExclusiveTransactionAsync(async (txn: any) => {
          await new Promise((r) => setTimeout(r, delayMs));
          order.push(id);
        });
      };

      await Promise.all([
        runTask(1, 30),
        runTask(2, 20),
        runTask(3, 10),
      ]);

      // Strict serialization: max concurrent transaction executions is 1
      expect(maxTxnConcurrency).toBe(1);
      // In FIFO queue order
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('3. Transaction Rollback & Error Propagation', () => {
    it('propagates transaction error and allows subsequent queue operations to execute normally', async () => {
      const mockRawDb: any = {
        withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
          return task();
        }),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      };

      const db = serializeDatabase(mockRawDb);

      // Failing transaction
      const failingTxn = db.withTransactionAsync(async () => {
        throw new Error('Database constraint violation: FOREIGN KEY failed');
      });

      await expect(failingTxn).rejects.toThrow('Database constraint violation: FOREIGN KEY failed');

      // Subsequent transaction must execute cleanly without deadlock or corruption
      let successResult = '';
      await db.withTransactionAsync(async () => {
        await db.runAsync('INSERT INTO recovered VALUES (1)');
        successResult = 'recovered';
      });

      expect(successResult).toBe('recovered');
    });
  });
});
