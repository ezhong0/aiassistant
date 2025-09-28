import { BaseService } from '../base-service';
import { AuthService } from '../auth.service';
import { TokenManager } from '../token-manager';
import { OAuthStateService } from '../oauth-state.service';
import { serviceManager } from '../service-manager';
import { GoogleTokens } from '../../types/auth.types';
import { SlackContext } from '../../types/slack/slack.types';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleOAuthResult {
  success: boolean;
  tokens?: GoogleTokens;
  error?: string;
  authUrl?: string;
}

export interface GoogleOAuthValidationResult {
  isValid: boolean;
  needsReauth: boolean;
  error?: string;
  missingScopes?: string[];
}

/**
 * GoogleOAuthManager - Shared OAuth manager for all Google services
 * 
 * Handles OAuth flow, token validation, and authorization management
 * for Google integrations (Gmail, Calendar, Contacts). This service
 * provides a unified interface for all Google domain services.
 */
export class GoogleOAuthManager extends BaseService {
  private config: GoogleOAuthConfig;
  private authService: AuthService | null = null;
  private tokenManager: TokenManager | null = null;
  private oauthStateService: OAuthStateService | null = null;

  constructor(config: GoogleOAuthConfig) {
    super('GoogleOAuthManager');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing GoogleOAuthManager...');

      // Initialize service dependencies
      await this.initializeDependencies();

      this.logInfo('GoogleOAuthManager initialized successfully', {
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        scopes: this.config.scopes,
        hasAuthService: !!this.authService,
        hasTokenManager: !!this.tokenManager
      });
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('GoogleOAuthManager destroyed successfully');
    } catch (error) {
      this.handleError(error, 'onDestroy');
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    this.authService = serviceManager.getService('authService') as AuthService;
    this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;
    this.oauthStateService = serviceManager.getService('oauthStateService') as OAuthStateService;

    if (!this.authService) {
      throw new Error('AuthService not available');
    }
    if (!this.tokenManager) {
      throw new Error('TokenManager not available');
    }
  }

  /**
   * Generate OAuth authorization URL for Google services
   */
  async generateAuthUrl(context: SlackContext, scopes?: string[]): Promise<string> {
    try {
      this.logInfo('Starting Google OAuth URL generation', {
        userId: context.userId,
        teamId: context.teamId,
        channelId: context.channelId,
        scopes: scopes || this.config.scopes
      });

      const scopesToUse = scopes || this.config.scopes;
      const state = this.buildSignedState(context);

      this.logInfo('Google OAuth state built', {
        userId: context.userId,
        state: state.substring(0, 50) + '...'
      });

      const authUrl = this.authService!.generateAuthUrl(scopesToUse, state);

      this.logInfo('Google OAuth URL generated successfully', {
        userId: context.userId,
        scopes: scopesToUse,
        state: state.substring(0, 50) + '...',
        authUrl: authUrl.substring(0, 100) + '...'
      });

      return authUrl;
    } catch (error) {
      this.logError('Failed to generate Google OAuth URL', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for Google tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<GoogleOAuthResult> {
    try {
      // Validate state parameter
      const context = this.oauthStateService
        ? (await this.oauthStateService.validateAndConsume(state))
        : this.validateSignedState(state);
      
      if (!context) {
        return {
          success: false,
          error: 'Invalid state parameter'
        };
      }

      // Exchange code for tokens using AuthService
      const tokens = await this.authService!.exchangeCodeForTokens(code);

      // Store tokens using TokenManager
      if (this.tokenManager && context.userId) {
        const userId = `${context.teamId}:${context.userId}`;
        await this.tokenManager.storeTokens(userId, {
          google: tokens
        });
      }

      this.logInfo('Google OAuth tokens exchanged successfully', {
        userId: context.userId,
        hasRefreshToken: !!tokens.refresh_token,
        scope: tokens.scope
      });

      return {
        success: true,
        tokens
      };

    } catch (error) {
      this.logError('Failed to exchange code for Google tokens', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * Get valid Google access token for a user
   */
  async getValidTokens(userId: string): Promise<string | null> {
    try {
      if (!this.tokenManager) {
        this.logError('TokenManager not available');
        return null;
      }

      // Extract teamId and userId from the combined userId
      const [teamId, slackUserId] = userId.split(':');
      if (!teamId || !slackUserId) {
        this.logError('Invalid userId format', { userId });
        return null;
      }

      const tokens = await this.tokenManager.getValidTokens(teamId, slackUserId);
      return tokens;

    } catch (error) {
      this.logError('Failed to get valid Google tokens', error);
      return null;
    }
  }

  /**
   * Validate user's Google OAuth tokens
   */
  async validateTokens(userId: string, requiredScopes?: string[]): Promise<GoogleOAuthValidationResult> {
    try {
      if (!this.tokenManager) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'TokenManager not available'
        };
      }

      // Extract teamId and userId from the combined userId
      const [teamId, slackUserId] = userId.split(':');
      if (!teamId || !slackUserId) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'Invalid userId format'
        };
      }

      // Check if user has valid tokens
      const hasValidTokens = await this.tokenManager.hasValidOAuthTokens(teamId, slackUserId);
      if (!hasValidTokens) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'No valid tokens found'
        };
      }

      return {
        isValid: true,
        needsReauth: false
      };

    } catch (error) {
      this.logError('Failed to validate Google tokens', error);
      return {
        isValid: false,
        needsReauth: true,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Check if OAuth is required for a user
   */
  async requiresOAuth(userId: string, requiredScopes?: string[]): Promise<boolean> {
    const validation = await this.validateTokens(userId, requiredScopes);
    return !validation.isValid;
  }

  /**
   * Get OAuth status for a user
   */
  async getOAuthStatus(userId: string): Promise<{
    hasTokens: boolean;
    isValid: boolean;
    scopes?: string[];
    expiresAt?: Date;
  }> {
    try {
      if (!this.tokenManager) {
        return { hasTokens: false, isValid: false };
      }

      // Extract teamId and userId from the combined userId
      const [teamId, slackUserId] = userId.split(':');
      if (!teamId || !slackUserId) {
        return { hasTokens: false, isValid: false };
      }

      const hasValidTokens = await this.tokenManager.hasValidOAuthTokens(teamId, slackUserId);
      const validation = await this.validateTokens(userId);

      return {
        hasTokens: hasValidTokens,
        isValid: validation.isValid,
        scopes: undefined, // Scope information not available in current token format
        expiresAt: undefined // Expiration not available in current token format
      };

    } catch (error) {
      this.logError('Failed to get Google OAuth status', error);
      return { hasTokens: false, isValid: false };
    }
  }

  /**
   * Refresh Google tokens for a user
   */
  async refreshTokens(userId: string): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        return false;
      }

      // Extract teamId and userId from the combined userId
      const [teamId, slackUserId] = userId.split(':');
      if (!teamId || !slackUserId) {
        return false;
      }

      const refreshedTokens = await this.tokenManager.refreshTokens(teamId, slackUserId);
      return !!refreshedTokens;

    } catch (error) {
      this.logError('Failed to refresh Google tokens', error);
      return false;
    }
  }

  /**
   * Revoke Google tokens for a user
   */
  async revokeTokens(userId: string): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        return false;
      }

      // Extract teamId and userId from the combined userId
      const [teamId, slackUserId] = userId.split(':');
      if (!teamId || !slackUserId) {
        return false;
      }

      // Get tokens before revoking
      const tokens = await this.tokenManager.getValidTokens(teamId, slackUserId);
      if (tokens && this.authService) {
        try {
          await this.authService.revokeGoogleTokens(tokens);
        } catch (error) {
          this.logWarn('Failed to revoke tokens with Google', { error: (error as Error).message });
          // Continue with local removal even if remote revocation fails
        }
      }

      // Remove tokens locally
      await this.tokenManager.removeTokens(teamId, slackUserId);

      this.logInfo('Google OAuth tokens revoked', { userId });
      return true;

    } catch (error) {
      this.logError('Failed to revoke Google tokens', error);
      return false;
    }
  }

  /**
   * Generate state parameter for OAuth flow
   */
  private buildSignedState(context: SlackContext): string {
    if (this.oauthStateService) {
      return this.oauthStateService.issueState(context);
    }
    // Fallback to simple state generation
    return Buffer.from(JSON.stringify({
      userId: context.userId,
      teamId: context.teamId,
      channelId: context.channelId,
      ts: Date.now()
    })).toString('base64');
  }

  /**
   * Validate and parse state parameter (fallback)
   */
  private validateSignedState(state: string): SlackContext | null {
    try {
      const payload = Buffer.from(state, 'base64').toString('utf8');
      const obj = JSON.parse(payload) as { userId: string; teamId: string; channelId: string; ts: number };
      
      // Check if state is not too old (10 minutes)
      if (Date.now() - obj.ts > 10 * 60 * 1000) {
        this.logWarn('OAuth state expired');
        return null;
      }

      return {
        userId: obj.userId,
        channelId: obj.channelId,
        teamId: obj.teamId,
        isDirectMessage: true
      };
    } catch (error) {
      this.logError('Failed to validate signed state', error);
      return null;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): any {
    return {
      healthy: this.isReady(),
      hasAuthService: !!this.authService,
      hasTokenManager: !!this.tokenManager,
      hasOAuthStateService: !!this.oauthStateService
    };
  }
}
