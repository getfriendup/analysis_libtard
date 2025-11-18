/**
 * Test script to analyze real WhatsApp messages from the API
 *
 * Usage:
 *   npx ts-node test-with-api.ts --chatId=3 --token=YOUR_TOKEN
 */

import axios from 'axios';
import { Message } from './types';
import { getVolleys } from './segmentation';
import { getStreaks } from './features/streaks';
import { getActiveToday, getActiveThisWeek, getActivePeriod } from './features/active';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8080';

interface APIMessage {
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

/**
 * Fetch messages from the API
 */
async function fetchMessages(chatId: number, token: string): Promise<Message[]> {
  console.log(`\n📡 Fetching messages for chat ${chatId}...`);

  try {
    const response = await axios.get(`${API_BASE_URL}/chats/${chatId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params: {
        page: 1,
        page_size: 100,
      },
    });

    const messages: APIMessage[] = response.data.messages || [];
    console.log(`✅ Fetched ${messages.length} messages`);

    return messages;
  } catch (error: any) {
    console.error('❌ Failed to fetch messages:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Run analysis on messages
 */
function analyzeMessages(messages: Message[]) {
  console.log(`\n🔬 Analyzing ${messages.length} messages...\n`);

  // 1. Segment into volleys
  console.log('1️⃣  Segmenting messages into volleys...');
  const volleys = getVolleys(messages);
  console.log(`   ✓ Found ${volleys.length} volleys`);

  if (volleys.length > 0) {
    console.log(`   → First volley: ${volleys[0].message_count} messages, depth ${volleys[0].depth}`);
    console.log(`   → Last volley: ${volleys[volleys.length - 1].message_count} messages`);
  }

  // 2. Calculate streaks
  console.log('\n2️⃣  Calculating engagement streaks...');
  const streaks = getStreaks(messages);
  console.log(`   ✓ Current streak: ${streaks.current_streak_days} days`);
  console.log(`   ✓ Longest streak: ${streaks.longest_streak_days} days`);
  console.log(`   ✓ Is active: ${streaks.is_active}`);
  console.log(`   ✓ Last message: ${streaks.last_message_date.toISOString()}`);

  // 3. Get active contacts
  console.log('\n3️⃣  Checking activity periods...');
  const activeToday = getActiveToday(messages);
  const activeThisWeek = getActiveThisWeek(messages);
  const active30Days = getActivePeriod(messages, 30);

  console.log(`   ✓ Active today: ${activeToday.length} contacts`);
  console.log(`   ✓ Active this week: ${activeThisWeek.length} contacts`);
  console.log(`   ✓ Active in last 30 days: ${active30Days.length} contacts`);

  // 4. Show sample volley details
  if (volleys.length > 0) {
    console.log('\n4️⃣  Sample volley details:');
    const sampleVolley = volleys[0];
    console.log(`   ID: ${sampleVolley.id}`);
    console.log(`   Participants: ${sampleVolley.participants.join(', ')}`);
    console.log(`   Duration: ${sampleVolley.start_time.toISOString()} → ${sampleVolley.end_time.toISOString()}`);
    console.log(`   Turns: ${sampleVolley.turns.length}`);
    console.log(`   Preview: ${sampleVolley.pivot_text.substring(0, 100)}...`);
  }

  // 5. Message distribution
  console.log('\n5️⃣  Message distribution:');
  const participants = new Set(messages.map(m => m.from_id));
  for (const participantId of participants) {
    const count = messages.filter(m => m.from_id === participantId).length;
    const percentage = ((count / messages.length) * 100).toFixed(1);
    console.log(`   Contact ${participantId}: ${count} messages (${percentage}%)`);
  }

  return {
    volleys,
    streaks,
    activeToday,
    activeThisWeek,
    active30Days,
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const chatIdArg = args.find(arg => arg.startsWith('--chatId='));
  const tokenArg = args.find(arg => arg.startsWith('--token='));

  if (!chatIdArg || !tokenArg) {
    console.error('❌ Usage: npx ts-node test-with-api.ts --chatId=<ID> --token=<TOKEN>');
    console.error('\nExample:');
    console.error('  npx ts-node test-with-api.ts --chatId=3 --token=eyJhbGc...');
    process.exit(1);
  }

  const chatId = parseInt(chatIdArg.split('=')[1]);
  const token = tokenArg.split('=')[1];

  if (isNaN(chatId)) {
    console.error('❌ Invalid chat ID');
    process.exit(1);
  }

  console.log('🚀 Analysis Library Test with Real API Data');
  console.log('=' .repeat(50));
  console.log(`Chat ID: ${chatId}`);
  console.log(`API URL: ${API_BASE_URL}`);

  try {
    // Fetch messages
    const messages = await fetchMessages(chatId, token);

    if (messages.length === 0) {
      console.log('\n⚠️  No messages found for this chat');
      return;
    }

    // Analyze messages
    const results = analyzeMessages(messages);

    console.log('\n✅ Analysis complete!');
    console.log('=' .repeat(50));
    console.log('\nSummary:');
    console.log(`  • Messages: ${messages.length}`);
    console.log(`  • Volleys: ${results.volleys.length}`);
    console.log(`  • Current streak: ${results.streaks.current_streak_days} days`);
    console.log(`  • Active this week: ${results.activeThisWeek.length} contacts`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
