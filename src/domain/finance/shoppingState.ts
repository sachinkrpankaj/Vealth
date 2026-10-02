import { ShoppingItemStatus } from './types';

const ALLOWED_TRANSITIONS: Record<ShoppingItemStatus, readonly ShoppingItemStatus[]> = {
  PENDING: ['PURCHASED', 'DISCARDED'],
  PURCHASED: ['PENDING'],
  DISCARDED: ['PENDING'],
};

export function canTransitionShoppingItem(
  from: ShoppingItemStatus,
  to: ShoppingItemStatus
): boolean {
  return from === to || ALLOWED_TRANSITIONS[from]?.includes(to) === true;
}

export function assertShoppingItemTransition(
  from: ShoppingItemStatus,
  to: ShoppingItemStatus
): void {
  if (!canTransitionShoppingItem(from, to)) {
    throw new Error(`Invalid shopping item status transition: ${from} -> ${to}.`);
  }
}
