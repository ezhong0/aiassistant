/**
 * Google OAuth Route Handlers
 * Consolidated handlers using BaseRouteHandler pattern for main OAuth flow
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { BaseRouteHandler, RouteResponse } from '../../framework/base-route-handler';
import { AuthService } from '../../services/auth.service';
import { ScopeManager } from '../../constants/oauth-scopes';
import { HTMLTemplates } from '../../templates/html-templates';
import logger from '../../utils/logger';

// Validation schemas
const googleOAuthQuerySchema = z.object({
  scope: z.string().optional(),
  state: z.string().optional(),
  user_id: z.string().optional(),
  team_id: z.string().optional()
});

const googleSlackOAuthQuerySchema = z.object({
  user_id: z.string().optional(),
  team_id: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional()
});

/**
 * Handler for Google OAuth initiation (general flow)
 */
export class GoogleOAuthHandler extends BaseRouteHandler {
  constructor() {
    super('google_oauth_initiate', {
      requiresAuth: false,
      rateLimit: true,
      successRedirect: '/auth/callback'
    });
  }

  async handle(req: Request, res: Response): Promise<RouteResponse> {
    const query = this.validateRequest(googleOAuthQuerySchema, req.query);
    const authService = this.getService<AuthService>('authService');

    // Create OAuth state
    const state = this.createOAuthState({
      userId: query.user_id || `user_${Date.now()}`,
      teamId: query.team_id,
      flow: 'google',
      scope: query.scope || 'full',
      source: 'web'
    });

    // Get appropriate scopes
    const requestedScopes = query.scope === 'minimal' 
      ? ScopeManager.getGoogleScopes('minimal')
      : ScopeManager.getGoogleScopes('full');

    try {
      const authUrl = await authService.generateGoogleAuthURL(state, requestedScopes);
      
      logger.info('Google OAuth URL generated', {
        correlationId: req.headers['x-correlation-id'] as string,
        operation: this.operation,
        metadata: {
          userId: query.user_id,
          scope: query.scope,
          scopesCount: requestedScopes.length
        }
      });

      return {
        success: true,
        redirect: authUrl
      };

    } catch (error) {
      return {
        success: false,
        html: HTMLTemplates.authError({
          title: 'Authentication Error',
          message: 'Failed to initiate Google OAuth flow',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
  }
}

/**
 * Handler for Google OAuth initiation (Slack integration flow)
 */
export class GoogleSlackOAuthHandler extends BaseRouteHandler {
  constructor() {
    super('google_slack_oauth_initiate', {
      requiresAuth: false,
      rateLimit: true,
      successRedirect: '/auth/callback'
    });
  }

  async handle(req: Request, res: Response): Promise<RouteResponse> {
    const query = this.validateRequest(googleSlackOAuthQuerySchema, req.query);
    const authService = this.getService<AuthService>('authService');

    // Validate required parameters for Slack integration
    if (!query.user_id || !query.team_id) {
      return {
        success: false,
        html: HTMLTemplates.authError({
          title: 'Missing Parameters',
          message: 'Slack integration requires user_id and team_id parameters',
          details: 'This OAuth flow is designed for Slack workspace integration'
        })
      };
    }

    // Create OAuth state for Slack integration
    const state = this.createOAuthState({
      userId: query.user_id,
      teamId: query.team_id,
      flow: 'slack-integration',
      scope: 'slack',
      source: 'slack'
    });

    // Use Slack-specific scopes
    const slackScopes = ScopeManager.getGoogleScopes('slack');

    try {
      const authUrl = await authService.generateGoogleAuthURL(state, slackScopes);
      
      logger.info('Google OAuth URL generated for Slack integration', {
        correlationId: req.headers['x-correlation-id'] as string,
        operation: this.operation,
        metadata: {
          userId: query.user_id,
          teamId: query.team_id,
          scopesCount: slackScopes.length
        }
      });

      return {
        success: true,
        redirect: authUrl
      };

    } catch (error) {
      return {
        success: false,
        html: HTMLTemplates.authError({
          title: 'Slack Integration Error',
          message: 'Failed to initiate Google OAuth for Slack integration',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
  }
}
