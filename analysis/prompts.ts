/**
 * Prompt templates for Gemini AI analysis
 */

/**
 * Primary volley analysis prompt
 * Ported from volley_analysis_prompt.txt
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
 * Format a volley for analysis
 */
export function formatVolleyForAnalysis(pivotText: string): string {
  return `${VOLLEY_ANALYSIS_PROMPT}

${pivotText}`;
}

