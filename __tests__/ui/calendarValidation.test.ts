import { isDateDisabled } from '../../src/utils/dateUtils';

describe('2 & 17. Calendar minDate/maxDate & Future Date Validation — Unit Tests', () => {
  const TODAY = '2026-10-02';

  it('prevents selecting dates strictly before minDate', () => {
    const minDate = '2026-09-15';

    // Dates before minDate are disabled
    expect(isDateDisabled('2026-09-14', minDate, undefined, true, TODAY)).toBe(true);
    expect(isDateDisabled('2026-08-31', minDate, undefined, true, TODAY)).toBe(true);

    // Exactly minDate is enabled
    expect(isDateDisabled('2026-09-15', minDate, undefined, true, TODAY)).toBe(false);

    // Dates after minDate are enabled
    expect(isDateDisabled('2026-09-16', minDate, undefined, true, TODAY)).toBe(false);
  });

  it('prevents selecting dates strictly after maxDate', () => {
    const maxDate = '2026-10-15';

    // Dates after maxDate are disabled
    expect(isDateDisabled('2026-10-16', undefined, maxDate, true, TODAY)).toBe(true);
    expect(isDateDisabled('2026-11-01', undefined, maxDate, true, TODAY)).toBe(true);

    // Exactly maxDate is enabled
    expect(isDateDisabled('2026-10-15', undefined, maxDate, true, TODAY)).toBe(false);

    // Dates before maxDate are enabled
    expect(isDateDisabled('2026-10-14', undefined, maxDate, true, TODAY)).toBe(false);
  });

  it('strictly disables future dates when allowFutureDates is false, even without explicit maxDate', () => {
    // Tomorrow is disabled
    expect(isDateDisabled('2026-10-03', undefined, undefined, false, TODAY)).toBe(true);
    expect(isDateDisabled('2026-10-20', undefined, undefined, false, TODAY)).toBe(true);

    // Today is enabled
    expect(isDateDisabled('2026-10-02', undefined, undefined, false, TODAY)).toBe(false);

    // Yesterday is enabled
    expect(isDateDisabled('2026-10-01', undefined, undefined, false, TODAY)).toBe(false);
  });

  it('respects the tighter constraint when both maxDate and allowFutureDates=false are provided', () => {
    // If maxDate is in the past (e.g. 2026-09-20), effective max is 2026-09-20
    const pastMax = '2026-09-20';
    expect(isDateDisabled('2026-09-25', undefined, pastMax, false, TODAY)).toBe(true);
    expect(isDateDisabled('2026-09-20', undefined, pastMax, false, TODAY)).toBe(false);

    // If maxDate is in the future (e.g. 2026-10-31), but allowFutureDates=false, effective max is TODAY (2026-10-02)
    const futureMax = '2026-10-31';
    expect(isDateDisabled('2026-10-05', undefined, futureMax, false, TODAY)).toBe(true);
    expect(isDateDisabled('2026-10-02', undefined, futureMax, false, TODAY)).toBe(false);
  });

  it('enforces both minDate and maxDate window simultaneously', () => {
    const minDate = '2026-10-01';
    const maxDate = '2026-10-05';

    expect(isDateDisabled('2026-09-30', minDate, maxDate, true, TODAY)).toBe(true);
    expect(isDateDisabled('2026-10-01', minDate, maxDate, true, TODAY)).toBe(false);
    expect(isDateDisabled('2026-10-03', minDate, maxDate, true, TODAY)).toBe(false);
    expect(isDateDisabled('2026-10-05', minDate, maxDate, true, TODAY)).toBe(false);
    expect(isDateDisabled('2026-10-06', minDate, maxDate, true, TODAY)).toBe(true);
  });
});
