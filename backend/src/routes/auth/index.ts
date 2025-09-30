/**
 * Authentication Routes Index
 *
 * Aggregates all authentication-related routes:
 * - OAuth flows (Google, Slack)
 * - Token management (refresh, logout, validate)
 * - Debug endpoints (dev environment only)
 */

import express from 'express';
import oauthRoutes from './oauth.routes';
import tokenRoutes from './token.routes';
import debugRoutes from './debug';
import logger from '../../utils/logger';

const router = express.Router();

// Mount OAuth routes
router.use('/', oauthRoutes);

// Mount token management routes
router.use('/', tokenRoutes);

// Mount debug routes (only in development/test environments)
if (process.env.NODE_ENV !== 'production') {
  router.use('/debug', debugRoutes);
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

export default router;