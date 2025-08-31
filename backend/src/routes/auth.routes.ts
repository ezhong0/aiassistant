import express, { Request, Response } from 'express';
import axios from 'axios';
import { getService } from '../services/service-manager';
import { AuthService } from '../services/auth.service';
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
  AuthenticationError,
  formatAuthErrorResponse,
  handleOAuthError
} from '../utils/auth-errors';
import {
  validateGoogleCallback,
  validateTokenRefresh,
  validateMobileTokenExchange,
} from '../middleware/validation.middleware';
import { authRateLimit } from '../middleware/rate-limiting.middleware';
import logger from '../utils/logger';

const router = express.Router();


/**
 * GET /auth/google/slack
 * Initiate Google OAuth flow specifically for Slack users
 */
router.get('/google/slack', authRateLimit, (req: Request, res: Response) => {
  try {
    const { user_id, team_id } = req.query;
    
    const scopes = [
      'openid', 
      'email', 
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly'
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
    
    logger.info('Generated Google OAuth URL for Slack user authentication', {
      user_id,
      team_id
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    logger.error('Error initiating Slack OAuth flow:', error);
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
router.get('/google', authRateLimit, (req: Request, res: Response) => {
  try {
    const scopes = [
      'openid', 
      'email', 
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly'
    ];
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const authUrl = authService.generateAuthUrl(scopes);
    
    logger.info('Generated Google OAuth URL for user authentication');
    
    return res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating Google auth URL:', error);
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
router.get('/debug/test-oauth-url', async (req: Request, res: Response) => {
  try {
    const { ENVIRONMENT } = require('../config/environment');
    const { getService } = require('../services/service-manager');
    
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
    
    const authUrl = authService.generateAuthUrl(testScopes, testState);
    
    // Also test the Slack interface OAuth URL generation
    let slackOAuthUrl = 'Not available';
    try {
      const { SlackInterface } = require('../interfaces/slack.interface');
      const mockSlackContext = {
        teamId: 'test_team',
        userId: 'test_user',
        channelId: 'test_channel'
      };
      
      // Create a mock SlackInterface instance to test OAuth URL generation
      const mockSlackInterface = new SlackInterface({} as any, {} as any);
      slackOAuthUrl = await mockSlackInterface['generateOAuthUrl'](mockSlackContext);
    } catch (slackError: any) {
      slackOAuthUrl = `Error: ${slackError?.message || 'Unknown error'}`;
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
    logger.error('Error in test OAuth URL endpoint:', error);
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
router.get('/debug/current-config', (req: Request, res: Response) => {
  try {
    const { ENVIRONMENT } = require('../config/environment');
    
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
    logger.error('Error in current config debug endpoint:', error);
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
router.get('/debug/oauth-config', (req: Request, res: Response) => {
  try {
    const { ENVIRONMENT } = require('../config/environment');
    
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
    logger.error('Error in OAuth config debug endpoint:', error);
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
router.get('/debug/test-token-exchange', async (req: Request, res: Response) => {
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
      logger.info('Testing token exchange with provided code');
      const tokens = await authService.exchangeCodeForTokens(code);
      
      // Test getting user info
      logger.info('Testing user info retrieval');
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
    } catch (exchangeError) {
      logger.error('Token exchange test failed:', {
        error: exchangeError instanceof Error ? exchangeError.message : exchangeError,
        stack: exchangeError instanceof Error ? exchangeError.stack : undefined,
        errorType: exchangeError?.constructor?.name
      });
      
      return res.status(500).json({
        success: false,
        error: 'Token exchange failed',
        details: exchangeError instanceof Error ? exchangeError.message : exchangeError
      });
    }
  } catch (error) {
    logger.error('Debug token exchange endpoint error:', error);
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
router.get('/debug/token-info', async (req: Request, res: Response) => {
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
    } catch (tokenError) {
      logger.error('Token info check failed:', {
        error: tokenError instanceof Error ? tokenError.message : tokenError,
        status: tokenError.response?.status,
        data: tokenError.response?.data
      });
      
      return res.status(400).json({
        success: false,
        error: 'Token validation failed',
        details: tokenError.response?.data || tokenError.message
      });
    }
  } catch (error) {
    logger.error('Debug token info endpoint error:', error);
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
router.get('/debug/sessions', (req: Request, res: Response) => {
  try {
    const sessionService = getService('sessionService');
    if (!sessionService) {
      return res.status(500).json({ error: 'SessionService not available' });
    }

    const stats = (sessionService as any).getSessionStats();
    const sessionsMap = (sessionService as any).sessions;
    const sessions = Array.from(sessionsMap.entries()).map((entry: any) => {
      const [id, session] = entry;
      return {
        sessionId: id,
        userId: session.userId,
        hasOAuthTokens: !!session.oauthTokens,
        googleToken: !!session.oauthTokens?.google?.access_token,
        slackToken: !!session.oauthTokens?.slack,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      };
    });

    return res.json({
      stats,
      sessions: sessions.slice(0, 20) // Limit to first 20 sessions
    });
  } catch (error) {
    logger.error('Error in debug endpoint:', error);
    return res.status(500).json({ error: 'Debug endpoint failed' });
  }
});

/**
 * GET /auth/init
 * General OAuth initiation endpoint that handles both regular and Slack users
 */
router.get('/init', authRateLimit, (req: Request, res: Response) => {
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
    
    logger.info('Generated Google OAuth URL via /auth/init', {
      isSlackUser: !!slackContext,
      slackUserId: slackContext?.user_id,
      slackTeamId: slackContext?.team_id
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    logger.error('Error in /auth/init:', error);
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
 * GET /auth/google/callback
 * Temporary redirect route to handle incorrect OAuth callbacks
 * This should be removed once the main OAuth URL generation fix is deployed
 */
router.get('/google/callback', (req: Request, res: Response) => {
  try {
    logger.warn('Incorrect OAuth callback route accessed, redirecting to correct endpoint', {
      originalUrl: req.url,
      query: req.query,
      userAgent: req.get('User-Agent')
    });
    
    // Redirect to the correct callback endpoint with all query parameters
    const queryString = new URLSearchParams(req.query as any).toString();
    const redirectUrl = `/auth/callback?${queryString}`;
    
    logger.info('Redirecting OAuth callback to correct endpoint', { redirectUrl });
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error in temporary OAuth callback redirect', { error });
    return res.status(500).json({ 
      error: 'OAuth callback redirect failed',
      message: 'Please contact support'
    });
  }
});

/**
 * GET /auth/callback
 * Handle OAuth callback from Google
 */
router.get('/callback', authRateLimit, validateGoogleCallback, async (req: Request, res: Response) => {
  try {
    const { code, error, error_description, state }: OAuthCallbackQuery = req.query;

    // Parse state parameter to detect Slack authentication
    let slackContext = null;
    if (state && typeof state === 'string') {
      try {
        slackContext = JSON.parse(state);
      } catch (e) {
        logger.warn('Failed to parse state parameter:', state);
      }
    }

    const isSlackAuth = slackContext?.source === 'slack';

    if (error) {
      logger.error('OAuth callback error:', { error, error_description, isSlackAuth });
      
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
      
      const authError = handleOAuthError('token_exchange', new Error(error), { error_description });
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(authError.statusCode).json(errorResponse);
    }

    if (!code || typeof code !== 'string') {
      logger.error('No authorization code received in callback', { isSlackAuth });
      
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
      
      const authError = new AuthenticationError(
        'INVALID_GRANT' as any,
        'Missing authorization code',
        400
      );
      const errorResponse = formatAuthErrorResponse(authError);
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

    logger.info(`User authenticated successfully: ${userInfo.email}`, { 
      isSlackAuth, 
      slackUserId: slackContext?.user_id,
      slackTeamId: slackContext?.team_id
    });

    // Store tokens associated with Slack user context for future use
    if (isSlackAuth && slackContext?.user_id && slackContext?.team_id) {
      try {
        logger.info('Processing OAuth callback for Slack user', {
          teamId: slackContext.team_id,
          userId: slackContext.user_id,
          hasTokens: !!tokens.access_token
        });
        
        const sessionService = getService('sessionService');
        if (sessionService) {
          // Create a session ID that matches the Slack interface format
          // Use 'main' suffix to match the default Slack session creation
          const slackSessionId = `slack_${slackContext.team_id}_${slackContext.user_id}_main`;
          
          logger.info('Creating/retrieving session for OAuth token storage', {
            sessionId: slackSessionId,
            teamId: slackContext.team_id,
            userId: slackContext.user_id
          });
          
          // Get or create session
          const session = (sessionService as any).getOrCreateSession(slackSessionId, slackContext.user_id);
          
          logger.info('Session retrieved for OAuth token storage', {
            sessionId: slackSessionId,
            sessionExists: !!session,
            hasOAuthTokens: !!session?.oauthTokens
          });
          
          // Store OAuth tokens in the session
          const tokensStored = (sessionService as any).storeOAuthTokens(slackSessionId, {
            google: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_in: tokens.expires_in,
              token_type: tokens.token_type,
              scope: tokens.scope,
              expiry_date: tokens.expiry_date
            },
            slack: {
              team_id: slackContext.team_id,
              user_id: slackContext.user_id
            }
          });

          if (tokensStored) {
            logger.info('✅ Successfully stored OAuth tokens for Slack user', {
              sessionId: slackSessionId,
              teamId: slackContext.team_id,
              userId: slackContext.user_id,
              tokenDetails: {
                hasAccessToken: !!tokens.access_token,
                hasRefreshToken: !!tokens.refresh_token,
                expiresIn: tokens.expires_in,
                scope: tokens.scope
              }
            });
            
            // Also store tokens in additional session variations to ensure they can be found
            // regardless of conversation context (channel, thread, etc.)
            const additionalSessionIds = [
              `slack_${slackContext.team_id}_${slackContext.user_id}_channel_${slackContext.channel_id}`,
              `slack_${slackContext.team_id}_${slackContext.user_id}_thread_${Date.now()}`,
              `slack_${slackContext.team_id}_${slackContext.user_id}_fallback_${Date.now()}`
            ];
            
            for (const additionalSessionId of additionalSessionIds) {
              try {
                // Create the additional session
                (sessionService as any).getOrCreateSession(additionalSessionId, slackContext.user_id);
                
                // Store the same OAuth tokens
                const additionalTokensStored = (sessionService as any).storeOAuthTokens(additionalSessionId, {
                  google: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_in: tokens.expires_in,
                    token_type: tokens.token_type,
                    scope: tokens.scope,
                    expiry_date: tokens.expiry_date
                  },
                  slack: {
                    team_id: slackContext.team_id,
                    user_id: slackContext.user_id
                  }
                });
                
                if (additionalTokensStored) {
                  logger.debug('✅ Stored OAuth tokens in additional session', { 
                    additionalSessionId,
                    teamId: slackContext.team_id,
                    userId: slackContext.user_id
                  });
                }
              } catch (additionalError) {
                logger.debug('Could not store tokens in additional session (non-critical)', { 
                  additionalSessionId,
                  error: additionalError
                });
              }
            }
          } else {
            logger.warn('❌ Failed to store OAuth tokens for Slack user', {
              sessionId: slackSessionId,
              teamId: slackContext.team_id,
              userId: slackContext.user_id
            });
          }
        } else {
          logger.error('SessionService not available for OAuth token storage');
        }
      } catch (error) {
        logger.error('Error storing OAuth tokens for Slack user', {
          error,
          teamId: slackContext.team_id,
          userId: slackContext.user_id
        });
      }
    } else {
      logger.info('OAuth callback not for Slack user or missing context', {
        isSlackAuth,
        hasUserId: !!slackContext?.user_id,
        hasTeamId: !!slackContext?.team_id,
        slackContext
      });
    }

    if (isSlackAuth) {
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
            </ul>
            <div style="background: #f0f8ff; border: 1px solid #0066cc; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #0066cc; margin-top: 0;">🔄 Next Steps</h3>
              <p style="margin: 10px 0;"><strong>1.</strong> Close this tab and return to Slack</p>
              <p style="margin: 10px 0;"><strong>2.</strong> Try your email request again</p>
              <p style="margin: 10px 0;"><strong>3.</strong> The AI Assistant will now have access to your Gmail</p>
            </div>
            <p style="margin-top: 40px; color: #666; font-style: italic;">
              You can close this tab and return to Slack to start using email features!
            </p>
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
    logger.error('OAuth callback processing error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      query: req.query
    });
    
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
      return res.status(500).send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Authentication Error</h1>
            <p>Sorry, there was an unexpected error during authentication.</p>
            <p>Please try again from Slack or contact support if the issue persists.</p>
            <p style="margin-top: 40px; color: #666;">You can close this tab and return to Slack.</p>
          </body>
        </html>
      `);
    }
    
    const authError = error instanceof AuthenticationError 
      ? error 
      : handleOAuthError('token_exchange', error);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', authRateLimit, validateTokenRefresh, async (req: Request, res: Response) => {
  try {
    const { refresh_token }: TokenRefreshRequest = req.body;

    if (!refresh_token || typeof refresh_token !== 'string') {
      const authError = new AuthenticationError(
        'MISSING_TOKEN' as any,
        'Missing or invalid refresh token',
        400
      );
      const errorResponse = formatAuthErrorResponse(authError);
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

    logger.info(`Token refreshed successfully for user: ${userInfo.email}`);

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
    logger.error('Token refresh error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : handleOAuthError('token_refresh', error);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 401).json(errorResponse);
  }
});

/**
 * POST /auth/logout
 * Revoke tokens and logout user
 */
router.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
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
        logger.info('User tokens revoked successfully', { 
          userId: req.user?.userId,
          everywhere 
        });
      } catch (revokeError) {
        // Log the error but don't fail the logout
        logger.warn('Token revocation failed, but continuing with logout', { 
          error: revokeError,
          userId: req.user?.userId 
        });
      }
    }

    return res.json({
      success: true,
      message: everywhere ? 'Logged out from all devices successfully' : 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : new AuthenticationError('UNKNOWN_ERROR' as any, 'Logout failed', 500);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * GET /auth/validate
 * Validate JWT token
 */
router.get('/validate', (req: Request, res: Response) => {
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
    logger.error('Token validation error:', error);
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
router.post('/exchange-mobile-tokens', authRateLimit, validateMobileTokenExchange, async (req: Request, res: Response) => {
  try {
    const { access_token, platform }: {
      access_token: string;
      platform: string;
    } = req.body;

    if (!access_token || typeof access_token !== 'string') {
      const authError = new AuthenticationError(
        'MISSING_TOKEN' as any,
        'Missing or invalid access token',
        400
      );
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(400).json(errorResponse);
    }

    // Validate the access token with Google
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    
    const tokenValidation = await authService.validateGoogleToken(access_token);
    if (!tokenValidation.valid) {
      const authError = new AuthenticationError(
        'INVALID_TOKEN' as any,
        'Invalid access token',
        401
      );
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(401).json(errorResponse);
    }

    // Get user info from Google
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(access_token);
    
    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    logger.info(`Mobile token exchange successful for user: ${userInfo.email}`, {
      platform,
      userId: userInfo.sub
    });

    return res.json({
      success: true,
      user: userInfo,
      jwt: jwtToken,
      platform,
      message: 'Mobile authentication successful'
    });

  } catch (error) {
    logger.error('Mobile token exchange error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : handleOAuthError('token_exchange', error);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

export default router;