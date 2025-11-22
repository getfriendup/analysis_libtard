import { Message, ResponsivenessScore } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ResponsivenessCalculationParams {
  contacts: Array<{
    contactId: number;
    messages: Message[];
  }>;
  userId: number;
  /**
   * Optional timeframe filter. If provided, only messages within the last
   * `timeframeDays` days are included. When omitted, the entire history is used.
   */
  timeframeDays?: number;
}

export interface ResponsivenessScoresResult {
  scores: Map<number, ResponsivenessScore>;
  global_mean_ms: number;
  global_std_ms: number;
  total_samples: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const logistic = (x: number) => 1 / (1 + Math.exp(x));

const mean = (values: number[]) => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stddev = (values: number[], avg: number) => {
  if (values.length < 2) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
};

const parseTimestamp = (message: Message) => new Date(message.sent_at).getTime();

const toNumber = (value: number | string | undefined | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value ?? 0;
};

const collectResponseSamples = (
  messages: Message[],
  userId: number,
  cutoffMs: number
) => {
  if (!messages.length) {
    return [] as number[];
  }

  const myId = toNumber(userId);

  const relevantMessages = messages
    .map((message) => ({
      time: parseTimestamp(message),
      fromUser: toNumber(message.from_id) === myId,
    }))
    .filter((entry) => entry.time >= cutoffMs)
    .sort((a, b) => a.time - b.time);

  const samples: number[] = [];
  let waitingSince: number | null = null;

  for (const entry of relevantMessages) {
    if (entry.fromUser) {
      if (waitingSince !== null && entry.time >= waitingSince) {
        samples.push(entry.time - waitingSince);
        waitingSince = null;
      }
    } else if (waitingSince === null) {
      waitingSince = entry.time;
    }
  }

  return samples;
};

export function calculateResponsivenessScores(
  params: ResponsivenessCalculationParams
): ResponsivenessScoresResult {
  const { contacts, userId, timeframeDays } = params;

  const cutoffMs = timeframeDays
    ? Date.now() - timeframeDays * DAY_MS
    : Number.NEGATIVE_INFINITY;

  const contactSamples = contacts.map(({ contactId, messages }) => ({
    contactId,
    samples: collectResponseSamples(messages, userId, cutoffMs),
  }));

  const allSamples = contactSamples.flatMap((entry) => entry.samples);
  const globalMean = mean(allSamples);
  const globalStd = stddev(allSamples, globalMean);

  const scores = new Map<number, ResponsivenessScore>();

  for (const { contactId, samples } of contactSamples) {
    if (!samples.length) {
      scores.set(contactId, {
        contact_id: contactId,
        score: 0.5,
        mean_response_ms: 0,
        z_score: 0,
        sample_count: 0,
      });
      continue;
    }

    const contactMean = mean(samples);
    const zScore =
      globalStd > 0 ? (contactMean - globalMean) / globalStd : 0;
    const score = clamp(logistic(zScore));

    scores.set(contactId, {
      contact_id: contactId,
      score,
      mean_response_ms: contactMean,
      z_score: zScore,
      sample_count: samples.length,
    });
  }

  return {
    scores,
    global_mean_ms: globalMean,
    global_std_ms: globalStd,
    total_samples: allSamples.length,
  };
}


