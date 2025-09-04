import { TokenStorageService } from './token-storage.service';
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
  private tokenStorageService: TokenStorageService | null = null;
  private authService: AuthService | null = null;
  private cacheService: CacheService | null = null;
  
  // Cache TTL constants
  private readonly TOKEN_CACHE_TTL = 900; // 15 minutes
  private readonly STATUS_CACHE_TTL = 300; // 5 minutes

  constructor() {
    super('TokenManager');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Get dependencies from service registry
    this.tokenStorageService = serviceManager.getService<TokenStorageService>('tokenStorageService') || null;
    this.authService = serviceManager.getService<AuthService>('authService') || null;
    this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;
    
    if (!this.tokenStorageService) {
      throw new Error('TokenStorageService not available from service registry');
    }
    
    if (!this.authService) {
      throw new Error('AuthService not available from service registry');
    }
    
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
    if (!this.tokenStorageService || !this.authService) {
      const errorDetails = {
        hasTokenStorageService: !!this.tokenStorageService,
        hasAuthService: !!this.authService,
        tokenStorageServiceReady: this.tokenStorageService?.isReady() || false,
        authServiceReady: this.authService?.isReady() || false
      };
      logger.error('TokenManager dependencies not initialized', errorDetails);
      throw new Error(`TokenManager dependencies not initialized: ${JSON.stringify(errorDetails)}`);
    }
    
    logger.info(`🔍 RETRIEVAL DEBUG - Getting valid tokens for teamId="${teamId}", userId="${userId}" (types: ${typeof teamId}, ${typeof userId})`);
    
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
    
    // Get tokens from token storage service (single source of truth)
    const userId_key = `${teamId}:${userId}`;
    logger.info(`🔍 RETRIEVAL DEBUG - Retrieving tokens with key="${userId_key}" (constructed from teamId="${teamId}" + userId="${userId}")`);
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
    logger.info(`🔍 RETRIEVAL DEBUG - Retrieved tokens from storage: hasTokens=${!!tokens}, hasGoogleTokens=${!!tokens?.googleTokens}, hasAccessToken=${!!tokens?.googleTokens?.access_token}`);
    
    if (!tokens?.googleTokens?.access_token) {
      logger.debug('No OAuth tokens found for Slack user', { teamId, userId, userId_key });
      return null;
    }
    
    // Unified token validation
    logger.info(`🔍 VALIDATION DEBUG - Starting token validation for key="${userId_key}"`);
    const validationResult = this.validateToken(tokens.googleTokens);
    logger.info(`🔍 VALIDATION DEBUG - Token validation result: isValid=${validationResult.isValid}, reason=${validationResult.reason || 'none'}`);
    if (!validationResult.isValid) {
      logger.info('OAuth tokens invalid, attempting refresh', { 
        teamId, 
        userId, 
        reason: validationResult.reason 
      });
      
      // Try to refresh token
      if (tokens.googleTokens.refresh_token) {
        const refreshedTokens = await this.refreshTokens(teamId, userId);
        return refreshedTokens?.google?.access_token || null;
      } else {
        logger.warn('Tokens invalid but no refresh token available', { teamId, userId });
        return null;
      }
    }
    
    logger.debug('Valid tokens found for Slack user', { teamId, userId });
    
    // Cache the valid tokens for future use (convert to OAuthTokens format for cache)
    if (this.cacheService && tokens) {
      const cacheTokens: OAuthTokens = {
        google: {
          access_token: tokens.googleTokens.access_token,
          refresh_token: tokens.googleTokens.refresh_token,
          token_type: tokens.googleTokens.token_type || 'Bearer',
          expires_in: tokens.googleTokens.expires_at ? 
            Math.max(0, Math.floor((this.ensureDate(tokens.googleTokens.expires_at)!.getTime() - Date.now()) / 1000)) : 3600,
          scope: tokens.googleTokens.scope,
          expiry_date: this.ensureDate(tokens.googleTokens.expires_at)?.getTime()
        },
        slack: tokens.slackTokens
      };
      await this.cacheService.set(cacheKey, cacheTokens, this.TOKEN_CACHE_TTL);
      logger.debug('Cached tokens for Slack user', { teamId, userId });
    }
    
    return tokens.googleTokens.access_token;
  }
  
  /**
   * Ensure expires_at is a Date object (handle both Date and string formats)
   */
  private ensureDate(expiresAt: Date | string | number | undefined): Date | undefined {
    if (!expiresAt) return undefined;
    if (expiresAt instanceof Date) return expiresAt;
    return new Date(expiresAt);
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
    
    // Handle both expiry_date (number) and expires_at (Date)
    let expiryTime: number;
    if (token.expiry_date) {
      expiryTime = token.expiry_date;
    } else if (token.expires_at) {
      const expiresAtDate = this.ensureDate(token.expires_at);
      expiryTime = expiresAtDate ? expiresAtDate.getTime() : Date.now();
    } else {
      // No expiry information, assume valid
      return { isValid: true };
    }
    
    if (Date.now() > (expiryTime - REFRESH_BUFFER_MS)) {
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
    
    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
    if (!tokens?.googleTokens?.refresh_token) {
      logger.warn('No refresh token available for Slack user', { teamId, userId });
      return null;
    }
    
    try {
      const refreshedTokens = await this.authService!.refreshGoogleToken(tokens.googleTokens.refresh_token);
      
      // Store the refreshed tokens using TokenStorageService
      await this.tokenStorageService!.storeUserTokens(userId_key, {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.googleTokens.refresh_token,
          expires_at: refreshedTokens.expiry_date ? new Date(refreshedTokens.expiry_date) : undefined,
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope
        },
        slack: tokens.slackTokens // Preserve existing Slack tokens
      });
      
      // Create return value in OAuthTokens format
      const newTokens: OAuthTokens = {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.googleTokens.refresh_token,
          expires_in: refreshedTokens.expires_in,
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope,
          expiry_date: refreshedTokens.expiry_date
        },
        slack: tokens.slackTokens // Preserve existing Slack tokens
      };
      
      const stored = true; // TokenStorageService throws on failure
      
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
    try {
      logger.info(`🔍 hasValidOAuthTokens called with teamId="${teamId}", userId="${userId}"`);
      const accessToken = await this.getValidTokens(teamId, userId);
      const hasValidTokens = !!accessToken;
      logger.info(`🔍 hasValidOAuthTokens result: hasValidTokens=${hasValidTokens}, accessToken exists=${!!accessToken}`);
      return hasValidTokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`💥 Error in hasValidOAuthTokens for teamId="${teamId}", userId="${userId}": ${errorMessage}`, {
        errorMessage,
        errorStack,
        errorType: error?.constructor?.name
      });
      throw error;
    }
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
    
    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
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
    
    const hasAccessToken = !!tokens.googleTokens?.access_token;
    const hasRefreshToken = !!tokens.googleTokens?.refresh_token;
    
    // Use unified validation logic
    const validationResult = tokens.googleTokens ? this.validateToken(tokens.googleTokens) : { isValid: false, reason: 'no_google_tokens' };
    
    const status = {
      hasTokens: true,
      hasAccessToken,
      hasRefreshToken,
      isValid: validationResult.isValid,
      validationReason: validationResult.reason,
      status: !hasAccessToken ? 'no_access_token' : 
              !validationResult.isValid ? 'invalid' :
              'valid',
      expiryDate: this.ensureDate(tokens.googleTokens?.expires_at)?.toISOString() || null,
      expiresIn: tokens.googleTokens?.expires_at ? Math.max(0, this.ensureDate(tokens.googleTokens.expires_at)!.getTime() - Date.now()) / 1000 : null,
      timeUntilExpiry: tokens.googleTokens?.expires_at ? Math.max(0, this.ensureDate(tokens.googleTokens.expires_at)!.getTime() - Date.now()) : null,
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
