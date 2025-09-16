import { BaseService } from '../base-service';
import { SLACK_SERVICE_CONSTANTS } from '../../config/slack-service-constants';
import logger from '../../utils/logger';

/**
 * Slack formatting result
 */
export interface SlackFormattingResult {
  success: boolean;
  formattedMessage?: any;
  formattedText?: string;
  error?: string;
}

/**
 * Slack result interface - Intent-agnostic
 * No hardcoded action strings - result content determines formatting
 */
export interface SlackResult {
  messages?: any[];
  count?: number;
  summary?: string;
  keyTopics?: string[];
  actionItems?: string[];
  sentiment?: string;
  participantCount?: number;
  drafts?: any[];
  isConfirmation?: boolean;
  confirmationType?: string;
}

/**
 * SlackFormatter - Focused service for Slack response formatting
 * Handles formatting of Slack results for user display
 */
export class SlackFormatter extends BaseService {
  constructor() {
    super(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_FORMATTER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackFormatter...');
      this.logInfo('SlackFormatter initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying SlackFormatter...');
      this.logInfo('SlackFormatter destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackFormatter destruction', error);
    }
  }

  /**
   * Format Slack result for display - Intent-agnostic formatting
   * No hardcoded action cases - formats based on result content
   */
  formatSlackResult(result: SlackResult): SlackFormattingResult {
    try {
      let formattedText = '';

      // Format based on result content, not hardcoded action strings
      if (result.messages && result.messages.length > 0) {
        // Messages result - format as message list
        formattedText = this.formatMessageListResult(result);
      } else if (result.summary || result.keyTopics || result.actionItems) {
        // Conversation analysis result - format as analysis
        formattedText = this.formatConversationAnalysisResult(result);
      } else if (result.drafts && result.drafts.length > 0) {
        // Drafts result - format as draft list
        formattedText = this.formatDraftListResult(result);
      } else if (result.isConfirmation !== undefined) {
        // Confirmation result - format as confirmation status
        formattedText = this.formatConfirmationResult(result);
      } else if (result.count !== undefined) {
        // Operation completed with count - format as summary
        formattedText = this.formatSlackSummaryResult(result);
      } else {
        // Generic success message
        formattedText = SLACK_SERVICE_CONSTANTS.SUCCESS.SLACK_OPERATION_COMPLETED;
      }

      const slackMessage = {
        text: formattedText,
        blocks: undefined
      };

      this.logInfo('Slack result formatted successfully', {
        hasMessages: !!(result.messages?.length),
        hasAnalysis: !!(result.summary || result.keyTopics || result.actionItems),
        hasDrafts: !!(result.drafts?.length),
        hasConfirmation: result.isConfirmation !== undefined,
        messageLength: formattedText.length
      });

      return {
        success: true,
        formattedMessage: slackMessage,
        formattedText
      };
    } catch (error) {
      this.logError('Error formatting Slack result', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Format message list result (read operations)
   */
  private formatMessageListResult(result: SlackResult): string {
    const count = result.count || 0;
    const messages = result.messages || [];

    if (count === 0) {
      return SLACK_SERVICE_CONSTANTS.FORMATTING.NO_MESSAGES_FOUND;
    }

    const parts = [`📨 **Found ${count} message${count === 1 ? '' : 's'}**`];
    
    if (messages.length > 0) {
      // Show up to 5 most recent messages
      const recentMessages = messages.slice(0, SLACK_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_MESSAGES);
      recentMessages.forEach((message, index) => {
        if (message) {
          const text = this.extractMessageText(message);
          const user = this.extractMessageUser(message);
          const timestamp = this.formatMessageTimestamp(message);
          
          parts.push(`${index + 1}. **${user}** (${timestamp})`);
          parts.push(`   ${text}`);
          parts.push('');
        }
      });

      if (count > SLACK_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_MESSAGES) {
        parts.push(`... and ${count - SLACK_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_MESSAGES} more messages`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Format conversation analysis result
   */
  private formatConversationAnalysisResult(result: SlackResult): string {
    const parts: string[] = [SLACK_SERVICE_CONSTANTS.FORMATTING.CONVERSATION_SUMMARY_HEADER];
    
    if (result.summary) {
      parts.push(`\n${SLACK_SERVICE_CONSTANTS.FORMATTING.CONVERSATION_SUMMARY_LABEL} ${result.summary}`);
    }
    
    if (result.keyTopics && result.keyTopics.length > 0) {
      const topics = result.keyTopics.slice(0, SLACK_SERVICE_CONSTANTS.LIMITS.MAX_TOPICS_LENGTH).join(', ');
      parts.push(`\n${SLACK_SERVICE_CONSTANTS.FORMATTING.KEY_TOPICS_LABEL} ${topics}`);
    }
    
    if (result.actionItems && result.actionItems.length > 0) {
      const actionItems = result.actionItems.slice(0, SLACK_SERVICE_CONSTANTS.LIMITS.MAX_ACTION_ITEMS_LENGTH);
      parts.push(`\n${SLACK_SERVICE_CONSTANTS.FORMATTING.ACTION_ITEMS_LABEL}`);
      actionItems.forEach((item, index) => {
        parts.push(`${index + 1}. ${item}`);
      });
    }
    
    if (result.sentiment) {
      const sentimentEmoji = this.getSentimentEmoji(result.sentiment);
      parts.push(`\n${SLACK_SERVICE_CONSTANTS.FORMATTING.SENTIMENT_LABEL} ${sentimentEmoji} ${result.sentiment}`);
    }
    
    if (result.participantCount) {
      parts.push(`\n${SLACK_SERVICE_CONSTANTS.FORMATTING.PARTICIPANTS_LABEL} ${result.participantCount}`);
    }

    return parts.join('\n');
  }

  /**
   * Format draft list result
   */
  private formatDraftListResult(result: SlackResult): string {
    const count = result.count || 0;
    const drafts = result.drafts || [];

    if (count === 0) {
      return SLACK_SERVICE_CONSTANTS.FORMATTING.NO_DRAFTS_FOUND;
    }

    const parts = [`📝 **Found ${count} draft${count === 1 ? '' : 's'}**`];
    
    if (drafts.length > 0) {
      drafts.slice(0, 5).forEach((draft, index) => {
        if (draft) {
          const text = this.truncateText(draft.text || '', 100);
          const scheduledTime = draft.scheduledTime ? this.formatTimestamp(draft.scheduledTime) : 'Not scheduled';
          
          parts.push(`${index + 1}. **Draft ${draft.id}**`);
          parts.push(`   📝 ${text}`);
          parts.push(`   ⏰ ${scheduledTime}`);
          parts.push('');
        }
      });

      if (count > 5) {
        parts.push(`... and ${count - 5} more drafts`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Format confirmation result
   */
  private formatConfirmationResult(result: SlackResult): string {
    if (result.isConfirmation) {
      return SLACK_SERVICE_CONSTANTS.FORMATTING.CONFIRMATION_DETECTED;
    } else {
      return SLACK_SERVICE_CONSTANTS.FORMATTING.CONFIRMATION_PROCESSED;
    }
  }

  /**
   * Format Slack summary result (operations with counts)
   */
  private formatSlackSummaryResult(result: SlackResult): string {
    const count = result.count || 0;
    return `✅ **Operation completed successfully** - ${count} item${count === 1 ? '' : 's'} processed.`;
  }

  /**
   * Extract message text
   */
  private extractMessageText(message: any): string {
    const text = message.text || message.message?.text || '';
    return this.truncateText(text, SLACK_SERVICE_CONSTANTS.LIMITS.MAX_TEXT_TRUNCATE);
  }

  /**
   * Extract message user
   */
  private extractMessageUser(message: any): string {
    return message.user || message.message?.user || SLACK_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_USER;
  }

  /**
   * Format message timestamp
   */
  private formatMessageTimestamp(message: any): string {
    const timestamp = message.ts || message.message?.ts || message.timestamp;
    if (timestamp) {
      return this.formatTimestamp(timestamp);
    }
    return 'Unknown time';
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: string | number): string {
    try {
      const date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid time';
    }
  }

  /**
   * Get sentiment emoji
   */
  private getSentimentEmoji(sentiment: string): string {
    switch (sentiment.toLowerCase()) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '😐';
    }
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Format error message
   */
  formatErrorMessage(error: Error, operation: string): SlackFormattingResult {
    try {
      const errorMessage = `❌ **Slack ${operation} failed**\n\n${error.message}`;
      
      return {
        success: true,
        formattedText: errorMessage
      };
    } catch (formatError) {
      return {
        success: false,
        error: 'Failed to format error message'
      };
    }
  }

  /**
   * Get formatter statistics
   */
  getFormatterStats(): {
    serviceName: string;
    supportedOperations: string[];
  } {
    return {
      serviceName: SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_FORMATTER,
      supportedOperations: Object.values(SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS)
    };
  }
}
