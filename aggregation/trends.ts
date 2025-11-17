/**
 * Trend analysis for relationships over time
 */

import { VolleyAnalysis, SentimentTrend, ConnectionState } from '../types';
import { calculateTrend, classifyTrend } from '../utils/stats';

/**
 * Analyze sentiment trend over time
 */
export function analyzeSentimentTrend(
  analyses: VolleyAnalysis[]
): SentimentTrend {
  if (analyses.length < 3) {
    return 'stable';
  }

  const sentiments = analyses.map((a) => a.sentiment);
  const slope = calculateTrend(sentiments);

  return classifyTrend(slope);
}

/**
 * Analyze warmth trend over time
 */
export function analyzeWarmthTrend(analyses: VolleyAnalysis[]): SentimentTrend {
  if (analyses.length < 3) {
    return 'stable';
  }

  const warmths = analyses.map((a) => a.warmth);
  const slope = calculateTrend(warmths);

  return classifyTrend(slope);
}

/**
 * Determine connection state based on multiple factors
 */
export function determineConnectionState(
  avgWarmth: number,
  avgSentiment: number,
  recencyDays: number,
  frequencyPerWeek: number,
  sentimentTrend: SentimentTrend,
  warmthTrend: SentimentTrend
): ConnectionState {
  // Dormant: No recent contact
  if (recencyDays > 30 || frequencyPerWeek < 0.25) {
    return 'dormant';
  }

  // At risk: Declining trends or low engagement
  if (
    sentimentTrend === 'declining' ||
    warmthTrend === 'declining' ||
    (avgWarmth < 0.4 && frequencyPerWeek < 1)
  ) {
    return 'at_risk';
  }

  // Cooling: Moderate warmth/sentiment
  if (avgWarmth < 0.5 || avgSentiment < 0) {
    return 'cooling';
  }

  // Thriving: High warmth, improving trends, frequent contact
  if (
    avgWarmth > 0.7 &&
    avgSentiment > 0.5 &&
    (sentimentTrend === 'improving' || warmthTrend === 'improving') &&
    frequencyPerWeek > 2
  ) {
    return 'thriving';
  }

  // Default: Stable
  return 'stable';
}

/**
 * Analyze reciprocity trend
 */
export function analyzeReciprocityTrend(analyses: VolleyAnalysis[]): {
  balanced_ratio: number;
  trend: 'improving' | 'stable' | 'declining';
  current_streak: number;
} {
  if (analyses.length === 0) {
    return {
      balanced_ratio: 0,
      trend: 'stable',
      current_streak: 0,
    };
  }

  // Calculate balanced ratio
  const balancedCount = analyses.filter(
    (a) => a.reciprocity === 'balanced'
  ).length;
  const balancedRatio = (balancedCount / analyses.length) * 100;

  // Calculate trend by comparing first half to second half
  const midpoint = Math.floor(analyses.length / 2);
  const firstHalf = analyses.slice(0, midpoint);
  const secondHalf = analyses.slice(midpoint);

  const firstHalfBalanced =
    firstHalf.filter((a) => a.reciprocity === 'balanced').length /
    firstHalf.length;
  const secondHalfBalanced =
    secondHalf.filter((a) => a.reciprocity === 'balanced').length /
    secondHalf.length;

  let trend: 'improving' | 'stable' | 'declining';
  const diff = secondHalfBalanced - firstHalfBalanced;
  if (diff > 0.1) {
    trend = 'improving';
  } else if (diff < -0.1) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  // Calculate current streak of one-sided-me
  let currentStreak = 0;
  for (let i = analyses.length - 1; i >= 0; i--) {
    if (analyses[i].reciprocity === 'one_sided_me') {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    balanced_ratio: balancedRatio,
    trend,
    current_streak: currentStreak,
  };
}

/**
 * Analyze topic evolution over time
 */
export function analyzeTopicEvolution(
  analyses: VolleyAnalysis[],
  windowSize: number = 10
): {
  emerging_topics: string[];
  declining_topics: string[];
  stable_topics: string[];
} {
  if (analyses.length < windowSize * 2) {
    return {
      emerging_topics: [],
      declining_topics: [],
      stable_topics: [],
    };
  }

  // Split into early and recent windows
  const earlyWindow = analyses.slice(0, windowSize);
  const recentWindow = analyses.slice(-windowSize);

  // Count topic frequencies
  const earlyTopics = new Map<string, number>();
  const recentTopics = new Map<string, number>();

  for (const analysis of earlyWindow) {
    for (const topic of analysis.topics) {
      earlyTopics.set(topic, (earlyTopics.get(topic) || 0) + 1);
    }
  }

  for (const analysis of recentWindow) {
    for (const topic of analysis.topics) {
      recentTopics.set(topic, (recentTopics.get(topic) || 0) + 1);
    }
  }

  // Classify topics
  const emerging: string[] = [];
  const declining: string[] = [];
  const stable: string[] = [];

  const allTopics = new Set([
    ...Array.from(earlyTopics.keys()),
    ...Array.from(recentTopics.keys()),
  ]);

  for (const topic of allTopics) {
    const earlyCount = earlyTopics.get(topic) || 0;
    const recentCount = recentTopics.get(topic) || 0;

    if (earlyCount === 0 && recentCount > 0) {
      emerging.push(topic);
    } else if (earlyCount > 0 && recentCount === 0) {
      declining.push(topic);
    } else if (recentCount > earlyCount * 1.5) {
      emerging.push(topic);
    } else if (earlyCount > recentCount * 1.5) {
      declining.push(topic);
    } else {
      stable.push(topic);
    }
  }

  return {
    emerging_topics: emerging,
    declining_topics: declining,
    stable_topics: stable,
  };
}

