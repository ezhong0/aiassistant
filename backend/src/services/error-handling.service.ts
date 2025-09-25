import { Request, Response } from 'express';
import { AppError, ErrorFactory, ERROR_CATEGORIES } from '../utils/app-error';
import { CorrelatedRequest } from '../middleware/error-correlation.middleware';
import logger from '../utils/logger';

/**
 * Centralized Error Handling Service
 * 
 * This service provides standardized error handling across the application,
 * ensuring consistent error responses, proper logging, and error correlation.
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorCounts: Map<string, number> = new Map();
  private errorThresholds: Map<string, number> = new Map();

  private constructor() {
    // Set default error thresholds
    this.errorThresholds.set('RATE_LIMIT_EXCEEDED', 100);
    this.errorThresholds.set('VALIDATION_ERROR', 50);
    this.errorThresholds.set('AUTHENTICATION_ERROR', 20);
    this.errorThresholds.set('DATABASE_ERROR', 10);
    this.errorThresholds.set('EXTERNAL_API_ERROR', 30);
  }

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle application errors with standardized response format
   */
  handleError(
    err: AppError | Error,
    req: Request,
    res: Response,
    context?: Record<string, unknown>
  ): void {
    const correlatedReq = req as CorrelatedRequest;
    let appError: AppError;

    // Convert to AppError if needed
    if (err instanceof AppError) {
      appError = err.addContext({
        correlationId: correlatedReq.correlationId,
        userId: correlatedReq.userId,
        service: 'error_handling_service',
        ...context
      });
    } else {
      // Wrap regular Error as AppError
      appError = ErrorFactory.wrapError(err, ERROR_CATEGORIES.SERVICE, {
        correlationId: correlatedReq.correlationId,
        userId: correlatedReq.userId,
        service: 'error_handling_service',
        metadata: {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          ...context
        }
      });
    }

    // Track error counts for monitoring
    this.trackError(appError);

    // Log with appropriate level based on severity
    this.logError(appError);

    // Send standardized response
    this.sendErrorResponse(res, appError);
  }

  /**
   * Handle 404 errors with standardized format
   */
  handleNotFound(req: Request, res: Response): void {
    const appError = ErrorFactory.notFound(`Route ${req.method} ${req.path}`);
    
    logger.warn('Route not found', {
      error: appError.code,
      statusCode: appError.statusCode,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: (req as CorrelatedRequest).correlationId
    });

    this.sendErrorResponse(res, appError);
  }

  /**
   * Handle validation errors with detailed field information
   */
  handleValidationError(
    errors: Array<{ field: string; message: string; value?: unknown }>,
    req: Request,
    res: Response
  ): void {
    const appError = ErrorFactory.validationError('Validation failed', {
      correlationId: (req as CorrelatedRequest).correlationId,
      userId: (req as CorrelatedRequest).userId,
      service: 'error_handling_service',
      metadata: {
        method: req.method,
        url: req.url,
        validationErrors: errors
      }
    });

    this.trackError(appError);
    this.logError(appError);
    this.sendErrorResponse(res, appError);
  }

  /**
   * Handle rate limiting errors
   */
  handleRateLimitError(req: Request, res: Response, retryAfter?: number): void {
    const appError = ErrorFactory.rateLimitError('Rate limit exceeded', {
      correlationId: (req as CorrelatedRequest).correlationId,
      userId: (req as CorrelatedRequest).userId,
      service: 'error_handling_service',
      metadata: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        retryAfter
      }
    });

    this.trackError(appError);
    this.logError(appError);
    this.sendErrorResponse(res, appError, retryAfter);
  }

  /**
   * Track error counts for monitoring and alerting
   */
  private trackError(appError: AppError): void {
    const errorKey = `${appError.category}:${appError.code}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    // Check if error threshold is exceeded
    const threshold = this.errorThresholds.get(appError.code) || 0;
    if (currentCount + 1 >= threshold) {
      logger.error('Error threshold exceeded', {
        error: appError.code,
        category: appError.category,
        count: currentCount + 1,
        threshold,
        correlationId: appError.correlationId,
        operation: 'error_threshold_exceeded'
      });
    }
  }

  /**
   * Log error with appropriate level based on severity
   */
  private logError(appError: AppError): void {
    const logData = {
      error: appError.code,
      statusCode: appError.statusCode,
      severity: appError.severity,
      category: appError.category,
      correlationId: appError.correlationId,
      userId: appError.userId,
      service: appError.service,
      operation: appError.operation,
      metadata: appError.metadata,
      stack: appError.stack
    };

    switch (appError.severity) {
      case 'critical':
        logger.error(appError.message, logData);
        break;
      case 'error':
        logger.error(appError.message, logData);
        break;
      case 'warning':
        logger.warn(appError.message, logData);
        break;
      case 'info':
        logger.info(appError.message, logData);
        break;
      default:
        logger.error(appError.message, logData);
    }
  }

  /**
   * Send standardized error response
   */
  private sendErrorResponse(res: Response, appError: AppError, retryAfter?: number): void {
    const response: any = {
      success: false,
      error: {
        code: appError.code,
        message: appError.userFriendly ? appError.message : 'Internal server error',
        ...(appError.correlationId && { correlationId: appError.correlationId })
      },
      timestamp: new Date().toISOString()
    };

    // Add retry-after header for rate limiting
    if (retryAfter) {
      res.set('Retry-After', retryAfter.toString());
    }

    // Add additional headers for debugging in development
    if (process.env.NODE_ENV === 'development') {
      response.error.details = {
        category: appError.category,
        severity: appError.severity,
        operation: appError.operation,
        metadata: appError.metadata
      };
    }

    res.status(appError.statusCode).json(response);
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number;
    errorCounts: Record<string, number>;
    errorThresholds: Record<string, number>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      totalErrors,
      errorCounts: Object.fromEntries(this.errorCounts),
      errorThresholds: Object.fromEntries(this.errorThresholds)
    };
  }

  /**
   * Reset error counts (useful for testing or periodic resets)
   */
  resetErrorCounts(): void {
    this.errorCounts.clear();
    logger.info('Error counts reset', {
      correlationId: `error-reset-${Date.now()}`,
      operation: 'error_counts_reset'
    });
  }

  /**
   * Set custom error threshold for monitoring
   */
  setErrorThreshold(errorCode: string, threshold: number): void {
    this.errorThresholds.set(errorCode, threshold);
    logger.debug('Error threshold set', {
      correlationId: `error-threshold-${Date.now()}`,
      operation: 'error_threshold_set',
      metadata: { errorCode, threshold }
    });
  }
}

// Export singleton instance
export const errorHandlingService = ErrorHandlingService.getInstance();
