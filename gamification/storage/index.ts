/**
 * Gamification data storage using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GamificationData, Quest, VIP, QuestGuidelines, VIPQuestGuidelines, AbstractGoal, OnboardingAnswers } from '../types';

const STORAGE_KEY = '@friendup:gamification_data';

/**
 * Default empty gamification data
 */
const DEFAULT_DATA: GamificationData = {
  abstractGoal: null,
  onboardingAnswers: {},
  vips: [],
  questGuidelines: null,
  vipQuestGuidelines: {},
  activeQuests: [],
  completedQuests: [],
  totalPointsEarned: 0,
  dailyHealthScores: {},
  streakDays: 0,
  lastUpdated: new Date().toISOString(),
  onboardingCompleted: false,
};

/**
 * Storage manager for gamification data
 */
export class GamificationStorage {
  private data: GamificationData = { ...DEFAULT_DATA };
  private loaded: boolean = false;

  /**
   * Load data from AsyncStorage
   */
  async load(): Promise<GamificationData> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (stored) {
        this.data = JSON.parse(stored);
        this.loaded = true;
        return this.data;
      }

      // No data exists yet, use defaults
      this.data = { ...DEFAULT_DATA };
      this.loaded = true;
      return this.data;
    } catch (error) {
      console.error('[GamificationStorage] Failed to load data:', error);
      this.data = { ...DEFAULT_DATA };
      this.loaded = true;
      return this.data;
    }
  }

  /**
   * Save data to AsyncStorage
   */
  async save(): Promise<void> {
    try {
      this.data.lastUpdated = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.error('[GamificationStorage] Failed to save data:', error);
      throw error;
    }
  }

  /**
   * Ensure data is loaded
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('GamificationStorage not loaded. Call load() first.');
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getData(): GamificationData {
    this.ensureLoaded();
    return this.data;
  }

  getAbstractGoal(): AbstractGoal | null {
    this.ensureLoaded();
    return this.data.abstractGoal;
  }

  getOnboardingAnswers(): OnboardingAnswers {
    this.ensureLoaded();
    return this.data.onboardingAnswers;
  }

  getVIPs(): VIP[] {
    this.ensureLoaded();
    return this.data.vips;
  }

  getQuestGuidelines(): QuestGuidelines | null {
    this.ensureLoaded();
    return this.data.questGuidelines;
  }

  getVIPQuestGuidelines(contactId: number): VIPQuestGuidelines | null {
    this.ensureLoaded();
    return this.data.vipQuestGuidelines[contactId] || null;
  }

  getAllVIPQuestGuidelines(): Record<number, VIPQuestGuidelines> {
    this.ensureLoaded();
    return this.data.vipQuestGuidelines;
  }

  getActiveQuests(): Quest[] {
    this.ensureLoaded();
    return this.data.activeQuests;
  }

  getCompletedQuests(): Quest[] {
    this.ensureLoaded();
    return this.data.completedQuests;
  }

  getTotalPoints(): number {
    this.ensureLoaded();
    return this.data.totalPointsEarned;
  }

  getDailyHealthScore(date: string): number | null {
    this.ensureLoaded();
    return this.data.dailyHealthScores[date] || null;
  }

  getStreak(): number {
    this.ensureLoaded();
    return this.data.streakDays;
  }

  isOnboardingCompleted(): boolean {
    this.ensureLoaded();
    return this.data.onboardingCompleted;
  }

  // ============================================================================
  // SETTERS
  // ============================================================================

  async setAbstractGoal(goal: AbstractGoal): Promise<void> {
    this.ensureLoaded();
    this.data.abstractGoal = goal;
    await this.save();
  }

  async setOnboardingAnswers(answers: OnboardingAnswers): Promise<void> {
    this.ensureLoaded();
    this.data.onboardingAnswers = answers;
    await this.save();
  }

  async setVIPs(vips: VIP[]): Promise<void> {
    this.ensureLoaded();
    this.data.vips = vips;
    await this.save();
  }

  async addVIP(vip: VIP): Promise<void> {
    this.ensureLoaded();
    // Check if VIP already exists
    const existingIndex = this.data.vips.findIndex(v => v.contactId === vip.contactId);
    if (existingIndex !== -1) {
      // Update existing VIP
      this.data.vips[existingIndex] = vip;
    } else {
      // Add new VIP
      this.data.vips.push(vip);
    }
    await this.save();
  }

  async setQuestGuidelines(guidelines: QuestGuidelines): Promise<void> {
    this.ensureLoaded();
    this.data.questGuidelines = guidelines;
    await this.save();
  }

  async setVIPQuestGuidelines(contactId: number, guidelines: VIPQuestGuidelines): Promise<void> {
    this.ensureLoaded();
    this.data.vipQuestGuidelines[contactId] = guidelines;
    await this.save();
  }

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    this.ensureLoaded();
    this.data.onboardingCompleted = completed;
    await this.save();
  }

  // ============================================================================
  // QUEST MANAGEMENT
  // ============================================================================

  async addQuest(quest: Quest): Promise<void> {
    this.ensureLoaded();
    this.data.activeQuests.push(quest);
    await this.save();
  }

  async updateQuest(questId: string, updates: Partial<Quest>): Promise<void> {
    this.ensureLoaded();
    const quest = this.data.activeQuests.find(q => q.id === questId);
    if (quest) {
      Object.assign(quest, updates);
      await this.save();
    }
  }

  async completeQuest(questId: string): Promise<void> {
    this.ensureLoaded();
    const index = this.data.activeQuests.findIndex(q => q.id === questId);
    if (index !== -1) {
      const quest = this.data.activeQuests[index];
      quest.completedAt = new Date().toISOString();

      // Move to completed quests
      this.data.completedQuests.push(quest);
      this.data.activeQuests.splice(index, 1);

      await this.save();
    }
  }

  async removeExpiredQuests(): Promise<void> {
    this.ensureLoaded();
    const now = new Date();

    // Filter out expired quests
    const { active, expired } = this.data.activeQuests.reduce(
      (acc, quest) => {
        if (new Date(quest.expiresAt) < now) {
          acc.expired.push(quest);
        } else {
          acc.active.push(quest);
        }
        return acc;
      },
      { active: [] as Quest[], expired: [] as Quest[] }
    );

    this.data.activeQuests = active;
    this.data.completedQuests.push(...expired);

    await this.save();
  }

  // ============================================================================
  // STATS & HISTORY
  // ============================================================================

  async addPoints(points: number): Promise<void> {
    this.ensureLoaded();
    this.data.totalPointsEarned += points;
    await this.save();
  }

  async setDailyHealthScore(date: string, score: number): Promise<void> {
    this.ensureLoaded();
    this.data.dailyHealthScores[date] = score;
    await this.save();
  }

  async updateStreak(days: number): Promise<void> {
    this.ensureLoaded();
    this.data.streakDays = days;
    await this.save();
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  async clear(): Promise<void> {
    this.data = { ...DEFAULT_DATA };
    this.loaded = true;
    await this.save();
  }

  async reset(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.data = { ...DEFAULT_DATA };
    this.loaded = false;
  }
}

// Export singleton instance
export const gamificationStorage = new GamificationStorage();
