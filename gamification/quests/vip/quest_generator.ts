/**
 * VIP Quest Generator
 *
 * Generates quests for specific VIP people using both:
 * - General abstract goal
 * - Person-specific goal
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
  QuestSchema,
  VIPQuestGuidelines,
  AbstractGoal,
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

interface GenerateVIPQuestsParams {
  vipGuidelines: VIPQuestGuidelines;
  abstractGoal: AbstractGoal;
  date: Date;
  apiKey: string;
  questType: 'daily' | 'weekly';
  count?: number; // Number of quests to generate (default: 1)
}

const VIPQuestsResponseSchema = z.object({
  quests: z.array(QuestSchema),
});

/**
 * Create prompt for VIP quest generation
 */
function createVIPQuestPrompt(
  vipGuidelines: VIPQuestGuidelines,
  abstractGoal: AbstractGoal,
  date: Date,
  questType: 'daily' | 'weekly',
  count: number
): string {
  const isDaily = questType === 'daily';

  const timeframe = isDaily
    ? `Daily quest for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
    : `Weekly quest for the week of ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  const expiresAt = isDaily
    ? (() => {
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay.toISOString();
      })()
    : (() => {
        const endOfWeek = new Date(date);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return endOfWeek.toISOString();
      })();

  const pointRange = isDaily ? '15-40' : '80-150';
  const questTypeEnum = isDaily ? 'vip_daily' : 'vip_weekly';

  return `You are generating ${questType} VIP-specific quests for a relationship gamification system.

**${timeframe}**

**VIP Person:** ${vipGuidelines.name} (Contact ID: ${vipGuidelines.contactId})

**User's General Abstract Goal:**
"${abstractGoal.goal}"

**Personal Context for This VIP:**
${vipGuidelines.personalContext}

**VIP Quest Creation Rules:**
${vipGuidelines.questCreationRules}

**VIP Scoring Guidelines:**
${vipGuidelines.scoringGuidelines}

---

Generate ${count} ${questType} VIP quest(s) for ${vipGuidelines.name}. These quests should:
- Combine the user's general abstract goal with the person-specific goal for this VIP
- Be focused specifically on interactions with ${vipGuidelines.name}
- ${isDaily ? 'Be achievable within a single day' : 'Be achievable within the week but require sustained effort'}
- Have clear, measurable completion criteria
- Include detailed scoring specifications (remember: a simple AI model will check each message with this person)

For ${isDaily ? 'daily' : 'weekly'} VIP quests, focus on:
${
  isDaily
    ? `- Specific interactions or conversations with ${vipGuidelines.name}
- Quality of communication (depth, warmth, reciprocity)
- Initiating or responding promptly
- Sharing or asking meaningful questions`
    : `- Sustained engagement throughout the week
- Building connection or deepening the relationship
- Consistency in communication
- Progress toward the personal goal for this VIP`
}

For each quest, provide:
- **id**: Unique identifier (e.g., "vip_${isDaily ? 'daily' : 'weekly'}_${vipGuidelines.contactId}_${date.toISOString().split('T')[0].replace(/-/g, '')}_1")
- **type**: Must be "${questTypeEnum}"
- **title**: Short, engaging quest title specific to ${vipGuidelines.name}
- **description**: Clear description of what the user needs to do with this person
- **scoringSpec**: Detailed scoring specification including:
  - description: How this quest should be scored
  - checkPrompt: Ultra-simple prompt for gemini-flash (yes/no check per message with ${vipGuidelines.name})
  - completionCriteria: What constitutes 100% completion
  - pointValue: Points awarded (typically ${pointRange} for ${questType} VIP quests)
  - partialCreditAllowed: ${isDaily ? 'false or true depending on quest' : 'true (gradual progress)'}
- **vipContactId**: ${vipGuidelines.contactId}
- **createdAt**: "${new Date().toISOString()}"
- **expiresAt**: "${expiresAt}"
- **status**: "active"
- **progress**: 0
- **pointsEarned**: 0
- **messagesContributed**: []

Return a JSON object with a "quests" array containing ${count} quest object(s).`;
}

/**
 * Generate VIP quests for a specific person
 */
export async function generateVIPQuests(params: GenerateVIPQuestsParams): Promise<Quest[]> {
  const { vipGuidelines, abstractGoal, date, apiKey, questType, count = 1 } = params;

  // Create prompt
  const prompt = createVIPQuestPrompt(vipGuidelines, abstractGoal, date, questType, count);

  // Call Gemini API with structured output
  const genAI = new GoogleGenAI({ apiKey });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
      responseSchema: VIPQuestsResponseSchema,
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse and validate
  const parsed = JSON.parse(text);
  const validated = VIPQuestsResponseSchema.parse(parsed);

  return validated.quests;
}
