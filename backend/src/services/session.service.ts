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
import { DatabaseService, SessionData, OAuthTokenData } from './database.service';

export class SessionService extends BaseService {
  private databaseService: DatabaseService | null = null;
  private cacheService: CacheService | null = null;
  private sessions: Map<string, SessionContext> | null = null;
  private readonly defaultTimeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Cache TTL constants
  private readonly SESSION_CACHE_TTL = 1800; // 30 minutes

  constructor(timeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes) {
    super('SessionService');
    this.defaultTimeoutMinutes = timeoutMinutes;
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
    
    // Clean up expired sessions using configured interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, TIMEOUTS.sessionCleanup);

    this.logInfo(`SessionService initialized with ${this.defaultTimeoutMinutes} minute timeout`);
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

    if (this.databaseService && tokens.google) {
      // Store Google tokens in database
      const expiresAt = tokens.google.expiry_date 
        ? new Date(tokens.google.expiry_date)
        : new Date(Date.now() + (tokens.google.expires_in || 3600) * 1000);
      
      const tokenData: OAuthTokenData = {
        sessionId,
        accessToken: tokens.google.access_token,
        refreshToken: tokens.google.refresh_token,
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
      } catch (error) {
        this.logError('❌ Failed to store OAuth tokens in database, falling back to memory', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId,
          databaseService: this.databaseService.constructor.name,
          databaseState: this.databaseService.state
        });
        
        // Fallback to in-memory storage
        if (!session.oauthTokens) {
          session.oauthTokens = {};
        }
        session.oauthTokens.google = {
          ...session.oauthTokens.google,
          ...tokens.google
        };
      }
    } else if (this.sessions) {
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
    
    if (this.databaseService) {
      // Try to get from database first
      try {
        const tokenData = await this.databaseService.getOAuthTokens(sessionId);
        if (tokenData) {
          this.logDebug('✅ Retrieved OAuth tokens from database', {
            sessionId,
            hasAccessToken: !!tokenData.accessToken,
            hasRefreshToken: !!tokenData.refreshToken,
            expiresAt: tokenData.expiresAt.toISOString()
          });
          
          return {
            google: {
              access_token: tokenData.accessToken,
              refresh_token: tokenData.refreshToken,
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
        this.logError('❌ Failed to retrieve OAuth tokens from database', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId,
          databaseService: this.databaseService.constructor.name,
          databaseState: this.databaseService.state
        });
      }
      return null;
    } else {
      // Fallback to in-memory storage
      this.logDebug('Using in-memory storage for OAuth tokens', { sessionId });
      const session = await this.getSession(sessionId);
      if (!session || !session.oauthTokens) {
        return null;
      }
      return session.oauthTokens;
    }
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

    // Check if token is expired
    if (tokens.google.expiry_date && Date.now() > tokens.google.expiry_date) {
      this.logWarn('Google access token is expired', { sessionId });
      return null;
    }

    return tokens.google.access_token;
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
}

// Export the class for registration with ServiceManager
