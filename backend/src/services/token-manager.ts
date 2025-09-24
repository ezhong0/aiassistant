import { TokenStorageService } from './token-storage.service';
import { AuthService } from './auth.service';
import logger from '../utils/logger';
import { CacheService } from './cache.service';
import { GoogleTokens } from '../types/auth.types';
import { SlackTokens } from './token-storage.service';
import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import { AuditLogger } from '../utils/audit-logger';

export interface OAuthTokens {
  google?: GoogleTokens | undefined;
  slack?: {
    access_token?: string | undefined;
    team_id?: string | undefined;
    user_id?: string | undefined;
  } | undefined;
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
      logger.error('TokenManager dependencies not initialized', new Error('Dependencies not initialized'), {
        correlationId: `token-mgr-init-${Date.now()}`,
        operation: 'token_manager_init',
        metadata: errorDetails
      });
      throw new Error(`TokenManager dependencies not initialized: ${JSON.stringify(errorDetails)}`);
    }
    
    logger.debug(`Getting valid tokens for teamId="${teamId}", userId="${userId}"`, {
      correlationId: `token-mgr-${Date.now()}`,
      operation: 'token_manager',
      metadata: { teamId, userId, method: 'getValidTokens' }
    });
    
    const cacheKey = this.getTokenCacheKey(teamId, userId);
    
    // Try cache first with proper validation
    if (this.cacheService) {
      const cachedTokens = await this.cacheService.get<OAuthTokens>(cacheKey);
      if (cachedTokens?.google?.access_token) {
        // Unified token validation logic
        const validationResult = this.validateToken(cachedTokens.google);
        if (validationResult.isValid) {
          
          return cachedTokens.google.access_token;
        } else {
          // Remove expired token from cache and invalidate session cache
          await this.invalidateAllTokenCaches(teamId, userId);
        }
      }
    }
    
    // Get tokens from token storage service (single source of truth)
    const userId_key = `${teamId}:${userId}`;
    
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
    
    
    if (!tokens?.googleTokens?.access_token) {
      
      return null;
    }
    
    // Unified token validation
    
    const validationResult = this.validateToken(tokens.googleTokens);
    
    if (!validationResult.isValid) {
      
      // Try to refresh token
      if (tokens.googleTokens.refresh_token) {
        const refreshedTokens = await this.refreshTokens(teamId, userId);
        return refreshedTokens?.google?.access_token || null;
      } else {
        
        return null;
      }
    }
    
    
    
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
    
    // Validate token format (Google OAuth tokens typically start with "ya29.")
    if (typeof token.access_token !== 'string' || token.access_token.length < 20) {
      return { isValid: false, reason: 'invalid_token_format' };
    }
    
    // Check expiry with buffer (refresh 5 minutes early)
    const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    
    // Handle expiry_date (number), expires_at (Date), and expires_in (seconds)
    let expiryTime: number | null = null;
    if (token.expires_at) {
      const expiresAtDate = this.ensureDate(token.expires_at);
      expiryTime = expiresAtDate ? expiresAtDate.getTime() : null;
    } else if (token.expiry_date) {
      expiryTime = typeof token.expiry_date === 'number' ? token.expiry_date : new Date(token.expiry_date).getTime();
    } else if (token.expires_in) {
      // Convert expires_in (seconds) to expiry timestamp
      expiryTime = Date.now() + (token.expires_in * 1000);
    }
    
    // If we have expiry information, validate it
    if (expiryTime !== null) {
      if (isNaN(expiryTime) || Date.now() > (expiryTime - REFRESH_BUFFER_MS)) {
        return { isValid: false, reason: 'expired_or_expiring_soon' };
      }
    } else {
      // No expiry information - tokens without expiry info need refresh
      // This is common when tokens are stored without proper expiry metadata

      return { isValid: false, reason: 'no_expiry_information_needs_refresh' };
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
      
      
    }
  }

  /**
   * Refresh OAuth tokens for a Slack user with proper cache management
   */
  async refreshTokens(teamId: string, userId: string): Promise<OAuthTokens | null> {
    
    
    // First, invalidate all existing caches to prevent stale data
    await this.invalidateAllTokenCaches(teamId, userId);
    
    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
    if (!tokens?.googleTokens?.refresh_token) {
      
      return null;
    }
    
    try {
      const refreshedTokens = await this.authService!.refreshGoogleToken(tokens.googleTokens.refresh_token);

      logger.info('Token refresh response', {
        hasAccessToken: !!refreshedTokens.access_token,
        hasRefreshToken: !!refreshedTokens.refresh_token,
        hasScope: !!refreshedTokens.scope,
        accessTokenLength: refreshedTokens.access_token?.length || 0,
        operation: 'token_refresh_response'
      });

      if (!refreshedTokens.access_token) {
        logger.error('Token refresh returned no access token', {
          teamId,
          userId,
          operation: 'token_refresh_failed'
        });
        return null;
      }

      // Store the refreshed tokens using TokenStorageService
      await this.tokenStorageService!.storeUserTokens(userId_key, {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.googleTokens.refresh_token,
          expires_at: refreshedTokens.expires_at || (refreshedTokens.expiry_date ? new Date(refreshedTokens.expiry_date) : new Date(Date.now() + (3600 * 1000))),
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope || undefined
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
        
        // Audit log successful token refresh
        AuditLogger.logTokenRefresh(`user:${teamId}:${userId}`, userId, teamId, true, 'token_expired');
        
        // Update cache with refreshed tokens
        if (this.cacheService) {
          const cacheKey = this.getTokenCacheKey(teamId, userId);
          await this.cacheService.set(cacheKey, newTokens, this.TOKEN_CACHE_TTL);
          
        }
        
        return newTokens;
      } else {
        logger.error('Failed to store refreshed tokens', new Error('Token storage failed'), {
          correlationId: `token-mgr-${Date.now()}`,
          operation: 'token_manager',
          metadata: { teamId, userId, method: 'refreshTokens' }
        });
        // If storage failed, make sure cache is still clean
        await this.invalidateAllTokenCaches(teamId, userId);
        return null;
      }
    } catch (error: any) {
      logger.error('Token refresh failed', error as Error, {
        correlationId: `token-mgr-${Date.now()}`,
        operation: 'token_manager',
        metadata: { teamId, userId, method: 'refreshTokens' }
      });
      
      // Handle specific OAuth errors
      if (error.message?.includes('invalid_grant') || error.code === 'invalid_grant') {
        
        // Remove the invalid refresh token to prevent future failures
        try {
          const clearOptions: {
            google?: GoogleTokens;
            slack?: SlackTokens;
          } = {};
          
          if (tokens.googleTokens) {
            clearOptions.google = {
              access_token: '', // Clear access token
              refresh_token: undefined, // Clear refresh token
              expires_at: new Date(0), // Set to expired
              token_type: 'Bearer',
              scope: undefined
            };
          }
          
          if (tokens.slackTokens) {
            clearOptions.slack = tokens.slackTokens;
          }
          
          await this.tokenStorageService!.storeUserTokens(userId_key, clearOptions);
          
        } catch (clearError) {
          
        }
      }
      
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
      
      const accessToken = await this.getValidTokens(teamId, userId);
      const hasValidTokens = !!accessToken;
      
      return hasValidTokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
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
    
  }

  /**
   * Check if token has required calendar scopes for calendar operations
   */
  private hasCalendarScopes(token: any): boolean {
    if (!token?.scope || typeof token.scope !== 'string') {
      return false;
    }

    const scopes = token.scope.split(' ');
    const requiredCalendarScopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    // Check if token has at least one calendar scope
    return requiredCalendarScopes.some(requiredScope =>
      scopes.includes(requiredScope)
    );
  }

  /**
   * Check if token has required Gmail scopes for email operations
   */
  private hasGmailScopes(token: any): boolean {
    if (!token?.scope || typeof token.scope !== 'string') {
      return false;
    }

    const scopes = token.scope.split(' ');
    const requiredGmailScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly'
    ];

    // Check if token has at least one Gmail scope
    return requiredGmailScopes.some(requiredScope =>
      scopes.includes(requiredScope)
    );
  }

  /**
   * Get valid tokens specifically for calendar operations
   * Returns null if user doesn't have calendar permissions
   */
  async getValidTokensForCalendar(teamId: string, userId: string): Promise<string | null> {
    const correlationId = `calendar-tokens-${Date.now()}`;

    logger.debug('Getting valid tokens for calendar', {
      correlationId,
      operation: 'get_calendar_tokens',
      metadata: { teamId, userId }
    });

    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);

    // Handle both token property formats (googleTokens vs google)
    const googleTokens = tokens?.googleTokens || (tokens as any)?.google;

    logger.debug('Token lookup completed', {
      correlationId,
      operation: 'token_lookup',
      metadata: {
        hasTokens: !!tokens,
        hasGoogleTokens: !!googleTokens,
        hasAccessToken: !!googleTokens?.access_token,
        source: tokens?.googleTokens ? 'googleTokens' : 'google'
      }
    });

    if (!googleTokens?.access_token) {
      logger.debug('No access token found for calendar operations', {
        correlationId,
        operation: 'token_validation',
        metadata: { userId_key }
      });
      return null;
    }

    // First check basic token validation
    const validationResult = this.validateToken(googleTokens);
    if (!validationResult.isValid) {
      logger.debug('Calendar token validation failed', {
        correlationId,
        operation: 'token_validation',
        metadata: { reason: validationResult.reason }
      });
      return null;
    }

    // Check calendar scopes (relaxed check - warn but don't block)
    const hasCalendarScopes = this.hasCalendarScopes(googleTokens);
    if (!hasCalendarScopes) {
      logger.warn('Token does not have ideal calendar scopes, but proceeding', {
        correlationId,
        operation: 'calendar_scope_check',
        metadata: { scopes: googleTokens.scope }
      });
      // Don't return null - let the calendar API handle scope issues
    }

    logger.debug('Returning valid calendar access token', {
      correlationId,
      operation: 'calendar_token_success'
    });
    return googleTokens.access_token;
  }

  /**
   * Get valid tokens specifically for Gmail operations
   * Returns null if user doesn't have Gmail permissions or tokens need refresh
   */
  async getValidTokensForGmail(teamId: string, userId: string): Promise<string | null> {
    const correlationId = `gmail-token-${Date.now()}`;

    logger.debug('getValidTokensForGmail called', {
      correlationId,
      teamId,
      userId,
      operation: 'gmail_token_retrieval_start'
    });

    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);

    if (!tokens?.googleTokens?.access_token) {
      logger.warn('No Gmail tokens found', {
        correlationId,
        userId_key,
        hasTokens: !!tokens,
        hasGoogleTokens: !!tokens?.googleTokens,
        operation: 'gmail_token_missing'
      });
      return null;
    }

    // First check basic token validation
    const validationResult = this.validateToken(tokens.googleTokens);
    if (!validationResult.isValid) {
      logger.debug('Gmail token validation failed', {
        correlationId,
        reason: validationResult.reason,
        hasRefreshToken: !!tokens.googleTokens.refresh_token,
        operation: 'gmail_token_invalid'
      });

      // Try to refresh token
      if (tokens.googleTokens.refresh_token) {
        const refreshedTokens = await this.refreshTokens(teamId, userId);
        if (refreshedTokens?.google?.access_token) {
          // Re-validate after refresh
          const refreshedValidation = this.validateToken(refreshedTokens.google);
          if (refreshedValidation.isValid && this.hasGmailScopes(refreshedTokens.google)) {
            logger.info('Gmail token refreshed successfully', {
              correlationId,
              operation: 'gmail_token_refreshed'
            });
            return refreshedTokens.google.access_token;
          }
        }
      }

      return null;
    }

    // Check Gmail scopes
    const hasScopes = this.hasGmailScopes(tokens.googleTokens);
    if (!hasScopes) {
      logger.warn('Gmail token missing required scopes', {
        correlationId,
        scopes: tokens.googleTokens.scope,
        operation: 'gmail_scope_missing'
      });
      return null;
    }

    logger.debug('Returning valid Gmail token', {
      correlationId,
      operation: 'gmail_token_success'
    });
    return tokens.googleTokens.access_token;
  }

  /**
   * Check if user needs to re-authenticate for calendar operations
   */
  async needsCalendarReauth(teamId: string, userId: string): Promise<{ needsReauth: boolean; reason?: string }> {
    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);

    if (!tokens?.googleTokens?.access_token) {
      return { needsReauth: true, reason: 'no_tokens' };
    }

    const validationResult = this.validateToken(tokens.googleTokens);
    if (!validationResult.isValid) {
      return { needsReauth: true, reason: validationResult.reason };
    }

    if (!this.hasCalendarScopes(tokens.googleTokens)) {
      return { needsReauth: true, reason: 'missing_calendar_scopes' };
    }

    return { needsReauth: false };
  }
}
