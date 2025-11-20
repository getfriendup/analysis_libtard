/**
 * Relationship health scoring
 */

import { HealthScore, VolleyAnalysis } from '../statistical/types';

/**
 * Calculate health score from analyses
 */
export function calculateHealthScore(
  contactId: number,
  analyses: VolleyAnalysis[],
  daysSinceLastMessage: number
): HealthScore {
  if (analyses.length === 0) {
    return {
      contact_id: contactId,
      overall_score: 0,
      connection_state: 'dormant',
      warmth_score: 0,
      engagement_score: 0,
      recency_score: 0,
      trend: 'stable',
    };
  }

  const avgWarmth = analyses.reduce((sum, a) => sum + a.warmth, 0) / analyses.length;

  // Warmth score (0-100)
  const warmthScore = avgWarmth * 100;

  // Engagement score (based on message frequency and depth)
  const avgDepth = analyses.reduce((sum, a) => sum + (a.plans_made ? 10 : 5), 0) / analyses.length;
  const engagementScore = Math.min(100, avgDepth * 10);

  // Recency score (inverse of days since last message)
  let recencyScore = 100;
  if (daysSinceLastMessage > 1) recencyScore = Math.max(0, 100 - (daysSinceLastMessage * 5));

  // Overall score
  const overallScore = (warmthScore * 0.4 + engagementScore * 0.3 + recencyScore * 0.3);

  // Connection state
  let connectionState: 'thriving' | 'stable' | 'cooling' | 'at_risk' | 'dormant' = 'stable';
  if (overallScore >= 80) connectionState = 'thriving';
  else if (overallScore >= 60) connectionState = 'stable';
  else if (overallScore >= 40) connectionState = 'cooling';
  else if (overallScore >= 20) connectionState = 'at_risk';
  else connectionState = 'dormant';

  // Trend (simplified - compare recent vs older analyses)
  const mid = Math.floor(analyses.length / 2);
  const recentAvg = analyses.slice(mid).reduce((sum, a) => sum + a.warmth, 0) / (analyses.length - mid);
  const olderAvg = analyses.slice(0, mid).reduce((sum, a) => sum + a.warmth, 0) / mid;
  const trend = recentAvg > olderAvg + 0.1 ? 'improving' : recentAvg < olderAvg - 0.1 ? 'declining' : 'stable';

  return {
    contact_id: contactId,
    overall_score: overallScore,
    connection_state: connectionState,
    warmth_score: warmthScore,
    engagement_score: engagementScore,
    recency_score: recencyScore,
    trend,
  };
}
