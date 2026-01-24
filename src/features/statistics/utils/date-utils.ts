/**
 * Date utilities for contribution calendar
 * No external dependencies - pure JS date manipulation
 */

/**
 * Format a date as YYYY-MM-DD string (used as map key)
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the start of the week for a given date
 * @param date - The date to get the week start for
 * @param weekStart - 0 for Sunday, 1 for Monday
 */
export function startOfWeek(date: Date, weekStart: 0 | 1 = 0): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Build a grid of weeks for the calendar
 * @param end - End date (typically today)
 * @param months - Number of months to go back
 * @param weekStart - 0 for Sunday, 1 for Monday
 * @returns Array of weeks, each week is an array of 7 Dates
 */
export function buildWeeksGrid(
  end: Date,
  months: number,
  weekStart: 0 | 1 = 0,
): Date[][] {
  // Calculate start date (N months ago, aligned to week start)
  const start = startOfWeek(addMonths(end, -months), weekStart);

  // Calculate end date (aligned to end of current week)
  const endOfCurrentWeek = startOfWeek(end, weekStart);
  const finalEnd = addDays(endOfCurrentWeek, 6);

  const weeks: Date[][] = [];
  let currentDate = new Date(start);

  while (currentDate <= finalEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }

  return weeks;
}

/**
 * Calculate contribution level (0-4) based on count relative to max
 * Uses GitHub-style quartile distribution
 */
export function getContributionLevel(
  count: number,
  max: number,
): 0 | 1 | 2 | 3 | 4 {
  if (count === 0 || max === 0) return 0;

  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Format a date for display in tooltip
 */
export function formatDateForTooltip(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get month label for a date (abbreviated)
 */
export function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short" });
}

/**
 * Calculate current streak (consecutive days ending today with contributions)
 */
export function calculateStreak(
  contributionsByDay: Map<string, number>,
  endDate: Date,
): number {
  let streak = 0;
  let currentDate = new Date(endDate);
  currentDate.setHours(0, 0, 0, 0);

  while (true) {
    const key = formatDateKey(currentDate);
    const count = contributionsByDay.get(key) ?? 0;

    if (count === 0) {
      break;
    }

    streak++;
    currentDate = addDays(currentDate, -1);
  }

  return streak;
}

/**
 * Get the start of today (midnight local time)
 */
export function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get the end of today (23:59:59.999 local time)
 */
export function getEndOfToday(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

/**
 * Get the range start date for a given time range (in months).
 * This matches the logic in useContributionData to ensure consistency.
 * @param months - Number of months to go back (0.25 = 1 week)
 * @returns The start date for the range
 */
export function getRangeStartDate(months: number): Date {
  const today = getStartOfToday();
  if (months < 1) {
    // Handle week case (0.25 = 1 week = 7 days)
    return addDays(today, -6); // -6 because we include today
  }
  return addMonths(today, -months);
}

/**
 * Build an array of days for a "week strip" view (last 7 days).
 * @returns Array of 7 Date objects from 6 days ago to today
 */
export function buildWeekStripDays(): Date[] {
  const today = getStartOfToday();
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(addDays(today, -i));
  }
  return days;
}

/**
 * Build an array of days for a "month view" (last ~30-31 days in a calendar grid).
 * Returns weeks aligned to week boundaries for proper calendar display.
 * @param weekStart - 0 for Sunday, 1 for Monday
 * @returns Array of weeks, each week is an array of 7 Dates
 */
export function buildMonthWeeksGrid(weekStart: 0 | 1 = 0): Date[][] {
  const today = getStartOfToday();
  // Go back ~35 days to ensure we have a full month of data
  const start = startOfWeek(addDays(today, -34), weekStart);
  const endOfCurrentWeek = startOfWeek(today, weekStart);
  const finalEnd = addDays(endOfCurrentWeek, 6);

  const weeks: Date[][] = [];
  let currentDate = new Date(start);

  while (currentDate <= finalEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }

  return weeks;
}

/**
 * Format a date with day of week for the week strip view
 */
export function formatDayLabel(date: Date): { dayOfWeek: string; dayNum: string } {
  return {
    dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short" }),
    dayNum: String(date.getDate()),
  };
}

