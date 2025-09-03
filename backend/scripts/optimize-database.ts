#!/usr/bin/env ts-node

import { DatabaseService } from '../src/services/database.service';
import { ServiceManager } from '../src/services/service-manager';
import logger from '../src/utils/logger';

/**
 * Database optimization script
 * Adds indexes and optimizes database performance
 */

import { serviceManager } from '../src/services/service-manager';

async function optimizeDatabase(): Promise<void> {
  logger.info('Starting database optimization...');
  
  try {
    // Initialize database service
    const databaseService = new DatabaseService();
    serviceManager.registerService('databaseService', databaseService, {
      priority: 1,
      autoStart: true
    });
    
    await serviceManager.initializeAllServices();
    
    if (!databaseService.isReady()) {
      throw new Error('Database service failed to initialize');
    }
    
    logger.info('Database connection established, applying optimizations...');
    
    // Create performance indexes
    await createPerformanceIndexes(databaseService);
    
    // Analyze query performance
    await analyzeQueryPerformance(databaseService);
    
    // Optimize table statistics
    await optimizeTableStatistics(databaseService);
    
    logger.info('Database optimization completed successfully');
    
  } catch (error) {
    logger.error('Database optimization failed:', error);
    process.exit(1);
  } finally {
    // ServiceManager handles graceful shutdown automatically
    process.exit(0);
  }
}

async function createPerformanceIndexes(databaseService: DatabaseService): Promise<void> {
  logger.info('Creating performance indexes...');
  
  const indexes = [
    // Sessions table indexes
    {
      name: 'idx_sessions_user_id',
      table: 'sessions',
      columns: ['user_id'],
      description: 'Index for user session lookups'
    },
    {
      name: 'idx_sessions_expires_at',
      table: 'sessions',
      columns: ['expires_at'],
      description: 'Index for session expiration cleanup'
    },
    {
      name: 'idx_sessions_created_at',
      table: 'sessions',
      columns: ['created_at'],
      description: 'Index for session creation time queries'
    },
    {
      name: 'idx_sessions_updated_at',
      table: 'sessions',
      columns: ['updated_at'],
      description: 'Index for session activity queries'
    },
    
    // OAuth tokens table indexes
    {
      name: 'idx_oauth_tokens_expires_at',
      table: 'oauth_tokens',
      columns: ['expires_at'],
      description: 'Index for token expiration cleanup'
    },
    {
      name: 'idx_oauth_tokens_created_at',
      table: 'oauth_tokens',
      columns: ['created_at'],
      description: 'Index for token creation time queries'
    },
    
    // Slack workspaces table indexes
    {
      name: 'idx_slack_workspaces_team_name',
      table: 'slack_workspaces',
      columns: ['team_name'],
      description: 'Index for workspace name lookups'
    },
    {
      name: 'idx_slack_workspaces_bot_user_id',
      table: 'slack_workspaces',
      columns: ['bot_user_id'],
      description: 'Index for bot user lookups'
    },
    
    // Slack users table indexes
    {
      name: 'idx_slack_users_google_id',
      table: 'slack_users',
      columns: ['google_user_id'],
      description: 'Index for Google user ID lookups'
    },
    {
      name: 'idx_slack_users_team_id',
      table: 'slack_users',
      columns: ['team_id'],
      description: 'Index for team-based user queries'
    },
    {
      name: 'idx_slack_users_created_at',
      table: 'slack_users',
      columns: ['created_at'],
      description: 'Index for user creation time queries'
    }
  ];
  
  for (const index of indexes) {
    try {
      const indexExists = await checkIndexExists(databaseService, index.name);
      
      if (indexExists) {
        logger.info(`Index ${index.name} already exists, skipping`);
        continue;
      }
      
      const columnList = index.columns.join(', ');
      const createIndexSQL = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${columnList})`;
      
      logger.info(`Creating index: ${index.name} on ${index.table}(${columnList})`);
      await databaseService.query(createIndexSQL);
      
      logger.info(`✅ Created index ${index.name} - ${index.description}`);
      
    } catch (error) {
      logger.warn(`Failed to create index ${index.name}:`, error);
    }
  }
  
  logger.info('Performance indexes creation completed');
}

async function checkIndexExists(databaseService: DatabaseService, indexName: string): Promise<boolean> {
  try {
    const result = await databaseService.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
      [indexName]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.warn(`Error checking index existence for ${indexName}:`, error);
    return false;
  }
}

async function analyzeQueryPerformance(databaseService: DatabaseService): Promise<void> {
  logger.info('Analyzing query performance...');
  
  const queries = [
    {
      name: 'Session lookup by ID',
      sql: 'EXPLAIN ANALYZE SELECT * FROM sessions WHERE session_id = $1',
      params: ['test-session-id']
    },
    {
      name: 'Session lookup by user ID',
      sql: 'EXPLAIN ANALYZE SELECT * FROM sessions WHERE user_id = $1',
      params: ['test-user-id']
    },
    {
      name: 'Expired sessions cleanup',
      sql: 'EXPLAIN ANALYZE SELECT session_id FROM sessions WHERE expires_at < NOW()',
      params: []
    },
    {
      name: 'OAuth token lookup',
      sql: 'EXPLAIN ANALYZE SELECT * FROM oauth_tokens WHERE session_id = $1',
      params: ['test-session-id']
    },
    {
      name: 'Slack user lookup by Google ID',
      sql: 'EXPLAIN ANALYZE SELECT * FROM slack_users WHERE google_user_id = $1',
      params: ['test-google-id']
    }
  ];
  
  for (const query of queries) {
    try {
      logger.info(`Analyzing query: ${query.name}`);
      const result = await databaseService.query(query.sql, query.params);
      
      // Log execution plan for performance analysis
      const executionPlan = result.rows.map((row: any) => row['QUERY PLAN']).join('\n');
      logger.debug(`Query plan for "${query.name}":\n${executionPlan}`);
      
    } catch (error) {
      logger.warn(`Failed to analyze query "${query.name}":`, error);
    }
  }
  
  logger.info('Query performance analysis completed');
}

async function optimizeTableStatistics(databaseService: DatabaseService): Promise<void> {
  logger.info('Optimizing table statistics...');
  
  const tables = ['sessions', 'oauth_tokens', 'slack_workspaces', 'slack_users'];
  
  for (const table of tables) {
    try {
      logger.info(`Analyzing table: ${table}`);
      await databaseService.query(`ANALYZE ${table}`);
      
      // Get table statistics
      const stats = await databaseService.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE tablename = $1
      `, [table]);
      
      if (stats.rows.length > 0) {
        const tableStats = stats.rows[0];
        logger.info(`Table ${table} statistics:`, {
          live_tuples: tableStats.live_tuples,
          dead_tuples: tableStats.dead_tuples,
          last_analyze: tableStats.last_analyze,
          last_vacuum: tableStats.last_vacuum
        });
        
        // Suggest vacuum if dead tuples are high
        if (tableStats.dead_tuples > tableStats.live_tuples * 0.2) {
          logger.warn(`Table ${table} has high dead tuple ratio, consider running VACUUM`);
        }
      }
      
    } catch (error) {
      logger.warn(`Failed to analyze table ${table}:`, error);
    }
  }
  
  logger.info('Table statistics optimization completed');
}

// Add query method to DatabaseService if it doesn't exist
declare module '../src/services/database.service' {
  interface DatabaseService {
    query(sql: string, params?: any[]): Promise<any>;
  }
}

// Run the optimization
if (require.main === module) {
  optimizeDatabase().catch(error => {
    logger.error('Optimization script failed:', error);
    process.exit(1);
  });
}

export { optimizeDatabase };