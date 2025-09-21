import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { configService } from '../config/config.service';

/**
 * CORS configuration
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = configService.corsOrigin.split(',').map((o: string) => o.trim());
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development
    if (configService.isDevelopment) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    logger.warn('CORS origin blocked', {
      correlationId: `cors-blocked-${Date.now()}`,
      operation: 'cors_blocked',
      metadata: { origin, allowedOrigins }
    });
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
});

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: configService.isProduction ? [] : null
    },
    reportOnly: configService.isDevelopment
  },
  crossOriginEmbedderPolicy: false, // Disabled for API
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * Request compression middleware
 */
export const compressionMiddleware = compression({
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
  level: configService.isProduction ? 6 : 1, // Higher compression in production
  threshold: 1024 // Only compress if response is larger than 1KB
});

/**
 * Request size limiting middleware
 */
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const maxSize = 10 * 1024 * 1024; // 10MB max
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  
  if (contentLength > maxSize) {
    logger.warn('Request size too large', {
      correlationId: `request-too-large-${Date.now()}`,
      operation: 'request_size_limit',
      metadata: {
        contentLength,
        maxSize,
        path: req.path,
        ip: req.ip
      }
    });
    
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large'
      }
    });
    return;
  }
  
  next();
};

/**
 * Security headers for API responses
 */
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  
  next();
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip for GET requests and OPTIONS
    if (req.method === 'GET' || req.method === 'OPTIONS') {
      return next();
    }
    
    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required'
        }
      });
      return;
    }
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      logger.warn('Invalid content type', {
        correlationId: `invalid-content-type-${Date.now()}`,
        operation: 'content_type_validation',
        metadata: {
          contentType,
          allowedTypes,
          path: req.path,
          ip: req.ip
        }
      });
      
      res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
        }
      });
      return;
    }
    
    next();
  };
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = (globalThis as any).setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          correlationId: `request-timeout-${Date.now()}`,
          operation: 'request_timeout',
          metadata: {
            path: req.path,
            method: req.method,
            timeoutMs,
            ip: req.ip
          }
        });
        
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout'
          }
        });
      }
    }, timeoutMs);
    
    // Clear timeout when request finishes
    res.on('finish', () => (globalThis as any).clearTimeout(timeout));
    res.on('close', () => (globalThis as any).clearTimeout(timeout));
    
    next();
  };
};

/**
 * Sanitize request data middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize common XSS patterns
  const sanitizeObject = (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {} as Record<string, unknown>;
      for (const key in obj as Record<string, unknown>) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitizeObject((obj as Record<string, unknown>)[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Note: req.query is readonly in Express 5.x, handled by validation middleware
  
  next();
};