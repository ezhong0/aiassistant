/**
 * Error Handling Service
 *
 * Centralized error handling service that processes errors, logs them,
 * and sends standardized responses to clients.
 */

import { Request, Response } from 'express';
import { AppError, ERROR_SEVERITY } from '../utils/app-error';
import { ErrorFactory, ensureAppError } from '../errors';
import { BaseService } from './base-service';

/**
 * Request with correlation ID
 */
interface CorrelatedRequest extends Request {
  correlationId?: string;
}

/**
 * Error Handling Service
 */
export class ErrorHandlingService extends BaseService {
  private errorCounts = new Map<string, number>();
  private errorThresholds = new Map<string, number>();

  constructor() {
    super('ErrorHandlingService');
    // Set default thresholds
    this.errorThresholds.set('RATE_LIMITED', 100);
    this.errorThresholds.set('SERVICE_UNAVAILABLE', 50);
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('ErrorHandlingService initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('ErrorHandlingService destroyed');
  }

  /**
   * Handle application errors with standardized response format
   */
  handleAppError(
    err: AppError | Error,
    req: Request,
    res: Response,
    context?: Record<string, unknown>,
  ): void {
    const correlatedReq = req as CorrelatedRequest;

    // Convert to AppError if needed
    const appError = ensureAppError(err);

    // Add correlation ID if available
    const enrichedError = appError.correlationId
      ? appError
      : appError.addContext({ correlationId: correlatedReq.correlationId });

    // Log the error
    this.logAppError(enrichedError, context);

    // Track error counts
    this.trackError(enrichedError);

    // Send response to client
    this.sendErrorResponse(res, enrichedError);
  }

  /**
   * Log error with appropriate level based on severity
   */
  private logAppError(appError: AppError, context?: Record<string, unknown>): void {
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
      stack: appError.stack,
      ...context,
    };

    // Log based on severity
    switch (appError.severity) {
      case ERROR_SEVERITY.CRITICAL:
        this.logError(appError.message, appError, logData);
        break;
      case ERROR_SEVERITY.HIGH:
        this.logError(appError.message, appError, logData);
        break;
      case ERROR_SEVERITY.MEDIUM:
        this.logWarn(appError.message, logData);
        break;
      case ERROR_SEVERITY.LOW:
        this.logInfo(appError.message, logData);
        break;
      default:
        this.logError(appError.message, appError, logData);
    }
  }

  /**
   * Track error occurrences
   */
  private trackError(appError: AppError): void {
    const errorType = appError.code;
    const currentCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentCount + 1);

    // Check if error threshold is exceeded
    const threshold = this.errorThresholds.get(appError.code) || 0;
    if (threshold > 0 && currentCount + 1 >= threshold) {
      this.logWarn(`Error threshold exceeded for error type: ${errorType}`, {
        count: currentCount + 1,
        threshold,
        correlationId: appError.correlationId,
        operation: 'error_threshold_exceeded',
      });
    }
  }

  /**
   * Send standardized error response
   */
  private sendErrorResponse(res: Response, appError: AppError): void {
    const errorDetails: Record<string, unknown> = {
      code: appError.code,
      message: appError.userFriendly ? appError.message : 'Internal server error',
      category: appError.category,
      ...(appError.correlationId && { correlationId: appError.correlationId }),
    };

    // Add retry-after header if available
    if (appError.retryable && appError.retryAfter) {
      res.setHeader('Retry-After', appError.retryAfter.toString());
      errorDetails.retryAfter = appError.retryAfter;
    }

    const response: Record<string, unknown> = {
      success: false,
      error: errorDetails,
    };

    // Add rate limit info if applicable
    if (appError.statusCode === 429) {
      res.setHeader('X-RateLimit-Reset', Date.now() + (appError.retryAfter || 60) * 1000);
    }

    // Send response
    res.status(appError.statusCode).json(response);
  }

  /**
   * Handle 404 Not Found errors
   */
  handleNotFound(req: Request, res: Response): void {
    const notFoundError = ErrorFactory.api.notFound(`Route ${req.path}`);
    this.handleAppError(notFoundError, req, res);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Reset error counts
   */
  resetErrorCounts(): void {
    this.errorCounts.clear();
  }

  /**
   * Set error threshold
   */
  setErrorThreshold(errorCode: string, threshold: number): void {
    this.errorThresholds.set(errorCode, threshold);
  }
}
