/**
 * LLM response caching using SHA256 hashes
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { VolleyAnalysis, CacheEntry } from '../types';
import * as path from 'path';

/**
 * Cache manager for LLM responses
 */
export class LLMCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cachePath: string;
  private dirty: boolean = false;

  constructor(cachePath: string = './.cache/llm_cache.json') {
    this.cachePath = cachePath;
  }

  /**
   * Generate cache key from volley text
   */
  private generateKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cachePath);
      await fs.mkdir(dir, { recursive: true });

      const data = await fs.readFile(this.cachePath, 'utf-8');
      const entries: Record<string, CacheEntry> = JSON.parse(data);

      this.cache.clear();
      for (const [key, entry] of Object.entries(entries)) {
        this.cache.set(key, entry);
      }
    } catch (error) {
      // Cache file doesn't exist yet, start fresh
      this.cache.clear();
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    const entries: Record<string, CacheEntry> = {};
    for (const [key, entry] of this.cache.entries()) {
      entries[key] = entry;
    }

    const dir = path.dirname(this.cachePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.cachePath, JSON.stringify(entries, null, 2));

    this.dirty = false;
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

