import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { DatabaseService } from '../../services/database.service';
import { CacheService } from '../../services/cache.service';
import { EncryptionService } from '../../services/encryption.service';
import { SentryService } from '../../services/sentry.service';

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

    // Encryption service - cryptographic operations
    encryptionService: asClass(EncryptionService).singleton(),

    // Sentry service - error tracking
    sentryService: asClass(SentryService).singleton(),
  });
}
