/**
 * Main segmentation engine - 3-phase adaptive algorithm
 * 
 * Phase 1: Messages → Turns (consecutive messages from same sender)
 * Phase 2: Turns → Volleys (back-and-forth exchanges)
 * Phase 3: Volleys → Sessions (longer conversation periods)
 */

import { Message, Turn, Volley, Session } from '../types';
import { parseDate, getGapSeconds } from '../utils/time';
import { calculateTimeouts } from './kneedle';
import { buildVolley, groupVolleysIntoSessions } from './volley';

/**
 * Phase 1: Group messages into turns
 * Turns are consecutive messages from the same sender
 */
export function messagesToTurns(
  messages: Message[],
  turnTimeout?: number
): Turn[] {
  if (messages.length === 0) {
    return [];
  }

  // Sort messages by timestamp
  const sorted = [...messages].sort(
    (a, b) =>
      parseDate(a.sent_at).getTime() - parseDate(b.sent_at).getTime()
  );

  // Calculate gaps if no timeout provided
  if (!turnTimeout) {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = getGapSeconds(
        parseDate(sorted[i - 1].sent_at),
        parseDate(sorted[i].sent_at)
      );
      gaps.push(gap);
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

    const gap = getGapSeconds(
      parseDate(prevMsg.sent_at),
      parseDate(currMsg.sent_at)
    );

    const senderChanged = currMsg.from_id !== currentSender;
    const timeoutExceeded = gap > turnTimeout;

    if (senderChanged || timeoutExceeded) {
      // Finalize current turn
      turns.push(createTurn(currentTurn, currentSender));

      // Start new turn
      currentTurn = [currMsg];
      currentSender = currMsg.from_id;
    } else {
      currentTurn.push(currMsg);
    }
  }

  // Add final turn
  if (currentTurn.length > 0) {
    turns.push(createTurn(currentTurn, currentSender));
  }

  return turns;
}

/**
 * Helper: Create a turn from messages
 */
function createTurn(messages: Message[], senderId: number): Turn {
  const startTime = parseDate(messages[0].sent_at);
  const endTime = parseDate(messages[messages.length - 1].sent_at);

  return {
    messages,
    sender_id: senderId,
    start_time: startTime,
    end_time: endTime,
  };
}

/**
 * Phase 2: Group turns into volleys (threadlets)
 * Volleys are back-and-forth exchanges
 */
export function turnsToVolleys(
  turns: Turn[],
  threadletTimeout?: number
): Volley[] {
  if (turns.length === 0) {
    return [];
  }

  // Calculate adaptive timeout if not provided
  if (!threadletTimeout) {
    const gaps: number[] = [];
    for (let i = 1; i < turns.length; i++) {
      const gap = getGapSeconds(turns[i - 1].end_time, turns[i].start_time);
      gaps.push(gap);
    }
    const timeouts = calculateTimeouts(gaps);
    threadletTimeout = timeouts.threadlet_timeout;
  }

  const volleys: Volley[] = [];
  let currentVolley: Turn[] = [turns[0]];

  for (let i = 1; i < turns.length; i++) {
    const prevTurn = turns[i - 1];
    const currTurn = turns[i];

    const gap = getGapSeconds(prevTurn.end_time, currTurn.start_time);

    if (gap > threadletTimeout) {
      // Finalize current volley
      volleys.push(buildVolley(currentVolley));
      currentVolley = [currTurn];
    } else {
      currentVolley.push(currTurn);
    }
  }

  // Add final volley
  if (currentVolley.length > 0) {
    volleys.push(buildVolley(currentVolley));
  }

  return volleys;
}

/**
 * Phase 3: Group volleys into sessions
 * Sessions are longer conversation periods
 */
export function volleysToSessions(
  volleys: Volley[],
  sessionTimeout?: number
): Session[] {
  if (volleys.length === 0) {
    return [];
  }

  // Calculate adaptive timeout if not provided
  if (!sessionTimeout) {
    const gaps: number[] = [];
    for (let i = 1; i < volleys.length; i++) {
      const gap = getGapSeconds(
        volleys[i - 1].end_time,
        volleys[i].start_time
      );
      gaps.push(gap);
    }
    const timeouts = calculateTimeouts(gaps);
    sessionTimeout = timeouts.session_timeout;
  }

  return groupVolleysIntoSessions(volleys, sessionTimeout);
}

/**
 * Main API: Segment messages into volleys
 * This is the primary function apps will use
 */
export function getVolleys(messages: Message[]): Volley[] {
  if (messages.length === 0) {
    return [];
  }

  // Phase 1: Messages → Turns
  const turns = messagesToTurns(messages);

  // Phase 2: Turns → Volleys
  const volleys = turnsToVolleys(turns);

  return volleys;
}

/**
 * Get full segmentation including sessions
 */
export function getFullSegmentation(messages: Message[]): {
  turns: Turn[];
  volleys: Volley[];
  sessions: Session[];
} {
  const turns = messagesToTurns(messages);
  const volleys = turnsToVolleys(turns);
  const sessions = volleysToSessions(volleys);

  return {
    turns,
    volleys,
    sessions,
  };
}

