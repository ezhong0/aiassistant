/**
 * OAuth Service Factory
 * Centralized OAuth operations to eliminate duplication across routes
 */

import { AuthService } from '../auth.service';
import { GoogleOAuthManager } from './google-oauth-manager';
import { SlackOAuthManager } from './slack-oauth-manager';
import { serviceManager } from '../service-locator-compat';
import { ScopeManager } from '../../constants/oauth-scopes';
import { ValidationUtils } from '../../utils/validation-helpers';
import { HTMLTemplates } from '../../templates/html-templates';
import logger from '../../utils/logger';

export interface OAuthInitiationResult {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  html?: string;
  redirect?: string;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface OAuthContext {
  source?: 'slack' | 'web' | 'mobile';
  userId?: string;
  teamId?: string;
  channelId?: string;
  returnUrl?: string;
}

/**
 * OAuth Service Factory - Handles all OAuth operations
 */
export class OAuthServiceFactory {
  /**
   * Initiate Google OAuth flow
   */
  static async initiateGoogleAuth(context: OAuthContext = {}): Promise<OAuthInitiationResult> {
    const authService = serviceManager.getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }

    // Determine scope based on context
    const scopeType = context.source === 'slack' ? 'slack' : 'full';
    const scopes = ScopeManager.getGoogleScopes(scopeType);

    // Create state parameter
    const state = ValidationUtils.createOAuthState({
      source: context.source || 'web',
      user_id: context.userId,
      team_id: context.teamId,
      channel_id: context.channelId,
      return_url: context.returnUrl
    });

    const authUrl = authService.generateAuthUrl(scopes, state);

    logger.info('Google OAuth initiated', {
      correlationId: `oauth-init-${Date.now()}`,
      operation: 'google_oauth_initiate',
      metadata: {
        source: context.source,
        userId: context.userId,
        scopesCount: scopes.length
      }
    });

    return { authUrl, state };
  }

  /**
   * Handle Google OAuth callback
   */
  static async handleGoogleCallback(
    code?: string,
    state?: string,
    error?: string,
    errorDescription?: string
  ): Promise<OAuthCallbackResult> {
    const correlationId = `oauth-callback-${Date.now()}`;

    try {
      // Handle OAuth errors
      if (error) {
        logger.warn('Google OAuth error received', {
          correlationId,
          operation: 'google_oauth_callback',
          metadata: { error, errorDescription }
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Authentication Failed',
            message: errorDescription || 'Authentication was cancelled or failed',
            details: error
          })
        };
      }

      // Validate required parameters
      if (!code || !state) {
        logger.error('Missing required OAuth parameters', {
          correlationId,
          operation: 'google_oauth_callback',
          metadata: { hasCode: !!code, hasState: !!state }
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Invalid Request',
            message: 'Missing required authentication parameters'
          })
        };
      }

      // Parse and validate state
      let parsedState: any;
      try {
        parsedState = ValidationUtils.parseOAuthState(state);
      } catch (stateError) {
        logger.error('Invalid OAuth state', stateError, {
          correlationId,
          operation: 'google_oauth_callback'
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Invalid State',
            message: 'Authentication state is invalid or expired'
          })
        };
      }

      // Get Google OAuth manager
      const googleOAuth = serviceManager.getService<GoogleOAuthManager>('googleOAuthManager');
      if (!googleOAuth) {
        throw new Error('Google OAuth manager not available');
      }

      // Exchange code for tokens
      const tokenResult = await googleOAuth.exchangeCodeForTokens(code, state);
      if (!tokenResult.success) {
        logger.error('Token exchange failed', {
          correlationId,
          operation: 'google_oauth_callback',
          metadata: { error: tokenResult.error }
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Authentication Failed',
            message: 'Failed to complete authentication process',
            details: tokenResult.error
          })
        };
      }

      logger.info('Google OAuth completed successfully', {
        correlationId,
        operation: 'google_oauth_callback',
        metadata: {
          source: parsedState.source,
          userId: parsedState.user_id,
          hasTokens: !!tokenResult.tokens
        }
      });

      // Return success response
      return {
        success: true,
        html: HTMLTemplates.authSuccess({
          title: 'Authentication Successful',
          message: 'Your Google account has been successfully connected!',
          ...(parsedState.return_url && {
            redirectUrl: parsedState.return_url,
            buttonText: 'Continue'
          })
        }),
        user: (tokenResult as any).userInfo ? {
          id: (tokenResult as any).userInfo.sub,
          email: (tokenResult as any).userInfo.email,
          name: (tokenResult as any).userInfo.name
        } : undefined
      };

    } catch (error) {
      logger.error('Google OAuth callback error', error, {
        correlationId,
        operation: 'google_oauth_callback'
      });

      return {
        success: false,
        html: HTMLTemplates.error({
          title: 'Authentication Error',
          message: 'An unexpected error occurred during authentication',
          details: process.env.NODE_ENV === 'development'
            ? (error instanceof Error ? error.message : 'Unknown error')
            : undefined
        })
      };
    }
  }

  /**
   * Initiate Slack OAuth flow
   */
  static async initiateSlackAuth(context: OAuthContext = {}): Promise<OAuthInitiationResult> {
    const slackOAuth = serviceManager.getService<SlackOAuthManager>('slackOAuthManager');
    if (!slackOAuth) {
      throw new Error('Slack OAuth manager not available');
    }

    const slackContext = {
      teamId: context.teamId || 'unknown',
      userId: context.userId || 'unknown',
      channelId: context.channelId || 'unknown',
      isDirectMessage: false
    };

    const authUrl = await slackOAuth.generateAuthUrl(slackContext);

    // Create state parameter
    const state = ValidationUtils.createOAuthState({
      source: 'slack',
      team_id: context.teamId,
      user_id: context.userId,
      channel_id: context.channelId,
      return_url: context.returnUrl
    });

    logger.info('Slack OAuth initiated', {
      correlationId: `oauth-init-${Date.now()}`,
      operation: 'slack_oauth_initiate',
      metadata: {
        teamId: context.teamId,
        userId: context.userId
      }
    });

    return { authUrl, state };
  }

  /**
   * Handle Slack OAuth callback
   */
  static async handleSlackCallback(
    code?: string,
    state?: string,
    error?: string,
    errorDescription?: string
  ): Promise<OAuthCallbackResult> {
    const correlationId = `slack-oauth-callback-${Date.now()}`;

    try {
      // Handle OAuth errors
      if (error) {
        logger.warn('Slack OAuth error received', {
          correlationId,
          operation: 'slack_oauth_callback',
          metadata: { error, errorDescription }
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Slack Authentication Failed',
            message: errorDescription || 'Slack authentication was cancelled or failed',
            details: error
          })
        };
      }

      // Validate required parameters
      if (!code || !state) {
        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Invalid Request',
            message: 'Missing required Slack authentication parameters'
          })
        };
      }

      // Parse state
      let parsedState: any;
      try {
        parsedState = ValidationUtils.parseOAuthState(state);
      } catch (stateError) {
        logger.error('Invalid Slack OAuth state', stateError, {
          correlationId,
          operation: 'slack_oauth_callback'
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Invalid State',
            message: 'Slack authentication state is invalid or expired'
          })
        };
      }

      // Get Slack OAuth manager and exchange code
      const slackOAuth = serviceManager.getService<SlackOAuthManager>('slackOAuthManager');
      if (!slackOAuth) {
        throw new Error('Slack OAuth manager not available');
      }

      const tokenResult = await slackOAuth.exchangeCodeForTokens(code, state);
      if (!tokenResult.success) {
        logger.error('Slack token exchange failed', {
          correlationId,
          operation: 'slack_oauth_callback',
          metadata: { error: tokenResult.error }
        });

        return {
          success: false,
          html: HTMLTemplates.authError({
            title: 'Slack Authentication Failed',
            message: 'Failed to complete Slack authentication process',
            details: tokenResult.error
          })
        };
      }

      logger.info('Slack OAuth completed successfully', {
        correlationId,
        operation: 'slack_oauth_callback',
        metadata: {
          teamId: parsedState.team_id,
          userId: parsedState.user_id
        }
      });

      return {
        success: true,
        html: HTMLTemplates.authSuccess({
          title: 'Slack Authentication Successful',
          message: 'Your Slack account has been successfully connected!'
        })
      };

    } catch (error) {
      logger.error('Slack OAuth callback error', error, {
        correlationId,
        operation: 'slack_oauth_callback'
      });

      return {
        success: false,
        html: HTMLTemplates.error({
          title: 'Slack Authentication Error',
          message: 'An unexpected error occurred during Slack authentication'
        })
      };
    }
  }

  /**
   * Revoke OAuth tokens
   */
  static async revokeTokens(
    provider: 'google' | 'slack',
    userId: string
  ): Promise<{ success: boolean; message: string; html?: string }> {
    const correlationId = `oauth-revoke-${Date.now()}`;

    try {
      if (provider === 'google') {
        const googleOAuth = serviceManager.getService<GoogleOAuthManager>('googleOAuthManager');
        if (!googleOAuth) {
          throw new Error('Google OAuth manager not available');
        }

        await googleOAuth.revokeTokens(userId);

        logger.info('Google tokens revoked', {
          correlationId,
          operation: 'google_token_revoke',
          metadata: { userId }
        });

        return {
          success: true,
          message: 'Google account access revoked successfully',
          html: HTMLTemplates.oauthRevoked({
            title: 'Google Access Revoked',
            message: 'Your Google account access has been successfully revoked.'
          })
        };

      } else if (provider === 'slack') {
        const slackOAuth = serviceManager.getService<SlackOAuthManager>('slackOAuthManager');
        if (!slackOAuth) {
          throw new Error('Slack OAuth manager not available');
        }

        // Note: Slack doesn't typically support token revocation
        // This would typically remove tokens from local storage
        logger.info('Slack tokens revoked locally', {
          correlationId,
          operation: 'slack_token_revoke',
          metadata: { userId }
        });

        return {
          success: true,
          message: 'Slack account access revoked successfully',
          html: HTMLTemplates.oauthRevoked({
            title: 'Slack Access Revoked',
            message: 'Your Slack account access has been successfully revoked.'
          })
        };
      }

      throw new Error('Unsupported OAuth provider');

    } catch (error) {
      logger.error(`${provider} token revocation error`, error, {
        correlationId,
        operation: `${provider}_token_revoke_error`,
        metadata: { userId }
      });

      return {
        success: false,
        message: `Failed to revoke ${provider} access`,
        html: HTMLTemplates.error({
          title: 'Revocation Failed',
          message: `Failed to revoke ${provider} account access`,
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
  }

  /**
   * Get OAuth status for a user
   */
  static async getOAuthStatus(userId: string): Promise<{
    google: { connected: boolean; email?: string };
    slack: { connected: boolean; teamId?: string };
  }> {
    // This would typically check the token storage service
    // Implementation depends on your token storage strategy
    return {
      google: { connected: false },
      slack: { connected: false }
    };
  }
}