import {
  getEffectiveDateBounds,
  getSelectableDateShortcuts,
  isDateDisabled,
  selectDateWithinBounds,
} from '../../src/utils/dateUtils';

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

  it('shows shortcuts only when the shared effective bounds allow them', () => {
    const referenceDate = new Date(2026, 9, 2);
    const bounds = getEffectiveDateBounds('2026-09-01', '2026-10-10', true, TODAY);
    const shortcuts = getSelectableDateShortcuts(true, bounds, referenceDate);
    expect(shortcuts.map((shortcut) => shortcut.label)).toContain('+7 Days');
    expect(shortcuts.map((shortcut) => shortcut.label)).not.toContain('+30 Days');
  });

  it('hides shortcuts below minDate and above maxDate', () => {
    const referenceDate = new Date(2026, 9, 2);
    const minBounds = getEffectiveDateBounds('2026-10-03', undefined, true, TODAY);
    const minShortcuts = getSelectableDateShortcuts(true, minBounds, referenceDate);
    expect(minShortcuts.map((shortcut) => shortcut.label)).not.toContain('Yesterday');
    expect(minShortcuts.map((shortcut) => shortcut.label)).not.toContain('Today');

    const maxBounds = getEffectiveDateBounds(undefined, '2026-10-05', true, TODAY);
    const maxShortcuts = getSelectableDateShortcuts(true, maxBounds, referenceDate);
    expect(maxShortcuts.map((shortcut) => shortcut.label)).not.toContain('+7 Days');
    expect(maxShortcuts.map((shortcut) => shortcut.label)).not.toContain('+30 Days');
  });

  it('hides future shortcuts when future dates are disabled and prevents disabled selection', () => {
    const referenceDate = new Date(2026, 9, 2);
    const bounds = getEffectiveDateBounds(undefined, '2026-10-31', false, TODAY);
    const shortcuts = getSelectableDateShortcuts(false, bounds, referenceDate);
    expect(shortcuts.map((shortcut) => shortcut.dateStr).every((date) => date <= TODAY)).toBe(true);
    expect(selectDateWithinBounds('2026-10-20', bounds)).toBeNull();
    expect(selectDateWithinBounds(TODAY, bounds)).toBe(TODAY);
  });
});
