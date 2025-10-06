import { Request, Response, NextFunction } from 'express';
import { SupabaseAuthenticatedRequest } from './supabase-auth.middleware';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config/service-config';

interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  path: string;
  ip: string;
  userAgent?: string;
  userId?: string;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: Record<string, string>;
  timestamp: string;
  contentLength?: number;
}

interface ResponseLogData {
  requestId: string;
  statusCode: number;
  contentLength?: number;
  responseTime: number;
  success?: boolean;
  error?: string;
  timestamp: string;
}

interface LoggingOptions {
  logBody?: boolean;
  logHeaders?: boolean;
  logQuery?: boolean;
  logParams?: boolean;
  maxBodyLength?: number;
  sensitiveFields?: string[];
  samplingRate?: number; // 0.0 - 1.0 for request sampling
}

/**
 * Structured API logging middleware with configurable log levels and sampling
 *
 * Uses centralized Config for defaults, supports per-route overrides
 */
export const apiLoggingMiddleware = (options: LoggingOptions = {}) => {
  const {
    logBody = Config.logging.enableRequestLogging,
    logHeaders = false,
    logQuery = true,
    logParams = true,
    maxBodyLength = Config.logging.maxBodyLength,
    sensitiveFields = Config.logging.sensitiveFields,
    samplingRate = 1.0, // 100% by default
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = uuidv4();

    // Add request ID to request object
    req.requestId = requestId;
    req.startTime = startTime;

    // Sampling: Skip logging for some requests (always log errors)
    const shouldLog = Math.random() < samplingRate;

    // Build request log data
    const requestLogData: RequestLogData = {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as SupabaseAuthenticatedRequest).user?.id,
      timestamp: new Date().toISOString(),
    };

    if (logBody && req.body) {
      requestLogData.body = sanitizeObject(req.body, sensitiveFields, maxBodyLength);
    }

    if (logQuery && Object.keys(req.query).length > 0) {
      requestLogData.query = sanitizeObject(req.query, sensitiveFields);
    }

    if (logParams && Object.keys(req.params).length > 0) {
      requestLogData.params = sanitizeObject(req.params, sensitiveFields);
    }

    if (logHeaders) {
      requestLogData.headers = sanitizeHeaders(req.headers, sensitiveFields);
    }

    if (req.get('Content-Length')) {
      requestLogData.contentLength = parseInt(req.get('Content-Length')!, 10);
    }

    // Log request (respects config and sampling)
    if (shouldLog && Config.logging.enableRequestLogging) {
      logger.log(Config.logging.level, 'API Request', {
        correlationId: requestId,
        userId: (req as SupabaseAuthenticatedRequest).user?.id,
        sessionId: req.headers['x-session-id'] as string,
        operation: 'api_request_start',
        metadata: requestLogData
      });
    }

    // Override res.json to capture response data
    const originalJson = res.json;
    const originalSend = res.send;
    let responseData: unknown;

    res.json = function(body: unknown) {
      responseData = body;
      return originalJson.call(this, body);
    };

    res.send = function(body: unknown) {
      if (!responseData) {
        responseData = body;
      }
      return originalSend.call(this, body);
    };

    // Log response when request finishes
    const logResponse = () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const responseLogData: ResponseLogData = {
        requestId,
        statusCode: res.statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
      };

      const contentLength = res.get('Content-Length');
      if (contentLength) {
        responseLogData.contentLength = parseInt(contentLength, 10);
      }

      // Extract success/error info from response body
      if (responseData && typeof responseData === 'object') {
        const data = responseData as any;
        responseLogData.success = data.success;
        if (data.error) {
          responseLogData.error = typeof data.error === 'string' ? data.error : data.error.code || 'unknown';
        }
      }

      const logLevel = getLogLevel(res.statusCode, responseTime);
      const logMessage = `API ${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`;

      // Log based on level (respects config and sampling)
      const shouldLogResponse = (shouldLog || res.statusCode >= 400) && shouldLogAtLevel(logLevel);

      if (shouldLogResponse && Config.logging.enableResponseLogging) {
        logger[logLevel](logMessage, {
          correlationId: requestId,
          userId: (req as SupabaseAuthenticatedRequest).user?.id,
          sessionId: req.headers['x-session-id'] as string,
          operation: `api_response_${logLevel}`,
          metadata: {
            ...responseLogData,
            ...(logBody ? { responseBody: sanitizeObject(responseData, sensitiveFields, maxBodyLength) } : {}),
          },
        });
      }

      // Slow query logging (separate from response logging)
      if (responseTime > Config.logging.slowQueryThreshold && Config.logging.enableSlowQueryLogging) {
        logger.warn('Slow API Response', {
          correlationId: requestId,
          userId: (req as SupabaseAuthenticatedRequest).user?.id,
          sessionId: req.headers['x-session-id'] as string,
          operation: 'slow_api_response',
          metadata: {
            method: req.method,
            path: req.path,
            responseTime,
            statusCode: res.statusCode
          }
        });
      }
    };

    // Attach listeners for response completion
    res.on('finish', logResponse);
    res.on('close', logResponse);

    next();
  };
};

/**
 * Sanitize object by removing or masking sensitive fields
 */
const sanitizeObject = (
  obj: unknown, 
  sensitiveFields: string[], 
  maxLength?: number,
): unknown => {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string' && maxLength && obj.length > maxLength) {
      return `${obj.substring(0, maxLength)  }... [truncated]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sensitiveFields, maxLength));
  }

  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, sensitiveFields, maxLength);
    } else if (typeof value === 'string' && maxLength && value.length > maxLength) {
      sanitized[key] = `${value.substring(0, maxLength)  }... [truncated]`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Sanitize headers by removing sensitive information
 */
const sanitizeHeaders = (
  headers: Record<string, unknown>, 
  sensitiveFields: string[],
): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
};

/**
 * Determine log level based on status code and response time
 */
const getLogLevel = (statusCode: number, responseTime: number): 'info' | 'warn' | 'error' => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  if (responseTime > Config.logging.slowQueryThreshold) return 'warn';
  return 'info';
};

/**
 * Determine if we should log at this level based on config
 */
const shouldLogAtLevel = (level: 'info' | 'warn' | 'error'): boolean => {
  const configLevel = Config.logging.level;
  const levels: Record<string, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  };
  return levels[level] <= levels[configLevel];
};

