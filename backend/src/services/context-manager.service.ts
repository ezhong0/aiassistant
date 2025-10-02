import { BaseService } from './base-service';
import { SlackContext } from '../types/slack/slack.types';
import { CacheService } from './cache.service';
// Context management service types
interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  timestamp: Date;
  isRead: boolean;
  priority?: 'high' | 'normal' | 'low';
}

interface CalendarConflict {
  eventId: string;
  summary: string;
  start: Date;
  end: Date;
  attendees: string[];
}

interface EssentialContext {
  userInput: string;
  sessionId: string;
  timestamp: Date;
  recentEmails?: EmailSummary[];
  calendarConflicts?: CalendarConflict[];
  relationshipTone?: string;
  hasUrgentItems?: boolean;
  riskLevel?: string;
}

interface ActionIntent {
  type: string;
  confidence: number;
  parameters?: Record<string, unknown>;
  needsContext?: boolean;
  riskLevel?: string;
  target?: string;
}

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
  // Cache TTL for context (5 minutes)
  private readonly CONTEXT_CACHE_TTL = 300;

  // Maximum conversation history to maintain
  private readonly MAX_HISTORY_LENGTH = 20;

  constructor(private readonly cacheService: CacheService) {
    super('ContextManager');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    // Check cache availability (avoid proxy access with typeof check)
    const hasCacheService = this.cacheService && typeof this.cacheService === 'object';
    if (hasCacheService) {
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
      sessionId,
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
      contextScore: contextAnalysis.contextScore,
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
        contextScore,
      };

      this.logDebug('Context analysis completed', {
        sessionId: context.sessionId,
        keyEntitiesCount: keyEntities.length,
        conversationTopic,
        contextScore,
        relevantHistoryLength: relevantHistory.length,
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
        contextScore: 0.5,
      };
    }
  }

  /**
   * Get recent Slack messages for context
   *
   * @param slackContext - Slack context information
   * @returns Promise resolving to recent messages
   */
  async getRecentSlackMessages(_slackContext: SlackContext): Promise<Array<{
    text: string;
    user: string;
    timestamp: string;
  }>> {
    this.assertReady();

    // TODO: Inject SlackService if needed for Slack context
    // const slackService = this.slackService;
    // if (!slackService) {
    //   this.logWarn('Slack service not available for message context');
    //   return [];
    // }

    // This would integrate with Slack service to get recent messages
    // For now, return empty array as placeholder
    return [];
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
        this.cacheService.del(`history:${sessionId}`),
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
      slackContext,
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

  /**
   * Discover essential context for risk-based execution (Claude Code approach)
   * Only gathers immediately relevant information - no deep analysis
   */
  async discoverEssentialContext(
    intent: ActionIntent,
    sessionId: string,
  ): Promise<EssentialContext> {
    this.assertReady();

    if (!intent.needsContext) {
      return { userInput: '', sessionId: '', timestamp: new Date() }; // Skip context discovery for low-risk actions
    }

    this.logDebug('Gathering essential context', {
      sessionId,
      intentType: intent.type,
      riskLevel: intent.riskLevel,
    });

    const context: EssentialContext = {
      userInput: '',
      sessionId: '',
      timestamp: new Date(),
    };

    try {
      // Parallel discovery of essential context elements
      const discoveries = await Promise.all([
        intent.target ? this.getRecentEmailsFrom(intent.target) : Promise.resolve([]),
        intent.type.includes('schedule') || intent.type.includes('calendar') ? this.getCalendarConflicts() : Promise.resolve([]),
        intent.target ? this.getBasicTone(intent.target) : Promise.resolve('unknown' as const),
      ]);

      context.recentEmails = discoveries[0];
      context.calendarConflicts = discoveries[1];
      context.relationshipTone = discoveries[2];

      // Check for urgent items in recent conversations
      context.hasUrgentItems = await this.checkForUrgentItems(sessionId);

      this.logInfo('Essential context discovery completed', {
        sessionId,
        emailsFound: context.recentEmails?.length || 0,
        conflictsFound: context.calendarConflicts?.length || 0,
        relationshipTone: context.relationshipTone,
        hasUrgentItems: context.hasUrgentItems,
      });

      return context;
    } catch (error) {
      this.logError('Failed to discover essential context', { error, sessionId, intent });
      return { userInput: '', sessionId: '', timestamp: new Date() }; // Return empty context on failure
    }
  }

  /**
   * Get recent emails from a specific contact (simplified)
   */
  private async getRecentEmailsFrom(target: string): Promise<Array<{from: string, subject: string, date: Date}>> {
    try {
      // TODO: Refactor to inject EmailDomainService if this feature is needed
      // const emailAgent = this.emailDomainService;
      // if (!emailAgent) return [];

      // Simple search for recent emails from target
      // Note: executeOperation method removed, using fallback
      const result = null; 
      /*
      const result = await emailAgent.executeOperation?.('search', {
        query: `from:${target}`,
        maxResults: 3
      });
      */

      if (result && (result as Record<string, unknown>)?.emails) {
        return ((result as Record<string, unknown>).emails as EmailSummary[]).map((email: EmailSummary) => ({
          from: email.from || target,
          subject: email.subject || 'No subject',
          date: new Date((email as any).date || Date.now()),
        }));
      }

      return [];
    } catch (error) {
      this.logWarn('Failed to get recent emails', { error, target });
      return [];
    }
  }

  /**
   * Check for calendar conflicts (simplified)
   */
  private async getCalendarConflicts(): Promise<Array<{title: string, time: Date}>> {
    try {
      // TODO: Refactor to inject CalendarDomainService if this feature is needed
      // const calendarAgent = this.calendarDomainService;
      // if (!calendarAgent) return [];

      // Simple check for today's events
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Note: executeOperation method removed, using fallback
      const result = null;
      /*
      const result = await calendarAgent.executeOperation?.('list', {
        timeMin: today,
        timeMax: tomorrow
      });
      */

      if (result && (result as Record<string, unknown>)?.events) {
        return ((result as Record<string, unknown>).events as CalendarConflict[]).slice(0, 3).map((event: CalendarConflict) => ({
          title: (event as any).title || event.summary || 'Untitled event',
          time: new Date((event.start as any)?.dateTime || (event.start as any)?.date || Date.now()),
        }));
      }

      return [];
    } catch (error) {
      this.logWarn('Failed to get calendar conflicts', { error });
      return [];
    }
  }

  /**
   * Get basic relationship tone (simplified)
   */
  private async getBasicTone(target: string): Promise<'formal' | 'casual' | 'unknown'> {
    try {
      const emails = await this.getRecentEmailsFrom(target);

      // Simple heuristic: if we have recent email history, default to casual
      if (emails.length > 0) {
        // Could analyze email content here for more sophistication
        // For now, simple rule: if target is an email domain we recognize as business, formal
        if (target.includes('@company.com') || target.includes('@corp.') || target.includes('.gov')) {
          return 'formal';
        }
        return 'casual';
      }

      return 'unknown';
    } catch (error) {
      this.logWarn('Failed to determine relationship tone', { error, target });
      return 'unknown';
    }
  }

  /**
   * Check for urgent items in recent conversation
   */
  private async checkForUrgentItems(sessionId: string): Promise<boolean> {
    try {
      const recentHistory = await this.getRecentConversation(sessionId);
      const recentText = recentHistory.slice(-5).join(' ').toLowerCase();

      // Simple urgency indicators
      const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'deadline'];
      return urgentKeywords.some(keyword => recentText.includes(keyword));
    } catch (error) {
      this.logWarn('Failed to check for urgent items', { error, sessionId });
      return false;
    }
  }
}