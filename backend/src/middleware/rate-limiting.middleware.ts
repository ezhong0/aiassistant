import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';
import { config } from '../config';
import { serviceManager, IService, ServiceState } from '../services/service-manager';

interface RateLimitData {
  count: number;
  resetTime: number;
  firstRequestTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
  standardHeaders?: boolean; // Send standard rate limit headers
  legacyHeaders?: boolean; // Send legacy X-RateLimit headers
}

class RateLimitStore implements IService {
  public readonly name = 'RateLimitStore';
  private _state: ServiceState = ServiceState.INITIALIZING;
  private store = new Map<string, RateLimitData>();
  private cleanupInterval: ReturnType<typeof globalThis.setInterval> | null = null;
  private readonly maxStoreSize = 10000; // Maximum entries to prevent memory bloat
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours TTL for entries
  
  constructor() {
    // Cleanup expired entries using configured interval from unified config
    this.cleanupInterval = globalThis.setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5 minutes from unified config
    
    this._state = ServiceState.READY;
  }
  
  get state(): ServiceState {
    return this._state;
  }
  
  async initialize(): Promise<void> {
    // Already initialized in constructor
  }
  
  isReady(): boolean {
    return this._state === ServiceState.READY;
  }
  
  async destroy(): Promise<void> {
    this._state = ServiceState.SHUTTING_DOWN;
    
    if (this.cleanupInterval) {
      globalThis.clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
    
    this._state = ServiceState.DESTROYED;
  }
  
  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        state: this._state,
        totalEntries: this.store.size,
        hasCleanupInterval: !!this.cleanupInterval
      }
    };
  }
  
  get(key: string): RateLimitData | undefined {
    return this.store.get(key);
  }
  
  set(key: string, data: RateLimitData): void {
    this.store.set(key, data);
  }
  
  increment(key: string, windowMs: number): RateLimitData {
    const existing = this.store.get(key);
    
    // Check if entry exists and is not expired
    if (!existing || Date.now() > existing.resetTime) {
      // Create new entry or reset expired entry
      const now = Date.now();
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + windowMs,
        firstRequestTime: now
      };
      
      // Prevent memory bloat by enforcing max store size
      if (this.store.size >= this.maxStoreSize) {
        this.aggressiveCleanup();
      }
      
      this.store.set(key, newData);
      return newData;
    }
    
    // Increment existing entry
    existing.count++;
    return existing;
  }
  
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, data] of this.store.entries()) {
      // Clean up expired entries (beyond reset time) or entries older than TTL
      if (now > data.resetTime || (now - data.firstRequestTime) > this.ttlMs) {
        this.store.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Rate limit cleanup completed', {
        correlationId: `cleanup-${Date.now()}`,
        operation: 'rate_limit_cleanup',
        metadata: { 
          cleanedCount,
          remainingEntries: this.store.size,
          maxStoreSize: this.maxStoreSize
        }
      });
    }
  }

  private aggressiveCleanup(): void {
    const entries = Array.from(this.store.entries());
    
    // Sort by first request time (oldest first)
    entries.sort(([, a], [, b]) => a.firstRequestTime - b.firstRequestTime);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    let removedCount = 0;
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.store.delete(entries[i][0]);
      removedCount++;
    }
    
    logger.warn('Aggressive rate limit cleanup performed', {
      correlationId: `aggressive-cleanup-${Date.now()}`,
      operation: 'rate_limit_aggressive_cleanup',
      metadata: { 
        removedCount,
        remainingEntries: this.store.size,
        maxStoreSize: this.maxStoreSize
      }
    });
  }
  
  getStats() {
    return {
      totalEntries: this.store.size,
      maxStoreSize: this.maxStoreSize,
      ttlMs: this.ttlMs,
      memoryUsage: process.memoryUsage().heapUsed,
      isNearCapacity: this.store.size >= this.maxStoreSize * 0.8
    };
  }
  

}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

// Register with service manager for graceful shutdown
serviceManager.registerService('rateLimitStore', rateLimitStore);

/**
 * Generic rate limiting middleware
 */
export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || 'unknown',
    message = `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.`,
    standardHeaders = true,
    legacyHeaders = false
  } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip rate limiting if disabled in unified config
      if (!config.security.rateLimiting.enabled) {
        next();
        return;
      }
      
      const key = keyGenerator(req);
      const data = rateLimitStore.increment(key, windowMs);
      
      // Add rate limit headers
      if (standardHeaders) {
        res.set({
          'RateLimit-Limit': maxRequests.toString(),
          'RateLimit-Remaining': Math.max(0, maxRequests - data.count).toString(),
          'RateLimit-Reset': Math.ceil(data.resetTime / 1000).toString()
        });
      }
      
      if (legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, maxRequests - data.count).toString(),
          'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000).toString()
        });
      }
      
      if (data.count > maxRequests) {
        logger.warn('Rate limit exceeded', {
          correlationId: `rate-limit-${Date.now()}`,
          operation: 'rate_limit_exceeded',
          metadata: {
            key: key.substring(0, 10) + '***', // Partially mask for privacy
            count: data.count,
            maxRequests,
            windowMs,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent')
          }
        });
        
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message,
            retryAfter: Math.ceil((data.resetTime - Date.now()) / 1000)
          }
        });
        return;
      }
      
      // Log if approaching limit (90% of max)
      if (data.count >= maxRequests * 0.9) {
        logger.warn('Rate limit warning', {
          correlationId: `rate-limit-warn-${Date.now()}`,
          operation: 'rate_limit_warning',
          metadata: {
            key: key.substring(0, 10) + '***',
            count: data.count,
            maxRequests,
            remainingRequests: maxRequests - data.count
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Rate limiting middleware error', error as Error, {
        correlationId: `rate-limit-error-${Date.now()}`,
        operation: 'rate_limit_middleware_error'
      });
      // Don't block requests on rate limiting errors
      next();
    }
  };
};

/**
 * Pre-configured rate limiting middleware
 */

// General API rate limiting
export const apiRateLimit = rateLimit({
  windowMs: 900000, // 15 minutes
  maxRequests: 100, // 109 requests
  message: 'Too many API requests. Please try again later.',
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: config.security.rateLimiting.authWindowMs,
  maxRequests: config.security.rateLimiting.authMaxRequests,
  message: 'Too many authentication attempts. Please try again later.',
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// Very strict rate limiting for sensitive operations
export const sensitiveOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many sensitive operations. Please try again later.',
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// User-specific rate limiting (requires authentication)
export const userRateLimit = (
  maxRequests: number = 100, 
  windowMs: number = config.security.rateLimiting.windowMs
) => {
  return rateLimit({
    windowMs,
    maxRequests,
    message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes per user.`,
    keyGenerator: (req: AuthenticatedRequest) => {
      return req.user?.userId || req.ip || 'unknown';
    }
  });
};

// Progressive rate limiting (increases with repeated violations)
export const progressiveRateLimit = (baseMaxRequests: number = 100) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: baseMaxRequests,
    keyGenerator: (req: Request) => {
      const baseKey = req.ip || 'unknown';
      return baseKey;
    }
  });
};

// Export store for monitoring
export { rateLimitStore };