import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  path: string;
  ip: string;
  userAgent?: string | undefined;
  userId?: string | undefined;
  body?: unknown | undefined;
  query?: unknown | undefined;
  params?: unknown | undefined;
  headers?: Record<string, string> | undefined;
  timestamp: string;
  contentLength?: number | undefined;
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

/**
 * Enhanced request/response logging middleware for API endpoints
 */
export const apiLoggingMiddleware = (options: {
  logBody?: boolean;
  logHeaders?: boolean;
  logQuery?: boolean;
  logParams?: boolean;
  maxBodyLength?: number;
  sensitiveFields?: string[];
} = {}) => {
  const {
    logBody = true,
    logHeaders = false,
    logQuery = true,
    logParams = true,
    maxBodyLength = 10000,
    sensitiveFields = ['password', 'token', 'authorization', 'cookie', 'access_token', 'refresh_token'],
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    // Add request ID to request object for use in other middleware/routes
    req.requestId = requestId;
    req.startTime = startTime;

    // Prepare request log data
    const requestLogData: RequestLogData = {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as AuthenticatedRequest).user?.userId || undefined,
      timestamp: new Date().toISOString(),
    };

    // Add optional data based on configuration
    if (logBody && req.body) {
      requestLogData.body = sanitizeObject(req.body, sensitiveFields, maxBodyLength);
    }

    if (logQuery && req.query && Object.keys(req.query).length > 0) {
      requestLogData.query = sanitizeObject(req.query, sensitiveFields);
    }

    if (logParams && req.params && Object.keys(req.params).length > 0) {
      requestLogData.params = sanitizeObject(req.params, sensitiveFields);
    }

    if (logHeaders) {
      requestLogData.headers = sanitizeHeaders(req.headers, sensitiveFields);
    }

    if (req.get('Content-Length')) {
      requestLogData.contentLength = parseInt(req.get('Content-Length') || '0', 10);
    }

    // Log the incoming request - TEMPORARILY DISABLED
    // logger.info('API Request', {
    //   correlationId: requestId,
    //   userId: (req as AuthenticatedRequest).user?.userId,
    //   sessionId: req.headers['x-session-id'] as string,
    //   operation: 'api_request_start',
    //   metadata: requestLogData
    // });

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

      // Add response content length if available
      const contentLength = res.get('Content-Length');
      if (contentLength) {
        responseLogData.contentLength = parseInt(contentLength, 10);
      }

      // Extract success/error info from response body if it's JSON
      if (responseData && typeof responseData === 'object') {
        const data = responseData as any;
        responseLogData.success = data.success;
        if (data.error) {
          responseLogData.error = typeof data.error === 'string' ? data.error : data.error.code || 'unknown';
        }
      }

      // Determine log level based on status code and response time
      const logLevel = getLogLevel(res.statusCode, responseTime);
      
      const logMessage = `API Response - ${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`;

      // TEMPORARILY DISABLED - Only log errors
      if (logLevel === 'error') {
        logger.error(logMessage, {
          error: 'API Response Error',
          correlationId: requestId,
          userId: (req as AuthenticatedRequest).user?.userId,
          sessionId: req.headers['x-session-id'] as string,
          operation: 'api_response_error',
          metadata: {
            ...responseLogData,
            responseBody: logBody ? sanitizeObject(responseData, sensitiveFields, maxBodyLength) : undefined,
          },
        });
      }
      // Disabled: warn and info logging
      // } else if (logLevel === 'warn') {
      //   logger.warn(logMessage, {
      //     correlationId: requestId,
      //     userId: (req as AuthenticatedRequest).user?.userId,
      //     sessionId: req.headers['x-session-id'] as string,
      //     operation: 'api_response_warn',
      //     metadata: responseLogData
      //   });
      // } else {
      //   logger.info(logMessage, {
      //     correlationId: requestId,
      //     userId: (req as AuthenticatedRequest).user?.userId,
      //     sessionId: req.headers['x-session-id'] as string,
      //     operation: 'api_response_success',
      //     metadata: responseLogData
      //   });
      // }

      // TEMPORARILY DISABLED - Slow request logging
      // if (responseTime > 5000) { // Slow requests > 5 seconds
      //   logger.warn('Slow API Response', {
      //     correlationId: requestId,
      //     userId: (req as AuthenticatedRequest).user?.userId,
      //     sessionId: req.headers['x-session-id'] as string,
      //     operation: 'slow_api_response',
      //     metadata: {
      //       method: req.method,
      //       path: req.path,
      //       responseTime,
      //       statusCode: res.statusCode
      //     }
      //   });
      // }
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
  if (statusCode >= 500) {
    return 'error';
  }
  
  if (statusCode >= 400 || responseTime > 10000) {
    return 'warn';
  }
  
  return 'info';
};



