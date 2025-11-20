/**
 * @dontbeabadfriend/analysis
 *
 * Clean, modular analysis library for WhatsApp message insights
 */

// ===================================================================
// STATISTICAL EXPORTS - Types & Basic Functions
// ===================================================================

export * from './statistical/types';
export { segmentMessages, getVolleys } from './statistical/segmentation';
export {
  getStreaks,
  getResponseTimes,
  getVolleyReciprocity,
  getOverallReciprocity,
  getVolleyStats,
} from './statistical/statistics';

// ===================================================================
// AI EXPORTS - Gemini-powered analysis
// ===================================================================

// Cache
export { LLMCacheRN } from './ai/cache';

// Volley Analysis
export {
  analyzeVolley,
  analyzeVolleys,
  summarizeVolley,
  summarizeVolleys,
} from './ai/volley_analysis';

// Relationship Analysis
export { analyzeRelationship } from './ai/relationship_analysis';

// Response Suggestions
export { generateResponseSuggestions } from './ai/response_suggester';

// ===================================================================
// HEALTH EXPORTS - Relationship health scoring
// ===================================================================

export { calculateHealthScore } from './health/scoring';
