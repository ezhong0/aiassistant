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
} from '../types/api-response.types';
import { validate, sanitizeString } from '../middleware/validation.middleware';
import { userRateLimit, sensitiveOperationRateLimit } from '../middleware/rate-limiting.middleware';
import { CONFIRMATION_WORDS } from '../config/agent-config';
import { REQUEST_LIMITS, RATE_LIMITS } from '../config/app-config';
import { assistantApiLogging } from '../middleware/api-logging.middleware';
import { MasterAgent } from '../agents/master.agent';
import { getService } from '../services/service-manager';
import { ToolExecutorService } from '../services/tool-executor.service';
import { TokenStorageService } from '../services/token-storage.service';
import { ToolExecutionContext } from '../types/tools';
import { 
  TextCommandRequest, 
  TextCommandResponse, 
  ConfirmActionRequest, 
  ConfirmActionResponse,
  SessionDataResponse,
  SessionDeleteResponse,
  EmailSendRequest,
  EmailOperationResponse
} from '../types/api.types';
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

// Remove manual session service creation - use service registry instead
// const sessionService = new SessionService();

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
  validate({ body: textCommandSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { command, sessionId, accessToken, context } = req.validatedBody as z.infer<typeof textCommandSchema>;
    const user = req.user!;

    const finalSessionId = sessionId || `session-${user.userId}-${Date.now()}`;
    
              // Note: Session management removed - tokens are now stored per user
    // For now, we'll work with client-provided context only
    const sessionContext = null;
    
    logger.info('Using client context only (session management removed)', {
      sessionId: finalSessionId,
      clientPendingActions: context?.pendingActions?.length || 0,
      clientPendingActionsData: context?.pendingActions
    });
    
    // Use client context directly (no session merging)
    const mergedContext = context || {};
    
    logger.info('Processing assistant text command', { 
      userId: user.userId, 
      command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
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
      isConfirmationResponse: isConfirmationResponse(command),
      command: command
    });
    
    if (mergedContext?.pendingActions && mergedContext.pendingActions.length > 0) {
      const pendingAction = mergedContext.pendingActions.find(action => action.awaitingConfirmation);
      logger.info('Found pending action for confirmation', { pendingAction, command });
      
      if (pendingAction && isConfirmationResponse(command)) {
        logger.info('Processing confirmation response', { actionId: pendingAction.actionId });
        return await handleActionConfirmation(req, res, pendingAction, command, finalSessionId);
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
    const masterResponse = await masterAgent.processUserInput(command, finalSessionId, user.userId);
    
    // Step 2: First run tools in preview mode to check for confirmation needs
    if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
      const executionContext: ToolExecutionContext = {
        sessionId: finalSessionId,
        userId: user.userId,
        timestamp: new Date()
      };
      
      // First, run in preview mode to see if confirmation is needed
      const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
      if (!toolExecutorService) {
        throw new Error('Tool executor service not available');
      }
      const previewResults = await toolExecutorService.executeTools(
        masterResponse.toolCalls,
        executionContext,
        accessToken,
        { preview: true } // Run in preview mode
      );
      
      // Check if any tools require confirmation
      const needsConfirmation = previewResults.some(result => 
        result.result && typeof result.result === 'object' && 
        'awaitingConfirmation' in result.result
      );
      
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
        
        // Note: SessionService doesn't have updateSession method
        // The session is automatically updated when adding conversation entries or tool calls
        
        // Generate dynamic confirmation message
        const confirmationMessage = await generateDynamicConfirmationMessage(masterResponse.toolCalls, previewResults, command);
        const confirmationPrompt = await generateDynamicConfirmationPrompt(masterResponse.toolCalls, previewResults, command);
        
        // Return confirmation required response
        const confirmationResponse = ResponseBuilder.confirmationRequired(
          confirmationMessage,
          {
            sessionId: finalSessionId,
            toolResults: previewResults,
            pendingActions: pendingActions,
            confirmationPrompt: confirmationPrompt,
            conversationContext: buildConversationContext(command, masterResponse.message, mergedContext)
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
          accessToken,
          { preview: false } // Execute normally
        );
        
        const executionStats = toolExecutorService.getExecutionStats(toolResults);
        const completionMessage = await generateDynamicCompletionMessage(toolResults, command);
        
        const actionResponse = ResponseBuilder.actionCompleted(
          completionMessage,
          {
            sessionId: finalSessionId,
            toolResults,
            executionStats,
            conversationContext: buildConversationContext(command, masterResponse.message, mergedContext)
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
  validate({ body: confirmActionSchema }),
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
      const result = await executeConfirmedAction(actionId, parameters, user.userId, sessionId, req.body.accessToken);

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
 * GET /assistant/session/:id
 * Retrieve session information and conversation history
 */
router.get('/session/:id',
  authenticateToken,
  userRateLimit(
    RATE_LIMITS.assistant.session.maxRequests, 
    RATE_LIMITS.assistant.session.windowMs
  ),
  validate({ params: sessionIdSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: sessionId } = req.validatedParams as z.infer<typeof sessionIdSchema>;
      const user = req.user!;

      logger.info('Retrieving session', { 
        sessionId, 
        userId: user.userId 
      });

              try {
          // Session functionality removed - return not found
          const session = null;
        
        // Sessions no longer exist - return not found
        return res.status(404).json({
          success: false,
          type: 'error',
          error: 'SESSION_NOT_FOUND',
          message: 'Sessions are no longer supported. Use stateless requests instead.'
        });

      } catch (error) {
        // Session expired error handling removed
        throw error;
      }

    } catch (error) {
      logger.error('Session retrieval error:', error);
      return res.status(500).json({
        success: false,
        type: 'error',
        error: 'SESSION_RETRIEVAL_ERROR',
        message: 'Failed to retrieve session information'
      });
    }
  }
);

/**
 * DELETE /assistant/session/:id
 * Delete a session and clear its conversation history
 */
router.delete('/session/:id',
  authenticateToken,
  userRateLimit(
    RATE_LIMITS.assistant.sessionDelete.maxRequests, 
    RATE_LIMITS.assistant.sessionDelete.windowMs
  ),
  validate({ params: sessionIdSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: sessionId } = req.validatedParams as z.infer<typeof sessionIdSchema>;
      const user = req.user!;

      logger.info('Deleting session', { 
        sessionId, 
        userId: user.userId 
      });

              // Session functionality removed
        // Sessions no longer exist - return not found
        return res.status(404).json({
          success: false,
          type: 'error',
          error: 'SESSION_NOT_FOUND',
          message: 'Sessions are no longer supported. Use stateless requests instead.'
        });

    } catch (error) {
      logger.error('Session deletion error:', error);
      return res.status(500).json({
        success: false,
        type: 'error',
        error: 'SESSION_DELETION_ERROR',
        message: 'Failed to delete session'
      });
    }
  }
);

/**
 * POST /assistant/email/send
 * Direct email sending endpoint
 */
router.post('/email/send', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, subject, body, cc, bcc } = req.body;
    const user = req.user!;
    
    if (!to || !body) {
      return res.status(400).json({
        success: false,
        error: 'Recipient (to) and body are required'
      });
    }

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
router.get('/email/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, maxResults } = req.query;
    const user = req.user!;
    
    const query = (q as string) || '';
    const limit = Math.min(
      parseInt(maxResults as string) || REQUEST_LIMITS.emailSearch.defaultMaxResults, 
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
router.get('/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
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
 * Check if command is a confirmation response (yes/no/confirm/cancel)
 */
const isConfirmationResponse = (command: string): boolean => {
  const lowerCommand = command.toLowerCase().trim();
  return CONFIRMATION_WORDS.confirm.includes(lowerCommand as any) || 
         CONFIRMATION_WORDS.reject.includes(lowerCommand as any);
}

/**
 * Handle action confirmation from natural language
 */
const handleActionConfirmation = async (
  req: AuthenticatedRequest,
  res: Response,
  pendingAction: any,
  command: string,
  sessionId: string
): Promise<Response> => {
  const lowerCommand = command.toLowerCase().trim();
  const confirmed = CONFIRMATION_WORDS.confirm.includes(lowerCommand as any);

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
}

/**
 * Check if tool calls require user confirmation
 */
const checkForConfirmationRequirements = async (toolCalls: any[], command: string): Promise<{
  message: string;
  prompt: string;
  action: any;
} | null> => {
  // Check for potentially destructive or sensitive operations
  const sensitiveOperations = toolCalls.filter(tc => {
    if (tc.name === 'emailAgent') {
      const query = tc.parameters.query.toLowerCase();
      return query.includes('send') || query.includes('reply') || query.includes('forward');
    }
    if (tc.name === 'calendarAgent') {
      const query = tc.parameters.query.toLowerCase();
      return query.includes('schedule') || query.includes('create') || query.includes('delete');
    }
    return false;
  });

  if (sensitiveOperations.length > 0) {
    const operation = sensitiveOperations[0];
    const actionId = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let message = '';
    let prompt = '';
    
    if (operation.name === 'emailAgent') {
      message = 'I\'m about to send an email. Would you like me to proceed?';
      prompt = 'Reply with "yes" to send the email or "no" to cancel.';
    } else if (operation.name === 'calendarAgent') {
      message = 'I\'m about to create a calendar event. Would you like me to proceed?';
      prompt = 'Reply with "yes" to create the event or "no" to cancel.';
    }

    return {
      message,
      prompt,
      action: {
        actionId,
        type: operation.name,
        parameters: operation.parameters,
        awaitingConfirmation: true
      }
    };
  }

  return null;
}

/**
 * Execute a confirmed action
 */
const executeConfirmedAction = async (
  actionId: string,
  parameters: any,
  userId: string,
  sessionId?: string,
  accessToken?: string
): Promise<{ success: boolean; message: string; data?: any }> => {
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

    // Create tool call based on action type
    let toolCall: any;
    if (actionType === 'email') {
      toolCall = {
        name: 'emailAgent',
        parameters: { query }
      };
    } else if (actionType === 'calendar') {
      toolCall = {
        name: 'calendarAgent', 
        parameters: { query }
      };
    } else {
      return {
        success: false,
        message: `Unknown action type: ${actionType}`,
        data: { actionId, actionType }
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
  masterResponse: any,
  toolResults: any[],
  originalCommand: string,
  verbosity: 'minimal' | 'normal' | 'detailed'
): Promise<{
  formattedResponse: { message: string; data?: any };
  responseType: 'response' | 'action_completed' | 'partial_success' | 'error';
}> => {
  const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
  if (!toolExecutorService) {
    throw new Error('Tool executor service not available');
  }
  const stats = toolExecutorService.getExecutionStats(toolResults);
  const hasErrors = toolResults.some(result => !result.success);
  const successfulResults = toolResults.filter(r => r.success && r.toolName !== 'Think');
  
  let message = masterResponse.message;
  let responseType: 'response' | 'action_completed' | 'partial_success' | 'error' = 'response';
  let responseData: any = {};

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
  existingContext?: any
): any => {
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
      ...history.slice(-10), // Keep last 10 entries
      newEntry,
      responseEntry
    ],
    lastActivity: new Date().toISOString()
  };
}

// Helper functions
const extractPendingActions = (toolResults: any[]): any[] => {
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

const generateDynamicConfirmationMessage = async (toolCalls: any[], toolResults: any[], userCommand: string): Promise<string> => {
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

const generateDynamicConfirmationPrompt = async (toolCalls: any[], toolResults: any[], userCommand: string): Promise<string> => {
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
  }
  
  // Fallback
  const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent');
  if (mainAction?.name === 'emailAgent') {
    return 'Reply with "yes" to send the email or "no" to cancel.';
  } else if (mainAction?.name === 'calendarAgent') {
    return 'Reply with "yes" to create the event or "no" to cancel.';
  }
  return 'Reply with "yes" to proceed or "no" to cancel.';
}

const generateConfirmationPrompt = (toolCalls: any[], toolResults: any[]): string => {
  const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent');
  if (!mainAction) {
    return 'Would you like me to proceed with this action?';
  }
  
  if (mainAction.name === 'emailAgent') {
    return 'I\'m about to send an email. Would you like me to proceed?';
  } else if (mainAction.name === 'calendarAgent') {
    return 'I\'m about to create a calendar event. Would you like me to proceed?';
  }
  
  return 'Would you like me to proceed with this action?';
}

const generateDynamicCompletionMessage = async (toolResults: any[], userCommand: string): Promise<string> => {
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

const generateCompletionMessage = (toolResults: any[]): string => {
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