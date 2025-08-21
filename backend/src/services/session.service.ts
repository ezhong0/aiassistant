import logger from '../utils/logger';
import { 
  SessionContext, 
  ConversationEntry, 
  ToolCall, 
  ToolResult,
  SessionExpiredError 
} from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG, REQUEST_LIMITS } from '../config/app-config';

export class SessionService {
  private sessions: Map<string, SessionContext> = new Map();
  private readonly defaultTimeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes;
  private cleanupInterval: NodeJS.Timeout;

  constructor(timeoutMinutes: number = EXECUTION_CONFIG.session.defaultTimeoutMinutes) {
    this.defaultTimeoutMinutes = timeoutMinutes;
    
    // Clean up expired sessions using configured interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, TIMEOUTS.sessionCleanup);

    logger.info(`SessionService initialized with ${timeoutMinutes} minute timeout`);
  }

  /**
   * Create a new session or return existing one
   */
  createSession(sessionId: string, userId?: string): SessionContext {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.defaultTimeoutMinutes * 60 * 1000));

    const session: SessionContext = {
      sessionId,
      userId,
      createdAt: now,
      lastActivity: now,
      conversationHistory: [],
      toolExecutionHistory: [],
      expiresAt
    };

    this.sessions.set(sessionId, session);
    logger.info(`Created new session: ${sessionId}${userId ? ` for user: ${userId}` : ''}`);
    
    return session;
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): SessionContext | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      this.deleteSession(sessionId);
      throw new SessionExpiredError(sessionId);
    }

    // Update last activity and extend expiration
    session.lastActivity = new Date();
    session.expiresAt = new Date(session.lastActivity.getTime() + (this.defaultTimeoutMinutes * 60 * 1000));

    return session;
  }

  /**
   * Get or create a session
   */
  getOrCreateSession(sessionId: string, userId?: string): SessionContext {
    let session = this.getSession(sessionId);
    
    if (!session) {
      session = this.createSession(sessionId, userId);
    }

    return session;
  }

  /**
   * Add conversation entry to session
   */
  addConversationEntry(
    sessionId: string,
    userInput: string,
    agentResponse: string,
    toolCalls: ToolCall[] = [],
    toolResults: ToolResult[] = []
  ): void {
    const session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entry: ConversationEntry = {
      timestamp: new Date(),
      userInput,
      agentResponse,
      toolCalls,
      toolResults
    };

    session.conversationHistory.push(entry);

    // Keep only last 10 conversation entries to prevent memory bloat
    if (session.conversationHistory.length > 10) {
      session.conversationHistory = session.conversationHistory.slice(-10);
    }

    logger.info(`Added conversation entry to session ${sessionId}`);
  }

  /**
   * Add tool execution result to session
   */
  addToolResult(sessionId: string, toolResult: ToolResult): void {
    const session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.toolExecutionHistory.push(toolResult);

    // Keep only last 20 tool results
    if (session.toolExecutionHistory.length > 20) {
      session.toolExecutionHistory = session.toolExecutionHistory.slice(-20);
    }

    logger.info(`Added tool result for ${toolResult.toolName} to session ${sessionId}`);
  }

  /**
   * Update session with new data
   */
  updateSession(sessionId: string, updates: Partial<SessionContext>): void {
    let session = this.getSession(sessionId);
    
    if (!session) {
      // Create session if it doesn't exist
      logger.info(`Session ${sessionId} not found, creating new one`);
      session = this.createSession(sessionId, updates.userId);
    }

    Object.assign(session, updates);
    logger.info(`Updated session ${sessionId}`);
  }

  /**
   * Get conversation context for AI
   */
  getConversationContext(sessionId: string): string {
    const session = this.getSession(sessionId);
    
    if (!session || session.conversationHistory.length === 0) {
      return '';
    }

    // Build context from recent conversation history
    const contextParts: string[] = [];
    
    contextParts.push('Previous conversation context:');
    
    session.conversationHistory.slice(-5).forEach((entry, index) => {
      contextParts.push(`${index + 1}. User: ${entry.userInput}`);
      contextParts.push(`   Assistant: ${entry.agentResponse}`);
      
      if (entry.toolCalls.length > 0) {
        contextParts.push(`   Tools used: ${entry.toolCalls.map(tc => tc.name).join(', ')}`);
      }
    });

    return contextParts.join('\n');
  }

  /**
   * Get recent tool results that might be relevant
   */
  getRecentToolResults(sessionId: string, toolName?: string): ToolResult[] {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return [];
    }

    let results = session.toolExecutionHistory.slice(-10); // Last 10 results

    if (toolName) {
      results = results.filter(result => result.toolName === toolName);
    }

    return results;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    
    if (deleted) {
      logger.info(`Deleted session: ${sessionId}`);
    }
    
    return deleted;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): any {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    const toolUsage = session.toolExecutionHistory.reduce((acc, result) => {
      acc[result.toolName] = (acc[result.toolName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      conversationCount: session.conversationHistory.length,
      toolExecutionCount: session.toolExecutionHistory.length,
      toolUsage,
      minutesActive: Math.round((session.lastActivity.getTime() - session.createdAt.getTime()) / 60000)
    };
  }

  /**
   * Get all active sessions (for monitoring)
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.sessions.clear();
    logger.info('SessionService destroyed');
  }
}