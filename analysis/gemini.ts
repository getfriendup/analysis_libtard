/**
 * Gemini AI integration for volley analysis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Volley, VolleyAnalysis, Config } from '../types';
import { LLMCacheRN as LLMCache } from './cache-rn';
import { formatVolleyForAnalysis } from './prompts';

/**
 * Gemini analyzer with caching and retry logic
 */
export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private cache: LLMCache;
  private enableCache: boolean;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: Config) {
    this.genAI = new GoogleGenerativeAI(config.gemini_api_key);
    this.model = config.gemini_model || 'gemini-2.5-flash';
    this.cache = new LLMCache(config.cache_path);
    this.enableCache = config.enable_cache !== false;
    this.retryAttempts = config.retry_attempts || 3;
    this.retryDelay = config.retry_delay_ms || 2000;
  }

  /**
   * Initialize cache (load from disk)
   */
  async initialize(): Promise<void> {
    if (this.enableCache) {
      await this.cache.load();
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    if (this.enableCache) {
      await this.cache.save();
    }
  }

  /**
   * Analyze a volley using Gemini AI
   */
  async analyzeVolley(volley: Volley): Promise<VolleyAnalysis> {
    // Check cache first
    if (this.enableCache) {
      const cached = this.cache.get(volley.pivot_text);
      if (cached) {
        // Return cached result with updated volley_id
        return {
          ...cached,
          volley_id: volley.id,
        };
      }
    }

    // Call Gemini API with retry logic
    const analysis = await this.callGeminiWithRetry(volley);

    // Cache the result
    if (this.enableCache) {
      this.cache.set(volley.pivot_text, analysis, this.model);
    }

    return analysis;
  }

  /**
   * Call Gemini API with retry logic
   */
  private async callGeminiWithRetry(volley: Volley): Promise<VolleyAnalysis> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await this.callGemini(volley);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to analyze volley after retries');
  }

  /**
   * Call Gemini API
   */
  private async callGemini(volley: Volley): Promise<VolleyAnalysis> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const prompt = formatVolleyForAnalysis(volley.pivot_text);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    let parsed: Partial<VolleyAnalysis>;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
    }

    // Validate and construct VolleyAnalysis
    const analysis: VolleyAnalysis = {
      volley_id: volley.id,
      sentiment: this.ensureNumber(parsed.sentiment, 0),
      warmth: this.ensureNumber(parsed.warmth, 0.5),
      reciprocity: this.ensureReciprocity(parsed.reciprocity),
      emotion_labels: Array.isArray(parsed.emotion_labels)
        ? parsed.emotion_labels
        : [],
      event_type: this.ensureEventType(parsed.event_type),
      empathy_shown_by: this.ensureEmpathyType(parsed.empathy_shown_by),
      plans_made: Boolean(parsed.plans_made),
      question_by: this.ensureQuestionType(parsed.question_by),
      is_logistics: Boolean(parsed.is_logistics),
      response_quality: this.ensureResponseQuality(parsed.response_quality),
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      summary: String(parsed.summary || ''),
      key_insight: String(parsed.key_insight || ''),
      explanation: String(parsed.explanation || ''),
      search_summary: String(parsed.search_summary || parsed.summary || ''),
    };

    return analysis;
  }

  /**
   * Helper methods for type validation
   */
  private ensureNumber(value: unknown, defaultValue: number): number {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  private ensureReciprocity(
    value: unknown
  ): 'balanced' | 'one_sided_me' | 'one_sided_them' {
    if (
      value === 'balanced' ||
      value === 'one_sided_me' ||
      value === 'one_sided_them'
    ) {
      return value;
    }
    return 'balanced';
  }

  private ensureEventType(value: unknown): 'positive' | 'negative' | 'neutral' {
    if (value === 'positive' || value === 'negative' || value === 'neutral') {
      return value;
    }
    return 'neutral';
  }

  private ensureEmpathyType(
    value: unknown
  ): 'me' | 'them' | 'both' | 'neither' {
    if (
      value === 'me' ||
      value === 'them' ||
      value === 'both' ||
      value === 'neither'
    ) {
      return value;
    }
    return 'neither';
  }

  private ensureQuestionType(
    value: unknown
  ): 'me' | 'them' | 'both' | 'neither' {
    if (
      value === 'me' ||
      value === 'them' ||
      value === 'both' ||
      value === 'neither'
    ) {
      return value;
    }
    return 'neither';
  }

  private ensureResponseQuality(
    value: unknown
  ):
    | 'engaged'
    | 'minimal'
    | 'delayed'
    | 'enthusiastic'
    | 'dismissive' {
    if (
      value === 'engaged' ||
      value === 'minimal' ||
      value === 'delayed' ||
      value === 'enthusiastic' ||
      value === 'dismissive'
    ) {
      return value;
    }
    return 'engaged';
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    const message = String(error);
    return (
      message.includes('API key') ||
      message.includes('invalid') ||
      message.includes('parse')
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Batch analyze multiple volleys
   */
  async analyzeBatch(volleys: Volley[]): Promise<VolleyAnalysis[]> {
    const analyses: VolleyAnalysis[] = [];

    for (const volley of volleys) {
      const analysis = await this.analyzeVolley(volley);
      analyses.push(analysis);
    }

    // Save cache after batch
    await this.saveCache();

    return analyses;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    return this.cache.getStats();
  }
}

