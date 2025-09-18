import { BaseService } from '../base-service';
import logger from '../../utils/logger';

/**
 * Mock Database Service for development and testing
 *
 * Provides an in-memory database implementation that mimics
 * the interface of the real DatabaseService without requiring
 * actual database connections.
 *
 * Features:
 * - In-memory storage with Map-based tables
 * - Basic SQL query simulation
 * - Test data initialization
 * - Proper service lifecycle management
 */
export class DatabaseMockService extends BaseService {
  private inMemoryData = new Map<string, any[]>();
  private sequences = new Map<string, number>();

  constructor() {
    super('databaseService');
  }

  protected async onInitialize(): Promise<void> {
    // Initialize with test data
    this.initializeTestData();
    this.initializeSequences();
    logger.info('Database mock service initialized with in-memory storage', {
      tables: Array.from(this.inMemoryData.keys()),
      totalRecords: this.getTotalRecords()
    });
  }

  protected async onDestroy(): Promise<void> {
    this.inMemoryData.clear();
    this.sequences.clear();
    logger.info('Database mock service destroyed');
  }

  // Mock database operations
  async query(sql: string, params: any[] = []): Promise<any[]> {
    logger.debug('Mock database query', {
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      paramCount: params.length
    });

    try {
      // Simple query simulation based on SQL patterns
      const upperSql = sql.toUpperCase().trim();

      if (upperSql.startsWith('SELECT')) {
        return this.handleSelect(sql, params);
      } else if (upperSql.startsWith('INSERT')) {
        return this.handleInsert(sql, params);
      } else if (upperSql.startsWith('UPDATE')) {
        return this.handleUpdate(sql, params);
      } else if (upperSql.startsWith('DELETE')) {
        return this.handleDelete(sql, params);
      } else if (upperSql.startsWith('CREATE')) {
        return this.handleCreate(sql, params);
      } else if (upperSql.startsWith('DROP')) {
        return this.handleDrop(sql, params);
      }

      logger.warn('Unsupported SQL query type', { sql: sql.substring(0, 50) });
      return [];
    } catch (error) {
      logger.error('Mock database query failed', { error, sql });
      throw error;
    }
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Mock transaction - in real implementation, this would provide isolation
    logger.debug('Mock transaction started');

    try {
      const result = await callback();
      logger.debug('Mock transaction committed');
      return result;
    } catch (error) {
      logger.debug('Mock transaction rolled back', { error });
      throw error;
    }
  }

  private initializeTestData(): void {
    // Users table
    this.inMemoryData.set('users', [
      { id: 1, email: 'test@example.com', name: 'Test User', created_at: new Date('2024-01-01') },
      { id: 2, email: 'admin@example.com', name: 'Admin User', created_at: new Date('2024-01-01') },
      { id: 3, email: 'demo@example.com', name: 'Demo User', created_at: new Date('2024-01-15') }
    ]);

    // Sessions table
    this.inMemoryData.set('sessions', [
      {
        id: 1,
        user_id: 1,
        session_id: 'session-test-123',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    ]);

    // Tokens table
    this.inMemoryData.set('tokens', [
      {
        id: 1,
        user_id: 1,
        service: 'google',
        access_token: 'mock-access-token-123',
        refresh_token: 'mock-refresh-token-123',
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        created_at: new Date()
      }
    ]);

    // Settings table
    this.inMemoryData.set('settings', [
      { id: 1, user_id: 1, key: 'timezone', value: 'America/New_York', created_at: new Date() },
      { id: 2, user_id: 1, key: 'language', value: 'en', created_at: new Date() },
      { id: 3, user_id: 2, key: 'timezone', value: 'Europe/London', created_at: new Date() }
    ]);

    // Agent interactions table
    this.inMemoryData.set('agent_interactions', []);

    // Service health table
    this.inMemoryData.set('service_health', []);

    logger.debug('Test data initialized', {
      users: this.inMemoryData.get('users')?.length,
      sessions: this.inMemoryData.get('sessions')?.length,
      tokens: this.inMemoryData.get('tokens')?.length,
      settings: this.inMemoryData.get('settings')?.length
    });
  }

  private initializeSequences(): void {
    // Initialize auto-increment sequences for each table
    for (const [tableName, records] of this.inMemoryData.entries()) {
      const maxId = records.reduce((max, record) => {
        return record.id > max ? record.id : max;
      }, 0);
      this.sequences.set(tableName, maxId + 1);
    }
  }

  private handleSelect(sql: string, params: any[]): any[] {
    // Extract table name - simple regex for basic SELECT queries
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) {
      logger.warn('Could not extract table name from SELECT query', { sql });
      return [];
    }

    const tableName = fromMatch[1];
    if (!tableName) {
      logger.warn('Could not extract table name from FROM clause', { sql });
      return [];
    }
    const tableData = this.inMemoryData.get(tableName) || [];

    // Handle basic WHERE clauses with parameters
    let filteredData = [...tableData];

    // Simple WHERE clause handling for common patterns
    if (sql.includes('WHERE') && params.length > 0) {
      // Handle "WHERE id = ?" pattern
      if (sql.match(/WHERE\s+id\s*=\s*\?/i)) {
        const id = params[0];
        filteredData = tableData.filter(record => record.id === id);
      }
      // Handle "WHERE user_id = ?" pattern
      else if (sql.match(/WHERE\s+user_id\s*=\s*\?/i)) {
        const userId = params[0];
        filteredData = tableData.filter(record => record.user_id === userId);
      }
      // Handle "WHERE email = ?" pattern
      else if (sql.match(/WHERE\s+email\s*=\s*\?/i)) {
        const email = params[0];
        filteredData = tableData.filter(record => record.email === email);
      }
      // Handle "WHERE session_id = ?" pattern
      else if (sql.match(/WHERE\s+session_id\s*=\s*\?/i)) {
        const sessionId = params[0];
        filteredData = tableData.filter(record => record.session_id === sessionId);
      }
    }

    // Handle LIMIT clause
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch && limitMatch[1]) {
      const limit = parseInt(limitMatch[1], 10);
      filteredData = filteredData.slice(0, limit);
    }

    logger.debug(`Mock SELECT returned ${filteredData.length} records from ${tableName}`);
    return filteredData;
  }

  private handleInsert(sql: string, params: any[]): any[] {
    // Extract table name
    const intoMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
    if (!intoMatch) {
      logger.warn('Could not extract table name from INSERT query', { sql });
      return [{ insertId: 0, affectedRows: 0 }];
    }

    const tableName = intoMatch[1];
    if (!tableName) {
      logger.warn('Could not extract table name from INSERT clause', { sql });
      return [{ insertId: 0, affectedRows: 0 }];
    }
    const tableData = this.inMemoryData.get(tableName) || [];

    // Generate new ID
    const newId = this.sequences.get(tableName) || 1;
    this.sequences.set(tableName, newId + 1);

    // Extract column names
    const columnsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
    if (!columnsMatch) {
      logger.warn('Could not extract columns from INSERT query', { sql });
      return [{ insertId: newId, affectedRows: 0 }];
    }

    const columns = columnsMatch[1]?.split(',').map(col => col.trim()) || [];

    // Create new record
    const newRecord: any = { id: newId, created_at: new Date() };

    // Map parameters to columns
    columns.forEach((column, index) => {
      if (index < params.length) {
        newRecord[column] = params[index];
      }
    });

    // Add to table
    tableData.push(newRecord);
    this.inMemoryData.set(tableName, tableData);

    logger.debug(`Mock INSERT added record to ${tableName}`, { id: newId, columns: columns.length });
    return [{ insertId: newId, affectedRows: 1 }];
  }

  private handleUpdate(sql: string, params: any[]): any[] {
    // Extract table name
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) {
      logger.warn('Could not extract table name from UPDATE query', { sql });
      return [{ affectedRows: 0 }];
    }

    const tableName = tableMatch[1];
    if (!tableName) {
      logger.warn('Could not extract table name from UPDATE clause', { sql });
      return [{ affectedRows: 0 }];
    }
    const tableData = this.inMemoryData.get(tableName) || [];

    // Simple WHERE id = ? handling
    let affectedRows = 0;
    if (sql.match(/WHERE\s+id\s*=\s*\?/i) && params.length > 0) {
      const id = params[params.length - 1]; // ID is typically the last parameter

      for (const record of tableData) {
        if (record.id === id) {
          record.updated_at = new Date();
          affectedRows++;
          break; // Assuming single record update
        }
      }
    } else {
      // Update all records (dangerous but handled for mock)
      affectedRows = tableData.length;
      tableData.forEach(record => {
        record.updated_at = new Date();
      });
    }

    logger.debug(`Mock UPDATE affected ${affectedRows} records in ${tableName}`);
    return [{ affectedRows }];
  }

  private handleDelete(sql: string, params: any[]): any[] {
    // Extract table name
    const fromMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
    if (!fromMatch) {
      logger.warn('Could not extract table name from DELETE query', { sql });
      return [{ affectedRows: 0 }];
    }

    const tableName = fromMatch[1];
    if (!tableName) {
      logger.warn('Could not extract table name from FROM clause', { sql });
      return [];
    }
    const tableData = this.inMemoryData.get(tableName) || [];

    let affectedRows = 0;

    // Simple WHERE id = ? handling
    if (sql.match(/WHERE\s+id\s*=\s*\?/i) && params.length > 0) {
      const id = params[0];
      const initialLength = tableData.length;

      const filteredData = tableData.filter(record => record.id !== id);
      affectedRows = initialLength - filteredData.length;

      this.inMemoryData.set(tableName, filteredData);
    }

    logger.debug(`Mock DELETE removed ${affectedRows} records from ${tableName}`);
    return [{ affectedRows }];
  }

  private handleCreate(sql: string, params: any[]): any[] {
    // Extract table name
    const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
    if (tableMatch && tableMatch[1]) {
      const tableName = tableMatch[1];
      if (!this.inMemoryData.has(tableName)) {
        this.inMemoryData.set(tableName, []);
        this.sequences.set(tableName, 1);
        logger.debug(`Mock CREATE TABLE: ${tableName}`);
      }
    }

    return [{ affectedRows: 0 }];
  }

  private handleDrop(sql: string, params: any[]): any[] {
    // Extract table name
    const tableMatch = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
    if (tableMatch && tableMatch[1]) {
      const tableName = tableMatch[1];
      if (this.inMemoryData.has(tableName)) {
        this.inMemoryData.delete(tableName);
        this.sequences.delete(tableName);
        logger.debug(`Mock DROP TABLE: ${tableName}`);
      }
    }

    return [{ affectedRows: 0 }];
  }

  private getTotalRecords(): number {
    return Array.from(this.inMemoryData.values())
      .reduce((total, table) => total + table.length, 0);
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: true,
      details: {
        type: 'mock',
        tables: Array.from(this.inMemoryData.keys()),
        totalRecords: this.getTotalRecords(),
        sequences: Object.fromEntries(this.sequences.entries()),
        memoryUsage: this.estimateMemoryUsage()
      }
    };
  }

  private estimateMemoryUsage(): string {
    // Rough estimation of memory usage
    const totalRecords = this.getTotalRecords();
    const estimatedBytes = totalRecords * 1000; // ~1KB per record estimate

    if (estimatedBytes < 1024) {
      return `${estimatedBytes}B`;
    } else if (estimatedBytes < 1024 * 1024) {
      return `${Math.round(estimatedBytes / 1024)}KB`;
    } else {
      return `${Math.round(estimatedBytes / (1024 * 1024))}MB`;
    }
  }

  // Additional utility methods for testing
  insertTestData(tableName: string, records: any[]): void {
    const existingData = this.inMemoryData.get(tableName) || [];
    this.inMemoryData.set(tableName, [...existingData, ...records]);

    // Update sequence
    const maxId = records.reduce((max, record) => {
      return record.id > max ? record.id : max;
    }, 0);

    const currentSeq = this.sequences.get(tableName) || 1;
    if (maxId >= currentSeq) {
      this.sequences.set(tableName, maxId + 1);
    }

    logger.debug(`Added ${records.length} test records to ${tableName}`);
  }

  clearTable(tableName: string): void {
    this.inMemoryData.set(tableName, []);
    this.sequences.set(tableName, 1);
    logger.debug(`Cleared table: ${tableName}`);
  }

  getTableData(tableName: string): any[] {
    return [...(this.inMemoryData.get(tableName) || [])];
  }
}