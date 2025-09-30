import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../../middleware/validation.middleware';
import { getService } from '../../../services/service-manager';
import { TokenStorageService } from '../../../services/token-storage.service';
import logger from '../../../utils/logger';
import { createLogContext } from '../../../utils/log-context';
import { OAuthConfigHandler, CurrentConfigHandler } from '../../handlers/oauth-debug.handler';

const router = express.Router();

const emptyQuerySchema = z.object({});

/**
 * GET /auth/debug/current-config
 * Simple endpoint to show current OAuth configuration
 */
router.get('/current-config',
  validateRequest({ query: emptyQuerySchema }),
  (async (req: Request, res: Response) => {
    const handler = new CurrentConfigHandler();
    return handler.createHandler(handler.handle.bind(handler))(req, res, () => {});
  })
);

/**
 * GET /auth/debug/oauth-config
 * Debug endpoint to check OAuth configuration
 */
router.get('/oauth-config',
  validateRequest({ query: emptyQuerySchema }),
  (async (req: Request, res: Response) => {
    const handler = new OAuthConfigHandler();
    return handler.createHandler(handler.handle.bind(handler))(req, res, () => {});
  })
);

/**
 * GET /auth/debug/sessions
 * Debug endpoint to check session and OAuth token status
 */
router.get('/sessions',
  validateRequest({ query: emptyQuerySchema }),
  (req: Request, res: Response) => {
  try {
    const tokenStorageService = getService('tokenStorageService') as TokenStorageService;
    if (!tokenStorageService) {
      return res.status(500).json({ error: 'TokenStorageService not available' });
    }

    // TokenStorageService doesn't have session stats, return basic info
    return res.json({
      message: 'Token storage service is operational',
      serviceType: 'TokenStorageService',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'debug_endpoint' });
    logger.error('Error in debug endpoint', error as Error, logContext);
    return res.status(500).json({ error: 'Debug endpoint failed' });
  }
});

export default router;