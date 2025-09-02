#!/usr/bin/env node

/**
 * Database setup script for PostgreSQL integration
 * This script tests the database connection and creates the schema
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please set DATABASE_URL in your .env file');
    console.log('Example: DATABASE_URL=postgresql://username:password@host:5432/database');
    process.exit(1);
  }

  console.log('🔗 Connecting to PostgreSQL database...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('postgresql://') ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');

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
    console.log('✅ Sessions table created/verified');

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
    console.log('✅ OAuth tokens table created/verified');

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
    console.log('✅ Slack workspaces table created/verified');

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
    console.log('✅ Slack users table created/verified');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
      CREATE INDEX IF NOT EXISTS idx_slack_users_google_user_id ON slack_users(google_user_id);
    `);
    console.log('✅ Database indexes created/verified');

    // Test insert and select
    const testSessionId = 'test-session-' + Date.now();
    await client.query(`
      INSERT INTO sessions (session_id, user_id, expires_at) 
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id) DO NOTHING
    `, [testSessionId, 'test-user', new Date(Date.now() + 3600000)]);

    const result = await client.query('SELECT * FROM sessions WHERE session_id = $1', [testSessionId]);
    if (result.rows.length > 0) {
      console.log('✅ Database read/write test successful');
    }

    // Clean up test data
    await client.query('DELETE FROM sessions WHERE session_id = $1', [testSessionId]);

    client.release();
    await pool.end();

    console.log('\n🎉 Database setup completed successfully!');
    console.log('Your PostgreSQL database is ready for persistent storage.');
    console.log('\nNext steps:');
    console.log('1. Restart your application');
    console.log('2. Test Slack authentication persistence');
    console.log('3. Verify OAuth tokens are stored in the database');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase().catch(console.error);
