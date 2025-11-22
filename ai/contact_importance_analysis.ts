import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { sha256 } from 'js-sha256';
import { Message } from '../statistical/types';
import { LLMCacheRN } from './cache';

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const sanitizeResponseText = (text: string) =>
  text.replace(/```json|```/gi, '').trim();

const CONTACT_IMPORTANCE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    contacts: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          contact_id: {
            type: SchemaType.STRING,
            description: 'Contact ID (use the numeric ID as a string)',
          },
          contact_name: {
            type: SchemaType.STRING,
            description: 'Display name for the contact',
          },
          importance_out_of_5: {
            type: SchemaType.NUMBER,
            description: 'Overall importance score (0-5)',
          },
          warmth_out_of_5: {
            type: SchemaType.NUMBER,
            description: 'Warmth/closeness score (0-5)',
          },
          topic_diversity_out_of_5: {
            type: SchemaType.NUMBER,
            description: 'Topic diversity score (0-5)',
          },
          topics: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Key recurring topics in this relationship',
          },
        },
        required: [
          'contact_id',
          'contact_name',
          'importance_out_of_5',
          'warmth_out_of_5',
          'topic_diversity_out_of_5',
          'topics',
        ],
      },
    },
    global_insights: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Optional high-level insights comparing all contacts',
    },
  },
  required: ['contacts'],
} as const;

const formatTimestamp = (iso: string) => {
  const [date, timeWithMs] = iso.split('T');
  const time = timeWithMs?.substring(0, 5) ?? '00:00';
  return { date, time };
};

const buildTranscript = (
  messages: Message[],
  userId: number,
  contactName: string
) => {
  const grouped = new Map<string, string[]>();

  for (const message of messages) {
    const timestamp = new Date(message.sent_at).toISOString();
    const { date, time } = formatTimestamp(timestamp);
    const speaker = message.from_id === userId ? 'Me' : contactName || 'Them';
    const content = message.content || '[No content]';
    const line = `${time} - ${speaker}: ${content}`;

    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(line);
  }

  const orderedDates = Array.from(grouped.keys()).sort();
  const blocks = orderedDates.map(
    (date) => `Day ${date}\n${grouped.get(date)!.join('\n')}`
  );

  return blocks.join('\n\n');
};

export interface ContactForAIAnalysis {
  contactId: number;
  contactName: string;
  messages: Message[];
}

export interface ContactImportanceLLMResponse {
  contact_id: number | string;
  contact_name: string;
  importance_out_of_5: number;
  warmth_out_of_5: number;
  topic_diversity_out_of_5: number;
  topics: string[];
}

export interface ContactImportanceAIResult {
  contact_id: number;
  contact_name: string;
  importance_score: number;
  warmth_score: number;
  topic_diversity_score: number;
  raw_importance_out_of_5: number;
  raw_warmth_out_of_5: number;
  raw_topic_diversity_out_of_5: number;
  topics: string[];
  analyzed_at: string;
  timeframe_days: number | undefined;
  content_hash: string;
}

export interface ContactImportanceBatchParams {
  contacts: ContactForAIAnalysis[];
  userId: number;
  apiKey: string;
  cache?: LLMCacheRN<ContactImportanceBatchResponse>;
  timeframeDays?: number;
}

export interface ContactImportanceBatchResponse {
  contacts: ContactImportanceLLMResponse[];
  global_insights?: string[];
}

export interface ContactImportanceBatchResult {
  contacts: Map<number, ContactImportanceAIResult>;
  globalInsights: string[];
  contentHash: string;
  timeframeDays?: number;
}

const buildContactBlock = (contact: {
  contactId: number;
  contactName: string;
  transcript: string;
}) => {
  return `Contact ID: ${contact.contactId}
Contact Name: ${contact.contactName}
Conversation Transcript:
${contact.transcript}`;
};

const buildBatchPrompt = (
  contacts: Array<{ contactId: number; contactName: string; transcript: string }>,
  timeframeDays: number | undefined
) => {
  const header = `You are an expert relationship analyst. Analyze ALL of the following relationships between "Me" and each contact. Compare them relative to each other (warmth, breadth of topics, balance, recent energy).

Respond with STRICT JSON matching this schema:
{
  "contacts": [
    {
      "contact_id": number,
      "contact_name": string,
      "importance_out_of_5": number,
      "warmth_out_of_5": number,
      "topic_diversity_out_of_5": number,
      "topics": string[]
    }
  ],
  "global_insights": string[]
}

- Use the exact numeric contact IDs provided.
- Scores MUST be between 0 and 5 (decimals allowed).
- Topics should be short strings capturing recurring themes.
- When topics describe similar ideas across different contacts, reuse the exact same topic label (e.g., consistently use "Family Life" or "Startup Projects" instead of variations).
- Favor concise, canonical topic names (2–3 words).
- "global_insights" can be empty if nothing notable stands out.

Conversation timeframe: ${timeframeDays ?? 'entire history'} days.

Contacts:`;

  const body = contacts
    .map((contact) => buildContactBlock(contact))
    .join('\n\n---\n\n');

  return `${header}\n\n${body}`;
};

const parseBatchResponse = (raw: string): ContactImportanceBatchResponse => {
  const cleaned = sanitizeResponseText(raw);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from model response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  const globalInsights = Array.isArray(parsed.global_insights)
    ? parsed.global_insights.map((insight: unknown) => String(insight))
    : [];

  const normalizedContacts: ContactImportanceLLMResponse[] = contacts.map(
    (entry: any) => ({
      contact_id: entry.contact_id,
      contact_name: String(entry.contact_name || ''),
      importance_out_of_5: Number(entry.importance_out_of_5) || 0,
      warmth_out_of_5: Number(entry.warmth_out_of_5) || 0,
      topic_diversity_out_of_5:
        Number(entry.topic_diversity_out_of_5) || 0,
      topics: Array.isArray(entry.topics)
        ? entry.topics.map((topic: unknown) => String(topic))
        : [],
    })
  );

  return {
    contacts: normalizedContacts,
    global_insights: globalInsights,
  };
};

const createEmptyAIResult = (
  contactId: number,
  contactName: string,
  hash: string,
  timeframeDays: number | undefined
): ContactImportanceAIResult => ({
  contact_id: contactId,
  contact_name: contactName,
  importance_score: 0,
  warmth_score: 0,
  topic_diversity_score: 0,
  raw_importance_out_of_5: 0,
  raw_warmth_out_of_5: 0,
  raw_topic_diversity_out_of_5: 0,
  topics: [],
  analyzed_at: new Date().toISOString(),
  timeframe_days: timeframeDays,
  content_hash: hash,
});

const applyLLMContactResult = (
  response: ContactImportanceLLMResponse,
  fallbackName: string,
  hash: string,
  timeframeDays: number | undefined
): ContactImportanceAIResult => {
  const importance = Number(response.importance_out_of_5) || 0;
  const warmth = Number(response.warmth_out_of_5) || 0;
  const diversity = Number(response.topic_diversity_out_of_5) || 0;

  return {
    contact_id: Number(response.contact_id),
    contact_name: response.contact_name || fallbackName,
    importance_score: clamp(importance / 5),
    warmth_score: clamp(warmth / 5),
    topic_diversity_score: clamp(diversity / 5),
    raw_importance_out_of_5: importance,
    raw_warmth_out_of_5: warmth,
    raw_topic_diversity_out_of_5: diversity,
    topics: response.topics || [],
    analyzed_at: new Date().toISOString(),
    timeframe_days: timeframeDays,
    content_hash: hash,
  };
};

export async function analyzeContactsImportanceBatch(
  params: ContactImportanceBatchParams
): Promise<ContactImportanceBatchResult> {
  const {
    contacts,
    userId,
    apiKey,
    cache,
    timeframeDays = 365,
  } = params;

  if (!contacts.length) {
    return {
      contacts: new Map(),
      globalInsights: [],
      contentHash: sha256('empty'),
      timeframeDays,
    };
  }

  const cutoffMs = timeframeDays
    ? Date.now() - timeframeDays * DAY_MS
    : Number.NEGATIVE_INFINITY;

  const processedContacts = contacts.map((contact) => {
    const filtered = contact.messages
      .filter((message) => new Date(message.sent_at).getTime() >= cutoffMs)
      .sort(
        (a, b) =>
          new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      );

    return {
      contactId: contact.contactId,
      contactName: contact.contactName,
      messages: filtered,
    };
  });

  const transcripts = processedContacts.map((contact) => ({
    contactId: contact.contactId,
    contactName: contact.contactName,
    transcript: contact.messages.length
      ? buildTranscript(contact.messages, userId, contact.contactName)
      : '',
  }));

  const hashPayload = transcripts.map((entry) => ({
    id: entry.contactId,
    transcript: entry.transcript || 'empty',
  }));

  const contentHash = sha256(
    JSON.stringify({
      timeframeDays,
      contacts: hashPayload,
    })
  );

  const baseMap = new Map<number, ContactImportanceAIResult>();
  for (const contact of contacts) {
    baseMap.set(
      contact.contactId,
      createEmptyAIResult(contact.contactId, contact.contactName, contentHash, timeframeDays)
    );
  }

  const nonEmptyTranscripts = transcripts.filter(
    (entry) => entry.transcript.length > 0
  );

  if (nonEmptyTranscripts.length === 0) {
    return {
      contacts: baseMap,
      globalInsights: [],
      contentHash,
      timeframeDays,
    };
  }

  if (cache) {
    const cached = cache.get(contentHash);
    if (cached) {
      for (const contactResult of cached.contacts) {
        const contactId = Number(contactResult.contact_id);
        if (!baseMap.has(contactId)) continue;
        const fallback = baseMap.get(contactId)!;
        baseMap.set(
          contactId,
          applyLLMContactResult(
            contactResult,
            fallback.contact_name,
            contentHash,
            timeframeDays
          )
        );
      }

      return {
        contacts: baseMap,
        globalInsights: cached.global_insights || [],
        contentHash,
        timeframeDays,
      };
    }
  }

  const prompt = buildBatchPrompt(nonEmptyTranscripts, timeframeDays);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ] as any,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: CONTACT_IMPORTANCE_SCHEMA as any,
    },
  });

  const result = await model.generateContent(prompt);

  const responseText = result.response?.text?.() || '';
  if (!responseText?.trim()) {
    throw new Error('Gemini returned an empty response');
  }

  let parsed: ContactImportanceBatchResponse;
  try {
    parsed = parseBatchResponse(responseText);
  } catch (error) {
    const preview = responseText.slice(0, 200);
    throw new Error(`Failed to parse AI response: ${preview}`);
  }

  if (cache) {
    cache.set(contentHash, parsed);
  }

  for (const contactResult of parsed.contacts) {
    const contactId = Number(contactResult.contact_id);
    if (!baseMap.has(contactId)) continue;
    const fallback = baseMap.get(contactId)!;
    baseMap.set(
      contactId,
      applyLLMContactResult(
        contactResult,
        fallback.contact_name,
        contentHash,
        timeframeDays
      )
    );
  }

  return {
    contacts: baseMap,
    globalInsights: parsed.global_insights || [],
    contentHash,
    timeframeDays,
  };
}


