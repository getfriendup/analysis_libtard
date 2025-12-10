import { Volley, ChurnMetrics } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ChurnCalculationOptions {
  /**
   * Reference time for recency calculations. Defaults to now.
   */
  currentTime?: Date;
  /**
   * Minimum number of days considered the "recent" window.
   * Defaults to 30.
   */
  minRecentWindowDays?: number;
  /**
   * Multiplier applied to the historical average gap to size the recent window.
   * Defaults to 2.
   */
  recentWindowMultiplier?: number;
}

const DEFAULT_METRICS: ChurnMetrics = {
  recency_days: Infinity,
  recent_window_days: 30,
  recent_volley_count: 0,
  historical_volley_count: 0,
  historical_volley_rate: 0,
  recent_volley_rate: 0,
  frequency_ratio: 1,
  historical_avg_turns: 0,
  recent_avg_turns: 0,
  value_ratio: 1,
  churn_risk_score: 0,
  total_days_of_history: 0,
  historical_avg_gap_days: 0,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const mean = (values: number[]) => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function calculateChurnMetrics(
  volleys: Volley[],
  options: ChurnCalculationOptions = {}
): ChurnMetrics {
  if (!volleys.length) {
    return { ...DEFAULT_METRICS };
  }

  const {
    currentTime = new Date(),
    minRecentWindowDays = 30,
    recentWindowMultiplier = 2,
  } = options;

  const sorted = [...volleys].sort(
    (a, b) => a.start_time.getTime() - b.start_time.getTime()
  );

  const firstVolley = sorted[0];
  const lastVolley = sorted[sorted.length - 1];

  const totalHistoryMs = Math.max(
    lastVolley.start_time.getTime() - firstVolley.start_time.getTime(),
    DAY_MS
  );
  const totalDaysOfHistory = totalHistoryMs / DAY_MS;

  const gapMs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start_time.getTime() - sorted[i - 1].start_time.getTime();
    gapMs.push(gap);
  }

  const historicalAvgGapDays = gapMs.length
    ? mean(gapMs) / DAY_MS
    : totalDaysOfHistory;

  const computedRecentWindowDays = Math.max(
    minRecentWindowDays,
    historicalAvgGapDays * recentWindowMultiplier || minRecentWindowDays
  );
  const recentWindowMs = computedRecentWindowDays * DAY_MS;
  const recentCutoffMs = currentTime.getTime() - recentWindowMs;

  const recentVolleys = sorted.filter(
    (volley) => volley.start_time.getTime() >= recentCutoffMs
  );

  const historicalVolleyCount = sorted.length;
  const recentVolleyCount = recentVolleys.length;

  const historicalVolleyRate =
    historicalVolleyCount / Math.max(totalDaysOfHistory, 1);
  const recentVolleyRate =
    recentVolleyCount / Math.max(computedRecentWindowDays, 1);

  const frequencyRatio =
    historicalVolleyRate > 0
      ? clamp(recentVolleyRate / historicalVolleyRate, 0, 3)
      : recentVolleyRate > 0
        ? 1
        : 0;

  const turnCounts = sorted.map((volley) => volley.turns.length);
  const historicalAvgTurns = mean(turnCounts);
  const recentAvgTurns = recentVolleys.length
    ? mean(recentVolleys.map((volley) => volley.turns.length))
    : 0;

  const valueRatio =
    historicalAvgTurns > 0 && recentAvgTurns > 0
      ? clamp(recentAvgTurns / historicalAvgTurns, 0, 3)
      : 1;

  const recencyDays =
    (currentTime.getTime() - lastVolley.start_time.getTime()) / DAY_MS;

  const recencyRatio =
    computedRecentWindowDays > 0 ? recencyDays / computedRecentWindowDays : 0;
  const recencyRisk = sigmoid(recencyRatio - 1); // >1 => riskier
  const frequencyRisk = sigmoid(1 - frequencyRatio); // <1 => riskier
  const valueRisk = sigmoid(1 - valueRatio); // <1 => riskier

  const churnRiskScore = clamp(
    recencyRisk * 0.5 + frequencyRisk * 0.3 + valueRisk * 0.2
  );

  return {
    recency_days: recencyDays,
    recent_window_days: computedRecentWindowDays,
    recent_volley_count: recentVolleyCount,
    historical_volley_count: historicalVolleyCount,
    historical_volley_rate: historicalVolleyRate,
    recent_volley_rate: recentVolleyRate,
    frequency_ratio: frequencyRatio,
    historical_avg_turns: historicalAvgTurns,
    recent_avg_turns: recentAvgTurns,
    value_ratio: valueRatio,
    churn_risk_score: churnRiskScore,
    total_days_of_history: totalDaysOfHistory,
    historical_avg_gap_days: historicalAvgGapDays,
  };
}

export function calculateRelationshipLengthScore(
  metrics: Pick<ChurnMetrics, 'total_days_of_history'>,
  maxDays: number = 5 * 365
): number {
  if (!metrics.total_days_of_history) {
    return 0;
  }
  return clamp(metrics.total_days_of_history / maxDays, 0, 1);
}


