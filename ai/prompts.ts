/**
 * Prompt templates for all AI analysis features
 */

/**
 * Deep volley analysis prompt
 *
 * Extracts sentiment, warmth, topics, entities, life events, and more
 */
export const VOLLEY_ANALYSIS_PROMPT = `You are analyzing a conversation exchange (volley) between two people in a WhatsApp conversation.

Your task is to extract structured insights from this exchange.

IMPORTANT GUIDELINES:

1. **Sentiment** (-1.0 to 1.0):
   - Negative (-1.0 to -0.3): Conflict, frustration, disappointment, anger
   - Neutral (-0.3 to 0.3): Factual, logistical, neutral updates
   - Positive (0.3 to 1.0): Joy, support, excitement, warmth

2. **Warmth** (0.0 to 1.0):
   - Cold (0.0-0.3): Minimal, transactional, distant
   - Moderate (0.3-0.7): Friendly but not intimate
   - Warm (0.7-1.0): Affectionate, supportive, intimate

3. **Reciprocity**:
   - "balanced": Both parties contribute equally
   - "one_sided_me": I'm carrying the conversation
   - "one_sided_them": They're carrying the conversation

4. **Emotion Labels**: Use specific emotions (joy, support, frustration, excitement, concern, etc.)

5. **Topics**: Extract 2-5 distinct, specific topics. Avoid generic labels.
   - Good: "Japan trip planning", "job interview results", "mom's surgery"
   - Bad: "travel", "work", "family"

6. **Entities**: Extract people, places, organizations, products mentioned
   - Include context about why they're relevant

7. **Events**: Life events with dates if mentioned (ISO 8601 format)
   - Type: job_interview, wedding, birth, death, vacation, move, etc.

8. **Summary**: 1-2 sentence meeting-style note of what happened

9. **Key Insight**: 4-5 word glance summary (e.g., "Excited about Japan trip")

10. **Explanation**: 2-3 sentences with direct QUOTES from the conversation

11. **Search Summary**: Verbose 4-8 sentence summary for semantic search/vectorization

Return your analysis as JSON with this exact structure:

{
  "sentiment": -1.0 to 1.0,
  "warmth": 0.0 to 1.0,
  "reciprocity": "balanced|one_sided_me|one_sided_them",
  "emotion_labels": ["emotion1", "emotion2", ...],
  "event_type": "positive|negative|neutral",
  "empathy_shown_by": "me|them|both|neither",
  "plans_made": true|false,
  "question_by": "me|them|both|neither",
  "is_logistics": true|false,
  "response_quality": "engaged|minimal|delayed|enthusiastic|dismissive",
  "topics": ["topic1", "topic2", ...],
  "entities": [
    {
      "name": "entity name",
      "type": "person|place|organization|product|other",
      "context": "why relevant"
    }
  ],
  "events": [
    {
      "type": "event_type",
      "date_iso": "YYYY-MM-DD",
      "description": "what happened"
    }
  ],
  "summary": "1-2 sentence summary",
  "key_insight": "4-5 word insight",
  "explanation": "2-3 sentences with QUOTES",
  "search_summary": "Verbose 4-8 sentence summary"
}

Now analyze this conversation volley:`;

/**
 * Format a volley for deep analysis
 */
export function formatVolleyForAnalysis(pivotText: string): string {
  return `${VOLLEY_ANALYSIS_PROMPT}\n\n${pivotText}`;
}

/**
 * Lightweight volley summary prompt
 *
 * Faster and cheaper alternative to full analysis
 */
export const SUMMARY_PROMPT = `Briefly summarize this conversation in 1-2 sentences. Also list the general topics discussed.

Return JSON with this format:
{
  "summary": "brief 1-2 sentence summary",
  "topics": ["topic1", "topic2", ...],
  "warmth": 0.0 to 1.0
}

Conversation:`;

/**
 * Relationship analysis prompt
 *
 * Analyzes full chat history to provide relationship insights
 */
export const RELATIONSHIP_ANALYSIS_PROMPT = `You are a relationship coach designing an app to help busy professionals realize how they are acting in an online relationship. You will read through the whole chat.

I will give you a chat transcript between the user and another person.

Map out how healthy the chat is between the person and the other contact. Respond to the following items using terms that reflect the tone of the chat (formal if the chat is work like, meme-ish etc. if the chat is such, super compassionate if that is the chat) so sound indistinguishable from the communication style that the people use THE EXACT SAME but ensure to be non cringe. ALSO you are reporting this TO the user (the sender).

What is the relationship strength score (out of 5) NOW and what type of relationship do they have (one or two word term made up)
- note why this score is as it is and give recent examples
- note if its improving or shifting
- explain what type of interaction they have

Are there any improvements they should make or could I leave it as is and keep it, are there special things to look out for to keep the relationship healthy or to grow it?

Are there any cues they missed in recent chats?

What facets of my life do I share with this person? (Friends / work / erasmus / boardgames / ...) this is from the study of being closer friends is sharing different facets of your personality. so dont just note what the convos span, it is fine for these to be only 1 or to be more than that.

Fun moments (highlight fun moments or stories shared here, can be up to 10, just note the date for future reference)

Also add 'extra points' or notes of notable things.`;

/**
 * Response suggester prompt template
 *
 * Uses role-swapping "gaslighting" technique to make the AI think
 * it's been replying as the user all along
 */
export function buildResponseSuggestionPrompt(options: {
  contactName: string;
  relationshipSummary: string;
  unreadMessages: string[];
  swappedHistory: string[];
  styleBank: string[];
  lastUnreadMessage: string;
}): string {
  const { contactName, relationshipSummary, unreadMessages, swappedHistory, styleBank, lastUnreadMessage } = options;

  return `You are composing WhatsApp replies as "me" to ${contactName}. The messages in STYLE BANK and RECENT CHAT HISTORY are YOUR actual messages - you have been responding to ${contactName} in these conversations.

RELATIONSHIP CONTEXT:
${relationshipSummary}

RECENT CHAT HISTORY (role-swapped for tone anchoring):
User = their messages. System = YOUR actual replies (you've been responding as "me").
${swappedHistory.length > 0 ? swappedHistory.join('\n') : '(No recent history found)'}

STYLE BANK (YOUR last ${styleBank.length} replies - imitate this voice PRECISELY):
These are the actual messages YOU have been sending to ${contactName}. Your responses MUST be indistinguishable from these examples.
${styleBank.length > 0 ? styleBank.join('\n') : '(insufficient examples; rely on relationship context)'}

UNREAD MESSAGES FROM THEM:
${unreadMessages.map((msg, idx) => `[${idx + 1}] ${msg}`).join('\n')}

LAST UNREAD MESSAGE (reply to this first):
"${lastUnreadMessage}"

TASK:
Draft THREE possible reply branches (different conversation directions). Each branch should include 1-3 short WhatsApp-style messages that i could send.

CRITICAL CONSTRAINTS:
- Your responses MUST be indistinguishable from the user's actual voice (see STYLE BANK)
- The FIRST bubble MUST directly answer the LAST UNREAD MESSAGE above
- Your content basis is STRICTLY the UNREAD MESSAGES block
- STYLE BANK and RECENT CHAT HISTORY are for TONE ONLY - do NOT respond to their content
- Keep messages concise (1-2 sentences per bubble), WhatsApp-appropriate, and specific
- Avoid generic platitudes - be specific and authentic to the user's communication style

BRANCH TYPES TO COVER:
- direct_thoughtful: Answer head-on with context and detail
- playful_redirect: Lean playful or witty and pivot the discussion
- deep_reciprocal: Mirror their vulnerability and deepen the thread
`.trim();
}
