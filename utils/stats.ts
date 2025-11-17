/**
 * Statistical utility functions
 */

/**
 * Calculate average of numbers
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate median of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Count occurrences of items
 */
export function countOccurrences<T>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return counts;
}

/**
 * Get top N items by frequency
 */
export function getTopItems<T>(
  items: T[],
  n: number
): Array<{ item: T; count: number; percentage: number }> {
  const counts = countOccurrences(items);
  const total = items.length;

  const sorted = Array.from(counts.entries())
    .map(([item, count]) => ({
      item,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, n);
}

/**
 * Calculate linear trend (slope) of values over time
 */
export function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = average(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Classify trend as improving/stable/declining
 */
export function classifyTrend(
  slope: number
): 'improving' | 'stable' | 'declining' {
  if (slope > 0.05) return 'improving';
  if (slope < -0.05) return 'declining';
  return 'stable';
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const variance = average(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Find longest consecutive streak
 */
export function findLongestStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const uniqueDays = new Set(
    sorted.map((d) => d.toISOString().split('T')[0])
  );

  let currentStreak = 1;
  let longestStreak = 1;
  const daysArray = Array.from(uniqueDays).sort();

  for (let i = 1; i < daysArray.length; i++) {
    const prevDate = new Date(daysArray[i - 1]);
    const currDate = new Date(daysArray[i]);
    const diffDays =
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
}

