import { 
  SessionContext, 
  ConversationEntry, 
  ToolCall, 
  ToolResult,
  SessionExpiredError 
} from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG, REQUEST_LIMITS } from '../config/app-config';
import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import logger from '../utils/logger';
import { CryptoUtil } from '../utils/crypto.util';
import { AuditLogger } from '../utils/audit-logger';
import { DatabaseService, SessionData, OAuthTokenData } from './database.service';
import { FileTokenStorage, FileTokenData } from '../utils/file-token-storage';

export class SessionService extends BaseService {
  private databaseService: DatabaseService | null = null;
  private cacheService: CacheService | null = null;
  private fileTokenStorage: FileTokenStorage;
  private sessions: Map<string, SessionContext> | null = null;
  private readonly defaultTimeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Cache TTL constants
  private readonly SESSION_CACHE_TTL = 1800; // 30 minutes

  constructor(timeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes) {
    super('SessionService');
    this.defaultTimeoutMinutes = timeoutMinutes;
    this.fileTokenStorage = new FileTokenStorage();
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Starting SessionService initialization...');
    
    // Get database service from service manager
    const serviceManager = (this as any).serviceManager;
    if (serviceManager) {
      this.databaseService = serviceManager.getService('databaseService') as DatabaseService;
      this.cacheService = serviceManager.getService('cacheService') as CacheService;
    }
    
    if (!this.databaseService) {
      this.logWarn('Database service not available, falling back to in-memory storage');
      this.logWarn('⚠️  OAuth tokens will NOT persist across server restarts!');
      // Fallback to in-memory storage if database is not available
      this.sessions = new Map<string, SessionContext>();
    } else {
      this.logInfo('✅ Database service available for persistent OAuth token storage');
      this.logInfo(`Database service state: ${this.databaseService.state}`);
      this.logInfo(`Database service ready: ${this.databaseService.isReady()}`);
    }
    
    if (this.cacheService) {
      this.logInfo('✅ Cache service available for session caching');
    } else {
      this.logInfo('Cache service not available, operating without session caching');
    }
    
    // Clean up expired sessions using configured interval (now less frequent for long-lived sessions)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, TIMEOUTS.sessionCleanup);

    // Log session persistence info
    this.logInfo(`SessionService initialized with ${this.defaultTimeoutMinutes} minute timeout (~${Math.round(this.defaultTimeoutMinutes / (24 * 60))} days)`);
    this.logInfo(`Session cleanup runs every ${Math.round(TIMEOUTS.sessionCleanup / (60 * 60 * 1000))} hours`);
    this.logInfo('🔐 OAuth tokens will persist across deployments and restarts');
    this.logInfo('SessionService initialization completed successfully');
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all sessions (only for in-memory fallback)
    if (this.sessions) {
      this.sessions.clear();
    }
    this.logInfo('SessionService destroyed');
  }

  /**
   * Create a new session or return existing one
   */
  createSession(sessionId: string, userId?: string): SessionContext {
    this.assertReady();
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.defaultTimeoutMinutes * 60 * 1000));

    const session: SessionContext = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      conversationHistory: [],
      toolCalls: [],
      toolResults: []
    };

    if (this.databaseService) {
      // Store in database
      const sessionData: SessionData = {
        sessionId,
        userId,
        createdAt: now,
        expiresAt,
        lastActivity: now,
        conversationHistory: [],
        toolCalls: [],
        toolResults: []
      };
      
      this.databaseService.createSession(sessionData).catch(error => {
        this.logError('Failed to store session in database:', error);
      });
    } else {
      // Fallback to in-memory storage
      this.sessions!.set(sessionId, session);
    }

    this.logDebug('Created new session', { sessionId, userId, expiresAt });
    
    // Audit log session creation
    AuditLogger.logSessionEvent('SESSION_CREATED', sessionId, {
      userId,
      expiresAt: expiresAt.toISOString(),
      storageType: this.databaseService ? 'database' : 'memory'
    });
    
    return session;
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(sessionId: string, userId?: string): Promise<SessionContext> {
    this.assertReady();
    
    let session: SessionContext | undefined;
    
    if (this.databaseService) {
      // Try to get from database
      const sessionData = await this.databaseService.getSession(sessionId);
      if (sessionData) {
        session = {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          createdAt: sessionData.createdAt,
          expiresAt: sessionData.expiresAt,
          lastActivity: sessionData.lastActivity,
          conversationHistory: sessionData.conversationHistory,
          toolCalls: sessionData.toolCalls,
          toolResults: sessionData.toolResults
        };
        
        // Update last activity
        session.lastActivity = new Date();
        session.userId = userId || session.userId;
        
        // Update in database
        await this.databaseService.updateSessionActivity(sessionId);
      }
    } else {
      // Fallback to in-memory storage
      session = this.sessions!.get(sessionId);
      if (session) {
        // Update last activity
        session.lastActivity = new Date();
        session.userId = userId || session.userId;
      }
    }
    
    if (!session) {
      session = this.createSession(sessionId, userId);
    }
    
    return session;
  }

  /**
   * Get an existing session
   */
  async getSession(sessionId: string): Promise<SessionContext | undefined> {
    this.assertReady();
    
    // Try cache first
    if (this.cacheService) {
      const cachedSession = await this.cacheService.get<SessionContext>(`session:${sessionId}`);
      if (cachedSession) {
        this.logDebug('Cache hit for session', { sessionId });
        return cachedSession;
      }
    }
    
    if (this.databaseService) {
      const sessionData = await this.databaseService.getSession(sessionId);
      if (sessionData) {
        const session = {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          createdAt: sessionData.createdAt,
          expiresAt: sessionData.expiresAt,
          lastActivity: sessionData.lastActivity,
          conversationHistory: sessionData.conversationHistory,
          toolCalls: sessionData.toolCalls,
          toolResults: sessionData.toolResults
        };
        
        if (this.isSessionExpired(session)) {
          this.logWarn('Session expired', { sessionId, expiresAt: session.expiresAt });
          
          // Audit log session expiry
          AuditLogger.logSessionEvent('SESSION_EXPIRED', sessionId, {
            expiresAt: session.expiresAt.toISOString(),
            cleanupType: 'automatic'
          });
          
          await this.databaseService.deleteSession(sessionId);
          
          // Remove from cache as well
          if (this.cacheService) {
            await this.cacheService.del(`session:${sessionId}`);
          }
          
          return undefined;
        }
        
        // Cache the session for future use
        if (this.cacheService) {
          await this.cacheService.set(`session:${sessionId}`, session, this.SESSION_CACHE_TTL);
          this.logDebug('Cached session for future use', { sessionId });
        }
        
        return session;
      }
      return undefined;
    } else {
      // Fallback to in-memory storage
      const session = this.sessions!.get(sessionId);
      if (session && this.isSessionExpired(session)) {
        this.logWarn('Session expired', { sessionId, expiresAt: session.expiresAt });
        this.sessions!.delete(sessionId);
        return undefined;
      }
      
      return session;
    }
  }

  /**
   * Check if a session exists and is valid
   */
  hasValidSession(sessionId: string): boolean {
    this.assertReady();
    
    const session = this.sessions?.get(sessionId);
    return session !== undefined && !this.isSessionExpired(session);
  }

  /**
   * Add a conversation entry to a session
   */
  async addConversationEntry(sessionId: string, entry: ConversationEntry): Promise<void> {
    this.assertReady();
    
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check conversation history limits
    if (session.conversationHistory.length >= REQUEST_LIMITS.conversation.maxHistory) {
      // Remove oldest entry
      session.conversationHistory.shift();
    }

    // Check content length limits
    if (entry.content && entry.content.length > REQUEST_LIMITS.conversation.maxContentLength) {
      entry.content = entry.content.substring(0, REQUEST_LIMITS.conversation.maxContentLength) + '...';
    }

    session.conversationHistory.push(entry);
    session.lastActivity = new Date();
    
    this.logDebug('Added conversation entry', { 
      sessionId, 
      entryType: entry.type,
      contentLength: entry.content?.length || 0
    });
  }

  /**
   * Add tool calls to a session
   */
  async addToolCalls(sessionId: string, toolCalls: ToolCall[]): Promise<void> {
    this.assertReady();
    
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.toolCalls.push(...toolCalls);
    session.lastActivity = new Date();
    
    this.logDebug('Added tool calls to session', { 
      sessionId, 
      toolCallCount: toolCalls.length,
      toolNames: toolCalls.map(tc => tc.name)
    });
  }

  /**
   * Add tool results to a session
   */
  async addToolResults(sessionId: string, toolResults: ToolResult[]): Promise<void> {
    this.assertReady();
    
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.toolResults.push(...toolResults);
    session.lastActivity = new Date();
    
    this.logDebug('Added tool results to session', { 
      sessionId, 
      resultCount: toolResults.length,
      successfulResults: toolResults.filter(r => r.success).length
    });
  }

  /**
   * Get conversation context for a session
   */
  async getConversationContext(sessionId: string): Promise<string | null> {
    this.assertReady();
    
    const session = await this.getSession(sessionId);
    if (!session || session.conversationHistory.length === 0) {
      return null;
    }

    // Get recent conversation entries
    const recentEntries = session.conversationHistory
      .slice(-5) // Last 5 entries
      .map(entry => `${entry.type}: ${entry.content}`)
      .join('\n');

    return recentEntries;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    this.assertReady();
    
    const deleted = this.sessions?.delete(sessionId) || false;
    if (deleted) {
      this.logInfo('Session deleted', { sessionId });
    }
    return deleted;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    this.assertReady();
    
    return this.sessions?.size || 0;
  }

  /**
   * Check if a session is expired
   */
  private isSessionExpired(session: SessionContext): boolean {
    return new Date() > session.expiresAt;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    this.assertNotDestroyed();
    
    const beforeCount = this.sessions?.size || 0;
    const now = new Date();
    
    for (const [sessionId, session] of (this.sessions?.entries() || [])) {
      if (this.isSessionExpired(session)) {
        this.sessions?.delete(sessionId);
        this.logDebug('Cleaned up expired session', { sessionId, expiresAt: session.expiresAt });
      }
    }
    
    const afterCount = this.sessions?.size || 0;
    const cleanedCount = beforeCount - afterCount;
    
    if (cleanedCount > 0) {
      this.logInfo('Session cleanup completed', { 
        cleanedCount, 
        remainingSessions: afterCount 
      });
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    this.assertReady();
    
    const sessions = Array.from(this.sessions?.values() || []);
    const activeSessions = sessions.filter(s => !this.isSessionExpired(s));
    const expiredSessions = sessions.filter(s => this.isSessionExpired(s));
    
    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      expiredSessions: expiredSessions.length
    };
  }

  /**
   * Store OAuth tokens for a Slack user
   */
  async storeOAuthTokens(
    sessionId: string, 
    tokens: {
      google?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
        expiry_date?: number;
      };
      slack?: {
        access_token?: string;
        team_id?: string;
        user_id?: string;
      };
    }
  ): Promise<boolean> {
    this.assertReady();
    
    const session = await this.getSession(sessionId);
    if (!session) {
      this.logWarn('Cannot store OAuth tokens - session not found', { sessionId });
      return false;
    }

    if (this.databaseService && this.databaseService.isReady() && tokens.google) {
      // Store Google tokens in database with encryption for sensitive data
      const expiresAt = tokens.google.expiry_date 
        ? new Date(tokens.google.expiry_date)
        : new Date(Date.now() + (tokens.google.expires_in || 3600) * 1000);
      
      // Encrypt the refresh token before storage
      let encryptedRefreshToken: string | undefined;
      if (tokens.google.refresh_token) {
        try {
          encryptedRefreshToken = CryptoUtil.encryptSensitiveData(tokens.google.refresh_token);
          this.logDebug('Encrypted refresh token for secure storage', { sessionId });
        } catch (error) {
          this.logError('Failed to encrypt refresh token, storing without encryption', { 
            sessionId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          encryptedRefreshToken = tokens.google.refresh_token;
        }
      }
      
      const tokenData: OAuthTokenData = {
        sessionId,
        accessToken: tokens.google.access_token,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        tokenType: tokens.google.token_type || 'Bearer',
        scope: tokens.google.scope || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      try {
        await this.databaseService.storeOAuthTokens(tokenData);
        
        this.logInfo('✅ Stored Google OAuth tokens in database', { 
          sessionId, 
          hasRefreshToken: !!tokens.google.refresh_token,
          expiresAt: expiresAt.toISOString(),
          databaseService: this.databaseService.constructor.name,
          databaseState: this.databaseService.state
        });
        
        // Audit log OAuth token storage
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', sessionId, session.userId, undefined, {
          hasRefreshToken: !!tokens.google.refresh_token,
          expiresAt: expiresAt.toISOString(),
          tokenEncrypted: !!encryptedRefreshToken && encryptedRefreshToken !== tokens.google.refresh_token,
          storageType: 'database'
        });
        return true;
      } catch (error) {
        this.logError('❌ Failed to store OAuth tokens in database, falling back to file storage', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId,
          databaseService: this.databaseService.constructor.name,
          databaseState: this.databaseService.state
        });
        // Continue to file storage fallback below
      }
    }
    
    // Database not available or failed - try file storage as fallback
    if (tokens.google) {
      const expiresAt = tokens.google.expiry_date 
        ? new Date(tokens.google.expiry_date)
        : new Date(Date.now() + (tokens.google.expires_in || 3600) * 1000);
      
      const fileTokenData: FileTokenData = {
        sessionId,
        accessToken: tokens.google.access_token,
        refreshToken: tokens.google.refresh_token,
        expiresAt: expiresAt.getTime(),
        tokenType: tokens.google.token_type || 'Bearer',
        scope: tokens.google.scope || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const fileStored = await this.fileTokenStorage.storeTokens(fileTokenData);
      if (fileStored) {
        this.logInfo('✅ Stored Google OAuth tokens in file system', { 
          sessionId, 
          hasRefreshToken: !!tokens.google.refresh_token,
          expiresAt: expiresAt.toISOString(),
          storageType: 'file'
        });
        
        // Audit log file storage
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', sessionId, session.userId, undefined, {
          hasRefreshToken: !!tokens.google.refresh_token,
          expiresAt: expiresAt.toISOString(),
          storageType: 'file'
        });
        return true;
      } else {
        this.logError('❌ Failed to store OAuth tokens in file system, falling back to memory', { sessionId });
      }
    }
    
    // Final fallback to in-memory storage
    if (this.sessions) {
      // Fallback to in-memory storage
      // Initialize oauthTokens if it doesn't exist
      if (!session.oauthTokens) {
        session.oauthTokens = {};
      }

      // Store Google tokens
      if (tokens.google) {
        session.oauthTokens.google = {
          ...session.oauthTokens.google,
          ...tokens.google
        };
        this.logInfo('Stored Google OAuth tokens in memory', { 
          sessionId, 
          hasRefreshToken: !!tokens.google.refresh_token,
          expiresIn: tokens.google.expires_in 
        });
      }

      // Store Slack tokens
      if (tokens.slack) {
        session.oauthTokens.slack = {
          ...session.oauthTokens.slack,
          ...tokens.slack
        };
        this.logInfo('Stored Slack OAuth tokens in memory', { 
          sessionId, 
          teamId: tokens.slack.team_id,
          userId: tokens.slack.user_id 
        });
      }
    }

    // Update last activity
    session.lastActivity = new Date();
    
    return true;
  }

  /**
   * Get OAuth tokens for a session
   */
  async getOAuthTokens(sessionId: string): Promise<{
    google?: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
      expiry_date?: number;
    };
    slack?: {
      access_token?: string;
      team_id?: string;
      user_id?: string;
    };
  } | null> {
    this.assertReady();
    
    // Try database first if available
    if (this.databaseService && this.databaseService.isReady()) {
      try {
        const tokenData = await this.databaseService.getOAuthTokens(sessionId);
        if (tokenData) {
          // Decrypt refresh token if it's encrypted
          let decryptedRefreshToken = tokenData.refreshToken;
          if (tokenData.refreshToken && CryptoUtil.isEncrypted(tokenData.refreshToken)) {
            try {
              decryptedRefreshToken = CryptoUtil.decryptSensitiveData(tokenData.refreshToken);
              this.logDebug('Decrypted refresh token from storage', { sessionId });
            } catch (error) {
              this.logError('Failed to decrypt refresh token, using as-is', { 
                sessionId, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
              decryptedRefreshToken = tokenData.refreshToken;
            }
          }
          
          this.logDebug('✅ Retrieved OAuth tokens from database', {
            sessionId,
            hasAccessToken: !!tokenData.accessToken,
            hasRefreshToken: !!decryptedRefreshToken,
            expiresAt: tokenData.expiresAt.toISOString(),
            refreshTokenEncrypted: tokenData.refreshToken !== decryptedRefreshToken
          });
          
          // Audit log OAuth token retrieval
          AuditLogger.logOAuthEvent('OAUTH_TOKENS_RETRIEVED', sessionId, undefined, undefined, {
            hasAccessToken: !!tokenData.accessToken,
            hasRefreshToken: !!decryptedRefreshToken,
            expiresAt: tokenData.expiresAt.toISOString(),
            decryptionRequired: tokenData.refreshToken !== decryptedRefreshToken,
            storageType: 'database'
          });
          
          return {
            google: {
              access_token: tokenData.accessToken,
              refresh_token: decryptedRefreshToken,
              expires_in: Math.floor((tokenData.expiresAt.getTime() - Date.now()) / 1000),
              token_type: tokenData.tokenType,
              scope: tokenData.scope,
              expiry_date: tokenData.expiresAt.getTime()
            }
          };
        } else {
          this.logDebug('No OAuth tokens found in database', { sessionId });
        }
      } catch (error) {
        this.logError('❌ Failed to retrieve OAuth tokens from database, trying file storage', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId,
          databaseService: this.databaseService.constructor.name,
          databaseState: this.databaseService.state
        });
      }
    }
    
    // Try file storage as fallback
    try {
      const fileTokenData = await this.fileTokenStorage.getTokens(sessionId);
      if (fileTokenData) {
        this.logDebug('✅ Retrieved OAuth tokens from file storage', {
          sessionId,
          hasAccessToken: !!fileTokenData.accessToken,
          hasRefreshToken: !!fileTokenData.refreshToken,
          expiresAt: new Date(fileTokenData.expiresAt).toISOString()
        });
        
        // Audit log file storage retrieval
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_RETRIEVED', sessionId, undefined, undefined, {
          hasAccessToken: !!fileTokenData.accessToken,
          hasRefreshToken: !!fileTokenData.refreshToken,
          expiresAt: new Date(fileTokenData.expiresAt).toISOString(),
          storageType: 'file'
        });
        
        return {
          google: {
            access_token: fileTokenData.accessToken,
            refresh_token: fileTokenData.refreshToken,
            expires_in: Math.floor((fileTokenData.expiresAt - Date.now()) / 1000),
            token_type: fileTokenData.tokenType,
            scope: fileTokenData.scope,
            expiry_date: fileTokenData.expiresAt
          }
        };
      } else {
        this.logDebug('No OAuth tokens found in file storage', { sessionId });
      }
    } catch (error) {
      this.logError('❌ Failed to retrieve OAuth tokens from file storage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      });
    }
    
    // Final fallback to in-memory storage
    if (this.sessions) {
      // Fallback to in-memory storage
      this.logDebug('Using in-memory storage for OAuth tokens', { sessionId });
      const session = await this.getSession(sessionId);
      if (!session || !session.oauthTokens) {
        return null;
      }
      return session.oauthTokens;
    }
    
    // No storage available
    return null;
  }

    /**
   * Get Google access token for a session
   */
  async getGoogleAccessToken(sessionId: string): Promise<string | null> {
    this.assertReady();
    
    const tokens = await this.getOAuthTokens(sessionId);
    if (!tokens?.google?.access_token) {
      return null;
    }

    // Check if token is expired and try to refresh
    if (tokens.google.expiry_date && Date.now() > tokens.google.expiry_date) {
      this.logInfo('Google access token is expired, attempting refresh', { sessionId });
      
      // Try to refresh the token
      const refreshedTokens = await this.refreshGoogleAccessToken(sessionId, tokens.google.refresh_token);
      if (refreshedTokens) {
        this.logInfo('Successfully refreshed Google access token', { sessionId });
        return refreshedTokens.access_token;
      }
      
      this.logWarn('Failed to refresh Google access token', { sessionId });
      return null;
    }

    return tokens.google.access_token;
  }

  /**
   * Refresh Google access token using refresh token
   */
  private async refreshGoogleAccessToken(sessionId: string, refreshToken: string | undefined): Promise<{ access_token: string; expires_in: number } | null> {
    if (!refreshToken) {
      this.logWarn('No refresh token available for Google OAuth renewal', { sessionId });
      return null;
    }

    try {
      const configService = (this as any).serviceManager?.getService('configService');
      if (!configService) {
        this.logError('Config service not available for token refresh', { sessionId });
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
          sessionId, 
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
      const currentTokens = await this.getOAuthTokens(sessionId);
      if (currentTokens?.google) {
        const updatedTokens = {
          ...currentTokens,
          google: {
            ...currentTokens.google,
            access_token: tokenData.access_token,
            expiry_date: Date.now() + (tokenData.expires_in * 1000),
            // Keep existing refresh token or update if provided
            refresh_token: tokenData.refresh_token || currentTokens.google.refresh_token
          }
        };
        
        await this.storeOAuthTokens(sessionId, updatedTokens);
      }

      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      };

    } catch (error: any) {
      this.logError('Error refreshing Google access token', { sessionId, error: error?.message || error });
      
      // If refresh fails with 400 (invalid refresh token), mark for re-authentication
      if (error?.status === 400 || error?.message?.includes('invalid_grant')) {
        this.logWarn('Refresh token is invalid, user will need to re-authenticate', { sessionId });
        // Could optionally clean up the invalid session here
      }
      
      return null;
    }
  }

  /**
   * Find session by Slack user context
   */
  findSessionBySlackUser(teamId: string, userId: string): string | null {
    this.assertReady();
    
    for (const [sessionId, session] of (this.sessions?.entries() || [])) {
      if (session.oauthTokens?.slack?.team_id === teamId && 
          session.oauthTokens?.slack?.user_id === userId) {
        return sessionId;
      }
    }
    
    return null;
  }

  // ===== SLACK-SPECIFIC SESSION METHODS =====
  
  /**
   * Generate a consistent, canonical session ID for a Slack user
   * Format: user:${teamId}:${userId} (standardized across all services)
   */
  private generateSlackSessionId(teamId: string, userId: string): string {
    // Validate inputs to prevent malformed session IDs
    if (!teamId || !userId || typeof teamId !== 'string' || typeof userId !== 'string') {
      throw new Error(`Invalid session ID parameters: teamId=${teamId}, userId=${userId}`);
    }
    
    // Use standardized format across all services
    return `user:${teamId}:${userId}`;
  }
  
  /**
   * Parse a session ID to extract team and user information
   */
  public static parseSlackSessionId(sessionId: string): { teamId: string; userId: string } | null {
    const match = sessionId.match(/^user:([^:]+):([^:]+)$/);
    if (!match || match.length < 3) {
      return null;
    }
    return {
      teamId: match[1]!,
      userId: match[2]!
    };
  }

  /**
   * Get or create a session for a Slack user
   */
  async getSlackSession(teamId: string, userId: string): Promise<{
    sessionId: string;
    userId: string;
    teamId: string;
    oauthTokens?: any;
    conversations?: any;
  }> {
    const sessionId = this.generateSlackSessionId(teamId, userId);
    
    this.logDebug('Getting/creating Slack session', { 
      sessionId, 
      teamId, 
      userId 
    });
    
    const session = await this.getOrCreateSession(sessionId, userId);
    
    return {
      sessionId: session.sessionId,
      userId: session.userId || userId,
      teamId,
      oauthTokens: session.oauthTokens,
      conversations: session.conversations
    };
  }

  /**
   * Store OAuth tokens for a Slack user
   */
  async storeSlackOAuthTokens(teamId: string, userId: string, tokens: {
    google?: any;
    slack?: {
      access_token?: string;
      team_id?: string;
      user_id?: string;
    };
  }): Promise<boolean> {
    const sessionId = this.generateSlackSessionId(teamId, userId);
    
    this.logInfo('Storing OAuth tokens for Slack user', { 
      sessionId, 
      teamId, 
      userId,
      hasAccessToken: !!tokens.google?.access_token,
      hasRefreshToken: !!tokens.google?.refresh_token
    });
    
    // Ensure session exists before storing tokens
    await this.getOrCreateSession(sessionId, userId);
    
    return await this.storeOAuthTokens(sessionId, tokens);
  }

  /**
   * Get OAuth tokens for a Slack user
   */
  async getSlackOAuthTokens(teamId: string, userId: string): Promise<any | null> {
    const sessionId = this.generateSlackSessionId(teamId, userId);
    
    this.logDebug('Retrieving OAuth tokens for Slack user', { 
      sessionId, 
      teamId, 
      userId 
    });
    
    return await this.getOAuthTokens(sessionId);
  }

  /**
   * Get Google access token for a Slack user
   */
  async getSlackGoogleAccessToken(teamId: string, userId: string): Promise<string | null> {
    const sessionId = this.generateSlackSessionId(teamId, userId);
    
    this.logDebug('Retrieving Google access token for Slack user', { 
      sessionId, 
      teamId, 
      userId 
    });
    
    return await this.getGoogleAccessToken(sessionId);
  }

  /**
   * Update conversation context for a specific channel/thread
   */
  async updateSlackConversationContext(
    teamId: string, 
    userId: string, 
    channelId: string, 
    threadTs?: string,
    context?: any
  ): Promise<void> {
    const sessionId = this.generateSlackSessionId(teamId, userId);
    const session = await this.getSession(sessionId);
    
    if (!session) {
      this.logWarn('Session not found for conversation context update', { 
        sessionId, 
        teamId, 
        userId 
      });
      return;
    }
    
    // Initialize conversations structure if it doesn't exist
    if (!session.conversations) {
      session.conversations = {};
    }
    if (!session.conversations[channelId]) {
      session.conversations[channelId] = {};
    }
    
    const conversationKey = threadTs || 'main';
    const existingConversation = session.conversations[channelId][conversationKey];
    
    session.conversations[channelId][conversationKey] = {
      lastActivity: new Date(),
      messageCount: (existingConversation?.messageCount || 0) + 1,
      context: context || existingConversation?.context
    };
    
    // Update session activity
    session.lastActivity = new Date();
    
    this.logDebug('Updated conversation context', { 
      sessionId, 
      channelId, 
      threadTs, 
      messageCount: session.conversations[channelId][conversationKey].messageCount 
    });
  }

  /**
   * Check if a Slack user has valid OAuth tokens
   */
  async hasSlackValidOAuthTokens(teamId: string, userId: string): Promise<boolean> {
    const tokens = await this.getSlackOAuthTokens(teamId, userId);
    
    if (!tokens?.google?.access_token) {
      return false;
    }
    
    // Check if token is expired
    if (tokens.google.expiry_date && Date.now() > tokens.google.expiry_date) {
      this.logDebug('OAuth tokens expired for Slack user', { 
        teamId, 
        userId,
        expiryDate: new Date(tokens.google.expiry_date).toISOString()
      });
      return false;
    }
    
    return true;
  }

  /**
   * Get Slack session statistics for debugging
   */
  async getSlackSessionStats(teamId: string, userId: string): Promise<any> {
    const sessionId = this.generateSlackSessionId(teamId, userId);
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return { exists: false };
    }
    
    return {
      exists: true,
      sessionId: session.sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      hasOAuthTokens: !!session.oauthTokens,
      hasGoogleTokens: !!session.oauthTokens?.google?.access_token,
      hasSlackTokens: !!session.oauthTokens?.slack,
      conversationChannels: session.conversations ? Object.keys(session.conversations).length : 0,
      totalMessages: session.conversations ? 
        Object.values(session.conversations).reduce((total: number, channel: any) => 
          total + Object.values(channel).reduce((sum: number, conv: any) => sum + conv.messageCount, 0), 0
        ) : 0
    };
  }
}
