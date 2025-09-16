import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { SLACK_SERVICE_CONSTANTS } from '../../config/slack-service-constants';
import logger from '../../utils/logger';

/**
 * Slack message reading result
 */
export interface SlackMessageReadingResult {
  success: boolean;
  messages?: any[];
  count?: number;
  error?: string;
}

/**
 * SlackMessageAnalyzer - Focused service for Slack message operations
 * Handles reading Slack message history and thread analysis
 */
export class SlackMessageAnalyzer extends BaseService {
  constructor() {
    super(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_MESSAGE_ANALYZER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackMessageAnalyzer...');
      this.logInfo('SlackMessageAnalyzer initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying SlackMessageAnalyzer...');
      this.logInfo('SlackMessageAnalyzer destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackMessageAnalyzer destruction', error);
    }
  }

  /**
   * Read message history from a Slack channel (stub implementation)
   */
  async readMessageHistory(
    channelId: string,
    options: {
      limit?: number;
      oldest?: string;
      latest?: string;
      includeAllMetadata?: boolean;
    } = {}
  ): Promise<SlackMessageReadingResult> {
    try {
      this.logInfo('Reading Slack message history (stub)', {
        channelId,
        limit: options.limit
      });

      // Stub implementation - return empty result
      return {
        success: true,
        messages: [],
        count: 0
      };
    } catch (error) {
      this.logError('Error reading Slack message history', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.MESSAGE_READING_FAILED
      };
    }
  }

  /**
   * Read thread messages (stub implementation)
   */
  async readThreadMessages(
    channelId: string,
    threadTs: string,
    options: {
      limit?: number;
      includeAllMetadata?: boolean;
    } = {}
  ): Promise<SlackMessageReadingResult> {
    try {
      this.logInfo('Reading Slack thread messages (stub)', {
        channelId,
        threadTs,
        limit: options.limit
      });

      // Stub implementation - return empty result
      return {
        success: true,
        messages: [],
        count: 0
      };
    } catch (error) {
      this.logError('Error reading Slack thread messages', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.THREAD_READING_FAILED
      };
    }
  }

  /**
   * Analyze conversation context
   */
  async analyzeConversationContext(
    messages: any[],
    options: {
      includeSentiment?: boolean;
      includeKeyTopics?: boolean;
      includeActionItems?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    analysis?: {
      summary?: string;
      keyTopics?: string[];
      actionItems?: string[];
      sentiment?: string;
      participantCount?: number;
    };
    error?: string;
  }> {
    try {
      this.logInfo('Analyzing conversation context', {
        messageCount: messages.length,
        includeSentiment: options.includeSentiment,
        includeKeyTopics: options.includeKeyTopics,
        includeActionItems: options.includeActionItems
      });

      // Basic analysis - extract key information
      const analysis = {
        summary: this.generateConversationSummary(messages),
        keyTopics: options.includeKeyTopics ? this.extractKeyTopics(messages) : undefined,
        actionItems: options.includeActionItems ? this.extractActionItems(messages) : undefined,
        sentiment: options.includeSentiment ? this.analyzeSentiment(messages) : undefined,
        participantCount: this.countParticipants(messages)
      };

      this.logInfo('Conversation context analysis completed', {
        summaryLength: analysis.summary?.length,
        keyTopicsCount: analysis.keyTopics?.length,
        actionItemsCount: analysis.actionItems?.length,
        participantCount: analysis.participantCount
      });

      return {
        success: true,
        analysis
      };
    } catch (error) {
      this.logError('Error analyzing conversation context', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.CONVERSATION_ANALYSIS_FAILED
      };
    }
  }

  /**
   * Generate conversation summary
   */
  private generateConversationSummary(messages: any[]): string {
    if (messages.length === 0) return 'No messages found';
    
    const recentMessages = messages.slice(-5); // Last 5 messages
    const summaries = recentMessages.map(msg => {
      const text = msg.text || msg.message?.text || '';
      return text.length > 100 ? text.substring(0, 100) + '...' : text;
    });
    
    return summaries.join(' | ');
  }

  /**
   * Extract key topics from messages
   */
  private extractKeyTopics(messages: any[]): string[] {
    const topics = new Set<string>();
    
    messages.forEach(msg => {
      const text = msg.text || msg.message?.text || '';
      // Simple keyword extraction - look for capitalized words and common topics
      const words = text.split(/\s+/).filter((word: string) => 
        word.length > 3 && 
        /^[A-Z]/.test(word) && 
        !['The', 'This', 'That', 'They', 'There', 'Then', 'When', 'Where', 'What', 'Why', 'How'].includes(word)
      );
      words.forEach((word: string) => topics.add(word));
    });
    
    return Array.from(topics).slice(0, 10); // Top 10 topics
  }

  /**
   * Extract action items from messages
   */
  private extractActionItems(messages: any[]): string[] {
    const actionItems: string[] = [];
    
    messages.forEach(msg => {
      const text = msg.text || msg.message?.text || '';
      // Look for action-oriented phrases
      const actionPatterns = [
        /need to (.+)/gi,
        /should (.+)/gi,
        /must (.+)/gi,
        /will (.+)/gi,
        /todo: (.+)/gi,
        /action: (.+)/gi
      ];
      
      actionPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match: string) => actionItems.push(match.trim()));
        }
      });
    });
    
    return actionItems.slice(0, 10); // Top 10 action items
  }

  /**
   * Analyze sentiment of messages
   */
  private analyzeSentiment(messages: any[]): string {
    if (messages.length === 0) return 'neutral';
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'amazing', 'love', 'happy', 'excited'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'disappointed', 'sad'];
    
    messages.forEach(msg => {
      const text = (msg.text || msg.message?.text || '').toLowerCase();
      
      positiveWords.forEach(word => {
        if (text.includes(word)) positiveCount++;
      });
      
      negativeWords.forEach(word => {
        if (text.includes(word)) negativeCount++;
      });
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Count unique participants
   */
  private countParticipants(messages: any[]): number {
    const participants = new Set<string>();
    
    messages.forEach(msg => {
      const userId = msg.user || msg.message?.user;
      if (userId) {
        participants.add(userId);
      }
    });
    
    return participants.size;
  }

  /**
   * Get service statistics
   */
  getAnalyzerStats(): {
    serviceName: string;
    supportedOperations: string[];
  } {
    return {
      serviceName: SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_MESSAGE_ANALYZER,
      supportedOperations: ['read_messages', 'read_thread', 'analyze_conversation']
    };
  }
}
