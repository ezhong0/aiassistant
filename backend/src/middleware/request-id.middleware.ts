/**
 * Request ID Middleware
 *
 * Generates or extracts a unique request ID for tracing requests through the system.
 * Attaches the ID to the request object and response headers.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

/**
 * Extended Express Request with request ID
 */
export interface RequestWithId extends Request {
  id: string;
  requestId: string; // Alias for convenience
}

/**
 * Request ID middleware
 *
 * - Extracts X-Request-ID from headers or generates a new UUID
 * - Attaches to req.id and req.requestId
 * - Sets X-Request-ID response header
 * - Logs request start with ID
 *
 * @example
 * ```typescript
 * import { requestIdMiddleware } from './middleware/request-id.middleware';
 *
 * app.use(requestIdMiddleware);
 *
 * // In route handlers:
 * app.get('/api/user', (req: RequestWithId, res) => {
 *   logger.info('Fetching user', {
 *     requestId: req.id,
 *     userId: req.params.id,
 *   });
 * });
 * ```
 */
export const requestIdMiddleware = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void => {
  // Extract from header or generate new UUID
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request
  req.id = requestId;
  req.requestId = requestId; // Alias for convenience

  // Set response header so client can track requests
  res.setHeader('X-Request-ID', requestId);

  // Log request start with ID
  logger.debug('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Call next middleware
  next();
};

/**
 * Get request ID from Express request
 * Safe fallback if requestIdMiddleware wasn't applied
 */
export function getRequestId(req: Request): string {
  const reqWithId = req as RequestWithId;
  return reqWithId.id || reqWithId.requestId || 'unknown-request-id';
}

/**
 * Create correlation ID context for logging
 * Merges request ID with additional context
 */
export function createRequestContext(req: Request, additionalContext?: Record<string, unknown>) {
  return {
    requestId: getRequestId(req),
    correlationId: getRequestId(req),
    method: req.method,
    path: req.path,
    ip: req.ip,
    ...additionalContext,
  };
}
