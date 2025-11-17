/**
 * Core type definitions for the analysis library
 */

/**
 * Raw message structure from WhatsApp
 */
export interface Message {
  ID: number;
  chat_id: number;
  from_id: number;
  content: string;
  sent_at: string;
  message_id: string;
  key_version: number;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Contact information
 */
export interface Contact {
  ID: number;
  user_id: number;
  name: string;
  cell_phone: string;
  key_version: number;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Turn - consecutive messages from the same sender
 */
export interface Turn {
  messages: Message[];
  sender_id: number;
  start_time: Date;
  end_time: Date;
}

/**
 * Volley (Threadlet) - back-and-forth conversation exchange
 */
export interface Volley {
  id: string;
  turns: Turn[];
  participants: number[];
  start_time: Date;
  end_time: Date;
  depth: number; // Number of speaker changes
  message_count: number;
  pivot_text: string; // Full conversation text
}

/**
 * Session - longer conversation period containing multiple volleys
 */
export interface Session {
  volleys: Volley[];
  participants: number[];
  start_time: Date;
  end_time: Date;
  duration_minutes: number;
}

/**
 * Reciprocity pattern in conversation
 */
export type ReciprocityType = 'balanced' | 'one_sided_me' | 'one_sided_them';

/**
 * Event type classification
 */
export type EventType = 'positive' | 'negative' | 'neutral';

/**
 * Response quality assessment
 */
export type ResponseQuality =
  | 'engaged'
  | 'minimal'
  | 'delayed'
  | 'enthusiastic'
  | 'dismissive';

/**
 * Person who showed empathy
 */
export type EmpathyShownBy = 'me' | 'them' | 'both' | 'neither';

/**
 * Person who asked questions
 */
export type QuestionBy = 'me' | 'them' | 'both' | 'neither';

/**
 * Entity extracted from conversation
 */
export interface Entity {
  name: string;
  type: 'person' | 'place' | 'organization' | 'product' | 'other';
  context: string;
}

/**
 * Life event detected in conversation
 */
export interface LifeEvent {
  type: string;
  date_iso?: string;
  description: string;
}

/**
 * Analysis result from Gemini AI for a single volley
 */
export interface VolleyAnalysis {
  volley_id: string;
  sentiment: number; // -1.0 (negative) to 1.0 (positive)
  warmth: number; // 0.0 (cold) to 1.0 (warm)
  reciprocity: ReciprocityType;
  emotion_labels: string[];
  event_type: EventType;
  empathy_shown_by: EmpathyShownBy;
  plans_made: boolean;
  question_by: QuestionBy;
  is_logistics: boolean;
  response_quality: ResponseQuality;
  topics: string[];
  entities: Entity[];
  events: LifeEvent[];
  summary: string; // 1-2 sentence summary
  key_insight: string; // 4-5 word glance
  explanation: string; // 2-3 sentences with quotes
  search_summary: string; // Verbose 4-8 sentences for vectorization
}

/**
 * Churn risk metrics (RFV framework)
 */
export interface ChurnMetrics {
  recency_days: number; // Days since last contact
  frequency_per_week: number; // Conversations per week
  value_score: number; // Engagement depth (0-1)
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * Sentiment trend over time
 */
export type SentimentTrend = 'improving' | 'stable' | 'declining';

/**
 * Connection state classification
 */
export type ConnectionState =
  | 'thriving'
  | 'stable'
  | 'cooling'
  | 'at_risk'
  | 'dormant';

/**
 * Call to action recommendation
 */
export type CTAType =
  | 'maintain'
  | 'check_in'
  | 'deepen'
  | 'reconnect'
  | 'repair';

/**
 * Topic with frequency count
 */
export interface TopicFrequency {
  topic: string;
  count: number;
  percentage: number;
}

/**
 * Emotion distribution
 */
export interface EmotionDistribution {
  emotion: string;
  count: number;
  percentage: number;
}

/**
 * Aggregated metrics for a contact
 */
export interface ContactMetrics {
  contact_id: number;
  volley_count: number;
  message_count: number;
  
  // Averages
  avg_warmth: number;
  avg_sentiment: number;
  
  // Reciprocity
  balanced_ratio: number; // Percentage of balanced volleys (0-100)
  one_sided_me_count: number;
  one_sided_them_count: number;
  one_sided_me_streak: number; // Consecutive initiations by me
  
  // Temporal
  last_contact_date: Date;
  last_meaningful_days: number; // Days since substantive conversation
  relationship_length_days: number;
  
  // Content
  top_topics: TopicFrequency[];
  emotion_distribution: EmotionDistribution[];
  positive_event_count: number;
  negative_event_count: number;
  
  // Churn analysis
  churn_metrics: ChurnMetrics;
  
  // Trends
  sentiment_trend: SentimentTrend;
  warmth_trend: SentimentTrend;
  connection_state: ConnectionState;
  
  // Scoring
  priority_score: number; // 0-100
  importance_score: number; // 0-1
  cta: CTAType;
}

/**
 * Streak information for engagement tracking
 */
export interface StreakInfo {
  current_streak_days: number;
  longest_streak_days: number;
  streak_broken_date?: Date;
  is_active: boolean;
  last_message_date: Date;
}

/**
 * Daily activity summary
 */
export interface DailyActivity {
  date: Date;
  message_count: number;
  contact_count: number;
  avg_warmth: number;
  avg_sentiment: number;
}

/**
 * Social health score breakdown
 */
export interface SocialHealthScore {
  total_score: number; // 0-100
  breakdown: {
    engagement: number; // How active you are
    depth: number; // Quality of conversations
    reciprocity: number; // Balance in relationships
    consistency: number; // Regular contact
  };
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Configuration for the analysis engine
 */
export interface Config {
  gemini_api_key: string;
  gemini_model?: string; // Default: 'gemini-2.5-flash'
  cache_path?: string; // Path for LLM response cache
  user_id?: number; // User ID for "me" identification
  enable_cache?: boolean; // Default: true
  rate_limit?: number; // Requests per minute, default: 60
  retry_attempts?: number; // Default: 3
  retry_delay_ms?: number; // Default: 2000
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  volleys: Volley[];
  analyses: VolleyAnalysis[];
  metrics: ContactMetrics;
  processing_time_ms: number;
}

/**
 * Cache entry for LLM responses
 */
export interface CacheEntry {
  response: VolleyAnalysis;
  timestamp: number;
  model: string;
  hash: string;
}

