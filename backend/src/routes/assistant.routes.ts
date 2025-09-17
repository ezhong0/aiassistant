import express, { Response } from 'express';
import { z } from 'zod';
import { 
  authenticateToken,
  AuthenticatedRequest 
} from '../middleware/auth.middleware';
import { 
  StandardAPIResponse, 
  ResponseBuilder, 
  HTTP_STATUS, 
  ERROR_CODES 
} from '../types/api/api-response.types';
import { validateRequest } from '../middleware/enhanced-validation.middleware';
import { sanitizeString } from '../middleware/validation.middleware';
import { userRateLimit, sensitiveOperationRateLimit } from '../middleware/rate-limiting.middleware';
import { getService } from '../services/service-manager';
import { AIClassificationService } from '../services/ai-classification.service';
import { ToolRoutingService } from '../services/tool-routing.service';
import { REQUEST_LIMITS, RATE_LIMITS } from '../config/app-config';
import { assistantApiLogging } from '../middleware/api-logging.middleware';
import { MasterAgent } from '../agents/master.agent';
import { ToolExecutorService } from '../services/tool-executor.service';
import { TokenStorageService } from '../services/token-storage.service';
import { ToolExecutionContext, ToolResult, ToolCall } from '../types/tools';
import { 
  SendEmailRequestSchema,
  SearchEmailRequestSchema
} from '../schemas/email.schemas';

// Type definitions for better type safety
type PendingAction = {
  actionId: string;
  type: string;
  parameters: Record<string, unknown>;
  awaitingConfirmation?: boolean;
};

type ConfirmationCheck = {
  needsConfirmation: boolean;
  action: ToolCall;
};
import logger from '../utils/logger';

const router = express.Router();

// Apply logging middleware to all assistant routes
router.use(assistantApiLogging);

import { createMasterAgent } from '../config/agent-factory-init';

// Initialize services
let masterAgent: MasterAgent | null = null;

// Initialize MasterAgent with consistent configuration
try {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    masterAgent = createMasterAgent({
      openaiApiKey,
      model: 'gpt-4o-mini'
    });
  } else {
    masterAgent = createMasterAgent();
  }
} catch (error) {
  logger.error('Failed to initialize MasterAgent:', error);
  logger.warn('Assistant will operate in fallback mode');
}

// Using TokenStorageService from service registry instead of SessionService

/**
 * Helper function to safely get the token storage service
 */
const getTokenStorageService = (): TokenStorageService => {
  const service = getService<TokenStorageService>('tokenStorageService');
  if (!service) {
    throw new Error('TokenStorageService not available. Ensure services are initialized.');
  }
  return service;
}

// Validation schemas
const textCommandSchema = z.object({
  command: z.string()
    .min(REQUEST_LIMITS.command.minLength, 'Command is required')
    .max(REQUEST_LIMITS.command.maxLength, 'Command too long')
    .transform(val => sanitizeString(val, REQUEST_LIMITS.command.maxLength)),
  sessionId: z.string()
    .optional()
    .transform(val => val ? sanitizeString(val, REQUEST_LIMITS.sessionId.maxLength) : undefined),
  accessToken: z.string()
    .optional()
    .transform(val => val ? sanitizeString(val, REQUEST_LIMITS.accessToken.maxLength) : undefined),
  context: z.object({
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(REQUEST_LIMITS.conversation.maxContentLength),
      timestamp: z.string().datetime().optional()
    })).optional(),
    pendingActions: z.array(z.object({
      actionId: z.string(),
      type: z.string(),
      parameters: z.record(z.string(), z.unknown()),
      awaitingConfirmation: z.boolean().optional()
    })).optional(),
    userPreferences: z.object({
      language: z.string().optional(),
      timezone: z.string().optional(),
      verbosity: z.enum(['minimal', 'normal', 'detailed']).optional()
    }).optional()
  }).optional()
});

const confirmActionSchema = z.object({
  actionId: z.string().min(1, 'Action ID is required'),
  confirmed: z.boolean(),
  sessionId: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional()
});

const sessionIdSchema = z.object({
  id: z.string().min(1, 'Session ID is required')
});

/**
 * POST /assistant/text-command
 * Main assistant endpoint for processing natural language commands
 */
router.post('/text-command', 
  authenticateToken,
  userRateLimit(
    RATE_LIMITS.assistant.textCommand.maxRequests, 
    RATE_LIMITS.assistant.textCommand.windowMs
  ),
  (req, res, next) => {
    logger.info('Text command request received', {
      body: req.body,
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.get('Content-Type')
    });
    next();
  },
  validateRequest({ body: textCommandSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { command, sessionId, accessToken, context } = req.validatedBody as z.infer<typeof textCommandSchema>;
    const user = req.user!;

    const finalSessionId = String(sessionId || `session-${user.userId}-${Date.now()}`);
    
    // Ensure command is properly typed as string
    const commandString = String(command);
    
    // For now, we'll work with client-provided context only
    const sessionContext = null;
    
    logger.info('Using client context only', {
      sessionId: finalSessionId,
      clientPendingActions: context?.pendingActions?.length || 0,
      clientPendingActionsData: context?.pendingActions
    });
    
    // Use client context directly (no session merging)
    const mergedContext = (context as any) || {};
    
    logger.info('Processing assistant text command', { 
      userId: user.userId, 
      command: commandString.substring(0, 100) + (commandString.length > 100 ? '...' : ''),
      sessionId: finalSessionId,
      hasContext: !!mergedContext,
      hasAccessToken: !!accessToken,
      pendingActions: mergedContext?.pendingActions?.length || 0,
      sessionDebug: mergedContext ? { 
        hasPendingActions: !!mergedContext.pendingActions,
        pendingActionsCount: mergedContext.pendingActions?.length,
        pendingActionsData: mergedContext.pendingActions?.slice(0, 2) // Only show first 2 for debugging
      } : 'no-context'
    });

    // Handle pending actions if present
    logger.info('Checking for pending actions', {
      hasMergedContext: !!mergedContext,
      hasPendingActions: !!(mergedContext?.pendingActions),
      pendingActionsCount: mergedContext?.pendingActions?.length || 0,
      pendingActionsDetails: mergedContext?.pendingActions,
      command: command
    });
    
    if (mergedContext?.pendingActions && mergedContext.pendingActions.length > 0) {
      const pendingAction = mergedContext.pendingActions.find((action: any) => action.awaitingConfirmation);
      logger.info('Found pending action for confirmation', { pendingAction, command });
      
      const isConfirmation = await isConfirmationResponse(commandString);
      if (pendingAction && isConfirmation) {
        logger.info('Processing confirmation response', { actionId: pendingAction.actionId });
        return await handleActionConfirmation(req, res, pendingAction, commandString, finalSessionId);
      }
    }

    // Step 1: Process command with MasterAgent
    if (!masterAgent) {
      const errorResponse = ResponseBuilder.error(
        'Assistant is currently unavailable. Please try again later.',
        ERROR_CODES.SERVICE_UNAVAILABLE,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        undefined,
        { 
          sessionId: finalSessionId,
          userId: user.userId 
        }
      );
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(errorResponse);
    }

    // Get Master Agent response (determines which tools to call)
    const masterResponse = await masterAgent.processUserInput(commandString, finalSessionId, user.userId);
    
    // Step 2: First run tools in preview mode to check for confirmation needs
    if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
      const executionContext: ToolExecutionContext = {
        sessionId: finalSessionId,
        userId: user.userId,
        timestamp: new Date()
      };
      
      logger.info('Starting preview mode execution', {
        toolCalls: masterResponse.toolCalls.map(tc => ({ name: tc.name, hasParams: !!tc.parameters })),
        sessionId: finalSessionId,
        userId: user.userId
      });
      
      // First, run in preview mode to see if confirmation is needed
      const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
      if (!toolExecutorService) {
        throw new Error('Tool executor service not available');
      }
        const previewResults = await toolExecutorService.executeTools(
          masterResponse.toolCalls,
          executionContext,
          accessToken as string | undefined,
          { preview: true } // Run in preview mode
        );
      
      logger.info('Preview mode execution completed', {
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
      
      logger.info('Confirmation check completed', {
        needsConfirmation,
        previewResults: previewResults.map(r => ({
          toolName: r.toolName,
          hasResult: !!r.result,
          resultType: typeof r.result,
          hasAwaitingConfirmation: r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result,
          awaitingConfirmationValue: r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result ? r.result.awaitingConfirmation : 'N/A'
        }))
      });
      
      if (needsConfirmation) {
        // Store pending actions in session context
        const pendingActions = extractPendingActions(previewResults);
        
        logger.info('Storing pending actions in session', {
          sessionId: finalSessionId,
          pendingActionsCount: pendingActions.length,
          pendingActionsData: pendingActions,
          previewResultsCount: previewResults.length,
          previewResultsAwaitingConfirmation: previewResults.filter(r => r.result?.awaitingConfirmation).length
        });
        
        // Note: Using stateless architecture with TokenStorageService now
        
        // Generate dynamic confirmation message
        const confirmationMessage = await generateDynamicConfirmationMessage(masterResponse.toolCalls, previewResults, commandString);
        const confirmationPrompt = await generateDynamicConfirmationPrompt(masterResponse.toolCalls, previewResults, commandString);
        
        // Return confirmation required response
        const confirmationResponse = ResponseBuilder.confirmationRequired(
          confirmationMessage,
          {
            sessionId: finalSessionId,
            toolResults: previewResults,
            pendingActions: pendingActions,
            confirmationPrompt: confirmationPrompt,
            conversationContext: buildConversationContext(commandString, masterResponse.message, mergedContext)
          },
          {
            sessionId: finalSessionId,
            userId: user.userId
          }
        );
        return res.json(confirmationResponse);
      } else {
        // No confirmation needed, execute tools normally
        const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
        if (!toolExecutorService) {
          throw new Error('Tool executor service not available');
        }
        const toolResults = await toolExecutorService.executeTools(
          masterResponse.toolCalls,
          executionContext,
          accessToken as string | undefined,
          { preview: false } // Execute normally
        );
        
        const executionStats = toolExecutorService.getExecutionStats(toolResults);
        const completionMessage = await generateDynamicCompletionMessage(toolResults, commandString);
        
        const actionResponse = ResponseBuilder.actionCompleted(
          completionMessage,
          {
            sessionId: finalSessionId,
            toolResults,
            executionStats,
            conversationContext: buildConversationContext(commandString, masterResponse.message, mergedContext)
          },
          {
            sessionId: finalSessionId,
            userId: user.userId
          }
        );
        return res.json(actionResponse);
      }
    } else {
      // No tools needed, just return the response
      return res.json({
        success: true,
        type: 'response',
        message: masterResponse.message,
        data: {
          response: masterResponse.message,
          sessionId: finalSessionId,
          conversationContext: buildConversationContext(command, masterResponse.message, mergedContext)
        }
      });
    }

  } catch (error) {
    logger.error('Assistant text command error:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred while processing your request',
      data: {
        sessionId: req.body.sessionId,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /assistant/confirm-action
 * Handle action confirmations
 */
router.post('/confirm-action',
  authenticateToken,
  sensitiveOperationRateLimit,
  validateRequest({ body: confirmActionSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { actionId, confirmed, sessionId, parameters } = req.validatedBody as z.infer<typeof confirmActionSchema>;
      const user = req.user!;

      logger.info('Processing action confirmation', {
        userId: user.userId,
        actionId,
        confirmed,
        sessionId
      });

      if (!confirmed) {
        const cancelMessage = await generateDynamicCancelMessage(actionId);
        
        return res.json({
          success: true,
          type: 'response',
          message: cancelMessage,
          data: {
            actionId,
            status: 'cancelled',
            sessionId
          }
        });
      }

      // Execute the confirmed action
      const result = await executeConfirmedAction(actionId, parameters || {}, user.userId, sessionId, req.body.accessToken);

      return res.json({
        success: result.success,
        type: result.success ? 'action_completed' : 'error',
        message: result.message,
        data: {
          actionId,
          status: result.success ? 'completed' : 'failed',
          result: result.data,
          sessionId
        }
      });

    } catch (error) {
      logger.error('Action confirmation error:', error);
      return res.status(500).json({
        success: false,
        type: 'error',
        error: 'CONFIRMATION_ERROR',
        message: 'Failed to process action confirmation'
      });
    }
  }
);


/**
 * POST /assistant/email/send
 * Direct email sending endpoint
 */
router.post('/email/send', 
  authenticateToken,
  validateRequest({ body: SendEmailRequestSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, subject, body, cc, bcc } = req.validatedBody as z.infer<typeof SendEmailRequestSchema>;
    const user = req.user!;
    
    // Validation is now handled by Zod schema

    // Get access token
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Google access token required',
        requiresAuth: true
      });
    }

    logger.info('Direct email send request', { 
      userId: user.userId,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject 
    });

    // Use email agent directly
    const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
    if (!toolExecutorService) {
      throw new Error('Tool executor service not available');
    }
    const result = await toolExecutorService.executeTool(
      {
        name: 'emailAgent',
        parameters: {
          query: `Send email to ${Array.isArray(to) ? to.join(', ') : to} with subject "${subject}" and body "${body}"`,
          to,
          subject,
          body,
          cc,
          bcc
        }
      },
      {
        sessionId: `direct-${user.userId}-${Date.now()}`,
        userId: user.userId,
        timestamp: new Date()
      },
      accessToken
    );

    return res.json({
      success: result.success,
      message: result.result?.message || 'Email operation completed',
      data: result.result?.data,
      error: result.error,
      executionTime: result.executionTime
    });

  } catch (error) {
    logger.error('Direct email send error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email'
    });
  }
});

/**
 * GET /assistant/email/search
 * Search emails
 */
router.get('/email/search', 
  authenticateToken,
  validateRequest({ query: SearchEmailRequestSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, maxResults, includeSpamTrash, labelIds } = req.validatedQuery as z.infer<typeof SearchEmailRequestSchema>;
    const user = req.user!;
    
    // Validation is now handled by Zod schema
    const limit = Math.min(
      maxResults || REQUEST_LIMITS.emailSearch.defaultMaxResults, 
      REQUEST_LIMITS.emailSearch.maxResults
    );

    // Get access token
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Google access token required',
        requiresAuth: true
      });
    }

    logger.info('Email search request', { 
      userId: user.userId,
      query: query.substring(0, 100),
      maxResults: limit 
    });

    const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
    if (!toolExecutorService) {
      throw new Error('Tool executor service not available');
    }
    const result = await toolExecutorService.executeTool(
      {
        name: 'emailAgent',
        parameters: {
          query: `Search for emails: ${query}`,
          maxResults: limit
        }
      },
      {
        sessionId: `search-${user.userId}-${Date.now()}`,
        userId: user.userId,
        timestamp: new Date()
      },
      accessToken
    );

    return res.json({
      success: result.success,
      message: result.result?.message || 'Search completed',
      data: result.result?.data,
      error: result.error,
      executionTime: result.executionTime
    });

  } catch (error) {
    logger.error('Email search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search emails'
    });
  }
});

/**
 * GET /assistant/status
 * Get assistant service status
 */
router.get('/status', 
  authenticateToken, 
  validateRequest({ query: z.object({}) }),
  (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    status: 'operational',
    services: {
      masterAgent: 'ready',
      toolExecutor: 'ready',
      emailAgent: 'ready'
    },
    timestamp: new Date().toISOString()
  });
});

// Helper functions for text-command endpoint

/**
 * Check if command is a confirmation response using AI classification
 */
const isConfirmationResponse = async (command: string): Promise<boolean> => {
  try {
    const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
    if (!aiClassificationService) {
      throw new Error('AI Classification Service is not available. AI confirmation detection is required for this operation.');
    }
    const classification = await aiClassificationService.classifyConfirmationResponse(command);
    return classification === 'confirm' || classification === 'reject';
  } catch (error) {
    logger.error('Failed to classify confirmation response:', error);
    return false;
  }
}

/**
 * Handle action confirmation from natural language
 */
const handleActionConfirmation = async (
  req: AuthenticatedRequest,
  res: Response,
  pendingAction: PendingAction,
  command: string,
  sessionId: string
): Promise<Response> => {
  try {
    const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
    if (!aiClassificationService) {
      throw new Error('AI Classification Service is not available. AI action confirmation is required for this operation.');
    }
    const classification = await aiClassificationService.classifyConfirmationResponse(command);
    const confirmed = classification === 'confirm';

    if (!confirmed) {
    return res.json({
      success: true,
      type: 'response',
      message: 'Action cancelled.',
      data: {
        actionId: pendingAction.actionId,
        status: 'cancelled',
        sessionId
      }
    });
  }

  // Execute the confirmed action
  const result = await executeConfirmedAction(
    pendingAction.actionId,
    pendingAction.parameters,
    req.user!.userId,
    sessionId,
    req.body.accessToken
  );

  return res.json({
    success: result.success,
    type: result.success ? 'action_completed' : 'error',
    message: result.message,
    data: {
      actionId: pendingAction.actionId,
      status: result.success ? 'completed' : 'failed',
      result: result.data,
      sessionId
    }
  });
  } catch (error) {
    logger.error('Failed to handle action confirmation:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Failed to process confirmation',
      data: { sessionId }
    });
  }
}

/**
 * Check if tool calls require user confirmation
 */
const checkForConfirmationRequirements = async (toolCalls: ToolCall[], command: string): Promise<{
  message: string;
  prompt: string;
  action: ToolCall;
} | null> => {
  // Check for potentially destructive or sensitive operations using AI
  const sensitiveOperations = [];
  for (const tc of toolCalls) {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (aiClassificationService) {
        const requiresConfirmation = await aiClassificationService.operationRequiresConfirmation(
          tc.parameters.query as string, 
          tc.name
        );
        if (requiresConfirmation) {
          sensitiveOperations.push(tc);
        }
      }
    } catch (error) {
      logger.warn('Failed to check operation sensitivity with AI:', error);
      // Continue without AI detection
    }
  }

  if (sensitiveOperations.length > 0) {
    const operation = sensitiveOperations[0];
    const actionId = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use AI-powered confirmation message generation instead of hardcoded messages
    try {
      const { ToolRoutingService } = await import('../services/tool-routing.service');
      const toolRoutingService = getService<ToolRoutingService>('toolRoutingService');
      
      if (toolRoutingService) {
        const userQuery = (operation?.parameters?.query as string) || `Execute ${operation?.name} operation`;
        const confirmationMessage = await toolRoutingService.generateConfirmationMessage(
          operation?.name || 'unknown',
          userQuery,
          operation?.parameters
        );
        
        return {
          message: confirmationMessage.message,
          prompt: confirmationMessage.prompt,
          action: {
            name: operation?.name || 'unknown',
            parameters: operation?.parameters || {},
            ...(operation as any) // Include any additional properties
          }
        };
      }
    } catch (error) {
      logger.warn('AI confirmation generation failed, using fallback', { error });
      // Throw error instead of using hardcoded fallbacks
      throw new Error(`AI confirmation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return null;
}

/**
 * Execute a confirmed action
 */
const executeConfirmedAction = async (
  actionId: string,
  parameters: Record<string, unknown>,
  userId: string,
  sessionId?: string,
  accessToken?: string
): Promise<{ success: boolean; message: string; data?: unknown }> => {
  try {
    logger.info('Executing confirmed action', { actionId, userId, sessionId });
    
    // Extract action details from parameters
    const actionType = parameters?.type || 'unknown';
    const query = parameters?.query || parameters?.originalQuery;
    
    if (!query) {
      return {
        success: false,
        message: 'Cannot execute action: missing query information',
        data: { actionId }
      };
    }

    // Create execution context
    const executionContext: ToolExecutionContext = {
      sessionId: sessionId || `session-${userId}-${Date.now()}`,
      userId,
      timestamp: new Date()
    };

    // Use AI-powered tool selection instead of hardcoded action type mapping
    let toolCall: ToolCall;
    try {
      const { ToolRoutingService } = await import('../services/tool-routing.service');
      const toolRoutingService = getService<ToolRoutingService>('toolRoutingService');
      
      if (toolRoutingService) {
        const routingDecision = await toolRoutingService.selectAgentForTask(query as string, executionContext);
        toolCall = routingDecision.toolCall;
        
        logger.info('AI tool routing completed', {
          selectedAgent: routingDecision.selectedAgent,
          confidence: routingDecision.confidence,
          reasoning: routingDecision.reasoning.substring(0, 100)
        });
      } else {
        throw new Error('ToolRoutingService not available');
      }
    } catch (error) {
      logger.warn('AI tool routing failed, using fallback mapping', { error });
      
      // Fallback to simple action type mapping
      const actionTypeMapping: Record<string, string> = {
        'email': 'emailAgent',
        'calendar': 'calendarAgent',
        'contact': 'contactAgent',
        'slack': 'slackAgent'
      };
      
      const agentName = actionTypeMapping[actionType as string];
      if (!agentName) {
        return {
          success: false,
          message: `Unknown action type: ${actionType}`,
          data: { actionId, actionType }
        };
      }
      
      toolCall = {
        name: agentName,
        parameters: { query }
      };
    }

    // Execute the tool normally (not in preview mode)
    const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
    if (!toolExecutorService) {
      throw new Error('Tool executor service not available');
    }
    const toolResult = await toolExecutorService.executeTool(
      toolCall,
      executionContext,
      accessToken,
      { preview: false }
    );

    if (toolResult.success) {
      return {
        success: true,
        message: toolResult.result?.message || 'Action completed successfully',
        data: { 
          actionId, 
          result: toolResult.result,
          executionTime: toolResult.executionTime
        }
      };
    } else {
      return {
        success: false,
        message: toolResult.error || 'Action execution failed',
        data: { actionId, error: toolResult.error }
      };
    }
  } catch (error) {
    logger.error('Failed to execute confirmed action:', error);
    return {
      success: false,
      message: 'Failed to execute action',
      data: { actionId, error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Format assistant response based on results and user preferences
 */
const formatAssistantResponse = async (
  masterResponse: ToolResult,
  toolResults: ToolResult[],
  originalCommand: string,
  verbosity: 'minimal' | 'normal' | 'detailed'
): Promise<{
  formattedResponse: { message: string; data?: unknown };
  responseType: 'response' | 'action_completed' | 'partial_success' | 'error';
}> => {
  const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
  if (!toolExecutorService) {
    throw new Error('Tool executor service not available');
  }
  const stats = toolExecutorService.getExecutionStats(toolResults);
  const hasErrors = toolResults.some(result => !result.success);
  const successfulResults = toolResults.filter(r => r.success && r.toolName !== 'Think');
  
  let message = (masterResponse as any).message || 'Operation completed';
  let responseType: 'response' | 'action_completed' | 'partial_success' | 'error' = 'response';
  let responseData: Record<string, unknown> = {};

  if (stats.successful > 0) {
    responseType = hasErrors ? 'partial_success' : 'action_completed';
    
    // Extract meaningful results
    if (successfulResults.length > 0) {
      const actionMessages = successfulResults
        .map(r => r.result?.message)
        .filter(Boolean);
      
      if (actionMessages.length > 0) {
        message = actionMessages.join(' ');
      }

      // Include result data for detailed responses
      if (verbosity === 'detailed') {
        responseData.results = successfulResults.map(r => ({
          tool: r.toolName,
          message: r.result?.message,
          data: r.result?.data,
          executionTime: r.executionTime
        }));
      }
    }
  }

  if (hasErrors) {
    const errorMessages = toolResults
      .filter(r => !r.success && r.error)
      .map(r => `${r.toolName}: ${r.error}`)
      .join(', ');
    
    if (stats.successful === 0) {
      message = `I encountered some issues: ${errorMessages}`;
      responseType = 'error';
    } else {
      if (verbosity !== 'minimal') {
        message += ` (Note: Some operations had issues: ${errorMessages})`;
      }
    }

    if (verbosity === 'detailed') {
      responseData.errors = toolResults
        .filter(r => !r.success)
        .map(r => ({
          tool: r.toolName,
          error: r.error,
          executionTime: r.executionTime
        }));
    }
  }

  return {
    formattedResponse: { message, data: responseData },
    responseType
  };
}

/**
 * Build conversation context for client state management
 */
const buildConversationContext = (
  userCommand: string,
  assistantResponse: string,
  existingContext?: Record<string, unknown>
): Record<string, unknown> => {
  const newEntry = {
    role: 'user' as const,
    content: userCommand,
    timestamp: new Date().toISOString()
  };

  const responseEntry = {
    role: 'assistant' as const,
    content: assistantResponse,
    timestamp: new Date().toISOString()
  };

  const history = existingContext?.conversationHistory || [];
  
  return {
    conversationHistory: [
      ...(history as any[]).slice(-10), // Keep last 10 entries
      newEntry,
      responseEntry
    ],
    lastActivity: new Date().toISOString()
  };
}

// Helper functions
const extractPendingActions = (toolResults: ToolResult[]): PendingAction[] => {
  return toolResults
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
}

const generateDynamicConfirmationMessage = async (toolCalls: ToolCall[], toolResults: ToolResult[], userCommand: string): Promise<string> => {
  try {
    const openaiService = masterAgent?.getOpenAIService();
    if (openaiService) {
      const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent');
      
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant. Generate a natural confirmation message asking the user if they want to proceed with an action. Keep it concise and friendly. Do not use quotes.'
        },
        {
          role: 'user' as const,
          content: `User command: "${userCommand}"\nAction to confirm: ${mainAction?.name || 'unknown'} with query "${mainAction?.parameters?.query || ''}"\n\nGenerate a natural confirmation message.`
        }
      ];
      
      const response = await openaiService.createChatCompletion(messages, 100);
      return response.content.trim().replace(/^"|"$/g, '');
    }
  } catch (error) {
    logger.error('Failed to generate dynamic confirmation message', { error });
  }
  
  // Fallback
  return 'I need your confirmation before proceeding with this action.';
}

const generateDynamicConfirmationPrompt = async (toolCalls: ToolCall[], toolResults: ToolResult[], userCommand: string): Promise<string> => {
  try {
    const toolRoutingService = getService<ToolRoutingService>('toolRoutingService');
    const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent' || tc.name === 'contactAgent');
    
    if (toolRoutingService && mainAction) {
      const confirmationResult = await toolRoutingService.generateConfirmationMessage(
        mainAction.name,
        userCommand,
        mainAction.parameters || {}
      );
      return confirmationResult.prompt;
    } else {
      return generateFallbackDynamicConfirmationPrompt(toolCalls, toolResults, userCommand);
    }
  } catch (error) {
    logger.error('Failed to generate dynamic confirmation prompt with AI routing service', { error });
    return generateFallbackDynamicConfirmationPrompt(toolCalls, toolResults, userCommand);
  }
};

const generateFallbackDynamicConfirmationPrompt = async (toolCalls: ToolCall[], toolResults: ToolResult[], userCommand: string): Promise<string> => {
  try {
    const openaiService = masterAgent?.getOpenAIService();
    if (openaiService) {
      const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent');
      
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant. Generate a brief instruction for the user on how to confirm or cancel an action. Keep it concise. Do not use quotes.'
        },
        {
          role: 'user' as const,
          content: `User wants to ${mainAction?.name === 'emailAgent' ? 'send an email' : mainAction?.name === 'calendarAgent' ? 'create a calendar event' : 'perform an action'}. Generate a brief instruction on how to confirm or cancel.`
        }
      ];
      
      const response = await openaiService.createChatCompletion(messages, 50);
      return response.content.trim().replace(/^"|"$/g, '');
    }
  } catch (error) {
    logger.error('Failed to generate dynamic confirmation prompt', { error });
    // Throw error instead of using hardcoded fallback messages
    throw new Error(`Failed to generate confirmation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // This should never be reached due to the throw above, but TypeScript needs it
  throw new Error('OpenAI service not available for confirmation generation');
}

const generateConfirmationPrompt = async (toolCalls: ToolCall[], toolResults: ToolResult[]): Promise<string> => {
  try {
    const toolRoutingService = getService<ToolRoutingService>('toolRoutingService');
    const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent' || tc.name === 'contactAgent');
    
    if (!mainAction) {
      throw new Error('No valid action found for confirmation');
    }

    if (toolRoutingService) {
      const confirmationResult = await toolRoutingService.generateConfirmationMessage(
        mainAction.name,
        `Execute ${mainAction.name} with provided parameters`,
        mainAction.parameters || {}
      );
      return confirmationResult.message;
    } else {
      throw new Error('Tool routing service not available for confirmation generation');
    }
  } catch (error) {
    logger.warn('Failed to generate AI confirmation prompt:', error);
    throw new Error(`Failed to generate confirmation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Removed generateFallbackConfirmationPrompt - no longer using hardcoded fallbacks

const generateDynamicCompletionMessage = async (toolResults: ToolResult[], userCommand: string): Promise<string> => {
  try {
    const openaiService = masterAgent?.getOpenAIService();
    if (openaiService) {
      const successfulResults = toolResults.filter(r => r.success && r.toolName !== 'Think');
      const failedResults = toolResults.filter(r => !r.success);
      
      const toolSummary = successfulResults.map(r => `${r.toolName}: ${r.result?.message || 'completed'}`).join(', ');
      
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant. Generate a natural completion message summarizing what was accomplished. Keep it concise and positive. Do not use quotes.'
        },
        {
          role: 'user' as const,
          content: `User command: "${userCommand}"\nCompleted actions: ${toolSummary}\nFailed actions: ${failedResults.length}\n\nGenerate a natural completion message.`
        }
      ];
      
      const response = await openaiService.createChatCompletion(messages, 100);
      return response.content.trim().replace(/^"|"$/g, '');
    }
  } catch (error) {
    logger.error('Failed to generate dynamic completion message', { error });
  }
  
  // Fallback to original logic
  return generateCompletionMessage(toolResults);
}

const generateDynamicCancelMessage = async (actionId: string): Promise<string> => {
  try {
    const openaiService = masterAgent?.getOpenAIService();
    if (openaiService) {
      
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant. Generate a brief, natural message confirming an action was cancelled. Keep it concise and reassuring. Do not use quotes.'
        },
        {
          role: 'user' as const,
          content: 'Generate a message confirming that an action was cancelled by the user.'
        }
      ];
      
      const response = await openaiService.createChatCompletion(messages, 50);
      return response.content.trim().replace(/^"|"$/g, '');
    }
  } catch (error) {
    logger.error('Failed to generate dynamic cancel message', { error });
  }
  
  // Fallback
  return 'Action cancelled.';
}

const generateCompletionMessage = (toolResults: ToolResult[]): string => {
  const successfulResults = toolResults.filter(r => r.success);
  const failedResults = toolResults.filter(r => !r.success);
  
  if (failedResults.length === 0) {
    // All successful
    const emailResults = successfulResults.filter(r => r.toolName === 'emailAgent');
    const calendarResults = successfulResults.filter(r => r.toolName === 'calendarAgent');
    const contactResults = successfulResults.filter(r => r.toolName === 'contactAgent');
    
    if (emailResults.length > 0) {
      return 'Email operation completed successfully!';
    } else if (calendarResults.length > 0) {
      return 'Calendar event created successfully!';
    } else if (contactResults.length > 0) {
      return 'Contact lookup completed successfully!';
    } else {
      return 'Task completed successfully!';
    }
  } else {
    // Some failures
    return `Task completed with ${successfulResults.length} successful and ${failedResults.length} failed operations.`;
  }
}

export default router;