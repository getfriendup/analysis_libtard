/**
 * Core type definitions
 */

// ===================================================================
// BASE MESSAGE TYPES
// ===================================================================

/**
 * Raw message from WhatsApp backend
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

// ===================================================================
// SEGMENTATION TYPES
// ===================================================================

/**
 * Turn - consecutive messages from same sender
 */
export interface Turn {
  messages: Message[];
  sender_id: number;
  start_time: Date;
  end_time: Date;
}

/**
 * Volley - back-and-forth conversation exchange
 */
export interface Volley {
  id: string;
  turns: Turn[];
  participants: number[];
  start_time: Date;
  end_time: Date;
  depth: number; // Number of speaker changes
  message_count: number;
  pivot_text: string; // Full conversation formatted for AI
}

/**
 * Session - group of volleys in a continuous conversation period
 */
export interface Session {
  volleys: Volley[];
  participants: number[];
  start_time: Date;
  end_time: Date;
  duration_minutes: number;
}

// ===================================================================
// ANALYSIS OUTPUT TYPES
// ===================================================================

export type ReciprocityType = 'balanced' | 'one_sided_me' | 'one_sided_them';
export type EventType = 'positive' | 'negative' | 'neutral';
export type ResponseQuality = 'engaged' | 'minimal' | 'delayed' | 'enthusiastic' | 'dismissive';
export type EmpathyShownBy = 'me' | 'them' | 'both' | 'neither';
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
 * Volley analysis from AI
 */
export interface VolleyAnalysis {
  volley_id: string;
  warmth: number; // 0.0 (cold) to 1.0 (warm)
  sentiment: number; // -1.0 (negative) to 1.0 (positive)
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
  search_summary: string; // Verbose 4-8 sentences for search
}

/**
 * Volley summary (lightweight version of analysis)
 */
export interface VolleySummary {
  volley_id: string;
  summary: string; // Brief text summary
  warmth: number;
  topics: string[];
  initiator: number; // Who started the volley
  balance: number; // Message balance 0-1 (0=all them, 1=all me, 0.5=balanced)
}

/**
 * Relationship context analysis
 */
export interface RelationshipContext {
  contact_id: number;
  backstory: string; // AI-generated relationship history
  communication_style: string; // How they communicate
  dynamics: {
    initiation_balance: number; // Who initiates conversations (0=all them, 1=all me)
    avg_response_time_hours: number;
    typical_conversation_length: number; // avg messages per volley
  };
  overall_warmth: number; // Average warmth across all volleys
  overall_sentiment: number; // Average sentiment
}

// ===================================================================
// STATISTICS TYPES
// ===================================================================

/**
 * Streak information
 */
export interface StreakInfo {
  current_streak_days: number;
  longest_streak_days: number;
  streak_broken_date?: Date;
  is_active: boolean;
  last_message_date: Date;
}

/**
 * Response time statistics
 */
export interface ResponseTimeStats {
  avg_hours: number;
  median_hours: number;
  fastest_hours: number;
  slowest_hours: number;
}

/**
 * Reciprocity statistics
 */
export interface ReciprocityStats {
  initiation_balance: number; // 0=all them, 1=all me, 0.5=balanced
  message_balance: number; // Same scale for message counts
  avg_turn_length_me: number;
  avg_turn_length_them: number;
}

export interface ChurnMetrics {
  recency_days: number;
  recent_window_days: number;
  recent_volley_count: number;
  historical_volley_count: number;
  historical_volley_rate: number;
  recent_volley_rate: number;
  frequency_ratio: number;
  historical_avg_turns: number;
  recent_avg_turns: number;
  value_ratio: number;
  churn_risk_score: number;
  total_days_of_history: number;
  historical_avg_gap_days: number; // Average gap between volleys in days
}

export interface ResponsivenessScore {
  contact_id: number;
  score: number; // 0-1
  mean_response_ms: number;
  z_score: number;
  sample_count: number;
}

// ===================================================================
// AI/LLM TYPES
// ===================================================================

/**
 * Chatbot response
 */
export interface ChatbotResponse {
  message: string;
  context_used: boolean; // Whether volleys were used for context
  confidence: number; // 0-1
}

// ===================================================================
// HEALTH SCORING TYPES
// ===================================================================

export type ConnectionState = 'thriving' | 'stable' | 'cooling' | 'at_risk' | 'dormant';

/**
 * Relationship health score
 */
export interface HealthScore {
  contact_id: number;
  overall_score: number; // 0-100
  connection_state: ConnectionState;
  warmth_score: number;
  engagement_score: number;
  recency_score: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ===================================================================
// RELATIONSHIP ANALYSIS TYPES
// ===================================================================

export interface RecentExample {
  date: string;
  description: string;
}

export interface ImprovementsAndGrowth {
  focus_areas: string[];
  keep_it_going: string;
}

export interface MissedCue {
  date: string;
  cue: string;
}

export interface FunMoment {
  date: string;
  description: string;
}

/**
 * Deep relationship analysis result
 *
 * Comprehensive analysis of a full chat history providing insights
 * about relationship health, interaction patterns, and growth opportunities
 */
export interface RelationshipAnalysis {
  relationship_strength_score: number; // 0-5
  relationship_type: string; // e.g., "work buddies", "close friends", etc.
  score_justification: string;
  summary: string[]; // relationship lore: roles, shared threads, recurring topics
  recent_examples?: RecentExample[];
  improvement_shift_status?: string; // e.g., "improving", "stable", "declining"
  interaction_type?: string; // e.g., "supportive", "casual", "professional"
  improvements_and_growth?: ImprovementsAndGrowth;
  missed_cues?: MissedCue[];
  facets_of_life_shared?: string[]; // e.g., ["work", "hobbies", "family"]
  fun_moments?: FunMoment[];
  extra_points?: string[]; // Notable observations
}

// ===================================================================
// RESPONSE SUGGESTION TYPES
// ===================================================================

export interface ResponseBranch {
  type: string; // e.g., "direct_thoughtful", "playful_redirect", "deep_reciprocal"
  rationale: string;
  messages: string[]; // 1-3 WhatsApp-style message bubbles
  tone_match_confidence: number; // 0-1
}

export interface UnreadMessage {
  text: string;
  from_me: boolean;
  sent_at: string;
  hours_ago: number;
}

export interface ResponseSuggestionsResult {
  contact_id: number;
  contact_name: string;
  branches: ResponseBranch[];
  unread_messages: UnreadMessage[];
  context_used: {
    relationship_loaded: boolean;
    swapped_history_count: number;
    style_bank_count: number;
  };
}
