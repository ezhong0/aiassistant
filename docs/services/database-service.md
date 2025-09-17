# Database Service

The AI Assistant Platform uses **PostgreSQL** as the primary database with connection pooling, transaction management, and comprehensive data persistence. This document details the database architecture, data models, and persistence patterns.

## 🗄️ **Database Architecture**

The platform implements a **PostgreSQL-based data persistence layer** with connection pooling, transaction management, and comprehensive data models.

### **Database Components**

```mermaid
graph TB
    DB_SERVICE[DatabaseService<br/>PostgreSQL Client]
    
    DB_SERVICE --> CONNECTION_POOL[Connection Pool<br/>pg.Pool]
    DB_SERVICE --> QUERY_EXECUTOR[Query Executor<br/>SQL Execution]
    DB_SERVICE --> TRANSACTION_MGR[Transaction Manager<br/>ACID Transactions]
    DB_SERVICE --> MIGRATION_MGR[Migration Manager<br/>Schema Updates]
    
    CONNECTION_POOL --> POSTGRES[PostgreSQL Database<br/>Production Data]
    QUERY_EXECUTOR --> USER_TOKENS[User Tokens Table<br/>OAuth Storage]
    QUERY_EXECUTOR --> OAUTH_TOKENS[OAuth Tokens Table<br/>Token Management]
    QUERY_EXECUTOR --> SESSIONS[Sessions Table<br/>User Sessions]
    
    TRANSACTION_MGR --> ACID[ACID Properties<br/>Data Integrity]
    MIGRATION_MGR --> SCHEMA[Schema Management<br/>Version Control]
```

### **Database Connection Flow**

```mermaid
sequenceDiagram
    participant APP as Application
    participant DB as DatabaseService
    participant POOL as Connection Pool
    participant PG as PostgreSQL
    
    APP->>DB: Query Request
    DB->>POOL: Get Connection
    POOL-->>DB: Available Connection
    DB->>PG: Execute Query
    PG-->>DB: Query Result
    DB->>POOL: Release Connection
    DB-->>APP: Return Result
    
    Note over POOL: Connection Pooling<br/>Efficient Resource Usage
    Note over PG: PostgreSQL Database<br/>ACID Compliance
```

## 🔧 **Database Service Implementation**

### **Core Database Service**

The `DatabaseService` provides the foundation for all database operations:

```typescript
export class DatabaseService extends BaseService {
  private pool: Pool | null = null;
  private readonly DATABASE_URL: string;
  
  constructor() {
    super('databaseService');
    
    this.DATABASE_URL = process.env.DATABASE_URL || 
                       process.env.POSTGRES_URL || 
                       process.env.RAILWAY_DATABASE_URL ||
                       'postgresql://localhost:5432/assistantapp';
  }
  
  protected async onInitialize(): Promise<void> {
    try {
      // Create connection pool with Railway-optimized settings
      this.pool = new Pool({
        connectionString: this.DATABASE_URL,
        ssl: this.DATABASE_URL.includes('postgresql://') ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.DB_POOL_SIZE || '10'), // Maximum number of clients
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // Close idle clients after 30 seconds
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // Return error after 10 seconds
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // Query timeout
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // Query timeout
        application_name: 'ai-assistant-platform'
      });
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.logInfo('Database connection pool initialized successfully', {
        maxConnections: this.pool.options.max,
        databaseUrl: this.maskDatabaseUrl(this.DATABASE_URL)
      });
      
    } catch (error) {
      this.logError('Failed to initialize database connection pool', error);
      throw error;
    }
  }
  
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    
    try {
      return await this.pool.connect();
    } catch (error) {
      this.logError('Failed to get database client', error);
      throw error;
    }
  }
  
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const client = await this.getClient();
    try {
      const result = await client.query<T>(text, params);
      return result;
    } finally {
      client.release();
    }
  }
  
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private maskDatabaseUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}${urlObj.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }
}
```

## 📊 **Database Schema**

### **User Tokens Table**

Stores OAuth tokens for users with encryption support:

```sql
CREATE TABLE IF NOT EXISTS user_tokens (
  user_id VARCHAR(255) PRIMARY KEY,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT,
  google_expires_at TIMESTAMP,
  google_token_type VARCHAR(50) DEFAULT 'Bearer',
  google_scope TEXT,
  slack_access_token TEXT,
  slack_refresh_token TEXT,
  slack_expires_at TIMESTAMP,
  slack_scope TEXT,
  slack_team_id VARCHAR(255),
  slack_user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tokens_google_expires ON user_tokens(google_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tokens_slack_expires ON user_tokens(slack_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tokens_slack_team ON user_tokens(slack_team_id);
```

### **OAuth Tokens Table**

Legacy table for OAuth token storage:

```sql
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
);
```

### **Sessions Table**

Stores user session information:

```sql
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
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
```

### **Confirmations Table**

Stores user confirmation data:

```sql
CREATE TABLE IF NOT EXISTS confirmations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  confirmation_type VARCHAR(100) NOT NULL,
  confirmation_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_confirmations_session_id ON confirmations(session_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_user_id ON confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_status ON confirmations(status);
CREATE INDEX IF NOT EXISTS idx_confirmations_expires_at ON confirmations(expires_at);
```

## 🔄 **Data Persistence Patterns**

### **User Token Management**

```typescript
// Store user tokens
async storeUserTokens(userTokens: UserTokens): Promise<void> {
  const client = await this.getClient();
  try {
    await client.query(`
      INSERT INTO user_tokens (
        user_id, google_access_token, google_refresh_token, google_expires_at,
        google_token_type, google_scope, slack_access_token, slack_refresh_token,
        slack_expires_at, slack_scope, slack_team_id, slack_user_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id) DO UPDATE SET
        google_access_token = EXCLUDED.google_access_token,
        google_refresh_token = EXCLUDED.google_refresh_token,
        google_expires_at = EXCLUDED.google_expires_at,
        google_token_type = EXCLUDED.google_token_type,
        google_scope = EXCLUDED.google_scope,
        slack_access_token = EXCLUDED.slack_access_token,
        slack_refresh_token = EXCLUDED.slack_refresh_token,
        slack_expires_at = EXCLUDED.slack_expires_at,
        slack_scope = EXCLUDED.slack_scope,
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
      userTokens.slackTokens?.accessToken,
      userTokens.slackTokens?.refreshToken,
      userTokens.slackTokens?.expiresAt ? new Date(userTokens.slackTokens.expiresAt) : null,
      userTokens.slackTokens?.scope,
      userTokens.slackTokens?.teamId,
      userTokens.slackTokens?.userId,
      userTokens.createdAt,
      userTokens.updatedAt
    ]);
  } finally {
    client.release();
  }
}

// Retrieve user tokens
async getUserTokens(userId: string): Promise<UserTokens | null> {
  const client = await this.getClient();
  try {
    const result = await client.query(`
      SELECT * FROM user_tokens WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    const userTokens: UserTokens = {
      userId: row.user_id,
      googleTokens: row.google_access_token ? {
        access_token: row.google_access_token,
        refresh_token: row.google_refresh_token,
        expires_at: row.google_expires_at ? new Date(row.google_expires_at) : undefined,
        token_type: row.google_token_type,
        scope: row.google_scope
      } : undefined,
      slackTokens: row.slack_access_token ? {
        accessToken: row.slack_access_token,
        refreshToken: row.slack_refresh_token,
        expiresAt: row.slack_expires_at ? new Date(row.slack_expires_at).getTime() : undefined,
        scope: row.slack_scope,
        teamId: row.slack_team_id,
        userId: row.slack_user_id
      } : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
    
    return userTokens;
  } finally {
    client.release();
  }
}
```

### **Session Management**

```typescript
// Create session
async createSession(sessionData: SessionData): Promise<void> {
  const client = await this.getClient();
  try {
    await client.query(`
      INSERT INTO sessions (
        session_id, user_id, expires_at, last_activity,
        conversation_history, tool_calls, tool_results, slack_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      sessionData.sessionId,
      sessionData.userId,
      sessionData.expiresAt,
      sessionData.lastActivity,
      JSON.stringify(sessionData.conversationHistory || []),
      JSON.stringify(sessionData.toolCalls || []),
      JSON.stringify(sessionData.toolResults || []),
      sessionData.slackContext ? JSON.stringify(sessionData.slackContext) : null
    ]);
  } finally {
    client.release();
  }
}

// Update session
async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
  const client = await this.getClient();
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (updates.lastActivity) {
      setClauses.push(`last_activity = $${paramIndex++}`);
      values.push(updates.lastActivity);
    }
    
    if (updates.conversationHistory) {
      setClauses.push(`conversation_history = $${paramIndex++}`);
      values.push(JSON.stringify(updates.conversationHistory));
    }
    
    if (updates.toolCalls) {
      setClauses.push(`tool_calls = $${paramIndex++}`);
      values.push(JSON.stringify(updates.toolCalls));
    }
    
    if (updates.toolResults) {
      setClauses.push(`tool_results = $${paramIndex++}`);
      values.push(JSON.stringify(updates.toolResults));
    }
    
    if (updates.slackContext) {
      setClauses.push(`slack_context = $${paramIndex++}`);
      values.push(JSON.stringify(updates.slackContext));
    }
    
    if (setClauses.length === 0) {
      return;
    }
    
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(sessionId);
    
    await client.query(`
      UPDATE sessions 
      SET ${setClauses.join(', ')}
      WHERE session_id = $${paramIndex}
    `, values);
  } finally {
    client.release();
  }
}
```

### **Confirmation Management**

```typescript
// Store confirmation
async storeConfirmation(confirmationData: ConfirmationData): Promise<number> {
  const client = await this.getClient();
  try {
    const result = await client.query(`
      INSERT INTO confirmations (
        session_id, user_id, confirmation_type, confirmation_data,
        status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      confirmationData.sessionId,
      confirmationData.userId,
      confirmationData.confirmationType,
      JSON.stringify(confirmationData.confirmationData),
      confirmationData.status || 'pending',
      confirmationData.expiresAt
    ]);
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Resolve confirmation
async resolveConfirmation(confirmationId: number, status: string): Promise<void> {
  const client = await this.getClient();
  try {
    await client.query(`
      UPDATE confirmations 
      SET status = $1, resolved_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [status, confirmationId]);
  } finally {
    client.release();
  }
}
```

## 🔄 **Database Migrations**

### **Migration System**

The platform includes a comprehensive migration system for schema updates:

```typescript
// Migration file example: 003_create_user_tokens_table.sql
CREATE TABLE IF NOT EXISTS user_tokens (
  user_id VARCHAR(255) PRIMARY KEY,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT,
  google_expires_at TIMESTAMP,
  google_token_type VARCHAR(50) DEFAULT 'Bearer',
  google_scope TEXT,
  slack_access_token TEXT,
  slack_refresh_token TEXT,
  slack_expires_at TIMESTAMP,
  slack_scope TEXT,
  slack_team_id VARCHAR(255),
  slack_user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tokens_google_expires ON user_tokens(google_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tokens_slack_expires ON user_tokens(slack_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tokens_slack_team ON user_tokens(slack_team_id);
```

### **Migration Execution**

```typescript
// Run migrations
async runMigrations(): Promise<void> {
  const client = await this.getClient();
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of migration files
    const migrationFiles = await this.getMigrationFiles();
    
    for (const file of migrationFiles) {
      const migrationName = path.basename(file);
      
      // Check if migration already executed
      const result = await client.query(
        'SELECT id FROM migrations WHERE filename = $1',
        [migrationName]
      );
      
      if (result.rows.length === 0) {
        // Execute migration
        const migrationSQL = await fs.readFile(file, 'utf8');
        await client.query(migrationSQL);
        
        // Record migration
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [migrationName]
        );
        
        this.logInfo(`Migration executed: ${migrationName}`);
      }
    }
  } finally {
    client.release();
  }
}
```

## 📊 **Database Performance**

### **Connection Pooling**

The database service uses connection pooling for optimal performance:

```typescript
// Connection pool configuration
const poolConfig = {
  max: parseInt(process.env.DB_POOL_SIZE || '10'), // Maximum connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // Close idle connections
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // Connection timeout
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // Query timeout
  application_name: 'ai-assistant-platform'
};
```

### **Performance Optimization**

- **Indexes**: Strategic indexes on frequently queried columns
- **Connection Pooling**: Efficient connection reuse
- **Query Optimization**: Prepared statements and parameterized queries
- **Transaction Management**: ACID compliance with proper rollback
- **Connection Timeouts**: Prevents hanging connections

### **Performance Metrics**

- **Connection Pool**: 10 max connections with 30s idle timeout
- **Query Timeout**: 30s maximum query execution time
- **Connection Timeout**: 10s maximum connection establishment time
- **Transaction Support**: Full ACID compliance
- **Migration Support**: Automated schema updates

## 🔧 **Database Configuration**

### **Environment Configuration**

```bash
# Database configuration
DATABASE_URL=postgresql://username:password@host:5432/database
POSTGRES_URL=postgresql://username:password@host:5432/database
RAILWAY_DATABASE_URL=postgresql://username:password@host:5432/database

# Connection pool settings
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000

# SSL configuration
DB_SSL_ENABLED=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

### **Database Health Monitoring**

```typescript
// Database health check
async getHealth(): Promise<{ healthy: boolean; details?: any }> {
  try {
    const client = await this.getClient();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();
    
    return {
      healthy: true,
      details: {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version,
        poolSize: this.pool?.options.max || 0,
        activeConnections: this.pool?.totalCount || 0,
        idleConnections: this.pool?.idleCount || 0
      }
    };
  } catch (error) {
    return {
      healthy: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}
```

---

**Next**: [Master Agent](./agents/master-agent.md) - Central orchestration and AI planning
