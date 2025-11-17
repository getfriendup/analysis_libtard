/**
 * Tests for segmentation engine
 */

import { messagesToTurns, turnsToVolleys, getVolleys } from '../segmentation';
import { Message } from '../types';

describe('Segmentation', () => {
  const createMessage = (
    id: number,
    fromId: number,
    chatId: number,
    content: string,
    sentAt: string
  ): Message => ({
    ID: id,
    chat_id: chatId,
    from_id: fromId,
    content,
    sent_at: sentAt,
    message_id: `msg_${id}`,
    key_version: 1,
    CreatedAt: sentAt,
    UpdatedAt: sentAt,
  });

  describe('messagesToTurns', () => {
    it('should group consecutive messages from same sender', () => {
      const messages = [
        createMessage(1, 1, 1, 'Hello', '2024-01-01T10:00:00Z'),
        createMessage(2, 1, 1, 'How are you?', '2024-01-01T10:00:30Z'),
        createMessage(3, 2, 1, 'Hi!', '2024-01-01T10:01:00Z'),
        createMessage(4, 2, 1, 'Good!', '2024-01-01T10:01:10Z'),
      ];

      const turns = messagesToTurns(messages, 300);
      expect(turns).toHaveLength(2);
      expect(turns[0].messages).toHaveLength(2);
      expect(turns[0].sender_id).toBe(1);
      expect(turns[1].messages).toHaveLength(2);
      expect(turns[1].sender_id).toBe(2);
    });

    it('should split on timeout', () => {
      const messages = [
        createMessage(1, 1, 1, 'Hello', '2024-01-01T10:00:00Z'),
        createMessage(2, 1, 1, 'Still there?', '2024-01-01T10:10:00Z'),
      ];

      const turns = messagesToTurns(messages, 300); // 5 min timeout
      expect(turns).toHaveLength(2);
    });
  });

  describe('turnsToVolleys', () => {
    it('should create volleys from turns', () => {
      const messages1 = [
        createMessage(1, 1, 1, 'Hey', '2024-01-01T10:00:00Z'),
      ];
      const messages2 = [
        createMessage(2, 2, 1, 'Hi', '2024-01-01T10:00:30Z'),
      ];

      const turns = [
        {
          messages: messages1,
          sender_id: 1,
          start_time: new Date('2024-01-01T10:00:00Z'),
          end_time: new Date('2024-01-01T10:00:00Z'),
        },
        {
          messages: messages2,
          sender_id: 2,
          start_time: new Date('2024-01-01T10:00:30Z'),
          end_time: new Date('2024-01-01T10:00:30Z'),
        },
      ];

      const volleys = turnsToVolleys(turns, 1800);
      expect(volleys).toHaveLength(1);
      expect(volleys[0].depth).toBe(1);
      expect(volleys[0].message_count).toBe(2);
    });
  });

  describe('getVolleys', () => {
    it('should segment messages into volleys', () => {
      const messages = [
        createMessage(1, 1, 1, 'Hey', '2024-01-01T10:00:00Z'),
        createMessage(2, 2, 1, 'Hi!', '2024-01-01T10:00:30Z'),
        createMessage(3, 1, 1, 'How are you?', '2024-01-01T10:01:00Z'),
        createMessage(4, 2, 1, 'Good!', '2024-01-01T10:01:30Z'),
      ];

      const volleys = getVolleys(messages);
      expect(volleys.length).toBeGreaterThan(0);
      expect(volleys[0].participants).toContain(1);
      expect(volleys[0].participants).toContain(2);
    });

    it('should handle empty messages', () => {
      const volleys = getVolleys([]);
      expect(volleys).toHaveLength(0);
    });
  });
});

