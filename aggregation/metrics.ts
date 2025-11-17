/**
 * Contact-level metrics aggregation
 */

import {
  VolleyAnalysis,
  ContactMetrics,
  ChurnMetrics,
} from '../types';
import { average, getTopItems, calculateTrend, classifyTrend } from '../utils/stats';

/**
 * Aggregate volley analyses into contact-level metrics
 */
export function getContactMetrics(
  contactId: number,
  analyses: VolleyAnalysis[]
): ContactMetrics {
  if (analyses.length === 0) {
    return createEmptyMetrics(contactId);
  }

  // Basic counts
  const volleyCount = analyses.length;
  const messageCount = analyses.reduce((sum) => {
    // Estimate from pivot_text or use a default
    return sum + 1;
  }, 0);

  // Averages
  const sentiments = analyses.map((a) => a.sentiment);
  const warmths = analyses.map((a) => a.warmth);
  const avgSentiment = average(sentiments);
  const avgWarmth = average(warmths);

  // Reciprocity analysis
  const reciprocityCounts = {
    balanced: 0,
    one_sided_me: 0,
    one_sided_them: 0,
  };

  let currentStreak = 0;
  let maxStreak = 0;
  let lastReciprocity = '';

  for (const analysis of analyses) {
    reciprocityCounts[analysis.reciprocity]++;

    if (analysis.reciprocity === 'one_sided_me') {
      if (lastReciprocity === 'one_sided_me') {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    lastReciprocity = analysis.reciprocity;
  }

  const balancedRatio =
    (reciprocityCounts.balanced / volleyCount) * 100;

  // Topics
  const allTopics = analyses.flatMap((a) => a.topics);
  const topTopics = getTopItems(allTopics, 10).map((t) => ({
    topic: String(t.item),
    count: t.count,
    percentage: t.percentage,
  }));

  // Emotions
  const allEmotions = analyses.flatMap((a) => a.emotion_labels);
  const emotionDist = getTopItems(allEmotions, 10).map((e) => ({
    emotion: String(e.item),
    count: e.count,
    percentage: e.percentage,
  }));

  // Events
  const positiveEvents = analyses.filter(
    (a) => a.event_type === 'positive'
  ).length;
  const negativeEvents = analyses.filter(
    (a) => a.event_type === 'negative'
  ).length;

  // Temporal analysis - would need actual dates from volleys
  const lastContactDate = new Date(); // Placeholder
  const lastMeaningfulDays = 0; // Placeholder
  const relationshipLengthDays = 365; // Placeholder

  // Churn metrics
  const churnMetrics = calculateChurnMetrics(analyses);

  // Trends
  const sentimentTrend = classifyTrend(calculateTrend(sentiments));
  const warmthTrend = classifyTrend(calculateTrend(warmths));

  // Connection state
  const connectionState = determineConnectionState(
    avgWarmth,
    avgSentiment,
    churnMetrics,
    sentimentTrend
  );

  // Scoring
  const priorityScore = calculatePriorityScore(
    avgWarmth,
    avgSentiment,
    churnMetrics,
    volleyCount
  );

  const importanceScore = calculateImportanceScore(
    volleyCount,
    avgWarmth,
    topTopics.length,
    relationshipLengthDays
  );

  // CTA
  const cta = determineCTA(connectionState, churnMetrics, balancedRatio);

  return {
    contact_id: contactId,
    volley_count: volleyCount,
    message_count: messageCount,
    avg_warmth: avgWarmth,
    avg_sentiment: avgSentiment,
    balanced_ratio: balancedRatio,
    one_sided_me_count: reciprocityCounts.one_sided_me,
    one_sided_them_count: reciprocityCounts.one_sided_them,
    one_sided_me_streak: maxStreak,
    last_contact_date: lastContactDate,
    last_meaningful_days: lastMeaningfulDays,
    relationship_length_days: relationshipLengthDays,
    top_topics: topTopics,
    emotion_distribution: emotionDist,
    positive_event_count: positiveEvents,
    negative_event_count: negativeEvents,
    churn_metrics: churnMetrics,
    sentiment_trend: sentimentTrend,
    warmth_trend: warmthTrend,
    connection_state: connectionState,
    priority_score: priorityScore,
    importance_score: importanceScore,
    cta: cta,
  };
}

/**
 * Calculate churn metrics using RFV framework
 */
function calculateChurnMetrics(
  analyses: VolleyAnalysis[]
): ChurnMetrics {
  // Placeholder implementation - would need actual volley dates
  const recencyDays = 5;
  const frequencyPerWeek = 3;
  const valueScore = average(analyses.map((a) => a.warmth));

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (recencyDays > 14 || frequencyPerWeek < 1 || valueScore < 0.4) {
    riskLevel = 'high';
  } else if (recencyDays > 7 || frequencyPerWeek < 2 || valueScore < 0.6) {
    riskLevel = 'medium';
  }

  return {
    recency_days: recencyDays,
    frequency_per_week: frequencyPerWeek,
    value_score: valueScore,
    risk_level: riskLevel,
  };
}

/**
 * Determine connection state based on metrics
 */
function determineConnectionState(
  warmth: number,
  sentiment: number,
  churn: ChurnMetrics,
  trend: 'improving' | 'stable' | 'declining'
): 'thriving' | 'stable' | 'cooling' | 'at_risk' | 'dormant' {
  if (churn.recency_days > 30) {
    return 'dormant';
  }

  if (churn.risk_level === 'high') {
    return 'at_risk';
  }
  
  if (trend === 'declining') {
    return 'at_risk';
  }

  if (
    warmth > 0.7 &&
    sentiment > 0.5 &&
    churn.risk_level === 'low' &&
    trend === 'improving'
  ) {
    return 'thriving';
  }

  if (warmth < 0.5 || sentiment < 0) {
    return 'cooling';
  }

  return 'stable';
}

/**
 * Calculate priority score (0-100)
 */
function calculatePriorityScore(
  warmth: number,
  sentiment: number,
  churn: ChurnMetrics,
  volleyCount: number
): number {
  const warmthScore = warmth * 30;
  const sentimentScore = ((sentiment + 1) / 2) * 20;
  const churnScore = churn.risk_level === 'high' ? 30 : churn.risk_level === 'medium' ? 20 : 10;
  const volumeScore = Math.min(volleyCount / 10, 1) * 20;

  return Math.round(warmthScore + sentimentScore + churnScore + volumeScore);
}

/**
 * Calculate importance score (0-1)
 * Formula: 0.20*volume + 0.25*warmth + 0.30*topics + 0.15*responsive + 0.10*length
 */
function calculateImportanceScore(
  volleyCount: number,
  warmth: number,
  topicCount: number,
  relationshipDays: number
): number {
  const volumeScore = Math.min(volleyCount / 50, 1);
  const warmthScore = warmth;
  const topicScore = Math.min(topicCount / 20, 1);
  const responsiveScore = 0.8; // Placeholder
  const lengthScore = Math.min(relationshipDays / 365, 1);

  return (
    0.2 * volumeScore +
    0.25 * warmthScore +
    0.3 * topicScore +
    0.15 * responsiveScore +
    0.1 * lengthScore
  );
}

/**
 * Determine recommended CTA
 */
function determineCTA(
  state: 'thriving' | 'stable' | 'cooling' | 'at_risk' | 'dormant',
  _churn: ChurnMetrics,
  balancedRatio: number
): 'maintain' | 'check_in' | 'deepen' | 'reconnect' | 'repair' {
  if (state === 'dormant') {
    return 'reconnect';
  }

  if (state === 'at_risk') {
    return balancedRatio < 40 ? 'repair' : 'check_in';
  }

  if (state === 'cooling') {
    return 'check_in';
  }

  if (state === 'thriving') {
    return 'deepen';
  }

  return 'maintain';
}

/**
 * Create empty metrics for contacts with no analyses
 */
function createEmptyMetrics(contactId: number): ContactMetrics {
  return {
    contact_id: contactId,
    volley_count: 0,
    message_count: 0,
    avg_warmth: 0,
    avg_sentiment: 0,
    balanced_ratio: 0,
    one_sided_me_count: 0,
    one_sided_them_count: 0,
    one_sided_me_streak: 0,
    last_contact_date: new Date(),
    last_meaningful_days: 999,
    relationship_length_days: 0,
    top_topics: [],
    emotion_distribution: [],
    positive_event_count: 0,
    negative_event_count: 0,
    churn_metrics: {
      recency_days: 999,
      frequency_per_week: 0,
      value_score: 0,
      risk_level: 'high',
    },
    sentiment_trend: 'stable',
    warmth_trend: 'stable',
    connection_state: 'dormant',
    priority_score: 0,
    importance_score: 0,
    cta: 'reconnect',
  };
}

