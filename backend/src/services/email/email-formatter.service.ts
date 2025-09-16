import { BaseService } from '../base-service';
import { EmailResult } from '../../agents/email.agent';
import { GmailMessage } from '../../types/email/gmail.types';
import { SlackMessage } from '../../types/slack/slack.types';
import { EMAIL_SERVICE_CONSTANTS } from '../../config/email-service-constants';
import logger from '../../utils/logger';

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

  /**
   * Generate conversational proposal from tool calls
   * Delegated from MasterAgent for proper separation of concerns
   */
  async generateProposal(
    userInput: string,
    toolCalls: any[],
    contextGathered?: any,
    slackContext?: any
  ): Promise<any> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService || toolCalls.length === 0) {
        return undefined;
      }

      // Only generate proposals for non-Thinking tool calls
      const actionToolCalls = toolCalls.filter((tc: any) => tc.name !== 'Think');
      this.logInfo('Proposal generation - filtering tool calls', {
        originalToolCalls: toolCalls.map((tc: any) => tc.name),
        actionToolCalls: actionToolCalls.map((tc: any) => tc.name),
        filteredCount: actionToolCalls.length
      });
      
      if (actionToolCalls.length === 0) {
        this.logWarn('No action tool calls found for proposal generation');
        return undefined;
      }

      const proposalPrompt = `Transform these technical tool calls into a conversational proposal for the user:

User Request: "${userInput}"
Tool Calls: ${JSON.stringify(actionToolCalls, null, 2)}
${contextGathered ? `Context: ${contextGathered.relevantContext}` : ''}

Generate a natural, conversational proposal that:
1. Explains what action will be taken in plain language
2. Includes ALL relevant details from the tool calls (recipient, subject, body content, etc.)
3. Shows the full email body content when it's an email action
4. Asks for confirmation in a friendly way
5. Uses "I'll" or "I will" language

IMPORTANT: For email and calendar actions, ALWAYS set requiresConfirmation to true.

Return JSON:
{
  "text": "conversational proposal text",
  "actionType": "email|calendar|contact|other",
  "confidence": number (0-1),
  "requiresConfirmation": boolean (true for email/calendar actions)
}

Examples:
- Tool call: send_email with recipient="john@example.com", subject="Project Update", body="Here is the latest status..."
  → {"text": "I'll send an email to john@example.com with the subject 'Project Update' and the message 'Here is the latest status...'. Should I proceed?", "actionType": "email", "confidence": 0.9, "requiresConfirmation": true}

- Tool call: create_calendar_event with title="Team Meeting", startTime="2024-01-15T10:00:00Z"
  → {"text": "I'll create a calendar event called 'Team Meeting' for January 15th at 10:00 AM. Should I proceed?", "actionType": "calendar", "confidence": 0.9, "requiresConfirmation": true}`;

      const response = await openaiService.generateStructuredData(
        userInput,
        proposalPrompt,
        {
          type: 'object',
          properties: {
            text: { type: 'string' },
            actionType: { 
              type: 'string', 
              enum: ['email', 'calendar', 'contact', 'other'] 
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            requiresConfirmation: { type: 'boolean' }
          },
          required: ['text', 'actionType', 'confidence', 'requiresConfirmation']
        },
        { temperature: 0.3, maxTokens: 500 }
      );

      // Add original tool calls to the response
      const proposal = {
        ...response,
        originalToolCalls: actionToolCalls
      };

      this.logInfo('Proposal generated successfully', {
        actionType: proposal.actionType,
        confidence: proposal.confidence,
        requiresConfirmation: proposal.requiresConfirmation,
        toolCallCount: actionToolCalls.length
      });

      return proposal;
    } catch (error) {
      this.logError('Failed to generate proposal:', error);
      return undefined;
    }
  }

  /**
   * Get OpenAI service for proposal generation
   */
  private getOpenAIService(): any {
    const { getService } = require('./service-manager');
    return getService('openaiService');
  }
}
