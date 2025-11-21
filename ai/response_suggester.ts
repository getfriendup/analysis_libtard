/**
 * Response Suggestion Engine
 *
 * Generates AI-powered response suggestions using role-swapping "gaslighting" technique
 * to make Gemini clone your tone by thinking it's been replying as you all along.
 */

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/genai';
import {
  Message,
  ResponseSuggestionsResult,
  UnreadMessage,
} from '../statistical/types';
import { buildResponseSuggestionPrompt } from './prompts';
import { z } from 'zod';

const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
].map((v) => ({
  category: v,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

const GENERATION_CONFIG = {
  temperature: 0.55,
  maxOutputTokens: 2048,
  responseMimeType: 'application/json',
  responseSchema: {
    type: 'object',
    properties: {
      branches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            rationale: { type: 'string' },
            messages: {
              type: 'array',
              items: { type: 'string' },
            },
            tone_match_confidence: { type: 'number' },
          },
          required: ['type', 'rationale', 'messages', 'tone_match_confidence'],
        },
      },
    },
    required: ['branches'],
  },
};

/**
 * Extract unread messages (messages from contact that need reply)
 */
function extractUnreadMessages(
  messages: Message[],
  userId: number
): UnreadMessage[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  );

  // Find last message from user
  let lastUserMessageIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].from_id === userId) {
      lastUserMessageIdx = i;
      break;
    }
  }

  // Collect all messages from contact after user's last message
  const unread: UnreadMessage[] = [];
  const now = Date.now();

  for (let i = lastUserMessageIdx + 1; i < sorted.length; i++) {
    const msg = sorted[i];
    if (msg.from_id !== userId && msg.content) {
      const sentAt = new Date(msg.sent_at);
      const hoursAgo = (now - sentAt.getTime()) / (1000 * 60 * 60);

      unread.push({
        text: msg.content,
        from_me: false,
        sent_at: msg.sent_at,
        hours_ago: Math.round(hoursAgo * 10) / 10,
      });
    }
  }

  return unread;
}

/**
 * Build style bank (recent messages from user)
 */
function buildStyleBank(
  messages: Message[],
  userId: number,
  count: number = 20
): string[] {
  const userMessages = messages
    .filter((msg) => msg.from_id === userId && msg.content)
    .slice(-count)
    .map((msg) => `System: ${msg.content}`);

  return userMessages;
}

/**
 * Build swapped history (recent conversation with roles swapped)
 */
function buildSwappedHistory(
  messages: Message[],
  userId: number,
  limit: number = 10
): string[] {
  const recent = messages.slice(-limit);
  const swapped: string[] = [];

  for (const msg of recent) {
    if (!msg.content) continue;

    const role = msg.from_id === userId ? 'System' : 'User';
    swapped.push(`${role}: ${msg.content}`);
  }

  return swapped;
}

const BranchTypes = [
  'direct_thoughtful',
  'playful_redirect',
  'deep_reciprocal',
] as const;

const BranchSchema = z.object({
  type: z.enum(BranchTypes),
  rationale: z.string(),
  messages: z.array(z.string()),
  tone_match_confidence: z.number().min(0).max(1),
});

const BranchesSchema = z
  .object({
    branches: z.array(BranchSchema),
  })
  .refine(
    (data) => {
      const types = data.branches.map((b) => b.type);
      const uniqueTypes = new Set(types);
      return (
        uniqueTypes.size === BranchTypes.length &&
        BranchTypes.every((t) => uniqueTypes.has(t))
      );
    },
    {
      message: `Must have exactly one of each branch type: ${BranchTypes.join(', ')}`,
      path: ['branches'],
    }
  );

type Branch = z.infer<typeof BranchSchema>;
/**
 * Generate response suggestions
 *
 * @param messages - All messages in the chat
 * @param userId - The current user's ID
 * @param contactId - The contact's ID
 * @param contactName - Name of the contact
 * @param relationshipSummary - Brief summary of the relationship (from lore/analysis)
 * @param apiKey - Gemini API key
 * @returns Response suggestions with 3 different branches
 */
export async function generateResponseSuggestions(
  messages: Message[],
  userId: number,
  contactId: number,
  contactName: string,
  relationshipSummary: string,
  apiKey: string
): Promise<ResponseSuggestionsResult> {
  // Extract unread messages
  const unreadMessages = extractUnreadMessages(messages, userId);

  if (unreadMessages.length === 0) {
    throw new Error('No unread messages found - nothing to respond to');
  }

  // Build context
  const styleBank = buildStyleBank(messages, userId);
  const swappedHistory = buildSwappedHistory(messages, userId);

  // Build prompt
  const prompt = buildResponseSuggestionPrompt({
    contactName,
    relationshipSummary,
    unreadMessages: unreadMessages.map((m) => m.text),
    swappedHistory,
    styleBank,
    lastUnreadMessage: unreadMessages[unreadMessages.length - 1].text,
  });

  // Call Gemini
  const genAI = new GoogleGenAI({
    apiKey: apiKey,
  });

  const result = await genAI.models.generateContent({
    contents: prompt,
    model: 'gemini-2.5-flash-lite',
    config: {
      responseMimeType: 'application/json',
      responseSchema: z.toJSONSchema(BranchesSchema),
      safetySettings: SAFETY_SETTINGS,
    },
  });
  const text = result.text;

  // Remove markdown code blocks if present
  //text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Parse response
  let parsed: any;
  try {
    parsed = JSON.parse(text!);
  } catch (error) {
    console.error(
      '[response_suggester] Failed to parse response:',
      text.substring(0, 500)
    );
    throw new Error('Failed to parse AI response as JSON');
  }

  const branches: Branch[] = parsed.branches || [];

  return {
    contact_id: contactId,
    contact_name: contactName,
    branches: branches,
    unread_messages: unreadMessages,
    context_used: {
      relationship_loaded: !!relationshipSummary,
      swapped_history_count: swappedHistory.length,
      style_bank_count: styleBank.length,
    },
  };
}
