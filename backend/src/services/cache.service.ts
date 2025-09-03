import { createClient, RedisClientType } from 'redis';
import { BaseService } from './base-service';
import { ServiceState } from './service-manager';
import logger from '../utils/logger';
import configService from '../config/config.service';

export class CacheService extends BaseService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly REDIS_URL: string;

  constructor() {
    super('cacheService');
    // Support both REDIS_URL and REDISCLOUD_URL (Railway provides REDISCLOUD_URL)
    this.REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';
    
    logger.info('CacheService initializing', {
      redisUrl: this.REDIS_URL.replace(/\/\/[^@]*@/, '//***:***@'), // Mask credentials
      isDevelopment: configService.nodeEnv === 'development'
    });
  }

  protected async onInitialize(): Promise<void> {
    try {
      // Create Redis client
      this.client = createClient({
        url: this.REDIS_URL,
        socket: {
          connectTimeout: 10000, // 10 seconds
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Redis max reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Set up event handlers
      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        logger.info('Redis client connected and ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test the connection
      await this.client.ping();
      
      logger.info('CacheService initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize CacheService:', error);
      
      // In development, don't fail - just warn and continue without cache
      if (configService.nodeEnv === 'development') {
        logger.warn('Redis unavailable in development - continuing without cache');
        return; // Allow service to be "ready" but non-functional
      }
      
      throw error;
    }
  }

  protected async onDestroy(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        logger.info('Redis client disconnected');
      }
      
      this.isConnected = false;
      logger.info('CacheService destroyed successfully');
    } catch (error) {
      logger.error('Error destroying CacheService:', error);
      throw error;
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
      
      logger.debug('Cache hit', { key: this.prefixKey(key) });
      return parsed as T;
      
    } catch (error) {
      logger.warn('Cache get error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      
      logger.debug('Cache set', { 
        key: this.prefixKey(key), 
        ttl,
        sizeBytes: serialized.length 
      });
      
      return true;
      
    } catch (error) {
      logger.warn('Cache set error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      
      logger.debug('Cache delete', { key: this.prefixKey(key), deleted: deleted > 0 });
      
      return deleted > 0;
      
    } catch (error) {
      logger.warn('Cache delete error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      logger.warn('Cache exists error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      logger.warn('Cache expire error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      logger.warn('Cache stats error:', error);
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
      logger.info('Cache flushed all data');
      return true;
      
    } catch (error) {
      logger.error('Cache flush error:', error);
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
      logger.warn('Cache ping error:', error);
      return false;
    }
  }
}