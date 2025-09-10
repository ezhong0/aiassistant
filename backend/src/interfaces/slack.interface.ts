import { WebClient } from '@slack/web-api';
import { ServiceManager } from '../services/service-manager';
import { SlackContext, SlackEventType, SlackAgentRequest, SlackAgentResponse } from '../types/slack.types';
import { ToolExecutionContext, ToolResult } from '../types/tools';
import { TokenStorageService } from '../services/token-storage.service';
import { TokenManager } from '../services/token-manager';
import logger from '../utils/logger';

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development: boolean;
}

export class SlackInterface {
  private client: WebClient;
  private serviceManager: ServiceManager;
  private config: SlackConfig;
  private tokenStorageService: TokenStorageService | null = null;
  private tokenManager: TokenManager | null = null;
  private processedEvents = new Set<string>(); // Track processed events to prevent duplicates
  private pendingActions = new Map<string, any>(); // Store pending actions awaiting confirmation
  private botUserId: string | null = null; // Cache bot user ID to prevent infinite loops

  constructor(config: SlackConfig, serviceManager: ServiceManager) {
    this.config = config;
    this.serviceManager = serviceManager;

    // Initialize token storage and token managers
    this.tokenStorageService = this.serviceManager.getService('tokenStorageService') as unknown as TokenStorageService;
    this.tokenManager = this.serviceManager.getService('tokenManager') as unknown as TokenManager;

    // Initialize Slack client for direct API calls
    this.client = new WebClient(config.botToken);

    logger.debug('SlackInterface initialized with manual routing');
  }

  /**
   * Start the Slack interface
   * No-op since we're using manual routing through /slack/events
   */
  public async start(): Promise<void> {
    try {
      logger.debug('Slack interface started (manual routing)');
    } catch (error) {
      logger.error('Failed to start Slack interface:', error);
      throw error;
    }
  }

  /**
   * Stop the Slack interface
   * No-op since we don't have a Bolt app instance
   */
  public async stop(): Promise<void> {
    try {
      logger.debug('Slack interface stopped');
    } catch (error) {
      logger.error('Failed to stop Slack interface:', error);
      throw error;
    }
  }

  /**
   * Handle Slack events directly
   */
  public async handleEvent(event: any, teamId: string): Promise<void> {
    try {
      // Create unique event ID for deduplication
      const eventId = `${event.ts}-${event.user}-${event.channel}-${event.type}`;
      
      // Check if we've already processed this event
      if (this.processedEvents.has(eventId)) {
        logger.debug('Duplicate event detected, skipping');
        return;
      }
      
      // Mark event as being processed
      this.processedEvents.add(eventId);
      
      // Clean up old events (keep only last 1000 to prevent memory leaks)
      if (this.processedEvents.size > 1000) {
        const eventsArray = Array.from(this.processedEvents);
        const eventsToRemove = eventsArray.slice(0, 500);
        eventsToRemove.forEach(id => this.processedEvents.delete(id));
      }
      
      logger.debug('Processing Slack event', {
        eventId,
        eventType: event.type,
        userId: event.user,
        channelId: event.channel
      });

      // Skip bot messages to prevent infinite loops
      if (event.bot_id || event.subtype === 'bot_message') {
        logger.debug('Bot message detected, skipping to prevent infinite loop', {
          eventId,
          botId: event.bot_id,
          subtype: event.subtype
        });
        return;
      }

      // Skip messages from the bot user itself
      if (this.botUserId && event.user === this.botUserId) {
        logger.debug('Message from bot user detected, skipping to prevent infinite loop', {
          eventId,
          botUserId: this.botUserId,
          eventUserId: event.user
        });
        return;
      }

      // Initialize bot user ID if not cached
      if (!this.botUserId) {
        try {
          const authTest = await this.client.auth.test();
          this.botUserId = authTest.user_id as string;
          logger.debug('Bot user ID cached', { botUserId: this.botUserId });
          
          // Double-check with cached value
          if (event.user === this.botUserId) {
            logger.debug('Message from bot user detected (cached check), skipping to prevent infinite loop', {
              eventId,
              botUserId: this.botUserId,
              eventUserId: event.user
            });
            return;
          }
        } catch (error) {
          logger.warn('Could not verify bot user ID, continuing with processing', { error });
        }
      }

      // Create Slack context from event
      const slackContext: SlackContext = {
        userId: event.user,
        channelId: event.channel,
        teamId: teamId,
        threadTs: event.ts,
        isDirectMessage: event.channel_type === 'im'
      };

      // Enforce DM-only mode - reject channel-based interactions
      if (!slackContext.isDirectMessage) {
        logger.warn('Channel interaction rejected - DM-only mode enforced', {
          eventId,
          eventType: event.type,
          userId: event.user,
          channelId: event.channel,
          channelType: event.channel_type
        });
        
        // Send a polite message explaining DM-only policy
        await this.client.chat.postMessage({
          channel: slackContext.channelId,
          text: "🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance.",
          thread_ts: slackContext.threadTs
        });
        return;
      }

      // Determine event type
      let eventType: SlackEventType;
      if (event.type === 'app_mention') {
        eventType = 'app_mention';
      } else if (event.type === 'message') {
        eventType = 'message';
      } else {
        logger.warn('Unsupported event type', { eventType: event.type });
        return;
      }

      // Process the event using existing logic
      await this.handleSlackEvent(
        event.text || '', 
        slackContext, 
        eventType,
        {
          say: async (message: any) => {
            // Send response back to Slack via Web API
            await this.client.chat.postMessage({
              channel: slackContext.channelId,
              text: typeof message === 'string' ? message : message.text,
              blocks: message.blocks,
              thread_ts: slackContext.threadTs
            });
          },
          client: this.client
        }
      );

    } catch (error) {
      logger.error('Error handling Slack event directly', error);
    }
  }


  /**
   * Enhanced context extraction from Slack events
   */
  private async createSlackContextFromEvent(event: any, payload?: any): Promise<SlackContext> {
    try {
      // Get additional user information if available
      let userName: string | undefined;
      let userEmail: string | undefined;
      
      try {
        const userInfo = await this.client.users.info({ user: event.user });
        if (userInfo.user) {
          userName = userInfo.user.name;
          userEmail = userInfo.user.profile?.email;
        }
      } catch (userError) {
        logger.debug('Could not fetch additional user info:', userError);
      }

      const teamId = event.team_id || payload?.team?.id || (await this.client.auth.test()).team_id;
      
      return {
        userId: event.user || event.user_id,
        channelId: event.channel || event.channel_id,
        teamId: teamId as string,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im',
        userName,
        userEmail
      };
    } catch (error) {
      logger.error('Error creating enhanced Slack context:', error);
      
      // Fallback to basic context
      return {
        userId: event.user || event.user_id || 'unknown',
        channelId: event.channel || event.channel_id || 'unknown',
        teamId: event.team_id || 'unknown',
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im'
      };
    }
  }

  /**
   * Extract and clean message text with smart handling
   */
  private extractAndCleanMessage(text: string): string {
    if (!text) return '';
    
    // Remove bot mentions more intelligently
    return text
      .replace(/<@[UW][A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/<![^>]+>/g, '') // Remove special mentions (@channel, @here)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Parse slash command text with parameter extraction
   */
  private parseSlashCommandText(text: string): { 
    message: string; 
    isHelpRequest: boolean; 
    parameters: Record<string, string> 
  } {
    if (!text) {
      return { message: '', isHelpRequest: true, parameters: {} };
    }

    const trimmedText = text.trim().toLowerCase();
    
    // Check for help requests
    const helpKeywords = ['help', '?', 'usage', 'commands', 'guide'];
    const isHelpRequest = helpKeywords.some(keyword => 
      trimmedText === keyword || trimmedText.startsWith(keyword + ' ')
    );

    // Simple parameter extraction (can be enhanced further)
    const parameters: Record<string, string> = {};
    const paramMatches = text.match(/--(\w+)=([^\s]+)/g);
    if (paramMatches) {
      paramMatches.forEach(match => {
        const [, key, value] = match.match(/--(\w+)=([^\s]+)/) || [];
        if (key && value) {
          parameters[key] = value;
        }
      });
    }

    return {
      message: text.replace(/--\w+=\S+/g, '').trim(),
      isHelpRequest,
      parameters
    };
  }

  /**
   * Check if user is interacting for the first time
   */
  private isFirstTimeUser(context: SlackContext): boolean {
    // Simple implementation - can be enhanced with actual user tracking
    // For now, return false to avoid overwhelming users
    return false;
  }

  /**
   * Send welcome message to new users
   */
  private async sendWelcomeMessage(say: any, context: SlackContext): Promise<void> {
    const welcomeMessage = {
      text: "👋 Welcome to your AI Assistant!",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "👋 Welcome to your AI Assistant!"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "I'm here to help you manage your email, calendar, and contacts directly from Slack. Here's how to get started:"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "• *Send me a direct message* with what you'd like to do\n• *Use commands* like 'check my email' or 'schedule a meeting'\n• *Type 'help'* anytime for more information\n\n🔒 *Privacy Protected:* All conversations happen through direct messages to keep your data secure."
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Get Help"
              },
              action_id: "show_help",
              style: "primary"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Check Email"
              },
              action_id: "quick_email_check"
            }
          ]
        }
      ]
    };

    await say(welcomeMessage);
  }

  /**
   * Send a welcome message specifically for email-related requests for first-time users
   */
  private async sendEmailWelcomeMessage(say: any, context: SlackContext): Promise<void> {
    try {
      const oauthUrl = await this.generateOAuthUrl(context);
      
      const welcomeMessage = {
        text: "👋 Welcome to your AI Assistant!",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "👋 Welcome to your AI Assistant!"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "I'm here to help you manage your email directly from Slack. To get started, you need to connect your Gmail account. Here's how:"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "• *Click the 'Connect Gmail Account' button* below to securely connect your Gmail account.\n• *Authorize* the connection in Google.\n• *Return to Slack* and try your email request again."
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "🔗 Connect Gmail Account"
                },
                action_id: "gmail_oauth",
                url: oauthUrl,
                style: "primary"
              }
            ]
          }
        ]
      };

      await say(welcomeMessage);
    } catch (error) {
      logger.error('Error sending email welcome message', { error, userId: context.userId });
      
      // Fallback to simple text message
      await say({
        text: "👋 Welcome! I can help with email management. Please use `/assistant auth` to connect your Gmail account first."
      });
    }
  }

  /**
   * Format quick help response for empty commands
   */
  private formatQuickHelpResponse(): any {
    return {
      response_type: 'ephemeral' as const,
      text: "👋 How can I help you today?",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👋 *How can I help you today?*\n\nJust type `/assistant` followed by what you need:\n• `/assistant check my email`\n• `/assistant schedule a meeting`\n• `/assistant find contact information`\n• Or ask me anything else!"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Show All Commands"
              },
              action_id: "show_full_help"
            }
          ]
        }
      ]
    };
  }

  /**
   * Format comprehensive help response
   */
  private formatHelpResponse(): any {
    return {
      response_type: 'ephemeral' as const,
      text: "🤖 AI Assistant Help",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🤖 AI Assistant Help"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Ways to interact with me:*\n• Send me a direct message\n• Use `/assistant` followed by any request\n\n🔒 *Privacy-First Design:* All interactions happen through direct messages to protect your privacy."
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📧 *Email Management*\n• `/assistant check my email`\n• `/assistant send email to john@company.com about the meeting`\n• `/assistant find emails from Sarah about the project`"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📅 *Calendar Management*\n• `/assistant schedule meeting with team tomorrow at 2pm`\n• `/assistant check if I'm free Thursday afternoon`\n• `/assistant move my 3pm meeting to 4pm`"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👤 *Contact Management*\n• `/assistant find contact info for John Smith`\n• `/assistant add jane@company.com to my contacts`\n• `/assistant who is the contact for Acme Corp?`"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "💡 *Pro Tips:*\n• Just type `/assistant` followed by what you need\n• I understand natural language - no need for specific commands\n• Try asking me anything - I'll figure out what you need!"
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 *Example:* `/assistant help me organize my day` or `/assistant what's the weather like?`"
            }
          ]
        }
      ]
    };
  }

  /**
   * Format help response for slash commands with empty input
   */
  private formatSlashCommandHelp(): any {
    return {
      response_type: 'ephemeral' as const,
      text: "👋 How can I help you today?",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👋 *How can I help you today?*\n\nTry asking me to:\n• Check your email\n• Schedule a meeting\n• Find contact information\n• Or just type `/assistant help` for more options"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Show All Commands"
              },
              action_id: "show_full_help"
            }
          ]
        }
      ]
    };
  }

  /**
   * Create Slack context from event
   */
  private async createSlackContext(event: any): Promise<SlackContext> {
    return this.createSlackContextFromEvent(event);
  }

  /**
   * Create Slack context from slash command
   */
  private createSlackContextFromCommand(command: any): SlackContext {
    return {
      userId: command.user_id,
      channelId: command.channel_id,
      teamId: command.team_id,
      isDirectMessage: command.channel_name === 'directmessage'
    };
  }


  /**
   * Create or get session for Slack user with simplified management
   */
  private async createOrGetSession(slackContext: SlackContext): Promise<string> {
    // Generate standardized session ID using the new format
    const sessionId = `user:${slackContext.teamId}:${slackContext.userId}`;
    
    logger.info('Generated session ID for Slack user', { 
      sessionId, 
      userId: slackContext.userId,
      teamId: slackContext.teamId
    });
    
    return sessionId;
  }

  /**
   * Handle Slack events by routing to agents with comprehensive error handling
   */
  private async handleSlackEvent(
    message: string, 
    context: SlackContext, 
    eventType: SlackEventType,
    slackHandlers: { 
      say: any; 
      client: any; 
      thread_ts?: string;
      commandInfo?: {
        command: string;
        channelName: string;
        triggerId: string;
        responseUrl: string;
      }
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing Slack event', { 
        eventType, 
        userId: context.userId, 
        channelId: context.channelId,
        messageLength: message.length,
        userName: context.userName,
        isDirectMessage: context.isDirectMessage
      });

      // Validate message
      if (!message || message.trim().length === 0) {
        await slackHandlers.say({
          text: 'I received your message but it appears to be empty. Please try sending a message with some content.',
          thread_ts: slackHandlers.thread_ts
        });
        return;
      }



      // Early detection of email-related requests for better OAuth experience
      const emailKeywords = ['email', 'gmail', 'send email', 'compose', 'mail', 'inbox', 'contact', 'contacts'];
      const isEmailRelated = emailKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isEmailRelated) {
        const hasOAuth = await this.hasOAuthTokens(context);
        if (!hasOAuth) {
          logger.info('Email-related request detected but no OAuth tokens found', { 
            userId: context.userId,
            message: message.substring(0, 100)
          });
          
          await this.sendOAuthRequiredMessage(slackHandlers.say, context, slackHandlers.thread_ts);
          return;
        } else {
          // User has OAuth tokens, check if they recently completed authentication
          const isRecentlyConnected = await this.isRecentlyConnected(context);
          if (isRecentlyConnected) {
            // Send OAuth success message in the current thread context
            await this.sendOAuthSuccessMessage(slackHandlers.say, context, slackHandlers.thread_ts);
            // Don't continue processing - let user send their request again
            return;
          }
        }
      }

      // Show typing indicator for longer operations
      if (eventType !== 'slash_command') {
        await this.sendTypingIndicator(context.channelId);
      }

      // Create enhanced agent request
      const agentRequest: SlackAgentRequest = {
        message: this.extractAndCleanMessage(message),
        context: {
          ...context,
          userName: context.userName,
          userEmail: context.userEmail
        },
        eventType,
        metadata: {
          timestamp: new Date().toISOString(),
          triggerId: slackHandlers.commandInfo?.triggerId,
          responseUrl: slackHandlers.commandInfo?.responseUrl
        }
      };

      // Route to Master Agent through existing system
      const agentResponse = await this.routeToAgent(agentRequest);

      // Enhanced response handling
      if (agentResponse.shouldRespond !== false) {
        logger.info('Sending response to Slack', {
          eventId: `${context.userId}-${Date.now()}`,
          hasBlocks: !!(agentResponse.response.blocks && agentResponse.response.blocks.length > 0),
          hasText: !!agentResponse.response.text,
          blocksCount: agentResponse.response.blocks?.length || 0,
          responseMethod: agentResponse.response.blocks && agentResponse.response.blocks.length > 0 ? 'sendFormattedMessage' : 'say'
        });

        if (agentResponse.response.blocks && agentResponse.response.blocks.length > 0) {
          await this.sendFormattedMessage(
            context.channelId, 
            agentResponse.response.blocks,
            {
              text: agentResponse.response.text,
              thread_ts: slackHandlers.thread_ts,
              response_type: eventType === 'slash_command' ? 'in_channel' : undefined
            }
          );
          logger.info('Formatted message sent successfully');
        } else if (agentResponse.response.text) {
          await slackHandlers.say({
            text: agentResponse.response.text,
            thread_ts: slackHandlers.thread_ts
          });
          logger.info('Text message sent successfully via say()');
        } else {
          logger.warn('No response content to send', { agentResponse: agentResponse.response });
        }
      } else {
        logger.info('Agent response marked as shouldRespond=false, skipping response');
      }

      // Handle follow-up actions
      if (agentResponse.followUpActions && agentResponse.followUpActions.length > 0) {
        await this.processFollowUpActions(agentResponse.followUpActions, context);
      }

      // Log successful completion
      const processingTime = Date.now() - startTime;
      logger.info('Slack event processed successfully', {
        eventType,
        userId: context.userId,
        processingTimeMs: processingTime,
        responseBlocks: agentResponse.response.blocks?.length || 0,
        followUpActions: agentResponse.followUpActions?.length || 0
      });

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      // Detailed error logging
      logger.error('Error in handleSlackEvent', error, {
        eventType,
        userId: context.userId,
        channelId: context.channelId,
        messageLength: message.length,
        processingTimeMs: processingTime,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorStack: error?.stack
      });

      // User-friendly error responses based on error type
      let errorMessage = 'I apologize, but I encountered an error while processing your request.';
      
      if (error?.message?.includes('rate limit')) {
        errorMessage = 'I\'m receiving too many requests right now. Please wait a moment and try again.';
      } else if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
        errorMessage = 'I\'m having trouble connecting to my services. Please try again in a moment.';
      } else if (error?.message?.includes('permission') || error?.message?.includes('authorization')) {
        errorMessage = 'I don\'t have the necessary permissions to complete that action. Please check your settings or contact an admin.';
      }

      try {
        await slackHandlers.say({
          text: `${errorMessage} If the issue persists, please contact support.`,
          thread_ts: slackHandlers.thread_ts
        });
      } catch (sayError) {
        logger.error('Failed to send error message to user:', sayError);
      }
    }
  }

  /**
   * Clean Slack message (remove mentions, etc.)
   */
  private cleanSlackMessage(message: string): string {
    return this.extractAndCleanMessage(message);
  }

  /**
   * Route to agent system - Complete integration with MasterAgent
   * Flow: Slack Event → MasterAgent (intent parsing) → Tool Execution → Slack Response
   */
  private async routeToAgent(request: SlackAgentRequest): Promise<SlackAgentResponse> {
    const startTime = Date.now();
    let masterAgent: any = null;
    
    try {
      logger.info('Routing Slack request to MasterAgent', { 
        message: request.message,
        eventType: request.eventType,
        userId: request.context.userId,
        channelId: request.context.channelId,
        isDirectMessage: request.context.isDirectMessage
      });

      // Check for confirmation responses first
      const confirmationResponse = await this.handleConfirmationResponse(request);
      if (confirmationResponse) {
        return confirmationResponse;
      }

      // 1. Create or get session for Slack user with enhanced context
      const sessionId = await this.createOrGetSession(request.context);
      
      logger.info('Slack session created/retrieved for OAuth check', { 
        sessionId, 
        userId: request.context.userId,
        teamId: request.context.teamId,
        channelId: request.context.channelId
      });
      
      // 2. Get OAuth tokens for this session if available
      let accessToken: string | undefined;
      try {
        if (!this.tokenManager) {
          logger.warn('TokenManager not available for Slack integration');
        } else {
          logger.info('Retrieving OAuth tokens for Slack user', { 
            sessionId, 
            userId: request.context.userId,
            teamId: request.context.teamId
          });
          
          accessToken = await this.tokenManager.getValidTokens(request.context.teamId, request.context.userId) || undefined;
          
          if (accessToken) {
            logger.debug('Retrieved valid Google OAuth access token for Slack user', { 
              sessionId, 
              hasToken: !!accessToken,
              tokenLength: accessToken.length
            });
          } else {
            logger.warn('❌ No valid OAuth tokens found for Slack user', { 
              sessionId,
              userId: request.context.userId,
              teamId: request.context.teamId
            });
          }
        }
      } catch (error) {
        logger.error('Error retrieving OAuth tokens for Slack user', { error, sessionId });
      }
      
      // 3. Initialize MasterAgent with consistent configuration
      const { createMasterAgent } = await import('../config/agent-factory-init');
      masterAgent = createMasterAgent({ 
        openaiApiKey: process.env.OPENAI_API_KEY || 'dummy-key' 
      });
      
      logger.debug('MasterAgent initialized', { sessionId, useOpenAI: !!process.env.OPENAI_API_KEY });
      
      // 4. Route to MasterAgent for intent parsing (EXISTING LOGIC - DO NOT DUPLICATE)
      const masterResponse = await masterAgent.processUserInput(
        request.message,
        sessionId,
        request.context.userId
      );

      logger.debug('MasterAgent response received', {
        hasMessage: !!masterResponse.message,
        toolCallsCount: masterResponse.toolCalls?.length || 0,
        needsThinking: masterResponse.needsThinking
      });

      // 5. Initialize tool results collection for comprehensive response
      const toolResults: ToolResult[] = [];
      
      // 6. Execute tool calls with enhanced Slack context and OAuth token
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        const toolExecutorService = this.serviceManager.getService('toolExecutorService');
        
        if (!toolExecutorService) {
          logger.error('ToolExecutorService not available for Slack integration');
          throw new Error('Tool execution system not available');
        }

        // Create enhanced execution context with Slack-specific information
        const baseExecutionContext: ToolExecutionContext = {
          sessionId,
          userId: request.context.userId,
          timestamp: new Date(),
          slackContext: request.context
        };

        logger.debug('Executing tool calls', { 
          toolCount: masterResponse.toolCalls.length,
          tools: masterResponse.toolCalls.map((tc: any) => tc.name),
          hasAccessToken: !!accessToken
        });

        // Step 1: First run tools in preview mode to check for confirmation needs
        const previewResults = [];
        for (const toolCall of masterResponse.toolCalls) {
          try {
            logger.debug(`Running preview for tool: ${toolCall.name}`, { 
              parameters: Object.keys(toolCall.parameters || {}),
              hasAccessToken: !!accessToken
            });

            // Check if this tool requires OAuth and we don't have a token
            if (this.toolRequiresOAuth(toolCall.name) && !accessToken) {
              logger.warn(`Tool ${toolCall.name} requires OAuth but no access token available`, { sessionId });
              
              // Add failed result to collection
              previewResults.push({
                toolName: toolCall.name,
                success: false,
                error: 'OAuth authentication required. Please authenticate with Gmail first.',
                result: null,
                executionTime: 0
              });
              
              continue; // Skip execution and move to next tool
            }

            const executionContext: any = {
              ...baseExecutionContext,
              previousResults: previewResults // Pass previous results for context
            };

            // First run in preview mode to check for confirmation needs
            const previewResult: any = await (toolExecutorService as any).executeTool(
              toolCall,
              executionContext,
              accessToken,
              { preview: true } // Run in preview mode first
            );

            previewResults.push(previewResult);
            
          } catch (error) {
            logger.error(`Preview execution failed for tool ${toolCall.name}:`, error);
            previewResults.push({
              toolName: toolCall.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              result: null,
              executionTime: 0
            });
          }
        }

        // Step 2: Check if any tools require confirmation
        const needsConfirmation = previewResults.some(result => 
          result.result && typeof result.result === 'object' && 
          'awaitingConfirmation' in result.result && 
          result.result.awaitingConfirmation === true
        );

        logger.info('Slack preview check completed', {
          needsConfirmation,
          previewResultsCount: previewResults.length,
          toolsRequiringConfirmation: previewResults
            .filter(r => r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result)
            .map(r => r.toolName)
        });

        if (needsConfirmation) {
          // Return confirmation request to Slack
          return this.createConfirmationResponse(previewResults, sessionId, request.message, request.context.channelId);
        }

        // Step 3: No confirmation needed, use preview results as final results
        // (No need to execute again - preview mode already executed the tools)
        logger.info('No confirmation needed, using preview results as final results', {
          previewResultsCount: previewResults.length,
          toolNames: previewResults.map(r => r.toolName)
        });
        
        toolResults.push(...previewResults);
      }

      // 7. Enhance master response with tool execution results
      const enhancedMasterResponse = {
        ...masterResponse,
        toolResults: toolResults,
        executionMetadata: {
          totalExecutionTime: Date.now() - startTime,
          toolsExecuted: toolResults.length,
          successfulTools: toolResults.filter(tr => tr.success).length,
          slackContext: request.context
        }
      };

      // 8. Format response for Slack with comprehensive context
      const slackResponse = await this.formatAgentResponseForSlack(
        enhancedMasterResponse, 
        request.context
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Slack request processed successfully', {
        processingTimeMs: processingTime,
        toolsExecuted: toolResults.length,
        responseHasBlocks: !!(slackResponse.blocks && slackResponse.blocks.length > 0),
        responseTextLength: slackResponse.text?.length || 0
      });

      return {
        success: true,
        response: slackResponse,
        shouldRespond: true,
        executionMetadata: {
          processingTime,
          toolResults,
          masterAgentResponse: masterResponse.message
        }
      };
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error routing to agent', error, {
        processingTimeMs: processingTime,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        userId: request.context.userId,
        eventType: request.eventType
      });

      // Enhanced error response based on error type
      let errorMessage = 'I apologize, but I encountered an error while processing your request.';
      
      if (error?.message?.includes('OpenAI service is required')) {
        errorMessage = 'I\'m having trouble with my AI processing service. Please try again in a moment.';
      } else if (error?.message?.includes('TokenStorageService not available')) {
        errorMessage = 'I\'m experiencing some connection issues. Please try again.';
      } else if (error?.message?.includes('Tool execution system')) {
        errorMessage = 'I\'m having trouble accessing my tools. Please try again shortly.';
      }
      
      return {
        success: true, // Changed to true to ensure response is sent
        response: {
          text: `${errorMessage} If the problem persists, please contact support.`
        },
        error: error?.message || 'Unknown error',
        shouldRespond: true,
        executionMetadata: {
          processingTime,
          toolResults: [],
          error: error?.message
        }
      };
    }
  }

  /**
   * Format agent response for Slack with comprehensive formatting
   */
  private async formatAgentResponseForSlack(
    masterResponse: any, 
    slackContext: SlackContext
  ): Promise<{ text: string; blocks?: any[] }> {
    try {
      logger.debug('Formatting agent response for Slack', {
        hasMessage: !!masterResponse.message,
        toolResultsCount: masterResponse.toolResults?.length || 0,
        hasExecutionMetadata: !!masterResponse.executionMetadata
      });

      // Use simple fallback formatting
      
      // 2. Enhanced fallback formatting with tool results integration
      let responseText = masterResponse.message || 'I processed your request successfully.';
      const blocks: any[] = [];

      // 3. Create main response block
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: responseText
        }
      });

      // 4. Process and format tool execution results
      if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
        const successfulResults = masterResponse.toolResults.filter((tr: any) => tr.success);
        const failedResults = masterResponse.toolResults.filter((tr: any) => !tr.success);

        // Add successful results
        if (successfulResults.length > 0) {
          blocks.push({ type: 'divider' });
          
          for (const toolResult of successfulResults) {
            if (toolResult.result) {
              const resultText = this.formatToolResultForSlack(toolResult);
              if (resultText) {
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*${this.getToolDisplayName(toolResult.toolName)}*\n${resultText}`
                  }
                });
              }
            }
          }
        }

        // Handle failed results with OAuth guidance
        if (failedResults.length > 0) {
          const oauthFailures = failedResults.filter((fr: any) => 
            fr.error?.includes('OAuth authentication required') || 
            fr.error?.includes('Access token is required')
          );
          
          if (oauthFailures.length > 0) {
            blocks.push({ type: 'divider' });
            
            // Add OAuth guidance block
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*🔐 Gmail Authentication Required*\n' +
                      'To send emails, read your Gmail, or access contacts, you need to connect your Gmail account first.\n\n' +
                      'This is a one-time setup that keeps your data secure.'
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🔗 Connect Gmail Account'
                },
                style: 'primary',
                action_id: 'gmail_oauth',
                url: await this.generateOAuthUrl(slackContext)
              }
            });
            
            blocks.push({
              type: 'context',
              elements: [{
                type: 'mrkdwn',
                text: '_Click the button above to securely connect your Gmail account. You\'ll be redirected to Google to authorize access._'
              }]
            });
            
            // Add helpful information
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*What happens next?*\n' +
                      '• Click "Connect Gmail Account"\n' +
                      '• Authorize with Google\n' +
                      '• Return to Slack\n' +
                      '• Try your email request again'
              }
            });
          }
        }

        // Add execution summary if multiple tools were used
        if (masterResponse.executionMetadata && masterResponse.toolResults.length > 1) {
          const metadata = masterResponse.executionMetadata;
          blocks.push({
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `✅ ${metadata.successfulTools}/${metadata.toolsExecuted} tools executed successfully` +
                    (metadata.totalExecutionTime ? ` • ${metadata.totalExecutionTime}ms` : '')
            }]
          });
        }

        // Log failed results for debugging (don't show to user)
        if (failedResults.length > 0) {
          logger.warn('Some tools failed execution in Slack context', {
            failedTools: failedResults.map((fr: any) => ({ name: fr.toolName, error: fr.error })),
            userId: slackContext.userId
          });
        }
      }

      // 5. Add help hint for certain contexts
      if (slackContext.isDirectMessage && masterResponse.message?.length < 50) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: '_Type "help" anytime for assistance with commands_'
          }]
        });
      }

      const finalResponse = {
        text: responseText,
        blocks: blocks.length > 1 ? blocks : undefined // Only include blocks if we have more than just the main text
      };

      logger.debug('Response formatted for Slack', {
        textLength: finalResponse.text.length,
        blocksCount: finalResponse.blocks?.length || 0,
        hasSuccessfulResults: (masterResponse.toolResults?.filter((tr: any) => tr.success) || []).length > 0
      });

      return finalResponse;
      
    } catch (error: any) {
      logger.error('Error formatting agent response for Slack', error);
      
      // Ultimate fallback - just return the basic message
      return { 
        text: masterResponse.message || 'I processed your request successfully.' 
      };
    }
  }

  /**
   * Send help message for slash commands
   */
  private async sendHelpMessage(respond: any, context: SlackContext): Promise<void> {
    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🤖 AI Assistant Help*\n' +
                  'Here\'s what I can help you with:'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📧 Email Features*\n' +
                  '• Send emails\n' +
                  '• Read Gmail\n' +
                  '• Manage contacts\n\n' +
                  '*📅 Calendar Features*\n' +
                  '• Schedule meetings\n' +
                  '• Check availability\n\n' +
                  '*🔍 Other Features*\n' +
                  '• Web search\n' +
                  '• Content creation\n' +
                  '• Task assistance'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Usage Examples*\n' +
                  '• `/assistant send an email to john@example.com`\n' +
                  '• `/assistant schedule a meeting tomorrow at 2pm`\n' +
                  '• `/assistant search for latest AI news`\n' +
                  '• `/assistant auth` - Check authentication status\n' +
                  '• `/assistant status` - Check connection status'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔐 Authentication*\n' +
                  'Email and calendar features require Gmail authentication. Use `/assistant auth` to connect your account.'
          }
        }
      ];

      await respond({
        blocks: blocks,
        text: 'AI Assistant Help - I can help with email, calendar, search, and more!',
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error sending help message', { error, userId: context.userId });
      
      await respond({
        text: '🤖 AI Assistant Help\n\nI can help with:\n• Email management\n• Calendar scheduling\n• Web search\n• Content creation\n\nTry: `/assistant send an email to...`',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Handle authentication-related commands
   */
  private async handleAuthCommand(respond: any, context: SlackContext): Promise<void> {
    try {
      const hasOAuth = await this.hasOAuthTokens(context);
      
      if (hasOAuth) {
        await respond({
          text: '✅ *Authentication Status: Connected*\n\nYour Gmail account is connected and ready to use! You can now:\n• Send emails\n• Read Gmail\n• Access contacts\n• Use calendar features',
          response_type: 'ephemeral'
        });
      } else {
        await this.sendOAuthRequiredMessage(respond, context);
      }
    } catch (error) {
      logger.error('Error handling auth command', { error, userId: context.userId });
      
      await respond({
        text: '❌ Error checking authentication status. Please try again or contact support.',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Handle status command to check authentication status
   */
  private async handleStatusCommand(respond: any, context: SlackContext): Promise<void> {
    try {
      const hasOAuth = await this.hasOAuthTokens(context);
      const statusMessage = hasOAuth ? 
        '✅ *Authentication Status: Connected*\n\nYour Gmail account is connected and ready to use! You can now:\n• Send emails\n• Read Gmail\n• Access contacts\n• Use calendar features' :
        '❌ *Authentication Status: Disconnected*\n\nYour Gmail account is not connected. Please use `/assistant auth` to connect your account.';

      await respond({
        text: statusMessage,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error handling status command', { error, userId: context.userId });
      await respond({
        text: '❌ Error checking authentication status. Please try again or contact support.',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Send a success message when OAuth is completed
   */
  private async sendOAuthSuccessMessage(say: any, slackContext: SlackContext, threadTs?: string): Promise<void> {
    try {
      // Only show this message if we haven't shown it recently for this user
      const successMessageKey = `oauth_success_${slackContext.userId}_${slackContext.teamId}`;
      const hasShownSuccess = await this.checkIfSuccessMessageShown(successMessageKey);
      
      if (hasShownSuccess) {
        logger.debug('OAuth success message already shown recently, skipping', {
          userId: slackContext.userId,
          teamId: slackContext.teamId
        });
        return;
      }

      // Mark that we've shown the success message
      await this.markSuccessMessageShown(successMessageKey);

      const successMessage = {
        text: "🎉 Gmail Successfully Connected!",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🎉 Gmail Successfully Connected!"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Great! Your Gmail account is now connected and ready to use. You can now:"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "• 📧 Send emails through the AI Assistant\n• 📋 Read and manage your Gmail\n• 👤 Access your contacts\n• 📅 Use calendar features"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Try your email request again!* The AI Assistant now has access to your Gmail account."
            }
          }
        ]
      };

      await say({
        ...successMessage,
        thread_ts: threadTs
      });
    } catch (error) {
      logger.error('Error sending OAuth success message', { error, userId: slackContext.userId });
      
      // Fallback to simple text message
      await say({
        text: "🎉 Gmail successfully connected! You can now try your email request again.",
        thread_ts: threadTs
      });
    }
  }

  /**
   * Check if a user has recently completed OAuth authentication
   */
  private async isRecentlyConnected(slackContext: SlackContext): Promise<boolean> {
    try {
      // Since session storage is removed, skip recent connection detection
      // This functionality could be implemented with a dedicated cache if needed
      logger.debug('Skipping recent connection check (session storage removed)', { 
        userId: slackContext.userId, 
        teamId: slackContext.teamId 
      });
      
      return false;
    } catch (error) {
      logger.error('Error checking if recently connected', { error, userId: slackContext.userId });
      return false;
    }
  }

  /**
   * Check if we've already shown the OAuth success message for a session
   */
  private async checkIfSuccessMessageShown(successMessageKey: string): Promise<boolean> {
    try {
      // Success message tracking removed with session storage
      // This could be implemented with a dedicated cache if needed
      logger.debug('Skipping success message check (session storage removed)', { successMessageKey });
      return false;
    } catch (error) {
      logger.debug('Error checking if success message was shown', { error, successMessageKey });
      return false;
    }
  }

  /**
   * Mark that we've shown the OAuth success message for a session
   */
  private async markSuccessMessageShown(successMessageKey: string): Promise<void> {
    try {
      // Success message marking removed with session storage  
      // This could be implemented with a dedicated cache if needed
      logger.debug('Skipping success message marking (session storage removed)', { successMessageKey });
    } catch (error) {
      logger.debug('Error marking success message as shown', { error, successMessageKey });
    }
  }



  /**
   * Check if a user has OAuth tokens for Gmail access
   */
  private async hasOAuthTokens(slackContext: SlackContext): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        logger.warn('TokenManager not available in hasOAuthTokens', { 
          userId: slackContext.userId,
          teamId: slackContext.teamId 
        });
        return false;
      }

      return await this.tokenManager.hasValidOAuthTokens(slackContext.teamId, slackContext.userId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('💥 Error in hasOAuthTokens (Slack interface)', { 
        error,
        errorMessage,
        errorStack,
        errorType: error?.constructor?.name,
        userId: slackContext.userId,
        teamId: slackContext.teamId
      });
      return false;
    }
  }

  /**
   * Send a helpful message when user doesn't have OAuth tokens
   */
  private async sendOAuthRequiredMessage(say: any, slackContext: SlackContext, threadTs?: string): Promise<void> {
    try {
      const oauthUrl = await this.generateOAuthUrl(slackContext);
      
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
              type: 'plain_text',
              text: '🔗 Connect Gmail Account'
            },
            style: 'primary',
            action_id: 'gmail_oauth',
            url: oauthUrl
          }
        },
        {
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: '_Click the button above to securely connect your Gmail account. You\'ll be redirected to Google to authorize access._'
          }]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*What happens next?*\n' +
                  '• Click "Connect Gmail Account"\n' +
                  '• Authorize with Google\n' +
                  '• Return to Slack\n' +
                  '• Try your email request again'
          }
        }
      ];

      await say({
        blocks: blocks,
        text: 'Gmail authentication required. Please connect your Gmail account to use email features.',
        thread_ts: threadTs
      });
    } catch (error) {
      logger.error('Error sending OAuth required message', { error, userId: slackContext.userId });
      
      // Fallback to simple text message
      await say({
        text: '🔐 Gmail authentication required. Please contact support to connect your Gmail account.',
        thread_ts: threadTs
      });
    }
  }

  /**
   * Check if a tool requires OAuth authentication
   */
  private toolRequiresOAuth(toolName: string): boolean {
    const oauthRequiredTools = [
      'emailAgent',
      'calendarAgent', 
      'contactAgent'
    ];
    
    return oauthRequiredTools.includes(toolName);
  }

  /**
   * Create confirmation response for Slack with action preview
   */
  private createConfirmationResponse(previewResults: any[], sessionId: string, userMessage: string, channel: string): SlackAgentResponse {
    // Extract the main preview data
    const mainPreview = previewResults.find(r => 
      r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result && r.result.preview
    );

    if (!mainPreview?.result?.preview) {
      return {
        success: true,
        response: {
          text: 'I need your confirmation before proceeding with this action. Reply with "yes" to confirm or "no" to cancel.'
        },
        shouldRespond: true
      };
    }

    const preview = mainPreview.result.preview;
    
    // Create detailed preview message for Slack
    let previewText = `🔍 **Action Preview**\n\n`;
    previewText += `**${preview.title}**\n`;
    previewText += `${preview.description}\n\n`;

    // Add risk assessment
    const riskEmoji = preview.riskAssessment.level === 'high' ? '🔴' : 
                     preview.riskAssessment.level === 'medium' ? '🟡' : '🟢';
    previewText += `${riskEmoji} **Risk Level:** ${preview.riskAssessment.level.toUpperCase()}\n`;
    previewText += `**Risk Factors:** ${preview.riskAssessment.factors.join(', ')}\n`;

    // Add warnings if any
    if (preview.riskAssessment.warnings) {
      previewText += `⚠️ **Warnings:**\n`;
      preview.riskAssessment.warnings.forEach((warning: string) => {
        previewText += `• ${warning}\n`;
      });
    }

    // Add specific preview data based on action type
    if (preview.actionType === 'email' && preview.previewData) {
      const emailData = preview.previewData as any;
      previewText += `\n📧 **Email Details:**\n`;
      previewText += `• **To:** ${emailData.recipients.to.join(', ')}\n`;
      if (emailData.recipients.cc?.length > 0) {
        previewText += `• **CC:** ${emailData.recipients.cc.join(', ')}\n`;
      }
      previewText += `• **Subject:** ${emailData.subject}\n`;
      previewText += `• **Content:** ${emailData.contentSummary}\n`;
      previewText += `• **Recipients:** ${emailData.recipientCount}\n`;
      if (emailData.externalDomains?.length > 0) {
        previewText += `• **External Domains:** ${emailData.externalDomains.join(', ')}\n`;
      }
    } else if (preview.actionType === 'calendar' && preview.previewData) {
      const calendarData = preview.previewData as any;
      previewText += `\n📅 **Calendar Details:**\n`;
      previewText += `• **Title:** ${calendarData.title}\n`;
      previewText += `• **Start:** ${new Date(calendarData.startTime).toLocaleString()}\n`;
      previewText += `• **Duration:** ${calendarData.duration}\n`;
      if (calendarData.attendees?.length > 0) {
        previewText += `• **Attendees:** ${calendarData.attendees.join(', ')}\n`;
      }
      if (calendarData.location) {
        previewText += `• **Location:** ${calendarData.location}\n`;
      }
      if (calendarData.conflicts?.length > 0) {
        previewText += `⚠️ **Conflicts:** ${calendarData.conflicts.length} detected\n`;
      }
    }

    previewText += `\n**Estimated Execution Time:** ${preview.estimatedExecutionTime}\n`;
    previewText += `**Reversible:** ${preview.reversible ? 'Yes' : 'No'}\n\n`;
    previewText += `Do you want to proceed with this action?\nReply with **"yes"** to confirm or **"no"** to cancel.`;

    // Store pending action for confirmation handling
    const pendingAction = {
      actionId: preview.actionId,
      type: preview.actionType,
      parameters: preview.parameters,
      awaitingConfirmation: true,
      originalQuery: userMessage,
      sessionId: sessionId,
      preview: preview,
      timestamp: Date.now()
    };

    this.pendingActions.set(`${sessionId}:${channel}`, pendingAction);

    // Set timeout to clean up pending action after 5 minutes
    setTimeout(() => {
      this.pendingActions.delete(`${sessionId}:${channel}`);
    }, 5 * 60 * 1000);

    return {
      success: true,
      response: {
        text: previewText
      },
      shouldRespond: true
    };
  }

  /**
   * Handle confirmation responses from users
   */
  private async handleConfirmationResponse(request: SlackAgentRequest): Promise<SlackAgentResponse | null> {
    const sessionId = await this.createOrGetSession(request.context);
    const pendingActionKey = `${sessionId}:${request.context.channelId}`;
    const pendingAction = this.pendingActions.get(pendingActionKey);

    if (!pendingAction) {
      return null; // No pending action, continue with normal processing
    }

    const message = request.message.toLowerCase().trim();
    const confirmationWords = ['yes', 'y', 'confirm', 'ok', 'okay', 'proceed', 'go ahead', 'do it'];
    const rejectionWords = ['no', 'n', 'cancel', 'abort', 'stop', 'nevermind', 'never mind'];

    const isConfirmation = confirmationWords.includes(message);
    const isRejection = rejectionWords.includes(message);

    if (!isConfirmation && !isRejection) {
      return null; // Not a confirmation response, continue with normal processing
    }

    // Remove pending action
    this.pendingActions.delete(pendingActionKey);

    logger.info('Processing confirmation response', {
      sessionId,
      actionId: pendingAction.actionId,
      confirmed: isConfirmation,
      userMessage: message
    });

    if (isRejection) {
      return {
        success: true,
        response: {
          text: `✅ Action cancelled. The ${pendingAction.type} operation will not be performed.`
        },
        shouldRespond: true
      };
    }

    // Execute the confirmed action
    try {
      const toolExecutorService = this.serviceManager.getService('toolExecutorService');
      if (!toolExecutorService) {
        throw new Error('Tool executor service not available');
      }

      // Get access token
      let accessToken: string | undefined;
      try {
        if (this.tokenManager) {
          const token = await this.tokenManager.getValidTokens(request.context.teamId, request.context.userId);
          accessToken = token || undefined;
        }
      } catch (error) {
        logger.warn('Could not retrieve access token for confirmed action', { sessionId, error });
      }

      // Check if access token is required and available
      if ((pendingAction.type === 'email' || pendingAction.type === 'calendar') && !accessToken) {
        logger.error('Access token required but not available for confirmed action', {
          sessionId,
          actionType: pendingAction.type,
          actionId: pendingAction.actionId
        });

        return {
          success: true,
          response: {
            text: `❌ **Action Failed**\n\n` +
              `Cannot execute ${pendingAction.preview.title} because you need to authenticate with Google first.\n\n` +
              `Please use the OAuth link provided earlier to connect your Google account, then try your request again.`
          },
          shouldRespond: true
        };
      }

      // Create execution context
      const executionContext = {
        sessionId,
        userId: request.context.userId,
        timestamp: new Date()
      };

      // Create tool call based on action type
      let toolCall: any;
      if (pendingAction.type === 'email') {
        toolCall = {
          name: 'emailAgent',
          parameters: { 
            query: pendingAction.originalQuery,
            accessToken 
          }
        };
      } else if (pendingAction.type === 'calendar') {
        toolCall = {
          name: 'calendarAgent',
          parameters: { 
            query: pendingAction.originalQuery,
            accessToken
          }
        };
      } else {
        throw new Error(`Unsupported action type: ${pendingAction.type}`);
      }

      // Execute the tool normally (not in preview mode)
      logger.info('Executing confirmed action', {
        sessionId,
        actionId: pendingAction.actionId,
        actionType: pendingAction.type,
        toolName: toolCall.name,
        hasAccessToken: !!accessToken
      });

      const result = await (toolExecutorService as any).executeTool(
        toolCall,
        executionContext,
        accessToken,
        { preview: false }
      );

      logger.info('Confirmed action execution result', {
        sessionId,
        actionId: pendingAction.actionId,
        success: result.success,
        hasError: !!result.error,
        errorMessage: result.error,
        hasResult: !!result.result
      });

      if (result.success) {
        const successMessage = `✅ **Action Completed Successfully!**\n\n` +
          `${pendingAction.preview.title} has been executed.\n\n` +
          `${result.result?.message || 'Operation completed successfully.'}`;

        return {
          success: true,
          response: {
            text: successMessage
          },
          shouldRespond: true
        };
      } else {
        const errorMessage = `❌ **Action Failed**\n\n` +
          `Failed to execute ${pendingAction.preview.title}.\n\n` +
          `Error: ${result.error || 'Unknown error occurred'}`;

        return {
          success: true,
          response: {
            text: errorMessage
          },
          shouldRespond: true
        };
      }

    } catch (error) {
      logger.error('Failed to execute confirmed action', {
        actionId: pendingAction.actionId,
        error: error instanceof Error ? error.message : error
      });

      const errorMessage = `❌ **Execution Error**\n\n` +
        `An error occurred while executing ${pendingAction.preview.title}.\n\n` +
        `Please try again or contact support if the issue persists.`;

      return {
        success: true,
        response: {
          text: errorMessage
        },
        shouldRespond: true
      };
    }
  }

  /**
   * Generate OAuth URL for Slack user authentication
   */
  private async generateOAuthUrl(slackContext: SlackContext): Promise<string> {
    try {
      const { ENVIRONMENT } = await import('../config/environment');
      let baseUrl = ENVIRONMENT.baseUrl;
      const clientId = ENVIRONMENT.google.clientId;
      
      if (!clientId) {
        logger.error('Google OAuth client ID not configured');
        return `${baseUrl}/auth/error?message=OAuth+not+configured`;
      }

      // Ensure baseUrl doesn't have trailing paths - it should just be the domain
      // Fix for cases where BASE_URL might be set to include /auth/google or similar
      if (baseUrl.includes('/auth/')) {
        const originalBaseUrl = baseUrl;
        const parts = baseUrl.split('/auth/');
        baseUrl = parts[0] || baseUrl; // Fallback to original if split fails
        logger.warn('Base URL contained /auth/ path, corrected', { 
          original: originalBaseUrl, 
          corrected: baseUrl 
        });
      }

      // Use configured redirect URI or fall back to default
      const redirectUri = ENVIRONMENT.google.redirectUri || `${baseUrl}/auth/callback`;
      
      // Validate redirect URI format
      if (!redirectUri.startsWith('http')) {
        logger.error('Invalid redirect URI format', { redirectUri, baseUrl });
        return `${baseUrl}/auth/error?message=Invalid+redirect+URI+format`;
      }

      // Ensure redirect URI points to the correct callback endpoint
      if (!redirectUri.endsWith('/auth/callback')) {
        logger.warn('Redirect URI does not end with /auth/callback, this may cause OAuth issues', { 
          redirectUri, 
          expected: `${baseUrl}/auth/callback` 
        });
      }

      // Create state parameter with Slack context
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

      // Use the proper Google OAuth endpoint instead of our custom /auth/init route
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state: state,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent'
      });

      logger.info('Generated Google OAuth URL for Slack user', {
        userId: slackContext.userId,
        teamId: slackContext.teamId,
        channelId: slackContext.channelId,
        redirectUri: redirectUri,
        usingConfiguredRedirect: !!ENVIRONMENT.google.redirectUri,
        baseUrl: baseUrl,
        clientIdConfigured: !!clientId,
        generatedUrl: authUrl.substring(0, 100) + '...', // Log first 100 chars for debugging
        fullRedirectUri: redirectUri,
        fullBaseUrl: baseUrl,
        environmentRedirectUri: ENVIRONMENT.google.redirectUri
      });

      return authUrl;
    } catch (error) {
      logger.error('Error generating OAuth URL', { error, slackContext });
      
      // Return a fallback error URL
      const { ENVIRONMENT } = await import('../config/environment');
      return `${ENVIRONMENT.baseUrl}/auth/error?message=OAuth+URL+generation+failed`;
    }
  }

  /**
   * Format individual tool result for Slack display
   */
  private formatToolResultForSlack(toolResult: ToolResult): string {
    try {
      if (!toolResult.result) return '';

      // Handle different result types
      if (typeof toolResult.result === 'string') {
        return this.truncateForSlack(toolResult.result, 200);
      }

      if (typeof toolResult.result === 'object') {
        // Handle common structured results
        if (toolResult.result.summary) {
          return this.truncateForSlack(toolResult.result.summary, 200);
        }
        
        if (toolResult.result.message) {
          return this.truncateForSlack(toolResult.result.message, 200);
        }

        if (Array.isArray(toolResult.result)) {
          return `Found ${toolResult.result.length} items`;
        }

        // Format object as readable text
        const formatted = JSON.stringify(toolResult.result, null, 2);
        return this.truncateForSlack(formatted, 200);
      }

      return String(toolResult.result);
      
    } catch (error: any) {
      logger.debug('Error formatting tool result', { toolName: toolResult.toolName, error: error.message });
      return 'Result processed successfully';
    }
  }

  /**
   * Get user-friendly display name for tools
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      'emailAgent': '📧 Email',
      'contactAgent': '👤 Contacts',
      'calendarAgent': '📅 Calendar',
      'Think': '🤔 Analysis',
      'tavilyAgent': '🔍 Search',
      'contentCreatorAgent': '✍️ Content'
    };
    
    return displayNames[toolName] || `🔧 ${toolName}`;
  }

  /**
   * Truncate text for Slack display with smart word boundaries
   */
  private truncateForSlack(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Enhanced response sending functionality using WebClient
   */
  private async sendFormattedMessage(
    channelId: string, 
    blocks: any[], 
    options?: {
      text?: string;
      thread_ts?: string;
      response_type?: 'in_channel' | 'ephemeral';
      replace_original?: boolean;
    }
  ): Promise<void> {
    try {
      const messagePayload: any = {
        channel: channelId,
        blocks: blocks
      };

      // Add optional parameters
      if (options?.text) messagePayload.text = options.text;
      if (options?.thread_ts) messagePayload.thread_ts = options.thread_ts;
      if (options?.response_type === 'ephemeral') messagePayload.ephemeral = true;

      logger.debug('Sending formatted Slack message', { 
        channel: channelId, 
        blocks: blocks.length,
        thread_ts: options?.thread_ts 
      });

      const result = await this.client.chat.postMessage(messagePayload);
      
      logger.debug('Slack message sent successfully', { 
        channel: channelId, 
        timestamp: result.ts,
        messageId: result.ts 
      });
    } catch (error) {
      logger.error('Error sending formatted message to Slack:', error, {
        channel: channelId,
        blocks_count: blocks.length,
        error_code: (error as any).code,
        error_data: (error as any).data
      });
      
      // Only send fallback if the error indicates message wasn't sent
      const errorCode = (error as any).code;
      if (errorCode !== 'channel_not_found' && errorCode !== 'not_in_channel') {
        try {
          await this.sendFallbackTextMessage(channelId, 'I encountered an error sending a formatted response. Please try again.');
        } catch (fallbackError) {
          logger.error('Fallback message also failed:', fallbackError);
        }
      } else {
        logger.error('Channel access issue, not sending fallback message', { errorCode });
      }
    }
  }

  /**
   * Send simple text message as fallback
   */
  private async sendFallbackTextMessage(channelId: string, text: string, thread_ts?: string): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: channelId,
        text: text,
        thread_ts: thread_ts
      });
    } catch (error) {
      logger.error('Error sending fallback text message:', error);
    }
  }

  /**
   * Send typing indicator to show the bot is working
   */
  private async sendTypingIndicator(channelId: string): Promise<void> {
    try {
      // Note: conversations.typing is not available in all Slack SDK versions
      // For now, we'll skip this feature as it's non-critical
      logger.debug('Typing indicator requested for channel:', channelId);
    } catch (error) {
      logger.debug('Could not send typing indicator:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Update existing message (useful for progressive responses)
   */
  private async updateMessage(
    channelId: string, 
    timestamp: string, 
    blocks: any[], 
    text?: string
  ): Promise<void> {
    try {
      await this.client.chat.update({
        channel: channelId,
        ts: timestamp,
        blocks: blocks,
        text: text
      });
    } catch (error) {
      logger.error('Error updating Slack message:', error);
    }
  }

  /**
   * Process follow-up actions
   */
  private async processFollowUpActions(actions: any[], context: SlackContext): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'schedule_message':
            // TODO: Implement scheduled message sending
            logger.debug('Scheduling follow-up message', action);
            break;
            
          case 'update_message':
            // TODO: Implement message updating
            logger.debug('Updating message', action);
            break;
            
          case 'send_dm':
            // TODO: Implement DM sending
            logger.debug('Sending DM', action);
            break;
            
          default:
            logger.warn('Unknown follow-up action type', { type: action.type });
        }
      } catch (error) {
        logger.error('Error processing follow-up action', error, { action });
      }
    }
  }

  /**
   * Get help message for users
   */
  private getHelpMessage(): string {
    return `🤖 *AI Assistant Help*

*Available Commands:*
• \`/assistant <your request>\` - Get AI assistance with any task
• \`/help\` - Show this help message

*What I can help with:*
• 📧 Email management and composition
• 📅 Calendar scheduling and management
• 👤 Contact lookup and management
• 🤖 Intelligent task assistance
• 💬 General questions and support

*How to use:*
• Mention me in any channel: \`@AI Assistant help me schedule a meeting\`
• Send me a direct message
• Use the \`/assistant\` slash command

*Examples:*
• "Schedule a meeting with John tomorrow at 2pm"
• "Send an email to the team about the project update"
• "Find contact information for Sarah Johnson"

Need more help? Just ask!`;
  }

  /**
   * Get health status of the Slack interface
   */
  public getHealth(): { healthy: boolean; details?: any } {
    try {
      const isConfigured = !!(
        this.config.signingSecret &&
        this.config.botToken &&
        this.config.clientId
      );

      return {
        healthy: isConfigured,
        details: {
          configured: isConfigured,
          development: this.config.development,
          endpoints: {
            events: '/slack/events',
            commands: '/slack/commands',
            interactive: '/slack/interactive'
          },
          note: 'Using manual routing (no Bolt framework)'
        }
      };
    } catch (error) {
      logger.error('Error getting Slack interface health:', error);
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
