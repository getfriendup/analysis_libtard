/**
 * Guidelines Generator
 *
 * Generates comprehensive quest system guidelines based on:
 * - Abstract goal
 * - User's answers to follow-up questions
 * - Confirmed VIPs with personal goals
 */

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/genai';
import {
  QuestGuidelines,
  QuestGuidelinesSchema,
  VIPQuestGuidelines,
  VIPQuestGuidelinesSchema,
  VIP,
  OnboardingAnswers,
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

interface GenerateGuidelinesParams {
  abstractGoal: string;
  onboardingAnswers: OnboardingAnswers;
  apiKey: string;
}

interface GenerateVIPGuidelinesParams {
  abstractGoal: string;
  vip: VIP;
  generalGuidelines: QuestGuidelines;
  apiKey: string;
}

/**
 * Format onboarding answers for prompt
 */
function formatOnboardingAnswers(answers: OnboardingAnswers): string {
  return Object.entries(answers)
    .map(([questionId, answer]) => `- ${questionId}: ${answer}`)
    .join('\n');
}

/**
 * Create prompt for general guidelines generation
 */
function createGuidelinesPrompt(abstractGoal: string, answers: OnboardingAnswers): string {
  const formattedAnswers = formatOnboardingAnswers(answers);

  return `You are creating a comprehensive quest system for relationship gamification. The user has an abstract goal and has answered some clarifying questions.

**Abstract Goal:**
"${abstractGoal}"

**User's Answers:**
${formattedAnswers}

---

Create comprehensive guidelines for the quest system. Your guidelines should be EXTREMELY DETAILED and SPECIFIC so that another AI model can use them to generate appropriate quests and score messages.

Generate the following:

1. **Grand Quest**: A clear, inspiring summary of the user's overarching goal. This should be 2-3 sentences that capture the essence of what they want to achieve.

2. **Health Calculation Formula**: Detailed instructions for how to calculate the user's daily "relationship health score" (0-100). This should include:
   - What metrics to consider (message frequency, reciprocity, warmth, depth, etc.)
   - How to weight different factors
   - How to handle edge cases

3. **Daily Quest Creation Rules**: Comprehensive rules for generating daily general quests. Include:
   - Types of daily quests that align with the goal
   - Difficulty progression
   - How to ensure variety
   - Examples of good daily quests
   - What to avoid

4. **Weekly Quest Creation Rules**: Comprehensive rules for generating weekly general quests. Include:
   - Types of weekly quests (bigger goals than daily)
   - How they differ from daily quests
   - Examples of good weekly quests
   - How to track progress over the week

5. **Message Scoring Guidelines**: ULTRA-SIMPLE guidelines for scoring messages. Remember, a very simple AI model will use these guidelines to check if each message contributes to quest completion. Include:
   - Clear yes/no criteria for different quest types
   - Simple patterns to look for
   - Keywords and sentiment indicators
   - Examples of messages that do/don't count

6. **Special Moment Triggers**: What constitutes a "special moment" that should trigger alternate quests? Include:
   - Types of special moments (birthdays, conflicts, long absences, breakthroughs, etc.)
   - How to detect them from message patterns
   - What kinds of alternate quests to create for each

**IMPORTANT**: Return your response as a JSON object matching this exact structure:

\`\`\`json
{
  "grandQuest": "Your grand quest summary here",
  "healthCalculationFormula": "Detailed formula and calculation instructions",
  "dailyQuestCreationRules": "Comprehensive rules for daily quest generation",
  "weeklyQuestCreationRules": "Comprehensive rules for weekly quest generation",
  "messageScoringGuidelines": "Ultra-simple guidelines for message scoring",
  "specialMomentTriggers": "Guidelines for detecting and responding to special moments",
  "generatedAt": "${new Date().toISOString()}"
}
\`\`\`

Be extremely detailed and specific. These guidelines will be used to generate all future quests and scoring, so they must be comprehensive.

Return ONLY the JSON object, no other text.`;
}

/**
 * Create prompt for VIP-specific guidelines
 */
function createVIPGuidelinesPrompt(
  abstractGoal: string,
  vip: VIP,
  generalGuidelines: QuestGuidelines
): string {
  return `You are creating VIP-specific quest guidelines for a relationship gamification system.

**Overall Abstract Goal:**
"${abstractGoal}"

**VIP Person:**
- Name: ${vip.name}
- Contact ID: ${vip.contactId}
- Personal Goal: "${vip.personalGoal}"

**General Quest Guidelines:**
${generalGuidelines.grandQuest}

---

Create VIP-specific quest guidelines that combine the overall abstract goal with this person's specific personal goal.

Generate the following:

1. **Quest Creation Rules**: Detailed rules for creating quests specific to this VIP. Include:
   - Types of quests that work for this relationship
   - How to balance the general goal with the personal goal for this person
   - Frequency and difficulty of VIP quests
   - Examples of good VIP quests for this person
   - What to avoid

2. **Scoring Guidelines**: How to score interactions with this VIP. Include:
   - What kinds of messages/interactions count as progress
   - Quality vs quantity considerations for this relationship
   - Specific patterns or behaviors to reward
   - Ultra-simple criteria for the scoring model to use

3. **Personal Context**: Any additional context about this relationship that should inform quest generation. Include:
   - The nature of this relationship (based on the personal goal)
   - What success looks like for this specific relationship
   - Any unique considerations

**IMPORTANT**: Return your response as a JSON object matching this exact structure:

\`\`\`json
{
  "contactId": ${vip.contactId},
  "name": "${vip.name}",
  "questCreationRules": "Detailed rules for creating VIP quests",
  "scoringGuidelines": "Ultra-simple guidelines for scoring interactions",
  "personalContext": "Context about this specific relationship",
  "generatedAt": "${new Date().toISOString()}"
}
\`\`\`

Be extremely detailed and specific. These guidelines will be used to generate all VIP-specific quests and scoring.

Return ONLY the JSON object, no other text.`;
}

/**
 * Generate general quest system guidelines
 */
export async function generateQuestGuidelines(
  params: GenerateGuidelinesParams
): Promise<QuestGuidelines> {
  const { abstractGoal, onboardingAnswers, apiKey } = params;

  // Create prompt
  const prompt = createGuidelinesPrompt(abstractGoal, onboardingAnswers);

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
          grandQuest: { type: 'string' },
          healthCalculationFormula: { type: 'string' },
          dailyQuestCreationRules: { type: 'string' },
          weeklyQuestCreationRules: { type: 'string' },
          messageScoringGuidelines: { type: 'string' },
          specialMomentTriggers: { type: 'string' },
          generatedAt: { type: 'string' }
        },
        required: ['grandQuest', 'healthCalculationFormula', 'dailyQuestCreationRules', 'weeklyQuestCreationRules', 'messageScoringGuidelines', 'specialMomentTriggers', 'generatedAt']
      },
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse and validate
  const parsed = JSON.parse(text);
  const validated = QuestGuidelinesSchema.parse(parsed);

  return validated;
}

/**
 * Generate VIP-specific quest guidelines
 */
export async function generateVIPGuidelines(
  params: GenerateVIPGuidelinesParams
): Promise<VIPQuestGuidelines> {
  const { abstractGoal, vip, generalGuidelines, apiKey } = params;

  // Create prompt
  const prompt = createVIPGuidelinesPrompt(abstractGoal, vip, generalGuidelines);

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
          contactId: { type: 'number' },
          name: { type: 'string' },
          questCreationRules: { type: 'string' },
          scoringGuidelines: { type: 'string' },
          personalContext: { type: 'string' },
          generatedAt: { type: 'string' }
        },
        required: ['contactId', 'name', 'questCreationRules', 'scoringGuidelines', 'personalContext', 'generatedAt']
      },
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse and validate
  const parsed = JSON.parse(text);
  const validated = VIPQuestGuidelinesSchema.parse(parsed);

  return validated;
}
