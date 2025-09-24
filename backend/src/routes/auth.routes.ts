import express, { Request, Response } from 'express';
import logger from '../utils/logger';
import { createLogContext } from '../utils/log-context';
import { z } from 'zod';
import { GoogleOAuthCallbackSchema, TokenRefreshRequestSchema, LogoutRequestSchema, MobileTokenExchangeSchema } from '../schemas/auth.schemas';
import { validateRequest } from '../middleware/validation.middleware';
import axios from 'axios';
import { getService } from '../services/service-manager';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  GoogleTokens,
  GoogleUserInfo,
  AuthSuccessResponse,
  OAuthCallbackQuery,
  LogoutRequest,
  TokenRefreshRequest
} from '../types/auth.types';
import {
  AppError,
  ErrorFactory,
  ERROR_CATEGORIES
} from '../utils/app-error';
import {
  validateGoogleCallback,
  validateTokenRefresh,
  validateMobileTokenExchange,
} from '../middleware/validation.middleware';
import { authRateLimit } from '../middleware/rate-limiting.middleware';
import { SlackOAuthService } from '../services/slack/slack-oauth.service';

const router = express.Router();

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
const emptyBodySchema = z.object({});


/**
 * GET /auth/google/slack
 * Initiate Google OAuth flow specifically for Slack users
 */
router.get('/google/slack', 
  authRateLimit, 
  validateRequest({ query: debugQuerySchema }),
  (req: Request, res: Response) => {
  try {
    const { user_id, team_id } = req.query;

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    
    // Add slack context to state parameter
    const state = JSON.stringify({
      source: 'slack',
      user_id: user_id || 'unknown',
      team_id: team_id || 'unknown'
    });
    
    const authUrl = authService.generateAuthUrl(scopes, state);
    
    const logContext = createLogContext(req, { operation: 'slack_oauth_init' });
    logger.info('Generated Google OAuth URL for Slack user authentication', {
      ...logContext,
      metadata: { user_id, team_id }
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'slack_oauth_init' });
    logger.error('Error initiating Slack OAuth flow', error as Error, logContext);
    return res.status(500).send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Authentication Error</h1>
          <p>Sorry, there was an error starting the authentication process.</p>
          <p>Please try again from Slack.</p>
        </body>
      </html>
    `);
  }
});

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', 
  authRateLimit, 
  validateRequest({ query: debugQuerySchema }),
  (req: Request, res: Response) => {
  try {
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const authUrl = authService.generateAuthUrl(scopes);
    
    const logContext = createLogContext(req, { operation: 'google_oauth_init' });
    logger.info('Generated Google OAuth URL for user authentication', logContext);
    
    return res.redirect(authUrl);
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'google_oauth_init' });
    logger.error('Error generating Google auth URL', error as Error, logContext);
    return res.status(500).json({
      error: 'Failed to initiate authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/test-oauth-url
 * Test endpoint to generate an OAuth URL for debugging
 */
router.get('/debug/test-oauth-url', 
  validateRequest({ query: debugQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { ENVIRONMENT } = await import('../config/environment');
    const { getService } = await import('../services/service-manager');
    
    const authService = getService('authService');
    if (!authService) {
      return res.status(500).json({ error: 'Auth service not available' });
    }
    
    // Create a test state parameter
    const testState = JSON.stringify({
      source: 'slack',
      team_id: 'test_team',
      user_id: 'test_user',
      channel_id: 'test_channel'
    });
    
    // Generate test OAuth URL
    const testScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/contacts.readonly'
    ];

    const authUrl = (authService as any).generateAuthUrl(testScopes, testState);

    // Also test the Slack interface OAuth URL generation
    let slackOAuthUrl = 'Not available';
    try {
      const mockSlackContext = {
        teamId: 'test_team',
        userId: 'test_user',
        channelId: 'test_channel',
        isDirectMessage: false
      };
      
      // Build a basic Slack OAuth URL for test output
      const clientId = process.env.SLACK_CLIENT_ID;
      const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI;
      if (clientId && redirectUri) {
        const scopes = [
          'im:history',
          'im:write',
          'users:read',
          'chat:write',
          'commands'
        ].join(',');
        slackOAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      } else {
        slackOAuthUrl = 'OAuth config missing';
      }
    } catch (slackError: unknown) {
      const errorMessage = slackError instanceof Error ? slackError.message : 'Unknown error';
      slackOAuthUrl = `Error: ${errorMessage}`;
    }
    
    return res.json({
      success: true,
      message: 'Test OAuth URL generated',
      authUrl,
      slackOAuthUrl,
      config: {
        baseUrl: ENVIRONMENT.baseUrl,
        clientId: ENVIRONMENT.google.clientId ? '✅ Configured' : '❌ Not configured',
        redirectUri: ENVIRONMENT.google.redirectUri || `${ENVIRONMENT.baseUrl}/auth/callback`,
        environmentRedirectUri: ENVIRONMENT.google.redirectUri,
        computedRedirectUri: ENVIRONMENT.google.redirectUri || `${ENVIRONMENT.baseUrl}/auth/callback`
      },
      testState,
      scopes: testScopes,
      debug: {
        baseUrlContainsAuth: ENVIRONMENT.baseUrl.includes('/auth/'),
        baseUrlParts: ENVIRONMENT.baseUrl.split('/auth/'),
        correctedBaseUrl: ENVIRONMENT.baseUrl.includes('/auth/') ? ENVIRONMENT.baseUrl.split('/auth/')[0] : ENVIRONMENT.baseUrl
      }
    });
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'test_oauth_url' });
    logger.error('Error in test OAuth URL endpoint', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Test OAuth URL generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/current-config
 * Simple endpoint to show current OAuth configuration
 */
router.get('/debug/current-config', 
  validateRequest({ query: emptyQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { ENVIRONMENT } = await import('../config/environment');
    
    return res.json({
      success: true,
      message: 'Current OAuth configuration',
      config: {
        baseUrl: ENVIRONMENT.baseUrl,
        baseUrlContainsAuth: ENVIRONMENT.baseUrl.includes('/auth/'),
        correctedBaseUrl: ENVIRONMENT.baseUrl.includes('/auth/') ? ENVIRONMENT.baseUrl.split('/auth/')[0] : ENVIRONMENT.baseUrl,
        google: {
          clientId: ENVIRONMENT.google.clientId ? '✅ Configured' : '❌ Not configured',
          clientSecret: ENVIRONMENT.google.clientSecret ? '✅ Configured' : '❌ Not configured',
          redirectUri: ENVIRONMENT.google.redirectUri || `${ENVIRONMENT.baseUrl}/auth/callback`
        },
        environment: ENVIRONMENT.nodeEnv,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'current_config_debug' });
    logger.error('Error in current config debug endpoint', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/oauth-config
 * Debug endpoint to check OAuth configuration
 */
router.get('/debug/oauth-config', 
  validateRequest({ query: emptyQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { ENVIRONMENT } = await import('../config/environment');
    
    const config = {
      baseUrl: ENVIRONMENT.baseUrl,
      google: {
        clientId: ENVIRONMENT.google.clientId ? '✅ Configured' : '❌ Not configured',
        clientSecret: ENVIRONMENT.google.clientSecret ? '✅ Configured' : '❌ Not configured',
        redirectUri: ENVIRONMENT.google.redirectUri || `${ENVIRONMENT.baseUrl}/auth/callback`
      },
      environment: ENVIRONMENT.nodeEnv,
      timestamp: new Date().toISOString()
    };
    
    return res.json({
      success: true,
      message: 'OAuth configuration debug info',
      config
    });
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'oauth_config_debug' });
    logger.error('Error in OAuth config debug endpoint', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/test-token-exchange
 * Test endpoint to debug token exchange issues
 */
router.get('/debug/test-token-exchange', 
  validateRequest({ query: debugQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.json({
        success: false,
        error: 'Missing code parameter',
        message: 'Add ?code=YOUR_AUTH_CODE to test token exchange'
      });
    }

    const authService = getService<AuthService>('authService');
    if (!authService) {
      return res.status(500).json({ error: 'Auth service not available' });
    }

    try {
      // Test token exchange
      const logContext = createLogContext(req, { operation: 'test_token_exchange' });
      logger.debug('Testing token exchange with provided code', logContext);
      const tokens = await authService.exchangeCodeForTokens(code);
      
      // Test getting user info
      logger.debug('Testing user info retrieval', logContext);
      const userInfo = await authService.getGoogleUserInfo(tokens.access_token);
      
      return res.json({
        success: true,
        message: 'Token exchange successful',
        tokens: {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: tokens.expires_in,
          scope: tokens.scope
        },
        userInfo: {
          email: userInfo.email,
          name: userInfo.name,
          verified: userInfo.email_verified
        }
      });
    } catch (exchangeError: unknown) {
      const logContext = createLogContext(req, { operation: 'test_token_exchange' });
      logger.error('Token exchange test failed', exchangeError as Error, {
        ...logContext,
        metadata: { errorType: (exchangeError as any)?.constructor?.name }
      });
      
      return res.status(500).json({
        success: false,
        error: 'Token exchange failed',
        details: exchangeError instanceof Error ? exchangeError.message : exchangeError
      });
    }
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'debug_token_exchange' });
    logger.error('Debug token exchange endpoint error', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/token-info
 * Test endpoint to check token validity with Google
 */
router.get('/debug/token-info', 
  validateRequest({ query: debugQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.json({
        success: false,
        error: 'Missing token parameter',
        message: 'Add ?token=YOUR_ACCESS_TOKEN to test token validity'
      });
    }

    try {
      // Test token with Google's tokeninfo endpoint
      const response = await axios.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      
      return res.json({
        success: true,
        message: 'Token is valid',
        tokenInfo: response.data
      });
    } catch (tokenError: unknown) {
      const logContext = createLogContext(req, { operation: 'token_info_check' });
      logger.error('Token info check failed', tokenError as Error, {
        ...logContext,
        metadata: {
          status: (tokenError as any).response?.status,
          data: (tokenError as any).response?.data
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Token validation failed',
        details: (tokenError as any).response?.data || (tokenError as any).message
      });
    }
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'debug_token_info' });
    logger.error('Debug token info endpoint error', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/detailed-token-test
 * Comprehensive token debugging endpoint
 */
router.get('/debug/detailed-token-test', 
  validateRequest({ query: debugQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.json({
        success: false,
        error: 'Missing code parameter',
        message: 'Add ?code=YOUR_AUTH_CODE to test detailed token analysis'
      });
    }

    const authService = getService<AuthService>('authService');
    if (!authService) {
      return res.status(500).json({ error: 'Auth service not available' });
    }

    const results: Record<string, unknown> = {
      step1_tokenExchange: null,
      step2_tokenValidation: null,
      step3_userinfoTest: null,
      step4_alternativeEndpoints: []
    };

    try {
      // Step 1: Exchange code for tokens
      const logContext = createLogContext(req, { operation: 'detailed_token_test' });
      logger.debug('Step 1: Testing token exchange', logContext);
      const tokens = await authService.exchangeCodeForTokens(code);
      results.step1_tokenExchange = {
        success: true,
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenLength: tokens.access_token.length,
        tokenPrefix: tokens.access_token.substring(0, 30) + '...',
        expiresIn: tokens.expires_in,
        scope: tokens.scope
      };

      // Step 2: Validate token with Google's tokeninfo
      logger.debug('Step 2: Testing token validation', logContext);
      try {
        const tokenInfoResponse = await axios.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${tokens.access_token}`);
        results.step2_tokenValidation = {
          success: true,
          data: tokenInfoResponse.data
        };
      } catch (tokenError: unknown) {
        results.step2_tokenValidation = {
          success: false,
          error: (tokenError as any).response?.data || (tokenError as any).message,
          status: (tokenError as any).response?.status
        };
      }

      // Step 3: Test userinfo endpoints
      logger.debug('Step 3: Testing userinfo endpoints', logContext);
      const endpoints = [
        'https://openidconnect.googleapis.com/v1/userinfo',
        'https://www.googleapis.com/oauth2/v2/userinfo',
        'https://www.googleapis.com/oauth2/v1/userinfo',
        'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(endpoint, {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`
            }
          });
          (results as any).step4_alternativeEndpoints.push({
            endpoint,
            success: true,
            data: response.data
          });
        } catch (endpointError: unknown) {
          (results as any).step4_alternativeEndpoints.push({
            endpoint,
            success: false,
            status: (endpointError as any).response?.status,
            error: (endpointError as any).response?.data || (endpointError as any).message
          });
        }
      }

      // Step 4: Try direct userinfo call
      try {
        const userInfo = await authService.getGoogleUserInfo(tokens.access_token);
        results.step3_userinfoTest = {
          success: true,
          userInfo
        };
      } catch (userinfoError: unknown) {
        results.step3_userinfoTest = {
          success: false,
          error: (userinfoError as any).message,
          details: (userinfoError as any).response?.data
        };
      }

      return res.json({
        success: true,
        message: 'Detailed token analysis complete',
        results
      });

    } catch (exchangeError: unknown) {
      results.step1_tokenExchange = {
        success: false,
        error: (exchangeError as any).message,
        details: (exchangeError as any).response?.data
      };

      return res.json({
        success: false,
        error: 'Token exchange failed',
        results
      });
    }
  } catch (error: unknown) {
    const logContext = createLogContext(req, { operation: 'debug_detailed_token_test' });
    logger.error('Debug detailed token test endpoint error', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/oauth-validation
 * Debug OAuth configuration vs. actual usage
 */
router.get('/debug/oauth-validation', 
  validateRequest({ query: emptyQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const authService = getService<AuthService>('authService');
    if (!authService) {
      return res.status(500).json({ error: 'Auth service not available' });
    }

    // Generate a test OAuth URL to see what parameters we're using
    const testScopes = ['openid', 'email', 'profile'];
    const testState = JSON.stringify({ source: 'debug', timestamp: Date.now() });
    const authUrl = authService.generateAuthUrl(testScopes, testState);

    // Parse the URL to show the exact parameters
    const url = new URL(authUrl);
    const params = Object.fromEntries(url.searchParams.entries());

    // Get config details
    const { ENVIRONMENT } = await import('../config/environment');

    return res.json({
      success: true,
      message: 'OAuth configuration validation',
      currentConfig: {
        clientId: ENVIRONMENT.google.clientId ? ENVIRONMENT.google.clientId.substring(0, 20) + '...' : 'NOT SET',
        redirectUri: ENVIRONMENT.google.redirectUri,
        baseUrl: ENVIRONMENT.baseUrl,
        environment: ENVIRONMENT.nodeEnv
      },
      generatedAuthUrl: {
        fullUrl: authUrl,
        host: url.host,
        pathname: url.pathname,
        parameters: params
      },
      expectedByGoogle: {
        client_id: params.client_id || 'MISSING',
        redirect_uri: params.redirect_uri || 'MISSING',
        response_type: params.response_type || 'MISSING',
        scope: params.scope || 'MISSING',
        state: params.state ? 'Present' : 'Missing'
      },
      validation: {
        clientIdMatch: ENVIRONMENT.google.clientId === params.client_id,
        redirectUriMatch: ENVIRONMENT.google.redirectUri === params.redirect_uri,
        responseTypeCorrect: params.response_type === 'code',
        scopesIncludeOpenId: (params.scope || '').includes('openid'),
        scopesIncludeEmail: (params.scope || '').includes('email'),
        scopesIncludeProfile: (params.scope || '').includes('profile')
      }
    });
  } catch (error: unknown) {
    const logContext = createLogContext(req, { operation: 'debug_oauth_validation' });
    logger.error('Debug OAuth validation endpoint error', error as Error, logContext);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/debug/sessions
 * Debug endpoint to check session and OAuth token status
 */
router.get('/debug/sessions', 
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

/**
 * GET /auth/init
 * General OAuth initiation endpoint that handles both regular and Slack users
 */
router.get('/init', 
  authRateLimit, 
  validateRequest({ query: debugQuerySchema }),
  (req: Request, res: Response) => {
  try {
    const { client_id, scope, state, response_type, access_type, prompt } = req.query;
    
    // Validate required parameters
    if (!client_id || !scope || !state) {
      throw new Error('Missing required OAuth parameters');
    }

    // Parse state to determine if this is a Slack user
    let slackContext = null;
    try {
      slackContext = JSON.parse(state as string);
    } catch (e) {
      // Not a Slack user, continue with regular flow
    }

    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }

    // Use the provided parameters to generate the auth URL
    const scopesArray = (scope as string).split(' ');
    const authUrl = authService.generateAuthUrl(
      scopesArray,
      state as string
    );
    
    const logContext = createLogContext(req, { operation: 'auth_init' });
    logger.info('Generated Google OAuth URL via /auth/init', {
      ...logContext,
      metadata: {
        isSlackUser: !!slackContext,
        slackUserId: slackContext?.user_id,
        slackTeamId: slackContext?.team_id
      }
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'auth_init' });
    logger.error('Error in /auth/init', error as Error, logContext);
    return res.status(500).send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Authentication Error</h1>
          <p>Sorry, there was an error starting the authentication process.</p>
          <p>Please try again or contact support if the issue persists.</p>
        </body>
      </html>
    `);
  }
});


/**
 * GET /auth/callback
 * Handle OAuth callback from Google
 */
router.get('/callback', 
  authRateLimit, 
  validateRequest({ query: GoogleOAuthCallbackSchema }),
  async (req: Request, res: Response) => {
  try {
    const { code, error, error_description, state }: OAuthCallbackQuery = req.query;

    // Parse state parameter to detect Slack authentication
    let slackContext = null;
    if (state && typeof state === 'string') {
      try {
        slackContext = JSON.parse(state);
      } catch (e) {
        
      }
    }

    const isSlackAuth = slackContext?.source === 'slack';

    if (error) {
      
      
      if (isSlackAuth) {
        return res.status(400).send(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>❌ Authentication Failed</h1>
              <p>Sorry, there was an error connecting your Gmail account:</p>
              <p><strong>${error_description || error}</strong></p>
              <p>Please try again from Slack or contact support if the issue persists.</p>
              <p style="margin-top: 40px; color: #666;">You can close this tab and return to Slack.</p>
            </body>
          </html>
        `);
      }
      
      const authError = ErrorFactory.unauthorized(`Token exchange failed: ${error_description || error}`);
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(authError.statusCode).json(errorResponse);
    }

    if (!code || typeof code !== 'string') {
      
      
      if (isSlackAuth) {
        return res.status(400).send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>❌ Authentication Error</h1>
              <p>No authorization code was received from Google.</p>
              <p>Please try the authentication process again from Slack.</p>
              <p style="margin-top: 40px; color: #666;">You can close this tab and return to Slack.</p>
            </body>
          </html>
        `);
      }
      
      const authError = ErrorFactory.unauthorized('Missing authorization code');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(400).json(errorResponse);
    }

    // Exchange code for tokens
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const tokens: GoogleTokens = await authService.exchangeCodeForTokens(code);
    
    // Get user info
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(tokens.access_token);
    
    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });


    // Store tokens associated with Slack user context for future use
    if (isSlackAuth && slackContext?.user_id && slackContext?.team_id) {
      try {
        
        const tokenStorageService = getService('tokenStorageService') as unknown as TokenStorageService;
        if (tokenStorageService) {
          // Store OAuth tokens for the Slack user
          const userId = `${slackContext.team_id}:${slackContext.user_id}`;
          await tokenStorageService.storeUserTokens(userId, {
            google: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || undefined,
              expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + ((tokens.expires_in || 3600) * 1000)),
              token_type: tokens.token_type,
              scope: tokens.scope || undefined
            },
            slack: {
              access_token: undefined, // Slack doesn't need access token for this flow
              team_id: slackContext.team_id,
              user_id: slackContext.user_id
            }
          });

        } else {
          
        }
      } catch (error) {
      }
    } else {
    }

    if (isSlackAuth) {
      // Check if this was a reconnect from auth dashboard
      const returnTo = slackContext?.returnTo;
      const wasAuthDashboard = returnTo === 'auth_dashboard';

      // Send success notification to Slack
      try {
        const slackService = getService('SlackService') as any;
        if (slackService && slackContext?.user_id) {
          await slackService.sendMessage(slackContext.user_id,
            wasAuthDashboard
              ? '✅ Successfully reconnected! Your Google connection has been refreshed.'
              : '✅ Successfully connected! You can now use email and calendar features.',
            {
              blocks: wasAuthDashboard ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '✅ *Successfully Reconnected!*\n\nYour Google connection has been refreshed. You can now use email and calendar features.'
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔐 View Connections'
                      },
                      action_id: 'view_auth_dashboard',
                      value: 'show'
                    }
                  ]
                }
              ] : undefined
            }
          );
        }
      } catch (error) {
        logger.error('Failed to send Slack notification', error as Error, {
          operation: 'slack_notification_error',
          metadata: { userId: slackContext?.user_id }
        });
      }

      return res.send(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>✅ Gmail Connected Successfully!</h1>
            <p>Your Gmail account has been successfully connected to the AI Assistant.</p>
            <p><strong>Email:</strong> ${userInfo.email}</p>
            <p><strong>Name:</strong> ${userInfo.name}</p>
            <p style="margin-top: 30px;">You can now:</p>
            <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
              <li>📧 Send emails through the AI Assistant</li>
              <li>📋 Read and manage your Gmail</li>
              <li>👤 Access your contacts</li>
              <li>📅 Manage your calendar</li>
            </ul>
            <div style="background: #f0f8ff; border: 1px solid #0066cc; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #0066cc; margin-top: 0;">🔄 Next Steps</h3>
              <p style="margin: 10px 0;"><strong>1.</strong> Close this tab and return to Slack</p>
              <p style="margin: 10px 0;"><strong>2.</strong> ${wasAuthDashboard ? 'Check your connections with /auth' : 'Try your request again'}</p>
              <p style="margin: 10px 0;"><strong>3.</strong> The AI Assistant now has access to your account</p>
            </div>
            <p style="margin-top: 40px; color: #666; font-style: italic;">
              You can close this tab and return to Slack to start using the features!
            </p>
            <script>
              // Auto-close after 3 seconds
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }

    // Return JSON response for non-Slack authentication
    const successResponse: AuthSuccessResponse = {
      success: true,
      user: userInfo,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        expiry_date: tokens.expiry_date
      },
      jwt: jwtToken
    };
    
    return res.json(successResponse);

  } catch (error) {
    
    // Parse state for Slack context in error case too
    let slackContext = null;
    const { state } = req.query;
    if (state && typeof state === 'string') {
      try {
        slackContext = JSON.parse(state);
      } catch (e) {
        // Ignore parse errors
      }
    }
    const isSlackAuth = slackContext?.source === 'slack';
    
    if (isSlackAuth) {
      // Add debug link for immediate token testing
      const { code } = req.query;
      const debugLink = code ? `/auth/debug/detailed-token-test?code=${encodeURIComponent(code as string)}` : '';
      
      return res.status(500).send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Authentication Error</h1>
            <p>Sorry, there was an unexpected error during authentication.</p>
            <p>Please try again from Slack or contact support if the issue persists.</p>
            ${debugLink ? `
            <div style="background: #f0f0f0; border: 1px solid #ccc; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: left;">
              <h3 style="margin-top: 0; color: #333;">🔧 Debug Information</h3>
              <p><strong>For debugging:</strong></p>
              <p><a href="${debugLink}" target="_blank" style="color: #0066cc;">Click here to test token exchange</a></p>
              <p style="font-size: 12px; color: #666;">This link will show detailed error information.</p>
            </div>
            ` : ''}
            <p style="margin-top: 40px; color: #666;">You can close this tab and return to Slack.</p>
          </body>
        </html>
      `);
    }
    
    const authError = error instanceof AppError 
      ? error 
      : ErrorFactory.unauthorized('Token exchange failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', 
  authRateLimit, 
  validateRequest({ body: TokenRefreshRequestSchema }),
  async (req: Request, res: Response) => {
  try {
    const { refresh_token }: TokenRefreshRequest = req.body;

    if (!refresh_token || typeof refresh_token !== 'string') {
      const authError = ErrorFactory.unauthorized('Missing or invalid refresh token');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(400).json(errorResponse);
    }

    // Refresh the access token
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const newTokens: GoogleTokens = await authService.refreshGoogleToken(refresh_token);
    
    // Get updated user info with new access token
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(newTokens.access_token);
    
    // Generate new JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    

    return res.json({
      success: true,
      tokens: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        id_token: newTokens.id_token,
        token_type: newTokens.token_type,
        expires_in: newTokens.expires_in,
        scope: newTokens.scope,
        expiry_date: newTokens.expiry_date
      },
      jwt: jwtToken
    });

  } catch (error) {
    
    const authError = error instanceof AppError 
      ? error 
      : ErrorFactory.unauthorized('Token refresh failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 401).json(errorResponse);
  }
});

/**
 * POST /auth/logout
 * Revoke tokens and logout user
 */
router.post('/logout', 
  validateRequest({ body: LogoutRequestSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { access_token, everywhere }: LogoutRequest = req.body;
    
    // Try to revoke the provided token or use the one from the request
    const tokenToRevoke = access_token || req.token;
    
    if (tokenToRevoke) {
      try {
        const authService = getService<AuthService>('authService');
        if (!authService) {
          throw new Error('Auth service not available');
        }
        await authService.revokeGoogleTokens(tokenToRevoke);
      } catch (revokeError) {
        // Log the error but don't fail the logout
      }
    }

    return res.json({
      success: true,
      message: everywhere ? 'Logged out from all devices successfully' : 'Logged out successfully'
    });

  } catch (error) {
    
    const authError = error instanceof AppError 
      ? error 
      : ErrorFactory.unauthorized('Logout failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * GET /auth/validate
 * Validate JWT token
 */
router.get('/validate', 
  validateRequest({ query: emptyQuerySchema }),
  (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        valid: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    
    try {
      const payload = authService.verifyJWT(token);
      return res.json({
        valid: true,
        payload
      });
    } catch (error) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }

  } catch (error) {
    
    return res.status(500).json({
      valid: false,
      error: 'Token validation failed'
    });
  }
});

/**
 * POST /auth/exchange-mobile-tokens
 * Exchange mobile OAuth tokens for JWT
 */
router.post('/exchange-mobile-tokens', 
  authRateLimit, 
  validateRequest({ body: MobileTokenExchangeSchema }),
  async (req: Request, res: Response) => {
  try {
    const { access_token, platform }: {
      access_token: string;
      platform: string;
    } = req.body;

    if (!access_token || typeof access_token !== 'string') {
      const authError = ErrorFactory.unauthorized('Missing or invalid access token');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(400).json(errorResponse);
    }

    // Validate the access token with Google
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    
    const tokenValidation = await authService.validateGoogleToken(access_token);
    if (!tokenValidation.valid) {
      const authError = ErrorFactory.unauthorized('Invalid access token');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(401).json(errorResponse);
    }

    // Get user info from Google
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(access_token);
    
    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });


    return res.json({
      success: true,
      user: userInfo,
      jwt: jwtToken,
      platform,
      message: 'Mobile authentication successful'
    });

  } catch (error) {
    
    const authError = error instanceof AppError 
      ? error 
      : ErrorFactory.unauthorized('Token exchange failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

export default router;