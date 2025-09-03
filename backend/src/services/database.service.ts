import { Pool, PoolClient, QueryResult } from 'pg';
import { BaseService } from './base-service';
import logger from '../utils/logger';
import { serviceManager } from './service-manager';
import { ConfigService } from '../config/config.service';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
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

export class DatabaseService extends BaseService {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    super('DatabaseService');
    
    // Initialize with default config, will be updated in onInitialize
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'assistantapp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
    };
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Get config service from ServiceManager
    const configService = serviceManager.getService<ConfigService>('configService');
    
    if (configService) {
      // Parse DATABASE_URL or use individual config
      const databaseUrl = configService.databaseUrl;
      if (databaseUrl) {
        const url = new URL(databaseUrl);
        this.config = {
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1), // Remove leading slash
          user: url.username,
          password: url.password,
          ssl: {
            rejectUnauthorized: false // Allow self-signed certificates for Railway
          },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        };
      }
    }
    
    // In test environment, skip actual database connection
    if (process.env.NODE_ENV === 'test') {
      this.logInfo('Database service initialized in test mode - skipping actual connection');
      return;
    }
    
    try {
      this.logInfo('Initializing database connection pool...', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        ssl: typeof this.config.ssl === 'object' ? 'rejectUnauthorized: false' : this.config.ssl
      });

      this.pool = new Pool(this.config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.logInfo('Database connection pool initialized successfully');
      
      // Initialize database schema
      await this.initializeSchema();
      
    } catch (error) {
      this.logError('Failed to initialize database service:', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.logInfo('Database connection pool closed');
    }
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema(): Promise<void> {
    try {
      const client = await this.getClient();
      
      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          conversation_history JSONB DEFAULT '[]',
          tool_calls JSONB DEFAULT '[]',
          tool_results JSONB DEFAULT '[]',
          slack_context JSONB
        )
      `);

      // Create OAuth tokens table
      await client.query(`
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          session_id VARCHAR(255) PRIMARY KEY,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TIMESTAMP NOT NULL,
          token_type VARCHAR(50) DEFAULT 'Bearer',
          scope TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // Create Slack workspaces table
      await client.query(`
        CREATE TABLE IF NOT EXISTS slack_workspaces (
          team_id VARCHAR(255) PRIMARY KEY,
          team_name VARCHAR(255) NOT NULL,
          access_token TEXT NOT NULL,
          bot_user_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create Slack users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS slack_users (
          slack_user_id VARCHAR(255),
          team_id VARCHAR(255) NOT NULL,
          google_user_id VARCHAR(255),
          access_token TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (slack_user_id, team_id),
          FOREIGN KEY (team_id) REFERENCES slack_workspaces(team_id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_slack_users_google_user_id ON slack_users(google_user_id);
      `);

      client.release();
      this.logInfo('Database schema initialized successfully');
      
    } catch (error) {
      this.logError('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Get a database client from the pool
   */
  private async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return await this.pool.connect();
  }

  /**
   * Session management methods
   */
  async createSession(sessionData: SessionData): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        INSERT INTO sessions (
          session_id, user_id, created_at, expires_at, last_activity,
          conversation_history, tool_calls, tool_results, slack_context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (session_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          expires_at = EXCLUDED.expires_at,
          last_activity = EXCLUDED.last_activity,
          conversation_history = EXCLUDED.conversation_history,
          tool_calls = EXCLUDED.tool_calls,
          tool_results = EXCLUDED.tool_results,
          slack_context = EXCLUDED.slack_context
      `, [
        sessionData.sessionId,
        sessionData.userId,
        sessionData.createdAt,
        sessionData.expiresAt,
        sessionData.lastActivity,
        JSON.stringify(sessionData.conversationHistory),
        JSON.stringify(sessionData.toolCalls),
        JSON.stringify(sessionData.toolResults),
        sessionData.slackContext ? JSON.stringify(sessionData.slackContext) : null
      ]);
    } finally {
      client.release();
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM sessions WHERE session_id = $1
      `, [sessionId]);

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
        conversationHistory: row.conversation_history || [],
        toolCalls: row.tool_calls || [],
        toolResults: row.tool_results || [],
        slackContext: row.slack_context
      };
    } finally {
      client.release();
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        UPDATE sessions SET last_activity = CURRENT_TIMESTAMP 
        WHERE session_id = $1
      `, [sessionId]);
    } finally {
      client.release();
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        DELETE FROM sessions WHERE session_id = $1
      `, [sessionId]);
      return result.rowCount ? result.rowCount > 0 : false;
    } finally {
      client.release();
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP
      `);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * OAuth token management methods
   */
  async storeOAuthTokens(tokenData: OAuthTokenData): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        INSERT INTO oauth_tokens (
          session_id, access_token, refresh_token, expires_at,
          token_type, scope, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          token_type = EXCLUDED.token_type,
          scope = EXCLUDED.scope,
          updated_at = CURRENT_TIMESTAMP
      `, [
        tokenData.sessionId,
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiresAt,
        tokenData.tokenType,
        tokenData.scope,
        tokenData.createdAt,
        tokenData.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getOAuthTokens(sessionId: string): Promise<OAuthTokenData | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM oauth_tokens WHERE session_id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        sessionId: row.session_id,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.expires_at,
        tokenType: row.token_type,
        scope: row.scope,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  async deleteOAuthTokens(sessionId: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        DELETE FROM oauth_tokens WHERE session_id = $1
      `, [sessionId]);
      return result.rowCount ? result.rowCount > 0 : false;
    } finally {
      client.release();
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        DELETE FROM oauth_tokens WHERE expires_at < CURRENT_TIMESTAMP
      `);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * New simplified token storage methods
   */
  async storeUserTokens(userTokens: any): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        INSERT INTO user_tokens (
          user_id, 
          google_access_token, google_refresh_token, google_expires_at, google_token_type, google_scope,
          slack_access_token, slack_team_id, slack_user_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id) DO UPDATE SET
          google_access_token = EXCLUDED.google_access_token,
          google_refresh_token = EXCLUDED.google_refresh_token,
          google_expires_at = EXCLUDED.google_expires_at,
          google_token_type = EXCLUDED.google_token_type,
          google_scope = EXCLUDED.google_scope,
          slack_access_token = EXCLUDED.slack_access_token,
          slack_team_id = EXCLUDED.slack_team_id,
          slack_user_id = EXCLUDED.slack_user_id,
          updated_at = CURRENT_TIMESTAMP
      `, [
        userTokens.userId,
        userTokens.googleTokens?.access_token,
        userTokens.googleTokens?.refresh_token,
        userTokens.googleTokens?.expires_at,
        userTokens.googleTokens?.token_type,
        userTokens.googleTokens?.scope,
        userTokens.slackTokens?.access_token,
        userTokens.slackTokens?.team_id,
        userTokens.slackTokens?.user_id,
        userTokens.createdAt,
        userTokens.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getUserTokens(userId: string): Promise<any | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM user_tokens WHERE user_id = $1
      `, [userId]);

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
    } finally {
      client.release();
    }
  }

  async deleteUserTokens(userId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`DELETE FROM user_tokens WHERE user_id = $1`, [userId]);
    } finally {
      client.release();
    }
  }

  async cleanupExpiredUserTokens(): Promise<number> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        DELETE FROM user_tokens 
        WHERE google_expires_at IS NOT NULL 
        AND google_expires_at < CURRENT_TIMESTAMP
      `);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * Slack workspace management methods
   */
  async storeSlackWorkspace(workspaceData: SlackWorkspaceData): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        INSERT INTO slack_workspaces (
          team_id, team_name, access_token, bot_user_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (team_id) DO UPDATE SET
          team_name = EXCLUDED.team_name,
          access_token = EXCLUDED.access_token,
          bot_user_id = EXCLUDED.bot_user_id,
          updated_at = CURRENT_TIMESTAMP
      `, [
        workspaceData.teamId,
        workspaceData.teamName,
        workspaceData.accessToken,
        workspaceData.botUserId,
        workspaceData.createdAt,
        workspaceData.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getSlackWorkspace(teamId: string): Promise<SlackWorkspaceData | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM slack_workspaces WHERE team_id = $1
      `, [teamId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        teamId: row.team_id,
        teamName: row.team_name,
        accessToken: row.access_token,
        botUserId: row.bot_user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Slack user management methods
   */
  async storeSlackUser(userData: SlackUserData): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        INSERT INTO slack_users (
          slack_user_id, team_id, google_user_id, access_token, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slack_user_id, team_id) DO UPDATE SET
          google_user_id = EXCLUDED.google_user_id,
          access_token = EXCLUDED.access_token,
          updated_at = CURRENT_TIMESTAMP
      `, [
        userData.slackUserId,
        userData.teamId,
        userData.googleUserId,
        userData.accessToken,
        userData.createdAt,
        userData.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getSlackUser(slackUserId: string, teamId: string): Promise<SlackUserData | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM slack_users 
        WHERE slack_user_id = $1 AND team_id = $2
      `, [slackUserId, teamId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        slackUserId: row.slack_user_id,
        teamId: row.team_id,
        googleUserId: row.google_user_id,
        accessToken: row.access_token,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  async getSlackUserByGoogleId(googleUserId: string): Promise<SlackUserData | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM slack_users WHERE google_user_id = $1
      `, [googleUserId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        slackUserId: row.slack_user_id,
        teamId: row.team_id,
        googleUserId: row.google_user_id,
        accessToken: row.access_token,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Execute a raw SQL query (for optimization and maintenance)
   */
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const client = await this.getClient();
    try {
      logger.debug('Executing SQL query', { 
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params.length 
      });
      
      const result = await client.query(sql, params);
      
      logger.debug('SQL query completed', { 
        rowCount: result.rowCount,
        commandType: result.command 
      });
      
      return result;
    } catch (error) {
      logger.error('SQL query failed', { sql, params, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    try {
      const healthy = this.isReady() && !!this.pool;
      const details = {
        pool: !!this.pool,
        config: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          ssl: this.config.ssl
        }
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
