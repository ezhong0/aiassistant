import { App, ExpressReceiver, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { ToolExecutionContext } from '../types/tools';
import {
  SlackServiceConfig,
  SlackContext,
  SlackEventType,
  SlackAgentRequest,
  SlackAgentResponse,
  SlackMessageEvent,
  SlackAppMentionEvent,
  SlackSlashCommandPayload,
  SlackInteractivePayload
} from '../types/slack.types';
import logger from '../utils/logger';

/**
 * Slack integration service that extends BaseService
 * Handles Slack App initialization, event subscriptions, and routing to agents
 */
export class SlackService extends BaseService {
  private app: App | null = null;
  private client: WebClient | null = null;
  private receiver: ExpressReceiver | null = null;
  private config: SlackServiceConfig;
  private serviceManager: ServiceManager;

  constructor(config: SlackServiceConfig, serviceManager: ServiceManager) {
    super('SlackService');
    this.config = config;
    this.serviceManager = serviceManager;
  }

  /**
   * Initialize Slack service
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Slack service...');
      
      // Create ExpressReceiver for custom routes
      this.receiver = new ExpressReceiver({
        signingSecret: this.config.signingSecret,
        endpoints: '/slack/events'
      });

      // Initialize Slack App with Bolt SDK
      this.app = new App({
        token: this.config.botToken,
        receiver: this.receiver,
        logLevel: this.config.development ? LogLevel.DEBUG : LogLevel.INFO,
        processBeforeResponse: true
      });

      // Initialize WebClient
      this.client = new WebClient(this.config.botToken);

      // Set up event handlers
      await this.setupEventHandlers();

      // Verify bot token and get bot info
      const authTest = await this.client.auth.test();
      this.logInfo('Slack bot authenticated', { 
        botId: authTest.user_id,
        teamId: authTest.team_id,
        teamName: authTest.team 
      });

    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Cleanup Slack service
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying Slack service...');
      
      if (this.app) {
        // Slack Bolt doesn't have a direct stop method, but we can stop the receiver
        this.app = null;
      }
      
      if (this.receiver) {
        this.receiver = null;
      }
      
      this.client = null;
      
    } catch (error) {
      this.logError('Error in onDestroy', error);
      // Don't re-throw in cleanup
    }
  }

  /**
   * Get Express receiver for route integration
   */
  getReceiver(): ExpressReceiver | null {
    this.assertReady();
    return this.receiver;
  }

  /**
   * Get Slack app instance
   */
  getApp(): App | null {
    this.assertReady();
    return this.app;
  }

  /**
   * Get Slack Web API client
   */
  getClient(): WebClient | null {
    this.assertReady();
    return this.client;
  }

  /**
   * Send message to Slack channel
   */
  async sendMessage(channelId: string, text: string, options?: any): Promise<any> {
    this.assertReady();
    
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text,
        ...options
      });

      this.logDebug('Message sent successfully', { 
        channel: channelId, 
        timestamp: result.ts 
      });
      
      return result;
    } catch (error) {
      this.handleError(error, 'sendMessage');
    }
  }

  /**
   * Send formatted message with blocks
   */
  async sendFormattedMessage(channelId: string, blocks: any[], options?: any): Promise<any> {
    this.assertReady();
    
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        blocks,
        ...options
      });

      this.logDebug('Formatted message sent successfully', { 
        channel: channelId, 
        timestamp: result.ts 
      });
      
      return result;
    } catch (error) {
      this.handleError(error, 'sendFormattedMessage');
    }
  }

  /**
   * Update existing message
   */
  async updateMessage(channelId: string, timestamp: string, text?: string, blocks?: any[]): Promise<any> {
    this.assertReady();
    
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.client.chat.update({
        channel: channelId,
        ts: timestamp,
        text: text || '',
        blocks
      });

      this.logDebug('Message updated successfully', { 
        channel: channelId, 
        timestamp 
      });
      
      return result;
    } catch (error) {
      this.handleError(error, 'updateMessage');
    }
  }

  /**
   * Set up Slack event handlers
   */
  private async setupEventHandlers(): Promise<void> {
    if (!this.app) {
      throw new Error('Slack app not initialized');
    }

    // Handle app mentions (@assistant)
    this.app.event('app_mention', async ({ event, say, client }) => {
      try {
        const context = await this.createSlackContext(event as SlackAppMentionEvent, false);
        await this.handleSlackEvent(event.text, context, 'app_mention', { say, client });
      } catch (error) {
        this.logError('Error handling app_mention', error);
        await say('Sorry, I encountered an error processing your message. Please try again.');
      }
    });

    // Handle direct messages
    this.app.message(async ({ message, say, client }) => {
      try {
        // Only handle direct messages (channel_type === 'im')
        if (message.channel_type === 'im' && 'text' in message && message.text) {
          const context = await this.createSlackContext(message as SlackMessageEvent, true);
          await this.handleSlackEvent(message.text, context, 'message', { say, client });
        }
              } catch (error) {
          this.logError('Error handling direct message', error);
          await say('Sorry, I encountered an error processing your message. Please try again.');
        }
    });

    // Handle slash commands
    this.app.command('/assistant', async ({ command, ack, say, client }) => {
      try {
        await ack(); // Acknowledge the command
        
        const context = this.createSlackContextFromCommand(command);
        const message = command.text ? String(command.text) : 'help';
        
        await this.handleSlackEvent(message, context, 'slash_command', { say, client });
      } catch (error) {
        this.logError('Error handling slash command', error);
        await say('Sorry, I encountered an error processing your command. Please try again.');
      }
    });

    // Handle interactive components (buttons, modals, etc.)
    this.app.action(/.*/, async ({ body, ack, client }) => {
      try {
        await ack(); // Acknowledge the action
        
        // Handle button clicks and other interactive components
        this.logDebug('Interactive component received', { actionId: body });
        
        // TODO: Implement interactive component handling
        // This will be expanded in later iterations
        
      } catch (error) {
        this.logError('Error handling interactive component', error);
      }
    });

    this.logInfo('Slack event handlers configured successfully');
  }

  /**
   * Create Slack context from event
   */
  private async createSlackContext(event: SlackMessageEvent | SlackAppMentionEvent, isDirectMessage: boolean): Promise<SlackContext> {
    // Get team ID from the Slack client if available
    let teamId = '';
    if (this.client) {
      try {
        const authTest = await this.client.auth.test();
        teamId = authTest.team_id || '';
      } catch (error) {
        this.logWarn('Could not get team ID from auth test', error);
        teamId = '';
      }
    }
    
    return {
      userId: event.user,
      channelId: event.channel,
      teamId,
      threadTs: event.thread_ts,
      isDirectMessage
    };
  }

  /**
   * Create Slack context from slash command
   */
  private createSlackContextFromCommand(command: SlackSlashCommandPayload): SlackContext {
    return {
      userId: command.user_id,
      channelId: command.channel_id,
      teamId: command.team_id,
      isDirectMessage: command.channel_name === 'directmessage'
    };
  }

  /**
   * Create or get session for Slack user
   */
  private async createOrGetSession(slackContext: SlackContext): Promise<string> {
    try {
      const sessionService = this.serviceManager.getService('sessionService');
      if (!sessionService) {
        throw new Error('SessionService not available');
      }

      // Create unique session ID for Slack context
      const sessionId = `slack_${slackContext.teamId}_${slackContext.userId}_${slackContext.threadTs || 'main'}`;
      
      // Get or create session using existing SessionService
      const session = (sessionService as any).getOrCreateSession(sessionId, slackContext.userId);
      
      this.logDebug('Slack session created/retrieved', { 
        sessionId, 
        userId: slackContext.userId,
        teamId: slackContext.teamId 
      });
      
      return sessionId;
    } catch (error) {
      this.logError('Error creating/retrieving Slack session', error);
      // Fallback to a simple session ID if SessionService fails
      return `slack_fallback_${slackContext.teamId}_${slackContext.userId}`;
    }
  }

  /**
   * Handle Slack events by routing to agents
   */
  private async handleSlackEvent(
    message: string, 
    context: SlackContext, 
    eventType: SlackEventType,
    slackHandlers: { say: any; client: any }
  ): Promise<void> {
    try {
      this.logDebug('Processing Slack event', { 
        eventType, 
        userId: context.userId, 
        channelId: context.channelId,
        messageLength: message.length
      });

      // Create agent request
      const agentRequest: SlackAgentRequest = {
        message: this.cleanSlackMessage(message),
        context,
        eventType,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };

      // Route to Master Agent through existing system
      const agentResponse = await this.routeToAgent(agentRequest);

      // Send response back to Slack
      if (agentResponse.shouldRespond !== false) {
        if (agentResponse.response.blocks && agentResponse.response.blocks.length > 0) {
          await this.sendFormattedMessage(context.channelId, agentResponse.response.blocks);
        } else if (agentResponse.response.text) {
          await slackHandlers.say(agentResponse.response.text);
        }
      }

      // Handle follow-up actions
      if (agentResponse.followUpActions) {
        await this.processFollowUpActions(agentResponse.followUpActions, context);
      }

    } catch (error) {
      this.logError('Error in handleSlackEvent', error);
      await slackHandlers.say('I apologize, but I encountered an error while processing your request. Please try again or contact support if the issue persists.');
    }
  }

  /**
   * Clean Slack message (remove mentions, etc.)
   */
  private cleanSlackMessage(message: string): string {
    // Remove bot mentions
    return message.replace(/<@[UW][A-Z0-9]+>/g, '').trim();
  }

  /**
   * Route to agent system (integrate with existing Master Agent)
   */
  private async routeToAgent(request: SlackAgentRequest): Promise<SlackAgentResponse> {
    try {
      this.logInfo('Routing Slack request to MasterAgent', { 
        message: request.message,
        eventType: request.eventType 
      });

      // Create or get session for Slack user
      const sessionId = await this.createOrGetSession(request.context);
      
      // Import MasterAgent dynamically to avoid circular dependencies
      const { MasterAgent } = await import('../agents/master.agent');
      const masterAgent = new MasterAgent();
      
      // Route to MasterAgent for intent parsing (existing functionality)
      const masterResponse = await masterAgent.processUserInput(
        request.message,
        sessionId,
        request.context.userId
      );

      // If MasterAgent needs to think, handle that first
      if (masterResponse.needsThinking) {
        // Execute the Think tool to get final response
        const toolExecutorService = this.serviceManager.getService('ToolExecutorService');
        if (toolExecutorService) {
          const thinkTool = masterResponse.toolCalls?.find(tc => tc.name === 'Think');
          if (thinkTool) {
            const executionContext: ToolExecutionContext = {
              sessionId,
              userId: request.context.userId,
              timestamp: new Date(),
              slackContext: request.context
            };
            
            const thinkResult = await (toolExecutorService as any).executeTool(
              thinkTool,
              executionContext
            );
            
            // Use the thinking result to enhance the response
            if (thinkResult.success && thinkResult.result) {
              const thinkData = thinkResult.result as any;
              if (thinkData.message) {
                masterResponse.message = thinkData.message;
              }
            }
          }
        }
      }

      // Execute any other tool calls from MasterAgent
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        const toolExecutorService = this.serviceManager.getService('ToolExecutorService');
        if (toolExecutorService) {
          const executionContext: ToolExecutionContext = {
            sessionId,
            userId: request.context.userId,
            timestamp: new Date(),
            slackContext: request.context
          };

          // Execute all tool calls (except Think which was handled above)
          const nonThinkTools = masterResponse.toolCalls.filter(tc => tc.name !== 'Think');
          for (const toolCall of nonThinkTools) {
            try {
              const result = await (toolExecutorService as any).executeTool(
                toolCall,
                executionContext
              );
              
              if (!result.success) {
                this.logWarn('Tool execution failed', { 
                  toolName: toolCall.name, 
                  error: result.error 
                });
              }
            } catch (error) {
              this.logError('Error executing tool', error, { toolName: toolCall.name });
            }
          }
        }
      }

      // Format response for Slack
      const slackResponse = await this.formatAgentResponseForSlack(masterResponse, request.context);
      
      return {
        success: true,
        response: slackResponse,
        shouldRespond: true
      };
      
    } catch (error) {
      this.logError('Error routing to agent', error);
      
      return {
        success: false,
        response: {
          text: 'I apologize, but I encountered an error while processing your request.'
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRespond: true
      };
    }
  }

  /**
   * Format agent response for Slack
   */
  private async formatAgentResponseForSlack(
    masterResponse: any, 
    slackContext: SlackContext
  ): Promise<{ text: string; blocks?: any[] }> {
    try {
      // Get SlackFormatterService for rich formatting
      const slackFormatterService = this.serviceManager.getService('slackFormatterService');
      
      if (slackFormatterService && typeof (slackFormatterService as any).formatAgentResponse === 'function') {
        // Use SlackFormatterService if available
        return await (slackFormatterService as any).formatAgentResponse(masterResponse, slackContext);
      }
      
      // Fallback to basic text formatting
      let responseText = masterResponse.message || 'I processed your request successfully.';
      
      // Add tool execution results if available
      if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
        const results = masterResponse.toolResults
          .filter((tr: any) => tr.success)
          .map((tr: any) => tr.result)
          .filter(Boolean);
        
        if (results.length > 0) {
          responseText += '\n\nResults:\n' + results.map((r: any) => 
            typeof r === 'string' ? r : JSON.stringify(r, null, 2)
          ).join('\n');
        }
      }
      
      return { text: responseText };
    } catch (error) {
      this.logError('Error formatting agent response for Slack', error);
      return { 
        text: masterResponse.message || 'I processed your request successfully.' 
      };
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
            this.logDebug('Scheduling follow-up message', action);
            break;
            
          case 'update_message':
            // TODO: Implement message updating
            this.logDebug('Updating message', action);
            break;
            
          case 'send_dm':
            // TODO: Implement DM sending
            this.logDebug('Sending DM', action);
            break;
            
          default:
            this.logWarn('Unknown follow-up action type', { type: action.type });
        }
      } catch (error) {
        this.logError('Error processing follow-up action', error, { action });
      }
    }
    }
}