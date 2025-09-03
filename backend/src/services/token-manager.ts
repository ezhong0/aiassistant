import { SlackSessionManager } from './slack-session-manager';
import { AuthService } from './auth.service';
import { CacheService } from './cache.service';
import { GoogleTokens } from '../types/auth.types';
import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import logger from '../utils/logger';

export interface OAuthTokens {
  google?: GoogleTokens;
  slack?: {
    access_token?: string;
    team_id?: string;
    user_id?: string;
  };
}

export class TokenManager extends BaseService {
  private sessionManager: SlackSessionManager;
  private authService: AuthService;
  private cacheService: CacheService | null = null;
  
  // Cache TTL constants
  private readonly TOKEN_CACHE_TTL = 900; // 15 minutes
  private readonly STATUS_CACHE_TTL = 300; // 5 minutes

  constructor(sessionManager: SlackSessionManager, authService: AuthService) {
    super('TokenManager');
    this.sessionManager = sessionManager;
    this.authService = authService;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Get cache service (optional dependency)
    this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;
    
    if (this.cacheService) {
      this.logInfo('TokenManager initialized with caching enabled');
    } else {
      this.logInfo('TokenManager initialized without caching (cache service not available)');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('TokenManager destroyed');
  }

  /**
   * Get valid Google access token for a Slack user
   */
  async getValidTokens(teamId: string, userId: string): Promise<string | null> {
    logger.debug('Getting valid tokens for Slack user', { teamId, userId });
    
    const cacheKey = this.getTokenCacheKey(teamId, userId);
    
    // Try cache first
    if (this.cacheService) {
      const cachedTokens = await this.cacheService.get<OAuthTokens>(cacheKey);
      if (cachedTokens?.google?.access_token) {
        // Check if cached token is still valid
        const isExpired = cachedTokens.google.expiry_date && Date.now() > cachedTokens.google.expiry_date;
        if (!isExpired) {
          logger.debug('Using cached valid tokens for Slack user', { teamId, userId });
          return cachedTokens.google.access_token;
        } else {
          // Remove expired token from cache
          await this.cacheService.del(cacheKey);
          logger.debug('Cached token expired, removed from cache', { teamId, userId });
        }
      }
    }
    
    const tokens = await this.sessionManager.getOAuthTokens(teamId, userId);
    
    if (!tokens?.google?.access_token) {
      logger.debug('No OAuth tokens found for Slack user', { teamId, userId });
      return null;
    }
    
    // Check if token is expired
    if (tokens.google.expiry_date && Date.now() > tokens.google.expiry_date) {
      logger.info('OAuth tokens expired, attempting refresh', { teamId, userId });
      
      // Try to refresh token
      if (tokens.google.refresh_token) {
        const refreshedTokens = await this.refreshTokens(teamId, userId);
        return refreshedTokens?.google?.access_token || null;
      } else {
        logger.warn('Tokens expired but no refresh token available', { teamId, userId });
        return null;
      }
    }
    
    logger.debug('Valid tokens found for Slack user', { teamId, userId });
    
    // Cache the valid tokens for future use
    if (this.cacheService && tokens) {
      await this.cacheService.set(cacheKey, tokens, this.TOKEN_CACHE_TTL);
      logger.debug('Cached tokens for Slack user', { teamId, userId });
    }
    
    return tokens.google.access_token;
  }

  /**
   * Refresh OAuth tokens for a Slack user
   */
  async refreshTokens(teamId: string, userId: string): Promise<OAuthTokens | null> {
    logger.info('Refreshing OAuth tokens for Slack user', { teamId, userId });
    
    const tokens = await this.sessionManager.getOAuthTokens(teamId, userId);
    
    if (!tokens?.google?.refresh_token) {
      logger.warn('No refresh token available for Slack user', { teamId, userId });
      return null;
    }
    
    try {
      const refreshedTokens = await this.authService.refreshGoogleToken(tokens.google.refresh_token);
      
      // Store the refreshed tokens
      const stored = await this.sessionManager.storeOAuthTokens(teamId, userId, {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.google.refresh_token,
          expires_in: refreshedTokens.expires_in,
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope,
          expiry_date: refreshedTokens.expiry_date
        },
        slack: tokens.slack // Preserve existing Slack tokens
      });
      
      if (stored) {
        logger.info('Successfully refreshed and stored OAuth tokens', { teamId, userId });
        
        const newTokens = {
          google: refreshedTokens,
          slack: tokens.slack
        };
        
        // Update cache with refreshed tokens
        if (this.cacheService) {
          const cacheKey = this.getTokenCacheKey(teamId, userId);
          await this.cacheService.set(cacheKey, newTokens, this.TOKEN_CACHE_TTL);
          logger.debug('Cached refreshed tokens for Slack user', { teamId, userId });
        }
        
        return newTokens;
      } else {
        logger.error('Failed to store refreshed tokens', { teamId, userId });
        return null;
      }
    } catch (error) {
      logger.error('Token refresh failed', { teamId, userId, error });
      return null;
    }
  }

  /**
   * Check if a user has valid OAuth tokens
   */
  async hasValidOAuthTokens(teamId: string, userId: string): Promise<boolean> {
    const accessToken = await this.getValidTokens(teamId, userId);
    return !!accessToken;
  }

  /**
   * Get token status for debugging
   */
  async getTokenStatus(teamId: string, userId: string): Promise<any> {
    const statusCacheKey = this.getStatusCacheKey(teamId, userId);
    
    // Try cache first for status
    if (this.cacheService) {
      const cachedStatus = await this.cacheService.get<any>(statusCacheKey);
      if (cachedStatus) {
        logger.debug('Using cached token status for Slack user', { teamId, userId });
        return cachedStatus;
      }
    }
    
    const tokens = await this.sessionManager.getOAuthTokens(teamId, userId);
    
    if (!tokens) {
      return { hasTokens: false, status: 'no_tokens' };
    }
    
    const hasAccessToken = !!tokens.google?.access_token;
    const hasRefreshToken = !!tokens.google?.refresh_token;
    const isExpired = tokens.google?.expiry_date && Date.now() > tokens.google.expiry_date;
    
    const status = {
      hasTokens: true,
      hasAccessToken,
      hasRefreshToken,
      isExpired,
      status: !hasAccessToken ? 'no_access_token' : 
              isExpired ? 'expired' : 
              'valid',
      expiryDate: tokens.google?.expiry_date ? new Date(tokens.google.expiry_date).toISOString() : null,
      expiresIn: tokens.google?.expires_in
    };
    
    // Cache the status result
    if (this.cacheService) {
      await this.cacheService.set(statusCacheKey, status, this.STATUS_CACHE_TTL);
      logger.debug('Cached token status for Slack user', { teamId, userId });
    }
    
    return status;
  }

  /**
   * Generate cache key for tokens
   */
  private getTokenCacheKey(teamId: string, userId: string): string {
    return `tokens:${teamId}:${userId}`;
  }

  /**
   * Generate cache key for token status
   */
  private getStatusCacheKey(teamId: string, userId: string): string {
    return `token-status:${teamId}:${userId}`;
  }

  /**
   * Invalidate cache for a user's tokens
   */
  async invalidateTokenCache(teamId: string, userId: string): Promise<void> {
    if (this.cacheService) {
      const tokenKey = this.getTokenCacheKey(teamId, userId);
      const statusKey = this.getStatusCacheKey(teamId, userId);
      
      await Promise.all([
        this.cacheService.del(tokenKey),
        this.cacheService.del(statusKey)
      ]);
      
      logger.debug('Invalidated token cache for Slack user', { teamId, userId });
    }
  }
}
