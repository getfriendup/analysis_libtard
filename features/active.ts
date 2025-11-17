/**
 * Activity detection and filtering
 */

import { Message } from '../types';
import { parseDate, isToday, isWithinDays } from '../utils/time';

/**
 * Get contacts who were active today
 */
export function getActiveToday(messages: Message[]): number[] {
  const contactIds = new Set<number>();

  for (const msg of messages) {
    if (isToday(parseDate(msg.sent_at))) {
      contactIds.add(msg.chat_id);
    }
  }

  return Array.from(contactIds);
}

/**
 * Get contacts active within N days
 */
export function getActivePeriod(messages: Message[], days: number): number[] {
  const contactIds = new Set<number>();

  for (const msg of messages) {
    if (isWithinDays(parseDate(msg.sent_at), days)) {
      contactIds.add(msg.chat_id);
    }
  }

  return Array.from(contactIds);
}

/**
 * Get contacts active this week
 */
export function getActiveThisWeek(messages: Message[]): number[] {
  return getActivePeriod(messages, 7);
}

/**
 * Get contacts active this month
 */
export function getActiveThisMonth(messages: Message[]): number[] {
  return getActivePeriod(messages, 30);
}

/**
 * Group messages by day
 */
export function groupMessagesByDay(
  messages: Message[]
): Map<string, Message[]> {
  const grouped = new Map<string, Message[]>();

  for (const msg of messages) {
    const date = parseDate(msg.sent_at).toISOString().split('T')[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(msg);
  }

  return grouped;
}

