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

// Mount debug routes (only in development/test environments)
if (process.env.NODE_ENV !== 'production') {
  router.use('/debug', createDebugRoutes(container));
  logger.info('Debug auth routes enabled', {
    operation: 'auth_routes_init',
    environment: process.env.NODE_ENV || 'development'
  });
} else {
  logger.info('Debug auth routes disabled (production environment)', {
    operation: 'auth_routes_init',
    environment: 'production'
  });
}

  return router;
}