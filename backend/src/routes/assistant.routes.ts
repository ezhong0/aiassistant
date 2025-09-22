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
import { sanitizeString } from '../utils/validation.utils';
import { userRateLimit, sensitiveOperationRateLimit } from '../middleware/rate-limiting.middleware';
import { getService } from '../services/service-manager';
import { REQUEST_LIMITS, RATE_LIMITS } from '../config/app-config';
import { assistantApiLogging } from '../middleware/api-logging.middleware';
import { MasterAgent, UnifiedProcessingResult } from '../agents/master.agent';
import { DraftManager } from '../services/draft-manager.service';
import { ToolExecutorService } from '../services/tool-executor.service';
import { OpenAIService } from '../services/openai.service';
import { TokenStorageService } from '../services/token-storage.service';
import { ToolExecutionContext, ToolResult, ToolCall } from '../types/tools';
import { 
  SendEmailRequestSchema,
  SearchEmailRequestSchema
} from '../schemas/email.schemas';
import { 
  validateAndSendResponse,
  sendSuccessResponse,
  sendErrorResponse
} from '../utils/response-validation.util';
import { 
  SuccessResponseSchema,
  ErrorResponseSchema,
  ToolExecutionResultSchema
} from '../schemas/api.schemas';

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
    
    
    // Use client context directly (no session merging)
    const mergedContext = (context as any) || {};
    

    // Handle pending actions if present
    
    if (mergedContext?.pendingActions && mergedContext.pendingActions.length > 0) {
      const pendingAction = mergedContext.pendingActions.find((action: any) => action.awaitingConfirmation);
      
      
      const isConfirmation = await isConfirmationResponse(commandString);
      if (pendingAction && isConfirmation) {
        
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

    // Use unified processing with DraftManager integration
    const result = await masterAgent.processUserInputUnified(
      commandString,
      finalSessionId,
      user.userId,
      {
        accessToken: accessToken as string | undefined,
        context: mergedContext
      }
    );

    // Check if result indicates draft creation needed
    if (result.needsConfirmation && result.draftId) {
      // Return confirmation response with draft details
      const confirmationResponse = ResponseBuilder.confirmationRequired(
        result.message, // This includes draft contents
        {
          sessionId: finalSessionId,
          draftId: result.draftId,
          draftContents: result.draftContents,
          conversationContext: buildConversationContext(commandString, result.message, mergedContext)
        },
        {
          sessionId: finalSessionId,
          userId: user.userId
        }
      );
      return res.json(confirmationResponse);
    } else {
      // Direct execution completed or no action needed
      const actionResponse = ResponseBuilder.actionCompleted(
        result.message,
        {
          sessionId: finalSessionId,
          toolResults: result.toolResults,
          conversationContext: buildConversationContext(commandString, result.message, mergedContext)
        },
        {
          sessionId: finalSessionId,
          userId: user.userId
        }
      );
      return res.json(actionResponse);
    }

  } catch (error) {
    
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
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { to, subject, body, cc, bcc } = req.validatedBody as z.infer<typeof SendEmailRequestSchema>;
    const user = req.user!;
    
    // Validation is now handled by Zod schema

    // Get access token
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      res.status(401).json({
        success: false,
        error: 'Google access token required',
        requiresAuth: true
      });
      return;
    }


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

    // ✅ Validate response with Zod schema
    const responseData = {
      success: result.success,
      message: result.result?.message || 'Email operation completed',
      data: result.result?.data,
      error: result.error,
      executionTime: result.executionTime
    };
    
    validateAndSendResponse(res, SuccessResponseSchema, responseData);

  } catch (error) {
    
    const errorData = {
      success: false,
      error: 'Failed to send email',
      timestamp: new Date().toISOString()
    };
    validateAndSendResponse(res, ErrorResponseSchema, errorData, 500);
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
    const openaiService = getService<OpenAIService>('openaiService');
    if (!openaiService) {
      // Fallback to simple detection if AI service unavailable
      const lowerCommand = command.toLowerCase().trim();
      return lowerCommand.includes('yes') || lowerCommand.includes('confirm') ||
             lowerCommand.includes('no') || lowerCommand.includes('cancel');
    }

    const prompt = `Is this message a confirmation or response to a previous request?

Message: "${command}"

Examples of confirmations:
- "Yes" → true
- "No" → true
- "Cancel" → true
- "Confirm" → true
- "Go ahead" → true
- "Hello there" → false
- "What's the weather?" → false

Return only true or false.`;

    const response = await openaiService.generateText(
      prompt,
      'You are an expert at detecting confirmation messages. Return only true or false.',
      { temperature: 0.1, maxTokens: 10 }
    );

    return response.trim().toLowerCase() === 'true';
  } catch (error) {
    // Fallback to simple detection on error
    const lowerCommand = command.toLowerCase().trim();
    return lowerCommand.includes('yes') || lowerCommand.includes('confirm') ||
           lowerCommand.includes('no') || lowerCommand.includes('cancel');
  }
}

/**
 * Check if command is a positive confirmation (yes/confirm vs no/cancel)
 */
const isPositiveConfirmation = async (command: string): Promise<boolean> => {
  try {
    const openaiService = getService<OpenAIService>('openaiService');
    if (!openaiService) {
      // Fallback to simple detection if AI service unavailable
      const lowerCommand = command.toLowerCase().trim();
      return lowerCommand.includes('yes') || lowerCommand.includes('confirm');
    }

    const prompt = `Is this a positive confirmation (agreeing/accepting) or negative (declining/rejecting)?

Message: "${command}"

Examples:
- "Yes" → true (positive)
- "No" → false (negative)
- "Cancel" → false (negative)
- "Confirm" → true (positive)
- "Go ahead" → true (positive)
- "Don't send it" → false (negative)

Return only true for positive confirmation, false for negative.`;

    const response = await openaiService.generateText(
      prompt,
      'You are an expert at detecting positive vs negative confirmations. Return only true or false.',
      { temperature: 0.1, maxTokens: 10 }
    );

    return response.trim().toLowerCase() === 'true';
  } catch (error) {
    // Fallback to simple detection on error
    const lowerCommand = command.toLowerCase().trim();
    return lowerCommand.includes('yes') || lowerCommand.includes('confirm');
  }
};

/**
 * AI-powered agent routing based on query intent
 */
const determineAgentForQuery = async (query: string): Promise<string> => {
  try {
    const openaiService = getService<OpenAIService>('openaiService');
    if (!openaiService) {
      // Fallback to simple keyword detection if AI service unavailable
      const queryLower = query.toLowerCase();
      if (queryLower.includes('email')) return 'emailAgent';
      if (queryLower.includes('calendar')) return 'calendarAgent';
      if (queryLower.includes('contact')) return 'contactAgent';
      return 'thinkAgent';
    }

    const prompt = `Analyze this user query and determine which agent should handle it:

Query: "${query}"

Available agents:
- emailAgent: Send, reply to, search, and manage emails using Gmail
- calendarAgent: Create, update, and manage calendar events and scheduling
- contactAgent: Search and manage contacts from Google Contacts
- thinkAgent: Analyze and reason about requests, general questions

Examples:
- "Send an email to John" → emailAgent
- "Schedule a meeting tomorrow" → calendarAgent
- "Find Sarah's contact info" → contactAgent
- "What's the weather like?" → thinkAgent
- "Analyze this data" → thinkAgent

Return only the agent name (emailAgent, calendarAgent, contactAgent, or thinkAgent).`;

    const response = await openaiService.generateText(
      prompt,
      'You are an expert at routing user queries to the appropriate agent. Return only the agent name.',
      { temperature: 0.1, maxTokens: 20 }
    );

    const agentName = response.trim();

    // Validate the response is one of our known agents
    const validAgents = ['emailAgent', 'calendarAgent', 'contactAgent', 'thinkAgent'];
    if (validAgents.includes(agentName)) {
      return agentName;
    }

    // Fallback to thinkAgent if response is invalid
    return 'thinkAgent';

  } catch (error) {
    // Fallback to simple keyword detection on error
    const queryLower = query.toLowerCase();
    if (queryLower.includes('email')) return 'emailAgent';
    if (queryLower.includes('calendar')) return 'calendarAgent';
    if (queryLower.includes('contact')) return 'contactAgent';
    return 'thinkAgent';
  }
};

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
    // AI-powered confirmation detection
    const confirmed = await isPositiveConfirmation(command);

    if (!confirmed) {
      // Cancel draft using DraftManager
      const draftManager = getService<DraftManager>('draftManager');
      if (draftManager && pendingAction.actionId) {
        await draftManager.removeDraft(pendingAction.actionId);
      }
      
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

    // Execute draft using DraftManager
    const draftManager = getService<DraftManager>('draftManager');
    if (!draftManager) {
      throw new Error('DraftManager not available');
    }

    const result = await draftManager.executeDraft(pendingAction.actionId);

    return res.json({
      success: result.success,
      type: result.success ? 'action_completed' : 'error',
      message: result.success ? 'Action completed successfully!' : result.error,
      data: {
        actionId: pendingAction.actionId,
        status: result.success ? 'completed' : 'failed',
        result: result.result,
        sessionId
      }
    });
  } catch (error) {
    
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
      // Default to requiring confirmation for send operations
      if (tc.name.includes('send') || tc.name.includes('create')) {
        sensitiveOperations.push(tc);
      }
    } catch (error) {
      
      // Continue without AI detection
    }
  }

  if (sensitiveOperations.length > 0) {
    const operation = sensitiveOperations[0];
    const actionId = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use simple confirmation
    try {
      return {
        message: `Please confirm: Do you want to ${operation?.name} with the specified parameters?`,
        prompt: 'Reply with "yes" to confirm or "no" to cancel.',
        action: {
          name: operation?.name || 'unknown',
          parameters: operation?.parameters || {},
          ...(operation as any) // Include any additional properties
        }
      };
    } catch (error) {
      
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

    // Use AI-powered routing
    let toolCall: ToolCall;
    try {
      // AI-powered agent routing
      const agentName = await determineAgentForQuery(query as string);
      toolCall = { name: agentName, parameters: { query } };
    } catch (error) {
      
      
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
      accessToken
    );

    if (toolResult.success) {
      return {
        success: true,
        message: toolResult.result?.message || '🎉💖 Yay! Action completed successfully and I\'m so happy I could help! ✨',
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
          content: 'Ask if the user wants to proceed with this action. Be natural and friendly.'
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
    
  }
  
  // Fallback
  return 'I need your confirmation before proceeding with this action.';
}

const generateDynamicConfirmationPrompt = async (toolCalls: ToolCall[], toolResults: ToolResult[], userCommand: string): Promise<string> => {
  try {
    // Use simple confirmation
    const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent' || tc.name === 'contactAgent');

    if (mainAction) {
      return `Please confirm: Do you want to ${mainAction.name} with the command "${userCommand}"? Reply with "yes" to confirm or "no" to cancel.`;
    } else {
      return generateFallbackDynamicConfirmationPrompt(toolCalls, toolResults, userCommand);
    }
  } catch (error) {
    
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
          content: 'Tell the user how to confirm or cancel. Keep it brief.'
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
    
    // Throw error instead of using hardcoded fallback messages
    throw new Error(`Failed to generate confirmation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // This should never be reached due to the throw above, but TypeScript needs it
  throw new Error('OpenAI service not available for confirmation generation');
}

const generateConfirmationPrompt = async (toolCalls: ToolCall[], toolResults: ToolResult[]): Promise<string> => {
  try {
    // Use simple confirmation
    const mainAction = toolCalls.find(tc => tc.name === 'emailAgent' || tc.name === 'calendarAgent' || tc.name === 'contactAgent');

    if (!mainAction) {
      throw new Error('No valid action found for confirmation');
    }

    // Simplified confirmation
    return `Please confirm: Do you want to execute ${mainAction.name}? Reply with "yes" to confirm or "no" to cancel.`;
  } catch (error) {
    
    throw new Error(`Failed to generate confirmation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};


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
          content: 'Summarize what was accomplished. Be positive and concise.'
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
          content: 'Confirm the action was cancelled. Be reassuring and brief.'
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