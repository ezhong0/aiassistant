import { WebClient } from '@slack/web-api';
import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { TokenManager } from './token-manager';
import { ToolExecutorService } from './tool-executor.service';
import { OpenAIService } from './openai.service';
import { 
  SlackContext, 
  SlackEventType, 
  SlackAgentRequest, 
  SlackAgentResponse,
  SlackResponse 
} from '../types/slack.types';
import { ToolCall, ToolExecutionContext, ToolResult } from '../types/tools';
import { serviceManager, getService } from './service-manager';
import { AIClassificationService } from './ai-classification.service';
import logger from '../utils/logger';

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development: boolean;
}

/**
 * SlackInterface Service - Main coordinator for Slack event processing
 * Extends BaseService and follows our established service lifecycle patterns
 * Delegates specialized handling to focused services while maintaining clean separation of concerns
 */
export class SlackInterfaceService extends BaseService {
  private client: WebClient;
  private config: SlackConfig;
  private processedEvents = new Set<string>(); // Track processed events to prevent duplicates
  private botUserId: string | null = null; // Cache bot user ID to prevent infinite loops
  
  // Injected service dependencies
  private tokenManager: TokenManager | null = null;
  private toolExecutorService: ToolExecutorService | null = null;
  private slackMessageReaderService: any | null = null;

  constructor(config: SlackConfig) {
    super('SlackInterfaceService');
    this.config = config;
    this.client = new WebClient(config.botToken);
  }

  /**
   * Service-specific initialization
   * Sets up dependency injection and validates configuration
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Starting SlackInterface initialization...', {
        development: this.config.development,
        hasSigningSecret: !!this.config.signingSecret,
        hasBotToken: !!this.config.botToken,
        hasClientId: !!this.config.clientId
      });

      // Validate configuration
      this.validateConfig();

      // Initialize service dependencies through service manager
      await this.initializeDependencies();

      // Test Slack client connection
      await this.testSlackConnection();

      this.logInfo('SlackInterface initialized successfully', {
        hasTokenManager: !!this.tokenManager,
        hasToolExecutor: !!this.toolExecutorService,
        hasSlackMessageReader: !!this.slackMessageReaderService
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
      // Clear processed events cache
      this.processedEvents.clear();
      
      // Reset bot user ID cache
      this.botUserId = null;
      
      // Reset service references
      this.tokenManager = null;
      this.toolExecutorService = null;
      this.slackMessageReaderService = null;

      this.logInfo('SlackInterface destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackInterface destruction', error);
    }
  }

  /**
   * Validate required configuration
   */
  private validateConfig(): void {
    const requiredFields = ['signingSecret', 'botToken', 'clientId', 'clientSecret'];
    const missingFields = requiredFields.filter(field => !this.config[field as keyof SlackConfig]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required Slack configuration: ${missingFields.join(', ')}`);
    }

    this.logDebug('Slack configuration validated successfully');
  }

  /**
   * Initialize service dependencies through dependency injection
   */
  private async initializeDependencies(): Promise<void> {
    // Get TokenManager service
    this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;
    if (!this.tokenManager) {
      this.logWarn('TokenManager not available - OAuth functionality will be limited');
    } else {
      this.logDebug('TokenManager service injected successfully');
    }

    // Get ToolExecutorService
    this.toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    if (!this.toolExecutorService) {
      throw new Error('ToolExecutorService is required but not available');
    } else {
      this.logDebug('ToolExecutorService injected successfully');
    }

    // Get SlackMessageReaderService (for reading recent messages and parsing proposals)
    this.slackMessageReaderService = serviceManager.getService('slackMessageReaderService');
    if (!this.slackMessageReaderService) {
      this.logWarn('SlackMessageReaderService not available - confirmation detection will be limited');
    } else {
      this.logDebug('SlackMessageReaderService injected successfully');
    }

  }

  /**
   * Test Slack client connection
   */
  private async testSlackConnection(): Promise<void> {
    try {
      const authTest = await this.client.auth.test();
      this.logInfo('Slack connection verified', {
        teamId: authTest.team_id,
        userId: authTest.user_id,
        botId: authTest.bot_id
      });
    } catch (error) {
      this.logError('Failed to verify Slack connection', error);
      throw new Error('Slack client authentication failed');
    }
  }

  /**
   * Main entry point for handling Slack events
   * Processes events with deduplication and delegates to appropriate handlers
   */
  async handleEvent(event: any, teamId: string): Promise<void> {
    this.assertReady();

    const startTime = Date.now();
    let eventId: string | undefined;

    try {
      // Create unique event ID for deduplication
      eventId = `${event.ts}-${event.user}-${event.channel}-${event.type}`;
      
      // Check for duplicate events
      if (this.isEventProcessed(eventId)) {
        this.logInfo('Duplicate event detected, skipping processing', {
          eventId,
          eventType: event.type,
          userId: event.user,
          channelId: event.channel
        });
        return;
      }
      
      // Mark event as being processed
      this.markEventProcessed(eventId);
      
      this.logInfo('Processing Slack event', {
        eventId,
        eventType: event.type,
        userId: event.user,
        channelId: event.channel,
        teamId
      });

      // Skip bot messages to prevent infinite loops
      if (event.bot_id || event.subtype === 'bot_message') {
        this.logDebug('Bot message detected, skipping to prevent infinite loop', {
          eventId,
          botId: event.bot_id,
          subtype: event.subtype
        });
        return;
      }

      // Skip messages from the bot user itself
      if (this.botUserId && event.user === this.botUserId) {
        this.logDebug('Message from bot user detected, skipping to prevent infinite loop', {
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
          this.logDebug('Bot user ID cached', { botUserId: this.botUserId });
          
          // Double-check with cached value
          if (event.user === this.botUserId) {
            this.logDebug('Message from bot user detected (cached check), skipping to prevent infinite loop', {
              eventId,
              botUserId: this.botUserId,
              eventUserId: event.user
            });
            return;
          }
        } catch (error) {
          this.logWarn('Could not verify bot user ID, continuing with processing', { error });
        }
      }

      // Extract Slack context from event
      const slackContext = await this.extractSlackContext(event, teamId);
      
      // Enforce DM-only mode - reject channel-based interactions
      if (!slackContext.isDirectMessage) {
        this.logWarn('Channel interaction rejected - DM-only mode enforced', {
          eventId,
          eventType: event.type,
          userId: event.user,
          channelId: event.channel,
          channelType: event.channel_type
        });
        
        // Send a polite message explaining DM-only policy
        await this.sendMessage(slackContext.channelId, {
          text: "🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance."
        });
        return;
      }
      
      // Determine event type
      const eventType = this.determineEventType(event);
      if (!eventType) {
        this.logWarn('Unsupported event type', { eventType: event.type });
        return;
      }

      // Route to appropriate handler
      await this.routeEvent(event, slackContext, eventType);

      const processingTime = Date.now() - startTime;
      this.logInfo('Slack event processed successfully', {
        eventId,
        eventType,
        processingTimeMs: processingTime
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Error processing Slack event', error, {
        eventId,
        eventType: event.type,
        processingTimeMs: processingTime
      });
      
      // Don't throw - we want to acknowledge receipt even if processing fails
    }
  }

  /**
   * Check if a message is a confirmation response using AI classification
   */
  private async isConfirmationResponse(message: string, context: SlackContext): Promise<boolean> {
    const classification = await this.classifyConfirmationResponse(message);
    const isConfirmation = classification !== 'unknown';
    
    if (isConfirmation) {
      this.logInfo('Confirmation response detected', {
        message: message.substring(0, 50),
        classification,
        userId: context.userId,
        channelId: context.channelId
      });
    }

    return isConfirmation;
  }

  /**
   * Handle confirmation response by reading recent messages and executing actions
   */
  private async handleConfirmationResponse(message: string, context: SlackContext): Promise<void> {
    try {
      const isConfirmed = await this.parseConfirmationResponse(message);
      
      if (!this.slackMessageReaderService) {
        await this.sendMessage(context.channelId, {
          text: "I detected a confirmation response, but I can't process it without access to recent messages. Please try again."
        });
        return;
      }

      // Read recent messages to find proposals
      const recentMessages = await this.slackMessageReaderService.readRecentMessages(
        context.channelId,
        20, // Read last 20 messages
        { filter: { excludeBotMessages: false } } // Include bot messages to find proposals
      );

      // Find the most recent proposal
      const proposal = this.findRecentProposal(recentMessages, context.userId);
      
      if (!proposal) {
        await this.sendMessage(context.channelId, {
          text: "I couldn't find a recent proposal to confirm. Please make a request first, then confirm it."
        });
        return;
      }

      if (isConfirmed) {
        // Parse the proposal and execute the action
        const actionResult = await this.executeProposalAction(proposal, context);
        
        if (actionResult.success) {
          await this.sendMessage(context.channelId, {
            text: `✅ ${actionResult.message || 'Action completed successfully!'}`
          });
        } else {
          await this.sendMessage(context.channelId, {
            text: `❌ Action failed: ${actionResult.error || 'Unknown error'}`
          });
        }
      } else {
        await this.sendMessage(context.channelId, {
          text: "❌ Action cancelled as requested."
        });
      }

    } catch (error) {
      this.logError('Error handling confirmation response', error, {
        message: message.substring(0, 100),
        userId: context.userId
      });
      
      await this.sendMessage(context.channelId, {
        text: "I encountered an error processing your confirmation. Please try again."
      });
    }
  }

  /**
   * Parse confirmation response to determine if it's a positive or negative confirmation
   */
  private async parseConfirmationResponse(message: string): Promise<boolean> {
    const classification = await this.classifyConfirmationResponse(message);
    
    if (classification === 'confirm') {
      return true;
    }
    
    if (classification === 'reject') {
      return false;
    }

    // Default to positive for ambiguous/unknown responses
    return true;
  }

  /**
   * AI-powered confirmation response classification
   */
  private async classifyConfirmationResponse(text: string): Promise<'confirm' | 'reject' | 'unknown'> {
    try {
      const openaiService = serviceManager.getService('openaiService') as OpenAIService;

      const response = await openaiService.generateText(
        `Classify this response to a confirmation request: "${text}"
        
        Return exactly one word: confirm, reject, or unknown
        
        Examples:
        - "yes" → confirm
        - "go for it" → confirm  
        - "not now" → reject
        - "weather is nice" → unknown`,
        'Classify confirmation responses. Return only: confirm, reject, or unknown',
        { temperature: 0, maxTokens: 5 }
      );

      const result = response.trim().toLowerCase();
      if (['confirm', 'reject', 'unknown'].includes(result)) {
        return result as 'confirm' | 'reject' | 'unknown';
      }
      return 'unknown';
    } catch (error) {
      this.logWarn('Failed to classify confirmation response, defaulting to unknown', { error, text });
      return 'unknown';
    }
  }

  /**
   * Find the most recent proposal in message history
   */
  private findRecentProposal(messages: any[], userId: string): any | null {
    // Look for messages that contain proposal indicators
    const proposalIndicators = [
      'proposal',
      'suggest',
      'recommend',
      'here\'s what i\'ll do',
      'i\'ll send',
      'i\'ll create',
      'i\'ll schedule',
      'draft email',
      'compose email',
      'send email to',
      'create calendar event',
      'schedule meeting'
    ];

    // Find the most recent message that looks like a proposal
    for (const message of messages) {
      if (message.userId === userId) continue; // Skip user messages
      
      const messageText = message.text.toLowerCase();
      const hasProposalIndicator = proposalIndicators.some(indicator => 
        messageText.includes(indicator)
      );

      if (hasProposalIndicator) {
        this.logInfo('Found recent proposal', {
          messageId: message.id,
          timestamp: message.timestamp,
          textPreview: message.text.substring(0, 100)
        });
        return message;
      }
    }

    return null;
  }

  /**
   * Execute action based on parsed proposal
   */
  private async executeProposalAction(proposal: any, context: SlackContext): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Parse the proposal text to extract action details
      const actionDetails = await this.parseProposalAction(proposal.text);
      
      if (!actionDetails) {
        return { success: false, error: 'Could not parse action from proposal' };
      }

      // Create a tool call based on the parsed action
      const toolCall = this.createToolCallFromAction(actionDetails);
      
      if (!toolCall) {
        return { success: false, error: 'Could not create tool call from action' };
      }

      // Execute the tool call
      const executionContext = {
        sessionId: `user:${context.teamId}:${context.userId}`,
        userId: context.userId,
        timestamp: new Date(),
        slackContext: context
      };

      // Get OAuth tokens if available
      let accessToken: string | undefined;
      if (this.tokenManager) {
        try {
          accessToken = await this.tokenManager.getValidTokens(
            context.teamId, 
            context.userId
          ) || undefined;
        } catch (error) {
          this.logError('Error retrieving OAuth tokens for proposal execution', error);
        }
      }

      // Execute the tool call directly (no confirmation needed since user already confirmed)
      const result = await this.toolExecutorService!.executeTool(toolCall, executionContext, accessToken);

      return {
        success: result.success,
        message: result.success ? 'Action completed successfully!' : undefined,
        error: result.error || undefined
      };

    } catch (error) {
      this.logError('Error executing proposal action', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Parse proposal action using AI instead of regex patterns
   * Replaces complex regex patterns with AI entity extraction
   */
  private async parseProposalAction(proposalText: string): Promise<any | null> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI proposal parsing is required for this operation.');
      }
      const result = await aiClassificationService.extractEntities(proposalText);
      
      if (!result.action) {
        return null;
      }

      // Convert AI result to expected format
      switch (result.action) {
        case 'email':
          return {
            actionType: 'email',
            action: 'send',
            recipient: result.parameters.recipient || null,
            subject: result.parameters.subject || 'No subject',
            body: result.parameters.body || 'No body content'
          };
          
        case 'calendar':
          return {
            actionType: 'calendar',
            action: 'create',
            title: result.parameters.title || 'Meeting',
            time: result.parameters.time || null
          };
          
        case 'contact':
          return {
            actionType: 'contact',
            action: 'create',
            name: result.parameters.name || 'New Contact',
            email: result.parameters.email || null
          };
          
        default:
          return null;
      }
    } catch (error) {
      this.logError('Failed to parse proposal action with AI', error);
      return null;
    }
  }

  /**
   * Create tool call from parsed action details
   */
  private createToolCallFromAction(actionDetails: any): any | null {
    try {
      switch (actionDetails.actionType) {
        case 'email':
          return {
            name: 'email_agent',
            parameters: {
              action: 'send',
              recipient: actionDetails.recipient,
              subject: actionDetails.subject,
              body: actionDetails.body
            }
          };

        case 'calendar':
          return {
            name: 'calendar_agent',
            parameters: {
              action: 'create',
              title: actionDetails.title,
              time: actionDetails.time
            }
          };

        case 'contact':
          return {
            name: 'contact_agent',
            parameters: {
              action: 'create',
              name: actionDetails.name,
              email: actionDetails.email
            }
          };

        default:
          return null;
      }
    } catch (error) {
      this.logError('Error creating tool call from action', error);
      return null;
    }
  }

  /**
   * Check if event has already been processed (deduplication)
   */
  private isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Mark event as processed and manage cache size
   */
  private markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    
    // Clean up old events to prevent memory leaks
    if (this.processedEvents.size > 1000) {
      const eventsArray = Array.from(this.processedEvents);
      const eventsToRemove = eventsArray.slice(0, 500);
      eventsToRemove.forEach(id => this.processedEvents.delete(id));
      
      this.logDebug('Cleaned up processed events cache', {
        removed: eventsToRemove.length,
        remaining: this.processedEvents.size
      });
    }
  }

  /**
   * Extract Slack context from raw event
   */
  private async extractSlackContext(event: any, teamId: string): Promise<SlackContext> {
    try {
      // Get additional user information if available
      let userName: string | undefined;
      let userEmail: string | undefined;
      
      if (event.user) {
        try {
          const userInfo = await this.client.users.info({ user: event.user });
          if (userInfo.user) {
            userName = userInfo.user.name;
            userEmail = userInfo.user.profile?.email;
          }
        } catch (userError) {
          this.logDebug('Could not fetch additional user info', { error: userError });
        }
      }
      
      return {
        userId: event.user || 'unknown',
        channelId: event.channel || 'unknown',
        teamId: teamId,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im',
        userName,
        userEmail
      };
    } catch (error) {
      this.logError('Error extracting Slack context', error);
      
      // Return basic context as fallback
      return {
        userId: event.user || 'unknown',
        channelId: event.channel || 'unknown',
        teamId: teamId,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im'
      };
    }
  }

  /**
   * Determine event type from raw event
   */
  private determineEventType(event: any): SlackEventType | null {
    switch (event.type) {
      case 'app_mention':
        return 'app_mention';
      case 'message':
        return 'message';
      default:
        return null;
    }
  }

  /**
   * Route event to appropriate handler based on type and context
   */
  private async routeEvent(
    event: any, 
    context: SlackContext, 
    eventType: SlackEventType
  ): Promise<void> {
    const message = this.cleanMessage(event.text || '');
    
    // Validate message
    if (!message || message.trim().length === 0) {
      await this.sendMessage(context.channelId, {
        text: 'I received your message but it appears to be empty. Please try sending a message with some content.'
      });
      return;
    }

    // Check if this is a confirmation response
    if (await this.isConfirmationResponse(message, context)) {
      await this.handleConfirmationResponse(message, context);
      return;
    }

    // Check for email-related requests and OAuth requirements
    const requiresOAuth = await this.checkOAuthRequirement(message, context);
    if (requiresOAuth) {
      return; // OAuth message already sent by checkOAuthRequirement
    }

    // Create agent request
    const agentRequest: SlackAgentRequest = {
      message: message,
      context: context,
      eventType: eventType,
      metadata: {
        timestamp: new Date().toISOString(),
        eventId: `${context.userId}-${Date.now()}`
      }
    };

    // Route to master agent through tool executor
    const agentResponse = await this.routeToAgent(agentRequest);

    // Send response back to Slack
    await this.sendAgentResponse(agentResponse, context);
  }

  /**
   * Check if request requires OAuth and handle accordingly using AI
   * Replaces: Hardcoded keyword arrays with AI-driven OAuth detection
   */
  private async checkOAuthRequirement(message: string, context: SlackContext): Promise<boolean> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI OAuth detection is required for this operation.');
      }

      const oauthRequirement = await aiClassificationService.detectOAuthRequirement(message);
      
      if (oauthRequirement !== 'none' && this.tokenManager) {
        const hasOAuth = await this.tokenManager.hasValidOAuthTokens(context.teamId, context.userId);
        if (!hasOAuth) {
          this.logInfo('OAuth required for operation but no tokens found', { 
            userId: context.userId,
            oauthRequirement,
            message: message.substring(0, 100)
          });
          
          await this.sendOAuthRequiredMessage(context);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logError('Error checking OAuth requirement', error);
      return false;
    }
  }

  /**
   * Route request to master agent through existing system
   */
  private async routeToAgent(request: SlackAgentRequest): Promise<SlackAgentResponse> {
    const startTime = Date.now();
    
    // Generate session ID (move outside try block so it's available in catch)
    const sessionId = `user:${request.context.teamId}:${request.context.userId}`;
    
    try {
      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService not available');
      }

      this.logInfo('Routing Slack request to MasterAgent', { 
        message: request.message,
        eventType: request.eventType,
        userId: request.context.userId
      });
      
      // Get OAuth tokens if available
      let accessToken: string | undefined;
      if (this.tokenManager) {
        try {
          accessToken = await this.tokenManager.getValidTokens(
            request.context.teamId, 
            request.context.userId
          ) || undefined;
        } catch (error) {
          this.logError('Error retrieving OAuth tokens', error, { sessionId });
        }
      }
      
      // Initialize MasterAgent
      const { createMasterAgent } = await import('../config/agent-factory-init');
      const masterAgent = createMasterAgent({ 
        openaiApiKey: process.env.OPENAI_API_KEY || 'dummy-key' 
      });
      
      // Route to MasterAgent for intent parsing with Slack context
      const masterResponse = await masterAgent.processUserInput(
        request.message,
        sessionId,
        request.context.userId,
        request.context
      );

      // Check for proposals first - don't execute tools immediately if confirmation needed
      this.logInfo('Checking for proposals', {
        hasProposal: !!masterResponse.proposal,
        proposalRequiresConfirmation: masterResponse.proposal?.requiresConfirmation,
        proposalText: masterResponse.proposal?.text?.substring(0, 100),
        sessionId
      });
      
      if (masterResponse.proposal && masterResponse.proposal.requiresConfirmation) {
        this.logInfo('Proposal requires confirmation, showing proposal to user', {
          proposalText: masterResponse.proposal.text.substring(0, 100),
          actionType: masterResponse.proposal.actionType,
          sessionId
        });
        
        // Return proposal without executing tools
        const processingTime = Date.now() - startTime;
        return {
          success: true,
          response: await this.formatAgentResponse(masterResponse, request.context),
          shouldRespond: true,
          executionMetadata: {
            processingTime,
            toolResults: [], // No tools executed yet - waiting for confirmation
            masterAgentResponse: masterResponse.message,
            awaitingConfirmation: true
          } as any
        };
      }

      // Execute tool calls if present (only when no confirmation needed)
      const toolResults: ToolResult[] = [];
      
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        this.logInfo('No confirmation required, executing tools directly', {
          toolCount: masterResponse.toolCalls.length,
          sessionId
        });
        
        const executionContext: ToolExecutionContext = {
          sessionId,
          userId: request.context.userId,
          timestamp: new Date(),
          slackContext: request.context
        };

        for (const toolCall of masterResponse.toolCalls) {
          try {
            // Execute tool directly - no confirmation needed
            const result = await this.toolExecutorService!.executeTool(
              toolCall,
              executionContext,
              accessToken,
              { preview: false }
            );
            
            if (result && 'toolName' in result) {
              // Regular tool result - result is ToolResult
              const toolResult = result as ToolResult;
              toolResults.push(toolResult);
              this.logDebug(`Tool ${toolCall.name} executed successfully`, {
                success: toolResult.success,
                executionTime: toolResult.executionTime,
                sessionId
              });
            } else {
              this.logWarn(`Tool ${toolCall.name} returned no result`, { sessionId });
            }
          } catch (error) {
            // Enhanced error handling for tool execution
            const errorContext = {
              toolName: toolCall.name,
              sessionId,
              userId: request.context.userId,
              hasAccessToken: !!accessToken,
              toolParameters: Object.keys(toolCall.parameters || {})
            };

            this.logError(`Error executing tool ${toolCall.name}`, error, errorContext);
            
            
            // Check if this is an OAuth error
            if (error instanceof Error && error.message.includes('OAuth')) {
              this.logInfo('OAuth error detected, may need re-authentication', errorContext);
            }

            toolResults.push({
              toolName: toolCall.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown execution error',
              result: null,
              executionTime: 0
            });
          }
        }
      }

      // Process tool results through Master Agent LLM for natural language response
      if (toolResults.length > 0) {
        const naturalLanguageResponse = await this.processToolResultsWithMasterAgent(
          request.message,
          toolResults,
          sessionId,
          masterAgent // Pass the existing Master Agent instance
        );
        
        // Update master response with natural language
        masterResponse.message = naturalLanguageResponse;
      }

      // Format response for Slack
      const slackResponse = await this.formatAgentResponse(
        { ...masterResponse, toolResults },
        request.context
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        response: slackResponse,
        shouldRespond: true,
        executionMetadata: {
          processingTime,
          toolResults: toolResults.map(tr => ({
            toolName: tr.toolName,
            success: tr.success,
            executionTime: tr.executionTime,
            error: tr.error || undefined,
            result: tr.result
          })),
          masterAgentResponse: masterResponse.message
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorContext = {
        processingTimeMs: processingTime,
        userId: request.context.userId,
        sessionId: sessionId,
        eventType: request.eventType,
        messageLength: request.message?.length || 0,
        hasToolExecutor: !!this.toolExecutorService,
        hasTokenManager: !!this.tokenManager
      };

      this.logError('Error routing to agent', error, errorContext);

      // Determine error type and provide appropriate response
      let errorMessage = 'I apologize, but I encountered an error while processing your request. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('ToolExecutorService')) {
          errorMessage = 'The tool execution service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('OAuth') || error.message.includes('authentication')) {
          errorMessage = 'Authentication issue detected. You may need to reconnect your account.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'The request timed out. Please try a simpler request or try again.';
        }
      }

      return {
        success: true,
        response: {
          text: errorMessage
        },
        shouldRespond: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionMetadata: {
          processingTime,
          toolResults: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          errorContext
        }
      };
    }
  }

  /**
   * Process tool results through Master Agent LLM for natural language responses
   */
  private async processToolResultsWithMasterAgent(
    userInput: string,
    toolResults: ToolResult[],
    sessionId: string,
    masterAgent: any // Pass the existing Master Agent instance
  ): Promise<string> {
    try {
      // Process tool results through the existing Master Agent LLM
      const naturalLanguageResponse = await masterAgent.processToolResultsWithLLM(
        userInput,
        toolResults,
        sessionId
      );

      return naturalLanguageResponse;
    } catch (error) {
      this.logError('Error processing tool results with Master Agent', error);
      return 'I processed your request successfully.';
    }
  }

  /**
   * Format agent response for Slack with enhanced proposal support
   */
  private async formatAgentResponse(
    masterResponse: any, 
    slackContext: SlackContext
  ): Promise<SlackResponse> {
    try {
      // Check if we have a proposal to handle
      if (masterResponse.proposal && masterResponse.proposal.text) {
        return this.formatProposalResponse(masterResponse.proposal, masterResponse, slackContext);
      }
      
      return this.createFallbackResponse(masterResponse, slackContext);
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
      // For proposals, we prefer natural text responses over blocks
      // This aligns with the plan to transform from technical confirmations to conversational proposals
      
      if (proposal.requiresConfirmation) {
        // Always use simple text for proposals to look more natural and conversational
        // Slack supports up to 4000 characters in a single message
        const maxTextLength = 3800; // Leave some buffer
        
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
          // Add confirmation instructions in the text itself
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
        text: proposal.text || masterResponse.message || 'I processed your request successfully.'
      };
    }
  }


  /**
   * Create natural language response without technical details
   * Shows user-friendly messages instead of tool execution details
   */
  private createFallbackResponse(masterResponse: any, slackContext: SlackContext): SlackResponse {
    // Start with master agent's natural message
    let responseText = masterResponse.message || 'I processed your request successfully.';

    // Replace technical tool details with natural language success messages
    if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
      const successfulResults = masterResponse.toolResults.filter((tr: any) => tr.success);
      const failedResults = masterResponse.toolResults.filter((tr: any) => !tr.success);

      // Only generate success message if we don't already have a natural language response from Master Agent LLM
      if (successfulResults.length > 0 && 
          (masterResponse.message === 'I processed your request successfully.' || 
           !masterResponse.message || 
           masterResponse.message.trim() === '')) {
        // Generate natural success message based on what was accomplished
        responseText = this.generateSuccessMessage(successfulResults, masterResponse);
      }

      if (failedResults.length > 0) {
        const oauthFailures = failedResults.filter((fr: any) => 
          fr.error?.includes('OAuth authentication required')
        );
        
        if (oauthFailures.length > 0) {
          responseText += '\n\n🔐 Some features require Gmail authentication. Please connect your account to use email functionality.';
        } else {
          responseText += '\n\n⚠️ I encountered some issues completing your request. Please try again.';
        }
      }
    }

    // Add context information if available
    if (masterResponse.contextGathered && masterResponse.contextGathered.relevantContext) {
      responseText += '\n\n📝 I used context from our recent conversation to better understand your request.';
    }

    return {
      text: responseText
    };
  }

  /**
   * Generate natural language success message based on tool results
   */
  private generateSuccessMessage(successfulResults: any[], masterResponse: any): string {
    if (successfulResults.length === 0) {
      return 'I processed your request successfully.';
    }

    // Check what types of actions were performed
    const emailResults = successfulResults.filter(r => r.toolName === 'emailAgent');
    const contactResults = successfulResults.filter(r => r.toolName === 'contactAgent');
    const calendarResults = successfulResults.filter(r => r.toolName === 'calendarAgent');

    let message = '';

    if (emailResults.length > 0) {
      const emailResult = emailResults[0];
      if (emailResult.result && emailResult.result.action === 'send') {
        message = `✅ Great! I successfully sent your email`;
        if (emailResult.result.recipient) {
          message += ` to ${emailResult.result.recipient}`;
        }
        if (emailResult.result.subject) {
          message += ` about "${emailResult.result.subject}"`;
        }
        message += '.';
      } else if (emailResult.result && emailResult.result.action === 'search') {
        const count = emailResult.result.count || 0;
        message = `✅ I found ${count} email${count !== 1 ? 's' : ''} matching your search.`;
      } else {
        message = '✅ I successfully processed your email request.';
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
   * Send agent response back to Slack
   */
  private async sendAgentResponse(response: SlackAgentResponse, context: SlackContext): Promise<void> {
    if (response.shouldRespond !== false && response.response) {
      try {
        if (response.response.blocks && response.response.blocks.length > 0) {
          await this.sendFormattedMessage(context.channelId, response.response.blocks, {
            text: response.response.text || undefined
          });
        } else if (response.response.text) {
          await this.sendMessage(context.channelId, {
            text: response.response.text
          });
        }
      } catch (error) {
        this.logError('Error sending agent response to Slack', error);
      }
    }
  }

  /**
   * Send OAuth required message
   */
  private async sendOAuthRequiredMessage(context: SlackContext): Promise<void> {
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
              type: 'plain_text',
              text: '🔗 Connect Gmail Account'
            },
            style: 'primary',
            action_id: 'gmail_oauth',
            url: oauthUrl
          }
        }
      ];

      await this.sendFormattedMessage(context.channelId, blocks, {
        text: 'Gmail authentication required. Please connect your Gmail account to use email features.'
      });
    } catch (error) {
      this.logError('Error sending OAuth required message', error);
      await this.sendMessage(context.channelId, {
        text: '🔐 Gmail authentication required. Please contact support to connect your Gmail account.'
      });
    }
  }

  /**
   * Generate OAuth URL for Slack user authentication
   */
  private async generateOAuthUrl(slackContext: SlackContext): Promise<string> {
    try {
      const { ENVIRONMENT } = await import('../config/environment');
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
      const { ENVIRONMENT } = await import('../config/environment');
      return `${ENVIRONMENT.baseUrl}/auth/error?message=OAuth+URL+generation+failed`;
    }
  }

  /**
   * Send simple text message to Slack
   */
  private async sendMessage(channelId: string, message: { text: string }): Promise<void> {
    try {
      const messagePayload = {
        channel: channelId,
        text: message.text
      };
      
      this.logDebug('Sending message to Slack', { 
        channel: channelId,
        messagePayload: JSON.stringify(messagePayload)
      });
      
      await this.client.chat.postMessage(messagePayload);
    } catch (error) {
      this.logError('Error sending message to Slack', error);
    }
  }

  /**
   * Send formatted message with blocks to Slack
   */
  private async sendFormattedMessage(
    channelId: string, 
    blocks: any[], 
    options?: { text?: string }
  ): Promise<void> {
    try {
      const messagePayload: any = {
        channel: channelId,
        blocks: blocks
      };

      if (options?.text) messagePayload.text = options.text;

      await this.client.chat.postMessage(messagePayload);
    } catch (error) {
      this.logError('Error sending formatted message to Slack', error);
      
      // Fallback to simple text message
      if (options?.text) {
        await this.sendMessage(channelId, { 
          text: options.text
        });
      }
    }
  }

  /**
   * Clean Slack message (remove mentions, normalize whitespace)
   */
  private cleanMessage(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/<@[UW][A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/<![^>]+>/g, '') // Remove special mentions (@channel, @here)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy && !!this.client,
      details: {
        ...baseHealth.details,
        configured: !!(
          this.config.signingSecret &&
          this.config.botToken &&
          this.config.clientId
        ),
        development: this.config.development,
        hasClient: !!this.client,
        dependencies: {
          tokenManager: !!this.tokenManager,
          toolExecutorService: !!this.toolExecutorService,
          slackMessageReaderService: !!this.slackMessageReaderService,
        },
        processedEventsCount: this.processedEvents.size
      }
    };
  }
}


