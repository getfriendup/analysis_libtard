# @dontbeabadfriend/analysis

A TypeScript analysis library for WhatsApp message insights, powered by Google Gemini AI.

## Features

- **Conversation Segmentation**: Adaptive 3-phase algorithm (Messages → Turns → Volleys → Sessions)
- **AI-Powered Analysis**: Sentiment, warmth, topics, emotions, and life events using Gemini 2.5 Flash
- **Contact Metrics**: Aggregated statistics including churn risk, importance scoring, and trends
- **Engagement Tracking**: Streaks, active periods, and social health scores
- **Smart Caching**: SHA256-based LLM response caching to minimize API costs
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @dontbeabadfriend/analysis
```

## Quick Start

```typescript
import { AnalysisEngine } from '@dontbeabadfriend/analysis';

// Initialize the engine
const engine = new AnalysisEngine({
  gemini_api_key: process.env.GEMINI_API_KEY!,
  cache_path: './.cache/llm_cache.json',
  enable_cache: true,
});

await engine.initialize();

// Analyze messages
const messages: Message[] = [
  // Your WhatsApp messages
];

// Get volleys (conversation exchanges)
const volleys = engine.getVolleys(messages);

// Analyze a volley with Gemini AI
const analysis = await engine.getAnalysisForVolley(volleys[0]);
console.log('Sentiment:', analysis.sentiment);
console.log('Warmth:', analysis.warmth);
console.log('Topics:', analysis.topics);

// Get aggregated metrics
const metrics = engine.getContactMetrics(contactId, analyses);
console.log('Connection State:', metrics.connection_state);
console.log('Priority Score:', metrics.priority_score);

// Track engagement
const streaks = engine.getStreaks(messages);
console.log('Current Streak:', streaks.current_streak_days, 'days');

// Get active contacts
const activeToday = engine.getActiveToday(messages);
console.log('Active today:', activeToday.length, 'contacts');

// Save cache
await engine.saveCache();
```

## API Reference

### Core Methods

#### `getVolleys(messages: Message[]): Volley[]`

Segments messages into conversation exchanges (volleys) using adaptive timeout detection.

```typescript
const volleys = engine.getVolleys(messages);
```

#### `getAnalysisForVolley(volley: Volley): Promise<VolleyAnalysis>`

Analyzes a volley using Gemini AI to extract:
- Sentiment (-1.0 to 1.0)
- Warmth (0.0 to 1.0)
- Topics and entities
- Life events
- Reciprocity patterns
- Emotion labels

```typescript
const analysis = await engine.getAnalysisForVolley(volley);
```

#### `getContactMetrics(contactId: number, analyses: VolleyAnalysis[]): ContactMetrics`

Aggregates volley analyses into contact-level metrics:
- Average warmth and sentiment
- Reciprocity balance
- Topic distribution
- Churn risk (RFV framework)
- Connection state
- Priority and importance scores

```typescript
const metrics = engine.getContactMetrics(contactId, analyses);
```

#### `analyzeBatch(messages: Message[]): Promise<BatchAnalysisResult>`

Convenience method that performs segmentation, analysis, and metric calculation in one call:

```typescript
const result = await engine.analyzeBatch(messages);
console.log('Volleys:', result.volleys.length);
console.log('Metrics:', result.metrics);
console.log('Processing time:', result.processing_time_ms, 'ms');
```

### Feature Methods

#### `getStreaks(messages: Message[]): StreakInfo`

Track engagement streaks:

```typescript
const streaks = engine.getStreaks(messages);
console.log('Current:', streaks.current_streak_days);
console.log('Longest:', streaks.longest_streak_days);
console.log('Active:', streaks.is_active);
```

#### `getActiveToday(messages: Message[]): number[]`

Get contact IDs with activity today:

```typescript
const activeToday = engine.getActiveToday(messages);
```

#### `getActiveThisWeek(messages: Message[]): number[]`

Get contact IDs with activity in the last 7 days:

```typescript
const activeWeek = engine.getActiveThisWeek(messages);
```

#### `getActivePeriod(messages: Message[], days: number): number[]`

Get contact IDs with activity in a custom period:

```typescript
const active30Days = engine.getActivePeriod(messages, 30);
```

#### `getAvgWarmth(analyses: VolleyAnalysis[]): number`

Calculate average warmth across analyses:

```typescript
const warmth = engine.getAvgWarmth(analyses);
```

#### `getAvgSentiment(analyses: VolleyAnalysis[]): number`

Calculate average sentiment across analyses:

```typescript
const sentiment = engine.getAvgSentiment(analyses);
```

#### `getSocialHealthScore(contacts: ContactMetrics[]): SocialHealthScore`

Calculate overall social health score (0-100) with breakdown:

```typescript
const health = engine.getSocialHealthScore(allContacts);
console.log('Total Score:', health.total_score);
console.log('Engagement:', health.breakdown.engagement);
console.log('Depth:', health.breakdown.depth);
console.log('Trend:', health.trend);
```

## Configuration

```typescript
interface Config {
  gemini_api_key: string;          // Required: Your Gemini API key
  gemini_model?: string;            // Optional: Model name (default: 'gemini-2.5-flash')
  cache_path?: string;              // Optional: Cache file path
  user_id?: number;                 // Optional: User ID for "me" identification
  enable_cache?: boolean;           // Optional: Enable caching (default: true)
  rate_limit?: number;              // Optional: Requests per minute (default: 60)
  retry_attempts?: number;          // Optional: Retry attempts (default: 3)
  retry_delay_ms?: number;          // Optional: Retry delay (default: 2000)
}
```

## Type Definitions

### Message

```typescript
interface Message {
  ID: number;
  chat_id: number;
  from_id: number;
  content: string;
  sent_at: string;
  message_id: string;
  key_version: number;
  CreatedAt: string;
  UpdatedAt: string;
}
```

### Volley

```typescript
interface Volley {
  id: string;
  turns: Turn[];
  participants: number[];
  start_time: Date;
  end_time: Date;
  depth: number;              // Speaker changes
  message_count: number;
  pivot_text: string;         // Full conversation text
}
```

### VolleyAnalysis

```typescript
interface VolleyAnalysis {
  volley_id: string;
  sentiment: number;          // -1.0 to 1.0
  warmth: number;             // 0.0 to 1.0
  reciprocity: 'balanced' | 'one_sided_me' | 'one_sided_them';
  emotion_labels: string[];
  topics: string[];
  entities: Entity[];
  events: LifeEvent[];
  summary: string;
  key_insight: string;
  // ... more fields
}
```

### ContactMetrics

```typescript
interface ContactMetrics {
  contact_id: number;
  avg_warmth: number;
  avg_sentiment: number;
  balanced_ratio: number;
  top_topics: TopicFrequency[];
  churn_metrics: ChurnMetrics;
  connection_state: 'thriving' | 'stable' | 'cooling' | 'at_risk' | 'dormant';
  priority_score: number;     // 0-100
  importance_score: number;   // 0-1
  cta: 'maintain' | 'check_in' | 'deepen' | 'reconnect' | 'repair';
  // ... more fields
}
```

## Advanced Usage

### Custom Importance Scoring

```typescript
import { calculateImportanceScore, rankByImportance } from '@dontbeabadfriend/analysis';

const score = calculateImportanceScore({
  volleyCount: 50,
  avgWarmth: 0.8,
  topicCount: 15,
  responsiveness: 0.9,
  relationshipDays: 730,
});

const ranked = rankByImportance(contacts);
```

### Identify VIP and At-Risk Contacts

```typescript
import { identifyVIPs, identifyAtRisk } from '@dontbeabadfriend/analysis';

const vips = identifyVIPs(contacts);       // Top 20% by importance
const atRisk = identifyAtRisk(contacts);   // Contacts needing attention
```

### Trend Analysis

```typescript
import { analyzeTopicEvolution } from '@dontbeabadfriend/analysis';

const evolution = analyzeTopicEvolution(analyses, 10);
console.log('Emerging:', evolution.emerging_topics);
console.log('Declining:', evolution.declining_topics);
```

## Cost Optimization

The library uses caching to minimize Gemini API costs:

1. **Automatic Caching**: Analyses are cached by volley content hash
2. **Persistent Cache**: Survives between sessions
3. **Cache Statistics**: Monitor cache efficiency

```typescript
const stats = engine.getCacheStats();
console.log('Cached analyses:', stats.size);
```

**Estimated Costs** (Gemini 2.5 Flash):
- ~800 tokens per volley
- ~$0.72 for 3,000 volleys (one-time)
- Cached volleys cost nothing on subsequent runs

## Testing

```bash
npm test
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

