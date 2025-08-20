import express, { Response } from 'express';
import { 
  authenticateToken,
  AuthenticatedRequest 
} from '../middleware/auth.middleware';
import { MasterAgent } from '../agents/master.agent';
import { toolExecutorService } from '../services/tool-executor.service';
// Remove unused import
import { ToolExecutionContext } from '../types/tools';
import logger from '../utils/logger';

const router = express.Router();

// Initialize master agent
const masterAgent = new MasterAgent();

/**
 * POST /assistant/query
 * Process user query and execute appropriate tools
 */
router.post('/query', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, sessionId } = req.body;
    const user = req.user!;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    const finalSessionId = sessionId || `session-${user.userId}-${Date.now()}`;
    
    logger.info('Processing assistant query', { 
      userId: user.userId, 
      query: query.substring(0, 100) + '...',
      sessionId: finalSessionId 
    });

    // Step 1: Get tool calls from master agent
    const masterResponse = await masterAgent.processUserInput(query, finalSessionId, user.userId);
    
    if (!masterResponse.toolCalls || masterResponse.toolCalls.length === 0) {
      return res.json({
        success: true,
        message: masterResponse.message,
        toolCalls: [],
        toolResults: [],
        sessionId: finalSessionId
      });
    }

    // Step 2: Get user's access token for tool execution
    // For email operations, we need the user's Google access token
    // This would typically come from the session or be refreshed
    let accessToken: string | undefined;
    
    // In a real implementation, you'd get this from the user's stored tokens
    // For now, we'll indicate it's needed
    if (masterResponse.toolCalls.some(tc => tc.name === 'emailAgent')) {
      // Try to get access token from request or session
      accessToken = req.headers.authorization?.replace('Bearer ', '');
      
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Google access token required for email operations',
          message: 'Please authenticate with Google to use email features',
          requiresAuth: true
        });
      }
    }

    // Step 3: Execute tools
    const executionContext: ToolExecutionContext = {
      sessionId: finalSessionId,
      userId: user.userId,
      timestamp: new Date()
    };

    const toolResults = await toolExecutorService.executeTools(
      masterResponse.toolCalls,
      executionContext,
      accessToken
    );

    // Step 4: Generate final response
    const stats = toolExecutorService.getExecutionStats(toolResults);
    const hasErrors = toolResults.some(result => !result.success);
    
    let finalMessage = masterResponse.message;
    
    // Enhance message based on results
    if (stats.successful > 0) {
      const successfulResults = toolResults.filter(r => r.success && r.toolName !== 'Think');
      if (successfulResults.length > 0) {
        const actionMessages = successfulResults
          .map(r => r.result?.message)
          .filter(Boolean);
        
        if (actionMessages.length > 0) {
          finalMessage = actionMessages.join(' ');
        }
      }
    }

    if (hasErrors) {
      const errorMessages = toolResults
        .filter(r => !r.success && r.error)
        .map(r => `${r.toolName}: ${r.error}`)
        .join(', ');
      
      if (stats.successful === 0) {
        finalMessage = `I encountered some issues: ${errorMessages}`;
      } else {
        finalMessage += ` (Note: Some operations had issues: ${errorMessages})`;
      }
    }

    logger.info('Assistant query completed', { 
      userId: user.userId,
      sessionId: finalSessionId,
      toolsExecuted: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      totalTime: stats.totalExecutionTime
    });

    return res.json({
      success: !hasErrors || stats.successful > 0,
      message: finalMessage,
      toolCalls: masterResponse.toolCalls,
      toolResults,
      sessionId: finalSessionId,
      executionStats: stats
    });

  } catch (error) {
    logger.error('Assistant query error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: 'An internal error occurred while processing your request'
    });
  }
});

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

export default router;