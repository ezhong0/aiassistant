import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { TokenManager } from '../token-manager';
import { SlackContext } from '../../types/slack/slack.types';
import {
  SlackOAuthConfig,
  SlackOAuthTokens,
  SlackOAuthAuthorizationResult,
  SlackOAuthTokenExchangeResult,
  SlackOAuthValidationResult,
  SlackOAuthRequirementResult,
  SlackOAuthUrlParams,
  SlackOAuthSuccessMessageData
} from '../../types/slack/slack-oauth-types';
import { AIClassificationService } from '../ai-classification.service';
import logger from '../../utils/logger';

/**
 * SlackOAuthManager - Focused service for Slack OAuth handling
 * Manages OAuth flow, token validation, and authorization requirements
 */
export class SlackOAuthManager extends BaseService {
  private config: SlackOAuthConfig;
  private tokenManager: TokenManager | null = null;
  private aiClassificationService: AIClassificationService | null = null;
  private successMessageCache = new Map<string, number>(); // Track shown success messages

  constructor(config: SlackOAuthConfig) {
    super('SlackOAuthManager');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackOAuthManager...');

      // Initialize service dependencies
      await this.initializeDependencies();

      this.logInfo('SlackOAuthManager initialized successfully', {
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        scopes: this.config.scopes,
        hasTokenManager: !!this.tokenManager,
        hasAIClassification: !!this.aiClassificationService
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
      this.tokenManager = null;
      this.aiClassificationService = null;
      this.logInfo('SlackOAuthManager destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackOAuthManager destruction', error);
    }
  }

  /**
   * Check if user has valid OAuth tokens
   */
  async hasValidTokens(context: SlackContext): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        this.logWarn('TokenManager not available for OAuth validation');
        return false;
      }

      const tokens = await this.tokenManager.getValidTokens(context.teamId, context.userId);
      return !!tokens;
    } catch (error) {
      this.logError('Error checking OAuth tokens', error, {
        userId: context.userId,
        teamId: context.teamId
      });
      return false;
    }
  }

  /**
   * Detect if request requires OAuth using AI classification
   */
  async detectOAuthRequirement(message: string): Promise<SlackOAuthRequirementResult> {
    try {
      if (!this.aiClassificationService) {
        this.logWarn('AIClassificationService not available for OAuth detection');
        return {
          requiresOAuth: false,
          oauthType: 'none',
          confidence: 0,
          reasoning: 'AI classification service not available'
        };
      }

      const oauthRequirement = await this.aiClassificationService.detectOAuthRequirement(message);
      
      return {
        requiresOAuth: oauthRequirement !== 'none',
        oauthType: oauthRequirement,
        confidence: 0.8, // AI classification confidence
        reasoning: `AI detected ${oauthRequirement} requirement`
      };
    } catch (error) {
      this.logError('Error detecting OAuth requirement', error);
      return {
        requiresOAuth: false,
        oauthType: 'none',
        confidence: 0,
        reasoning: 'Error in OAuth detection'
      };
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthorizationUrl(params: SlackOAuthUrlParams): Promise<SlackOAuthAuthorizationResult> {
    try {
      const state = params.state || this.generateState(params.teamId, params.userId);
      
      const authUrl = new URL('https://slack.com/oauth/v2/authorize');
      authUrl.searchParams.set('client_id', this.config.clientId);
      authUrl.searchParams.set('scope', this.config.scopes.join(','));
      authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('user_scope', 'chat:write,im:write,im:read');

      this.logInfo('Generated OAuth authorization URL', {
        teamId: params.teamId,
        userId: params.userId,
        state,
        scopes: this.config.scopes
      });

      return {
        success: true,
        authorizationUrl: authUrl.toString(),
        state
      };
    } catch (error) {
      this.logError('Error generating OAuth authorization URL', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate authorization URL'
      };
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<SlackOAuthTokenExchangeResult> {
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      const data = await response.json() as any;

      if (!data.ok) {
        return {
          success: false,
          error: data.error || 'Token exchange failed',
          needsReauth: true
        };
      }

      const tokens: SlackOAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        scope: data.scope,
        teamId: data.team.id,
        userId: data.authed_user.id
      };

      // Note: Token storage is handled by the existing OAuth flow
      // This service focuses on OAuth URL generation and validation

      this.logInfo('Successfully exchanged code for tokens', {
        teamId: tokens.teamId,
        userId: tokens.userId,
        hasRefreshToken: !!tokens.refreshToken,
        expiresAt: tokens.expiresAt
      });

      return {
        success: true,
        tokens
      };
    } catch (error) {
      this.logError('Error exchanging code for tokens', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed',
        needsReauth: true
      };
    }
  }

  /**
   * Validate OAuth tokens
   */
  async validateTokens(context: SlackContext): Promise<SlackOAuthValidationResult> {
    try {
      if (!this.tokenManager) {
        return {
          isValid: false,
          hasValidTokens: false,
          needsRefresh: false,
          needsReauth: true,
          error: 'TokenManager not available'
        };
      }

      const accessToken = await this.tokenManager.getValidTokens(context.teamId, context.userId);
      
      if (!accessToken) {
        return {
          isValid: false,
          hasValidTokens: false,
          needsRefresh: false,
          needsReauth: true,
          error: 'No tokens found'
        };
      }

      // For now, assume tokens are valid if we have an access token
      // In a real implementation, you'd check expiration dates
      return {
        isValid: true,
        hasValidTokens: true,
        needsRefresh: false,
        needsReauth: false,
        tokens: {
          accessToken,
          teamId: context.teamId,
          userId: context.userId
        } as SlackOAuthTokens
      };
    } catch (error) {
      this.logError('Error validating OAuth tokens', error);
      return {
        isValid: false,
        hasValidTokens: false,
        needsRefresh: false,
        needsReauth: true,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Send OAuth success message
   */
  async sendOAuthSuccessMessage(data: SlackOAuthSuccessMessageData): Promise<void> {
    try {
      const messageKey = `${data.teamId}-${data.userId}-oauth-success`;
      
      // Check if we've already shown this message recently
      if (this.isSuccessMessageRecentlyShown(messageKey)) {
        this.logDebug('OAuth success message already shown recently', { messageKey });
        return;
      }

      // Mark message as shown
      this.markSuccessMessageShown(messageKey);

      // Send success message
      const client = new WebClient(data.tokens.accessToken);
      await client.chat.postMessage({
        channel: data.channelId,
        text: `🎉 **OAuth Authorization Successful!**\n\nYou're now connected to Google services. You can:\n• Send emails through Gmail\n• Manage your calendar\n• Access your contacts\n\nTry saying: "Send an email to john@example.com about our meeting"`
      });

      this.logInfo('OAuth success message sent', {
        teamId: data.teamId,
        userId: data.userId,
        channelId: data.channelId
      });
    } catch (error) {
      this.logError('Error sending OAuth success message', error);
    }
  }

  /**
   * Send OAuth required message
   */
  async sendOAuthRequiredMessage(context: SlackContext, oauthType: string): Promise<void> {
    try {
      const authUrlResult = await this.generateAuthorizationUrl({
        teamId: context.teamId,
        userId: context.userId
      });

      if (!authUrlResult.success || !authUrlResult.authorizationUrl) {
        throw new Error('Failed to generate OAuth URL');
      }

      const client = new WebClient(process.env.SLACK_BOT_TOKEN);
      await client.chat.postMessage({
        channel: context.channelId,
        text: `🔐 **Authorization Required**\n\nTo ${this.getOAuthActionDescription(oauthType)}, you need to authorize access to your Google account.\n\n[Click here to authorize](${authUrlResult.authorizationUrl})\n\nThis will allow me to:\n• Send emails on your behalf\n• Manage your calendar\n• Access your contacts\n\n*Your data is secure and only used for the actions you request.*`
      });

      this.logInfo('OAuth required message sent', {
        userId: context.userId,
        teamId: context.teamId,
        channelId: context.channelId,
        oauthType
      });
    } catch (error) {
      this.logError('Error sending OAuth required message', error);
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    try {
      // Get TokenManager from service registry
      const serviceManager = ServiceManager.getInstance();
      this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;
      
      // Get AIClassificationService from service registry
      this.aiClassificationService = serviceManager.getService('aiClassificationService') as AIClassificationService;
    } catch (error) {
      this.logWarn('Some dependencies not available during initialization', error);
    }
  }

  /**
   * Generate state parameter for OAuth flow
   */
  private generateState(teamId: string, userId: string): string {
    return `${teamId}-${userId}-${Date.now()}`;
  }

  /**
   * Check if success message was recently shown
   */
  private isSuccessMessageRecentlyShown(messageKey: string): boolean {
    const lastShown = this.successMessageCache.get(messageKey);
    if (!lastShown) return false;
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return lastShown > fiveMinutesAgo;
  }

  /**
   * Mark success message as shown
   */
  private markSuccessMessageShown(messageKey: string): void {
    this.successMessageCache.set(messageKey, Date.now());
  }

  /**
   * Get OAuth action description
   */
  private getOAuthActionDescription(oauthType: string): string {
    switch (oauthType) {
      case 'email_send':
        return 'send emails';
      case 'email_read':
        return 'read emails';
      case 'calendar_access':
        return 'manage your calendar';
      case 'contact_access':
        return 'access your contacts';
      default:
        return 'access Google services';
    }
  }

  /**
   * Get OAuth manager statistics
   */
  getOAuthStats(): {
    successMessageCacheSize: number;
    config: SlackOAuthConfig;
    hasTokenManager: boolean;
    hasAIClassification: boolean;
  } {
    return {
      successMessageCacheSize: this.successMessageCache.size,
      config: this.config,
      hasTokenManager: !!this.tokenManager,
      hasAIClassification: !!this.aiClassificationService
    };
  }
}
