/**
 * Volley Analysis - AI-powered analysis of conversation volleys
 *
 * Provides both deep analysis and lightweight summarization using Gemini AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Volley, VolleyAnalysis, VolleySummary } from '../statistical/types';
import { getOverallReciprocity } from '../statistical/statistics';
import { LLMCacheRN } from './cache';

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
] as any;

/**
 * Deep analysis of a single volley using Gemini AI
 *
 * Extracts comprehensive insights including sentiment, warmth, topics,
 * entities, life events, and more
 */
export async function analyzeVolley(
  volley: Volley,
  apiKey: string,
  cache?: LLMCacheRN
): Promise<VolleyAnalysis> {
  // Import prompt dynamically to avoid circular deps
  const { formatVolleyForAnalysis } = await import('./prompts');
  const prompt = formatVolleyForAnalysis(volley.pivot_text);

  // Check cache first
  if (cache) {
    const cached = await cache.get(prompt);
    if (cached) {
      return { ...cached, volley_id: volley.id };
    }
  }

  // Call Gemini API
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    safetySettings: SAFETY_SETTINGS,
  });

  const result = await model.generateContent(prompt);
  let response = result.response.text();

  // Remove markdown code blocks if present
  response = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[volley_analysis] Failed to parse response:', response.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }

  const analysis = JSON.parse(jsonMatch[0]);

  // Cache the result
  if (cache) {
    await cache.set(prompt, analysis);
  }

  return {
    ...analysis,
    volley_id: volley.id,
  };
}

/**
 * Analyze multiple volleys in batch
 */
export async function analyzeVolleys(
  volleys: Volley[],
  apiKey: string,
  cache?: LLMCacheRN
): Promise<VolleyAnalysis[]> {
  const analyses: VolleyAnalysis[] = [];

  for (const volley of volleys) {
    const analysis = await analyzeVolley(volley, apiKey, cache);
    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Lightweight summarization of a volley
 *
 * Faster and cheaper than full analysis, useful for quick overviews
 */
export async function summarizeVolley(
  volley: Volley,
  userId: number,
  apiKey: string
): Promise<VolleySummary> {
  const { SUMMARY_PROMPT } = await import('./prompts');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `${SUMMARY_PROMPT}\n${volley.pivot_text}`;
  const result = await model.generateContent(prompt);
  const response = result.response.text();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse summary response');
  }

  const data = JSON.parse(jsonMatch[0]);
  const reciprocity = getOverallReciprocity([volley], userId);

  return {
    volley_id: volley.id,
    summary: data.summary || '',
    warmth: data.warmth || 0.5,
    topics: data.topics || [],
    initiator: volley.turns[0].sender_id,
    balance: reciprocity.message_balance,
  };
}

/**
 * Summarize multiple volleys into one overview
 */
export async function summarizeVolleys(
  volleys: Volley[],
  userId: number,
  apiKey: string
): Promise<string> {
  if (volleys.length === 0) return '';

  const summaries = await Promise.all(
    volleys.map(v => summarizeVolley(v, userId, apiKey))
  );

  // Combine into overview
  const topicSet = new Set<string>();
  summaries.forEach(s => s.topics.forEach(t => topicSet.add(t)));

  const topics = Array.from(topicSet).slice(0, 5).join(', ');
  const avgWarmth = summaries.reduce((sum, s) => sum + s.warmth, 0) / summaries.length;

  return `Over ${volleys.length} conversations, you discussed: ${topics}. Overall warmth: ${(avgWarmth * 100).toFixed(0)}%`;
}
