/**
 * Time utility functions
 */

/**
 * Parse ISO date string or Date object to Date
 */
export function parseDate(date: string | Date): Date {
  if (date instanceof Date) {
    return date;
  }
  return new Date(date);
}

/**
 * Calculate gap in seconds between two dates
 */
export function getGapSeconds(date1: Date, date2: Date): number {
  return Math.abs(date2.getTime() - date1.getTime()) / 1000;
}

/**
 * Calculate gap in days between two dates
 */
export function getGapDays(date1: Date, date2: Date): number {
  return getGapSeconds(date1, date2) / (24 * 60 * 60);
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h`;
  }
  return `${Math.round(seconds / 86400)}d`;
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is within last N days
 */
export function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  const diffDays = getGapDays(date, now);
  return diffDays <= days;
}

/**
 * Get start of day for a date
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day for a date
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

