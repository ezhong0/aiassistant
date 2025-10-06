import { IncomingHttpHeaders } from 'http';

/**
 * Log context interface for structured logging
 */
export interface LogContext extends Record<string, unknown> {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Utility to extract correlation ID from request
 */
export function getCorrelationId(req: { correlationId?: string; headers?: IncomingHttpHeaders }): string {
  const headerValue = req.headers?.['x-correlation-id'];
  return req.correlationId || (typeof headerValue === 'string' ? headerValue : 'unknown') || 'unknown';
}

/**
 * Utility to create log context from request
 */
export function createLogContext(req: { correlationId?: string; headers?: IncomingHttpHeaders; user?: any; sessionId?: string; id?: string; requestId?: string }, additionalContext: Partial<LogContext> = {}): LogContext {
  const userIdHeader = req.headers?.['x-user-id'];
  const sessionIdHeader = req.headers?.['x-session-id'];

  // Extract request ID from middleware (req.id or req.requestId) or header
  const anyReq = req as any;
  const requestId = anyReq.id || anyReq.requestId || req.headers?.['x-request-id'];

  return {
    correlationId: getCorrelationId(req),
    userId: req.user?.userId || (typeof userIdHeader === 'string' ? userIdHeader : undefined),
    sessionId: req.sessionId || (typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined),
    ...additionalContext,
    metadata: {
      requestId: typeof requestId === 'string' ? requestId : undefined, // ✅ Include request ID
      ...(additionalContext.metadata || {}),
    },
  };
}
