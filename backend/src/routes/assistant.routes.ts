import express, { Response } from 'express';
import { z } from 'zod';
import { 
  authenticateToken,
  AuthenticatedRequest 
} from '../middleware/auth.middleware';
import { validate, sanitizeString } from '../middleware/validation.middleware';
import { userRateLimit, sensitiveOperationRateLimit } from '../middleware/rate-limiting.middleware';
import { assistantApiLogging } from '../middleware/api-logging.middleware';
import { MasterAgent } from '../agents/master.agent';
import { toolExecutorService } from '../services/tool-executor.service';
import { SessionService } from '../services/session.service';
import { ToolExecutionContext, SessionExpiredError } from '../types/tools';
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

// Initialize services
let masterAgent: MasterAgent | null = null;

// Initialize MasterAgent with OpenAI if available
try {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    masterAgent = new MasterAgent({
      openaiApiKey,
      model: 'gpt-4o-mini'
    });
    logger.info('MasterAgent initialized with OpenAI integration');
  } else {
    masterAgent = new MasterAgent();
    logger.info('MasterAgent initialized with rule-based routing only');
  }
} catch (error) {
  logger.error('Failed to initialize MasterAgent:', error);
  logger.warn('Assistant will operate in fallback mode');
}

const sessionService = new SessionService();

// Validation schemas
const textCommandSchema = z.object({
  command: z.string()
    .min(1, 'Command is required')
    .max(5000, 'Command too long')
    .transform(val => sanitizeString(val, 5000)),
  sessionId: z.string()
    .optional()
    .transform(val => val ? sanitizeString(val, 100) : undefined),
  accessToken: z.string()
    .optional()
    .transform(val => val ? sanitizeString(val, 2000) : undefined),
  context: z.object({
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(10000),
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
  userRateLimit(50, 15 * 60 * 1000), // 50 requests per 15 minutes per user
  validate({ body: textCommandSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { command, sessionId, accessToken, context } = req.validatedBody as z.infer<typeof textCommandSchema>;
    const user = req.user!;

    const finalSessionId = sessionId || `session-${user.userId}-${Date.now()}`;
    
    logger.info('Processing assistant text command', { 
      userId: user.userId, 
      command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
      sessionId: finalSessionId,
      hasContext: !!context,
      hasAccessToken: !!accessToken,
      pendingActions: context?.pendingActions?.length || 0
    });

    // Handle pending actions if present
    if (context?.pendingActions && context.pendingActions.length > 0) {
      const pendingAction = context.pendingActions.find(action => action.awaitingConfirmation);
      if (pendingAction && isConfirmationResponse(command)) {
        return await handleActionConfirmation(req, res, pendingAction, command, finalSessionId);
      }
    }

    // Step 1: Process command with MasterAgent
    if (!masterAgent) {
      return res.status(503).json({
        success: false,
        type: 'error',
        message: 'Assistant is currently unavailable. Please try again later.',
        error: 'MASTER_AGENT_UNAVAILABLE'
      });
    }

    // Get Master Agent response (determines which tools to call)
    const masterResponse = await masterAgent.processUserInput(command, finalSessionId, user.userId);
    
    // Step 2: Execute tools if needed
    if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
      const executionContext: ToolExecutionContext = {
        sessionId: finalSessionId,
        userId: user.userId,
        timestamp: new Date()
      };
      
      // Execute the tools
      const toolResults = await toolExecutorService.executeTools(
        masterResponse.toolCalls,
        executionContext,
        accessToken // Pass user's Google access token for Gmail/Calendar operations
      );
      
      // Check if any tools require confirmation
      const needsConfirmation = toolResults.some(result => 
        result.result && typeof result.result === 'object' && 
        'awaitingConfirmation' in result.result
      );
      
      if (needsConfirmation) {
        // Return confirmation required response
        return res.json({
          success: true,
          type: 'confirmation_required',
          message: 'I need your confirmation before proceeding with this action.',
          data: {
            sessionId: finalSessionId,
            toolResults,
            pendingActions: extractPendingActions(toolResults),
            confirmationPrompt: generateConfirmationPrompt(masterResponse.toolCalls, toolResults),
            conversationContext: buildConversationContext(command, masterResponse.message, context)
          }
        });
      } else {
        // Return action completed response
        const executionStats = toolExecutorService.getExecutionStats(toolResults);
        return res.json({
          success: true,
          type: 'action_completed', 
          message: generateCompletionMessage(toolResults),
          data: {
            sessionId: finalSessionId,
            toolResults,
            executionStats,
            conversationContext: buildConversationContext(command, masterResponse.message, context)
          }
        });
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
          conversationContext: buildConversationContext(command, masterResponse.message, context)
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
        return res.json({
          success: true,
          type: 'response',
          message: 'Action cancelled.',
          data: {
            actionId,
            status: 'cancelled',
            sessionId
          }
        });
      }

      // Execute the confirmed action
      const result = await executeConfirmedAction(actionId, parameters, user.userId, sessionId);

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
  userRateLimit(20, 15 * 60 * 1000), // 20 requests per 15 minutes per user
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
        const session = sessionService.getSession(sessionId);
        
        if (!session) {
          return res.status(404).json({
            success: false,
            type: 'error',
            error: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          });
        }

        // Security check: Ensure user owns this session or is admin
        if (session.userId && session.userId !== user.userId) {
          logger.warn('Unauthorized session access attempt', {
            sessionId,
            requestingUser: user.userId,
            sessionOwner: session.userId
          });

          return res.status(403).json({
            success: false,
            type: 'error',
            error: 'SESSION_ACCESS_DENIED',
            message: 'Access denied to this session'
          });
        }

        // Get session statistics
        const stats = sessionService.getSessionStats(sessionId);

        // Format conversation history for client
        const formattedHistory = session.conversationHistory.map(entry => ({
          timestamp: entry.timestamp.toISOString(),
          userInput: entry.userInput,
          agentResponse: entry.agentResponse,
          toolsUsed: entry.toolCalls.map(tc => tc.name),
          success: entry.toolResults.every(tr => tr.success)
        }));

        // Format recent tool results
        const recentToolResults = session.toolExecutionHistory.slice(-10).map(result => ({
          toolName: result.toolName,
          success: result.success,
          timestamp: new Date().toISOString(), // Note: ToolResult doesn't have timestamp in current schema
          executionTime: result.executionTime,
          error: result.error
        }));

        logger.info('Session retrieved successfully', { 
          sessionId, 
          conversationCount: session.conversationHistory.length,
          toolExecutionCount: session.toolExecutionHistory.length
        });

        return res.json({
          success: true,
          type: 'session_data',
          message: 'Session retrieved successfully',
          data: {
            session: {
              sessionId: session.sessionId,
              userId: session.userId,
              createdAt: session.createdAt.toISOString(),
              lastActivity: session.lastActivity.toISOString(),
              expiresAt: session.expiresAt.toISOString(),
              isActive: new Date() < session.expiresAt
            },
            conversationHistory: formattedHistory,
            recentToolResults,
            statistics: stats
          }
        });

      } catch (error) {
        if (error instanceof SessionExpiredError) {
          return res.status(410).json({
            success: false,
            type: 'error',
            error: 'SESSION_EXPIRED',
            message: 'Session has expired'
          });
        }
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
  userRateLimit(10, 15 * 60 * 1000), // 10 deletions per 15 minutes per user
  validate({ params: sessionIdSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: sessionId } = req.validatedParams as z.infer<typeof sessionIdSchema>;
      const user = req.user!;

      logger.info('Deleting session', { 
        sessionId, 
        userId: user.userId 
      });

      // First check if session exists and get it for authorization
      let session;
      try {
        session = sessionService.getSession(sessionId);
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          // Session already expired and cleaned up
          return res.json({
            success: true,
            type: 'response',
            message: 'Session already expired and removed'
          });
        }
        throw error;
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          type: 'error',
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        });
      }

      // Security check: Ensure user owns this session
      if (session.userId && session.userId !== user.userId) {
        logger.warn('Unauthorized session deletion attempt', {
          sessionId,
          requestingUser: user.userId,
          sessionOwner: session.userId
        });

        return res.status(403).json({
          success: false,
          type: 'error',
          error: 'SESSION_ACCESS_DENIED',
          message: 'Access denied to this session'
        });
      }

      // Get session stats before deletion for response
      const statsBeforeDeletion = sessionService.getSessionStats(sessionId);

      // Delete the session
      const deleted = sessionService.deleteSession(sessionId);

      if (deleted) {
        logger.info('Session deleted successfully', { 
          sessionId,
          userId: user.userId,
          conversationCount: statsBeforeDeletion?.conversationCount || 0,
          toolExecutionCount: statsBeforeDeletion?.toolExecutionCount || 0
        });

        return res.json({
          success: true,
          type: 'response',
          message: 'Session deleted successfully',
          data: {
            sessionId,
            deletedAt: new Date().toISOString(),
            conversationCount: statsBeforeDeletion?.conversationCount || 0,
            toolExecutionCount: statsBeforeDeletion?.toolExecutionCount || 0
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          type: 'error',
          error: 'SESSION_DELETION_FAILED',
          message: 'Failed to delete session'
        });
      }

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
    const limit = Math.min(parseInt(maxResults as string) || 20, 100);

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
function isConfirmationResponse(command: string): boolean {
  const lowerCommand = command.toLowerCase().trim();
  const confirmWords = ['yes', 'y', 'confirm', 'ok', 'okay', 'proceed', 'go ahead', 'do it'];
  const rejectWords = ['no', 'n', 'cancel', 'abort', 'stop', 'nevermind', 'never mind'];
  
  return confirmWords.includes(lowerCommand) || rejectWords.includes(lowerCommand);
}

/**
 * Handle action confirmation from natural language
 */
async function handleActionConfirmation(
  req: AuthenticatedRequest,
  res: Response,
  pendingAction: any,
  command: string,
  sessionId: string
): Promise<Response> {
  const lowerCommand = command.toLowerCase().trim();
  const confirmWords = ['yes', 'y', 'confirm', 'ok', 'okay', 'proceed', 'go ahead', 'do it'];
  const confirmed = confirmWords.includes(lowerCommand);

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
    sessionId
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
async function checkForConfirmationRequirements(toolCalls: any[], command: string): Promise<{
  message: string;
  prompt: string;
  action: any;
} | null> {
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
async function executeConfirmedAction(
  actionId: string,
  parameters: any,
  userId: string,
  sessionId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // In a real implementation, you'd retrieve the stored action details
    // For now, we'll return a placeholder
    logger.info('Executing confirmed action', { actionId, userId, sessionId });
    
    return {
      success: true,
      message: 'Action completed successfully',
      data: { actionId, completedAt: new Date().toISOString() }
    };
  } catch (error) {
    logger.error('Failed to execute confirmed action:', error);
    return {
      success: false,
      message: 'Failed to execute action'
    };
  }
}

/**
 * Format assistant response based on results and user preferences
 */
async function formatAssistantResponse(
  masterResponse: any,
  toolResults: any[],
  originalCommand: string,
  verbosity: 'minimal' | 'normal' | 'detailed'
): Promise<{
  formattedResponse: { message: string; data?: any };
  responseType: 'response' | 'action_completed' | 'partial_success' | 'error';
}> {
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
function buildConversationContext(
  userCommand: string,
  assistantResponse: string,
  existingContext?: any
): any {
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
function extractPendingActions(toolResults: any[]): any[] {
  return toolResults
    .filter(result => result.result && typeof result.result === 'object' && 'actionId' in result.result)
    .map(result => ({
      actionId: result.result.actionId || `action-${Date.now()}`,
      type: result.toolName,
      parameters: result.result.parameters || {},
      awaitingConfirmation: true
    }));
}

function generateConfirmationPrompt(toolCalls: any[], toolResults: any[]): string {
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

function generateCompletionMessage(toolResults: any[]): string {
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