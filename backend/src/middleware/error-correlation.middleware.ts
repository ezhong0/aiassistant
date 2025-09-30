/**
import logger from '../utils/logger';
 * Error Correlation Middleware for AI Assistant
 *
 * Provides request correlation IDs, timing metrics, and structured error tracking
 * for comprehensive observability and debugging capabilities.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extended Request interface with correlation data
 */
export interface CorrelatedRequest extends Request {
  correlationId: string;
  startTime: number;
  userId?: string;
  sessionId?: string;
  endpoint: string;
  metadata: Record<string, any>;
}

/**
 * Request metrics for tracking
 */
interface RequestMetrics {
  correlationId: string;
  method: string;
  path: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip: string;
  error?: {
    code: string;
    message: string;
    stack?: string;
    severity: string;
  };
}

/**
 * Correlation storage for tracking active requests
 */
class CorrelationStore {
  private activeRequests = new Map<string, RequestMetrics>();
  private recentRequests: RequestMetrics[] = [];
  private maxRecentRequests = 1000;

  /**
   * Start tracking a request
   */
  startRequest(correlationId: string, metrics: Omit<RequestMetrics, 'correlationId'>): void {
    const requestMetrics: RequestMetrics = {
      correlationId,
      ...metrics
    };

    this.activeRequests.set(correlationId, requestMetrics);
  }

  /**
   * Complete request tracking
   */
  completeRequest(
    correlationId: string,
    statusCode: number,
    error?: { code: string; message: string; stack?: string; severity: string }
  ): RequestMetrics | undefined {
    const metrics = this.activeRequests.get(correlationId);
    if (!metrics) {
      return undefined;
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.statusCode = statusCode;
    if (error) {
      metrics.error = error;
    }

    // Move to completed requests
    this.activeRequests.delete(correlationId);
    this.recentRequests.push(metrics);

    // Maintain size limit
    if (this.recentRequests.length > this.maxRecentRequests) {
      this.recentRequests = this.recentRequests.slice(-this.maxRecentRequests * 0.8);
    }

    return metrics;
  }

  /**
   * Get active request metrics
   */
  getActiveRequest(correlationId: string): RequestMetrics | undefined {
    return this.activeRequests.get(correlationId);
  }

  /**
   * Get all active requests
   */
  getActiveRequests(): RequestMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get recent completed requests
   */
  getRecentRequests(limit: number = 50): RequestMetrics[] {
    return this.recentRequests.slice(-limit);
  }

  /**
   * Get requests by user
   */
  getRequestsByUser(userId: string, limit: number = 20): RequestMetrics[] {
    return this.recentRequests
      .filter(req => req.userId === userId)
      .slice(-limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalRequests: number;
    activeRequests: number;
    errorRate: number;
    averageResponseTime: number;
    slowRequests: RequestMetrics[];
    errorsByCode: Record<string, number>;
  } {
    const recentWindow = Date.now() - 300000; // Last 5 minutes
    const recentRequests = this.recentRequests.filter(req => req.startTime > recentWindow);

    const errorRequests = recentRequests.filter(req => req.error);
    const errorRate = recentRequests.length > 0 ? (errorRequests.length / recentRequests.length) * 100 : 0;

    const completedRequests = recentRequests.filter(req => req.duration !== undefined);
    const averageResponseTime = completedRequests.length > 0
      ? completedRequests.reduce((sum, req) => sum + (req.duration || 0), 0) / completedRequests.length
      : 0;

    const slowRequests = completedRequests
      .filter(req => (req.duration || 0) > 5000) // Slower than 5 seconds
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    const errorsByCode: Record<string, number> = {};
    errorRequests.forEach(req => {
      if (req.error) {
        errorsByCode[req.error.code] = (errorsByCode[req.error.code] || 0) + 1;
      }
    });

    return {
      totalRequests: recentRequests.length,
      activeRequests: this.activeRequests.size,
      errorRate,
      averageResponseTime,
      slowRequests,
      errorsByCode
    };
  }

  /**
   * Clear old data (for cleanup)
   */
  cleanup(): void {
    const cutoffTime = Date.now() - 3600000; // 1 hour ago
    this.recentRequests = this.recentRequests.filter(req => req.startTime > cutoffTime);

    // Remove stale active requests (longer than 10 minutes)
    const staleTime = Date.now() - 600000;
    for (const [correlationId, metrics] of this.activeRequests.entries()) {
      if (metrics.startTime < staleTime) {
        this.activeRequests.delete(correlationId);
      }
    }
  }
}

/**
 * Global correlation store instance
 */
const correlationStore = new CorrelationStore();

/**
 * Start periodic cleanup
 */
globalThis.setInterval(() => {
  correlationStore.cleanup();
}, 300000); // Every 5 minutes

/**
 * Middleware to add correlation ID and start request tracking
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlatedReq = req as CorrelatedRequest;

  // Generate or extract correlation ID
  correlatedReq.correlationId = req.headers['x-correlation-id'] as string ||
                                req.headers['x-request-id'] as string ||
                                uuidv4();

  // Set timing information
  correlatedReq.startTime = Date.now();

  // Extract user information from headers or JWT
  correlatedReq.userId = req.headers['x-user-id'] as string;
  correlatedReq.sessionId = req.headers['x-session-id'] as string;

  // Set endpoint information
  correlatedReq.endpoint = `${req.method} ${req.path}`;

  // Initialize metadata
  correlatedReq.metadata = {};

  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlatedReq.correlationId);

  // Start request tracking
  correlationStore.startRequest(correlatedReq.correlationId, {
    method: req.method,
    path: req.path,
    startTime: correlatedReq.startTime,
    userId: correlatedReq.userId,
    sessionId: correlatedReq.sessionId,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress || 'unknown'
  });

  // Log request start
  logger.info('Request started', {
    correlationId: correlatedReq.correlationId,
    userId: correlatedReq.userId,
    sessionId: correlatedReq.sessionId,
    operation: 'request_start',
    metadata: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  });

  // Capture original res.end to track completion
  const originalEnd = res.end.bind(res);
  res.end = function(this: Response, ...args: any[]): Response {
    // Complete request tracking
    const metrics = correlationStore.completeRequest(
      correlatedReq.correlationId,
      res.statusCode
    );

    // Log request completion
    if (metrics) {
      logger.info('Request completed', {
        correlationId: correlatedReq.correlationId,
        userId: correlatedReq.userId,
        sessionId: correlatedReq.sessionId,
        operation: 'request_complete',
        metadata: {
          statusCode: res.statusCode,
          duration: metrics.duration,
          method: req.method,
          path: req.path
        }
      });
    }

    // Call original end
    return originalEnd(...args);
  };

  next();
}

/**
 * Middleware to capture and correlate errors
 */
export function errorCorrelationMiddleware(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlatedReq = req as CorrelatedRequest;
  const correlationId = correlatedReq.correlationId || 'unknown';

  // Structure error information
  const errorInfo = {
    code: error.code || error.name || 'UNKNOWN_ERROR',
    message: error.message || 'An unknown error occurred',
    stack: error.stack,
    severity: error.severity || 'medium'
  };

  // Update request tracking with error
  correlationStore.completeRequest(correlationId, 500, errorInfo);

  // Add correlation context to error
  if (error.setContext && typeof error.setContext === 'function') {
    error.setContext(undefined, undefined, correlationId);
  }

  // Add correlation metadata
  if (error.addDetails && typeof error.addDetails === 'function') {
    error.addDetails('correlationId', correlationId);
    error.addDetails('endpoint', correlatedReq.endpoint);
    error.addDetails('userId', correlatedReq.userId);
    error.addDetails('requestDuration', Date.now() - correlatedReq.startTime);
  }

  // Log correlated error
  logger.error('Correlated error occurred', error as Error, {
    correlationId,
    userId: correlatedReq.userId,
    sessionId: correlatedReq.sessionId,
    operation: 'error_correlation',
    metadata: {
      error: errorInfo,
      endpoint: correlatedReq.endpoint,
      requestDuration: Date.now() - correlatedReq.startTime
    }
  });

  next(error);
}

/**
 * Utility to get current correlation ID from async context
 * This would integrate with AsyncLocalStorage in a full implementation
 */
export function getCurrentCorrelationId(): string | undefined {
  // In a full implementation, this would use AsyncLocalStorage
  // For now, return undefined as a placeholder
  return undefined;
}

/**
 * Utility to add correlation context to any error
 */
export function addCorrelationContext(
  error: any,
  correlationId?: string,
  additionalContext?: Record<string, any>
): void {
  if (error.setContext && typeof error.setContext === 'function') {
    error.setContext(undefined, undefined, correlationId);
  }

  if (error.addDetails && typeof error.addDetails === 'function') {
    if (correlationId) {
      error.addDetails('correlationId', correlationId);
    }
    if (additionalContext) {
      Object.entries(additionalContext).forEach(([key, value]) => {
        error.addDetails(key, value);
      });
    }
  }
}

/**
 * API endpoint to get correlation statistics
 */
export function getCorrelationStats(): {
  activeRequests: RequestMetrics[];
  recentRequests: RequestMetrics[];
  errorStats: ReturnType<CorrelationStore['getErrorStats']>;
} {
  return {
    activeRequests: correlationStore.getActiveRequests(),
    recentRequests: correlationStore.getRecentRequests(),
    errorStats: correlationStore.getErrorStats()
  };
}

/**
 * API endpoint to get requests by user
 */
export function getRequestsByUser(userId: string, limit?: number): RequestMetrics[] {
  return correlationStore.getRequestsByUser(userId, limit);
}

/**
 * API endpoint to get request by correlation ID
 */
export function getRequestByCorrelationId(correlationId: string): RequestMetrics | undefined {
  return correlationStore.getActiveRequest(correlationId) ||
         correlationStore.getRecentRequests().find(req => req.correlationId === correlationId);
}

/**
 * Middleware factory with configuration options
 */
export function createCorrelationMiddleware(options: {
  headerName?: string;
  includeUserAgent?: boolean;
  includeBody?: boolean;
  maxRecentRequests?: number;
} = {}) {
  const {
    headerName = 'x-correlation-id',
    includeUserAgent = true
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const correlatedReq = req as CorrelatedRequest;

    // Generate or extract correlation ID
    correlatedReq.correlationId = req.headers[headerName] as string ||
                                  req.headers['x-request-id'] as string ||
                                  uuidv4();

    correlatedReq.startTime = Date.now();
    correlatedReq.endpoint = `${req.method} ${req.path}`;
    correlatedReq.metadata = {};

    // Extract user information
    correlatedReq.userId = req.headers['x-user-id'] as string;
    correlatedReq.sessionId = req.headers['x-session-id'] as string;

    res.setHeader(headerName, correlatedReq.correlationId);

    // Build request metrics
    const metrics: Omit<RequestMetrics, 'correlationId'> = {
      method: req.method,
      path: req.path,
      startTime: correlatedReq.startTime,
      userId: correlatedReq.userId,
      sessionId: correlatedReq.sessionId,
      ip: req.ip || req.socket.remoteAddress || 'unknown'
    };

    if (includeUserAgent) {
      metrics.userAgent = req.headers['user-agent'];
    }

    correlationStore.startRequest(correlatedReq.correlationId, metrics);

    logger.debug('Request started with correlation', {
      correlationId: correlatedReq.correlationId,
      userId: correlatedReq.userId,
      sessionId: correlatedReq.sessionId,
      operation: 'correlation_start',
      metadata: {
        method: req.method,
        path: req.path
      }
    });

    next();
  };
}

// Export the correlation store for testing
export { correlationStore };