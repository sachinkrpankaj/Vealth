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

  // If already wrapped on this object, skip
  if ((original as any).__isWrapped) {
    return;
  }

  // Check if it's a Jest mock function in test environments
  if ((original as any)._isMockFunction) {
    const mockFn = original as jest.Mock;
    const originalImpl = mockFn.getMockImplementation() || (() => Promise.resolve());
    mockFn.mockImplementation((...args: any[]) => {
      if (customWrapper) {
        return customWrapper(originalImpl as any, ...(args as any));
      }
      return queue.enqueue(() => Promise.resolve(originalImpl(...args)));
    });
    (mockFn as any).__isWrapped = true;
    return;
  }

  const boundOriginal = original.bind(target);
  const wrapped = (...args: any[]) => {
    if (customWrapper) {
      return customWrapper(boundOriginal as any, ...(args as any));
    }
    return queue.enqueue(() => boundOriginal(...args));
  };
  (wrapped as any).__isWrapped = true;
  target[methodName] = wrapped;
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

  // 2. Intercept withExclusiveTransactionAsync to wrap the newly spawned txn handle with its own serializer
  wrapMethod(
    db,
    'withExclusiveTransactionAsync',
    queue,
    async (originalMethod, task: (txn: any) => Promise<void>) => {
      // Do not serialize withExclusiveTransactionAsync on db's queue,
      // as it creates an independent connection.
      // But ensure the child txn has its own per-handle serialization.
      return originalMethod(async (txn: any) => {
        const serializedTxn = serializeDatabase(txn);
        await task(serializedTxn);
      });
    }
  );

  // 3. Intercept withTransactionAsync to ensure child txn handle is serialized
  wrapMethod(
    db,
    'withTransactionAsync',
    queue,
    async (originalMethod, task: (txn?: any) => Promise<any>) => {
      return originalMethod(async (txn?: any) => {
        const wrappedTxn = txn ? serializeDatabase(txn) : db;
        return task(wrappedTxn);
      });
    }
  );

  return db;
}
