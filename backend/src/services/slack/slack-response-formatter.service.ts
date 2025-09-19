import { BaseService } from '../base-service';
import { SlackContext, SlackResponse } from '../../types/slack/slack.types';
import { EmailFormatter } from '../email/email-formatter.service';
import { ResponsePersonalityService, ResponseContext } from '../response-personality.service';
import { serviceManager } from '../service-manager';

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
  private personalityService: ResponsePersonalityService | null = null;

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
          const successMessage = await this.generateSuccessMessage(successfulResults, masterResponse);
          return {
            text: successMessage
          };
        }
      }
      
      // Default fallback - provide helpful message
      const fallbackText = await this.generatePersonalizedResponse({
        action: 'request processing',
        success: false,
        error: 'processing issue'
      });
      return { text: fallbackText };
    } catch (error) {
      this.logError('Error formatting agent response', error);
      return { text: masterResponse.message || '✨ Yay! I processed your request successfully and I\'m so happy I could help! 🌟💕' };
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
                  text: 'Yes please! 💖',
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
                  text: 'No thanks 🥺',
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
            proposalWithInstructions += '\n\n🤔 Should I go ahead with this? Just reply "yes" or "no" - I\'m super excited to help! ✨';
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
        text: proposal.text || masterResponse.message || '🥺 Aww, something went a little wonky with my response! But don\'t worry, I\'m still here to help! 💝'
      };
    }
  }


  /**
   * Generate natural language success message based on tool results
   */
  private async generateSuccessMessage(successfulResults: any[], masterResponse: any): Promise<string> {
    if (successfulResults.length === 0) {
      return await this.generatePersonalizedResponse({
        action: 'request processing',
        success: true
      });
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
            // Use dynamic generation for email results
            message = await this.generateEmailResponse(emailResult.result);
          }
        } catch (error) {
          this.logError('Error formatting email result with EmailFormatter', error);
          message = await this.generateEmailResponse(emailResult.result);
        }
      } else {
        // Use dynamic generation for email results
        message = await this.generateEmailResponse(emailResult.result);
      }
    } else if (contactResults.length > 0) {
      message = await this.generatePersonalizedResponse({
        action: 'contact search',
        success: true,
        details: { count: contactResults[0]?.result?.data?.contacts?.length }
      });
    } else if (calendarResults.length > 0) {
      message = await this.generatePersonalizedResponse({
        action: 'calendar management',
        success: true,
        details: { count: calendarResults[0]?.result?.data?.events?.length }
      });
    } else {
      message = await this.generatePersonalizedResponse({
        action: 'request processing',
        success: true
      });
    }

    return message;
  }

  /**
   * Generate dynamic email response
   */
  private async generateEmailResponse(emailResult: any): Promise<string> {
    if (!emailResult) {
      return await this.generatePersonalizedResponse({
        action: 'email processing',
        success: true
      });
    }

    // Determine email action and details
    if (emailResult.messageId && emailResult.threadId) {
      // Email was sent/replied
      return await this.generatePersonalizedResponse({
        action: 'email sending',
        success: true,
        details: {
          recipient: emailResult.recipient,
          subject: emailResult.subject
        }
      });
    } else if (emailResult.emails && emailResult.emails.length > 0) {
      // Emails were retrieved/searched
      const count = emailResult.count || emailResult.emails.length;
      return await this.generatePersonalizedResponse({
        action: 'email search',
        success: true,
        details: { count, itemType: 'emails' }
      });
    } else {
      // General email processing
      return await this.generatePersonalizedResponse({
        action: 'email processing',
        success: true
      });
    }
  }

  /**
   * Format basic email result as fallback when EmailFormatter is not available
   * Intent-agnostic formatting based on result content
   */
  private formatBasicEmailResult(emailResult: any): string {
    if (!emailResult) {
      return '📧💕 Yay! I successfully processed your email request and I\'m so happy I could help! ✨💖';
    }

    // Format based on result content, not hardcoded action strings
    if (emailResult.messageId && emailResult.threadId) {
      // Email was sent/replied
      let message = `📧💖 Woohoo! I successfully sent your email`;
      if (emailResult.recipient) {
        message += ` to ${emailResult.recipient}`;
      }
      if (emailResult.subject) {
        message += ` about "${emailResult.subject}"`;
      }
      message += '! I hope it brightens their day! ✨💕';
      return message;
    } else if (emailResult.emails && emailResult.emails.length > 0) {
      // Emails were retrieved/searched
      const count = emailResult.count || emailResult.emails.length;
      return `🔍💖 Yay! I found ${count} email${count !== 1 ? 's' : ''} matching your search! I hope these are exactly what you were looking for! ✨📧`;
    } else if (emailResult.count !== undefined) {
      // Operation completed with count
      return `📧💕 Woohoo! I successfully processed your email request and I\'m so happy I could help! ✨💖`;
    } else {
      return '📧💕 Yay! I successfully processed your email request and I\'m so happy I could help! ✨💖';
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
            text: '*🔐💕 Oops! I need your help to connect to Gmail!*\n' +
                  'To use all the super cool email, calendar, and contact features, you need to connect your Gmail account first! 🌟\n\n' +
                  'Don\'t worry, this is just a one-time setup that keeps your data safe and secure! I promise to take great care of everything! 💖✨'
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text' as const,
              text: '🔗💖 Connect Gmail Account'
            },
            style: 'primary',
            action_id: 'gmail_oauth',
            url: oauthUrl
          }
        }
      ];

      return {
        text: '🔐💕 Oops! I need your help to connect to Gmail so I can use all the super cool email features! Pretty please? 🌟✨',
        blocks: blocks
      };
    } catch (error) {
      this.logError('Error formatting OAuth required message', error);
      return {
        text: '🔐💕 Aww, I\'m having trouble connecting to Gmail! Could you pretty please contact support to help me set this up? I really want to help you with your emails! 🥺✨'
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
   * Generate personalized response using LLM or fallback
   */
  private async generatePersonalizedResponse(context: ResponseContext): Promise<string> {
    try {
      if (this.personalityService) {
        return await this.personalityService.generateResponse(context);
      }

      // Fallback if service not available
      return this.getHardcodedFallback(context);
    } catch (error) {
      this.logWarn('Failed to generate personalized response, using fallback', error as any);
      return this.getHardcodedFallback(context);
    }
  }

  /**
   * Hardcoded fallbacks for when LLM generation fails
   */
  private getHardcodedFallback(context: ResponseContext): string {
    if (!context.success) {
      return "I encountered an issue processing your request. Please try again.";
    }

    switch (context.action) {
      case 'email sending':
        return '✅ Email sent successfully!';
      case 'calendar management':
        return '✅ Calendar event processed successfully!';
      case 'contact search':
        return '✅ Contact information found!';
      default:
        return '✅ Request completed successfully!';
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    this.emailFormatter = serviceManager.getService('emailFormatter') as EmailFormatter;
    this.personalityService = serviceManager.getService('responsePersonalityService') as ResponsePersonalityService;

    if (!this.emailFormatter) {
      this.logWarn('EmailFormatter not available - email formatting will use fallback');
    }
    if (!this.personalityService) {
      this.logWarn('ResponsePersonalityService not available - will use fallback responses');
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
