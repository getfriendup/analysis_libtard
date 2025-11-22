/**
 * Initial Onboarding Analysis
 *
 * Analyzes abstract goal + recent messages to:
 * 1. Suggest VIPs (max 5)
 * 2. Generate follow-up questions for clarity
 */

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/genai';
import { InitialAnalysisResult, InitialAnalysisResultSchema } from '../types';
import { Message, Contact } from '../../statistical/types';

const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
].map((v) => ({
  category: v,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

interface AnalyzeParams {
  abstractGoal: string;
  messages: Message[];
  contacts: Contact[];
  userId: number;
  apiKey: string;
}

/**
 * Format messages for analysis
 */
function formatMessagesForAnalysis(
  messages: Message[],
  contacts: Contact[],
  userId: number
): string {
  // Group messages by contact
  const messagesByContact = messages.reduce((acc, msg) => {
    const contactId = msg.from_id === userId ? msg.chat_id : msg.from_id;
    if (!acc[contactId]) {
      acc[contactId] = [];
    }
    acc[contactId].push(msg);
    return acc;
  }, {} as Record<number, Message[]>);

  // Create contact summaries
  const contactSummaries = Object.entries(messagesByContact).map(([contactIdStr, msgs]) => {
    const contactId = parseInt(contactIdStr);
    const contact = contacts.find(c => c.ID === contactId);
    const contactName = contact?.name || `Contact ${contactId}`;

    const messageCount = msgs.length;
    const userSent = msgs.filter(m => m.from_id === userId).length;
    const contactSent = msgs.filter(m => m.from_id !== userId).length;

    // Sample some messages
    const sampleMessages = msgs
      .slice(-10) // Last 10 messages
      .map(m => {
        const sender = m.from_id === userId ? 'You' : contactName;
        const timestamp = new Date(m.sent_at).toLocaleDateString();
        return `[${timestamp}] ${sender}: ${m.content}`;
      })
      .join('\n');

    return {
      contactId,
      contactName,
      messageCount,
      userSent,
      contactSent,
      sampleMessages,
    };
  });

  // Sort by message count descending
  contactSummaries.sort((a, b) => b.messageCount - a.messageCount);

  // Format output
  let output = `Total unique contacts: ${contactSummaries.length}\n\n`;

  contactSummaries.forEach(summary => {
    output += `--- ${summary.contactName} (Contact ID: ${summary.contactId}) ---\n`;
    output += `Total messages: ${summary.messageCount} (You sent: ${summary.userSent}, They sent: ${summary.contactSent})\n`;
    output += `Sample recent messages:\n${summary.sampleMessages}\n\n`;
  });

  return output;
}

/**
 * Create prompt for initial analysis
 */
function createInitialAnalysisPrompt(abstractGoal: string, messagesContext: string): string {
  return `You are helping a user set up a relationship gamification system. The user has provided an abstract goal and their messaging history from the last 2 months.

**User's Abstract Goal:**
"${abstractGoal}"

**Messaging History (Last 2 Months):**
${messagesContext}

---

Your task is to analyze this information and provide:

1. **VIP Suggestions (max 5)**: Identify the most important people in the user's messaging history based on:
   - Message frequency and recency
   - Balance of communication (reciprocity)
   - Apparent importance from conversation content
   - Relevance to the user's abstract goal

   For each VIP, suggest a personal goal that aligns with both the overall abstract goal and the specific relationship dynamics you observe.

2. **Follow-Up Questions (3-5 questions)**: Generate questions to clarify the user's abstract goal and help you better understand what they want to achieve. These questions should:
   - Help clarify ambiguous aspects of the goal
   - Understand their priorities (e.g., depth vs breadth of connections)
   - Identify specific behaviors or patterns they want to change
   - Understand their relationship with specific people if relevant

**IMPORTANT**: Return your response as a JSON object matching this exact structure:

\`\`\`json
{
  "vipSuggestions": [
    {
      "contactId": 123,
      "name": "John Doe",
      "reasoning": "Most frequent contact with balanced communication and deep personal conversations",
      "suggestedPersonalGoal": "Maintain consistent weekly check-ins and share life updates"
    }
  ],
  "followUpQuestions": [
    {
      "id": "q1",
      "question": "When you say 'healthier connection', what does that mean to you?",
      "context": "This helps us understand your definition of a healthy relationship"
    }
  ]
}
\`\`\`

Return ONLY the JSON object, no other text.`;
}

/**
 * Perform initial analysis to suggest VIPs and generate questions
 */
export async function performInitialAnalysis(params: AnalyzeParams): Promise<InitialAnalysisResult> {
  const { abstractGoal, messages, contacts, userId, apiKey } = params;

  // Format messages for context
  const messagesContext = formatMessagesForAnalysis(messages, contacts, userId);

  // Create prompt
  const prompt = createInitialAnalysisPrompt(abstractGoal, messagesContext);

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
          vipSuggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                contactId: { type: 'number' },
                name: { type: 'string' },
                reasoning: { type: 'string' },
                suggestedPersonalGoal: { type: 'string' }
              },
              required: ['contactId', 'name', 'reasoning', 'suggestedPersonalGoal']
            },
            maxItems: 5
          },
          followUpQuestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                question: { type: 'string' },
                context: { type: 'string' }
              },
              required: ['id', 'question']
            }
          }
        },
        required: ['vipSuggestions', 'followUpQuestions']
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
  const validated = InitialAnalysisResultSchema.parse(parsed);

  return validated;
}
