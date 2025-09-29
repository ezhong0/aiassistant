import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import logger from '../utils/logger';
import { BaseService } from './base-service';
import { ServiceState } from '../types/service.types';
import { config } from '../config';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
}

export interface SessionData {
  sessionId: string;
  userId?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  conversationHistory: any[];
  toolCalls: any[];
  toolResults: any[];
  slackContext?: any;
  pendingActions?: any[];
}

export interface OAuthTokenData {
  sessionId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlackWorkspaceData {
  teamId: string;
  teamName: string;
  accessToken: string;
  botUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlackUserData {
  slackUserId: string;
  teamId: string;
  googleUserId?: string;
  accessToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database Service with Connection Pooling
 * 
 * This service provides optimized database connection management with:
 * - Proper connection pooling with configurable limits
 * - Connection health monitoring
 * - Automatic reconnection handling
 * - Memory leak prevention
 * - Performance monitoring
 */
export class DatabaseService extends BaseService {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private connectionStats: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    totalQueries: number;
    failedQueries: number;
    averageQueryTime: number;
    lastHealthCheck: Date;
  } = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    totalQueries: 0,
    failedQueries: 0,
    averageQueryTime: 0,
    lastHealthCheck: new Date()
  };

  constructor() {
    super('databaseService');
    
    // Initialize with unified config system
    const dbServiceConfig = config.services.database;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'assistantapp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      // Use unified config for connection pool settings
      max: dbServiceConfig?.poolSize || 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: dbServiceConfig?.timeout || 30000,
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    };
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Parse DATABASE_URL if available (use unified config)
      const databaseUrl = config.databaseUrl;
      if (databaseUrl) {
        const url = new URL(databaseUrl);
        this.config = {
          ...this.config,
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1), // Remove leading slash
          user: url.username,
          password: url.password,
          ssl: url.protocol === 'postgresql:' || url.protocol === 'postgres:' ? { rejectUnauthorized: false } : false
        };
      }

      // Create optimized connection pool
      this.pool = new Pool({
        ...this.config,
        // Additional optimization settings
        allowExitOnIdle: false, // Keep pool alive
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      });

      // Set up pool event handlers
      this.setupPoolEventHandlers();

      // Test the connection
      try {
        await this.testConnection();

        // Start health monitoring only if connection is successful
        this.startHealthMonitoring();
      } catch (error) {
        // In non-production environments, allow graceful degradation
        if (config.isProduction) {
          throw error;
        } else {
          logger.warn('Database connection failed in development - continuing without database', {
            correlationId: `db-connection-warn-${Date.now()}`,
            operation: 'database_connection_warning',
            error: error instanceof Error ? error.message : String(error)
          });
          // Set service state to degraded but functional
          this._state = ServiceState.DEGRADED;
        }
      }

      logger.info('DatabaseService initialized successfully', {
        correlationId: `db-init-${Date.now()}`,
        operation: 'database_service_init',
        metadata: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          maxConnections: this.config.max,
          minConnections: this.config.min
        }
      });

    } catch (error) {
      logger.error('Failed to initialize DatabaseService', error as Error, {
        correlationId: `db-init-${Date.now()}`,
        operation: 'database_service_init_error'
      });
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      if (this.pool) {
        // Gracefully close all connections
        await this.pool.end();
        this.pool = null;
        
        logger.debug('Database connection pool closed', {
          correlationId: `db-destroy-${Date.now()}`,
          operation: 'database_service_destroy',
          metadata: { phase: 'pool_closed' }
        });
      }
    } catch (error) {
      logger.error('Error during database service destruction', error as Error, {
        correlationId: `db-destroy-${Date.now()}`,
        operation: 'database_service_destroy_error'
      });
      
      // Force cleanup
      if (this.pool) {
        this.pool = null;
      }
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const healthy = this.isReady() && this.pool !== null;
    return {
      healthy,
      details: {
        state: this.state,
        poolExists: this.pool !== null,
        connectionStats: this.connectionStats,
        config: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          maxConnections: this.config.max,
          minConnections: this.config.min
        }
      }
    };
  }

  /**
   * Set up pool event handlers for monitoring
   */
  private setupPoolEventHandlers(): void {
    if (!this.pool) return;

    this.pool.on('connect', (client: PoolClient) => {
      this.connectionStats.totalConnections++;
      logger.debug('New database connection established', {
        correlationId: `db-connect-${Date.now()}`,
        operation: 'database_connection',
        metadata: { totalConnections: this.connectionStats.totalConnections }
      });
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.connectionStats.activeConnections++;
      logger.debug('Database connection acquired', {
        correlationId: `db-acquire-${Date.now()}`,
        operation: 'database_connection_acquire',
        metadata: { activeConnections: this.connectionStats.activeConnections }
      });
    });

    this.pool.on('release', (err: Error, client: PoolClient) => {
      this.connectionStats.activeConnections = Math.max(0, this.connectionStats.activeConnections - 1);
      logger.debug('Database connection released', {
        correlationId: `db-release-${Date.now()}`,
        operation: 'database_connection_release',
        metadata: { activeConnections: this.connectionStats.activeConnections }
      });
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.connectionStats.totalConnections = Math.max(0, this.connectionStats.totalConnections - 1);
      logger.debug('Database connection removed', {
        correlationId: `db-remove-${Date.now()}`,
        operation: 'database_connection_remove',
        metadata: { totalConnections: this.connectionStats.totalConnections }
      });
    });

    this.pool.on('error', (error: Error, client: PoolClient) => {
      this.connectionStats.failedQueries++;
      logger.error('Database pool error', error, {
        correlationId: `db-error-${Date.now()}`,
        operation: 'database_pool_error',
        metadata: { failedQueries: this.connectionStats.failedQueries }
      });
    });
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    try {
      const result = await this.pool.query('SELECT NOW() as current_time');
      const queryTime = Date.now() - startTime;
      
      logger.debug('Database connection test successful', {
        correlationId: `db-test-${Date.now()}`,
        operation: 'database_connection_test',
        metadata: { queryTime, currentTime: result.rows[0]?.current_time }
      });
    } catch (error) {
      logger.error('Database connection test failed', error as Error, {
        correlationId: `db-test-${Date.now()}`,
        operation: 'database_connection_test_error'
      });
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.updateConnectionStats();
        this.connectionStats.lastHealthCheck = new Date();
        
        // Log warnings if connection usage is high
        if (this.connectionStats.activeConnections > (this.config.max || 10) * 0.8) {
          logger.warn('High database connection usage', {
            correlationId: `db-health-${Date.now()}`,
            operation: 'database_health_check',
            metadata: {
              activeConnections: this.connectionStats.activeConnections,
              maxConnections: this.config.max,
              usagePercentage: Math.round((this.connectionStats.activeConnections / (this.config.max || 10)) * 100)
            }
          });
        }
      } catch (error) {
        logger.error('Database health check failed', error as Error, {
          correlationId: `db-health-${Date.now()}`,
          operation: 'database_health_check_error'
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update connection statistics
   */
  private async updateConnectionStats(): Promise<void> {
    if (!this.pool) return;

    try {
      const result = await this.pool.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = $1
      `, [this.config.database]);

      if (result.rows.length > 0) {
        const stats = result.rows[0];
        this.connectionStats.totalConnections = parseInt(stats.total_connections) || 0;
        this.connectionStats.activeConnections = parseInt(stats.active_connections) || 0;
        this.connectionStats.idleConnections = parseInt(stats.idle_connections) || 0;
      }
    } catch (error) {
      // Ignore errors in stats collection
      logger.debug('Failed to update connection stats', {
        correlationId: `db-stats-${Date.now()}`,
        operation: 'database_stats_update',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  /**
   * Execute a query with performance monitoring
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    this.connectionStats.totalQueries++;

    try {
      const result = await this.pool.query(text, params);
      const queryTime = Date.now() - startTime;
      
      // Update average query time
      this.connectionStats.averageQueryTime = 
        (this.connectionStats.averageQueryTime * (this.connectionStats.totalQueries - 1) + queryTime) / 
        this.connectionStats.totalQueries;

      // Log slow queries
      if (queryTime > 1000) { // 1 second threshold
        logger.warn('Slow database query detected', {
          correlationId: `db-slow-${Date.now()}`,
          operation: 'database_slow_query',
          metadata: { queryTime, query: text.substring(0, 100) }
        });
      }

      return result;
    } catch (error) {
      this.connectionStats.failedQueries++;
      logger.error('Database query failed', error as Error, {
        correlationId: `db-query-${Date.now()}`,
        operation: 'database_query_error',
        metadata: { query: text.substring(0, 100), params }
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      return await this.pool.connect();
    } catch (error) {
      logger.error('Failed to get database client', error as Error, {
        correlationId: `db-client-${Date.now()}`,
        operation: 'database_client_error'
      });
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): typeof this.connectionStats {
    return { ...this.connectionStats };
  }

  /**
   * Get pool configuration
   */
  getPoolConfig(): DatabaseConfig {
    return { ...this.config };
  }

  /**
   * Check if database is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Session management methods (simplified)
  async createSession(sessionData: Omit<SessionData, 'createdAt' | 'lastActivity'>): Promise<void> {
    const query = `
      INSERT INTO sessions (session_id, user_id, expires_at, conversation_history, tool_calls, tool_results, slack_context, pending_actions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        expires_at = EXCLUDED.expires_at,
        conversation_history = EXCLUDED.conversation_history,
        tool_calls = EXCLUDED.tool_calls,
        tool_results = EXCLUDED.tool_results,
        slack_context = EXCLUDED.slack_context,
        pending_actions = EXCLUDED.pending_actions,
        last_activity = NOW()
    `;
    
    await this.query(query, [
      sessionData.sessionId,
      sessionData.userId,
      sessionData.expiresAt,
      JSON.stringify(sessionData.conversationHistory),
      JSON.stringify(sessionData.toolCalls),
      JSON.stringify(sessionData.toolResults),
      JSON.stringify(sessionData.slackContext),
      JSON.stringify(sessionData.pendingActions)
    ]);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const query = 'SELECT * FROM sessions WHERE session_id = $1';
    const result = await this.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastActivity: row.last_activity,
      conversationHistory: JSON.parse(row.conversation_history || '[]'),
      toolCalls: JSON.parse(row.tool_calls || '[]'),
      toolResults: JSON.parse(row.tool_results || '[]'),
      slackContext: row.slack_context ? JSON.parse(row.slack_context) : undefined,
      pendingActions: row.pending_actions ? JSON.parse(row.pending_actions) : undefined
    };
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const query = 'UPDATE sessions SET last_activity = NOW() WHERE session_id = $1';
    await this.query(query, [sessionId]);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const query = 'DELETE FROM sessions WHERE session_id = $1';
    await this.query(query, [sessionId]);
  }

  /**
   * Store user tokens in the database
   */
  async storeUserTokens(userTokens: {
    userId: string;
    googleTokens?: any;
    slackTokens?: any;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<void> {
    const query = `
      INSERT INTO user_tokens (
        user_id, 
        google_access_token, google_refresh_token, google_expires_at, google_token_type, google_scope,
        slack_access_token, slack_team_id, slack_user_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        google_access_token = EXCLUDED.google_access_token,
        google_refresh_token = EXCLUDED.google_refresh_token,
        google_expires_at = EXCLUDED.google_expires_at,
        google_token_type = EXCLUDED.google_token_type,
        google_scope = EXCLUDED.google_scope,
        slack_access_token = EXCLUDED.slack_access_token,
        slack_team_id = EXCLUDED.slack_team_id,
        slack_user_id = EXCLUDED.slack_user_id,
        updated_at = EXCLUDED.updated_at
    `;
    
    await this.query(query, [
      userTokens.userId,
      userTokens.googleTokens?.access_token || null,
      userTokens.googleTokens?.refresh_token || null,
      userTokens.googleTokens?.expires_at || null,
      userTokens.googleTokens?.token_type || null,
      userTokens.googleTokens?.scope || null,
      userTokens.slackTokens?.access_token || null,
      userTokens.slackTokens?.team_id || null,
      userTokens.slackTokens?.user_id || null,
      userTokens.createdAt,
      userTokens.updatedAt
    ]);
  }

  /**
   * Get user tokens from the database
   */
  async getUserTokens(userId: string): Promise<{
    userId: string;
    googleTokens?: any;
    slackTokens?: any;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const query = `
      SELECT 
        user_id,
        google_access_token, google_refresh_token, google_expires_at, google_token_type, google_scope,
        slack_access_token, slack_team_id, slack_user_id,
        created_at, updated_at
      FROM user_tokens 
      WHERE user_id = $1
    `;
    
    const result = await this.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      userId: row.user_id,
      googleTokens: row.google_access_token ? {
        access_token: row.google_access_token,
        refresh_token: row.google_refresh_token,
        expires_at: row.google_expires_at,
        token_type: row.google_token_type,
        scope: row.google_scope
      } : undefined,
      slackTokens: row.slack_access_token ? {
        access_token: row.slack_access_token,
        team_id: row.slack_team_id,
        user_id: row.slack_user_id
      } : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update user token refresh token
   */
  async updateUserTokenRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    const query = `
      UPDATE user_tokens 
      SET google_refresh_token = $2, updated_at = NOW()
      WHERE user_id = $1
    `;
    
    await this.query(query, [userId, refreshToken]);
  }

  /**
   * Delete user tokens from the database
   */
  async deleteUserTokens(userId: string): Promise<void> {
    const query = `DELETE FROM user_tokens WHERE user_id = $1`;
    await this.query(query, [userId]);
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const query = `
      DELETE FROM user_tokens 
      WHERE updated_at < NOW() - INTERVAL '30 days'
    `;
    
    const result = await this.query(query);
    return result.rowCount || 0;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const query = 'DELETE FROM sessions WHERE expires_at < NOW() RETURNING session_id';
    const result = await this.query(query);
    return result.rowCount || 0;
  }
}
