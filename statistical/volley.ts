/**
 * Volley builder - constructs conversation exchanges from turns
 */

import { Turn, Volley, Session } from './types';
import { parseDate, getGapSeconds } from '../utils/time';
import { sha256 } from 'js-sha256';

/**
 * Create a unique ID for a volley based on its content
 */
export function createVolleyId(
  startTime: Date,
  endTime: Date,
  participantIds: number[]
): string {
  const data = `${startTime.toISOString()}-${endTime.toISOString()}-${participantIds.sort().join(',')}`;
  return sha256(data).substring(0, 16);
}

/**
 * Build a volley from a group of turns
 */
export function buildVolley(turns: Turn[]): Volley {
  if (turns.length === 0) {
    throw new Error('Cannot build volley from empty turns array');
  }

  const messages = turns.flatMap((t) => t.messages);
  const participants = Array.from(
    new Set(turns.map((t) => t.sender_id))
  ).sort();

  const startTime = turns[0].start_time;
  const endTime = turns[turns.length - 1].end_time;

  // Calculate depth (number of speaker changes)
  let depth = 0;
  let lastSender: number | null = null;
  for (const turn of turns) {
    if (lastSender !== null && turn.sender_id !== lastSender) {
      depth++;
    }
    lastSender = turn.sender_id;
  }

  // Build pivot text (full conversation)
  const pivotText = messages
    .map((msg) => {
      const time = parseDate(msg.sent_at);
      const timeStr = time.toISOString().split('T')[1].substring(0, 5);
      const sender = msg.from_id === participants[0] ? 'Me' : 'Them';
      return `${timeStr} - ${sender}: ${msg.content}`;
    })
    .join('\n');

  const id = createVolleyId(startTime, endTime, participants);

  return {
    id,
    turns,
    participants,
    start_time: startTime,
    end_time: endTime,
    depth,
    message_count: messages.length,
    pivot_text: pivotText,
  };
}

/**
 * Group volleys into sessions based on timeout
 */
export function groupVolleysIntoSessions(
  volleys: Volley[],
  sessionTimeout: number
): Session[] {
  if (volleys.length === 0) {
    return [];
  }

  const sessions: Session[] = [];
  let currentSession: Volley[] = [volleys[0]];

  for (let i = 1; i < volleys.length; i++) {
    const prevVolley = volleys[i - 1];
    const currVolley = volleys[i];

    const gap = getGapSeconds(prevVolley.end_time, currVolley.start_time);

    if (gap > sessionTimeout) {
      // Create session from current batch
      sessions.push(buildSession(currentSession));
      currentSession = [currVolley];
    } else {
      currentSession.push(currVolley);
    }
  }

  // Add final session
  if (currentSession.length > 0) {
    sessions.push(buildSession(currentSession));
  }

  return sessions;
}

/**
 * Build a session from a group of volleys
 */
function buildSession(volleys: Volley[]): Session {
  const startTime = volleys[0].start_time;
  const endTime = volleys[volleys.length - 1].end_time;
  const participants = Array.from(
    new Set(volleys.flatMap((v) => v.participants))
  ).sort();

  const durationMinutes = getGapSeconds(startTime, endTime) / 60;

  return {
    volleys,
    participants,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
  };
}

