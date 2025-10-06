/**
 * Authentication Routes Index
 *
 * Aggregates all authentication-related routes:
 * - Debug endpoints (dev environment only)
 *
 * NOTE: OAuth is handled by Supabase Auth, not backend routes
 */

import express from 'express';
import { createDebugRoutes } from './debug';
import logger from '../../utils/logger';
import type { AppContainer } from '../../di';

export function createAuthRoutes(container: AppContainer) {
  const router = express.Router();
  const config = container.resolve('config');

  // Mount debug routes (only in development/test environments)
  if (!config.isProduction) {
    router.use('/debug', createDebugRoutes(container));
    logger.info('Debug auth routes enabled', {
      operation: 'auth_routes_init',
      environment: config.nodeEnv
    });
  } else {
    logger.info('Debug auth routes disabled (production environment)', {
      operation: 'auth_routes_init',
      environment: 'production'
    });
  }

  return router;
}