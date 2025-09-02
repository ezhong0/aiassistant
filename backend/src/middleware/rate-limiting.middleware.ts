import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import configService from '../config/config.service';
import logger from '../utils/logger';
import { RATE_LIMITS, TIMEOUTS } from '../config/app-config';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';
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
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Cleanup expired entries using configured interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, TIMEOUTS.rateLimitCleanup);
    
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
      clearInterval(this.cleanupInterval);
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
    const now = Date.now();
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      // Create new entry or reset expired entry
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + windowMs,
        firstRequestTime: now
      };
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
      if (now > data.resetTime) {
        this.store.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired rate limit entries`);
    }
  }
  
  getStats() {
    return {
      totalEntries: this.store.size,
      memoryUsage: process.memoryUsage().heapUsed
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
      // Skip rate limiting in development mode or if disabled
      if (ENV_VALIDATION.isDevelopment() || !ENVIRONMENT.features.rateLimiting) {
        next();
        return;
      }
      
      // TEMPORARY: Skip rate limiting for OAuth debugging
      if (req.path.includes('/auth/')) {
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
          key: key.substring(0, 10) + '***', // Partially mask for privacy
          count: data.count,
          maxRequests,
          windowMs,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent')
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
          key: key.substring(0, 10) + '***',
          count: data.count,
          maxRequests,
          remainingRequests: maxRequests - data.count
        });
      }
      
      next();
    } catch (error) {
      logger.error('Rate limiting middleware error:', error);
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
  windowMs: configService.rateLimitWindowMs, // 15 minutes
  maxRequests: configService.rateLimitMaxRequests, // 100 requests
  message: 'Too many API requests. Please try again later.',
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: RATE_LIMITS.auth.windowMs,
  maxRequests: RATE_LIMITS.auth.maxRequests,
  message: RATE_LIMITS.auth.message,
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// Very strict rate limiting for sensitive operations
export const sensitiveOperationRateLimit = rateLimit({
  windowMs: RATE_LIMITS.sensitive.windowMs,
  maxRequests: RATE_LIMITS.sensitive.maxRequests,
  message: RATE_LIMITS.sensitive.message,
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// User-specific rate limiting (requires authentication)
export const userRateLimit = (
  maxRequests: number = RATE_LIMITS.user.defaultMaxRequests, 
  windowMs: number = RATE_LIMITS.user.defaultWindowMs
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
      // TODO: Implement violation history tracking
      return baseKey;
    }
  });
};

// Export store for monitoring
export { rateLimitStore };