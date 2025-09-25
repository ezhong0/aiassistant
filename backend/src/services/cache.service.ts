import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';
import { BaseService } from './base-service';
import { ServiceState } from '../types/service.types';
// Use environment variables directly for Redis configuration

export class CacheService extends BaseService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly REDIS_URL: string;
  private memoryUsage: { used: number; peak: number; timestamp: number } = { used: 0, peak: 0, timestamp: Date.now() };
  private connectionPool: Map<string, RedisClientType> = new Map();

  constructor() {
    super('cacheService');
    
    // Railway Redis environment variables (Railway provides these when Redis is added)
    // Check multiple possible environment variable names that Railway might use
    this.REDIS_URL = process.env.REDIS_URL || 
                     process.env.REDISCLOUD_URL || 
                     process.env.REDIS_PRIVATE_URL ||
                     process.env.REDIS_PUBLIC_URL ||
                     process.env.RAILWAY_REDIS_URL ||
                     'redis://localhost:6379';
    
    logger.debug('CacheService initializing', {
      correlationId: `cache-init-${Date.now()}`,
      operation: 'cache_service_init',
      metadata: {
        redisUrl: this.maskRedisUrl(this.REDIS_URL),
        environment: process.env.NODE_ENV || 'development',
        hasRedisEnv: !!(process.env.REDIS_URL || process.env.REDISCLOUD_URL || 
                       process.env.REDIS_PRIVATE_URL || process.env.REDIS_PUBLIC_URL ||
                       process.env.RAILWAY_REDIS_URL),
        availableRedisVars: Object.keys(process.env).filter(key => 
          key.toLowerCase().includes('redis')).length
      }
    });
  }

  private maskRedisUrl(url: string): string {
    try {
      const maskedUrl = url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
      return maskedUrl.replace(/localhost:\d+/, 'localhost:****');
    } catch {
      return 'invalid-url';
    }
  }

  protected async onInitialize(): Promise<void> {
    try {
      // Check if Redis should be disabled
      if (process.env.DISABLE_REDIS === 'true') {
        logger.debug('Redis disabled via DISABLE_REDIS environment variable', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { reason: 'disabled_env_var' }
        });
        return;
      }

      // Log all available Redis-related environment variables for debugging
      const redisEnvVars = Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('redis'));
      if (redisEnvVars.length > 0) {
        logger.debug('Available Redis environment variables', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { 
            redisEnvVars: redisEnvVars.map(key => `${key}=${this.maskRedisUrl(process.env[key] || '')}`)
          }
        });
      }

      // Skip Redis if we're using localhost and not in development
      if (this.REDIS_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
        logger.warn('Skipping Redis connection - localhost URL in production environment', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { reason: 'localhost_in_production' }
        });
        return;
      }

      // Create Redis client with Railway-optimized settings
      this.client = createClient({
        url: this.REDIS_URL,
        socket: {
          connectTimeout: 10000, // Longer timeout for Railway
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Redis max reconnection attempts reached', new Error('Max reconnection attempts reached'), {
                correlationId: `cache-init-${Date.now()}`,
                operation: 'cache_service_init',
                metadata: { retries, maxRetries: 3 }
              });
              return false;
            }
            // Exponential backoff with max 2 seconds
            return Math.min(retries * 500, 2000);
          }
        },
        // Railway Redis might need these settings
        disableOfflineQueue: true
      });

      // Set up event handlers
      this.client.on('error', (error) => {
        logger.error('Redis client error', error as Error, {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'client_error' }
        });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.debug('Redis client connecting...', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'connecting' }
        });
      });

      this.client.on('ready', () => {
        logger.debug('Redis client connected and ready', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'ready' }
        });
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'connection_ended' }
        });
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.debug('Redis client reconnecting...', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'reconnecting' }
        });
      });

      // Connect to Redis with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000));
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Test the connection
      await this.client.ping();
      
      logger.debug('CacheService initialized successfully', {
        correlationId: `cache-init-${Date.now()}`,
        operation: 'cache_service_init',
        metadata: { phase: 'initialized' }
      });

    } catch (error) {
      logger.error('Failed to initialize CacheService', error as Error, {
        correlationId: `cache-init-${Date.now()}`,
        operation: 'cache_service_init',
        metadata: { phase: 'initialization_failed' }
      });
      
      // Clean up client on failure
      if (this.client) {
        try {
          this.client.disconnect();
        } catch (disconnectError) {
          logger.warn('Error disconnecting Redis client', {
            correlationId: `cache-init-${Date.now()}`,
            operation: 'cache_service_init',
            metadata: { phase: 'disconnect_error', error: disconnectError }
          });
        }
        this.client = null;
      }
      
      // Always continue without cache rather than failing
      logger.warn('Redis unavailable - continuing without cache functionality', {
        correlationId: `cache-init-${Date.now()}`,
        operation: 'cache_service_init',
        metadata: { phase: 'fallback_mode' }
      });
      this.isConnected = false;
      
      // Don't throw - just continue without Redis
      return;
    }
  }

  protected async onDestroy(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        // Gracefully close the connection
        await this.client.quit();
        logger.debug('Redis connection closed gracefully', {
          correlationId: `cache-destroy-${Date.now()}`,
          operation: 'cache_service_destroy',
          metadata: { phase: 'connection_closed' }
        });
      }
      
      // Clear client reference to prevent memory leaks
      this.client = null;
      this.isConnected = false;
      
      // Clean up connection pool
      await this.cleanupConnectionPool();
      
      logger.debug('CacheService destroyed successfully', {
        correlationId: `cache-destroy-${Date.now()}`,
        operation: 'cache_service_destroy',
        metadata: { phase: 'destroyed' }
      });
      
    } catch (error) {
      logger.error('Error during CacheService destruction', error as Error, {
        correlationId: `cache-destroy-${Date.now()}`,
        operation: 'cache_service_destroy',
        metadata: { phase: 'destruction_error' }
      });
      
      // Force cleanup even if quit() fails
      if (this.client) {
        try {
          this.client.disconnect();
        } catch (disconnectError) {
          logger.warn('Error during forced disconnect', {
            correlationId: `cache-destroy-${Date.now()}`,
            operation: 'cache_service_destroy',
            metadata: { phase: 'forced_disconnect_error', error: disconnectError }
          });
        }
        this.client = null;
      }
      this.isConnected = false;
      
      // Don't throw - cleanup should always complete
    }
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.state === ServiceState.READY,
      details: {
        connected: this.isConnected,
        state: this.state,
        redisUrl: this.REDIS_URL ? 'configured' : 'not configured'
      }
    };
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client!.get(this.prefixKey(key));
      if (value === null) {
        return null;
      }
      
      const parsed = JSON.parse(value);
      
      
      return parsed as T;
      
    } catch (error) {
      
      return null; // Graceful degradation
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const ttl = ttlSeconds || this.DEFAULT_TTL;
      const serialized = JSON.stringify(value);
      
      await this.client!.setEx(this.prefixKey(key), ttl, serialized);
      
      
      return true;
      
    } catch (error) {
      
      return false; // Graceful degradation
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const deleted = await this.client!.del(this.prefixKey(key));
      
      
      
      return deleted > 0;
      
    } catch (error) {
      
      return false; // Graceful degradation
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const exists = await this.client!.exists(this.prefixKey(key));
      return exists === 1;
      
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.expire(this.prefixKey(key), ttlSeconds);
      return result;
      
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memoryUsage?: string;
    keyCount?: number;
    hitRate?: number;
  }> {
    if (!this.isAvailable()) {
      return { connected: false };
    }

    try {
      const info = await this.client!.info('memory');
      const dbSize = await this.client!.dbSize();
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch && memoryMatch[1] ? memoryMatch[1].trim() : 'unknown';

      return {
        connected: true,
        memoryUsage,
        keyCount: dbSize
      };
      
    } catch (error) {
      
      return { connected: false };
    }
  }

  /**
   * Flush all cache data (use with caution)
   */
  async flushAll(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.flushAll();
      
      return true;
      
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Check if cache is available for use
   */
  private isAvailable(): boolean {
    return this.client !== null && this.isConnected && this.state === ServiceState.READY;
  }

  /**
   * Add prefix to cache keys for namespacing
   */
  private prefixKey(key: string): string {
    return `assistantapp:${key}`;
  }

  /**
   * Health check method for monitoring
   */
  async ping(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Monitor memory usage and connection health
   */
  async monitorMemoryUsage(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const info = await this.client!.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      
      if (memoryMatch && memoryMatch[1]) {
        const used = parseInt(memoryMatch[1], 10);
        this.memoryUsage.used = used;
        this.memoryUsage.peak = Math.max(this.memoryUsage.peak, used);
        this.memoryUsage.timestamp = Date.now();

        // Log memory usage if it's high
        if (used > 100 * 1024 * 1024) { // 100MB threshold
          logger.warn('High memory usage detected', {
            correlationId: `cache-memory-${Date.now()}`,
            operation: 'memory_monitoring',
            metadata: {
              usedMB: Math.round(used / 1024 / 1024),
              peakMB: Math.round(this.memoryUsage.peak / 1024 / 1024),
              thresholdMB: 100
            }
          });
        }
      }
    } catch (error) {
      logger.error('Error monitoring memory usage', error as Error, {
        correlationId: `cache-memory-${Date.now()}`,
        operation: 'memory_monitoring'
      });
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { used: number; peak: number; timestamp: number; usedMB: number; peakMB: number } {
    return {
      ...this.memoryUsage,
      usedMB: Math.round(this.memoryUsage.used / 1024 / 1024),
      peakMB: Math.round(this.memoryUsage.peak / 1024 / 1024)
    };
  }

  /**
   * Clean up connection pool
   */
  private async cleanupConnectionPool(): Promise<void> {
    for (const [key, client] of this.connectionPool.entries()) {
      try {
        await client.quit();
        this.connectionPool.delete(key);
      } catch (error) {
        logger.warn('Error cleaning up connection pool', {
          correlationId: `cache-cleanup-${Date.now()}`,
          operation: 'connection_pool_cleanup',
          metadata: { key, error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }
  }

  // ===== LIST OPERATIONS FOR JOB QUEUE =====

  /**
   * Push element to the left (head) of a list
   */
  async lpush(key: string, value: string): Promise<number | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await this.client!.lPush(this.prefixKey(key), value);
      
      return result;
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Pop element from the right (tail) of a list with timeout
   */
  async brpop(key: string, timeoutSeconds: number): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await this.client!.brPop(this.prefixKey(key), timeoutSeconds);
      if (result) {
        
        return result.element;
      }
      return null;
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Get the length of a list
   */
  async llen(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const result = await this.client!.lLen(this.prefixKey(key));
      return result;
    } catch (error) {
      
      return 0;
    }
  }


  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await this.client!.incr(this.prefixKey(key));
      return result;
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Set a value with expiration time (alias for set with TTL)
   */
  async setex(key: string, seconds: number, value: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.setEx(this.prefixKey(key), seconds, value);
      
      return true;
    } catch (error) {
      
      return false;
    }
  }
}