/**
 * Daily General Quest Generator
 *
 * Generates daily quests based on quest guidelines
 */

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/genai';
import {
  Quest,
  QuestGuidelines,
} from '../../types';

const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
].map((v) => ({
  category: v,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

interface GenerateDailyQuestsParams {
  guidelines: QuestGuidelines;
  date: Date;
  apiKey: string;
  count?: number; // Number of daily quests to generate (default: 3)
}

/**
 * Create prompt for daily quest generation
 */
function createDailyQuestPrompt(guidelines: QuestGuidelines, date: Date, count: number): string {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are generating daily general quests for a relationship gamification system.

**Date:** ${dateStr}

**Grand Quest (User's Overall Goal):**
${guidelines.grandQuest}

**Daily Quest Creation Rules:**
${guidelines.dailyQuestCreationRules}

**Message Scoring Guidelines (for reference):**
${guidelines.messageScoringGuidelines}

---

Generate ${count} daily general quests for today. These quests should:
- Align with the user's grand quest and overall goal
- Be achievable within a single day
- Have clear, measurable completion criteria
- Include detailed scoring specifications (remember: a simple AI model will check each message)
- Be varied (don't generate duplicate or very similar quests)

For each quest, provide:
- **id**: Unique identifier (e.g., "daily_gen_20250120_1")
- **type**: Must be "daily_general"
- **title**: Short, engaging quest title
- **description**: Clear description of what the user needs to do
- **scoringSpec**: Detailed scoring specification including:
  - description: How this quest should be scored
  - checkPrompt: Ultra-simple prompt for gemini-flash (yes/no check per message)
  - completionCriteria: What constitutes 100% completion
  - pointValue: Points awarded (typically 20-50 for daily quests)
  - partialCreditAllowed: Whether partial completion is possible
- **createdAt**: "${new Date().toISOString()}"
- **expiresAt**: End of today (23:59:59)
- **status**: "active"
- **progress**: 0
- **pointsEarned**: 0
- **messagesContributed**: []

Return a JSON object with a "quests" array containing ${count} quest objects.`;
}

/**
 * Generate daily general quests
 */
export async function generateDailyQuests(params: GenerateDailyQuestsParams): Promise<Quest[]> {
  const { guidelines, date, apiKey, count = 3 } = params;

  // Create prompt
  const prompt = createDailyQuestPrompt(guidelines, date, count);

  // Call Gemini API with structured output
  const genAI = new GoogleGenAI({ apiKey });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          quests: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['daily_general', 'weekly_general', 'vip_daily', 'vip_weekly', 'special_moment', 'alternate'] },
                title: { type: 'string' },
                description: { type: 'string' },
                scoringSpec: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    checkPrompt: { type: 'string' },
                    completionCriteria: { type: 'string' },
                    pointValue: { type: 'number' },
                    partialCreditAllowed: { type: 'boolean' }
                  },
                  required: ['description', 'checkPrompt', 'completionCriteria', 'pointValue', 'partialCreditAllowed']
                },
                vipContactId: { type: 'number' },
                createdAt: { type: 'string' },
                expiresAt: { type: 'string' },
                status: { type: 'string', enum: ['active', 'completed', 'expired', 'failed'] },
                progress: { type: 'number', minimum: 0, maximum: 1 },
                pointsEarned: { type: 'number' },
                messagesContributed: { type: 'array', items: { type: 'string' } },
                completedAt: { type: 'string' }
              },
              required: ['id', 'type', 'title', 'description', 'scoringSpec', 'createdAt', 'expiresAt', 'status', 'progress', 'pointsEarned', 'messagesContributed']
            }
          }
        },
        required: ['quests']
      },
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse response
  const parsed = JSON.parse(text);

  return parsed.quests as Quest[];
}
