import { createModalSubmissionGuard } from '../../src/utils/modalSubmission';

describe('credit card payment modal submission lifecycle', () => {
  it('blocks duplicate payments and all dismissal paths while the database write is pending', () => {
    const guard = createModalSubmissionGuard();
    guard.open();
    const payment = guard.beginSubmission();
    expect(payment).not.toBeNull();
    expect(guard.beginSubmission()).toBeNull();
    expect(guard.beginDismissal()).toBeNull();
    expect(guard.canSubmit()).toBe(false);
  });

  it('keeps successful payment locked until the single close animation completes', () => {
    const guard = createModalSubmissionGuard();
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    guard.open();
    const payment = guard.beginSubmission()!;
    if (guard.completeSubmission(payment)) onSuccess();
    expect(guard.beginSubmission()).toBeNull();
    expect(guard.beginDismissal()).toBeNull();
    if (guard.completeSubmission(payment)) onSuccess();
    if (guard.finishDismissal(payment)) onClose();
    if (guard.finishDismissal(payment)) onClose();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('allows retry after a failed write', () => {
    const guard = createModalSubmissionGuard();
    guard.open();
    const payment = guard.beginSubmission()!;
    expect(guard.failSubmission(payment)).toBe(true);
    expect(guard.canSubmit()).toBe(true);
    expect(guard.beginSubmission()).not.toBeNull();
  });

  it('ignores an old close completion after the modal is hidden and reopened', () => {
    const guard = createModalSubmissionGuard();
    guard.open();
    const close = guard.beginDismissal()!;
    guard.invalidate();
    guard.open();
    expect(guard.finishDismissal(close)).toBe(false);
    expect(guard.canSubmit()).toBe(true);
  });

  it('does not let stale payment resolution change or close a new session', () => {
    const guard = createModalSubmissionGuard();
    guard.open();
    const oldPayment = guard.beginSubmission()!;
    guard.invalidate();
    guard.open();
    const currentPayment = guard.beginSubmission()!;
    expect(guard.completeSubmission(oldPayment)).toBe(false);
    expect(guard.failSubmission(oldPayment)).toBe(false);
    expect(guard.completeSubmission(currentPayment)).toBe(true);
    expect(guard.finishDismissal(currentPayment)).toBe(true);
  });

  it('coalesces repeated backdrop, close, and Android back dismissal', () => {
    const guard = createModalSubmissionGuard();
    guard.open();
    const close = guard.beginDismissal()!;
    expect(guard.beginDismissal()).toBeNull();
    expect(guard.beginDismissal()).toBeNull();
    expect(guard.finishDismissal(close)).toBe(true);
  });
});
