import { Message, ChurnMetrics, ResponsivenessScore } from '../statistical/types';
import { ContactImportanceAIResult } from '../ai/contact_importance_analysis';

export interface ContactMessagesInput {
  contactId: number;
  contactName: string;
  messages: Message[];
}

export interface ContactImportanceComponents {
  message_volume: number;
  warmth: number;
  topic_diversity: number;
  responsiveness: number;
  relationship_length: number;
}

export interface ContactImportance {
  contact_id: number;
  contact_name: string;
  importance_score: number;
  churn_adjusted_importance: number;
  components: ContactImportanceComponents;
  churn_metrics: ChurnMetrics;
  responsiveness: ResponsivenessScore;
  ai: ContactImportanceAIResult;
  global_insights?: string[];
}


