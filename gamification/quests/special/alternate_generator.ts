/**
 * Alternate Quest Generator
 *
 * Generates special quests based on detected special moments
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
  SpecialMoment,
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

interface GenerateAlternateQuestParams {
  specialMoment: SpecialMoment;
  guidelines: QuestGuidelines;
  apiKey: string;
}

const AlternateQuestResponseSchema = z.object({
  quest: QuestSchema,
});

/**
 * Create prompt for alternate quest generation
 */
function createAlternateQuestPrompt(
  moment: SpecialMoment,
  guidelines: QuestGuidelines
): string {
  // Set quest duration based on moment type
  // Most special moments should have shorter, more urgent timeframes
  const hoursUntilExpiry = moment.type === 'long_absence' || moment.type === 'conflict' ? 24 : 48;
  const expiresAt = new Date(Date.now() + hoursUntilExpiry * 60 * 60 * 1000).toISOString();

  return `You are generating a special alternate quest for a relationship gamification system based on a detected special moment.

**Special Moment Detected:**
- Type: ${moment.type}
- Context: ${moment.context}
${moment.contactId ? `- Contact ID: ${moment.contactId}` : ''}

**Suggested Quest:**
- Title: ${moment.suggestedQuestTitle}
- Description: ${moment.suggestedQuestDescription}

**User's Grand Quest:**
${guidelines.grandQuest}

**Message Scoring Guidelines:**
${guidelines.messageScoringGuidelines}

---

Create a special alternate quest for this moment. This quest should:
- Be timely and urgent (expires in ${hoursUntilExpiry} hours)
- Address the special moment directly
- Encourage meaningful action or response
- Have clear, measurable completion criteria
- Include detailed scoring specifications

Special moment quests are typically:
- **Time-sensitive** - Should be completed soon
- **High-impact** - Reward meaningful responses to important moments
- **Contextual** - Tailored to the specific situation

Provide:
- **id**: Unique identifier (e.g., "special_${moment.type}_${Date.now()}")
- **type**: Must be "special_moment"
- **title**: Engaging quest title (can use the suggested title or improve it)
- **description**: Clear description of what the user needs to do
- **scoringSpec**: Detailed scoring specification including:
  - description: How this quest should be scored
  - checkPrompt: Ultra-simple prompt for gemini-flash (yes/no check per message)
  - completionCriteria: What constitutes 100% completion
  - pointValue: Points awarded (typically 50-100 for special moments)
  - partialCreditAllowed: Usually false for special moments (all or nothing)
${moment.contactId ? `- **vipContactId**: ${moment.contactId}` : ''}
- **createdAt**: "${new Date().toISOString()}"
- **expiresAt**: "${expiresAt}"
- **status**: "active"
- **progress**: 0
- **pointsEarned**: 0
- **messagesContributed**: []

Return a JSON object with a single "quest" object.`;
}

/**
 * Generate an alternate quest for a special moment
 */
export async function generateAlternateQuest(
  params: GenerateAlternateQuestParams
): Promise<Quest> {
  const { specialMoment, guidelines, apiKey } = params;

  // Create prompt
  const prompt = createAlternateQuestPrompt(specialMoment, guidelines);

  // Call Gemini API with structured output
  const genAI = new GoogleGenAI({ apiKey });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
      responseSchema: AlternateQuestResponseSchema,
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse and validate
  const parsed = JSON.parse(text);
  const validated = AlternateQuestResponseSchema.parse(parsed);

  return validated.quest;
}

/**
 * Generate alternate quests for multiple special moments
 */
export async function generateAlternateQuests(
  moments: SpecialMoment[],
  guidelines: QuestGuidelines,
  apiKey: string
): Promise<Quest[]> {
  const quests: Quest[] = [];

  for (const moment of moments) {
    try {
      const quest = await generateAlternateQuest({
        specialMoment: moment,
        guidelines,
        apiKey,
      });
      quests.push(quest);
    } catch (error) {
      console.error(`[alternate_generator] Failed to generate quest for moment ${moment.id}:`, error);
      // Continue with other moments
    }
  }

  return quests;
}
