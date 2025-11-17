/**
 * Social health scoring
 */

import { ContactMetrics, SocialHealthScore } from '../types';
import { average } from '../utils/stats';

/**
 * Calculate overall social health score (0-100)
 */
export function getSocialHealthScore(
  contacts: ContactMetrics[]
): SocialHealthScore {
  if (contacts.length === 0) {
    return {
      total_score: 0,
      breakdown: {
        engagement: 0,
        depth: 0,
        reciprocity: 0,
        consistency: 0,
      },
      trend: 'stable',
    };
  }

  // Calculate component scores
  const engagement = calculateEngagementScore(contacts);
  const depth = calculateDepthScore(contacts);
  const reciprocity = calculateReciprocityScore(contacts);
  const consistency = calculateConsistencyScore(contacts);

  // Weighted total
  const total =
    engagement * 0.3 +
    depth * 0.3 +
    reciprocity * 0.2 +
    consistency * 0.2;

  // Determine trend
  const trend = determineTrend(contacts);

  return {
    total_score: Math.round(total),
    breakdown: {
      engagement: Math.round(engagement),
      depth: Math.round(depth),
      reciprocity: Math.round(reciprocity),
      consistency: Math.round(consistency),
    },
    trend,
  };
}

function calculateEngagementScore(contacts: ContactMetrics[]): number {
  // How many contacts have recent activity
  const activeCount = contacts.filter(
    (c) => c.churn_metrics.recency_days < 7
  ).length;
  const activeRatio = activeCount / contacts.length;

  // Average message volume
  const avgVolleys = average(contacts.map((c) => c.volley_count));
  const volumeScore = Math.min(avgVolleys / 50, 1);

  return (activeRatio * 50 + volumeScore * 50) * 100;
}

function calculateDepthScore(contacts: ContactMetrics[]): number {
  // Quality of conversations
  const avgWarmth = average(contacts.map((c) => c.avg_warmth));
  const avgSentiment = average(contacts.map((c) => c.avg_sentiment));

  const warmthScore = avgWarmth * 60;
  const sentimentScore = ((avgSentiment + 1) / 2) * 40;

  return warmthScore + sentimentScore;
}

function calculateReciprocityScore(contacts: ContactMetrics[]): number {
  const avgBalance = average(contacts.map((c) => c.balanced_ratio));
  return avgBalance;
}

function calculateConsistencyScore(contacts: ContactMetrics[]): number {
  // How consistent is the contact frequency
  const avgFrequency = average(
    contacts.map((c) => c.churn_metrics.frequency_per_week)
  );

  // Normalize to 0-100 (2+ times per week = 100)
  return Math.min((avgFrequency / 2) * 100, 100);
}

function determineTrend(
  contacts: ContactMetrics[]
): 'improving' | 'stable' | 'declining' {
  const improvingCount = contacts.filter(
    (c) =>
      c.sentiment_trend === 'improving' || c.warmth_trend === 'improving'
  ).length;

  const decliningCount = contacts.filter(
    (c) =>
      c.sentiment_trend === 'declining' || c.warmth_trend === 'declining'
  ).length;

  if (improvingCount > decliningCount * 1.5) {
    return 'improving';
  } else if (decliningCount > improvingCount * 1.5) {
    return 'declining';
  }

  return 'stable';
}

