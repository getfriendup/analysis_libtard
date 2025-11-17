/**
 * Importance and priority scoring algorithms
 */

import { ContactMetrics, VolleyAnalysis } from '../types';

/**
 * Calculate importance score using weighted formula
 * Formula: 0.20*volume + 0.25*warmth + 0.30*topics + 0.15*responsive + 0.10*length
 * 
 * @returns Score between 0 and 1
 */
export function calculateImportanceScore(params: {
  volleyCount: number;
  avgWarmth: number;
  topicCount: number;
  responsiveness: number;
  relationshipDays: number;
}): number {
  const {
    volleyCount,
    avgWarmth,
    topicCount,
    responsiveness,
    relationshipDays,
  } = params;

  // Normalize volume (cap at 100 volleys = 1.0)
  const volumeScore = Math.min(volleyCount / 100, 1.0);

  // Warmth is already 0-1
  const warmthScore = avgWarmth;

  // Normalize topic diversity (cap at 30 topics = 1.0)
  const topicScore = Math.min(topicCount / 30, 1.0);

  // Responsiveness is already 0-1
  const responsiveScore = responsiveness;

  // Normalize relationship length (cap at 2 years = 1.0)
  const lengthScore = Math.min(relationshipDays / 730, 1.0);

  // Weighted formula
  const importance =
    0.2 * volumeScore +
    0.25 * warmthScore +
    0.3 * topicScore +
    0.15 * responsiveScore +
    0.1 * lengthScore;

  return Math.max(0, Math.min(1, importance));
}

/**
 * Calculate priority score (0-100) for who needs attention now
 */
export function calculatePriorityScore(params: {
  avgWarmth: number;
  avgSentiment: number;
  recencyDays: number;
  frequencyPerWeek: number;
  balancedRatio: number;
  unreadCount?: number;
}): number {
  const {
    avgWarmth,
    avgSentiment,
    recencyDays,
    frequencyPerWeek,
    balancedRatio,
    unreadCount = 0,
  } = params;

  let score = 0;

  // Warmth component (30 points)
  score += avgWarmth * 30;

  // Sentiment component (20 points)
  score += ((avgSentiment + 1) / 2) * 20;

  // Recency urgency (25 points)
  // Higher score for moderate recency (needs check-in)
  if (recencyDays < 3) {
    score += 5; // Just talked, low urgency
  } else if (recencyDays < 7) {
    score += 15;
  } else if (recencyDays < 14) {
    score += 25;
  } else if (recencyDays < 30) {
    score += 20;
  } else {
    score += 10; // Very dormant, different category
  }

  // Frequency component (15 points)
  if (frequencyPerWeek > 3) {
    score += 15;
  } else if (frequencyPerWeek > 1) {
    score += 10;
  } else if (frequencyPerWeek > 0.5) {
    score += 5;
  }

  // Balance component (10 points)
  // Lower balance = higher urgency (they're carrying conversation)
  if (balancedRatio < 30) {
    score += 10;
  } else if (balancedRatio < 50) {
    score += 7;
  } else {
    score += 5;
  }

  // Unread messages bonus
  score += Math.min(unreadCount * 3, 10);

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate responsiveness score (0-1)
 * Based on how quickly and consistently someone responds
 */
export function calculateResponsiveness(analyses: VolleyAnalysis[]): number {
  if (analyses.length === 0) return 0.5;

  // Count engaged responses
  const engagedCount = analyses.filter(
    (a) =>
      a.response_quality === 'engaged' ||
      a.response_quality === 'enthusiastic'
  ).length;

  const minimalCount = analyses.filter(
    (a) =>
      a.response_quality === 'minimal' ||
      a.response_quality === 'dismissive'
  ).length;

  // Calculate score
  const engagedRatio = engagedCount / analyses.length;
  const minimalPenalty = (minimalCount / analyses.length) * 0.3;

  return Math.max(0, Math.min(1, engagedRatio - minimalPenalty));
}

/**
 * Rank contacts by importance
 */
export function rankByImportance(
  contacts: ContactMetrics[]
): ContactMetrics[] {
  return [...contacts].sort(
    (a, b) => b.importance_score - a.importance_score
  );
}

/**
 * Rank contacts by priority (who needs attention)
 */
export function rankByPriority(contacts: ContactMetrics[]): ContactMetrics[] {
  return [...contacts].sort((a, b) => b.priority_score - a.priority_score);
}

/**
 * Identify VIP contacts (top 20% by importance)
 */
export function identifyVIPs(contacts: ContactMetrics[]): ContactMetrics[] {
  const sorted = rankByImportance(contacts);
  const vipCount = Math.max(1, Math.ceil(contacts.length * 0.2));
  return sorted.slice(0, vipCount);
}

/**
 * Identify at-risk contacts that need attention
 */
export function identifyAtRisk(contacts: ContactMetrics[]): ContactMetrics[] {
  return contacts.filter(
    (c) =>
      c.connection_state === 'at_risk' ||
      c.connection_state === 'cooling' ||
      (c.churn_metrics.risk_level === 'high' && c.importance_score > 0.5)
  );
}

/**
 * Generate daily action items
 */
export function generateDailyActions(
  contacts: ContactMetrics[],
  maxActions: number = 5
): Array<{
  contact: ContactMetrics;
  action: string;
  urgency: 'high' | 'medium' | 'low';
}> {
  const actions: Array<{
    contact: ContactMetrics;
    action: string;
    urgency: 'high' | 'medium' | 'low';
  }> = [];

  // Sort by priority
  const sorted = rankByPriority(contacts);

  for (const contact of sorted) {
    if (actions.length >= maxActions) break;

    let action = '';
    let urgency: 'high' | 'medium' | 'low' = 'medium';

    switch (contact.cta) {
      case 'reconnect':
        action = `Reconnect with contact ${contact.contact_id} - it's been ${contact.churn_metrics.recency_days} days`;
        urgency = 'high';
        break;
      case 'repair':
        action = `Repair relationship with contact ${contact.contact_id} - reciprocity imbalance`;
        urgency = 'high';
        break;
      case 'check_in':
        action = `Check in with contact ${contact.contact_id}`;
        urgency = 'medium';
        break;
      case 'deepen':
        action = `Deepen connection with contact ${contact.contact_id}`;
        urgency = 'low';
        break;
      case 'maintain':
        action = `Maintain relationship with contact ${contact.contact_id}`;
        urgency = 'low';
        break;
    }

    if (action) {
      actions.push({ contact, action, urgency });
    }
  }

  return actions;
}

