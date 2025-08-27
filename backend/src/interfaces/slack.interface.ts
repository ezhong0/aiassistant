import { App, ExpressReceiver, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { ServiceManager } from '../services/service-manager';
import { SlackContext, SlackEventType, SlackAgentRequest, SlackAgentResponse } from '../types/slack.types';
import { ToolExecutionContext } from '../types/tools';
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
  private app: App;
  private client: WebClient;
  private receiver: ExpressReceiver;
  private serviceManager: ServiceManager;
  private config: SlackConfig;

  constructor(config: SlackConfig, serviceManager: ServiceManager) {
    this.config = config;
    this.serviceManager = serviceManager;

    // Create Express receiver for Slack
    this.receiver = new ExpressReceiver({
      signingSecret: config.signingSecret,
      endpoints: {
        events: '/slack/events',
        commands: '/slack/commands',
        interactive: '/slack/interactive'
      }
    });

    // Initialize Slack app
    this.app = new App({
      receiver: this.receiver,
      token: config.botToken,
      logLevel: config.development ? LogLevel.DEBUG : LogLevel.INFO
    });

    // Initialize Slack client
    this.client = new WebClient(config.botToken);

    this.setupEventHandlers();
    this.setupSlashCommands();
    this.setupInteractiveComponents();
  }

  /**
   * Get the Express router for Slack endpoints
   */
  public get router() {
    return this.receiver.router;
  }

  /**
   * Start the Slack interface
   */
  public async start(): Promise<void> {
    try {
      await this.app.start();
      logger.info('Slack interface started successfully');
    } catch (error) {
      logger.error('Failed to start Slack interface:', error);
      throw error;
    }
  }

  /**
   * Stop the Slack interface
   */
  public async stop(): Promise<void> {
    try {
      await this.app.stop();
      logger.info('Slack interface stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Slack interface:', error);
      throw error;
    }
  }

  /**
   * Setup Slack event handlers
   */
  private setupEventHandlers(): void {
    // Handle app mentions
    this.app.event('app_mention', async (event) => {
      try {
        const context = await this.createSlackContext(event);
        const message = this.extractMessageFromEvent(event);
        
        await this.handleSlackEvent(
          message,
          context,
          'app_mention',
          { say: event.say, client: this.client }
        );
      } catch (error) {
        logger.error('Error handling app mention:', error);
        await event.say('I apologize, but I encountered an error. Please try again.');
      }
    });

    // Handle direct messages
    this.app.message(async (message) => {
      try {
        // Only handle direct messages to the bot
        if ((message as any).channel_type === 'im') {
          const context = await this.createSlackContext(message);
          const messageText = this.extractMessageFromEvent(message);
          
          await this.handleSlackEvent(
            messageText,
            context,
            'message',
            { say: (message as any).say, client: this.client }
          );
        }
      } catch (error) {
        logger.error('Error handling direct message:', error);
        await (message as any).say('I apologize, but I encountered an error. Please try again.');
      }
    });
  }

  /**
   * Setup slash commands
   */
  private setupSlashCommands(): void {
    this.app.command('/assistant', async (command) => {
      try {
        const context = this.createSlackContextFromCommand(command);
        const message = (command as any).text || 'help';
        
        await this.handleSlackEvent(
          message,
          context,
          'slash_command',
          { say: command.respond, client: this.client }
        );
      } catch (error) {
        logger.error('Error handling slash command:', error);
        await command.respond('I apologize, but I encountered an error. Please try again.');
      }
    });
  }

  /**
   * Setup interactive components
   */
  private setupInteractiveComponents(): void {
    this.app.action('button_click', async ({ ack, body, client }) => {
      await ack();
      // Handle button clicks
      logger.info('Button clicked:', body);
    });

    this.app.view('modal_submission', async ({ ack, body, view, client }) => {
      await ack();
      // Handle modal submissions
      logger.info('Modal submitted:', view);
    });
  }

  /**
   * Create Slack context from event
   */
  private async createSlackContext(event: any): Promise<SlackContext> {
    const teamId = event.team_id || (await this.client.auth.test()).team_id;
    
    return {
      userId: event.user || event.user_id,
      channelId: event.channel || event.channel_id,
      teamId: teamId,
      threadTs: event.thread_ts,
      isDirectMessage: event.channel_type === 'im'
    };
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
   * Extract message text from Slack event
   */
  private extractMessageFromEvent(event: any): string {
    if (event.text) {
      return this.cleanSlackMessage(event.text);
    }
    return '';
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
      
      logger.debug('Slack session created/retrieved', { 
        sessionId, 
        userId: slackContext.userId,
        teamId: slackContext.teamId 
      });
      
      return sessionId;
    } catch (error) {
      logger.error('Error creating/retrieving Slack session', error);
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
      logger.debug('Processing Slack event', { 
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
      logger.error('Error in handleSlackEvent', error);
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
      logger.info('Routing Slack request to MasterAgent', { 
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
        const toolExecutorService = this.serviceManager.getService('toolExecutorService');
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
        const toolExecutorService = this.serviceManager.getService('toolExecutorService');
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
                logger.warn('Tool execution failed', { 
                  toolName: toolCall.name, 
                  error: result.error 
                });
              }
            } catch (error) {
              logger.error('Error executing tool', error, { toolName: toolCall.name });
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
      logger.error('Error routing to agent', error);
      
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
      logger.error('Error formatting agent response for Slack', error);
      return { 
        text: masterResponse.message || 'I processed your request successfully.' 
      };
    }
  }

  /**
   * Send formatted message to Slack
   */
  private async sendFormattedMessage(channelId: string, blocks: any[]): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: channelId,
        blocks: blocks
      });
    } catch (error) {
      logger.error('Error sending formatted message to Slack:', error);
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
}
