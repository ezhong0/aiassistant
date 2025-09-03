import { SlackSessionManager } from './slack-session-manager';
import { AuthService } from './auth.service';
import { CacheService } from './cache.service';
import { GoogleTokens } from '../types/auth.types';
import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import { AuditLogger } from '../utils/audit-logger';
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
   * Uses unified token validation and caching strategy
   */
  async getValidTokens(teamId: string, userId: string): Promise<string | null> {
    logger.debug('Getting valid tokens for Slack user', { teamId, userId });
    
    const cacheKey = this.getTokenCacheKey(teamId, userId);
    
    // Try cache first with proper validation
    if (this.cacheService) {
      const cachedTokens = await this.cacheService.get<OAuthTokens>(cacheKey);
      if (cachedTokens?.google?.access_token) {
        // Unified token validation logic
        const validationResult = this.validateToken(cachedTokens.google);
        if (validationResult.isValid) {
          logger.debug('Using cached valid tokens for Slack user', { teamId, userId });
          return cachedTokens.google.access_token;
        } else {
          // Remove expired token from cache and invalidate session cache
          await this.invalidateAllTokenCaches(teamId, userId);
          logger.debug('Cached token invalid, removed from all caches', { 
            teamId, 
            userId, 
            reason: validationResult.reason 
          });
        }
      }
    }
    
    // Get tokens from session manager (single source of truth)
    const tokens = await this.sessionManager.getOAuthTokens(teamId, userId);
    
    if (!tokens?.google?.access_token) {
      logger.debug('No OAuth tokens found for Slack user', { teamId, userId });
      return null;
    }
    
    // Unified token validation
    const validationResult = this.validateToken(tokens.google);
    if (!validationResult.isValid) {
      logger.info('OAuth tokens invalid, attempting refresh', { 
        teamId, 
        userId, 
        reason: validationResult.reason 
      });
      
      // Try to refresh token
      if (tokens.google.refresh_token) {
        const refreshedTokens = await this.refreshTokens(teamId, userId);
        return refreshedTokens?.google?.access_token || null;
      } else {
        logger.warn('Tokens invalid but no refresh token available', { teamId, userId });
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
   * Unified token validation logic
   */
  private validateToken(token: any): { isValid: boolean; reason?: string } {
    if (!token?.access_token) {
      return { isValid: false, reason: 'no_access_token' };
    }
    
    // Check expiry with buffer (refresh 5 minutes early)
    const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    if (token.expiry_date && Date.now() > (token.expiry_date - REFRESH_BUFFER_MS)) {
      return { isValid: false, reason: 'expired_or_expiring_soon' };
    }
    
    return { isValid: true };
  }
  
  /**
   * Invalidate all token caches (both direct and session-based)
   */
  private async invalidateAllTokenCaches(teamId: string, userId: string): Promise<void> {
    if (this.cacheService) {
      const tokenKey = this.getTokenCacheKey(teamId, userId);
      const statusKey = this.getStatusCacheKey(teamId, userId);
      
      // Also invalidate the session cache since it may contain token data
      const sessionId = `user:${teamId}:${userId}`;
      
      await Promise.all([
        this.cacheService.del(tokenKey),
        this.cacheService.del(statusKey),
        this.cacheService.del(`session:${sessionId}`)
      ]);
      
      logger.debug('Invalidated all token and session caches for Slack user', { teamId, userId });
    }
  }

  /**
   * Refresh OAuth tokens for a Slack user with proper cache management
   */
  async refreshTokens(teamId: string, userId: string): Promise<OAuthTokens | null> {
    logger.info('Refreshing OAuth tokens for Slack user', { teamId, userId });
    
    // First, invalidate all existing caches to prevent stale data
    await this.invalidateAllTokenCaches(teamId, userId);
    
    const tokens = await this.sessionManager.getOAuthTokens(teamId, userId);
    
    if (!tokens?.google?.refresh_token) {
      logger.warn('No refresh token available for Slack user', { teamId, userId });
      return null;
    }
    
    try {
      const refreshedTokens = await this.authService.refreshGoogleToken(tokens.google.refresh_token);
      
      // Create the new token set
      const newTokens: OAuthTokens = {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.google.refresh_token,
          expires_in: refreshedTokens.expires_in,
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope,
          expiry_date: refreshedTokens.expiry_date
        },
        slack: tokens.slack // Preserve existing Slack tokens
      };
      
      // Store the refreshed tokens (single source of truth)
      const stored = await this.sessionManager.storeOAuthTokens(teamId, userId, newTokens);
      
      if (stored) {
        logger.info('Successfully refreshed and stored OAuth tokens', { 
          teamId, 
          userId,
          expiresIn: refreshedTokens.expires_in,
          hasNewRefreshToken: !!refreshedTokens.refresh_token
        });
        
        // Audit log successful token refresh
        AuditLogger.logTokenRefresh(`user:${teamId}:${userId}`, userId, teamId, true, 'token_expired');
        
        // Update cache with refreshed tokens
        if (this.cacheService) {
          const cacheKey = this.getTokenCacheKey(teamId, userId);
          await this.cacheService.set(cacheKey, newTokens, this.TOKEN_CACHE_TTL);
          logger.debug('Cached refreshed tokens for Slack user', { teamId, userId });
        }
        
        return newTokens;
      } else {
        logger.error('Failed to store refreshed tokens', { teamId, userId });
        // If storage failed, make sure cache is still clean
        await this.invalidateAllTokenCaches(teamId, userId);
        return null;
      }
    } catch (error) {
      logger.error('Token refresh failed', { teamId, userId, error });
      
      // Audit log failed token refresh
      AuditLogger.logTokenRefresh(`user:${teamId}:${userId}`, userId, teamId, false, 
        error instanceof Error ? error.message : 'unknown_error');
      
      // Clean up any stale cache on failure
      await this.invalidateAllTokenCaches(teamId, userId);
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
   * Get token status for debugging with unified validation
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
      const status = { 
        hasTokens: false, 
        status: 'no_tokens',
        sessionId: `user:${teamId}:${userId}`
      };
      
      // Cache the no-tokens status briefly
      if (this.cacheService) {
        await this.cacheService.set(statusCacheKey, status, Math.min(this.STATUS_CACHE_TTL, 60));
      }
      
      return status;
    }
    
    const hasAccessToken = !!tokens.google?.access_token;
    const hasRefreshToken = !!tokens.google?.refresh_token;
    
    // Use unified validation logic
    const validationResult = tokens.google ? this.validateToken(tokens.google) : { isValid: false, reason: 'no_google_tokens' };
    
    const status = {
      hasTokens: true,
      hasAccessToken,
      hasRefreshToken,
      isValid: validationResult.isValid,
      validationReason: validationResult.reason,
      status: !hasAccessToken ? 'no_access_token' : 
              !validationResult.isValid ? 'invalid' :
              'valid',
      expiryDate: tokens.google?.expiry_date ? new Date(tokens.google.expiry_date).toISOString() : null,
      expiresIn: tokens.google?.expires_in,
      timeUntilExpiry: tokens.google?.expiry_date ? Math.max(0, tokens.google.expiry_date - Date.now()) : null,
      sessionId: `user:${teamId}:${userId}`,
      lastChecked: new Date().toISOString()
    };
    
    // Cache the status result (shorter TTL for invalid tokens)
    const cacheTTL = validationResult.isValid ? this.STATUS_CACHE_TTL : Math.min(this.STATUS_CACHE_TTL, 60);
    if (this.cacheService) {
      await this.cacheService.set(statusCacheKey, status, cacheTTL);
      logger.debug('Cached token status for Slack user', { teamId, userId, isValid: validationResult.isValid });
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
   * Invalidate cache for a user's tokens (public method)
   */
  async invalidateTokenCache(teamId: string, userId: string): Promise<void> {
    await this.invalidateAllTokenCaches(teamId, userId);
    logger.info('Invalidated all token caches for Slack user', { teamId, userId });
  }
}
