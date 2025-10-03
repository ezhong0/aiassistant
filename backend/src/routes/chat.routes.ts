/**
 * Chat API Routes
 *
 * Natural language chat interface for the AI assistant.
 * Single endpoint that accepts natural language input and returns natural language output.
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
  const sessionManager = container.resolve('sessionManager');
  const masterAgent = container.resolve('masterAgent');

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
  const chatMessageRequestSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
    session_id: z.string().optional(),
  });

  const chatMessageResponseSchema = z.object({
    message: z.string(),
    session_id: z.string(),
    metadata: z.object({
      tools_used: z.array(z.string()).optional(),
      processing_time: z.number().optional(),
    }).optional(),
  });

  /**
   * POST /api/chat/message
   * Process natural language message and return response
   */
  router.post(
    '/message',
    authenticateSupabase,
    validateRequest({ body: chatMessageRequestSchema }),
    async (req: SupabaseAuthenticatedRequest, res: Response) => {
      const startTime = Date.now();
      const logContext = createLogContext(req, { operation: 'chat_message' });

      try {
        const { message, session_id } = req.validatedBody as z.infer<typeof chatMessageRequestSchema>;
        const userId = req.user!.id; // Guaranteed by authenticateSupabase middleware

        logger.info('Processing chat message', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            userId,
            messageLength: message.length,
            hasSessionId: !!session_id,
          },
        });

        // Get or create session
        const session = await sessionManager.getOrCreateSession({
          userId,
          sessionId: session_id,
        });

        logger.debug('Session retrieved/created', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            sessionId: session.sessionId,
            isNew: !session_id,
            conversationLength: session.conversationHistory.length,
          },
        });

        // Add user message to conversation history
        await sessionManager.addMessage(session.sessionId, {
          role: 'user',
          content: message,
          timestamp: Date.now(),
        });

        // Process message with MasterAgent
        logger.debug('Calling MasterAgent', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            sessionId: session.sessionId,
            userId,
          },
        });

        const result = await masterAgent.processUserInput(message, session.sessionId, userId);

        // Add assistant response to conversation history
        await sessionManager.addMessage(session.sessionId, {
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
        });

        const processingTime = (Date.now() - startTime) / 1000;

        logger.info('Chat message processed successfully', {
          correlationId: logContext.correlationId,
          operation: 'chat_message',
          metadata: {
            userId,
            sessionId: session.sessionId,
            processingTime,
            success: result.success,
          },
        });

        // Send response
        res.json({
          message: result.message,
          session_id: session.sessionId,
          metadata: {
            tools_used: result.metadata?.workflowAction ? [result.metadata.workflowAction] : [],
            processing_time: processingTime,
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

  /**
   * DELETE /api/chat/session/:sessionId
   * Delete a chat session
   */
  router.delete(
    '/session/:sessionId',
    authenticateSupabase,
    async (req: SupabaseAuthenticatedRequest, res: Response) => {
      const logContext = createLogContext(req, { operation: 'delete_session' });

      try {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        logger.info('Deleting chat session', {
          correlationId: logContext.correlationId,
          operation: 'delete_session',
          metadata: {
            userId,
            sessionId,
          },
        });

        // Verify session belongs to user
        const session = await sessionManager.getSession(sessionId);
        if (!session) {
          res.status(404).json({
            error: 'Not found',
            message: 'Session not found',
          });
          return;
        }

        if (session.userId !== userId) {
          logger.warn('Unauthorized session deletion attempt', {
            correlationId: logContext.correlationId,
            operation: 'delete_session',
            metadata: {
              userId,
              sessionUserId: session.userId,
              sessionId,
            },
          });

          res.status(403).json({
            error: 'Forbidden',
            message: 'You can only delete your own sessions',
          });
          return;
        }

        await sessionManager.deleteSession(sessionId);

        logger.info('Chat session deleted successfully', {
          correlationId: logContext.correlationId,
          operation: 'delete_session',
          metadata: {
            userId,
            sessionId,
          },
        });

        res.json({
          success: true,
          message: 'Session deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting chat session', error as Error, {
          correlationId: logContext.correlationId,
          operation: 'delete_session',
          metadata: {
            userId: req.user?.id,
            sessionId: req.params.sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        res.status(500).json({
          error: 'Deletion error',
          message: 'An error occurred while deleting the session',
        });
      }
    }
  );

  /**
   * GET /api/chat/sessions
   * Get all active sessions for the authenticated user
   */
  router.get(
    '/sessions',
    authenticateSupabase,
    async (req: SupabaseAuthenticatedRequest, res: Response) => {
      const logContext = createLogContext(req, { operation: 'get_sessions' });

      try {
        const userId = req.user!.id;

        logger.debug('Fetching user sessions', {
          correlationId: logContext.correlationId,
          operation: 'get_sessions',
          metadata: {
            userId,
          },
        });

        // Get all active sessions
        const activeSessionIds = sessionManager.getActiveSessionIds();
        const userSessions = [];

        for (const sessionId of activeSessionIds) {
          const session = await sessionManager.getSession(sessionId);
          if (session && session.userId === userId) {
            userSessions.push({
              session_id: session.sessionId,
              created_at: new Date(session.createdAt).toISOString(),
              last_accessed_at: new Date(session.lastAccessedAt).toISOString(),
              message_count: session.conversationHistory.length,
            });
          }
        }

        logger.debug('User sessions fetched', {
          correlationId: logContext.correlationId,
          operation: 'get_sessions',
          metadata: {
            userId,
            sessionCount: userSessions.length,
          },
        });

        res.json({
          success: true,
          data: {
            sessions: userSessions,
          },
        });
      } catch (error) {
        logger.error('Error fetching user sessions', error as Error, {
          correlationId: logContext.correlationId,
          operation: 'get_sessions',
          metadata: {
            userId: req.user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        res.status(500).json({
          error: 'Fetch error',
          message: 'An error occurred while fetching sessions',
        });
      }
    }
  );

  return router;
}
