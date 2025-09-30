import { Request, Response, NextFunction } from 'express';
import { ErrorHandlingService } from '../services/error-handling.service';

/**
 * Create error handler middleware using dependency injection
 */
export function createErrorHandler(errorHandlingService: ErrorHandlingService) {
  return (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    // Use the centralized error handling service
    errorHandlingService.handleError(err, req, res);
  };
}

/**
 * Create 404 handler middleware using dependency injection
 */
export function createNotFoundHandler(errorHandlingService: ErrorHandlingService) {
  return (req: Request, res: Response) => {
    errorHandlingService.handleNotFound(req, res);
  };
}

// Type exports for DI container
export type ErrorHandlerMiddleware = ReturnType<typeof createErrorHandler>;
export type NotFoundHandlerMiddleware = ReturnType<typeof createNotFoundHandler>;