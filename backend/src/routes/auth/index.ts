/**
 * Authentication Routes Index
 *
 * Aggregates all authentication-related routes:
 * - OAuth flows (Google, Slack)
 * - Token management (refresh, logout, validate)
 * - Debug endpoints (dev environment only)
 */

import express from 'express';
import createOAuthRoutes from './oauth.routes';
import createTokenRoutes from './token.routes';
import { createDebugRoutes } from './debug';
import logger from '../../utils/logger';
import type { AppContainer } from '../../di';

export function createAuthRoutes(container: AppContainer) {
  const router = express.Router();

  // Mount OAuth routes with container
  router.use('/', createOAuthRoutes(container));

  // Mount token management routes
  router.use('/', createTokenRoutes(container));

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

// Default export for backward compatibility
export default function(container: AppContainer) {
  return createAuthRoutes(container);
}