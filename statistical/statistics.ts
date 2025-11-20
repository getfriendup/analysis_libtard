/**
 * Statistical analysis on messages and volleys
 */

import { Message, Volley, StreakInfo, ResponseTimeStats, ReciprocityStats } from './types';
import { parseDate, startOfDay, getGapDays, getGapSeconds } from '../utils/time';

// ===================================================================
// STREAK CALCULATIONS
// ===================================================================

/**
 * Calculate engagement streaks
 */
export function getStreaks(messages: Message[]): StreakInfo {
  if (messages.length === 0) {
    return {
      current_streak_days: 0,
      longest_streak_days: 0,
      is_active: false,
      last_message_date: new Date(),
    };
  }

  const sorted = [...messages].sort(
    (a, b) => parseDate(a.sent_at).getTime() - parseDate(b.sent_at).getTime()
  );

  // Get unique days with messages
  const daySet = new Set<string>();
  for (const msg of sorted) {
    const day = startOfDay(parseDate(msg.sent_at)).toISOString();
    daySet.add(day);
  }

  const days = Array.from(daySet)
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  let currentStreak = 1;
  let longestStreak = 1;
  let streakBrokenDate: Date | undefined;

  // Count consecutive days
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round(getGapDays(days[i - 1], days[i]));

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      streakBrokenDate = days[i - 1];
      currentStreak = 1;
    }
  }

  // Check if streak is still active (messaged today or yesterday)
  const lastDay = days[days.length - 1];
  const daysSinceLastMessage = getGapDays(lastDay, new Date());
  const isActive = daysSinceLastMessage <= 1;

  if (daysSinceLastMessage > 1) {
    currentStreak = 0;
  }

  return {
    current_streak_days: currentStreak,
    longest_streak_days: longestStreak,
    streak_broken_date: streakBrokenDate,
    is_active: isActive,
    last_message_date: parseDate(sorted[sorted.length - 1].sent_at),
  };
}

// ===================================================================
// RESPONSE TIME ANALYSIS
// ===================================================================

/**
 * Calculate response time statistics
 */
export function getResponseTimes(messages: Message[], userId: number): ResponseTimeStats {
  if (messages.length < 2) {
    return {
      avg_hours: 0,
      median_hours: 0,
      fastest_hours: 0,
      slowest_hours: 0,
    };
  }

  const sorted = [...messages].sort(
    (a, b) => parseDate(a.sent_at).getTime() - parseDate(b.sent_at).getTime()
  );

  const responseTimes: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Response time: when they reply to me
    if (prev.from_id === userId && curr.from_id !== userId) {
      const seconds = getGapSeconds(parseDate(prev.sent_at), parseDate(curr.sent_at));
      const hours = seconds / 3600;
      responseTimes.push(hours);
    }
  }

  if (responseTimes.length === 0) {
    return {
      avg_hours: 0,
      median_hours: 0,
      fastest_hours: 0,
      slowest_hours: 0,
    };
  }

  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const avg = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
  const median = sortedTimes[Math.floor(sortedTimes.length / 2)];

  return {
    avg_hours: avg,
    median_hours: median,
    fastest_hours: sortedTimes[0],
    slowest_hours: sortedTimes[sortedTimes.length - 1],
  };
}

// ===================================================================
// RECIPROCITY ANALYSIS
// ===================================================================

/**
 * Calculate reciprocity statistics for a volley
 */
export function getVolleyReciprocity(volley: Volley, userId: number): ReciprocityStats {
  const myMessages = volley.turns.filter(t => t.sender_id === userId);
  const theirMessages = volley.turns.filter(t => t.sender_id !== userId);

  const myCount = myMessages.reduce((sum, t) => sum + t.messages.length, 0);
  const theirCount = theirMessages.reduce((sum, t) => sum + t.messages.length, 0);
  const total = myCount + theirCount;

  // Who initiated (first turn)
  const initiatedByMe = volley.turns[0].sender_id === userId;

  // Message balance: 0 = all them, 0.5 = balanced, 1 = all me
  const messageBalance = total > 0 ? myCount / total : 0.5;

  // Initiation balance (for volleys collection): 0 = they always initiate, 1 = I always initiate
  const initiationBalance = initiatedByMe ? 1 : 0;

  // Average turn lengths
  const avgTurnLengthMe = myMessages.length > 0
    ? myCount / myMessages.length
    : 0;

  const avgTurnLengthThem = theirMessages.length > 0
    ? theirCount / theirMessages.length
    : 0;

  return {
    initiation_balance: initiationBalance,
    message_balance: messageBalance,
    avg_turn_length_me: avgTurnLengthMe,
    avg_turn_length_them: avgTurnLengthThem,
  };
}

/**
 * Calculate overall reciprocity across multiple volleys
 */
export function getOverallReciprocity(volleys: Volley[], userId: number): ReciprocityStats {
  if (volleys.length === 0) {
    return {
      initiation_balance: 0.5,
      message_balance: 0.5,
      avg_turn_length_me: 0,
      avg_turn_length_them: 0,
    };
  }

  let totalInitiatedByMe = 0;
  let totalMyMessages = 0;
  let totalTheirMessages = 0;
  let totalMyTurns = 0;
  let totalTheirTurns = 0;

  for (const volley of volleys) {

    // Count initiations
    if (volley.turns[0].sender_id === userId) {
      totalInitiatedByMe++;
    }

    // Count messages
    const myMessages = volley.turns
      .filter(t => t.sender_id === userId)
      .reduce((sum, t) => sum + t.messages.length, 0);
    const theirMessages = volley.turns
      .filter(t => t.sender_id !== userId)
      .reduce((sum, t) => sum + t.messages.length, 0);

    totalMyMessages += myMessages;
    totalTheirMessages += theirMessages;

    // Count turns
    const myTurns = volley.turns.filter(t => t.sender_id === userId).length;
    const theirTurns = volley.turns.filter(t => t.sender_id !== userId).length;

    totalMyTurns += myTurns;
    totalTheirTurns += theirTurns;
  }

  const initiationBalance = totalInitiatedByMe / volleys.length;
  const totalMessages = totalMyMessages + totalTheirMessages;
  const messageBalance = totalMessages > 0 ? totalMyMessages / totalMessages : 0.5;

  const avgTurnLengthMe = totalMyTurns > 0 ? totalMyMessages / totalMyTurns : 0;
  const avgTurnLengthThem = totalTheirTurns > 0 ? totalTheirMessages / totalTheirTurns : 0;

  return {
    initiation_balance: initiationBalance,
    message_balance: messageBalance,
    avg_turn_length_me: avgTurnLengthMe,
    avg_turn_length_them: avgTurnLengthThem,
  };
}

// ===================================================================
// VOLLEY STATS
// ===================================================================

/**
 * Get basic statistics for a volley
 */
export function getVolleyStats(volley: Volley, userId: number) {
  const reciprocity = getVolleyReciprocity(volley, userId);
  const durationSeconds = getGapSeconds(volley.start_time, volley.end_time);

  return {
    message_count: volley.message_count,
    depth: volley.depth,
    duration_seconds: durationSeconds,
    duration_minutes: durationSeconds / 60,
    participants: volley.participants,
    reciprocity,
    initiated_by_me: volley.turns[0].sender_id === userId,
  };
}
