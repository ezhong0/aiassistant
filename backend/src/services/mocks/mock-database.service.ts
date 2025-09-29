/**
 * Mock Database Service for Testing
 * Provides mock implementations of database operations without PostgreSQL
 */

import { BaseService } from '../base-service';
import { ServiceState } from '../../types/service.types';

export class MockDatabaseService extends BaseService {
  private isConnected = true;

  constructor() {
    super('MockDatabaseService');
  }

  /**
   * Mock initialization - always succeeds
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Mock Database Service initialized for testing');
  }

  /**
   * Mock cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('Mock Database Service destroyed');
  }

  /**
   * Mock database query
   */
  async query(sql: string, params?: any[]): Promise<any> {
    this.logInfo('Mock database query', { sql, params });
    
    // Return mock results based on query type
    if (sql.includes('SELECT')) {
      return {
        rows: [
          { id: 1, name: 'Mock User', email: 'user@example.com' }
        ],
        rowCount: 1
      };
    }
    
    if (sql.includes('INSERT')) {
      return {
        rows: [{ id: 1 }],
        rowCount: 1
      };
    }
    
    if (sql.includes('UPDATE') || sql.includes('DELETE')) {
      return {
        rows: [],
        rowCount: 1
      };
    }
    
    return { rows: [], rowCount: 0 };
  }

  /**
   * Mock transaction
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    this.logInfo('Mock database transaction');
    return callback(this);
  }

  /**
   * Mock health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: true,
      details: {
        service: 'MockDatabaseService',
        status: 'ready',
        mockMode: true
      }
    };
  }

  /**
   * Mock connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }
}
