/**
 * Message Scorer
 *
 * Runs on every sent/received message to check if it contributes to active quests
 * Uses gemini-flash with ultra-simple prompts for fast, cheap scoring
 */

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/genai';
import { z } from 'zod';
import {
  Quest,
  MessageScoreResult,
  QuestProgressUpdate,
  QuestStatus,
} from '../types';

const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
].map((v) => ({
  category: v,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

interface ScoreMessageParams {
  messageId: string;
  messageContent: string;
  fromId: number;
  toId: number;
  sentAt: string;
  userId: number; // Current user's ID
  activeQuests: Quest[];
  apiKey: string;
}

interface ScoreMessageResult {
  messageScores: MessageScoreResult[];
  questUpdates: QuestProgressUpdate[];
}

/**
 * Score a single message against a single quest
 */
async function scoreMessageForQuest(
  messageId: string,
  messageContent: string,
  fromId: number,
  toId: number,
  userId: number,
  quest: Quest,
  apiKey: string
): Promise<MessageScoreResult | null> {
  // Check if this message is relevant to the quest
  // For VIP quests, only score messages to/from that VIP
  if (quest.vipContactId !== undefined) {
    const contactId = fromId === userId ? toId : fromId;
    if (contactId !== quest.vipContactId) {
      // Message not relevant to this VIP quest
      return null;
    }
  }

  // Build simple yes/no prompt from the quest's scoring spec
  const sender = fromId === userId ? 'You' : 'Them';
  const prompt = `Message from ${sender}: "${messageContent}"

Quest: ${quest.title}
Description: ${quest.description}

Scoring Check: ${quest.scoringSpec.checkPrompt}

Does this message contribute to completing this quest? Answer with yes or no, and briefly explain why.

If yes, estimate how much this message contributes to the quest completion (0.0 to 1.0, where 1.0 = fully completes the quest).`;

  // Use schema for structured yes/no response
  const ResponseSchema = z.object({
    contributes: z.boolean(),
    contribution: z.number().min(0).max(1),
    reasoning: z.string(),
  });

  // Call Gemini Flash with structured output
  const genAI = new GoogleGenAI({ apiKey });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          contributes: { type: 'boolean' },
          contribution: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' }
        },
        required: ['contributes', 'contribution', 'reasoning']
      },
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    console.warn('[message_scorer] Empty response from AI');
    return null;
  }

  // Parse response
  const parsed = JSON.parse(text);
  const { contributes, contribution, reasoning } = ResponseSchema.parse(parsed);

  if (!contributes || contribution === 0) {
    return null; // Message doesn't contribute
  }

  // Calculate points awarded based on contribution
  const pointsAwarded = quest.scoringSpec.partialCreditAllowed
    ? Math.round(quest.scoringSpec.pointValue * contribution)
    : contribution >= 1.0
    ? quest.scoringSpec.pointValue
    : 0;

  return {
    messageId,
    questId: quest.id,
    contributes,
    contribution,
    reasoning,
    pointsAwarded,
  };
}

/**
 * Score a message against all active quests
 */
export async function scoreMessage(params: ScoreMessageParams): Promise<ScoreMessageResult> {
  const { messageId, messageContent, fromId, toId, userId, activeQuests, apiKey } = params;

  const messageScores: MessageScoreResult[] = [];
  const questUpdates: QuestProgressUpdate[] = [];

  // Score against each active quest
  for (const quest of activeQuests) {
    if (quest.status !== QuestStatus.ACTIVE) {
      continue; // Skip non-active quests
    }

    try {
      const score = await scoreMessageForQuest(
        messageId,
        messageContent,
        fromId,
        toId,
        userId,
        quest,
        apiKey
      );

      if (score) {
        messageScores.push(score);

        // Calculate quest progress update
        const previousProgress = quest.progress;
        const previousStatus = quest.status;

        // Update progress
        const newProgress = Math.min(1.0, previousProgress + score.contribution);
        const newStatus = newProgress >= 1.0 ? QuestStatus.COMPLETED : QuestStatus.ACTIVE;

        // Track the update
        questUpdates.push({
          questId: quest.id,
          previousProgress,
          newProgress,
          previousStatus,
          newStatus,
          pointsAwarded: score.pointsAwarded,
        });
      }
    } catch (error) {
      console.error(`[message_scorer] Error scoring quest ${quest.id}:`, error);
      // Continue with other quests
    }
  }

  return {
    messageScores,
    questUpdates,
  };
}

/**
 * Batch score multiple messages (useful for initial setup or bulk processing)
 */
export async function scoreMessages(
  messages: Array<{
    messageId: string;
    messageContent: string;
    fromId: number;
    toId: number;
    sentAt: string;
  }>,
  userId: number,
  activeQuests: Quest[],
  apiKey: string
): Promise<ScoreMessageResult> {
  const allMessageScores: MessageScoreResult[] = [];
  const questProgressMap = new Map<string, { progress: number; points: number }>();

  // Initialize quest progress tracking
  for (const quest of activeQuests) {
    questProgressMap.set(quest.id, {
      progress: quest.progress,
      points: quest.pointsEarned,
    });
  }

  // Score each message
  for (const msg of messages) {
    const result = await scoreMessage({
      ...msg,
      userId,
      activeQuests,
      apiKey,
    });

    allMessageScores.push(...result.messageScores);

    // Update quest progress tracking
    for (const update of result.questUpdates) {
      questProgressMap.set(update.questId, {
        progress: update.newProgress,
        points: questProgressMap.get(update.questId)!.points + update.pointsAwarded,
      });
    }
  }

  // Calculate final quest updates
  const finalQuestUpdates: QuestProgressUpdate[] = [];
  for (const quest of activeQuests) {
    const tracked = questProgressMap.get(quest.id);
    if (tracked && (tracked.progress !== quest.progress || tracked.points !== quest.pointsEarned)) {
      finalQuestUpdates.push({
        questId: quest.id,
        previousProgress: quest.progress,
        newProgress: tracked.progress,
        previousStatus: quest.status,
        newStatus: tracked.progress >= 1.0 ? QuestStatus.COMPLETED : quest.status,
        pointsAwarded: tracked.points - quest.pointsEarned,
      });
    }
  }

  return {
    messageScores: allMessageScores,
    questUpdates: finalQuestUpdates,
  };
}
