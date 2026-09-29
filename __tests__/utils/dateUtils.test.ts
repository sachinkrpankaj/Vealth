import {
  formatDateIso,
  parseDateIso,
  formatDisplayDate,
  getMonthName,
  getDaysInMonth,
  getMonthMatrix,
  getQuickDateShortcuts,
} from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('formatDateIso', () => {
    it('formats date to YYYY-MM-DD', () => {
      const d = new Date(2026, 8, 20); // Sept is month 8
      expect(formatDateIso(d)).toBe('2026-09-20');
    });

    it('pads single digit months and days with leading zeros', () => {
      const d = new Date(2026, 0, 5); // Jan 5
      expect(formatDateIso(d)).toBe('2026-01-05');
    });
  });

  describe('parseDateIso', () => {
    it('parses valid YYYY-MM-DD correctly in local time', () => {
      const d = parseDateIso('2026-09-20');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8);
      expect(d?.getDate()).toBe(20);
    });

    it('handles single digit month and day gracefully if passed', () => {
      const d = parseDateIso('2026-9-5');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8);
      expect(d?.getDate()).toBe(5);
    });

    it('returns null for invalid or impossible dates', () => {
      expect(parseDateIso('')).toBeNull();
      expect(parseDateIso(null)).toBeNull();
      expect(parseDateIso('not-a-date')).toBeNull();
      expect(parseDateIso('2026-02-31')).toBeNull(); // Feb 31 doesn't exist
      expect(parseDateIso('2026-13-01')).toBeNull(); // Month 13 doesn't exist
    });
  });

  describe('formatDisplayDate', () => {
    it('formats a date without relative if disabled', () => {
      const res = formatDisplayDate('2026-09-20', { includeRelative: false });
      expect(res).toBe('20 Sep 2026');
    });

    it('identifies today correctly', () => {
      const todayIso = formatDateIso(new Date());
      const res = formatDisplayDate(todayIso);
      expect(res).toContain('Today');
    });

    it('returns original string if invalid format', () => {
      expect(formatDisplayDate('invalid')).toBe('invalid');
      expect(formatDisplayDate('')).toBe('');
    });
  });

  describe('getDaysInMonth and leap year', () => {
    it('calculates days in standard months', () => {
      expect(getDaysInMonth(2026, 0)).toBe(31); // Jan
      expect(getDaysInMonth(2026, 1)).toBe(28); // Feb non-leap
      expect(getDaysInMonth(2026, 3)).toBe(30); // Apr
    });

    it('correctly identifies leap year February', () => {
      expect(getDaysInMonth(2024, 1)).toBe(29); // 2024 is leap year
      expect(getDaysInMonth(2028, 1)).toBe(29); // 2028 is leap year
    });
  });

  describe('getMonthMatrix', () => {
    it('generates a grid of 35 or 42 cells', () => {
      const matrix = getMonthMatrix(2026, 8); // Sep 2026 starts on Tuesday (day 2)
      expect([35, 42]).toContain(matrix.length);
      expect(matrix.length % 7).toBe(0);

      // Verify September days are marked as isCurrentMonth
      const currentDays = matrix.filter((d) => d.isCurrentMonth);
      expect(currentDays.length).toBe(30); // Sep has 30 days
      expect(currentDays[0].dayNumber).toBe(1);
      expect(currentDays[0].dateStr).toBe('2026-09-01');
      expect(currentDays[29].dayNumber).toBe(30);
      expect(currentDays[29].dateStr).toBe('2026-09-30');
    });

    it('correctly marks today', () => {
      const mockToday = new Date(2026, 8, 15);
      const matrix = getMonthMatrix(2026, 8, mockToday);
      const todayCell = matrix.find((d) => d.isToday);
      expect(todayCell).toBeDefined();
      expect(todayCell?.dateStr).toBe('2026-09-15');
    });
  });

  describe('getQuickDateShortcuts', () => {
    it('returns today, yesterday and future presets', () => {
      const presets = getQuickDateShortcuts(true);
      expect(presets.length).toBe(4);
      expect(presets[0].label).toBe('Today');
      expect(presets[1].label).toBe('Yesterday');
      expect(presets[2].label).toBe('+7 Days');
      expect(presets[3].label).toBe('+30 Days');
    });

    it('can exclude future presets', () => {
      const presets = getQuickDateShortcuts(false);
      expect(presets.length).toBe(2);
      expect(presets[0].label).toBe('Today');
      expect(presets[1].label).toBe('Yesterday');
    });
  });
});
