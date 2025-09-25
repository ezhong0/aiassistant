import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import { SlackContext } from '../types/slack/slack.types';
import { CacheService } from './cache.service';

/**
 * Context interfaces
 */
export interface ConversationContext {
  sessionId: string;
  conversationHistory: string[];
  recentMessages: Array<{
    text: string;
    user: string;
    timestamp: string;
  }>;
  slackContext?: SlackContext;
}

export interface ContextAnalysis {
  relevantHistory: string[];
  keyEntities: string[];
  conversationTopic: string;
  userPreferences: Record<string, unknown>;
  contextScore: number; // 0-1 relevance score
}

export interface GatheredContext {
  conversation: ConversationContext;
  analysis: ContextAnalysis;
  timestamp: Date;
  sessionId: string;
}

/**
 * Service responsible for gathering and analyzing conversation context
 *
 * Single Responsibility: Context Gathering & Analysis
 * - Gathers conversation history and context
 * - Analyzes context relevance and entities
 * - Provides structured context for decision making
 * - Manages context caching and retrieval
 */
export class ContextManager extends BaseService {
  private cacheService: CacheService | null = null;

  // Cache TTL for context (5 minutes)
  private readonly CONTEXT_CACHE_TTL = 300;

  // Maximum conversation history to maintain
  private readonly MAX_HISTORY_LENGTH = 20;

  constructor() {
    super('ContextManager');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;

    if (this.cacheService) {
      this.logInfo('ContextManager initialized with caching enabled');
    } else {
      this.logInfo('ContextManager initialized without caching');
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ContextManager destroyed');
  }

  /**
   * Gather comprehensive context for a session
   *
   * @param sessionId - Session identifier
   * @param slackContext - Optional Slack context
   * @returns Promise resolving to gathered context
   */
  async gatherContext(sessionId: string, slackContext?: SlackContext): Promise<GatheredContext> {
    this.assertReady();

    const cacheKey = `context:${sessionId}`;

    // Try cache first
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get<GatheredContext>(cacheKey);
        if (cached && this.isContextFresh(cached)) {
          this.logDebug('Using cached context', { sessionId });
          return cached;
        }
      } catch (error) {
        this.logWarn('Failed to retrieve cached context', { sessionId, error });
      }
    }

    this.logDebug('Gathering fresh context', { sessionId, hasSlackContext: !!slackContext });

    // Gather conversation context
    const conversationContext = await this.gatherConversationContext(sessionId, slackContext);

    // Analyze the gathered context
    const contextAnalysis = await this.analyzeContext(conversationContext);

    const gatheredContext: GatheredContext = {
      conversation: conversationContext,
      analysis: contextAnalysis,
      timestamp: new Date(),
      sessionId
    };

    // Cache the result
    if (this.cacheService) {
      try {
        await this.cacheService.set(cacheKey, gatheredContext, this.CONTEXT_CACHE_TTL);
        this.logDebug('Cached gathered context', { sessionId });
      } catch (error) {
        this.logWarn('Failed to cache context', { sessionId, error });
      }
    }

    this.logInfo('Context gathering completed', {
      sessionId,
      historyLength: conversationContext.conversationHistory.length,
      recentMessagesCount: conversationContext.recentMessages.length,
      contextScore: contextAnalysis.contextScore
    });

    return gatheredContext;
  }

  /**
   * Analyze context for relevance and extract key information
   *
   * @param context - Conversation context to analyze
   * @returns Context analysis results
   */
  async analyzeContext(context: ConversationContext): Promise<ContextAnalysis> {
    this.assertReady();

    try {
      // Extract key entities (simplified implementation)
      const keyEntities = this.extractEntities(context.conversationHistory);

      // Determine conversation topic
      const conversationTopic = this.determineConversationTopic(context.conversationHistory);

      // Extract user preferences from conversation patterns
      const userPreferences = this.extractUserPreferences(context.conversationHistory);

      // Calculate context relevance score
      const contextScore = this.calculateContextScore(context);

      // Filter relevant history based on recency and topic relevance
      const relevantHistory = this.filterRelevantHistory(context.conversationHistory, conversationTopic);

      const analysis: ContextAnalysis = {
        relevantHistory,
        keyEntities,
        conversationTopic,
        userPreferences,
        contextScore
      };

      this.logDebug('Context analysis completed', {
        sessionId: context.sessionId,
        keyEntitiesCount: keyEntities.length,
        conversationTopic,
        contextScore,
        relevantHistoryLength: relevantHistory.length
      });

      return analysis;
    } catch (error) {
      this.logError('Failed to analyze context', { error, sessionId: context.sessionId });

      // Return fallback analysis
      return {
        relevantHistory: context.conversationHistory.slice(-5), // Last 5 messages
        keyEntities: [],
        conversationTopic: 'general',
        userPreferences: {},
        contextScore: 0.5
      };
    }
  }

  /**
   * Get recent Slack messages for context
   *
   * @param slackContext - Slack context information
   * @returns Promise resolving to recent messages
   */
  async getRecentSlackMessages(slackContext: SlackContext): Promise<Array<{
    text: string;
    user: string;
    timestamp: string;
  }>> {
    this.assertReady();

    try {
      // Get Slack service for message retrieval
      const slackService = serviceManager.getService('slackService');
      if (!slackService) {
        this.logWarn('Slack service not available for message context');
        return [];
      }

      // This would integrate with Slack service to get recent messages
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      this.logError('Failed to get recent Slack messages', { error, slackContext });
      return [];
    }
  }

  /**
   * Get recent conversation history for a session
   *
   * @param sessionId - Session identifier
   * @returns Promise resolving to conversation history
   */
  async getRecentConversation(sessionId: string): Promise<string[]> {
    this.assertReady();

    try {
      // This would integrate with conversation storage to get history
      // For now, return from cache or empty array
      if (this.cacheService) {
        const historyKey = `history:${sessionId}`;
        const history = await this.cacheService.get<string[]>(historyKey);
        return history || [];
      }

      return [];
    } catch (error) {
      this.logError('Failed to get recent conversation', { error, sessionId });
      return [];
    }
  }

  /**
   * Update conversation history with new message
   *
   * @param sessionId - Session identifier
   * @param message - New message to add
   * @param speaker - Who said the message (user/assistant)
   */
  async updateConversationHistory(sessionId: string, message: string, speaker: 'user' | 'assistant'): Promise<void> {
    this.assertReady();

    if (!this.cacheService) {
      return; // No storage available
    }

    try {
      const historyKey = `history:${sessionId}`;
      const history = await this.cacheService.get<string[]>(historyKey) || [];

      // Add new message with speaker prefix
      const formattedMessage = `${speaker}: ${message}`;
      history.push(formattedMessage);

      // Limit history length
      if (history.length > this.MAX_HISTORY_LENGTH) {
        history.splice(0, history.length - this.MAX_HISTORY_LENGTH);
      }

      // Save updated history
      await this.cacheService.set(historyKey, history, this.CONTEXT_CACHE_TTL * 2); // Longer TTL for history

      // Invalidate context cache since history changed
      await this.cacheService.del(`context:${sessionId}`);

      this.logDebug('Updated conversation history', { sessionId, historyLength: history.length });
    } catch (error) {
      this.logError('Failed to update conversation history', { error, sessionId });
    }
  }

  /**
   * Clear context cache for a session
   *
   * @param sessionId - Session identifier
   */
  async clearContextCache(sessionId: string): Promise<void> {
    this.assertReady();

    if (!this.cacheService) {
      return;
    }

    try {
      await Promise.all([
        this.cacheService.del(`context:${sessionId}`),
        this.cacheService.del(`history:${sessionId}`)
      ]);

      this.logDebug('Cleared context cache', { sessionId });
    } catch (error) {
      this.logError('Failed to clear context cache', { error, sessionId });
    }
  }

  /**
   * Private helper methods
   */

  private async gatherConversationContext(sessionId: string, slackContext?: SlackContext): Promise<ConversationContext> {
    const conversationHistory = await this.getRecentConversation(sessionId);

    let recentMessages: Array<{ text: string; user: string; timestamp: string }> = [];

    if (slackContext) {
      recentMessages = await this.getRecentSlackMessages(slackContext);
    }

    return {
      sessionId,
      conversationHistory,
      recentMessages,
      slackContext
    };
  }

  private isContextFresh(context: GatheredContext): boolean {
    const age = Date.now() - context.timestamp.getTime();
    return age < (this.CONTEXT_CACHE_TTL * 1000);
  }

  private extractEntities(history: string[]): string[] {
    const entities: Set<string> = new Set();

    for (const message of history) {
      // Simple entity extraction - email addresses
      const emails = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
      if (emails) {
        emails.forEach(email => entities.add(email));
      }

      // Names (capitalized words)
      const names = message.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (names) {
        names.forEach(name => entities.add(name));
      }
    }

    return Array.from(entities);
  }

  private determineConversationTopic(history: string[]): string {
    if (history.length === 0) return 'general';

    const recentHistory = history.slice(-5).join(' ').toLowerCase();

    if (recentHistory.includes('email') || recentHistory.includes('mail')) {
      return 'email';
    }
    if (recentHistory.includes('calendar') || recentHistory.includes('meeting')) {
      return 'calendar';
    }
    if (recentHistory.includes('contact') || recentHistory.includes('phone')) {
      return 'contacts';
    }

    return 'general';
  }

  private extractUserPreferences(history: string[]): Record<string, unknown> {
    const preferences: Record<string, unknown> = {};

    // Extract simple preferences from conversation patterns
    const recentHistory = history.slice(-10).join(' ').toLowerCase();

    if (recentHistory.includes('formal') || recentHistory.includes('professional')) {
      preferences.tone = 'formal';
    } else if (recentHistory.includes('casual') || recentHistory.includes('friendly')) {
      preferences.tone = 'casual';
    }

    return preferences;
  }

  private calculateContextScore(context: ConversationContext): number {
    let score = 0.0;

    // Score based on history length (more context = higher score)
    if (context.conversationHistory.length > 0) {
      score += Math.min(context.conversationHistory.length / 10, 0.3);
    }

    // Score based on recent messages
    if (context.recentMessages.length > 0) {
      score += Math.min(context.recentMessages.length / 5, 0.2);
    }

    // Score based on Slack context availability
    if (context.slackContext) {
      score += 0.2;
    }

    // Base score for having any context
    if (context.conversationHistory.length > 0 || context.recentMessages.length > 0) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  private filterRelevantHistory(history: string[], topic: string): string[] {
    if (topic === 'general') {
      // Return recent history for general topics
      return history.slice(-5);
    }

    // Filter history based on topic relevance
    const relevantMessages = history.filter(message => {
      const lowerMessage = message.toLowerCase();
      return lowerMessage.includes(topic) ||
             lowerMessage.includes(topic.substring(0, 4)); // Partial match
    });

    // Ensure we have some context, even if not topic-specific
    if (relevantMessages.length === 0) {
      return history.slice(-3);
    }

    return relevantMessages.slice(-7); // Limit relevant history
  }
}