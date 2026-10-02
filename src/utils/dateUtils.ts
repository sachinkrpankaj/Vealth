/**
 * Date manipulation and formatting utilities for Vaelth.
 * Pure local date math to avoid any UTC timezone discrepancies.
 */

export interface CalendarDay {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  month: number;   // 0-11
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export function formatDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's local date as YYYY-MM-DD string.
 * Completely immune to UTC midnight boundary issues (e.g. IST midnight to 5:30 AM).
 */
export function getTodayLocalDateString(date: Date = new Date()): string {
  return formatDateIso(date);
}

/**
 * Get current local month as YYYY-MM string.
 */
export function getCurrentLocalMonthString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get current local calendar year.
 */
export function getCurrentLocalYear(date: Date = new Date()): number {
  return date.getFullYear();
}

/**
 * Checks whether a YYYY-MM-DD dateStr violates minDate, maxDate, or allowFutureDates.
 */
export function isDateDisabled(
  dateStr: string,
  minDate?: string,
  maxDate?: string,
  allowFutureDates: boolean = true,
  todayStr: string = getTodayLocalDateString()
): boolean {
  let effectiveMax = maxDate;
  if (allowFutureDates === false) {
    if (maxDate) {
      effectiveMax = maxDate < todayStr ? maxDate : todayStr;
    } else {
      effectiveMax = todayStr;
    }
  }
  if (minDate && dateStr < minDate) return true;
  if (effectiveMax && dateStr > effectiveMax) return true;
  return false;
}

/**
 * Safely parse a YYYY-MM-DD string into a local Date object.
 * Returns null if the string is empty or improperly formatted.
 */
export function parseDateIso(str?: string | null): Date | null {
  if (!str || typeof str !== 'string') return null;
  const match = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  const date = new Date(year, month, day);
  // Verify date didn't roll over (e.g. Feb 31 -> Mar 3)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

export const parseLocalDate = parseDateIso;

/**
 * Get human readable display string for a YYYY-MM-DD date.
 * Example: "20 Sep 2026" or "Today" or "Yesterday"
 */
export function formatDisplayDate(
  isoStr?: string | null,
  options: { includeRelative?: boolean; shortYear?: boolean } = { includeRelative: true }
): string {
  if (!isoStr) return '';
  const date = parseDateIso(isoStr);
  if (!date) return isoStr;

  const todayIso = formatDateIso(new Date());

  if (options.includeRelative) {
    if (isoStr === todayIso) {
      return `Today, ${date.getDate()} ${MONTH_SHORT_NAMES[date.getMonth()]}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (isoStr === formatDateIso(yesterday)) {
      return `Yesterday, ${date.getDate()} ${MONTH_SHORT_NAMES[date.getMonth()]}`;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (isoStr === formatDateIso(tomorrow)) {
      return `Tomorrow, ${date.getDate()} ${MONTH_SHORT_NAMES[date.getMonth()]}`;
    }
  }

  const day = date.getDate();
  const month = MONTH_SHORT_NAMES[date.getMonth()];
  const year = options.shortYear ? String(date.getFullYear()).slice(-2) : date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Return month name by index (0-11)
 */
export function getMonthName(monthIndex: number, short = false): string {
  const safeIndex = Math.max(0, Math.min(11, monthIndex));
  return short ? MONTH_SHORT_NAMES[safeIndex] : MONTH_NAMES[safeIndex];
}

/**
 * Return total days in a given month of a year
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Generates the full 35 or 42 grid of days for a month view,
 * including leading days from the previous month and trailing days from the next month.
 */
export function getMonthMatrix(year: number, month: number, referenceToday?: Date): CalendarDay[] {
  const todayStr = formatDateIso(referenceToday || new Date());
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInCurrentMonth = getDaysInMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  const days: CalendarDay[] = [];

  // Previous month overflow days
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    days.push({
      dateStr,
      dayNumber,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({
      dateStr,
      dayNumber: day,
      month,
      year,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month overflow days (fill grid to multiple of 7, at least 35, or 42 if needed)
  const totalCells = days.length > 35 ? 42 : 35;
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const trailingDaysNeeded = totalCells - days.length;

  for (let day = 1; day <= trailingDaysNeeded; day++) {
    const dateStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({
      dateStr,
      dayNumber: day,
      month: nextMonth,
      year: nextMonthYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

/**
 * Generate quick shortcuts for date picking
 */
export function getQuickDateShortcuts(includeFuture = true): Array<{ label: string; dateStr: string }> {
  const now = new Date();
  const todayStr = formatDateIso(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = formatDateIso(yesterday);

  const presets = [
    { label: 'Today', dateStr: todayStr },
    { label: 'Yesterday', dateStr: yesterdayStr },
  ];

  if (includeFuture) {
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);
    presets.push({ label: '+7 Days', dateStr: formatDateIso(in7Days) });

    const in30Days = new Date(now);
    in30Days.setDate(now.getDate() + 30);
    presets.push({ label: '+30 Days', dateStr: formatDateIso(in30Days) });
  }

  return presets;
}
