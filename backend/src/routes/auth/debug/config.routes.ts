import express, { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../../config';
import logger from '../../../utils/logger';
import { createLogContext } from '../../../utils/log-context';
import { validateRequest } from '../../../middleware/validation.middleware';
import type { AppContainer } from '../../../di';

const emptyQuerySchema = z.object({});

/**
 * Create debug config routes with DI container
 */
export function createDebugConfigRoutes(container: AppContainer) {
  const router = express.Router();

  /**
   * GET /auth/debug/current-config
   * Simple endpoint to show current OAuth configuration
   */
  router.get('/current-config',
    validateRequest({ query: emptyQuerySchema }),
    (req: Request, res: Response) => {
      try {
        const logContext = createLogContext(req, { operation: 'current_config_debug' });
        logger.info('Current config debug request', logContext);

        return res.json({
          success: true,
          data: {
            message: 'Current OAuth configuration',
            config: {
              baseUrl: process.env.BASE_URL || 'http://localhost:3000',
              baseUrlContainsAuth: (process.env.BASE_URL || 'http://localhost:3000').includes('/auth/'),
              correctedBaseUrl: (process.env.BASE_URL || 'http://localhost:3000').includes('/auth/') 
                ? (process.env.BASE_URL || 'http://localhost:3000').split('/auth/')[0] 
                : (process.env.BASE_URL || 'http://localhost:3000'),
              google: {
                clientId: config.googleAuth?.clientId ? '✅ Configured' : '❌ Not configured',
                clientSecret: config.googleAuth?.clientSecret ? '✅ Configured' : '❌ Not configured',
                redirectUri: config.googleAuth?.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`
              },
              environment: config.nodeEnv,
              timestamp: new Date().toISOString()
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const logContext = createLogContext(req, { operation: 'current_config_debug' });
        logger.error('Error in current-config debug endpoint', error as Error, logContext);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to retrieve configuration',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /auth/debug/oauth-config
   * Debug endpoint to check OAuth configuration
   */
  router.get('/oauth-config',
    validateRequest({ query: emptyQuerySchema }),
    (req: Request, res: Response) => {
      try {
        const logContext = createLogContext(req, { operation: 'oauth_config_debug' });
        logger.info('OAuth config debug request', logContext);

        const configSummary = {
          baseUrl: process.env.BASE_URL || 'http://localhost:3000',
          google: {
            clientId: config.googleAuth?.clientId ? '✅ Configured' : '❌ Not configured',
            clientSecret: config.googleAuth?.clientSecret ? '✅ Configured' : '❌ Not configured',
            redirectUri: config.googleAuth?.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`
          },
          environment: config.nodeEnv,
          timestamp: new Date().toISOString()
        };

        return res.json({
          success: true,
          data: {
            message: 'OAuth configuration debug info',
            config: configSummary
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const logContext = createLogContext(req, { operation: 'oauth_config_debug' });
        logger.error('Error in oauth-config debug endpoint', error as Error, logContext);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to retrieve OAuth configuration',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /auth/debug/sessions
   * Debug endpoint to check session and OAuth token status
   */
  router.get('/sessions',
    validateRequest({ query: emptyQuerySchema }),
    (req: Request, res: Response) => {
      try {
        const logContext = createLogContext(req, { operation: 'debug_sessions' });
        logger.info('Sessions debug request', logContext);

        // This endpoint can be enhanced to show actual session data
        return res.json({
          success: true,
          data: {
            message: 'Session debug endpoint',
            note: 'This endpoint can be enhanced to show actual session data when needed'
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const logContext = createLogContext(req, { operation: 'debug_sessions' });
        logger.error('Error in sessions debug endpoint', error as Error, logContext);
        return res.status(500).json({ 
          success: false,
          error: 'Sessions debug endpoint failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  return router;
}