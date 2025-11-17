/**
 * Example usage of the analysis library
 */

import { AnalysisEngine, Message } from './index';
import * as dotenv from 'dotenv';

// Load environment variables from backend .env file
dotenv.config({ path: '/Users/reanedelaunoy/projects/dontbeabadfriend/whatsapp_data_clone/conversation_segmentation/backend/.env' });

async function main() {
  // Initialize the engine
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Error: No API key found!');
    console.error('Please set either GEMINI_API_KEY or GOOGLE_API_KEY environment variable');
    console.error('\nGet a free key at: https://aistudio.google.com/app/apikey');
    console.error('\nThen run: export GEMINI_API_KEY="your-key-here"');
    process.exit(1);
  }
  
  const engine = new AnalysisEngine({
    gemini_api_key: apiKey,
    cache_path: './.cache/llm_cache.json',
    enable_cache: true,
    user_id: 1,
  });

  await engine.initialize();
  console.log('✅ Engine initialized');

  // Sample messages
  const messages: Message[] = [
    {
      ID: 1,
      chat_id: 123,
      from_id: 1,
      content: 'Hey! How was the interview?',
      sent_at: '2024-11-17T10:00:00Z',
      message_id: 'msg_1',
      key_version: 1,
      CreatedAt: '2024-11-17T10:00:00Z',
      UpdatedAt: '2024-11-17T10:00:00Z',
    },
    {
      ID: 2,
      chat_id: 123,
      from_id: 2,
      content: 'It went really well! Got a good vibe from the team',
      sent_at: '2024-11-17T10:05:00Z',
      message_id: 'msg_2',
      key_version: 1,
      CreatedAt: '2024-11-17T10:05:00Z',
      UpdatedAt: '2024-11-17T10:05:00Z',
    },
    {
      ID: 3,
      chat_id: 123,
      from_id: 1,
      content: "That's awesome! When do you hear back?",
      sent_at: '2024-11-17T10:06:00Z',
      message_id: 'msg_3',
      key_version: 1,
      CreatedAt: '2024-11-17T10:06:00Z',
      UpdatedAt: '2024-11-17T10:06:00Z',
    },
    {
      ID: 4,
      chat_id: 123,
      from_id: 2,
      content: 'They said end of week. Fingers crossed 🤞',
      sent_at: '2024-11-17T10:08:00Z',
      message_id: 'msg_4',
      key_version: 1,
      CreatedAt: '2024-11-17T10:08:00Z',
      UpdatedAt: '2024-11-17T10:08:00Z',
    },
  ];

  console.log(`📨 Processing ${messages.length} messages...`);

  // Batch analyze
  const result = await engine.analyzeBatch(messages);

  console.log('\n📊 Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Volleys created: ${result.volleys.length}`);
  console.log(`Processing time: ${result.processing_time_ms}ms`);

  // Show volley analysis
  if (result.analyses.length > 0) {
    const analysis = result.analyses[0];
    console.log('\n🤖 AI Analysis:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Sentiment: ${analysis.sentiment.toFixed(2)} (${analysis.sentiment > 0 ? '😊 Positive' : '😐 Neutral'})`);
    console.log(`Warmth: ${analysis.warmth.toFixed(2)} (${analysis.warmth > 0.7 ? '🔥 Warm' : '😐 Moderate'})`);
    console.log(`Reciprocity: ${analysis.reciprocity}`);
    console.log(`Topics: ${analysis.topics.join(', ')}`);
    console.log(`Emotions: ${analysis.emotion_labels.join(', ')}`);
    console.log(`Summary: ${analysis.summary}`);
    console.log(`Key Insight: "${analysis.key_insight}"`);
  }

  // Show contact metrics
  const metrics = result.metrics;
  console.log('\n📈 Contact Metrics:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Average Warmth: ${metrics.avg_warmth.toFixed(2)}`);
  console.log(`Average Sentiment: ${metrics.avg_sentiment.toFixed(2)}`);
  console.log(`Connection State: ${metrics.connection_state}`);
  console.log(`Priority Score: ${metrics.priority_score}/100`);
  console.log(`Importance Score: ${metrics.importance_score.toFixed(2)}`);
  console.log(`Call to Action: ${metrics.cta}`);

  // Show streaks
  const streaks = engine.getStreaks(messages);
  console.log('\n🔥 Engagement Streaks:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Current Streak: ${streaks.current_streak_days} days`);
  console.log(`Longest Streak: ${streaks.longest_streak_days} days`);
  console.log(`Active: ${streaks.is_active ? '✅ Yes' : '❌ No'}`);

  // Save cache
  await engine.saveCache();
  const cacheStats = engine.getCacheStats();
  console.log('\n💾 Cache Statistics:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Cached analyses: ${cacheStats.size}`);

  console.log('\n✅ Analysis complete!');
}

main().catch(console.error);

