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

  public enqueue<T>(operation: () => Promise<T>, opName = 'anonymous'): Promise<T> {
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: any) => void;

    const resultPromise = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const run = async () => {
      const warnTimer = setTimeout(() => {
        console.warn(`[DB WARNING] Operation "${opName}" in database queue running for >10s.`);
      }, 10000);
      try {
        if (typeof (warnTimer as any)?.unref === 'function') {
          (warnTimer as any).unref();
        }
      } catch {
        // Safe fallback in environments where timer handle does not support unref (e.g. React Native Hermes)
      }
      try {
        const res = await operation();
        resolveResult(res);
      } catch (err) {
        rejectResult(err);
      } finally {
        clearTimeout(warnTimer);
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
const ACTIVE_TXN_KEY = '__vaelth_active_txn__';
const INSIDE_TXN_EXEC_KEY = '__vaelth_inside_txn_exec__';
const IS_EXECUTING_TXN_LIFECYCLE_KEY = '__vaelth_executing_txn_lifecycle__';

let transactionStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AsyncLocalStorage } = require('async_hooks');
  transactionStorage = new AsyncLocalStorage();
} catch {
  // Not available in this runtime (e.g. mobile environments without async_hooks)
}

/** Testing helper to simulate environments without AsyncLocalStorage (e.g. React Native/Hermes) */
export function _setTransactionStorageForTesting(storage: any): void {
  transactionStorage = storage;
}

export function getActiveTransaction(target: any): {
  db: any;
  txnHandle: any;
  isExclusive?: boolean;
  isSeparateConnection?: boolean;
} | null {
  const store = transactionStorage?.getStore();
  if (store && store.db === target) {
    return store;
  }
  const active = target?.[ACTIVE_TXN_KEY];
  if (active && active.db === target) {
    return active;
  }
  return null;
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

  const isMock = Boolean((original as any)._isMockFunction);
  const boundOriginal = isMock
    ? ((original as jest.Mock).getMockImplementation() || (() => Promise.resolve())).bind(target)
    : original.bind(target);
  target[UNWRAPPED_METHODS_KEY][methodName] = boundOriginal;

  const invokeUnwrappedOrCustom = (...args: any[]) => {
    if (customWrapper) {
      return customWrapper(boundOriginal as any, ...(args as any));
    }
    return boundOriginal(...args);
  };

  const handler = (...args: any[]) => {
    // 1. Transaction lifecycle statements (BEGIN / COMMIT / ROLLBACK) called internally by expo-sqlite's withTransactionAsync
    if (target[IS_EXECUTING_TXN_LIFECYCLE_KEY]) {
      return boundOriginal(...args);
    }

    // 2. Active transaction context via AsyncLocalStorage (Node.js) or target tracking
    const currentTxn = getActiveTransaction(target);
    if (currentTxn && currentTxn.db === target) {
      if (customWrapper) {
        return customWrapper(boundOriginal as any, ...(args as any));
      }
      if (
        !target[INSIDE_TXN_EXEC_KEY] &&
        currentTxn.isExclusive &&
        currentTxn.isSeparateConnection &&
        currentTxn.txnHandle &&
        currentTxn.txnHandle !== target &&
        typeof currentTxn.txnHandle[methodName] === 'function'
      ) {
        return currentTxn.txnHandle[methodName](...args);
      }
      return boundOriginal(...args);
    }

    // 3. Re-entrancy guard when executing within serializeTransactionHandle
    if (target[INSIDE_TXN_EXEC_KEY]) {
      return invokeUnwrappedOrCustom(...args);
    }

    // 4. All other operations queue onto the database FIFO queue to guarantee complete transaction isolation
    if (customWrapper) {
      return queue.enqueue(() => customWrapper(boundOriginal as any, ...(args as any)), methodName);
    }
    return queue.enqueue(() => boundOriginal(...args), methodName);
  };

  (handler as any).__isWrapped = true;
  if (isMock) {
    (original as jest.Mock).mockImplementation(handler);
    (original as any).__isWrapped = true;
  } else {
    target[methodName] = handler;
  }
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

    let targetMethod: any;
    if (isMock) {
      targetMethod = rawMethod.bind(rawTxn);
    } else if (unwrapped[method]) {
      targetMethod = unwrapped[method];
    } else if (typeof rawTxn[method] === 'function' && !(rawTxn[method] as any).__isWrapped) {
      targetMethod = rawTxn[method].bind(rawTxn);
    } else if (rootUnwrapped[method]) {
      targetMethod = rootUnwrapped[method];
    } else if (rootDb && typeof rootDb[method] === 'function') {
      targetMethod = rootDb[method].bind(rootDb);
    }

    if (targetMethod) {
      serializedTxn[method] = (...args: any[]) => {
        return txnQueue.enqueue(async () => {
          const dbTarget = rootDb || rawTxn;
          const prevInside = Boolean(dbTarget && dbTarget[INSIDE_TXN_EXEC_KEY]);
          if (dbTarget) {
            dbTarget[INSIDE_TXN_EXEC_KEY] = true;
          }
          try {
            return await targetMethod(...args);
          } finally {
            if (dbTarget) {
              dbTarget[INSIDE_TXN_EXEC_KEY] = prevInside;
            }
          }
        }, `txn_${method}`);
      };
    }
  }

  // Nested transaction calls pass through cleanly within this transaction scope
  serializedTxn.withExclusiveTransactionAsync = async (nestedTask: (child: any) => Promise<any>) => {
    return await nestedTask(serializedTxn);
  };
  serializedTxn.withTransactionAsync = async (nestedTask: (child?: any) => Promise<any>) => {
    return await nestedTask(serializedTxn);
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
        const currentTxn = getActiveTransaction(db);
        if (currentTxn && currentTxn.db === db) {
          return await task(currentTxn.txnHandle);
        }

        return await originalMethod(async (txn: any) => {
          const rawTxnHandle = txn || db;
          const isSeparateConnection = rawTxnHandle !== db;
          const serializedTxn = serializeTransactionHandle(rawTxnHandle, db);
          const txnContext = {
            db,
            txnHandle: serializedTxn,
            isExclusive: true,
            isSeparateConnection,
          };
          const prevTxn = (db as any)[ACTIVE_TXN_KEY];
          (db as any)[ACTIVE_TXN_KEY] = txnContext;

          const runTask = async () => {
            try {
              return await task(serializedTxn);
            } finally {
              (db as any)[ACTIVE_TXN_KEY] = prevTxn;
            }
          };

          if (transactionStorage) {
            return await transactionStorage.run(txnContext, runTask);
          }
          return await runTask();
        });
      }
    );
  } else if (typeof rawWithTx === 'function') {
    (db as any).withExclusiveTransactionAsync = async (task: (txn: any) => Promise<any>) => {
      return await (db as any).withTransactionAsync(async (txn?: any) => {
        return await task(txn || db);
      });
    };
  }

  // 3. Intercept withTransactionAsync
  if (typeof rawWithTx === 'function') {
    wrapMethod(
      db,
      'withTransactionAsync',
      queue,
      async (originalMethod, task: (txn?: any) => Promise<any>) => {
        const currentTxn = getActiveTransaction(db);
        if (currentTxn && currentTxn.db === db) {
          return await task(currentTxn.txnHandle);
        }

        const serializedTxn = serializeTransactionHandle(db, db);
        const txnContext = {
          db,
          txnHandle: serializedTxn,
          isExclusive: false,
          isSeparateConnection: false,
        };
        const prevTxn = (db as any)[ACTIVE_TXN_KEY];
        (db as any)[ACTIVE_TXN_KEY] = txnContext;

        const executeTask = async () => {
          try {
            (db as any)[IS_EXECUTING_TXN_LIFECYCLE_KEY] = true;
            return await originalMethod(async () => {
              (db as any)[IS_EXECUTING_TXN_LIFECYCLE_KEY] = false;
              try {
                return await task(serializedTxn);
              } finally {
                (db as any)[IS_EXECUTING_TXN_LIFECYCLE_KEY] = true;
              }
            });
          } finally {
            (db as any)[IS_EXECUTING_TXN_LIFECYCLE_KEY] = false;
            (db as any)[ACTIVE_TXN_KEY] = prevTxn;
          }
        };

        if (transactionStorage) {
          return await transactionStorage.run(txnContext, executeTask);
        }
        return await executeTask();
      }
    );
  }

  return db;
}

