/**
 * Log context interface for structured logging
 */
export interface LogContext {
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
export function getCorrelationId(req: any): string {
  return req.correlationId || req.headers['x-correlation-id'] || 'unknown';
}

/**
 * Utility to create log context from request
 */
export function createLogContext(req: any, additionalContext: Partial<LogContext> = {}): LogContext {
  return {
    correlationId: getCorrelationId(req),
    userId: req.user?.userId || req.headers['x-user-id'],
    sessionId: req.sessionId || req.headers['x-session-id'],
    ...additionalContext
  };
}
