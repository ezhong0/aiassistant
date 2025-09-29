/**
 * Mock Cache Service for Testing
 * Provides mock implementations of cache operations without Redis
 */

import { BaseService } from '../base-service';
import { ServiceState } from '../../types/service.types';

export class MockCacheService extends BaseService {
  private cache: Map<string, any> = new Map();
  private isConnected = true;

  constructor() {
    super('MockCacheService');
  }

  /**
   * Mock initialization - always succeeds
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Mock Cache Service initialized for testing');
  }

  /**
   * Mock cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.cache.clear();
    this.logInfo('Mock Cache Service destroyed');
  }

  /**
   * Mock cache get
   */
  async get(key: string): Promise<string | null> {
    this.logInfo('Mock cache get', { key });
    return this.cache.get(key) || null;
  }

  /**
   * Mock cache set
   */
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    this.logInfo('Mock cache set', { key, ttl });
    this.cache.set(key, value);
    return true;
  }

  /**
   * Mock cache delete
   */
  async del(key: string): Promise<boolean> {
    this.logInfo('Mock cache delete', { key });
    return this.cache.delete(key);
  }

  /**
   * Mock cache exists
   */
  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Mock cache clear
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logInfo('Mock cache cleared');
  }

  /**
   * Mock health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: true,
      details: {
        service: 'MockCacheService',
        status: 'ready',
        mockMode: true,
        cacheSize: this.cache.size
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
