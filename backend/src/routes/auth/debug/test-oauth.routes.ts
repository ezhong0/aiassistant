import express, { Request, Response } from 'express';
import logger from '../../../utils/logger';
import { createLogContext } from '../../../utils/log-context';
import { z } from 'zod';
import { validateRequest } from '../../../middleware/validation.middleware';
import axios from 'axios';
import { getService } from '../../../services/service-manager';
import { AuthService } from '../../../services/auth.service';
import { OAUTH_SCOPES } from '../../../constants/oauth-scopes';

const router = express.Router();

// Debug query schema
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
 * GET /auth/debug/test-oauth-url
 * Test endpoint to generate an OAuth URL for debugging
 */
router.get('/test-oauth-url',
  validateRequest({ query: debugQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const { config } = await import('../../../config');
    const { getService } = await import('../../../services/service-manager');

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
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        clientId: config.googleAuth?.clientId ? '✅ Configured' : '❌ Not configured',
        redirectUri: config.googleAuth?.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`,
        environmentRedirectUri: config.googleAuth?.redirectUri,
        computedRedirectUri: config.googleAuth?.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`
      },
      testState,
      scopes: testScopes,
      debug: {
        baseUrlContainsAuth: process.env.BASE_URL || 'http://localhost:3000'.includes('/auth/'),
        baseUrlParts: process.env.BASE_URL || 'http://localhost:3000'.split('/auth/'),
        correctedBaseUrl: process.env.BASE_URL || 'http://localhost:3000'.includes('/auth/') ? process.env.BASE_URL || 'http://localhost:3000'.split('/auth/')[0] : process.env.BASE_URL || 'http://localhost:3000'
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
 * GET /auth/debug/test-token-exchange
 * Test endpoint to debug token exchange issues
 */
router.get('/test-token-exchange',
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
router.get('/token-info',
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
router.get('/detailed-token-test',
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
router.get('/oauth-validation',
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
    const { config } = await import('../../../config');

    return res.json({
      success: true,
      message: 'OAuth configuration validation',
      currentConfig: {
        clientId: config.googleAuth?.clientId ? config.googleAuth?.clientId.substring(0, 20) + '...' : 'NOT SET',
        redirectUri: config.googleAuth?.redirectUri,
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        environment: config.nodeEnv
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
        clientIdMatch: config.googleAuth?.clientId === params.client_id,
        redirectUriMatch: config.googleAuth?.redirectUri === params.redirect_uri,
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

export default router;