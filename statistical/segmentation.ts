/**
 * Message Segmentation
 *
 * Adaptive 3-phase algorithm:
 * Phase 1: Messages → Turns (consecutive messages from same sender)
 * Phase 2: Turns → Volleys (back-and-forth exchanges)
 *
 * Uses Kneedle algorithm to find optimal timeout thresholds
 */

import { Message, Turn, Volley } from './types';
import { parseDate, getGapSeconds } from '../utils/time';
import { calculateTimeouts } from './kneedle';
import { buildVolley } from './volley';

/**
 * Phase 1: Group messages into turns
 */
function messagesToTurns(
  messages: Message[],
  turnTimeout?: number
): Turn[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort(
    (a, b) => parseDate(a.sent_at).getTime() - parseDate(b.sent_at).getTime()
  );

  // Calculate adaptive timeout if not provided
  if (!turnTimeout) {
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(getGapSeconds(
        parseDate(sorted[i - 1].sent_at),
        parseDate(sorted[i].sent_at)
      ));
    }
    const timeouts = calculateTimeouts(gaps);
    turnTimeout = timeouts.turn_timeout;
  }

  const turns: Turn[] = [];
  let currentTurn: Message[] = [sorted[0]];
  let currentSender = sorted[0].from_id;

  for (let i = 1; i < sorted.length; i++) {
    const prevMsg = sorted[i - 1];
    const currMsg = sorted[i];
    const gap = getGapSeconds(parseDate(prevMsg.sent_at), parseDate(currMsg.sent_at));
    const senderChanged = currMsg.from_id !== currentSender;

    if (senderChanged || gap > turnTimeout) {
      turns.push(createTurn(currentTurn, currentSender));
      currentTurn = [currMsg];
      currentSender = currMsg.from_id;
    } else {
      currentTurn.push(currMsg);
    }
  }

  if (currentTurn.length > 0) {
    turns.push(createTurn(currentTurn, currentSender));
  }

  return turns;
}

function createTurn(messages: Message[], senderId: number): Turn {
  return {
    messages,
    sender_id: senderId,
    start_time: parseDate(messages[0].sent_at),
    end_time: parseDate(messages[messages.length - 1].sent_at),
  };
}

/**
 * Phase 2: Group turns into volleys
 */
function turnsToVolleys(
  turns: Turn[],
  volleyTimeout?: number
): Volley[] {
  if (turns.length === 0) return [];

  // Calculate adaptive timeout if not provided
  if (!volleyTimeout) {
    const gaps = [];
    for (let i = 1; i < turns.length; i++) {
      gaps.push(getGapSeconds(turns[i - 1].end_time, turns[i].start_time));
    }
    const timeouts = calculateTimeouts(gaps);
    volleyTimeout = timeouts.threadlet_timeout;
  }

  const volleys: Volley[] = [];
  let currentVolley: Turn[] = [turns[0]];

  for (let i = 1; i < turns.length; i++) {
    const gap = getGapSeconds(turns[i - 1].end_time, turns[i].start_time);

    if (gap > volleyTimeout) {
      volleys.push(buildVolley(currentVolley));
      currentVolley = [turns[i]];
    } else {
      currentVolley.push(turns[i]);
    }
  }

  if (currentVolley.length > 0) {
    volleys.push(buildVolley(currentVolley));
  }

  return volleys;
}

/**
 * Main API: Segment messages into volleys
 */
export function segmentMessages(messages: Message[]): Volley[] {
  if (messages.length === 0) return [];

  const turns = messagesToTurns(messages);
  const volleys = turnsToVolleys(turns);

  return volleys;
}

// Alias for compatibility
export const getVolleys = segmentMessages;
