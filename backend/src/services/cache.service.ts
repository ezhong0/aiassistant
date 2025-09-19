import { createClient, RedisClientType } from 'redis';
import { BaseService } from './base-service';
import { ServiceState } from './service-manager';
import logger from '../utils/logger';
import { configService } from '../config/config.service';

export class CacheService extends BaseService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly REDIS_URL: string;

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
      redisUrl: this.maskRedisUrl(this.REDIS_URL),
      environment: configService.nodeEnv,
      hasRedisEnv: !!(process.env.REDIS_URL || process.env.REDISCLOUD_URL || 
                     process.env.REDIS_PRIVATE_URL || process.env.REDIS_PUBLIC_URL ||
                     process.env.RAILWAY_REDIS_URL),
      availableRedisVars: Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('redis')).length
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
        logger.info('Redis disabled via DISABLE_REDIS environment variable');
        return;
      }

      // Log all available Redis-related environment variables for debugging
      const redisEnvVars = Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('redis'));
      if (redisEnvVars.length > 0) {
        logger.info('Available Redis environment variables:', 
          redisEnvVars.map(key => `${key}=${this.maskRedisUrl(process.env[key] || '')}`));
      }

      // Skip Redis if we're using localhost and not in development
      if (this.REDIS_URL.includes('localhost') && configService.nodeEnv === 'production') {
        logger.warn('Skipping Redis connection - localhost URL in production environment');
        return;
      }

      // Create Redis client with Railway-optimized settings
      this.client = createClient({
        url: this.REDIS_URL,
        socket: {
          connectTimeout: 10000, // Longer timeout for Railway
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Redis max reconnection attempts reached');
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

      // Connect to Redis with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000));
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Test the connection
      await this.client.ping();
      
      logger.debug('CacheService initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize CacheService:', error);
      
      // Clean up client on failure
      if (this.client) {
        try {
          this.client.disconnect();
        } catch (disconnectError) {
          logger.warn('Error disconnecting Redis client:', disconnectError);
        }
        this.client = null;
      }
      
      // Always continue without cache rather than failing
      logger.warn('Redis unavailable - continuing without cache functionality');
      this.isConnected = false;
      
      // Don't throw - just continue without Redis
      return;
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
      logger.debug('List lpush', { key: this.prefixKey(key), length: result });
      return result;
    } catch (error) {
      logger.warn('List lpush error:', { key: this.prefixKey(key), error: (error as Error).message });
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
        logger.debug('List brpop', { key: this.prefixKey(key), hasValue: true });
        return result.element;
      }
      return null;
    } catch (error) {
      logger.warn('List brpop error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      logger.warn('List llen error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      logger.warn('Incr error:', { key: this.prefixKey(key), error: (error as Error).message });
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
      logger.debug('Cache setex', { key: this.prefixKey(key), ttl: seconds });
      return true;
    } catch (error) {
      logger.warn('Cache setex error:', { key: this.prefixKey(key), error: (error as Error).message });
      return false;
    }
  }
}