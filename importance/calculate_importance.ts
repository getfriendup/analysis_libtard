import { getVolleys } from '../statistical/segmentation';
import { calculateChurnMetrics, calculateRelationshipLengthScore } from '../statistical/churn';
import { calculateResponsivenessScores } from '../statistical/responsiveness';
import { ResponsivenessScore } from '../statistical/types';
import {
  analyzeContactsImportanceBatch,
  ContactImportanceAIResult,
  ContactImportanceBatchResponse,
} from '../ai/contact_importance_analysis';
import { LLMCacheRN } from '../ai/cache';
import {
  ContactImportance,
  ContactImportanceComponents,
  ContactMessagesInput,
} from './types';

const DEFAULT_RESPONSIVENESS: ResponsivenessScore = {
  contact_id: -1,
  score: 0.5,
  mean_response_ms: 0,
  z_score: 0,
  sample_count: 0,
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const IMPORTANCE_WEIGHTS: ContactImportanceComponents = {
  message_volume: 0.2,
  warmth: 0.25,
  topic_diversity: 0.3,
  responsiveness: 0.15,
  relationship_length: 0.1,
};

export interface CalculateImportanceParams {
  contacts: ContactMessagesInput[];
  userId: number;
  apiKey: string;
  cache?: LLMCacheRN<ContactImportanceBatchResponse>;
  timeframeDays?: number;
}

const computeMessageVolume = (count: number, maxCount: number) => {
  if (!count || !maxCount) {
    return 0;
  }
  return Math.log(count + 1) / Math.log(maxCount + 1);
};

const computeImportanceScore = (
  components: ContactImportanceComponents
): number => {
  return clamp(
    components.message_volume * IMPORTANCE_WEIGHTS.message_volume +
      components.warmth * IMPORTANCE_WEIGHTS.warmth +
      components.topic_diversity * IMPORTANCE_WEIGHTS.topic_diversity +
      components.responsiveness * IMPORTANCE_WEIGHTS.responsiveness +
      components.relationship_length * IMPORTANCE_WEIGHTS.relationship_length
  );
};

const buildComponents = (
  messageVolume: number,
  ai: ContactImportanceAIResult,
  responsiveness: ResponsivenessScore,
  relationshipLength: number
): ContactImportanceComponents => ({
  message_volume: messageVolume,
  warmth: ai.warmth_score,
  topic_diversity: ai.topic_diversity_score,
  responsiveness: responsiveness.score,
  relationship_length: relationshipLength,
});

const fallbackResponsiveness = (contactId: number): ResponsivenessScore => ({
  ...DEFAULT_RESPONSIVENESS,
  contact_id: contactId,
});

const buildEmptyAIResult = (
  contactId: number,
  contactName: string,
  contentHash: string,
  timeframeDays: number | undefined
): ContactImportanceAIResult => ({
  contact_id: contactId,
  contact_name: contactName,
  importance_score: 0,
  warmth_score: 0,
  topic_diversity_score: 0,
  raw_importance_out_of_5: 0,
  raw_warmth_out_of_5: 0,
  raw_topic_diversity_out_of_5: 0,
  topics: [],
  analyzed_at: new Date().toISOString(),
  timeframe_days: timeframeDays,
  content_hash: contentHash,
});

export async function calculateAllContactsImportance(
  params: CalculateImportanceParams
): Promise<ContactImportance[]> {
  const { contacts, userId, apiKey, cache, timeframeDays } = params;

  if (!contacts.length) {
    return [];
  }

  const maxMessageCount = Math.max(
    ...contacts.map((contact) => contact.messages.length),
    1
  );

  const responsivenessResult = calculateResponsivenessScores({
    contacts: contacts.map(({ contactId, messages }) => ({
      contactId,
      messages,
    })),
    userId,
    timeframeDays,
  });

  const responsivenessScores = responsivenessResult.scores;

  const aiBatch = await analyzeContactsImportanceBatch({
    contacts: contacts.map(({ contactId, contactName, messages }) => ({
      contactId,
      contactName,
      messages,
    })),
    userId,
    apiKey,
    cache,
    timeframeDays,
  });

  const aiResults = aiBatch.contacts;
  const globalInsights = aiBatch.globalInsights;

  const results: ContactImportance[] = [];
  for (const contact of contacts) {
    const messageCount = contact.messages.length;
    const messageVolumeScore = computeMessageVolume(messageCount, maxMessageCount);

    const volleys = getVolleys(contact.messages);
    const churnMetrics = calculateChurnMetrics(volleys);
    const relationshipLengthScore = calculateRelationshipLengthScore(churnMetrics);

    const aiResult =
      aiResults.get(contact.contactId) ||
      buildEmptyAIResult(
        contact.contactId,
        contact.contactName,
        aiBatch.contentHash,
        timeframeDays
      );

    const responsiveness =
      responsivenessScores.get(contact.contactId) ||
      fallbackResponsiveness(contact.contactId);

    const components = buildComponents(
      messageVolumeScore,
      aiResult,
      responsiveness,
      relationshipLengthScore
    );

    const importanceScore = computeImportanceScore(components);
    const churnAdjusted =
      importanceScore * (1 - clamp(churnMetrics.churn_risk_score, 0, 1));

    results.push({
      contact_id: contact.contactId,
      contact_name: contact.contactName,
      importance_score: importanceScore,
      churn_adjusted_importance: churnAdjusted,
      components,
      churn_metrics: churnMetrics,
      responsiveness,
      ai: aiResult,
      global_insights: globalInsights,
    });
  }

  return results.sort(
    (a, b) => b.churn_adjusted_importance - a.churn_adjusted_importance
  );
}
