import { BaseService } from './base-service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { CryptoUtil } from '../utils/crypto.util';
import { AuditLogger } from '../utils/audit-logger';
import logger from '../utils/logger';
import { serviceManager } from './service-manager';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  token_type?: string;
  scope?: string;
}

export interface SlackTokens {
  access_token?: string;
  team_id?: string;
  user_id?: string;
}

export interface UserTokens {
  userId: string;
  googleTokens?: GoogleTokens;
  slackTokens?: SlackTokens;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified token storage service - replaces complex session management
 * Stores only essential OAuth tokens per user
 */
export class TokenStorageService extends BaseService {
  private databaseService: DatabaseService | null = null;
  private cacheService: CacheService | null = null;
  
  // Cache TTL for tokens (2 hours)
  private readonly TOKEN_CACHE_TTL = 2 * 60 * 60;

  constructor() {
    super('TokenStorageService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Starting TokenStorageService initialization...');
    
    // Get services from service manager
    this.databaseService = serviceManager.getService('databaseService') as DatabaseService;
    this.cacheService = serviceManager.getService('cacheService') as CacheService;
    
    if (!this.databaseService) {
      throw new Error('TokenStorageService requires DatabaseService');
    }
    
    if (this.cacheService) {
      this.logInfo('✅ Cache service available for token caching');
    } else {
      this.logInfo('Cache service not available, operating without token caching');
    }

    this.logInfo('🔐 TokenStorageService initialized - simplified OAuth token management');
    this.logInfo('TokenStorageService initialization completed successfully');
  }

  /**
   * Service destruction
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('TokenStorageService destroyed');
  }

  /**
   * Store OAuth tokens for a user
   */
  async storeUserTokens(userId: string, tokens: { google?: GoogleTokens; slack?: SlackTokens }): Promise<void> {
    this.assertReady();
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }

    let encryptedGoogleRefreshToken: string | undefined;
    
    // Encrypt Google refresh token if present
    if (tokens.google?.refresh_token) {
      try {
        encryptedGoogleRefreshToken = CryptoUtil.encryptSensitiveData(tokens.google.refresh_token);
        this.logDebug('Encrypted Google refresh token for secure storage', { userId });
      } catch (error) {
        this.logError('Failed to encrypt Google refresh token', { userId, error });
        // Store unencrypted as fallback (not ideal but functional)
        encryptedGoogleRefreshToken = tokens.google.refresh_token;
      }
    }

    // Store in database
    if (this.databaseService) {
      try {
        const userTokens: UserTokens = {
          userId,
          googleTokens: tokens.google ? {
            access_token: tokens.google.access_token,
            refresh_token: encryptedGoogleRefreshToken,
            expires_at: tokens.google.expires_at,
            token_type: tokens.google.token_type,
            scope: tokens.google.scope
          } : undefined,
          slackTokens: tokens.slack,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.databaseService.storeUserTokens(userTokens);
        
        // Cache the tokens for quick access
        if (this.cacheService) {
          await this.cacheService.set(`tokens:${userId}`, userTokens, this.TOKEN_CACHE_TTL);
        }

        this.logInfo('Successfully stored user tokens', { 
          userId,
          hasGoogleTokens: !!tokens.google,
          hasSlackTokens: !!tokens.slack,
          googleTokenType: tokens.google?.token_type
        });

        // Audit log token storage
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', `tokens:${userId}`, userId, undefined, {
          googleTokens: !!tokens.google,
          slackTokens: !!tokens.slack,
          encrypted: !!encryptedGoogleRefreshToken
        });

      } catch (error) {
        this.logError('Failed to store user tokens', { userId, error });
        throw new Error(`Failed to store tokens for user ${userId}: ${error}`);
      }
    } else {
      throw new Error('Database service not available for token storage');
    }
  }

  /**
   * Get OAuth tokens for a user
   */
  async getUserTokens(userId: string): Promise<UserTokens | null> {
    this.assertReady();
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }

    // Try cache first
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get(`tokens:${userId}`);
        if (cached) {
          this.logDebug('Retrieved tokens from cache', { userId });
          return cached as UserTokens;
        }
      } catch (error) {
        this.logWarn('Failed to retrieve tokens from cache', { userId, error });
      }
    }

    // Get from database
    if (this.databaseService) {
      try {
        const tokens = await this.databaseService.getUserTokens(userId);
        if (tokens) {
          // Decrypt Google refresh token if present
          if (tokens.googleTokens?.refresh_token) {
            try {
              tokens.googleTokens.refresh_token = CryptoUtil.decryptSensitiveData(tokens.googleTokens.refresh_token);
            } catch (error) {
              this.logWarn('Failed to decrypt Google refresh token, using as-is', { userId });
            }
          }

          // Cache for future use
          if (this.cacheService) {
            await this.cacheService.set(`tokens:${userId}`, tokens, this.TOKEN_CACHE_TTL);
          }

          this.logDebug('Retrieved tokens from database', { userId });
          return tokens;
        }
        
        this.logDebug('No tokens found for user', { userId });
        return null;
      } catch (error) {
        this.logError('Failed to retrieve user tokens', { userId, error });
        return null;
      }
    }

    return null;
  }

  /**
   * Get Google access token with automatic refresh
   */
  async getGoogleAccessToken(userId: string): Promise<string | null> {
    this.assertReady();
    
    const tokens = await this.getUserTokens(userId);
    if (!tokens?.googleTokens?.access_token) {
      this.logDebug('No Google tokens found for user', { userId });
      return null;
    }

    const googleTokens = tokens.googleTokens;

    // Check if token is expired and try to refresh
    if (googleTokens.expires_at && new Date() > googleTokens.expires_at) {
      this.logInfo('Google access token expired, attempting refresh', { userId });
      
      const refreshedTokens = await this.refreshGoogleAccessToken(userId, googleTokens.refresh_token);
      if (refreshedTokens) {
        this.logInfo('Successfully refreshed Google access token', { userId });
        return refreshedTokens.access_token;
      }
      
      this.logWarn('Failed to refresh Google access token', { userId });
      return null;
    }

    return googleTokens.access_token;
  }

  /**
   * Refresh Google access token using refresh token
   */
  private async refreshGoogleAccessToken(userId: string, refreshToken: string | undefined): Promise<{ access_token: string; expires_in: number } | null> {
    if (!refreshToken) {
      this.logWarn('No refresh token available for Google OAuth renewal', { userId });
      return null;
    }

    try {
      const configService = (this as any).serviceManager?.getService('configService');
      if (!configService) {
        this.logError('Config service not available for token refresh', { userId });
        return null;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: configService.googleClientId,
          client_secret: configService.googleClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logError('Failed to refresh Google access token', { 
          userId, 
          status: response.status,
          error: errorText 
        });
        return null;
      }

      const tokenData = await response.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };
      
      // Update stored tokens with new access token
      const currentTokens = await this.getUserTokens(userId);
      if (currentTokens?.googleTokens) {
        const updatedGoogleTokens: GoogleTokens = {
          ...currentTokens.googleTokens,
          access_token: tokenData.access_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)),
          // Keep existing refresh token or update if provided
          refresh_token: tokenData.refresh_token || currentTokens.googleTokens.refresh_token
        };
        
        await this.storeUserTokens(userId, {
          google: updatedGoogleTokens,
          slack: currentTokens.slackTokens
        });
      }

      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      };

    } catch (error: any) {
      this.logError('Error refreshing Google access token', { userId, error: error?.message || error });
      
      // If refresh fails with 400 (invalid refresh token), user needs to re-authenticate
      if (error?.status === 400 || error?.message?.includes('invalid_grant')) {
        this.logWarn('Refresh token is invalid, user will need to re-authenticate', { userId });
        // Could optionally clean up the invalid tokens here
      }
      
      return null;
    }
  }

  /**
   * Delete tokens for a user (logout)
   */
  async deleteUserTokens(userId: string): Promise<boolean> {
    this.assertReady();
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }

    try {
      // Remove from database
      if (this.databaseService) {
        await this.databaseService.deleteUserTokens(userId);
      }

      // Remove from cache
      if (this.cacheService) {
        await this.cacheService.del(`tokens:${userId}`);
      }

      this.logInfo('Successfully deleted user tokens', { userId });
      
      // Audit log token deletion
      AuditLogger.logOAuthEvent('OAUTH_TOKENS_REVOKED', `tokens:${userId}`, userId, undefined, {});

      return true;
    } catch (error) {
      this.logError('Failed to delete user tokens', { userId, error });
      return false;
    }
  }

  /**
   * Clean up expired tokens (can be called periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    this.assertReady();
    
    if (this.databaseService) {
      try {
        const count = await this.databaseService.cleanupExpiredTokens();
        if (count > 0) {
          this.logInfo('Cleaned up expired tokens', { count });
        }
        return count;
      } catch (error) {
        this.logError('Failed to cleanup expired tokens', { error });
        return 0;
      }
    }
    return 0;
  }
}