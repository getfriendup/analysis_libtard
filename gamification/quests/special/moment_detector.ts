/**
 * Special Moment Detector
 *
 * Detects special moments from message patterns that should trigger alternate quests
 * Examples: birthdays, long absences, conflicts, breakthroughs, etc.
 */

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/genai';
import { z } from 'zod';
import { SpecialMoment, SpecialMomentSchema, QuestGuidelines } from '../../types';
import { Message, Contact } from '../../../statistical/types';

const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
].map((v) => ({
  category: v,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

interface DetectSpecialMomentsParams {
  recentMessages: Message[];
  contacts: Contact[];
  userId: number;
  guidelines: QuestGuidelines;
  apiKey: string;
}

const SpecialMomentsResponseSchema = z.object({
  moments: z.array(SpecialMomentSchema),
});

/**
 * Format messages for moment detection
 */
function formatMessagesForDetection(
  messages: Message[],
  contacts: Contact[],
  userId: number
): string {
  // Group by contact and create summaries
  const messagesByContact = messages.reduce((acc, msg) => {
    const contactId = msg.from_id === userId ? msg.chat_id : msg.from_id;
    if (!acc[contactId]) {
      acc[contactId] = [];
    }
    acc[contactId].push(msg);
    return acc;
  }, {} as Record<number, Message[]>);

  let output = '';

  Object.entries(messagesByContact).forEach(([contactIdStr, msgs]) => {
    const contactId = parseInt(contactIdStr);
    const contact = contacts.find(c => c.ID === contactId);
    const contactName = contact?.name || `Contact ${contactId}`;

    output += `--- ${contactName} (ID: ${contactId}) ---\n`;
    output += `Message count: ${msgs.length}\n`;

    // Show recent messages
    msgs.slice(-5).forEach(msg => {
      const sender = msg.from_id === userId ? 'You' : contactName;
      const date = new Date(msg.sent_at).toLocaleDateString();
      output += `[${date}] ${sender}: ${msg.content}\n`;
    });

    output += '\n';
  });

  return output;
}

/**
 * Create prompt for special moment detection
 */
function createMomentDetectionPrompt(
  messagesContext: string,
  guidelines: QuestGuidelines
): string {
  return `You are detecting special moments in message history that should trigger alternate quests in a relationship gamification system.

**Recent Messages:**
${messagesContext}

**Special Moment Triggers (from user's quest guidelines):**
${guidelines.specialMomentTriggers}

---

Analyze the recent message history and detect any special moments that should trigger alternate quests.

Special moments can include:
- **Birthdays or anniversaries** - Someone mentioned their birthday or an important date
- **Long absence** - First message after a long period of no contact
- **Conflict resolution** - Signs of conflict or tension that need addressing
- **Major life events** - Someone shared big news (job, relationship, moving, etc.)
- **Breakthrough moments** - Particularly deep or vulnerable conversation
- **Plans being made** - Concrete plans to meet up or do something together
- **Patterns changing** - Noticeable shift in communication patterns

For each special moment detected, provide:
- **id**: Unique identifier (e.g., "moment_birthday_12345_20250120")
- **type**: Type of moment (e.g., "birthday", "long_absence", "conflict", "breakthrough", "life_event", "plans_made")
- **contactId**: The contact ID this moment relates to (if applicable, otherwise omit)
- **detectedAt**: Current timestamp "${new Date().toISOString()}"
- **context**: Brief description of what you detected and why it's significant
- **suggestedQuestTitle**: A suggested quest title for this moment
- **suggestedQuestDescription**: A suggested quest description

If no special moments are detected, return an empty moments array.

Return a JSON object with a "moments" array.`;
}

/**
 * Detect special moments from recent messages
 */
export async function detectSpecialMoments(
  params: DetectSpecialMomentsParams
): Promise<SpecialMoment[]> {
  const { recentMessages, contacts, userId, guidelines, apiKey } = params;

  // Format messages for detection
  const messagesContext = formatMessagesForDetection(recentMessages, contacts, userId);

  // Create prompt
  const prompt = createMomentDetectionPrompt(messagesContext, guidelines);

  // Call Gemini API with structured output
  const genAI = new GoogleGenAI({ apiKey });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
      responseSchema: SpecialMomentsResponseSchema,
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const text = result.text;

  if (!text) {
    return []; // No moments detected
  }

  // Parse and validate
  const parsed = JSON.parse(text);
  const validated = SpecialMomentsResponseSchema.parse(parsed);

  return validated.moments;
}
