import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { RateLimitStore } from '../../middleware/rate-limiting.middleware';

/**
 * Register middleware-related services
 * 
 * These services support middleware functionality like rate limiting,
 * caching, and request processing.
 */
export function registerMiddlewareServices(container: AppContainer): void {
  container.register({
    // Rate limit store - manages rate limiting state
    rateLimitStore: asClass(RateLimitStore).singleton(),
  });
}
