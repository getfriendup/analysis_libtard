/**
 * Weekly General Quest Generator
 *
 * Generates weekly quests based on quest guidelines
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

interface GenerateWeeklyQuestsParams {
  guidelines: QuestGuidelines;
  weekStartDate: Date;
  apiKey: string;
  count?: number; // Number of weekly quests to generate (default: 2)
}

const WeeklyQuestsResponseSchema = z.object({
  quests: z.array(QuestSchema),
});

/**
 * Create prompt for weekly quest generation
 */
function createWeeklyQuestPrompt(guidelines: QuestGuidelines, weekStartDate: Date, count: number): string {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const weekStartStr = weekStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const weekEndStr = weekEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `You are generating weekly general quests for a relationship gamification system.

**Week:** ${weekStartStr} - ${weekEndStr}

**Grand Quest (User's Overall Goal):**
${guidelines.grandQuest}

**Weekly Quest Creation Rules:**
${guidelines.weeklyQuestCreationRules}

**Message Scoring Guidelines (for reference):**
${guidelines.messageScoringGuidelines}

---

Generate ${count} weekly general quests for this week. These quests should:
- Align with the user's grand quest and overall goal
- Be larger, more ambitious goals than daily quests
- Be achievable within the week but require sustained effort
- Have clear, measurable completion criteria
- Include detailed scoring specifications (remember: a simple AI model will check each message)
- Be varied (don't generate duplicate or very similar quests)

Weekly quests often focus on:
- Cumulative goals (e.g., "Have 10 meaningful conversations this week")
- Relationship breadth (e.g., "Connect with 5 different people")
- Depth and quality (e.g., "Have 3 deep conversations where you share vulnerability")
- Consistency (e.g., "Message your top 3 people every day this week")

For each quest, provide:
- **id**: Unique identifier (e.g., "weekly_gen_20250120_1")
- **type**: Must be "weekly_general"
- **title**: Short, engaging quest title
- **description**: Clear description of what the user needs to do
- **scoringSpec**: Detailed scoring specification including:
  - description: How this quest should be scored
  - checkPrompt: Ultra-simple prompt for gemini-flash (yes/no check per message)
  - completionCriteria: What constitutes 100% completion
  - pointValue: Points awarded (typically 100-200 for weekly quests)
  - partialCreditAllowed: Usually true for weekly quests (gradual progress)
- **createdAt**: "${new Date().toISOString()}"
- **expiresAt**: End of the week (${weekEndDate.toISOString()})
- **status**: "active"
- **progress**: 0
- **pointsEarned**: 0
- **messagesContributed**: []

Return a JSON object with a "quests" array containing ${count} quest objects.`;
}

/**
 * Generate weekly general quests
 */
export async function generateWeeklyQuests(params: GenerateWeeklyQuestsParams): Promise<Quest[]> {
  const { guidelines, weekStartDate, apiKey, count = 2 } = params;

  // Create prompt
  const prompt = createWeeklyQuestPrompt(guidelines, weekStartDate, count);

  // Call Gemini API with structured output
  const genAI = new GoogleGenAI({ apiKey });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
      responseSchema: WeeklyQuestsResponseSchema,
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse and validate
  const parsed = JSON.parse(text);
  const validated = WeeklyQuestsResponseSchema.parse(parsed);

  return validated.quests;
}
