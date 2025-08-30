import express, { Request, Response } from 'express';
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
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error initiating Slack OAuth flow:', error);
    res.status(500).send(`
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
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating Google auth URL:', error);
    res.status(500).json({
      error: 'Failed to initiate authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error in /auth/init:', error);
    res.status(500).send(`
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
        const sessionService = getService('sessionService');
        if (sessionService) {
          // Create a session ID for the Slack user
          const slackSessionId = `slack_${slackContext.team_id}_${slackContext.user_id}_oauth`;
          
          // Get or create session
          const session = (sessionService as any).getOrCreateSession(slackSessionId, slackContext.user_id);
          
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
            logger.info('Successfully stored OAuth tokens for Slack user', {
              sessionId: slackSessionId,
              teamId: slackContext.team_id,
              userId: slackContext.user_id
            });
          } else {
            logger.warn('Failed to store OAuth tokens for Slack user', {
              sessionId: slackSessionId,
              teamId: slackContext.team_id,
              userId: slackContext.user_id
            });
          }
        }
      } catch (error) {
        logger.error('Error storing OAuth tokens for Slack user', {
          error,
          teamId: slackContext.team_id,
          userId: slackContext.user_id
        });
      }
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
    logger.error('OAuth callback processing error:', error);
    
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