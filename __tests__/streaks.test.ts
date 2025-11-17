/**
 * Tests for streak tracking
 */

import { getStreaks } from '../features/streaks';
import { Message } from '../types';

describe('Streaks', () => {
  const createMessage = (id: number, sentAt: string): Message => ({
    ID: id,
    chat_id: 1,
    from_id: 1,
    content: `Message ${id}`,
    sent_at: sentAt,
    message_id: `msg_${id}`,
    key_version: 1,
    CreatedAt: sentAt,
    UpdatedAt: sentAt,
  });

  it('should calculate current streak', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messages = [
      createMessage(1, yesterday.toISOString()),
      createMessage(2, today.toISOString()),
    ];

    const streak = getStreaks(messages);
    expect(streak.current_streak_days).toBeGreaterThanOrEqual(1);
    expect(streak.is_active).toBe(true);
  });

  it('should handle broken streaks', () => {
    const messages = [
      createMessage(1, '2024-01-01T10:00:00Z'),
      createMessage(2, '2024-01-05T10:00:00Z'),
    ];

    const streak = getStreaks(messages);
    expect(streak.current_streak_days).toBe(0);
  });

  it('should handle empty messages', () => {
    const streak = getStreaks([]);
    expect(streak.current_streak_days).toBe(0);
    expect(streak.longest_streak_days).toBe(0);
  });
});

