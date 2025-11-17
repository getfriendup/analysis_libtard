/**
 * Main API surface for the analysis library
 */

import {
  Message,
  Volley,
  VolleyAnalysis,
  ContactMetrics,
  Config,
  BatchAnalysisResult,
  StreakInfo,
  SocialHealthScore,
} from './types';

// Segmentation
import { getVolleys, getFullSegmentation } from './segmentation';

// Analysis
import { GeminiAnalyzer } from './analysis/gemini';

// Aggregation
import { getContactMetrics } from './aggregation/metrics';
import {
  calculateImportanceScore,
  calculatePriorityScore,
  calculateResponsiveness,
  rankByImportance,
  rankByPriority,
  identifyVIPs,
  identifyAtRisk,
} from './aggregation/scoring';

// Features
import { getStreaks } from './features/streaks';
import {
  getActiveToday,
  getActiveThisWeek,
  getActivePeriod,
} from './features/active';
import { getSocialHealthScore } from './features/health';

/**
 * Main analysis engine class
 */
export class AnalysisEngine {
  private gemini: GeminiAnalyzer;

  constructor(config: Config) {
    this.gemini = new GeminiAnalyzer(config);
  }

  /**
   * Initialize the engine (load cache, etc.)
   */
  async initialize(): Promise<void> {
    await this.gemini.initialize();
  }

  /**
   * Segment messages into volleys
   */
  getVolleys(messages: Message[]): Volley[] {
    return getVolleys(messages);
  }

  /**
   * Analyze a single volley using Gemini AI
   */
  async getAnalysisForVolley(volley: Volley): Promise<VolleyAnalysis> {
    return await this.gemini.analyzeVolley(volley);
  }

  /**
   * Get contact metrics from analyses
   */
  getContactMetrics(
    contactId: number,
    analyses: VolleyAnalysis[]
  ): ContactMetrics {
    return getContactMetrics(contactId, analyses);
  }

  /**
   * Get engagement streaks
   */
  getStreaks(messages: Message[]): StreakInfo {
    return getStreaks(messages);
  }

  /**
   * Get contacts active today
   */
  getActiveToday(messages: Message[]): number[] {
    return getActiveToday(messages);
  }

  /**
   * Get contacts active this week
   */
  getActiveThisWeek(messages: Message[]): number[] {
    return getActiveThisWeek(messages);
  }

  /**
   * Get contacts active in period
   */
  getActivePeriod(messages: Message[], days: number): number[] {
    return getActivePeriod(messages, days);
  }

  /**
   * Calculate average warmth from analyses
   */
  getAvgWarmth(analyses: VolleyAnalysis[]): number {
    if (analyses.length === 0) return 0;
    const sum = analyses.reduce((acc, a) => acc + a.warmth, 0);
    return sum / analyses.length;
  }

  /**
   * Calculate average sentiment from analyses
   */
  getAvgSentiment(analyses: VolleyAnalysis[]): number {
    if (analyses.length === 0) return 0;
    const sum = analyses.reduce((acc, a) => acc + a.sentiment, 0);
    return sum / analyses.length;
  }

  /**
   * Get social health score
   */
  getSocialHealthScore(contacts: ContactMetrics[]): SocialHealthScore {
    return getSocialHealthScore(contacts);
  }

  /**
   * Batch processing: analyze all messages for a contact
   */
  async analyzeBatch(messages: Message[]): Promise<BatchAnalysisResult> {
    const startTime = Date.now();

    // Segment messages
    const volleys = this.getVolleys(messages);

    // Analyze each volley
    const analyses = await this.gemini.analyzeBatch(volleys);

    // Calculate metrics (assuming single contact)
    const contactId = messages[0]?.chat_id || 0;
    const metrics = this.getContactMetrics(contactId, analyses);

    const processingTime = Date.now() - startTime;

    return {
      volleys,
      analyses,
      metrics,
      processing_time_ms: processingTime,
    };
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    await this.gemini.saveCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    return this.gemini.getCacheStats();
  }
}

// Export types
export * from './types';

// Export utility functions
export {
  // Segmentation
  getVolleys,
  getFullSegmentation,
  // Metrics
  getContactMetrics,
  // Scoring
  calculateImportanceScore,
  calculatePriorityScore,
  calculateResponsiveness,
  rankByImportance,
  rankByPriority,
  identifyVIPs,
  identifyAtRisk,
  // Features
  getStreaks,
  getActiveToday,
  getActiveThisWeek,
  getActivePeriod,
  getSocialHealthScore,
};

