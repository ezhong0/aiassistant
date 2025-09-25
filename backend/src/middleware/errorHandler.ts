import { Request, Response, NextFunction } from 'express';
import { errorHandlingService } from '../services/error-handling.service';

/**
 * Centralized error handler middleware using ErrorHandlingService
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Use the centralized error handling service
  errorHandlingService.handleError(err, req, res);
};

/**
 * 404 handler for unmatched routes using ErrorHandlingService
 */
export const notFoundHandler = (req: Request, res: Response) => {
  errorHandlingService.handleNotFound(req, res);
};