/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';
import { BaseService } from './base-service';
import { ServiceState } from '../types/service.types';
import { config } from '../config';

/**
 * Cache service for Redis-based caching
 */
export class CacheService extends BaseService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly REDIS_URL: string;
  private memoryUsage: { used: number; peak: number; timestamp: number } = { used: 0, peak: 0, timestamp: Date.now() };

  constructor(private readonly config: typeof import('../config').config) {
    super('cacheService');

    // Get Redis URL from unified config
    this.REDIS_URL = this.config.redisUrl || 'redis://localhost:6379';

    logger.debug('CacheService initializing', {
      correlationId: `cache-init-${Date.now()}`,
      operation: 'cache_service_init',
      metadata: {
        redisUrl: this.maskRedisUrl(this.REDIS_URL),
        environment: this.config.nodeEnv,
        hasRedisUrl: !!this.config.redisUrl,
      },
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
      if (this.config.isFeatureEnabled('DISABLE_REDIS')) {
        logger.debug('Redis disabled via DISABLE_REDIS feature flag', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { reason: 'disabled_feature_flag' },
        });
        return;
      }

      // Skip Redis if we're using localhost and not in development
      if (this.REDIS_URL.includes('localhost') && this.config.isProduction) {
        logger.warn('Skipping Redis connection - localhost URL in production environment', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { reason: 'localhost_in_production' },
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
                metadata: { retries, maxRetries: 3 },
              });
              return false;
            }
            // Exponential backoff with max 2 seconds
            return Math.min(retries * 500, 2000);
          },
        },
        // Railway Redis might need these settings
        disableOfflineQueue: true,
      });

      // Set up event handlers
      this.client.on('error', (error) => {
        logger.error('Redis client error', error as Error, {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'client_error' },
        });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.debug('Redis client connecting...', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'connecting' },
        });
      });

      this.client.on('ready', () => {
        logger.debug('Redis client connected and ready', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'ready' },
        });
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'connection_ended' },
        });
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.debug('Redis client reconnecting...', {
          correlationId: `cache-init-${Date.now()}`,
          operation: 'cache_service_init',
          metadata: { phase: 'reconnecting' },
        });
      });

      // Connect to Redis with timeout
      const connectPromise = this.client.connect();
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = globalThis.setTimeout(() => reject(new Error('Connection timeout')), 15000);
      });

      try {
        await Promise.race([connectPromise, timeoutPromise]);
        globalThis.clearTimeout(timeoutHandle!);
      } catch (error) {
        globalThis.clearTimeout(timeoutHandle!);
        throw error;
      }
      
      // Test the connection
      await this.client.ping();
      
      logger.debug('CacheService initialized successfully', {
        correlationId: `cache-init-${Date.now()}`,
        operation: 'cache_service_init',
        metadata: { phase: 'initialized' },
      });

    } catch (error) {
      logger.error('Failed to initialize CacheService', error as Error, {
        correlationId: `cache-init-${Date.now()}`,
        operation: 'cache_service_init',
        metadata: { phase: 'initialization_failed' },
      });
      
      // Clean up client on failure
      if (this.client) {
        try {
          // Check if client is already closed before disconnecting
          if (this.client.isOpen) {
            await this.client.disconnect();
          }
        } catch (disconnectError) {
          // Ignore disconnect errors during cleanup
          logger.debug('Redis client disconnect during error handling', {
            correlationId: `cache-init-${Date.now()}`,
            operation: 'cache_service_init',
            metadata: { phase: 'disconnect_cleanup' },
          });
        } finally {
          this.client = null;
        }
      }
      
      // Always continue without cache rather than failing
      logger.warn('Redis unavailable - continuing without cache functionality', {
        correlationId: `cache-init-${Date.now()}`,
        operation: 'cache_service_init',
        metadata: { phase: 'fallback_mode' },
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
          metadata: { phase: 'connection_closed' },
        });
      }
      
      // Clear client reference to prevent memory leaks
      this.client = null;
      this.isConnected = false;

      logger.debug('CacheService destroyed successfully', {
        correlationId: `cache-destroy-${Date.now()}`,
        operation: 'cache_service_destroy',
        metadata: { phase: 'destroyed' },
      });
      
    } catch (error) {
      logger.error('Error during CacheService destruction', error as Error, {
        correlationId: `cache-destroy-${Date.now()}`,
        operation: 'cache_service_destroy',
        metadata: { phase: 'destruction_error' },
      });
      
      // Force cleanup even if quit() fails
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch (disconnectError) {
          logger.warn('Error during forced disconnect', {
            correlationId: `cache-destroy-${Date.now()}`,
            operation: 'cache_service_destroy',
            metadata: { phase: 'forced_disconnect_error', error: disconnectError },
          });
        }
        this.client = null;
      }
      this.isConnected = false;
      
      // Don't throw - cleanup should always complete
    }
  }

  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    return {
      healthy: this.state === ServiceState.READY,
      details: {
        connected: this.isConnected,
        state: this.state,
        redisUrl: this.REDIS_URL ? 'configured' : 'not configured',
      },
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
      
    } catch {
       
      return null; // Graceful degradation
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const ttl = ttlSeconds || this.DEFAULT_TTL;
      const serialized = JSON.stringify(value);
      await this.client!.setEx(this.prefixKey(key), ttl, serialized);
      return true;
    } catch {  
      
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
    } catch {  
      
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
      
    } catch {
      
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
      
    } catch {
      
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
      const memoryUsage = memoryMatch?.[1] ? memoryMatch[1].trim() : 'unknown';

      return {
        connected: true,
        memoryUsage,
        keyCount: dbSize,
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
      
    } catch {
      
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
    } catch {
      
      return false;
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
    } catch {
      
      return false;
    }
  }
}