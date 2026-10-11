import type * as SQLite from 'expo-sqlite';

/**
 * A per-database FIFO queue that serializes asynchronous SQLite operations
 * to prevent overlapping statement lifecycles on the same native database handle.
 *
 * This eliminates the expo-sqlite / Android Fabric New Architecture error:
 * "Cannot use shared object that was already released" / "NativeDatabase.prepareAsync rejected"
 */
export class DatabaseOperationQueue {
  private tail: Promise<void> = Promise.resolve();

  public enqueue<T>(operation: () => Promise<T>): Promise<T> {
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: any) => void;

    const resultPromise = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const run = async () => {
      try {
        const res = await operation();
        resolveResult(res);
      } catch (err) {
        rejectResult(err);
      }
    };

    // Chain onto the tail; if the tail rejected previously, still run the next operation
    this.tail = this.tail.then(run, run);

    return resultPromise;
  }
}

const SERIALIZED_FLAG = '__vaelth_serialized__';
const TRANSACTION_HANDLE_FLAG = '__vaelth_txn_serialized__';
const UNWRAPPED_METHODS_KEY = '__vaelth_unwrapped__';

let transactionStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AsyncLocalStorage } = require('async_hooks');
  transactionStorage = new AsyncLocalStorage();
} catch {
  // Not available in this runtime (e.g. mobile environments without async_hooks)
}

function wrapMethod<T extends (...args: any[]) => Promise<any>>(
  target: any,
  methodName: string,
  queue: DatabaseOperationQueue,
  customWrapper?: (originalMethod: T, ...args: Parameters<T>) => Promise<any>
): void {
  const original = target[methodName];
  if (typeof original !== 'function') {
    return;
  }

  if ((original as any).__isWrapped) {
    return;
  }

  if (!target[UNWRAPPED_METHODS_KEY]) {
    target[UNWRAPPED_METHODS_KEY] = {};
  }

  if ((original as any)._isMockFunction) {
    const mockFn = original as jest.Mock;
    const originalImpl = mockFn.getMockImplementation() || (() => Promise.resolve());
    target[UNWRAPPED_METHODS_KEY][methodName] = originalImpl.bind(target);

    mockFn.mockImplementation((...args: any[]) => {
      const currentTxn = transactionStorage?.getStore();
      if (currentTxn && currentTxn.db === target) {
        if (customWrapper) {
          return customWrapper(originalImpl as any, ...(args as any));
        }
        return originalImpl(...args);
      }

      if (customWrapper) {
        return queue.enqueue(() => customWrapper(originalImpl as any, ...(args as any)));
      }
      return queue.enqueue(() => originalImpl(...args));
    });
    (mockFn as any).__isWrapped = true;
    return;
  }

  const boundOriginal = original.bind(target);
  target[UNWRAPPED_METHODS_KEY][methodName] = boundOriginal;

  const handler = (...args: any[]) => {
    const currentTxn = transactionStorage?.getStore();
    if (currentTxn && currentTxn.db === target) {
      if (customWrapper) {
        return customWrapper(boundOriginal as any, ...(args as any));
      }
      return boundOriginal(...args);
    }

    if (customWrapper) {
      return queue.enqueue(() => customWrapper(boundOriginal as any, ...(args as any)));
    }
    return queue.enqueue(() => boundOriginal(...args));
  };

  (handler as any).__isWrapped = true;
  target[methodName] = handler;
}

/**
 * Wraps a transaction-scoped database handle so that operations executed within
 * the transaction callback run directly against the native transaction handle
 * with their own FIFO serializer, preventing native prepare collisions without
 * deadlocking behind the parent database queue.
 */
export function serializeTransactionHandle(rawTxn: any, rootDb?: any): any {
  if (!rawTxn || typeof rawTxn !== 'object') {
    return rawTxn;
  }

  if (rawTxn[TRANSACTION_HANDLE_FLAG]) {
    return rawTxn;
  }

  const txnQueue = new DatabaseOperationQueue();
  const serializedTxn = Object.create(rawTxn);

  Object.defineProperty(serializedTxn, TRANSACTION_HANDLE_FLAG, {
    value: true,
    configurable: true,
    writable: false,
    enumerable: false,
  });

  const methods = ['runAsync', 'getFirstAsync', 'getAllAsync', 'execAsync'];
  const unwrapped = rawTxn[UNWRAPPED_METHODS_KEY] || {};
  const rootUnwrapped = rootDb?.[UNWRAPPED_METHODS_KEY] || {};

  for (const method of methods) {
    const rawMethod = rawTxn[method];
    const isMock =
      typeof rawMethod === 'function' &&
      Boolean(
        (rawMethod as any)._isMockFunction ||
          (typeof jest !== 'undefined' && typeof jest.isMockFunction === 'function' && jest.isMockFunction(rawMethod))
      );

    const targetMethod = isMock
      ? rawMethod.bind(rawTxn)
      : unwrapped[method] ||
        (typeof rawTxn[method] === 'function' ? rawTxn[method].bind(rawTxn) : undefined) ||
        rootUnwrapped[method] ||
        (rootDb && typeof rootDb[method] === 'function' ? rootDb[method].bind(rootDb) : undefined);

    if (targetMethod) {
      serializedTxn[method] = (...args: any[]) => {
        return txnQueue.enqueue(() => targetMethod(...args));
      };
    }
  }

  // Nested transaction calls pass through cleanly within this transaction scope
  serializedTxn.withExclusiveTransactionAsync = async (nestedTask: (child: any) => Promise<any>) => {
    return await nestedTask(serializedTxn);
  };
  serializedTxn.withTransactionAsync = async (nestedTask: () => Promise<any>) => {
    return await nestedTask();
  };

  return serializedTxn;
}

/**
 * Decorates a SQLiteDatabase instance with per-database operation serialization.
 * Returns the same database instance so that identity checks (e.g. toBe(mockDb)) remain intact.
 */
export function serializeDatabase(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  if (!db || typeof db !== 'object') {
    return db;
  }

  if ((db as any)[SERIALIZED_FLAG]) {
    return db;
  }

  Object.defineProperty(db, SERIALIZED_FLAG, {
    value: true,
    configurable: true,
    writable: false,
    enumerable: false,
  });

  const queue = new DatabaseOperationQueue();

  // 1. Serialize standard query execution methods on this handle
  wrapMethod(db, 'runAsync', queue);
  wrapMethod(db, 'getFirstAsync', queue);
  wrapMethod(db, 'getAllAsync', queue);
  wrapMethod(db, 'execAsync', queue);
  wrapMethod(db, 'closeAsync', queue);

  const rawWithTx = (db as any).withTransactionAsync;
  const hasExclusive = typeof (db as any).withExclusiveTransactionAsync === 'function';

  // 2. Intercept withExclusiveTransactionAsync to wrap the spawned txn handle with its own transaction serializer
  if (hasExclusive) {
    wrapMethod(
      db,
      'withExclusiveTransactionAsync',
      queue,
      async (originalMethod, task: (txn: any) => Promise<any>) => {
        const currentTxn = transactionStorage?.getStore();
        if (currentTxn && currentTxn.db === db) {
          return await task(currentTxn.txnHandle);
        }

        return await originalMethod(async (txn: any) => {
          const serializedTxn = serializeTransactionHandle(txn || db, db);
          if (transactionStorage) {
            return await transactionStorage.run(
              { db, txnHandle: serializedTxn },
              async () => task(serializedTxn)
            );
          }
          return await task(serializedTxn);
        });
      }
    );
  }

  // 3. Intercept withTransactionAsync
  if (typeof rawWithTx === 'function') {
    wrapMethod(
      db,
      'withTransactionAsync',
      queue,
      async (originalMethod, task: (txn?: any) => Promise<any>) => {
        const currentTxn = transactionStorage?.getStore();
        if (currentTxn && currentTxn.db === db) {
          return await task(currentTxn.txnHandle);
        }

        const serializedTxn = serializeTransactionHandle(db, db);
        const executeTask = async () => {
          return await originalMethod(async () => {
            return await task(serializedTxn);
          });
        };

        if (transactionStorage) {
          return await transactionStorage.run(
            { db, txnHandle: serializedTxn },
            executeTask
          );
        }
        return await executeTask();
      }
    );
  }

  return db;
}

