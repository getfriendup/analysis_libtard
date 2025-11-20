/**
 * Relationship Analysis
 *
 * Analyzes full chat history to provide comprehensive relationship insights
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message, RelationshipAnalysis } from '../statistical/types';
import { RELATIONSHIP_ANALYSIS_PROMPT } from './prompts';

/**
 * JSON Schema for Gemini structured output
 */
const RELATIONSHIP_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    relationship_analysis: {
      type: "object",
      properties: {
        relationship_strength_score: {
          type: "number",
          format: "float",
          minimum: 0,
          maximum: 5
        },
        relationship_type: {
          type: "string"
        },
        score_justification: {
          type: "string"
        },
        recent_examples: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              description: { type: "string" }
            },
            required: ["date", "description"]
          }
        },
        improvement_shift_status: {
          type: "string"
        },
        interaction_type: {
          type: "string"
        },
        improvements_and_growth: {
          type: "object",
          properties: {
            focus_areas: {
              type: "array",
              items: { type: "string" }
            },
            keep_it_going: {
              type: "string"
            }
          },
          required: ["focus_areas", "keep_it_going"]
        },
        missed_cues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              cue: { type: "string" }
            },
            required: ["date", "cue"]
          }
        },
        facets_of_life_shared: {
          type: "array",
          items: { type: "string" }
        },
        fun_moments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              description: { type: "string" }
            },
            required: ["date", "description"]
          }
        },
        extra_points: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: [
        "relationship_strength_score",
        "relationship_type",
        "score_justification"
      ]
    }
  },
  required: ["relationship_analysis"]
};

/**
 * Format messages as plain text transcript
 */
function formatTranscript(
  messages: Message[],
  userId: number,
  contactName: string
): string {
  // Sort by timestamp
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  );

  const lines: string[] = [];

  for (const msg of sorted) {
    const content = msg.content || '';

    // Determine sender
    const isFromUser = msg.from_id === userId;
    const sender = isFromUser ? 'You' : contactName;

    // Format timestamp
    const date = new Date(msg.sent_at);
    const timestamp = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = date.toTimeString().slice(0, 5); // HH:MM

    // Detect special message types
    let displayContent = content;
    if (content.includes('[sticker]') || content.toLowerCase().includes('sticker')) {
      displayContent = '[sticker]';
    } else if (content.includes('[voice') || content.toLowerCase().includes('voice message')) {
      displayContent = '[voice message]';
    } else if (content.includes('[image]') || content.toLowerCase().includes('image')) {
      displayContent = '[image]';
    } else if (content.includes('[video]') || content.toLowerCase().includes('video')) {
      displayContent = '[video]';
    }

    lines.push(`[${timestamp} ${time}] ${sender}: ${displayContent}`);
  }

  return lines.join('\n');
}

/**
 * Analyze relationship based on full chat history
 *
 * @param messages - All messages in the chat
 * @param userId - The current user's ID
 * @param contactName - Name of the contact
 * @param apiKey - Gemini API key
 * @returns Comprehensive relationship analysis
 */
export async function analyzeRelationship(
  messages: Message[],
  userId: number,
  contactName: string,
  apiKey: string
): Promise<RelationshipAnalysis> {
  if (messages.length === 0) {
    throw new Error('No messages found for this chat');
  }

  // Format transcript
  const transcript = formatTranscript(messages, userId, contactName);

  // Call Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RELATIONSHIP_ANALYSIS_SCHEMA as any,
    },
  });

  const prompt = `${RELATIONSHIP_ANALYSIS_PROMPT}\n\nHere is the chat transcript:\n\n${transcript}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Parse response
  const parsed = JSON.parse(text);
  return parsed.relationship_analysis;
}
