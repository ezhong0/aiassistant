import { asClass, asFunction } from 'awilix';
import { AppContainer } from '../container';
import { RateLimitStore } from '../../middleware/rate-limiting.middleware';
import { createErrorHandler, createNotFoundHandler } from '../../middleware/error-handler.middleware';

/**
 * Register middleware-related services
 * 
 * These services support middleware functionality like rate limiting,
 * error handling, and request processing.
 */
export function registerMiddlewareServices(container: AppContainer): void {
  container.register({
    // Rate limit store - manages rate limiting state
    rateLimitStore: asClass(RateLimitStore).singleton(),
    
    // Error handler middleware
    errorHandler: asFunction(({ errorHandlingService }) => 
      createErrorHandler(errorHandlingService)
    ).singleton(),
    
    // 404 Not Found handler middleware
    notFoundHandler: asFunction(({ errorHandlingService }) => 
      createNotFoundHandler(errorHandlingService)
    ).singleton(),
  });
}
