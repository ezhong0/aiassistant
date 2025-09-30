import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { DatabaseService } from '../../services/database.service';
import { CacheService } from '../../services/cache.service';
import { EncryptionService } from '../../services/encryption.service';
import { SentryService } from '../../services/sentry.service';
import { ErrorHandlingService } from '../../services/error-handling.service';

/**
 * Register core infrastructure services
 * 
 * These are foundational services with minimal dependencies
 * that other services depend on.
 */
export function registerCoreServices(container: AppContainer): void {
  container.register({
    // Database service - persistent storage (requires config)
    databaseService: asClass(DatabaseService)
      .singleton()
      .inject(() => ({ appConfig: container.resolve('config') })),

    // Cache service - Redis-based caching (requires config)
    cacheService: asClass(CacheService)
      .singleton()
      .inject(() => ({ appConfig: container.resolve('config') })),

    // Sentry service - error tracking
    sentryService: asClass(SentryService)
      .singleton()
      .inject(() => ({ appConfig: container.resolve('config') })),
      
    
    // Error handling service - centralized error handling
    errorHandlingService: asClass(ErrorHandlingService)
      .singleton()
      .inject(() => ({
        logger: container.resolve('logger'),
        sentryService: container.resolve('sentryService'),
        config: container.resolve('config')
      })),
  });
}
