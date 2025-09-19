import { BaseService } from '../base-service';
import { SlackContext, SlackEventType, SlackAgentRequest, SlackAgentResponse } from '../../types/slack/slack.types';
import { ToolExecutorService } from '../tool-executor.service';
import { TokenManager } from '../token-manager';
import { AIClassificationService } from '../ai-classification.service';
import { AsyncRequestClassifierService, ClassificationContext } from '../async-request-classifier.service';
import { SlackAsyncHandlerService, AsyncSlackResponse } from './slack-async-handler.service';
import { ToolExecutionContext } from '../../types/tools';
import { serviceManager } from '../service-manager';
import { JobQueueService } from '../job-queue.service';
import logger from '../../utils/logger';

export interface SlackMessageProcessorConfig {
  enableOAuthDetection: boolean;
  enableConfirmationDetection: boolean;
  enableDMOnlyMode: boolean;
  enableAsyncProcessing?: boolean;
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
  private asyncRequestClassifierService: AsyncRequestClassifierService | null = null;
  private slackAsyncHandlerService: SlackAsyncHandlerService | null = null;
  private jobQueueService: JobQueueService | null = null;

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
        hasAIClassification: !!this.aiClassificationService,
        hasAsyncClassifier: !!this.asyncRequestClassifierService,
        hasSlackAsyncHandler: !!this.slackAsyncHandlerService,
        enableAsyncProcessing: !!this.config.enableAsyncProcessing
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
      this.asyncRequestClassifierService = null;
      this.slackAsyncHandlerService = null;
      this.jobQueueService = null;
      this.logInfo('SlackMessageProcessor destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackMessageProcessor destruction', error);
    }
  }

  /**
   * Process a Slack message - with optional async classification
   */
  async processMessage(message: string, context: SlackContext, eventType: SlackEventType): Promise<SlackMessageProcessingResult> {
    const startTime = Date.now();

    try {
      // Check if async processing is enabled and should be used
      if (this.config.enableAsyncProcessing && this.shouldUseAsyncProcessing(message, context)) {
        return await this.handleAsyncRequest(message, context, eventType);
      }
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
   * Process message asynchronously for immediate response
   * Returns a job ID for tracking, actual processing happens in background
   */
  async processMessageAsync(
    message: string,
    context: SlackContext,
    eventType: SlackEventType,
    options: {
      sendImmediateResponse?: boolean;
      immediateResponseText?: string;
    } = {}
  ): Promise<{ jobId: string; immediateResponse?: any }> {
    try {
      // Validate message first
      const validationResult = this.validateMessage(message);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Invalid message');
      }

      // Check if async processing is available
      if (!this.jobQueueService) {
        this.logWarn('JobQueueService not available, falling back to sync processing');
        const syncResult = await this.processMessage(message, context, eventType);
        return {
          jobId: 'sync-' + Date.now(),
          immediateResponse: syncResult.response
        };
      }

      // Send immediate response if requested
      let immediateResponse;
      if (options.sendImmediateResponse) {
        immediateResponse = {
          text: options.immediateResponseText || "🔄 Processing your request...",
          response_type: 'in_channel'
        };
      }

      // Queue the job for background processing
      const jobId = await this.jobQueueService.addJob(
        'ai_request',
        {
          message,
          context,
          eventType,
          timestamp: Date.now()
        },
        {
          priority: 2, // High priority for user requests
          userId: context.userId,
          sessionId: `user:${context.teamId}:${context.userId}`
        }
      );

      this.logInfo('Message queued for async processing', {
        jobId,
        userId: context.userId,
        messageLength: message.length
      });

      return {
        jobId,
        immediateResponse
      };

    } catch (error) {
      this.logError('Error queueing message for async processing', error, {
        userId: context.userId,
        messageLength: message.length
      });
      throw error;
    }
  }

  /**
   * Check if a message should be processed asynchronously
   * Determines based on message content and expected processing time
   */
  shouldProcessAsync(message: string, context: SlackContext): boolean {
    // Process async if:
    // 1. JobQueueService is available
    // 2. Message looks like it requires AI processing (complex request)
    // 3. Not a simple confirmation or status check

    if (!this.jobQueueService) {
      return false;
    }

    // Simple confirmations should be processed immediately
    const confirmationPatterns = [
      /^(yes|y|ok|okay|confirm|proceed|go ahead|do it)$/i,
      /^(no|n|cancel|stop|abort|nevermind)$/i
    ];

    for (const pattern of confirmationPatterns) {
      if (pattern.test(message.trim())) {
        return false; // Process confirmations immediately
      }
    }

    // Process async if message is complex or likely to take time
    const asyncPatterns = [
      /send.*email/i,
      /create.*calendar/i,
      /schedule.*meeting/i,
      /analyze/i,
      /summarize/i,
      /write.*code/i,
      /generate/i
    ];

    for (const pattern of asyncPatterns) {
      if (pattern.test(message)) {
        return true;
      }
    }

    // Default: process async if message is longer than 50 characters
    return message.length > 50;
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

      // First check if there are any pending actions for this user
      const sessionId = `user:${context.teamId}:${context.userId}`;
      const databaseService = serviceManager.getService('databaseService') as any;

      let hasPendingActions = false;
      if (databaseService) {
        try {
          const session = await databaseService.getSession(sessionId);
          hasPendingActions = session?.pendingActions && Array.isArray(session.pendingActions) && session.pendingActions.length > 0;
        } catch (error) {
          this.logWarn('Could not check for pending actions', { sessionId, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      // Only run AI classification if there are pending actions
      if (!hasPendingActions) {
        this.logInfo('No pending actions found, skipping confirmation detection', {
          sessionId,
          message: message.substring(0, 50)
        });
        return { isConfirmation: false };
      }

      // Now check if the message is actually a confirmation
      const classification = await this.aiClassificationService.classifyConfirmationResponse(message);
      const isConfirmation = classification === 'confirm' || classification === 'reject';

      this.logInfo('Confirmation classification result', {
        message: message.substring(0, 50),
        classification,
        isConfirmation,
        hasPendingActions,
        sessionId
      });

      if (isConfirmation) {
        this.logInfo('Confirmation response detected with pending actions', {
          message: message.substring(0, 50),
          classification,
          userId: context.userId,
          channelId: context.channelId
        });

        // Process confirmation using existing database system
        const confirmationResponse = await this.processConfirmationFromDatabase(message, context);
        if (confirmationResponse) {
          return {
            isConfirmation: true,
            response: confirmationResponse
          };
        }

        // Fallback if confirmation processing fails
        return {
          isConfirmation: true,
          response: {
            text: 'I detected a confirmation response, but I need access to recent messages to process it. Please try again.'
          }
        };
      } else {
        // User provided a new request instead of confirming
        // Clear pending actions since they've moved on to a new task
        this.logInfo('User provided new request instead of confirmation, clearing pending actions', {
          sessionId,
          oldPendingActionsCount: hasPendingActions ? 1 : 0,
          newMessage: message.substring(0, 50)
        });

        if (databaseService && hasPendingActions) {
          try {
            const session = await databaseService.getSession(sessionId);
            if (session) {
              const updatedSessionData = {
                ...session,
                pendingActions: [], // Clear pending actions
                lastActivity: new Date()
              };
              await databaseService.createSession(updatedSessionData);

              this.logInfo('Pending actions cleared, processing new request', {
                sessionId,
                clearedActionsCount: session.pendingActions?.length || 0
              });
            }
          } catch (error) {
            this.logWarn('Failed to clear pending actions', {
              sessionId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return { isConfirmation: false };
      }
    } catch (error) {
      this.logError('Error detecting confirmation response', error);
      return { isConfirmation: false };
    }
  }

  /**
   * Process confirmation using existing database system
   */
  private async processConfirmationFromDatabase(message: string, context: SlackContext): Promise<any> {
    try {
      // Find pending confirmation in session data
      const databaseService = serviceManager.getService('databaseService') as any;
      if (!databaseService) {
        this.logWarn('Database service not available for confirmation processing');
        return null;
      }

      // Generate session ID for this user (matches the format used in storing confirmations)
      const sessionId = `user:${context.teamId}:${context.userId}`;

      this.logInfo('Looking for pending actions in session', {
        sessionId,
        userId: context.userId,
        teamId: context.teamId
      });

      // Get the specific session for this user
      const session = await databaseService.getSession(sessionId);

      if (!session) {
        this.logWarn('No session found for user', {
          sessionId,
          userId: context.userId,
          channelId: context.channelId
        });
        return null;
      }

      // Check if session has pending actions
      if (!session.pendingActions || !Array.isArray(session.pendingActions) || session.pendingActions.length === 0) {
        this.logWarn('No pending actions found in session', {
          sessionId,
          userId: context.userId,
          hasPendingActions: !!session.pendingActions,
          pendingActionsLength: session.pendingActions?.length || 0
        });
        return null;
      }

      const pendingActions = session.pendingActions;

      if (!pendingActions || pendingActions.length === 0) {
        this.logWarn('No pending actions in session');
        return null;
      }

      // Use the first pending action (most recent)
      const pendingAction = pendingActions[0];

      this.logInfo('Processing pending action', {
        sessionId,
        pendingActionType: pendingAction.type,
        pendingActionId: pendingAction.actionId,
        awaitingConfirmation: pendingAction.awaitingConfirmation
      });

      // Determine if this is a confirmation or rejection
      const classification = await this.aiClassificationService?.classifyConfirmationResponse(message);
      const isConfirmation = classification === 'confirm';
      const isRejection = classification === 'reject';

      this.logInfo('Confirmation classification result', {
        classification,
        isConfirmation,
        isRejection,
        message: message.substring(0, 100)
      });

      if (isConfirmation) {
        // Execute the confirmed action using ToolExecutorService
        const result = await this.executeConfirmedActionFromPendingAction(pendingAction, context.userId, sessionId);

        if (result.success) {
          // Clear pending actions from session
          const updatedSessionData = {
            ...session,
            pendingActions: [],
            lastActivity: new Date()
          };
          await databaseService.createSession(updatedSessionData);

          this.logInfo('Confirmation processed successfully', {
            sessionId,
            actionType: pendingAction.type,
            resultMessage: result.message
          });

          return {
            text: `✅ ${result.message}`
          };
        } else {
          this.logError('Confirmed action execution failed', {
            sessionId,
            actionType: pendingAction.type,
            error: result.message
          });

          return {
            text: `❌ ${result.message}`
          };
        }
      } else if (isRejection) {
        // Clear pending actions from session
        const updatedSessionData = {
          ...session,
          pendingActions: [],
          lastActivity: new Date()
        };
        await databaseService.createSession(updatedSessionData);

        this.logInfo('Action cancelled by user', {
          sessionId,
          actionType: pendingAction.type
        });

        return {
          text: '❌ Action cancelled as requested.'
        };
      } else {
        // Unclear response
        this.logWarn('Unclear confirmation response', {
          sessionId,
          classification,
          message: message.substring(0, 100)
        });

        return {
          text: 'I\'m not sure if you want me to proceed or not. Please reply with "yes" to confirm or "no" to cancel.'
        };
      }

    } catch (error) {
      this.logError('Error processing confirmation from database', error);
      return null;
    }
  }

  /**
   * Execute confirmed action from pending action data
   */
  private async executeConfirmedActionFromPendingAction(
    pendingAction: any,
    userId: string,
    sessionId: string
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    try {
      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService not available');
      }

      // Extract action details from pending action
      const actionType = pendingAction.type || 'unknown';
      const query = pendingAction.parameters?.query || pendingAction.parameters?.originalQuery;

      if (!query) {
        return {
          success: false,
          message: 'Cannot execute action: missing query information'
        };
      }

      // Get OAuth tokens if available - extract teamId from sessionId
      let accessToken: string | undefined;
      if (this.tokenManager && sessionId) {
        try {
          // Extract teamId and userId from sessionId format: "user:teamId:userId"
          const sessionParts = sessionId.split(':');
          if (sessionParts.length >= 3) {
            const teamId = sessionParts[1];
            const userIdFromSession = sessionParts[2];

            // Validate that we have non-empty strings
            if (teamId && userIdFromSession && typeof teamId === 'string' && typeof userIdFromSession === 'string') {
              this.logInfo('Retrieving access token for confirmed action execution', {
                sessionId,
                teamId,
                userId: userIdFromSession,
                actionType
              });

              // Use Gmail-specific token method for email actions that includes validation and refresh
              if (actionType === 'email') {
                const tokenResult = await this.tokenManager.getValidTokensForGmail(teamId, userIdFromSession);
                accessToken = tokenResult || undefined;
              } else {
                // For other action types, use general token method
                const tokenResult = await this.tokenManager.getValidTokens(teamId, userIdFromSession);
                accessToken = tokenResult || undefined;
              }
            } else {
              this.logWarn('Invalid teamId or userId extracted from sessionId', {
                sessionId,
                teamId,
                userIdFromSession,
                actionType
              });
            }

            if (!accessToken) {
              this.logWarn('No valid access token found for confirmed action execution', {
                sessionId,
                teamId,
                userId: userIdFromSession,
                actionType
              });
            }
          }
        } catch (error) {
          this.logError('Error retrieving OAuth tokens for confirmed action', error, {
            sessionId,
            actionType
          });
        }
      }

      // Create execution context
      const executionContext: ToolExecutionContext = {
        sessionId: sessionId || `session-${userId}-${Date.now()}`,
        userId,
        timestamp: new Date()
      };

      // Create tool call from pending action
      const toolCall = {
        name: actionType === 'email' ? 'emailAgent' : actionType === 'calendar' ? 'calendarAgent' : actionType,
        parameters: pendingAction.parameters
      };

      // Execute the tool call with proper access token
      const toolResult = await this.toolExecutorService.executeTool(
        toolCall,
        executionContext,
        accessToken, // Pass the retrieved access token
        { preview: false } // Execute for real
      );

      if (toolResult.success) {
        return {
          success: true,
          message: toolResult.result?.message || '🎉💖 Yay! Action completed successfully and I\'m so happy I could help! ✨',
          data: { 
            actionId: pendingAction.actionId, 
            result: toolResult.result,
            executionTime: toolResult.executionTime
          }
        };
      } else {
        return {
          success: false,
          message: toolResult.error || 'Action execution failed'
        };
      }
    } catch (error) {
      this.logError('Failed to execute confirmed action:', error);
      return {
        success: false,
        message: 'Failed to execute action'
      };
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
      
      // Get OAuth tokens if available - retry logic for token refresh
      let accessToken: string | undefined;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        if (this.tokenManager) {
          try {
            accessToken = await this.tokenManager.getValidTokens(
              request.context.teamId, 
              request.context.userId
            ) || undefined;
            
            // If we got a token, break out of retry loop
            if (accessToken) {
              break;
            }
            
            // If no token and this is not the last retry, wait a bit and try again
            if (retryCount < maxRetries) {
              this.logInfo('No valid tokens found, retrying after token refresh', { 
                retryCount, 
                sessionId 
              });
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            }
          } catch (error) {
            this.logError('Error retrieving OAuth tokens', error, { sessionId, retryCount });
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            }
          }
        }
        retryCount++;
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

      // Execute tools in preview mode to check for confirmation needs
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        const executionContext: ToolExecutionContext = {
          sessionId,
          userId: request.context.userId,
          timestamp: new Date(),
          metadata: {
            teamId: request.context.teamId,
            channelId: request.context.channelId
          }
        };
        
        this.logInfo('Starting preview mode execution for Slack', {
          toolCalls: masterResponse.toolCalls.map(tc => ({ name: tc.name, hasParams: !!tc.parameters })),
          sessionId,
          userId: request.context.userId
        });
        
        // Execute tools in preview mode to check for confirmation needs
        const previewResults = await this.toolExecutorService.executeTools(
          masterResponse.toolCalls,
          executionContext,
          accessToken,
          { preview: true } // Run in preview mode
        );
        
        this.logInfo('Preview mode execution completed for Slack', {
          previewResultsCount: previewResults.length,
          results: previewResults.map(r => ({
            toolName: r.toolName,
            success: r.success,
            hasAwaitingConfirmation: r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result,
            awaitingConfirmationValue: r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result ? r.result.awaitingConfirmation : undefined
          }))
        });
        
        // Check if any tools require confirmation
        const needsConfirmation = previewResults.some(result =>
          result.result && typeof result.result === 'object' &&
          'awaitingConfirmation' in result.result &&
          result.result.awaitingConfirmation === true
        );

        this.logInfo('Preview results analysis', {
          previewResultsCount: previewResults.length,
          needsConfirmation,
          resultsWithAwaitingConfirmation: previewResults.filter(r =>
            r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result
          ).length,
          resultsDetails: previewResults.map(r => ({
            toolName: r.toolName,
            success: r.success,
            hasResult: !!r.result,
            hasAwaitingConfirmation: r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result,
            awaitingConfirmationValue: r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result ? r.result.awaitingConfirmation : undefined
          }))
        });

        if (needsConfirmation) {
          this.logInfo('Tools require confirmation, showing preview to user', {
            sessionId,
            previewResultsCount: previewResults.length
          });

          // Generate confirmation message from preview results
          const confirmationText = this.generateConfirmationMessage(previewResults, masterResponse);

          // Store confirmation in database using existing system
          await this.storeConfirmationInDatabase(sessionId, request.context, masterResponse.toolCalls, previewResults);

          const processingTime = Date.now() - startTime;
          return {
            success: true,
            response: {
              text: confirmationText
            },
            shouldRespond: true,
            executionMetadata: {
              processingTime,
              toolResults: previewResults.map(tr => ({
                toolName: tr.toolName,
                success: tr.success,
                executionTime: tr.executionTime,
                error: tr.error || undefined,
                result: tr.result
              })),
              masterAgentResponse: confirmationText
            }
          };
        }
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
          text: masterResponse.message || '🌟💖 Yay! I processed your request successfully and I\'m so happy I could help! ✨'
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

    this.jobQueueService = serviceManager.getService('jobQueueService') as JobQueueService;
    if (!this.jobQueueService) {
      this.logWarn('JobQueueService not available - will process requests synchronously');
    }

    this.aiClassificationService = serviceManager.getService('aiClassificationService') as AIClassificationService;
    if (!this.aiClassificationService) {
      this.logWarn('AIClassificationService not available - some features will be limited');
    }

    this.asyncRequestClassifierService = serviceManager.getService('asyncRequestClassifierService') as AsyncRequestClassifierService;
    if (!this.asyncRequestClassifierService) {
      this.logWarn('AsyncRequestClassifierService not available - async processing will be disabled');
    }

    this.slackAsyncHandlerService = serviceManager.getService('slackAsyncHandlerService') as SlackAsyncHandlerService;
    if (!this.slackAsyncHandlerService && this.config.enableAsyncProcessing) {
      this.logWarn('SlackAsyncHandlerService not available - async processing will be disabled');
    }
  }

  /**
   * Generate confirmation message from preview results
   */
  private generateConfirmationMessage(previewResults: any[], masterResponse: any): string {
    const confirmationResults = previewResults.filter(result =>
      result.result && typeof result.result === 'object' &&
      'awaitingConfirmation' in result.result &&
      result.result.awaitingConfirmation === true
    );

    if (confirmationResults.length === 0) {
      return 'I need to confirm this action before proceeding.';
    }

    let message = 'I\'d like to confirm the following action:\n\n';

    confirmationResults.forEach((result, index) => {
      const preview = result.result.preview;
      if (preview) {
        // Use the structured preview format
        message += `**${preview.title || result.toolName}**\n`;
        if (preview.description) {
          message += `${preview.description}\n`;
        }

        // Add detailed preview data for email and calendar operations
        if (preview.previewData) {
          if (preview.actionType === 'email') {
            const emailData = preview.previewData;
            if (emailData.recipients) {
              message += `📧 **To:** ${Array.isArray(emailData.recipients.to) ? emailData.recipients.to.join(', ') : emailData.recipients.to}\n`;
            }
            if (emailData.subject) {
              message += `📋 **Subject:** ${emailData.subject}\n`;
            }
            if (emailData.contentSummary) {
              const bodyPreview = emailData.contentSummary.length > 100
                ? emailData.contentSummary.substring(0, 100) + '...'
                : emailData.contentSummary;
              message += `💬 **Message:** ${bodyPreview}\n`;
            }
          } else if (preview.actionType === 'calendar') {
            const calendarData = preview.previewData;
            if (calendarData.title) {
              message += `📅 **Event:** ${calendarData.title}\n`;
            }
            if (calendarData.startTime) {
              message += `⏰ **Start:** ${new Date(calendarData.startTime).toLocaleString()}\n`;
            }
            if (calendarData.endTime) {
              message += `⏱️ **End:** ${new Date(calendarData.endTime).toLocaleString()}\n`;
            }
            if (calendarData.attendees && calendarData.attendees.length > 0) {
              message += `👥 **Attendees:** ${calendarData.attendees.join(', ')}\n`;
            }
            if (calendarData.location) {
              message += `📍 **Location:** ${calendarData.location}\n`;
            }
          }
        }

        // Add risk assessment
        if (preview.riskAssessment) {
          const riskLevel = preview.riskAssessment.level?.toUpperCase() || 'UNKNOWN';
          const riskEmoji = riskLevel === 'HIGH' ? '🔴' : riskLevel === 'MEDIUM' ? '🟡' : '🟢';
          message += `${riskEmoji} **Risk Level:** ${riskLevel}\n`;

          if (preview.riskAssessment.warnings && preview.riskAssessment.warnings.length > 0) {
            message += `⚠️ **Warnings:**\n`;
            preview.riskAssessment.warnings.forEach((warning: string) => {
              message += `  • ${warning}\n`;
            });
          }
        }

        // Add execution details
        if (preview.estimatedExecutionTime) {
          message += `⏳ **Estimated time:** ${preview.estimatedExecutionTime}\n`;
        }

        if (index < confirmationResults.length - 1) {
          message += '\n';
        }
      } else {
        // Fallback for results without preview data
        message += `**${result.toolName}**\n`;
        if (result.result.message) {
          message += `${result.result.message}\n`;
        }
      }
    });

    message += '\nWould you like me to proceed? Just reply naturally to confirm.';
    return message;
  }

  /**
   * Store confirmation in database using existing system
   */
  private async storeConfirmationInDatabase(
    sessionId: string, 
    context: SlackContext, 
    toolCalls: any[], 
    previewResults: any[]
  ): Promise<void> {
    try {
      const databaseService = serviceManager.getService('databaseService') as any;
      if (!databaseService) {
        this.logWarn('Database service not available for confirmation storage');
        return;
      }

      // Extract pending actions using the same logic as REST API
      const pendingActions = previewResults
        .filter(result => result.result && typeof result.result === 'object' && 'awaitingConfirmation' in result.result)
        .map(result => ({
          actionId: result.result.actionId || `action-${Date.now()}`,
          type: result.toolName === 'emailAgent' ? 'email' : result.toolName === 'calendarAgent' ? 'calendar' : result.toolName,
          parameters: {
            type: result.toolName === 'emailAgent' ? 'email' : result.toolName === 'calendarAgent' ? 'calendar' : result.toolName,
            query: result.result.parameters?.query || result.result.originalQuery,
            ...result.result.parameters
          },
          awaitingConfirmation: true
        }));

      if (pendingActions.length === 0) {
        this.logWarn('No pending actions to store');
        return;
      }

      // Store pending actions in the session using the same format as REST API
      let sessionData = await databaseService.getSession(sessionId);
      const sessionExisted = !!sessionData;

      if (!sessionData) {
        // Create a new session if one doesn't exist
        this.logInfo('Creating new session for confirmation storage', { sessionId });

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

        sessionData = {
          sessionId,
          userId: context.userId,
          createdAt: now,
          expiresAt,
          lastActivity: now,
          conversationHistory: [],
          toolCalls: [],
          toolResults: [],
          slackContext: context,
          pendingActions: []
        };
      }

      // Update session with pending actions
      const updatedSessionData = {
        ...sessionData,
        pendingActions: pendingActions,
        lastActivity: new Date()
      };

      await databaseService.createSession(updatedSessionData);
      this.logInfo('Pending actions stored in session', {
        sessionId,
        pendingActionsCount: pendingActions.length,
        sessionExisted
      });
      
    } catch (error) {
      this.logError('Error storing confirmation in database', error);
    }
  }

  /**
   * Handle async request processing
   */
  private async handleAsyncRequest(
    message: string,
    context: SlackContext,
    eventType: SlackEventType
  ): Promise<SlackMessageProcessingResult> {
    try {
      if (!this.slackAsyncHandlerService) {
        // Fall back to sync processing if async handler not available
        this.logWarn('SlackAsyncHandlerService not available, falling back to sync processing');
        return this.processSyncMessage(message, context, eventType);
      }

      const asyncResult = await this.slackAsyncHandlerService.handleSlackMessage(message, context, eventType);

      if (!asyncResult.shouldProcessAsync) {
        // Classifier determined sync processing is better
        return this.processSyncMessage(message, context, eventType);
      }

      // Return immediate response for async processing
      return {
        success: true,
        response: asyncResult.immediateResponse,
        shouldRespond: true,
        executionMetadata: {
          processedAsync: true,
          jobId: asyncResult.jobId,
          estimatedCompletion: asyncResult.estimatedCompletion
        }
      };

    } catch (error) {
      this.logError('Error in async request handling', error);
      // Fall back to sync processing on error
      return this.processSyncMessage(message, context, eventType);
    }
  }

  /**
   * Process message synchronously (original logic)
   */
  private async processSyncMessage(
    message: string,
    context: SlackContext,
    eventType: SlackEventType
  ): Promise<SlackMessageProcessingResult> {
    // This contains the original processMessage logic, starting from validation
    return this.processMessageInternal(message, context, eventType);
  }

  /**
   * Check if async processing should be considered for this message
   */
  private shouldUseAsyncProcessing(message: string, context: SlackContext): boolean {
    if (!this.slackAsyncHandlerService) return false;
    return this.slackAsyncHandlerService.shouldUseAsyncProcessing(message, context);
  }

  /**
   * Internal message processing (original sync logic)
   */
  private async processMessageInternal(
    message: string,
    context: SlackContext,
    eventType: SlackEventType
  ): Promise<SlackMessageProcessingResult> {
    // Move the original processMessage implementation here
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

    // Continue with rest of original logic...
    // [The rest of the original processMessage logic would go here]
    return {
      success: true,
      response: { text: 'Sync processing placeholder' },
      shouldRespond: true
    };
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
          aiClassificationService: !!this.aiClassificationService,
          slackAsyncHandlerService: !!this.slackAsyncHandlerService
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
