import {
  assertShoppingItemTransition,
  canTransitionShoppingItem,
} from '../../src/domain/finance/shoppingState';
import { ShoppingItemStatus } from '../../src/domain/finance/types';

describe('shopping item status state machine', () => {
  it.each([
    ['PENDING', 'PURCHASED'],
    ['PENDING', 'DISCARDED'],
    ['DISCARDED', 'PENDING'],
    ['PURCHASED', 'PENDING'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionShoppingItem(from, to)).toBe(true);
    expect(() => assertShoppingItemTransition(from, to)).not.toThrow();
  });

  it.each([
    ['DISCARDED', 'PURCHASED'],
    ['PURCHASED', 'DISCARDED'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransitionShoppingItem(from, to)).toBe(false);
    expect(() => assertShoppingItemTransition(from, to)).toThrow(
      `Invalid shopping item status transition: ${from} -> ${to}.`
    );
  });

  it('allows idempotent requests without treating them as transitions', () => {
    for (const status of ['PENDING', 'PURCHASED', 'DISCARDED'] as ShoppingItemStatus[]) {
      expect(canTransitionShoppingItem(status, status)).toBe(true);
      expect(() => assertShoppingItemTransition(status, status)).not.toThrow();
    }
  });
});
