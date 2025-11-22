import { z } from 'zod';

// ============================================================================
// ABSTRACT GOAL & ONBOARDING
// ============================================================================

export const AbstractGoalSchema = z.object({
  goal: z.string(),
  createdAt: z.string(),
});

export type AbstractGoal = z.infer<typeof AbstractGoalSchema>;

export const OnboardingQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  context: z.string().optional(), // Why we're asking this
});

export type OnboardingQuestion = z.infer<typeof OnboardingQuestionSchema>;

export const VIPSuggestionSchema = z.object({
  contactId: z.number(),
  name: z.string(),
  reasoning: z.string(), // Why this person is important
  suggestedPersonalGoal: z.string(),
});

export type VIPSuggestion = z.infer<typeof VIPSuggestionSchema>;

export const InitialAnalysisResultSchema = z.object({
  vipSuggestions: z.array(VIPSuggestionSchema).max(5),
  followUpQuestions: z.array(OnboardingQuestionSchema),
});

export type InitialAnalysisResult = z.infer<typeof InitialAnalysisResultSchema>;

export const VIPSchema = z.object({
  contactId: z.number(),
  name: z.string(),
  personalGoal: z.string(), // Goal specific to this person
  confirmedAt: z.string(),
});

export type VIP = z.infer<typeof VIPSchema>;

export type OnboardingAnswers = Record<string, string>; // questionId -> answer

// ============================================================================
// QUEST GUIDELINES
// ============================================================================

export const QuestGuidelinesSchema = z.object({
  grandQuest: z.string(), // Overall goal summary
  healthCalculationFormula: z.string(), // How to calculate daily health score
  dailyQuestCreationRules: z.string(), // Rules for creating daily general quests
  weeklyQuestCreationRules: z.string(), // Rules for creating weekly general quests
  messageScoringGuidelines: z.string(), // How to score messages (for cheap model)
  specialMomentTriggers: z.string(), // What constitutes a special moment
  generatedAt: z.string(),
});

export type QuestGuidelines = z.infer<typeof QuestGuidelinesSchema>;

export const VIPQuestGuidelinesSchema = z.object({
  contactId: z.number(),
  name: z.string(),
  questCreationRules: z.string(), // How to create quests for this VIP
  scoringGuidelines: z.string(), // How to score interactions with this VIP
  personalContext: z.string(), // Context about relationship with this person
  generatedAt: z.string(),
});

export type VIPQuestGuidelines = z.infer<typeof VIPQuestGuidelinesSchema>;

// ============================================================================
// QUEST SYSTEM
// ============================================================================

export enum QuestType {
  DAILY_GENERAL = 'daily_general',
  WEEKLY_GENERAL = 'weekly_general',
  VIP_DAILY = 'vip_daily',
  VIP_WEEKLY = 'vip_weekly',
  SPECIAL_MOMENT = 'special_moment',
  ALTERNATE = 'alternate',
}

export enum QuestStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export const QuestScoringSpecSchema = z.object({
  description: z.string(), // How this quest should be scored
  checkPrompt: z.string(), // Ultra-simple prompt for gemini-flash
  completionCriteria: z.string(), // What constitutes completion
  pointValue: z.number(), // Points awarded on completion
  partialCreditAllowed: z.boolean(), // Can quest be partially completed?
});

export type QuestScoringSpec = z.infer<typeof QuestScoringSpecSchema>;

export const QuestSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(QuestType),
  title: z.string(),
  description: z.string(),
  scoringSpec: QuestScoringSpecSchema,

  // Type-specific fields
  vipContactId: z.number().optional(), // For VIP quests

  // Timing
  createdAt: z.string(),
  expiresAt: z.string(),

  // Status
  status: z.nativeEnum(QuestStatus),
  progress: z.number().min(0).max(1), // 0.0 to 1.0
  pointsEarned: z.number(),

  // Tracking
  messagesContributed: z.array(z.string()), // Message IDs that contributed to this quest
  completedAt: z.string().optional(),
});

export type Quest = z.infer<typeof QuestSchema>;

// ============================================================================
// SCORING
// ============================================================================

export const MessageScoreResultSchema = z.object({
  messageId: z.string(),
  questId: z.string(),
  contributes: z.boolean(), // Does this message contribute to the quest?
  contribution: z.number(), // How much progress (0.0 to 1.0)
  reasoning: z.string(), // Why/why not
  pointsAwarded: z.number(),
});

export type MessageScoreResult = z.infer<typeof MessageScoreResultSchema>;

export const QuestProgressUpdateSchema = z.object({
  questId: z.string(),
  previousProgress: z.number(),
  newProgress: z.number(),
  previousStatus: z.nativeEnum(QuestStatus),
  newStatus: z.nativeEnum(QuestStatus),
  pointsAwarded: z.number(),
});

export type QuestProgressUpdate = z.infer<typeof QuestProgressUpdateSchema>;

// ============================================================================
// STORAGE SCHEMA
// ============================================================================

export interface GamificationData {
  // Onboarding
  abstractGoal: AbstractGoal | null;
  onboardingAnswers: OnboardingAnswers;
  vips: VIP[];

  // Guidelines (generated once)
  questGuidelines: QuestGuidelines | null;
  vipQuestGuidelines: Record<number, VIPQuestGuidelines>; // contactId -> guidelines

  // Active state
  activeQuests: Quest[];
  completedQuests: Quest[];

  // History & stats
  totalPointsEarned: number;
  dailyHealthScores: Record<string, number>; // date -> score
  streakDays: number;

  // Metadata
  lastUpdated: string;
  onboardingCompleted: boolean;
}

// ============================================================================
// SPECIAL MOMENTS
// ============================================================================

export const SpecialMomentSchema = z.object({
  id: z.string(),
  type: z.string(), // e.g., "birthday", "anniversary", "long_absence", "conflict_resolution"
  contactId: z.number().optional(),
  detectedAt: z.string(),
  context: z.string(),
  suggestedQuestTitle: z.string(),
  suggestedQuestDescription: z.string(),
});

export type SpecialMoment = z.infer<typeof SpecialMomentSchema>;

// ============================================================================
// GENERATION HELPERS
// ============================================================================

export interface GenerateQuestParams {
  type: QuestType;
  guidelines: QuestGuidelines;
  vipGuidelines?: VIPQuestGuidelines;
  vipContactId?: number;
  specialMoment?: SpecialMoment;
  recentMessages?: any[]; // For context
}

export interface ScoreMessageParams {
  messageId: string;
  messageContent: string;
  fromId: number;
  sentAt: string;
  activeQuests: Quest[];
  apiKey: string;
}
