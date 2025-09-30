import { BaseService } from './base-service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { CryptoUtil } from '../utils/crypto.util';
import { AuditLogger } from '../utils/audit-logger';
// import { validateUserId } from '../utils/service-validation.util';
import { serviceManager } from "./service-manager";

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  token_type?: string;
  scope?: string;
}

export interface SlackTokens {
  access_token?: string | undefined;
  team_id?: string | undefined;
  user_id?: string | undefined;
}

export interface UserTokens {
  userId: string;
  googleTokens?: GoogleTokens | undefined;
  slackTokens?: SlackTokens | undefined;
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
  private inMemoryTokens: Map<string, UserTokens> = new Map();
  
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
      this.logWarn('Database service not available, falling back to in-memory storage');
      this.logWarn('⚠️  OAuth tokens will NOT persist across server restarts!');
    } else if (!(this.databaseService as any)._initializationFailed && this.databaseService.isReady()) {
      this.logInfo('✅ Database service available for persistent OAuth token storage');
    } else {
      this.logWarn('Database service failed to initialize, falling back to in-memory storage');
      this.logWarn('⚠️  OAuth tokens will NOT persist across server restarts!');
    }
    
    if (this.cacheService) {
      this.logInfo('✅ Cache service available for token caching');
    } else {
      this.logInfo('Cache service not available, operating without token caching');
    }

    this.logInfo('TokenStorageService initialized with OAuth token management');
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

    if (!userId) {
      throw new Error('Valid userId is required');
    }

    // const validatedUserId = validateUserId(userId);

    // Validate Google tokens if present
    if (tokens.google && !tokens.google.access_token) {
      this.logError('Attempted to store Google tokens without access_token', {
        userId,
        hasGoogle: !!tokens.google,
        hasAccessToken: !!tokens.google?.access_token
      });
      throw new Error('Cannot store Google tokens without access_token');
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

    // Store in database if available
    if (this.databaseService && this.databaseService.isReady()) {
      try {
        const googleTokens: GoogleTokens = {
          access_token: tokens.google!.access_token
        };
        
        if (encryptedGoogleRefreshToken) googleTokens.refresh_token = encryptedGoogleRefreshToken;
        if (tokens.google!.expires_at) googleTokens.expires_at = tokens.google!.expires_at;
        if (tokens.google!.token_type) googleTokens.token_type = tokens.google!.token_type;
        if (tokens.google!.scope) googleTokens.scope = tokens.google!.scope;
        
        const userTokens: UserTokens = {
          userId,
          googleTokens,
          slackTokens: tokens.slack,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.databaseService.storeUserTokens(userTokens);
        
        // Cache the tokens for quick access
        if (this.cacheService) {
          await this.cacheService.set(`tokens:${userId}`, userTokens, this.TOKEN_CACHE_TTL);
        }

        this.logInfo('Successfully stored user tokens in database', { 
          userId,
          hasGoogleTokens: !!tokens.google,
          hasSlackTokens: !!tokens.slack,
          googleTokenType: tokens.google?.token_type
        });

        // Audit log token storage
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', `tokens:${userId}`, userId, undefined, {
          googleTokens: !!tokens.google,
          slackTokens: !!tokens.slack,
          encrypted: !!encryptedGoogleRefreshToken,
          storageType: 'database'
        });

      } catch (error) {
        this.logError('Failed to store user tokens in database', { userId, error });
        // Fall back to in-memory storage
        this.logWarn('Falling back to in-memory storage', { userId });
        
        // Store in memory as fallback
        const googleTokens: GoogleTokens = {
          access_token: tokens.google!.access_token
        };
        
        if (tokens.google!.refresh_token) googleTokens.refresh_token = tokens.google!.refresh_token;
        if (tokens.google!.expires_at) googleTokens.expires_at = tokens.google!.expires_at;
        if (tokens.google!.token_type) googleTokens.token_type = tokens.google!.token_type;
        if (tokens.google!.scope) googleTokens.scope = tokens.google!.scope;
        
        const userTokens: UserTokens = {
          userId,
          googleTokens,
          slackTokens: tokens.slack,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        this.inMemoryTokens.set(userId, userTokens);
        
        // Cache the tokens for quick access
        if (this.cacheService) {
          await this.cacheService.set(`tokens:${userId}`, userTokens, this.TOKEN_CACHE_TTL);
        }

        this.logInfo('Successfully stored user tokens in memory (fallback)', { 
          userId,
          hasGoogleTokens: !!tokens.google,
          hasSlackTokens: !!tokens.slack,
          googleTokenType: tokens.google?.token_type,
          storageType: 'memory'
        });

        // Audit log token storage
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', `tokens:${userId}`, userId, undefined, {
          googleTokens: !!tokens.google,
          slackTokens: !!tokens.slack,
          storageType: 'memory'
        });
      }
    } else {
      // Database not available, store in memory directly
      const userTokens: UserTokens = {
        userId,
        googleTokens: tokens.google ? {
          access_token: tokens.google.access_token,
          refresh_token: tokens.google.refresh_token || undefined, // Store unencrypted in memory
          expires_at: tokens.google.expires_at || undefined,
          token_type: tokens.google.token_type || undefined,
          scope: tokens.google.scope || undefined
        } : undefined,
        slackTokens: tokens.slack,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.inMemoryTokens.set(userId, userTokens);
      
      // Cache the tokens for quick access
      if (this.cacheService) {
        await this.cacheService.set(`tokens:${userId}`, userTokens, this.TOKEN_CACHE_TTL);
      }

      this.logInfo('Successfully stored user tokens in memory', { 
        userId,
        hasGoogleTokens: !!tokens.google,
        hasSlackTokens: !!tokens.slack,
        googleTokenType: tokens.google?.token_type,
        storageType: 'memory'
      });

      // Audit log token storage
      AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', `tokens:${userId}`, userId, undefined, {
        googleTokens: !!tokens.google,
        slackTokens: !!tokens.slack,
        storageType: 'memory'
      });
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
    if (this.databaseService && this.databaseService.isReady() && !(this.databaseService as any)._initializationFailed) {
      try {
        this.logInfo('Querying database for tokens', { 
          userId, 
          userIdType: typeof userId,
          userIdLength: userId?.length,
          databaseServiceReady: this.databaseService.isReady()
        });
        const tokens = await this.databaseService.getUserTokens(userId);
        this.logInfo('Database query result', { 
          userId, 
          hasTokens: !!tokens, 
          hasGoogleTokens: !!tokens?.googleTokens,
          hasGoogleAccessToken: !!tokens?.googleTokens?.access_token,
          tokensCreatedAt: tokens?.createdAt,
          tokensUpdatedAt: tokens?.updatedAt
        });
        if (tokens) {
          // Decrypt Google refresh token if present
          if (tokens.googleTokens?.refresh_token) {
            try {
              // Check if the token is encrypted
              if (CryptoUtil.isEncrypted(tokens.googleTokens.refresh_token)) {
                tokens.googleTokens.refresh_token = CryptoUtil.decryptSensitiveData(tokens.googleTokens.refresh_token);
                this.logDebug('Successfully decrypted Google refresh token', { userId });
              } else {
                this.logDebug('Google refresh token is not encrypted (stored in plain text)', { userId });
                // Encrypt it for security
                try {
                  const encrypted = CryptoUtil.encryptSensitiveData(tokens.googleTokens.refresh_token);
                  await this.databaseService!.updateUserTokenRefreshToken(userId, encrypted);
                  this.logInfo('Encrypted plain text refresh token for security', { userId });
                } catch (encryptError) {
                  this.logWarn('Failed to encrypt plain text refresh token', { userId, error: encryptError });
                }
              }
            } catch (error) {
              this.logError('Failed to decrypt Google refresh token', { userId, error });
              // Remove the corrupted token to prevent further issues
              try {
                await this.databaseService!.updateUserTokenRefreshToken(userId, null);
                this.logInfo('Removed corrupted refresh token', { userId });
              } catch (removeError) {
                this.logError('Failed to remove corrupted refresh token', { userId, error: removeError });
              }
            }
          }

          // Cache for future use
          if (this.cacheService) {
            await this.cacheService.set(`tokens:${userId}`, tokens, this.TOKEN_CACHE_TTL);
          }

          this.logDebug('Retrieved tokens from database', { userId });
          return tokens;
        }
        
        this.logDebug('No tokens found for user in database', { userId });
      } catch (error) {
        this.logError('Failed to retrieve user tokens from database', { userId, error });
      }
    } else {
      this.logInfo('Database not available, using in-memory storage', { 
        userId, 
        hasDatabaseService: !!this.databaseService,
        databaseReady: this.databaseService?.isReady(),
        databaseFailed: !!(this.databaseService as any)?._initializationFailed
      });
    }

    // Fallback to in-memory storage
    const inMemoryTokens = this.inMemoryTokens.get(userId);
    if (inMemoryTokens) {
      this.logDebug('Retrieved tokens from memory', { userId });
      return inMemoryTokens;
    }
    
    this.logDebug('No tokens found for user in any storage', { userId });
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
      const configService = serviceManager.getService('configService') as any;
      if (!configService) {
        this.logError('Config service not available for token refresh', { userId });
        return null;
      }

      const response = await globalThis.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new (globalThis.URLSearchParams || globalThis.require('url').URLSearchParams)({
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
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000))
        };
        
        if (tokenData.refresh_token || currentTokens.googleTokens.refresh_token) {
          updatedGoogleTokens.refresh_token = tokenData.refresh_token || currentTokens.googleTokens.refresh_token;
        }
        
        const storeOptions: {
          google?: GoogleTokens;
          slack?: SlackTokens;
        } = {
          google: updatedGoogleTokens
        };
        
        if (currentTokens.slackTokens) {
          storeOptions.slack = currentTokens.slackTokens;
        }
        
        await this.storeUserTokens(userId, storeOptions);
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

      // Remove from in-memory storage
      this.inMemoryTokens.delete(userId);

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

  /**
   * Remove user tokens (used by TokenManager)
   */
  async removeUserTokens(userId: string): Promise<void> {
    this.assertReady();
    
    try {
      if (this.databaseService) {
        // Remove from database
        await this.databaseService.query(
          'DELETE FROM user_tokens WHERE user_id = $1',
          [userId]
        );
      }
      
      // Remove from memory
      this.inMemoryTokens.delete(userId);
      
      // Remove from cache
      if (this.cacheService) {
        await this.cacheService.del(`tokens:${userId}`);
      }
      
      this.logInfo('Successfully removed user tokens', { userId });
    } catch (error) {
      this.logError('Failed to remove user tokens', error as Error, { userId });
      throw error;
    }
  }
}