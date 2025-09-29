/**
 * OAuth Debug Route Handlers
 * Consolidated handlers using BaseRouteHandler pattern
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { BaseRouteHandler, RouteResponse } from '../../framework/base-route-handler';
import { AuthService } from '../../services/auth.service';
import logger from '../../utils/logger';

// Debug route validation schemas
const debugQuerySchema = z.object({
  user_id: z.string().optional(),
  team_id: z.string().optional(),
  code: z.string().optional(),
  token: z.string().optional(),
  client_id: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  response_type: z.string().optional(),
  access_type: z.string().optional(),
  prompt: z.string().optional(),
});

const emptyQuerySchema = z.object({});

/**
 * Handler for OAuth configuration debug info
 */
export class OAuthConfigHandler extends BaseRouteHandler {
  constructor() {
    super('oauth_config_debug', {
      requiresAuth: false,
      rateLimit: true
    });
  }

  async handle(req: Request, res: Response): Promise<RouteResponse> {
    const { config } = await import('../../config');

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

    return {
      success: true,
      data: {
        message: 'OAuth configuration debug info',
        config: configSummary
      }
    };
  }
}

/**
 * Handler for current configuration info  
 */
export class CurrentConfigHandler extends BaseRouteHandler {
  constructor() {
    super('current_config_debug', {
      requiresAuth: false,
      rateLimit: true
    });
  }

  async handle(req: Request, res: Response): Promise<RouteResponse> {
    const { config } = await import('../../config');

    return {
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
      }
    };
  }
}

/**
 * Handler for test OAuth URL generation
 */
export class TestOAuthUrlHandler extends BaseRouteHandler {
  constructor() {
    super('test_oauth_url_debug', {
      requiresAuth: false,
      rateLimit: true
    });
  }

  async handle(req: Request, res: Response): Promise<RouteResponse> {
    const query = this.validateRequest(debugQuerySchema, req.query);
    const { config } = await import('../../config');
    
    const authService = this.getService<AuthService>('authService');
    
    // Generate test OAuth URLs
    const testState = JSON.stringify({
      timestamp: Date.now(),
      debug: true,
      userId: query.user_id || 'test-user'
    });

    const testScopes = [
      'openid',
      'email', 
      'profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly'
    ];

    const authUrl = await authService.generateGoogleAuthURL(testState, testScopes);
    const slackOAuthUrl = await authService.generateSlackAuthURL(testState);

    return {
      success: true,
      data: {
        message: 'Test OAuth URL generated',
        authUrl,
        slackOAuthUrl,
        config: {
          baseUrl: process.env.BASE_URL || 'http://localhost:3000',
          clientId: config.googleAuth?.clientId ? '✅ Configured' : '❌ Not configured',
          redirectUri: config.googleAuth?.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`,
          environmentRedirectUri: config.googleAuth?.redirectUri,
          computedRedirectUri: config.googleAuth?.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`
        },
        testState,
        scopes: testScopes,
        debug: {
          baseUrlContainsAuth: (process.env.BASE_URL || 'http://localhost:3000').includes('/auth/'),
          baseUrlParts: (process.env.BASE_URL || 'http://localhost:3000').split('/auth/'),
          correctedBaseUrl: (process.env.BASE_URL || 'http://localhost:3000').includes('/auth/') 
            ? (process.env.BASE_URL || 'http://localhost:3000').split('/auth/')[0] 
            : (process.env.BASE_URL || 'http://localhost:3000')
        }
      }
    };
  }
}
