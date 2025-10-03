/**
 * SessionManager - Manages conversation sessions with hybrid storage
 *
 * Architecture:
 * - In-memory Map for fast access (< 1ms)
 * - Redis backup for reliability and failover
 * - 5-minute TTL for sessions (matches undo window)
 */

import { randomUUID } from 'crypto';
import { BaseService } from './base-service';
import { ServiceState } from '../types/service.types';
import { CacheService } from './cache.service';
import logger from '../utils/logger';
import {
  SessionState,
  CreateSessionOptions,
  MasterState,
  SubAgentStates,
  ConversationMessage,
} from '../types/session.types';

export class SessionManager extends BaseService {
  private sessions: Map<string, SessionState> = new Map();
  private readonly SESSION_TTL = 300; // 5 minutes in seconds
  private readonly REDIS_PREFIX = 'session';
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private cacheService: CacheService) {
    super('sessionManager');
  }

  protected async onInitialize(): Promise<void> {
    logger.info('SessionManager initializing', {
      correlationId: 'session-init',
      operation: 'session_manager_init',
    });

    // Start cleanup timer (every minute)
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);

    logger.info('SessionManager initialized successfully', {
      correlationId: 'session-init',
      operation: 'session_manager_init',
    });
  }

  protected async onDestroy(): Promise<void> {
    logger.info('SessionManager shutting down', {
      correlationId: 'session-destroy',
      operation: 'session_manager_destroy',
    });

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Clear in-memory sessions
    this.sessions.clear();

    logger.info('SessionManager shutdown complete', {
      correlationId: 'session-destroy',
      operation: 'session_manager_destroy',
    });
  }

  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    return {
      healthy: this.state === ServiceState.READY,
      details: {
        state: this.state,
        activeSessions: this.sessions.size,
        cacheAvailable: this.cacheService.getHealth().healthy,
      },
    };
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(options: CreateSessionOptions): Promise<SessionState> {
    const sessionId = options.sessionId || this.generateSessionId();
    const correlationId = `session-${sessionId}`;

    try {
      // 1. Try in-memory (fast path)
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId)!;
        session.lastAccessedAt = Date.now();

        // Update Redis backup asynchronously
        this.saveToRedis(session).catch(error => {
          logger.warn('Failed to update session in Redis', {
            correlationId,
            operation: 'session_redis_update',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

        logger.debug('Session retrieved from memory', {
          correlationId,
          operation: 'get_session',
          sessionId,
          userId: session.userId,
        });

        return session;
      }

      // 2. Try Redis (backup/failover)
      const cached = await this.cacheService.get<SessionState>(`${this.REDIS_PREFIX}:${sessionId}`);
      if (cached) {
        cached.lastAccessedAt = Date.now();
        this.sessions.set(sessionId, cached); // Warm in-memory cache

        // Update Redis with new lastAccessedAt
        this.saveToRedis(cached).catch(error => {
          logger.warn('Failed to update session in Redis', {
            correlationId,
            operation: 'session_redis_update',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

        logger.info('Session retrieved from Redis and warmed in memory', {
          correlationId,
          operation: 'get_session',
          sessionId,
          userId: cached.userId,
        });

        return cached;
      }

      // 3. Create new session
      const newSession = this.createNewSession(sessionId, options.userId);
      this.sessions.set(sessionId, newSession);

      // Save to Redis asynchronously
      this.saveToRedis(newSession).catch(error => {
        logger.warn('Failed to save new session to Redis', {
          correlationId,
          operation: 'session_redis_save',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      logger.info('New session created', {
        correlationId,
        operation: 'create_session',
        sessionId,
        userId: options.userId,
      });

      return newSession;
    } catch (error) {
      logger.error('Error in getOrCreateSession', error as Error, {
        correlationId,
        operation: 'get_or_create_session',
      });
      throw error;
    }
  }

  /**
   * Update session state
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionState, 'sessionId' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    const correlationId = `session-${sessionId}`;

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        logger.warn('Attempted to update non-existent session', {
          correlationId,
          operation: 'update_session',
          sessionId,
        });
        return;
      }

      // Update in-memory
      Object.assign(session, {
        ...updates,
        lastAccessedAt: Date.now(),
      });

      // Save to Redis asynchronously
      this.saveToRedis(session).catch(error => {
        logger.warn('Failed to save updated session to Redis', {
          correlationId,
          operation: 'session_redis_save',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      logger.debug('Session updated', {
        correlationId,
        operation: 'update_session',
        sessionId,
        userId: session.userId,
      });
    } catch (error) {
      logger.error('Error updating session', error as Error, {
        correlationId,
        operation: 'update_session',
      });
      throw error;
    }
  }

  /**
   * Add message to conversation history
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to add message to non-existent session', {
        correlationId: `session-${sessionId}`,
        operation: 'add_message',
        sessionId,
      });
      return;
    }

    session.conversationHistory.push(message);
    session.lastAccessedAt = Date.now();

    // Save to Redis asynchronously
    this.saveToRedis(session).catch(error => {
      logger.warn('Failed to save session after adding message', {
        correlationId: `session-${sessionId}`,
        operation: 'session_redis_save',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const correlationId = `session-${sessionId}`;

    try {
      this.sessions.delete(sessionId);
      await this.cacheService.del(`${this.REDIS_PREFIX}:${sessionId}`);

      logger.info('Session deleted', {
        correlationId,
        operation: 'delete_session',
        sessionId,
      });
    } catch (error) {
      logger.error('Error deleting session', error as Error, {
        correlationId,
        operation: 'delete_session',
      });
    }
  }

  /**
   * Get session by ID (returns null if not found)
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    try {
      // Try in-memory first
      if (this.sessions.has(sessionId)) {
        return this.sessions.get(sessionId)!;
      }

      // Try Redis
      const cached = await this.cacheService.get<SessionState>(`${this.REDIS_PREFIX}:${sessionId}`);
      if (cached) {
        this.sessions.set(sessionId, cached); // Warm cache
        return cached;
      }

      return null;
    } catch (error) {
      logger.error('Error getting session', error as Error, {
        correlationId: `session-${sessionId}`,
        operation: 'get_session',
      });
      return null;
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `sess_${randomUUID()}`;
  }

  /**
   * Create a new session with default values
   */
  private createNewSession(sessionId: string, userId: string): SessionState {
    const now = Date.now();

    return {
      sessionId,
      userId,
      masterState: {
        accumulated_knowledge: '',
        command_list: [],
      },
      subAgentStates: {},
      conversationHistory: [],
      createdAt: now,
      lastAccessedAt: now,
    };
  }

  /**
   * Save session to Redis backup
   */
  private async saveToRedis(session: SessionState): Promise<void> {
    try {
      await this.cacheService.set(
        `${this.REDIS_PREFIX}:${session.sessionId}`,
        session,
        this.SESSION_TTL
      );
    } catch (error) {
      // Don't throw - Redis is backup only
      logger.debug('Redis save failed (continuing with in-memory only)', {
        correlationId: `session-${session.sessionId}`,
        operation: 'save_to_redis',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clean up expired sessions from memory
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiryThreshold = now - (this.SESSION_TTL * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastAccessedAt < expiryThreshold) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', {
        correlationId: 'session-cleanup',
        operation: 'cleanup_expired_sessions',
        cleanedCount,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Get all active session IDs (for debugging/monitoring)
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count (for monitoring)
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
