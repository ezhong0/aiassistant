import { BaseService } from '../base-service';
import { TokenManager } from '../token-manager';
import { OAuthStateService } from '../oauth-state.service';
import { SlackContext } from '../../types/slack/slack.types';

export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface SlackOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface SlackOAuthResult {
  success: boolean;
  tokens?: SlackOAuthTokens;
  error?: string;
  authUrl?: string;
}

export interface SlackOAuthValidationResult {
  isValid: boolean;
  needsReauth: boolean;
  error?: string;
  missingScopes?: string[];
}

/**
 * SlackOAuthManager - Shared OAuth manager for Slack services
 * 
 * Handles OAuth flow, token validation, and authorization management
 * for Slack integrations. This service provides a unified interface
 * for Slack domain services.
 */
export class SlackOAuthManager extends BaseService {
  // Store config as primitives (injected directly)
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];
  
  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    scopes: string[],
    private readonly tokenManager: TokenManager,
    private readonly oauthStateService: OAuthStateService
  ) {
    super('SlackOAuthManager');
    
    // Store primitives directly (no proxy access needed)
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.scopes = scopes;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackOAuthManager...');

      this.logInfo('SlackOAuthManager initialized successfully', {
        clientId: this.clientId,
        redirectUri: this.redirectUri,
        scopes: this.scopes
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
      this.logInfo('SlackOAuthManager destroyed successfully');
    } catch (error) {
      this.handleError(error, 'onDestroy');
    }
  }


  /**
   * Generate OAuth authorization URL for Slack
   */
  async generateAuthUrl(context: SlackContext, scopes?: string[]): Promise<string> {
    try {
      this.logInfo('Starting Slack OAuth URL generation', {
        userId: context.userId,
        teamId: context.teamId,
        channelId: context.channelId,
        scopes: scopes || this.scopes
      });

      const scopesToUse = scopes || this.scopes;
      const state = this.buildSignedState(context);

      this.logInfo('Slack OAuth state built', {
        userId: context.userId,
        state: state.substring(0, 50) + '...'
      });

      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: scopesToUse.join(','),
        response_type: 'code',
        state
      });

      const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

      this.logInfo('Slack OAuth URL generated successfully', {
        userId: context.userId,
        scopes: scopesToUse,
        state: state.substring(0, 50) + '...',
        authUrl: authUrl.substring(0, 100) + '...'
      });

      return authUrl;
    } catch (error) {
      this.logError('Failed to generate Slack OAuth URL', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for Slack tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<SlackOAuthResult> {
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

      // Exchange code for tokens
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      const data = await response.json();
      
      if (!(data as any).ok) {
        throw new Error(`Slack OAuth error: ${(data as any).error}`);
      }

      const tokens: SlackOAuthTokens = {
        access_token: (data as any).access_token,
        refresh_token: (data as any).refresh_token,
        expires_in: (data as any).expires_in,
        scope: (data as any).scope,
        token_type: (data as any).token_type
      };

      // Store tokens using TokenManager
      if (this.tokenManager && context.userId) {
        const userId = `${context.teamId}:${context.userId}`;
        await this.tokenManager.storeTokens(userId, {
          slack: {
            access_token: tokens.access_token,
            team_id: context.teamId,
            user_id: context.userId
          }
        });
      }

      this.logInfo('Slack OAuth tokens exchanged successfully', {
        userId: context.userId,
        hasRefreshToken: !!tokens.refresh_token,
        scope: tokens.scope
      });

      return {
        success: true,
        tokens
      };

    } catch (error) {
      this.logError('Failed to exchange code for Slack tokens', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * Get valid Slack access token for a user
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

      // For Slack, we need to get the bot token from the stored tokens
      const userTokens = await this.tokenManager.getUserTokens(userId);
      if (userTokens?.slackTokens?.access_token) {
        return userTokens.slackTokens.access_token;
      }

      return null;

    } catch (error) {
      this.logError('Failed to get valid Slack tokens', error);
      return null;
    }
  }

  /**
   * Validate user's Slack OAuth tokens
   */
  async validateTokens(userId: string, requiredScopes?: string[]): Promise<SlackOAuthValidationResult> {
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
      const userTokens = await this.tokenManager.getUserTokens(userId);
      if (!userTokens?.slackTokens?.access_token) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'No valid Slack tokens found'
        };
      }

      // Test the token by making a simple API call
      try {
        const response = await fetch('https://slack.com/api/auth.test', {
          headers: {
            'Authorization': `Bearer ${userTokens.slackTokens.access_token}`
          }
        });

        const data = await response.json() as any;
        if (!data.ok) {
          return {
            isValid: false,
            needsReauth: true,
            error: `Token validation failed: ${data.error}`
          };
        }

        return {
          isValid: true,
          needsReauth: false
        };

      } catch (error) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'Token validation failed'
        };
      }

    } catch (error) {
      this.logError('Failed to validate Slack tokens', error);
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

      const userTokens = await this.tokenManager.getUserTokens(userId);
      const hasTokens = !!userTokens?.slackTokens?.access_token;
      const validation = await this.validateTokens(userId);

      return {
        hasTokens,
        isValid: validation.isValid,
        scopes: userTokens?.slackTokens ? undefined : undefined, // Scope information not available in current token format
        expiresAt: undefined // Expiration not available in current token format
      };

    } catch (error) {
      this.logError('Failed to get Slack OAuth status', error);
      return { hasTokens: false, isValid: false };
    }
  }

  /**
   * Revoke Slack tokens for a user
   */
  async revokeTokens(userId: string): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        return false;
      }

      // Get tokens before revoking
      const userTokens = await this.tokenManager.getUserTokens(userId);
      if (userTokens?.slackTokens?.access_token) {
        try {
          // Revoke tokens with Slack
          await fetch('https://slack.com/api/auth.revoke', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userTokens.slackTokens.access_token}`
            }
          });
        } catch (error) {
          this.logWarn('Failed to revoke tokens with Slack', { error: (error as Error).message });
          // Continue with local removal even if remote revocation fails
        }
      }

      // Remove tokens locally
      await this.tokenManager.removeTokens(userId);

      this.logInfo('Slack OAuth tokens revoked', { userId });
      return true;

    } catch (error) {
      this.logError('Failed to revoke Slack tokens', error);
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
      hasTokenManager: !!this.tokenManager,
      hasOAuthStateService: !!this.oauthStateService
    };
  }
}
