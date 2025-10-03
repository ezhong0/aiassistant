/**
 * OAuth Service Factory
 * Centralized OAuth operations to eliminate duplication across routes
 * 
 * Uses factory pattern with DI container - no module-level state
 */

import { AuthService } from '../auth.service';
import { GoogleOAuthManager } from './google-oauth-manager';
import type { AppContainer } from '../../di';
import { ScopeManager } from '../../constants/oauth-scopes';
import { ValidationUtils } from '../../utils/validation-helpers';
import { HTMLTemplates } from '../../templates/html-templates';
import logger from '../../utils/logger';
import { OAuthContext } from '../../types/oauth.types';

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

/**
 * OAuth Service Factory - Handles all OAuth operations
 * Created via factory pattern with dependency injection
 */
export class OAuthServiceFactory {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthManager: GoogleOAuthManager
  ) {}

  /**
   * Initiate Google OAuth flow
   */
  async initiateGoogleAuth(context: OAuthContext = {}): Promise<OAuthInitiationResult> {

    // Use full scopes for Google OAuth
    const scopes = ScopeManager.getGoogleScopes('full');

    // Create state parameter
    const state = ValidationUtils.createOAuthState({
      source: context.source || 'web',
      user_id: context.userId,
      team_id: context.teamId,
      channel_id: context.channelId,
      return_url: context.returnUrl
    });

    const authUrl = this.authService.generateAuthUrl(scopes, state);

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
  async handleGoogleCallback(
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

      // Use injected Google OAuth manager
      const googleOAuth = this.googleOAuthManager;

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
   * Revoke OAuth tokens
   */
  async revokeTokens(
    provider: 'google',
    userId: string
  ): Promise<{ success: boolean; message: string; html?: string }> {
    const correlationId = `oauth-revoke-${Date.now()}`;

    try {
      const googleOAuth = this.googleOAuthManager;

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
  async getOAuthStatus(userId: string): Promise<{
    google: { connected: boolean; email?: string };
  }> {
    // This would typically check the token storage service
    // Implementation depends on your token storage strategy
    return {
      google: { connected: false }
    };
  }
}

/**
 * Create OAuth Service Factory with dependency injection
 * @param container DI container with required services
 */
export function createOAuthServiceFactory(container: AppContainer): OAuthServiceFactory {
  const authService = container.resolve('authService');
  const googleOAuthManager = container.resolve('googleOAuthManager');

  return new OAuthServiceFactory(authService, googleOAuthManager);
}