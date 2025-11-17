/**
 * Engagement streak tracking
 */

import { Message, StreakInfo } from '../types';
import { parseDate, startOfDay, getGapDays } from '../utils/time';

/**
 * Get streak information for messages
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

  // Sort messages by date
  const sorted = [...messages].sort(
    (a, b) =>
      parseDate(a.sent_at).getTime() - parseDate(b.sent_at).getTime()
  );

  // Get unique days
  const daySet = new Set<string>();
  for (const msg of sorted) {
    const day = startOfDay(parseDate(msg.sent_at)).toISOString();
    daySet.add(day);
  }

  const days = Array.from(daySet)
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  // Calculate streaks
  let currentStreak = 1;
  let longestStreak = 1;
  let streakBrokenDate: Date | undefined;

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

  // Check if streak is still active
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

