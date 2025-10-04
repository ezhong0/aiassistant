/**
 * Chat API Routes
 *
 * Stateless natural language chat interface for the AI assistant.
 * Client manages conversation state - sends context with each request.
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.middleware';
import { createSupabaseAuth, SupabaseAuthenticatedRequest } from '../middleware/supabase-auth.middleware';
import logger from '../utils/logger';
import { createLogContext } from '../utils/log-context';
import type { AppContainer } from '../di';

/**
 * Create chat routes with DI container
 */
export function createChatRoutes(container: AppContainer) {
  const router = express.Router();

  // Resolve dependencies from container
  // Use new 3-layer orchestrator instead of old MasterAgent
  const orchestrator = container.resolve('orchestrator');

  // Get Supabase JWT secret from environment
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseJwtSecret) {
    logger.warn('SUPABASE_JWT_SECRET not configured - chat routes will not work', {
      correlationId: 'chat-routes-init',
      operation: 'chat_routes_init',
    });
  }

  // Create Supabase auth middleware
  const authenticateSupabase = supabaseJwtSecret
    ? createSupabaseAuth(supabaseJwtSecret)
    : (req: any, res: any, next: any) => {
        res.status(500).json({
          error: 'Configuration error',
          message: 'Supabase authentication not configured',
        });
      };

  // Validation schemas
  const conversationMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.number(),
  });

  const contextSchema = z.object({
    conversationHistory: z.array(conversationMessageSchema).optional().default([]),
    masterState: z.any().optional(),
    subAgentStates: z.any().optional(),
  });

  const chatMessageRequestSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
    context: contextSchema.optional(),
  });

  const chatMessageResponseSchema = z.object({
    message: z.string(),
    context: contextSchema,
    metadata: z.object({
      tools_used: z.array(z.string()).optional(),
      processing_time: z.number().optional(),
    }).optional(),
  });

  /**
   * POST /api/chat/message
   * Stateless processing: client sends context, receives updated context
   */
  router.post(
    '/message',
    authenticateSupabase,
    validateRequest({ body: chatMessageRequestSchema }),
    async (req: SupabaseAuthenticatedRequest, res: Response) => {
      const startTime = Date.now();
      const logContext = createLogContext(req, { operation: 'chat_message' });

      try {
        const { message, context } = req.validatedBody as z.infer<typeof chatMessageRequestSchema>;
        const userId = req.user!.id; // Guaranteed by authenticateSupabase middleware

        // Initialize context if not provided
        const currentContext = context || {
          conversationHistory: [],
          masterState: undefined,
          subAgentStates: undefined,
        };

        logger.info('Processing chat message (stateless)', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            userId,
            messageLength: message.length,
            conversationLength: currentContext.conversationHistory.length,
          },
        });

        // Add user message to conversation history
        const updatedHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string; timestamp: number }> = [
          ...currentContext.conversationHistory.map(msg => ({
            role: msg.role || 'user' as 'system' | 'user' | 'assistant',
            content: msg.content || '',
            timestamp: msg.timestamp || Date.now()
          })),
          {
            role: 'user' as const,
            content: message,
            timestamp: Date.now(),
          },
        ];

        // Process message with 3-layer Orchestrator
        logger.debug('Calling Orchestrator (3-layer architecture)', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            userId,
            historyLength: updatedHistory.length,
          },
        });

        const result = await orchestrator.processUserInput(
          message,
          userId,
          updatedHistory,
          currentContext.masterState
        );

        // Add assistant response to conversation history
        const finalHistory = [
          ...updatedHistory,
          {
            role: 'assistant' as const,
            content: result.message,
            timestamp: Date.now(),
          },
        ];

        const processingTime = (Date.now() - startTime) / 1000;

        logger.info('Chat message processed successfully', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            userId,
            processingTime,
            success: result.success,
            finalHistoryLength: finalHistory.length,
          },
        });

        // Send response with updated context
        res.json({
          message: result.message,
          context: {
            conversationHistory: finalHistory,
            masterState: result.masterState,
            // Note: subAgentStates not used in 3-layer architecture
            subAgentStates: undefined,
          },
          metadata: {
            tools_used: result.metadata?.workflowAction ? [result.metadata.workflowAction] : [],
            processing_time: processingTime,
            tokens_used: result.metadata?.tokensUsed,
            layers: result.metadata?.layers,
          },
        });
      } catch (error) {
        logger.error('Error processing chat message', error as Error, {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            userId: req.user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        res.status(500).json({
          error: 'Processing error',
          message: 'An error occurred while processing your message',
        });
      }
    }
  );

  return router;
}
