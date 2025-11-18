/**
 * LLM response caching for React Native using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { VolleyAnalysis, CacheEntry } from '../types';
import { sha256 } from 'js-sha256';

const CACHE_KEY_PREFIX = '@analysis_cache:';

/**
 * Cache manager for LLM responses (React Native version)
 */
export class LLMCacheRN {
  private cache: Map<string, CacheEntry> = new Map();
  private dirty: boolean = false;
  private cacheKey: string;

  constructor(cacheKey: string = 'llm_cache') {
    this.cacheKey = `${CACHE_KEY_PREFIX}${cacheKey}`;
  }

  /**
   * Generate cache key from volley text
   */
  private generateKey(text: string): string {
    return sha256(text);
  }

  /**
   * Load cache from AsyncStorage
   */
  async load(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.cacheKey);

      if (data) {
        const entries: Record<string, CacheEntry> = JSON.parse(data);

        this.cache.clear();
        for (const [key, entry] of Object.entries(entries)) {
          this.cache.set(key, entry);
        }
      } else {
        // No cache exists yet
        this.cache.clear();
      }
    } catch (error) {
      // Failed to load cache, start fresh
      console.warn('[LLMCacheRN] Failed to load cache:', error);
      this.cache.clear();
    }
  }

  /**
   * Save cache to AsyncStorage
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    try {
      const entries: Record<string, CacheEntry> = {};
      for (const [key, entry] of this.cache.entries()) {
        entries[key] = entry;
      }

      await AsyncStorage.setItem(this.cacheKey, JSON.stringify(entries));
      this.dirty = false;
    } catch (error) {
      console.error('[LLMCacheRN] Failed to save cache:', error);
    }
  }

  /**
   * Get cached analysis
   */
  get(volleyText: string): VolleyAnalysis | null {
    const key = this.generateKey(volleyText);
    const entry = this.cache.get(key);

    if (entry) {
      return entry.response;
    }

    return null;
  }

  /**
   * Store analysis in cache
   */
  set(
    volleyText: string,
    analysis: VolleyAnalysis,
    model: string = 'gemini-2.5-flash'
  ): void {
    const key = this.generateKey(volleyText);
    const entry: CacheEntry = {
      response: analysis,
      timestamp: Date.now(),
      model,
      hash: key,
    };

    this.cache.set(key, entry);
    this.dirty = true;
  }

  /**
   * Check if volley is cached
   */
  has(volleyText: string): boolean {
    const key = this.generateKey(volleyText);
    return this.cache.has(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (newest === null || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.dirty = true;
  }
}
