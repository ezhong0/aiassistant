import { BaseService } from './base-service';
import { EmailResult } from '../agents/email-agent-refactored';
import { GmailMessage } from '../types/gmail.types';
import { SlackMessage } from '../types/slack.types';
import { EMAIL_SERVICE_CONSTANTS } from '../config/email-service-constants';
import logger from '../utils/logger';

/**
 * Email formatting result
 */
export interface EmailFormattingResult {
  success: boolean;
  formattedMessage?: SlackMessage;
  formattedText?: string;
  error?: string;
}

/**
 * EmailFormatter - Focused service for email response formatting
 * Handles formatting email results into user-friendly messages
 */
export class EmailFormatter extends BaseService {

  constructor() {
    super('EmailFormatter');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing EmailFormatter...');
      this.logInfo('EmailFormatter initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('EmailFormatter destroyed successfully');
    } catch (error) {
      this.logError('Error during EmailFormatter destruction', error);
    }
  }

  /**
   * Format email result for Slack - Intent-agnostic formatting
   * No hardcoded action cases - formats based on result content
   */
  formatEmailResult(result: EmailResult): EmailFormattingResult {
    try {
      let formattedText = '';

      // Format based on result content, not hardcoded action strings
      if (result.messageId && result.threadId) {
        // Email was sent/replied - format as success message
        formattedText = this.formatEmailSuccessResult(result);
      } else if (result.emails && result.emails.length > 0) {
        // Emails were retrieved/searched - format as search results
        formattedText = this.formatEmailSearchResult(result);
      } else if (result.draft) {
        // Draft was created - format as draft message
        formattedText = this.formatEmailDraftResult(result);
      } else if (result.count !== undefined) {
        // Operation completed with count - format as summary
        formattedText = this.formatEmailSummaryResult(result);
      } else {
        // Generic success message
        formattedText = EMAIL_SERVICE_CONSTANTS.DEFAULTS.EMAIL_OPERATION_COMPLETED;
      }

      const slackMessage: SlackMessage = {
        text: formattedText,
        blocks: undefined
      };

      this.logInfo('Email result formatted successfully', {
        hasMessageId: !!result.messageId,
        hasEmails: !!(result.emails?.length),
        hasDraft: !!result.draft,
        messageLength: formattedText.length
      });

      return {
        success: true,
        formattedMessage: slackMessage,
        formattedText
      };
    } catch (error) {
      this.logError('Error formatting email result', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : EMAIL_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Format email success result (send/reply operations)
   */
  private formatEmailSuccessResult(result: EmailResult): string {
    const parts: string[] = [EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_SENT_SUCCESS];
    
    if (result.recipient) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_TO_LABEL} ${result.recipient}`);
    }
    
    if (result.subject) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_SUBJECT_LABEL} ${result.subject}`);
    }
    
    if (result.messageId) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_MESSAGE_ID_LABEL} ${result.messageId}`);
    }
    
    if (result.threadId) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_THREAD_ID_LABEL} ${result.threadId}`);
    }

    return parts.join('\n');
  }

  /**
   * Format email search result (search/get operations)
   */
  private formatEmailSearchResult(result: EmailResult): string {
    const count = result.count || 0;
    const emails = result.emails || [];

    if (count === 0) {
      return EMAIL_SERVICE_CONSTANTS.FORMATTING.NO_EMAILS_FOUND;
    }

    const parts = [`🔍 **Found ${count} email${count === 1 ? '' : 's'}**`];
    
    if (emails.length > 0) {
      parts.push(`\n${EMAIL_SERVICE_CONSTANTS.FORMATTING.RECENT_EMAILS}`);
      
      // Show up to 5 most recent emails
      const recentEmails = emails.slice(0, EMAIL_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_EMAILS);
      recentEmails.forEach((email, index) => {
        if (email) {
          const from = this.extractSender(email);
          const subject = this.extractSubject(email);
          const date = this.formatEmailDate(email);
          
          parts.push(`${index + 1}. **${subject}**`);
          parts.push(`   From: ${from}`);
          parts.push(`   Date: ${date}`);
          parts.push('');
        }
      });

      if (count > EMAIL_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_EMAILS) {
        parts.push(`... and ${count - EMAIL_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_EMAILS} more emails`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Format email draft result
   */
  private formatEmailDraftResult(result: EmailResult): string {
    const parts: string[] = [EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_DRAFT_SUCCESS];
    
    if (result.recipient) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_TO_LABEL} ${result.recipient}`);
    }
    
    if (result.subject) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_SUBJECT_LABEL} ${result.subject}`);
    }
    
    if (result.draft?.id) {
      parts.push(`${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_DRAFT_ID_LABEL} ${result.draft.id}`);
    }

    parts.push(`\n${EMAIL_SERVICE_CONSTANTS.FORMATTING.EMAIL_TIP}`);

    return parts.join('\n');
  }

  /**
   * Format email summary result (operations with counts)
   */
  private formatEmailSummaryResult(result: EmailResult): string {
    const count = result.count || 0;
    return `✅ **Operation completed successfully** - ${count} email${count === 1 ? '' : 's'} processed.`;
  }

  /**
   * Format error message
   */
  formatErrorMessage(error: Error, operation: string): EmailFormattingResult {
    try {
      const errorMessage = this.getUserFriendlyErrorMessage(error, operation);
      
      const slackMessage: SlackMessage = {
        text: errorMessage,
        blocks: undefined
      };

      return {
        success: true,
        formattedMessage: slackMessage,
        formattedText: errorMessage
      };
    } catch (formatError) {
      this.logError('Error formatting error message', formatError);
      return {
        success: false,
        error: 'Failed to format error message'
      };
    }
  }

  /**
   * Extract sender from email
   */
  private extractSender(email: GmailMessage): string {
    try {
      return email.from || EMAIL_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_SENDER;
    } catch (error) {
      return EMAIL_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_SENDER;
    }
  }

  /**
   * Extract subject from email
   */
  private extractSubject(email: GmailMessage): string {
    try {
      return email.subject || EMAIL_SERVICE_CONSTANTS.DEFAULTS.NO_SUBJECT_FALLBACK;
    } catch (error) {
      return EMAIL_SERVICE_CONSTANTS.DEFAULTS.NO_SUBJECT_FALLBACK;
    }
  }

  /**
   * Format email date
   */
  private formatEmailDate(email: GmailMessage): string {
    try {
      if (email.date) {
        const date = new Date(email.date);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }
      return EMAIL_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_DATE;
    } catch (error) {
      return EMAIL_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_DATE;
    }
  }

  /**
   * Extract email body
   */
  private extractEmailBody(email: GmailMessage): string {
    try {
      // Use the body field directly from GmailMessage
      if (email.body) {
        return this.truncateText(email.body, EMAIL_SERVICE_CONSTANTS.LIMITS.MAX_TEXT_TRUNCATE);
      }
      
      // Fallback to snippet if body is not available
      if (email.snippet) {
        return this.truncateText(email.snippet, EMAIL_SERVICE_CONSTANTS.LIMITS.MAX_TEXT_TRUNCATE);
      }
      
      return EMAIL_SERVICE_CONSTANTS.DEFAULTS.NO_CONTENT;
    } catch (error) {
      return EMAIL_SERVICE_CONSTANTS.DEFAULTS.ERROR_EXTRACTING_CONTENT;
    }
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyErrorMessage(error: Error, operation: string): string {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      return `🔐 **Authentication Error**\n\nI need permission to access your Gmail account. Please re-authorize the app to continue with ${operation}.`;
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      return `⏰ **Rate Limit Reached**\n\nGmail API rate limit exceeded. Please try again in a few minutes.`;
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return `❌ **Not Found**\n\nThe requested email or resource was not found. Please check your request and try again.`;
    }
    
    if (errorMessage.includes('invalid') || errorMessage.includes('bad request')) {
      return `❌ **Invalid Request**\n\nThere was an issue with your request. Please check the details and try again.`;
    }
    
    // Generic error message
    return `❌ **Error**\n\nSorry, there was an error with your ${operation} request. Please try again.`;
  }

  /**
   * Get formatter statistics
   */
  getFormatterStats(): {
    serviceName: string;
    supportedActions: string[];
  } {
    return {
      serviceName: EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_FORMATTER,
      supportedActions: Object.values(EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS)
    };
  }
}
