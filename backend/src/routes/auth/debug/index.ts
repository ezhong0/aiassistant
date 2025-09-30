/**
 * Debug Routes Index
 *
 * Aggregates all debug endpoints for OAuth and authentication testing.
 * These routes should only be available in development/test environments.
 */

import express from 'express';
import testOAuthRoutes from './test-oauth.routes';
import configRoutes from './config.routes';

const router = express.Router();

// Mount debug route modules
router.use('/', testOAuthRoutes);
router.use('/', configRoutes);

export default router;