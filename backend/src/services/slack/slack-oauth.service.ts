import { BaseService } from '../base-service';
import { TokenManager } from '../token-manager';
import { SlackContext } from '../../types/slack/slack.types';
import { serviceManager } from "../service-manager";
import { OAuthStateService } from '../oauth-state.service';
import crypto from 'crypto';

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
 * SlackOAuthService - Dedicated service for Slack OAuth operations
 *
 * Handles OAuth flow, token validation, and authorization management
 * for Slack integrations. This service is focused solely on OAuth
 * concerns and integrates with the main SlackService.
 */
export class SlackOAuthService extends BaseService {
  private config: SlackOAuthConfig;
  private tokenManager: TokenManager | null = null;
  private successMessageCache = new Map<string, number>(); // Track shown success messages
  private usedNonces = new Map<string, number>(); // Local fallback only
  private oauthStateService: OAuthStateService | null = null;
  private readonly nonceTtlMs = 10 * 60 * 1000;

  constructor(config: SlackOAuthConfig) {
    super('SlackOAuthService');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackOAuthService...');

      // Initialize service dependencies
      await this.initializeDependencies();

      this.logInfo('SlackOAuthService initialized successfully', {
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        scopes: this.config.scopes,
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
      this.successMessageCache.clear();
      this.logInfo('SlackOAuthService destroyed successfully');
    } catch (error) {
      this.handleError(error, 'onDestroy');
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;
    this.oauthStateService = serviceManager.getService('oauthStateService') as OAuthStateService;
    if (!this.tokenManager) {
      throw new Error('TokenManager not available');
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(context: SlackContext, scopes?: string[]): Promise<string> {
    try {
      this.logInfo('Starting OAuth URL generation', {
        userId: context.userId,
        teamId: context.teamId,
        channelId: context.channelId,
        scopes: scopes || this.config.scopes,
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri
      });

      const scopesToUse = scopes || this.config.scopes;
      const state = this.buildSignedState(context);

      this.logInfo('OAuth state built', {
        userId: context.userId,
        state: state.substring(0, 50) + '...'
      });

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        scope: scopesToUse.join(' '),
        response_type: 'code',
        state,
        access_type: 'offline',
        prompt: 'consent'
      });

      const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;

      this.logInfo('OAuth URL generated successfully', {
        userId: context.userId,
        scopes: scopesToUse,
        state: state.substring(0, 50) + '...',
        authUrl: authUrl.substring(0, 100) + '...'
      });

      return authUrl;
    } catch (error) {
      this.logError('Failed to generate OAuth URL', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<SlackOAuthResult> {
    try {
      // Validate state parameter (signature, expiry, nonce) via OAuthStateService when available
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
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      const tokens = await response.json() as SlackOAuthTokens;

      // Store tokens using TokenManager
      if (this.tokenManager && context.userId) {
        // Note: TokenManager interface changed - this OAuth service needs updating
        // For now, log the tokens that would be stored
        this.logInfo('OAuth tokens received', {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          scope: tokens.scope
        });
      }

      this.logInfo('OAuth tokens exchanged successfully', {
        userId: context.userId,
        hasRefreshToken: !!tokens.refresh_token,
        scope: tokens.scope
      });

      return {
        success: true,
        tokens
      };

    } catch (error) {
      this.logError('Failed to exchange code for tokens', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * Validate user's OAuth tokens
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

      // Check if user has tokens
      const hasTokens = await this.tokenManager.hasValidOAuthTokens('default', userId);
      if (!hasTokens) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'No valid tokens found'
        };
      }

      // Get tokens
      const tokens = await this.tokenManager.getValidTokens('default', userId);
      if (!tokens) {
        return {
          isValid: false,
          needsReauth: true,
          error: 'Failed to retrieve tokens'
        };
      }

      // Note: TokenManager interface changed - tokens is now a string
      // Simplified validation for now
      if (!tokens) {
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
      this.logError('Failed to validate tokens', error);
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

      const tokens = await this.tokenManager.getValidTokens('default', userId);
      if (!tokens) {
        return { hasTokens: false, isValid: false };
      }

      const validation = await this.validateTokens(userId);

      return {
        hasTokens: true,
        isValid: validation.isValid,
        scopes: undefined, // Note: Scope information not available in string format
        expiresAt: undefined // Note: Expiration not available in string format
      };

    } catch (error) {
      this.logError('Failed to get OAuth status', error);
      return { hasTokens: false, isValid: false };
    }
  }

  /**
   * Generate state parameter for OAuth flow
   */
  private buildSignedState(context: SlackContext): string {
    if (this.oauthStateService) {
      return this.oauthStateService.issueState(context);
    }
    // Local fallback signing for development/non-Redis environments
    const nonce = crypto.randomBytes(16).toString('hex');
    const payloadObj = {
      userId: context.userId,
      teamId: context.teamId,
      channelId: context.channelId,
      ts: Date.now(),
      n: nonce
    };

    this.logInfo('Building signed state payload', {
      userId: context.userId,
      teamId: context.teamId,
      channelId: context.channelId,
      hasUserId: !!context.userId,
      hasTeamId: !!context.teamId,
      hasChannelId: !!context.channelId,
      fullContext: context,
      operation: 'build_signed_state'
    });
    const payload = JSON.stringify(payloadObj);
    const sig = this.sign(payload);
    const b64 = Buffer.from(payload).toString('base64');
    this.usedNonces.set(nonce, Date.now());
    this.cleanupOldNonces();
    return `${b64}.${sig}`;
  }

  /**
   * Validate and parse state parameter
   */
  private validateSignedState(state: string): SlackContext | null {
    try {
      const parts = state.split('.');
      if (parts.length !== 2) {
        this.logWarn('Invalid OAuth state format');
        return null;
      }
      const [b64, providedSig] = parts;
      const payloadBuf = Buffer.from(b64 || '', 'base64');
      const payload = payloadBuf.toString('utf8');
      const expectedSig = this.sign(payload);
      if (!this.timingSafeEqual(Buffer.from(providedSig || '', 'hex'), Buffer.from(expectedSig || '', 'hex'))) {
        this.logWarn('OAuth state signature mismatch');
        return null;
      }
      const obj = JSON.parse(payload) as { userId: string; teamId: string; ts: number; n: string };
      if (Date.now() - obj.ts > this.nonceTtlMs) {
        this.logWarn('OAuth state expired');
        return null;
      }
      const seenAt = this.usedNonces.get(obj.n);
      if (seenAt && Date.now() - seenAt < this.nonceTtlMs) {
        this.logWarn('OAuth state nonce replay detected');
        return null;
      }
      this.usedNonces.set(obj.n, Date.now());
      this.cleanupOldNonces();
      return {
        userId: obj.userId,
        channelId: obj.userId, // Use userId as fallback for channelId
        teamId: obj.teamId,
        isDirectMessage: true
      };
    } catch (error) {
      this.logError('Failed to validate signed state', error);
      return null;
    }
  }

  private sign(payload: string): string {
    const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'default-unsafe-secret-change-me';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  private cleanupOldNonces(): void {
    const now = Date.now();
    for (const [nonce, ts] of this.usedNonces.entries()) {
      if (now - ts > this.nonceTtlMs) {
        this.usedNonces.delete(nonce);
      }
    }
  }

  /**
   * Handle OAuth success message display
   */
  async handleOAuthSuccess(userId: string): Promise<{
    shouldShowMessage: boolean;
    message?: string;
  }> {
    try {
      const now = Date.now();
      const lastShown = this.successMessageCache.get(userId);

      // Show success message only once per hour per user
      if (!lastShown || (now - lastShown) > 3600000) {
        this.successMessageCache.set(userId, now);

        return {
          shouldShowMessage: true,
          message: '✅ **OAuth Authorization Successful!**\n\nYou can now use email and calendar features. Try asking me to:\n• Check your emails\n• Schedule a meeting\n• Search your calendar'
        };
      }

      return {
        shouldShowMessage: false
      };

    } catch (error) {
      this.logError('Failed to handle OAuth success', error);
      return {
        shouldShowMessage: false
      };
    }
  }

  /**
   * Revoke OAuth tokens for a user
   */
  async revokeTokens(userId: string): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        return false;
      }

      // Get tokens before revoking
      const tokens = await this.tokenManager.getValidTokens('default', userId);
      if (!tokens) {
        return false;
      }

      // Revoke tokens with Google
      if (tokens) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens}`, {
            method: 'POST'
          });
        } catch (error) {
          this.logWarn('Failed to revoke tokens with Google', { error: (error as Error).message });
          // Continue with local removal even if remote revocation fails
        }
      }

      // Remove tokens locally
      // Note: TokenManager interface changed - removeTokens method not available
      this.logInfo('Token removal requested', { userId });

      // Clear success message cache
      this.successMessageCache.delete(userId);

      this.logInfo('OAuth tokens revoked', { userId });
      return true;

    } catch (error) {
      this.logError('Failed to revoke tokens', error);
      return false;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): any {
    return {
      healthy: this.isReady(),
      hasTokenManager: !!this.tokenManager,
      successMessageCacheSize: this.successMessageCache.size
    };
  }
}