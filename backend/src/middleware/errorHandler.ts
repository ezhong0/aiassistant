import { Request, Response, NextFunction } from 'express';
import { BaseError, ErrorSeverity, ErrorCategory, ERROR_MESSAGES } from '../errors/error-types';
import { errorManager } from '../errors/error-manager.service';
import { CorrelatedRequest, addCorrelationContext } from './error-correlation.middleware';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError | BaseError | Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  const correlatedReq = req as CorrelatedRequest;
  let processedError: BaseError;

  // Convert to structured error if needed
  if (err instanceof BaseError) {
    processedError = err;
  } else {
    // Handle legacy AppError or regular Error
    processedError = errorManager.handleCentralizedError(err, {
      correlationId: correlatedReq.correlationId,
      userId: correlatedReq.userId,
      metadata: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: (err as AppError).statusCode || 500
      }
    });
  }

  // Add correlation context if not already present
  if (correlatedReq.correlationId && !processedError.correlationId) {
    addCorrelationContext(processedError, correlatedReq.correlationId, {
      endpoint: `${req.method} ${req.url}`,
      userId: correlatedReq.userId,
      requestDuration: Date.now() - (correlatedReq.startTime || Date.now())
    });
  }

  // Determine HTTP status code based on error type and severity
  const statusCode = getHttpStatusCode(processedError);

  // Get user-friendly message
  const responseMessage = getUserFriendlyMessage(processedError);

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: {
      code: processedError.code,
      message: responseMessage,
      severity: processedError.severity,
      ...(correlatedReq.correlationId && { correlationId: correlatedReq.correlationId })
    },
    timestamp: new Date().toISOString()
  };

  // Add debug information in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.debug = {
      originalMessage: processedError.message,
      stack: processedError.stack,
      category: processedError.category,
      retryable: processedError.retryable,
      details: processedError.details
    };
  }

  // Add recovery suggestions for certain error types
  if (processedError.retryable) {
    errorResponse.error.retryable = true;
    errorResponse.error.retryAfter = getRetryAfterSeconds(processedError);
  }

  // Set appropriate headers
  res.setHeader('Content-Type', 'application/json');
  if (processedError.retryable) {
    res.setHeader('Retry-After', getRetryAfterSeconds(processedError).toString());
  }

  res.status(statusCode).json(errorResponse);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  logger.warn('Route not found', {
    correlationId: `not-found-${Date.now()}`,
    operation: 'route_not_found',
    metadata: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
    },
    timestamp: new Date().toISOString(),
  });
};

export const createError = (message: string, statusCode = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

/**
 * Enhanced error handler utility functions
 */

/**
 * Map error types to HTTP status codes
 */
function getHttpStatusCode(error: BaseError): number {
  // Check for existing status code
  if ((error as any).statusCode) {
    return (error as any).statusCode;
  }

  // Map by error code
  switch (error.code) {
    case 'AUTHENTICATION_FAILED':
    case 'TOKEN_EXPIRED':
      return 401;

    case 'AUTHORIZATION_DENIED':
      return 403;

    case 'VALIDATION_FAILED':
    case 'API_VALIDATION_FAILED':
      return 400;

    case 'SERVICE_UNAVAILABLE':
    case 'EXTERNAL_SERVICE_ERROR':
    case 'DATABASE_CONNECTION_FAILED':
      return 503;

    case 'API_RATE_LIMIT_EXCEEDED':
      return 429;

    case 'API_TIMEOUT':
    case 'NETWORK_TIMEOUT':
      return 408;

    case 'CONFIGURATION_ERROR':
      return 500;

    default:
      // Map by category
      switch (error.category) {
        case ErrorCategory.AUTHENTICATION:
          return 401;
        case ErrorCategory.AUTHORIZATION:
          return 403;
        case ErrorCategory.VALIDATION:
          return 400;
        case ErrorCategory.RATE_LIMITING:
          return 429;
        case ErrorCategory.EXTERNAL:
        case ErrorCategory.DATABASE:
          return 503;
        default:
          // Map by severity
          switch (error.severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
              return 500;
            case ErrorSeverity.MEDIUM:
              return 503;
            case ErrorSeverity.LOW:
              return 400;
            default:
              return 500;
          }
      }
  }
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: BaseError): string {
  // Use predefined user-friendly messages
  if (ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES]) {
    return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES];
  }

  // Use error's user-friendly message if available
  if (error.userFriendly) {
    return error.message;
  }

  // Fallback to generic messages based on category
  switch (error.category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Authentication failed. Please check your credentials and try again.';
    case ErrorCategory.AUTHORIZATION:
      return 'Access denied. You do not have permission to perform this action.';
    case ErrorCategory.VALIDATION:
      return 'Invalid request data. Please check your input and try again.';
    case ErrorCategory.RATE_LIMITING:
      return 'Too many requests. Please wait a moment before trying again.';
    case ErrorCategory.EXTERNAL:
      return 'External service is temporarily unavailable. Please try again later.';
    case ErrorCategory.DATABASE:
      return 'Data service is temporarily unavailable. Please try again later.';
    case ErrorCategory.NETWORK:
      return 'Network connection issue. Please check your connection and try again.';
    case ErrorCategory.SERVICE:
      return 'Service is temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
}

/**
 * Get retry-after seconds based on error type
 */
function getRetryAfterSeconds(error: BaseError): number {
  switch (error.code) {
    case 'API_RATE_LIMIT_EXCEEDED':
      return 60; // 1 minute
    case 'SERVICE_UNAVAILABLE':
    case 'EXTERNAL_SERVICE_ERROR':
      return 30; // 30 seconds
    case 'DATABASE_CONNECTION_FAILED':
      return 120; // 2 minutes
    case 'NETWORK_TIMEOUT':
    case 'API_TIMEOUT':
      return 15; // 15 seconds
    default:
      return 30; // Default 30 seconds
  }
}

/**
 * Enhanced not found handler with correlation support
 */
export const enhancedNotFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  const correlatedReq = req as CorrelatedRequest;

  logger.warn('Route not found', {
    correlationId: correlatedReq.correlationId || `not-found-${Date.now()}`,
    userId: correlatedReq.userId,
    sessionId: correlatedReq.sessionId,
    operation: 'route_not_found',
    metadata: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested resource was not found.',
      severity: ErrorSeverity.LOW,
      ...(correlatedReq.correlationId && { correlationId: correlatedReq.correlationId })
    },
    timestamp: new Date().toISOString()
  });
};
