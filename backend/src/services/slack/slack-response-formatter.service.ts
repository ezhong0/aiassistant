import { BaseService } from '../base-service';
import { SlackContext, SlackResponse } from '../../types/slack/slack.types';
import { EmailFormatter } from '../email/email-formatter.service';
import { serviceManager } from '../service-manager';
import logger from '../../utils/logger';

export interface SlackResponseFormatterConfig {
  enableRichFormatting: boolean;
  maxTextLength: number;
  enableProposalFormatting: boolean;
}

/**
 * SlackResponseFormatter - Focused service for formatting Slack responses
 * Handles response formatting, proposal formatting, and message optimization
 */
export class SlackResponseFormatter extends BaseService {
  private config: SlackResponseFormatterConfig;
  private emailFormatter: EmailFormatter | null = null;

  constructor(config: SlackResponseFormatterConfig) {
    super('SlackResponseFormatter');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackResponseFormatter...');
      
      // Initialize service dependencies
      await this.initializeDependencies();
      
      this.logInfo('SlackResponseFormatter initialized successfully', {
        enableRichFormatting: this.config.enableRichFormatting,
        maxTextLength: this.config.maxTextLength,
        enableProposalFormatting: this.config.enableProposalFormatting,
        hasEmailFormatter: !!this.emailFormatter
      });
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.emailFormatter = null;
      this.logInfo('SlackResponseFormatter destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackResponseFormatter destruction', error);
    }
  }

  /**
   * Format agent response for Slack
   */
  async formatAgentResponse(
    masterResponse: any, 
    slackContext: SlackContext
  ): Promise<SlackResponse> {
    try {
      // Check if we have a proposal to handle
      if (masterResponse.proposal && masterResponse.proposal.text) {
        return this.formatProposalResponse(masterResponse.proposal, masterResponse, slackContext);
      }
      
      // Handle cases where no proposal was generated but we have a message
      if (masterResponse.message) {
        return {
          text: masterResponse.message
        };
      }
      
      // Handle cases where we have tool results but no proposal
      if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
        const successfulResults = masterResponse.toolResults.filter((result: any) => result.success);
        if (successfulResults.length > 0) {
          return {
            text: this.generateSuccessMessage(successfulResults, masterResponse)
          };
        }
      }
      
      // Default fallback - provide helpful message
      return {
        text: 'I received your request but encountered an issue processing it. Please try again or rephrase your request.'
      };
    } catch (error) {
      this.logError('Error formatting agent response', error);
      return { text: masterResponse.message || 'I processed your request successfully.' };
    }
  }

  /**
   * Format proposal response as natural text with optional confirmation buttons
   */
  private async formatProposalResponse(
    proposal: any,
    masterResponse: any,
    slackContext: SlackContext
  ): Promise<SlackResponse> {
    try {
      if (proposal.requiresConfirmation) {
        // Always use simple text for proposals to look more natural and conversational
        const maxTextLength = this.config.maxTextLength;
        
        if (proposal.text.length > maxTextLength) {
          // Split long proposal into multiple blocks
          const blocks = [];
          let remainingText = proposal.text;
          
          while (remainingText.length > 0) {
            const chunk = remainingText.substring(0, maxTextLength);
            remainingText = remainingText.substring(maxTextLength);
            
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: chunk
              }
            });
          }
          
          // Add confirmation buttons
          blocks.push({
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Yes, go ahead',
                  emoji: true
                },
                value: `proposal_confirm_${Date.now()}`,
                action_id: `proposal_confirm_${Date.now()}`,
                style: 'primary'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'No, cancel',
                  emoji: true
                },
                value: `proposal_cancel_${Date.now()}`,
                action_id: `proposal_cancel_${Date.now()}`,
                style: 'danger'
              }
            ]
          });
          
          return {
            text: proposal.text.substring(0, 1000) + '...', // Fallback text
            blocks: blocks
          };
        } else {
          // Short proposal - use simple text for natural conversation
          let proposalWithInstructions = proposal.text;
          
          // Add friendly confirmation prompt
          if (!proposalWithInstructions.includes('Should I') && !proposalWithInstructions.includes('go ahead')) {
            proposalWithInstructions += '\n\nShould I go ahead? Just reply "yes" or "no".';
          }
          
          return {
            text: proposalWithInstructions
          };
        }
      } else {
        // Simple text response for proposals that don't require confirmation
        return {
          text: proposal.text
        };
      }
    } catch (error) {
      this.logError('Error formatting proposal response', error);
      return {
        text: proposal.text || masterResponse.message || 'Response processing failed'
      };
    }
  }


  /**
   * Generate natural language success message based on tool results
   */
  private generateSuccessMessage(successfulResults: any[], masterResponse: any): string {
    if (successfulResults.length === 0) {
      return 'I processed your request successfully.';
    }

    // Check what types of actions were performed - Intent-agnostic filtering
    // Filter results based on result content, not hardcoded tool names
    const emailResults = successfulResults.filter(r => 
      r.result && (
        (r.result as any).data?.messageId || 
        (r.result as any).data?.emails || 
        (r.result as any).data?.draft
      )
    );
    const contactResults = successfulResults.filter(r => 
      r.result && (r.result as any).data?.contacts
    );
    const calendarResults = successfulResults.filter(r => 
      r.result && (r.result as any).data?.events
    );

    let message = '';

    if (emailResults.length > 0) {
      const emailResult = emailResults[0];
      
      // Use EmailFormatter service for better formatting if available
      if (this.emailFormatter && emailResult.result) {
        try {
          const formattingResult = this.emailFormatter.formatEmailResult(emailResult.result);
          if (formattingResult.success && formattingResult.formattedText) {
            message = formattingResult.formattedText;
          } else {
            // Fallback to basic formatting
            message = this.formatBasicEmailResult(emailResult.result);
          }
        } catch (error) {
          this.logError('Error formatting email result with EmailFormatter', error);
          message = this.formatBasicEmailResult(emailResult.result);
        }
      } else {
        // Fallback to basic formatting
        message = this.formatBasicEmailResult(emailResult.result);
      }
    } else if (contactResults.length > 0) {
      message = '✅ I successfully found the contact information you requested.';
    } else if (calendarResults.length > 0) {
      message = '✅ I successfully managed your calendar event.';
    } else {
      message = `✅ Great! I successfully completed your request.`;
    }

    return message;
  }

  /**
   * Format basic email result as fallback when EmailFormatter is not available
   * Intent-agnostic formatting based on result content
   */
  private formatBasicEmailResult(emailResult: any): string {
    if (!emailResult) {
      return '✅ I successfully processed your email request.';
    }

    // Format based on result content, not hardcoded action strings
    if (emailResult.messageId && emailResult.threadId) {
      // Email was sent/replied
      let message = `✅ Great! I successfully sent your email`;
      if (emailResult.recipient) {
        message += ` to ${emailResult.recipient}`;
      }
      if (emailResult.subject) {
        message += ` about "${emailResult.subject}"`;
      }
      message += '.';
      return message;
    } else if (emailResult.emails && emailResult.emails.length > 0) {
      // Emails were retrieved/searched
      const count = emailResult.count || emailResult.emails.length;
      return `✅ I found ${count} email${count !== 1 ? 's' : ''} matching your search.`;
    } else if (emailResult.count !== undefined) {
      // Operation completed with count
      return `✅ I successfully processed your email request.`;
    } else {
      return '✅ I successfully processed your email request.';
    }
  }

  /**
   * Format OAuth required message
   */
  async formatOAuthRequiredMessage(context: SlackContext, oauthType: string): Promise<SlackResponse> {
    try {
      const oauthUrl = await this.generateOAuthUrl(context);
      
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔐 Gmail Authentication Required*\n' +
                  'To use email, calendar, or contact features, you need to connect your Gmail account first.\n\n' +
                  'This is a one-time setup that keeps your data secure.'
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text' as const,
              text: '🔗 Connect Gmail Account'
            },
            style: 'primary',
            action_id: 'gmail_oauth',
            url: oauthUrl
          }
        }
      ];

      return {
        text: 'Gmail authentication required. Please connect your Gmail account to use email features.',
        blocks: blocks
      };
    } catch (error) {
      this.logError('Error formatting OAuth required message', error);
      return {
        text: '🔐 Gmail authentication required. Please contact support to connect your Gmail account.'
      };
    }
  }

  /**
   * Generate OAuth URL for Slack user authentication
   */
  private async generateOAuthUrl(slackContext: SlackContext): Promise<string> {
    try {
      const { ENVIRONMENT } = await import('../../config/environment');
      const baseUrl = ENVIRONMENT.baseUrl;
      const clientId = ENVIRONMENT.google.clientId;
      const redirectUri = ENVIRONMENT.google.redirectUri || `${baseUrl}/auth/callback`;

      if (!clientId) {
        throw new Error('Google OAuth client ID not configured');
      }

      const state = JSON.stringify({
        source: 'slack',
        team_id: slackContext.teamId,
        user_id: slackContext.userId,
        channel_id: slackContext.channelId
      });

      const scopes = [
        'openid',
        'email', 
        'profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/contacts.readonly'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state: state,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent'
      });

      return authUrl;
    } catch (error) {
      this.logError('Error generating OAuth URL', error);
      const { ENVIRONMENT } = await import('../../config/environment');
      return `${ENVIRONMENT.baseUrl}/auth/error?message=OAuth+URL+generation+failed`;
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    this.emailFormatter = serviceManager.getService('emailFormatter') as EmailFormatter;
    if (!this.emailFormatter) {
      this.logWarn('EmailFormatter not available - email formatting will use fallback');
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy,
      details: {
        ...baseHealth.details,
        config: this.config,
        dependencies: {
          emailFormatter: !!this.emailFormatter
        }
      }
    };
  }
}
