import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorFactory, ERROR_CATEGORIES } from '../utils/app-error';
import { CorrelatedRequest } from './error-correlation.middleware';
import logger from '../utils/logger';

/**
 * Simplified error handler for AppError system
 */
export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  const correlatedReq = req as CorrelatedRequest;
  let appError: AppError;

  // Convert to AppError if needed
  if (err instanceof AppError) {
    appError = err.addContext({
      correlationId: correlatedReq.correlationId,
      userId: correlatedReq.userId,
      service: 'error_handler'
    });
  } else {
    // Wrap regular Error as AppError
    appError = ErrorFactory.wrapError(err, ERROR_CATEGORIES.SERVICE, {
      correlationId: correlatedReq.correlationId,
      userId: correlatedReq.userId,
      service: 'error_handler',
      metadata: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  }

  // Log with Winston
  logger.error(appError.message, {
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
  });

  // Send response
  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.userFriendly ? appError.message : 'Internal server error',
      ...(appError.correlationId && { correlationId: appError.correlationId })
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const appError = ErrorFactory.notFound(`Route ${req.method} ${req.path}`);
  
  logger.warn('Route not found', {
    error: appError.code,
    statusCode: appError.statusCode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message
    },
    timestamp: new Date().toISOString()
  });
};