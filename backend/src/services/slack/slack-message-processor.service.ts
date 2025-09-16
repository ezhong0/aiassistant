import { BaseService } from '../base-service';
import { SlackContext, SlackEventType, SlackAgentRequest, SlackAgentResponse } from '../../types/slack/slack.types';
import { ToolExecutorService } from '../tool-executor.service';
import { TokenManager } from '../token-manager';
import { AIClassificationService } from '../ai-classification.service';
import { serviceManager } from '../service-manager';
import logger from '../../utils/logger';

export interface SlackMessageProcessorConfig {
  enableOAuthDetection: boolean;
  enableConfirmationDetection: boolean;
  enableDMOnlyMode: boolean;
}

/**
 * SlackMessageProcessor - Focused service for processing Slack messages
 * Handles message validation, OAuth detection, confirmation detection, and agent routing
 */
export class SlackMessageProcessor extends BaseService {
  private config: SlackMessageProcessorConfig;
  private tokenManager: TokenManager | null = null;
  private toolExecutorService: ToolExecutorService | null = null;
  private aiClassificationService: AIClassificationService | null = null;

  constructor(config: SlackMessageProcessorConfig) {
    super('SlackMessageProcessor');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackMessageProcessor...');
      
      // Initialize service dependencies
      await this.initializeDependencies();
      
      this.logInfo('SlackMessageProcessor initialized successfully', {
        enableOAuthDetection: this.config.enableOAuthDetection,
        enableConfirmationDetection: this.config.enableConfirmationDetection,
        enableDMOnlyMode: this.config.enableDMOnlyMode,
        hasTokenManager: !!this.tokenManager,
        hasToolExecutor: !!this.toolExecutorService,
        hasAIClassification: !!this.aiClassificationService
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
      this.tokenManager = null;
      this.toolExecutorService = null;
      this.aiClassificationService = null;
      this.logInfo('SlackMessageProcessor destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackMessageProcessor destruction', error);
    }
  }

  /**
   * Process a Slack message through the complete pipeline
   */
  async processMessage(message: string, context: SlackContext, eventType: SlackEventType): Promise<SlackMessageProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate message
      const validationResult = this.validateMessage(message);
      if (!validationResult.isValid) {
        return {
          success: false,
          response: {
            text: validationResult.error || 'Invalid message format'
          },
          shouldRespond: true,
          error: validationResult.error
        };
      }

      // Check DM-only mode
      if (this.config.enableDMOnlyMode && !context.isDirectMessage) {
        return {
          success: false,
          response: {
            text: "🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance."
          },
          shouldRespond: true,
          error: 'Channel interaction rejected - DM-only mode enforced'
        };
      }

      // Check OAuth requirements
      if (this.config.enableOAuthDetection) {
        const oauthResult = await this.checkOAuthRequirement(message, context);
        if (oauthResult.requiresOAuth) {
          return {
            success: false,
            response: oauthResult.response,
            shouldRespond: true,
            error: 'OAuth required but not available'
          };
        }
      }

      // Check for confirmation responses
      if (this.config.enableConfirmationDetection) {
        const confirmationResult = await this.checkConfirmationResponse(message, context);
        if (confirmationResult.isConfirmation) {
          return {
            success: true,
            response: confirmationResult.response,
            shouldRespond: true,
            isConfirmation: true
          };
        }
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

      // Route to agent
      const agentResponse = await this.routeToAgent(agentRequest);

      const processingTime = Date.now() - startTime;
      this.logInfo('Message processed successfully', {
        userId: context.userId,
        processingTimeMs: processingTime,
        hasResponse: !!agentResponse.response
      });

      return {
        success: true,
        response: agentResponse.response,
        shouldRespond: agentResponse.shouldRespond ?? true,
        executionMetadata: {
          ...agentResponse.executionMetadata,
          processingTime
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Error processing message', error, {
        userId: context.userId,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        response: {
          text: 'I apologize, but I encountered an error while processing your request. Please try again.'
        },
        shouldRespond: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionMetadata: {
          processingTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Validate message format and content
   */
  private validateMessage(message: string): { isValid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return {
        isValid: false,
        error: 'I received your message but it appears to be empty. Please try sending a message with some content.'
      };
    }

    if (message.length > 4000) {
      return {
        isValid: false,
        error: 'Message is too long. Please keep your message under 4000 characters.'
      };
    }

    return { isValid: true };
  }

  /**
   * Check if request requires OAuth
   */
  private async checkOAuthRequirement(message: string, context: SlackContext): Promise<{
    requiresOAuth: boolean;
    response?: any;
  }> {
    try {
      if (!this.aiClassificationService || !this.tokenManager) {
        return { requiresOAuth: false };
      }

      const oauthRequirement = await this.aiClassificationService.detectOAuthRequirement(message);
      
      if (oauthRequirement !== 'none') {
        const hasOAuth = await this.tokenManager.hasValidOAuthTokens(context.teamId, context.userId);
        if (!hasOAuth) {
          this.logInfo('OAuth required for operation', { 
            userId: context.userId,
            oauthRequirement,
            message: message.substring(0, 100)
          });
          
          return {
            requiresOAuth: true,
            response: {
              text: '🔐 Gmail authentication required. Please connect your Gmail account to use email features.'
            }
          };
        }
      }
      
      return { requiresOAuth: false };
    } catch (error) {
      this.logError('Error checking OAuth requirement', error);
      return { requiresOAuth: false };
    }
  }

  /**
   * Check if message is a confirmation response
   */
  private async checkConfirmationResponse(message: string, context: SlackContext): Promise<{
    isConfirmation: boolean;
    response?: any;
  }> {
    try {
      if (!this.aiClassificationService) {
        return { isConfirmation: false };
      }

      const classification = await this.aiClassificationService.classifyConfirmationResponse(message);
      const isConfirmation = classification !== 'unknown';
      
      if (isConfirmation) {
        this.logInfo('Confirmation response detected', {
          message: message.substring(0, 50),
          classification,
          userId: context.userId,
          channelId: context.channelId
        });
        
        return {
          isConfirmation: true,
          response: {
            text: 'I detected a confirmation response, but I need access to recent messages to process it. Please try again.'
          }
        };
      }

      return { isConfirmation: false };
    } catch (error) {
      this.logError('Error detecting confirmation response', error);
      return { isConfirmation: false };
    }
  }

  /**
   * Route message to agent for processing
   */
  private async routeToAgent(request: SlackAgentRequest): Promise<SlackAgentResponse> {
    const startTime = Date.now();
    const sessionId = `user:${request.context.teamId}:${request.context.userId}`;
    
    try {
      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService not available');
      }

      this.logInfo('Routing message to MasterAgent', { 
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
      const { createMasterAgent } = await import('../../config/agent-factory-init');
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
          response: {
            text: masterResponse.proposal.text + '\n\nShould I go ahead? Just reply "yes" or "no".'
          },
          shouldRespond: true,
          executionMetadata: {
            processingTime,
            toolResults: [],
            masterAgentResponse: masterResponse.message,
            awaitingConfirmation: true
          } as any
        };
      }

      // Execute tool calls if present (only when no confirmation needed)
      const toolResults: any[] = [];
      
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        this.logInfo('No confirmation required, executing tools directly', {
          toolCount: masterResponse.toolCalls.length,
          sessionId
        });
        
        const executionContext = {
          sessionId,
          userId: request.context.userId,
          timestamp: new Date(),
          slackContext: request.context
        };

        for (const toolCall of masterResponse.toolCalls) {
          try {
            const result = await this.toolExecutorService.executeTool(
              toolCall,
              executionContext,
              accessToken,
              { preview: false }
            );
            
            if (result && 'toolName' in result) {
              toolResults.push(result);
              this.logDebug(`Tool ${toolCall.name} executed successfully`, {
                success: result.success,
                executionTime: result.executionTime,
                sessionId
              });
            }
          } catch (error) {
            this.logError(`Error executing tool ${toolCall.name}`, error, {
              toolName: toolCall.name,
              sessionId,
              userId: request.context.userId
            });

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
        const naturalLanguageResponse = await masterAgent.processToolResultsWithLLM(
          request.message,
          toolResults,
          sessionId
        );
        
        masterResponse.message = naturalLanguageResponse;
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        response: {
          text: masterResponse.message || 'I processed your request successfully.'
        },
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
      this.logError('Error routing to agent', error, {
        processingTimeMs: processingTime,
        userId: request.context.userId,
        sessionId: sessionId
      });

      return {
        success: true,
        response: {
          text: 'I apologize, but I encountered an error while processing your request. Please try again.'
        },
        shouldRespond: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionMetadata: {
          processingTime,
          toolResults: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;
    if (!this.tokenManager) {
      this.logWarn('TokenManager not available - OAuth functionality will be limited');
    }

    this.toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    if (!this.toolExecutorService) {
      throw new Error('ToolExecutorService is required but not available');
    }

    this.aiClassificationService = serviceManager.getService('aiClassificationService') as AIClassificationService;
    if (!this.aiClassificationService) {
      this.logWarn('AIClassificationService not available - some features will be limited');
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
          tokenManager: !!this.tokenManager,
          toolExecutorService: !!this.toolExecutorService,
          aiClassificationService: !!this.aiClassificationService
        }
      }
    };
  }
}

export interface SlackMessageProcessingResult {
  success: boolean;
  response: any;
  shouldRespond: boolean;
  error?: string;
  isConfirmation?: boolean;
  executionMetadata?: any;
}
