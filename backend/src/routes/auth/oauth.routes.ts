import express, { Request, Response } from 'express';
import logger from '../../utils/logger';
import { createLogContext } from '../../utils/log-context';
import { z } from 'zod';
import { GoogleOAuthCallbackSchema } from '../../schemas/auth.schemas';
import { validateRequest } from '../../middleware/validation.middleware';
import { serviceManager } from '../../services/service-locator-compat';
import { DomainServiceResolver } from '../../services/domain/service-resolver-compat';
import { AuthService } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';
import {
  GoogleTokens,
  GoogleUserInfo,
  AuthSuccessResponse,
  OAuthCallbackQuery
} from '../../types/auth.types';
import {
  AppError,
  ErrorFactory
} from '../../utils/app-error';
import { authRateLimit } from '../../middleware/rate-limiting.middleware';
import { OAUTH_SCOPES } from '../../constants/oauth-scopes';

const router = express.Router();

// Query schemas
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

    // Use centralized scope management
    const scopes = [...OAUTH_SCOPES.GOOGLE.SLACK_INTEGRATION];

    const authService = serviceManager.getService<AuthService>('authService');
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
      metadata: { user_id, team_id, scopesUsed: 'SLACK_INTEGRATION' }
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
    // Use centralized scope management
    const scopes = [...OAUTH_SCOPES.GOOGLE.FULL_ACCESS];

    const authService = serviceManager.getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }

    const authUrl = authService.generateAuthUrl(scopes);

    const logContext = createLogContext(req, { operation: 'google_oauth_init' });
    logger.info('Generated Google OAuth URL for user authentication', {
      ...logContext,
      metadata: { scopesUsed: 'FULL_ACCESS' }
    });

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

    const authService = serviceManager.getService<AuthService>('authService');
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
    let isSlackAuth = false;

    logger.info('OAuth callback received', {
      hasCode: !!code,
      hasState: !!state,
      statePreview: state ? state.substring(0, 50) + '...' : 'none'
    });

    if (state && typeof state === 'string') {
      try {
        // Check if this is a signed state from SlackOAuthService (format: base64.signature)
        if (state.includes('.')) {
          const parts = state.split('.');
          if (parts.length === 2 && parts[0]) {
            // This is a signed state from SlackOAuthService
            const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
            slackContext = {
              userId: payload.userId,
              teamId: payload.teamId,
              source: 'slack'
            };
            isSlackAuth = true;
            logger.info('Parsed Slack OAuth signed state', {
              userId: payload.userId,
              teamId: payload.teamId,
              fullPayload: payload,
              operation: 'slack_state_parsed'
            });
          }
        } else {
          // Try parsing as plain JSON (legacy format)
          slackContext = JSON.parse(state);
          isSlackAuth = slackContext?.source === 'slack';
          logger.info('Parsed plain JSON state', { slackContext });
        }
      } catch (e) {
        // State parsing failed, continue without Slack context
        logger.warn('Failed to parse OAuth state', { state: state.substring(0, 50) + '...', error: (e as Error).message });
      }
    }

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
    const authService = serviceManager.getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }

    logger.info('Starting token exchange', {
      hasCode: !!code,
      codeLength: code?.length,
      isSlackAuth
    });

    const tokens: GoogleTokens = await authService.exchangeCodeForTokens(code);

    logger.info('Token exchange successful', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenLength: tokens.access_token?.length,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });

    // Get user info
    logger.info('Starting Google user info request', {
      tokenLength: tokens.access_token?.length,
      tokenPrefix: tokens.access_token?.substring(0, 20) + '...'
    });

    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(tokens.access_token);

    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    // Handle both camelCase and snake_case field names for Slack context
    const teamId = slackContext?.teamId || slackContext?.team_id;
    const userId_slack = slackContext?.userId || slackContext?.user_id;

    // Store tokens associated with Slack user context for future use
    const hasValidSlackIds = (slackContext?.user_id || slackContext?.userId) &&
                              (slackContext?.team_id || slackContext?.teamId) &&
                              teamId && userId_slack;

    logger.info('OAuth token storage validation check', {
      isSlackAuth,
      hasValidSlackIds,
      teamId,
      userId_slack,
      slackContext_userId: slackContext?.userId,
      slackContext_user_id: slackContext?.user_id,
      slackContext_teamId: slackContext?.teamId,
      slackContext_team_id: slackContext?.team_id,
      operation: 'token_storage_validation'
    });

    if (isSlackAuth && hasValidSlackIds) {
      try {
        const tokenStorageService = serviceManager.getService<TokenStorageService>('tokenStorageService');
        if (tokenStorageService) {
          // Store OAuth tokens for the Slack user
          const userId = `${teamId}:${userId_slack}`;

          logger.info('Attempting to store OAuth tokens for Slack user', {
            userId,
            teamId,
            userId_slack,
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            operation: 'token_storage_attempt'
          });

          await tokenStorageService.storeUserTokens(userId, {
            google: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || undefined,
              expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + ((tokens.expires_in || 3600) * 1000)),
              token_type: tokens.token_type,
              scope: tokens.scope || undefined
            },
            slack: {
              access_token: undefined,
              team_id: teamId,
              user_id: userId_slack
            }
          });

          logger.info('Successfully stored OAuth tokens for Slack user', {
            userId,
            operation: 'token_storage_success'
          });

        } else {
          logger.error('TokenStorageService not available for storing OAuth tokens', {
            teamId,
            userId_slack,
            operation: 'token_storage_service_missing'
          });
        }
      } catch (error) {
        logger.error('Failed to store OAuth tokens for Slack user', error as Error, {
          teamId,
          userId_slack,
          operation: 'token_storage_error',
          metadata: {
            hasTokenStorageService: !!serviceManager.getService('tokenStorageService'),
            errorMessage: (error as Error).message,
            errorStack: (error as Error).stack
          }
        });
      }
    } else {
      logger.info('Skipping token storage - not a Slack auth or missing Slack IDs', {
        isSlackAuth,
        hasValidSlackIds,
        slackContext: slackContext ? 'present' : 'missing',
        operation: 'token_storage_skipped'
      });
    }

    if (isSlackAuth) {
      // Check if this was a reconnect from auth dashboard
      const returnTo = slackContext?.returnTo;
      const wasAuthDashboard = returnTo === 'auth_dashboard';

      // Send success notification to Slack
      try {
        const slackService = DomainServiceResolver.getSlackService();
        if (slackService && userId_slack) {
          await slackService.sendMessage(userId_slack, {
            channel: userId_slack,
            text: wasAuthDashboard
              ? '✅ Successfully reconnected! Your Google connection has been refreshed.'
              : '✅ Successfully connected! You can now use email and calendar features.',
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
          });
        }
      } catch (error) {
        logger.error('Failed to send Slack notification', error as Error, {
          operation: 'slack_notification_error',
          metadata: { userId: userId_slack }
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

export default router;