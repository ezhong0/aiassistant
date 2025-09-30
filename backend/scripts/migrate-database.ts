#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { config } from 'dotenv';
import logger from '../src/utils/logger';

// Load environment variables
config();

/**
 * Database migration script using node-pg-migrate
 */
async function migrateDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    logger.info('Starting database migration...', {
      operation: 'database_migration',
      metadata: { databaseUrl: databaseUrl.substring(0, 20) + '...' }
    });

    // Set environment variables for node-pg-migrate
    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    // Run migrations
    const command = 'node-pg-migrate up';
    logger.info(`Executing migration command: ${command}`);
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    logger.info('Database migration completed successfully', {
      operation: 'database_migration_success'
    });

  } catch (error) {
    logger.error('Database migration failed', error as Error, {
      operation: 'database_migration_error'
    });
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateDatabase().catch((error) => {
    logger.error('Migration script failed', error);
    process.exit(1);
  });
}

export { migrateDatabase };
