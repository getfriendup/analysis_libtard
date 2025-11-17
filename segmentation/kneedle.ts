/**
 * Kneedle algorithm for adaptive timeout detection
 * Used to find the "elbow" point in gap distributions to determine optimal timeouts
 * 
 * Based on "Finding a 'Kneedle' in a Haystack: Detecting Knee Points in System Behavior"
 * by Satopaa et al.
 */

/**
 * Calculate the knee point (elbow) in a sorted array of values
 * 
 * @param values - Sorted array of numeric values (e.g., time gaps)
 * @returns Index of the knee point
 */
export function findKneePoint(
  values: number[]
): number {
  if (values.length < 3) {
    return Math.floor(values.length / 2);
  }

  // Normalize x and y to [0, 1]
  const n = values.length;
  const xNorm = Array.from({ length: n }, (_, i) => i / (n - 1));
  const yMin = values[0];
  const yMax = values[n - 1];
  const yRange = yMax - yMin;

  if (yRange === 0) {
    return Math.floor(n / 2);
  }

  const yNorm = values.map((y) => (y - yMin) / yRange);

  // Calculate differences
  const differences: number[] = [];
  for (let i = 0; i < n; i++) {
    differences.push(xNorm[i] - yNorm[i]);
  }

  // Find maximum difference (knee point)
  let maxDiff = -Infinity;
  let kneeIndex = 0;

  for (let i = 1; i < n - 1; i++) {
    const diff = Math.abs(differences[i]);
    if (diff > maxDiff) {
      maxDiff = diff;
      kneeIndex = i;
    }
  }

  return kneeIndex;
}

/**
 * Calculate adaptive timeout at a given percentile
 * 
 * @param gaps - Array of time gaps in seconds
 * @param percentile - Percentile to use (0-100)
 * @returns Timeout value in seconds
 */
export function getPercentileTimeout(
  gaps: number[],
  percentile: number
): number {
  if (gaps.length === 0) {
    return 300; // Default 5 minutes
  }

  const sorted = [...gaps].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Calculate adaptive timeout using Kneedle algorithm
 * 
 * @param gaps - Array of time gaps in seconds
 * @param fallbackPercentile - Fallback percentile if Kneedle fails (default: 85)
 * @returns Timeout value in seconds
 */
export function getAdaptiveTimeout(
  gaps: number[],
  fallbackPercentile: number = 85
): number {
  if (gaps.length < 5) {
    return getPercentileTimeout(gaps, fallbackPercentile);
  }

  const sorted = [...gaps].sort((a, b) => a - b);

  try {
    const kneeIndex = findKneePoint(sorted);
    const kneeValue = sorted[kneeIndex];

    // Verify knee is reasonable (not at extremes)
    if (kneeIndex > 0 && kneeIndex < sorted.length - 1) {
      return kneeValue;
    }
  } catch (error) {
    // Fall back to percentile if Kneedle fails
  }

  return getPercentileTimeout(sorted, fallbackPercentile);
}

/**
 * Calculate multiple timeout thresholds for 3-phase segmentation
 * 
 * @param gaps - Array of time gaps in seconds
 * @returns Object with turn, threadlet, and session timeouts
 */
export function calculateTimeouts(gaps: number[]): {
  turn_timeout: number;
  threadlet_timeout: number;
  session_timeout: number;
} {
  if (gaps.length === 0) {
    return {
      turn_timeout: 180, // 3 minutes
      threadlet_timeout: 1800, // 30 minutes
      session_timeout: 14400, // 4 hours
    };
  }

  const sorted = [...gaps].sort((a, b) => a - b);

  return {
    turn_timeout: getPercentileTimeout(sorted, 70),
    threadlet_timeout: getAdaptiveTimeout(sorted, 85),
    session_timeout: getPercentileTimeout(sorted, 95),
  };
}

/**
 * Analyze gap distribution and return statistics
 * 
 * @param gaps - Array of time gaps in seconds
 * @returns Statistics object
 */
export function analyzeGaps(gaps: number[]): {
  min: number;
  max: number;
  median: number;
  mean: number;
  p70: number;
  p85: number;
  p95: number;
  knee_point?: number;
} {
  if (gaps.length === 0) {
    return {
      min: 0,
      max: 0,
      median: 0,
      mean: 0,
      p70: 0,
      p85: 0,
      p95: 0,
    };
  }

  const sorted = [...gaps].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  const stats = {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    mean: sum / sorted.length,
    p70: getPercentileTimeout(sorted, 70),
    p85: getPercentileTimeout(sorted, 85),
    p95: getPercentileTimeout(sorted, 95),
  };

  if (sorted.length >= 5) {
    const kneeIndex = findKneePoint(sorted);
    return {
      ...stats,
      knee_point: sorted[kneeIndex],
    };
  }

  return stats;
}

