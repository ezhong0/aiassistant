/**
 * Debug Routes Index
 *
 * Aggregates all debug endpoints for OAuth and authentication testing.
 * These routes should only be available in development/test environments.
 */

import express from 'express';
import { createDebugOAuthRoutes } from './test-oauth.routes';
import { createDebugConfigRoutes } from './config.routes';
import type { AppContainer } from '../../../di';

/**
 * Create debug routes with DI container
 */
export function createDebugRoutes(container: AppContainer) {
  const router = express.Router();

  // Mount debug route modules with container
  router.use('/', createDebugOAuthRoutes(container));
  router.use('/', createDebugConfigRoutes(container));

  return router;
}