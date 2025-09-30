import { Request, Response, NextFunction } from 'express';
import { serviceManager } from '../services/service-locator-compat';
import { SentryService } from '../services/sentry.service';
import logger from '../utils/logger';

/**
 * Sentry middleware for error tracking and performance monitoring
 */
export const sentryMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const sentryService = serviceManager.getService<SentryService>('sentryService');
    
    if (!sentryService || !sentryService.isReady()) {
      next();
      return;
    }

    // Add request breadcrumb
    sentryService.addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.path}`,
      level: 'info',
      data: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });

    // Set request context
    sentryService.setTags({
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent') || 'unknown'
    });

    // Set user context if available
    if ((req as any).user) {
      sentryService.setUser({
        id: (req as any).user.userId,
        email: (req as any).user.email,
        username: (req as any).user.email
      });
    }

    // Start transaction for performance monitoring
    const transaction = sentryService.startTransaction(`${req.method} ${req.path}`, 'http.server');
    
    if (transaction) {
      // Add transaction to request for cleanup
      (req as any).sentryTransaction = transaction;
    }

    // Handle response completion
    res.on('finish', () => {
      try {
        if (transaction) {
          transaction.setStatus(res.statusCode >= 400 ? 'internal_error' : 'ok');
          transaction.finish();
        }

        // Add response breadcrumb
        sentryService.addBreadcrumb({
          category: 'http',
          message: `Response ${res.statusCode}`,
          level: res.statusCode >= 400 ? 'error' : 'info',
          data: {
            statusCode: res.statusCode,
            contentLength: res.get('Content-Length')
          }
        });
      } catch (error) {
        logger.error('Sentry middleware response handler error', error as Error, {
          correlationId: `sentry-middleware-${Date.now()}`,
          operation: 'sentry_response_handler'
        });
      }
    });

    next();
  } catch (error) {
    logger.error('Sentry middleware error', error as Error, {
      correlationId: `sentry-middleware-${Date.now()}`,
      operation: 'sentry_middleware_error'
    });
    // Don't block the request on Sentry errors
    next();
  }
};

/**
 * Error handler middleware for Sentry
 */
export const sentryErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  try {
    const sentryService = serviceManager.getService<SentryService>('sentryService');
    
    if (sentryService && sentryService.isReady()) {
      // Capture the error
      sentryService.captureException(error, {
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body,
          query: req.query,
          params: req.params
        },
        user: (req as any).user ? {
          id: (req as any).user.userId,
          email: (req as any).user.email
        } : undefined
      });

      // Add error breadcrumb
      sentryService.addBreadcrumb({
        category: 'error',
        message: error.message,
        level: 'error',
        data: {
          name: error.name,
          stack: error.stack
        }
      });
    }
  } catch (sentryError) {
    logger.error('Sentry error handler failed', sentryError as Error, {
      correlationId: `sentry-error-handler-${Date.now()}`,
      operation: 'sentry_error_handler'
    });
  }

  // Continue with normal error handling
  next(error);
};
