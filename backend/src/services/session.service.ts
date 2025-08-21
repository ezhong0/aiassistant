import { 
  SessionContext, 
  ConversationEntry, 
  ToolCall, 
  ToolResult,
  SessionExpiredError 
} from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG, REQUEST_LIMITS } from '../config/app-config';
import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import logger from '../utils/logger';

export class SessionService extends BaseService {
  private sessions: Map<string, SessionContext> = new Map();
  private readonly defaultTimeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(timeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes) {
    super('SessionService');
    this.defaultTimeoutMinutes = timeoutMinutes;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Clean up expired sessions using configured interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, TIMEOUTS.sessionCleanup);

    this.logInfo(`SessionService initialized with ${this.defaultTimeoutMinutes} minute timeout`);
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all sessions
    this.sessions.clear();
    this.logInfo('SessionService destroyed, all sessions cleared');
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

    this.sessions.set(sessionId, session);
    this.logDebug('Created new session', { sessionId, userId, expiresAt });
    
    return session;
  }

  /**
   * Get or create a session
   */
  getOrCreateSession(sessionId: string, userId?: string): SessionContext {
    this.assertReady();
    
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = this.createSession(sessionId, userId);
    } else {
      // Update last activity
      session.lastActivity = new Date();
      session.userId = userId || session.userId;
    }
    
    return session;
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): SessionContext | undefined {
    this.assertReady();
    
    const session = this.sessions.get(sessionId);
    if (session && this.isSessionExpired(session)) {
      this.logWarn('Session expired', { sessionId, expiresAt: session.expiresAt });
      this.sessions.delete(sessionId);
      return undefined;
    }
    
    return session;
  }

  /**
   * Check if a session exists and is valid
   */
  hasValidSession(sessionId: string): boolean {
    this.assertReady();
    
    const session = this.sessions.get(sessionId);
    return session !== undefined && !this.isSessionExpired(session);
  }

  /**
   * Add a conversation entry to a session
   */
  addConversationEntry(sessionId: string, entry: ConversationEntry): void {
    this.assertReady();
    
    const session = this.getSession(sessionId);
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
  addToolCalls(sessionId: string, toolCalls: ToolCall[]): void {
    this.assertReady();
    
    const session = this.getSession(sessionId);
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
  addToolResults(sessionId: string, toolResults: ToolResult[]): void {
    this.assertReady();
    
    const session = this.getSession(sessionId);
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
  getConversationContext(sessionId: string): string | null {
    this.assertReady();
    
    const session = this.getSession(sessionId);
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
   * Extend session timeout
   */
  extendSession(sessionId: string, additionalMinutes: number): void {
    this.assertReady();
    
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const maxExtension = EXECUTION_CONFIG.session.maxTimeoutMinutes - this.defaultTimeoutMinutes;
    const actualExtension = Math.min(additionalMinutes, maxExtension);
    
    session.expiresAt = new Date(session.expiresAt.getTime() + (actualExtension * 60 * 1000));
    session.lastActivity = new Date();
    
    this.logInfo('Extended session timeout', { 
      sessionId, 
      additionalMinutes: actualExtension,
      newExpiresAt: session.expiresAt
    });
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    this.assertReady();
    
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.logInfo('Session deleted', { sessionId });
    }
    return deleted;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): SessionContext[] {
    this.assertReady();
    
    return Array.from(this.sessions.values())
      .filter(session => !this.isSessionExpired(session));
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    this.assertReady();
    
    return this.sessions.size;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    this.assertReady();
    
    return Array.from(this.sessions.values())
      .filter(session => !this.isSessionExpired(session))
      .length;
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
    
    const beforeCount = this.sessions.size;
    const now = new Date();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
        this.logDebug('Cleaned up expired session', { sessionId, expiresAt: session.expiresAt });
      }
    }
    
    const afterCount = this.sessions.size;
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
    averageSessionAge: number;
  } {
    this.assertReady();
    
    const now = new Date();
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => !this.isSessionExpired(s));
    const expiredSessions = sessions.filter(s => this.isSessionExpired(s));
    
    const totalAge = activeSessions.reduce((sum, session) => {
      return sum + (now.getTime() - session.createdAt.getTime());
    }, 0);
    
    const averageSessionAge = activeSessions.length > 0 
      ? totalAge / activeSessions.length 
      : 0;
    
    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      expiredSessions: expiredSessions.length,
      averageSessionAge
    };
  }
}

// Export the class for registration with ServiceManager
export { SessionService };
