import { Request, Response } from 'express';
import { AppError, ErrorFactory, ERROR_CATEGORIES } from '../utils/app-error';
import { CorrelatedRequest } from '../middleware/error-correlation.middleware';
import { Logger } from 'winston';
import { SentryService } from './sentry.service';
import { UnifiedConfig } from '../config/unified-config';

/**
 * Centralized Error Handling Service
 * 
 * This service provides standardized error handling across the application,
 * ensuring consistent error responses, proper logging, and error correlation.
 */
interface ErrorHandlingServiceDependencies {
  logger: Logger;
  sentryService: SentryService;
  config: UnifiedConfig;
}

export class ErrorHandlingService {
  private errorCounts: Map<string, number> = new Map();
  private errorThresholds: Map<string, number> = new Map();
  private logger: Logger;
  private sentryService: SentryService;
  private config: UnifiedConfig;

  constructor(dependencies: ErrorHandlingServiceDependencies) {
    this.logger = dependencies.logger;
    this.sentryService = dependencies.sentryService;
    this.config = dependencies.config;
    // Set default error thresholds
    this.errorThresholds.set('RATE_LIMIT_EXCEEDED', 100);
    this.errorThresholds.set('VALIDATION_ERROR', 50);
    this.errorThresholds.set('AUTHENTICATION_ERROR', 20);
    this.errorThresholds.set('DATABASE_ERROR', 10);
    this.errorThresholds.set('EXTERNAL_API_ERROR', 30);
  }

  /**
   * Handle application errors with standardized response format
   */
  handleError(
    err: AppError | Error,
    req: Request,
    res: Response,
    context?: Record<string, unknown>
    const correlatedReq = req as CorrelatedRequest;
    let appError: AppError;

    // Convert to AppError if needed
    if (err instanceof AppError) {
      this.logger.error('Error in error handler', err, {
        correlationId: correlatedReq.correlationId,
        originalError: err instanceof Error ? err.message : String(err),
        service: 'error_handling_service',
        ...context
      });
    } else {
      // Wrap regular Error as AppError
      appError = ErrorFactory.wrapError(err, ERROR_CATEGORIES.SERVICE, {
{{ ... }}
    // Check if error threshold is exceeded
    const threshold = this.errorThresholds.get(appError.code) || 0;
    if (currentCount + 1 >= threshold) {
      this.logger.warn(`Rate limit exceeded for error type: ${errorType}`, {
        count,
        threshold,
        correlationId: appError.context?.correlationId,
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
      correlationId: appError.context?.correlationId,
      userId: appError.context?.userId,
      service: appError.service,
      operation: appError.operation,
      metadata: appError.metadata,
      stack: appError.stack
    };

    // Log the error
    this.logger.error(appError.message, logData);
{{ ... }}
      case 'critical':
        logger.error(appError.message, logData);
        break;
      case 'high':
        logger.error(appError.message, logData);
        break;
      case 'medium':
        logger.warn(appError.message, logData);
        break;
      case 'low':
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
