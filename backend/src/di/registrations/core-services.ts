import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { DatabaseService } from '../../services/database.service';
import { CacheService } from '../../services/cache.service';
import { EncryptionService } from '../../services/encryption.service';
import { SentryService } from '../../services/sentry.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { SessionManager } from '../../services/session-manager.service';

/**
 * Register core infrastructure services
 *
 * These are foundational services with minimal dependencies
 * that other services depend on.
 *
 * All services use Awilix auto-resolution based on constructor parameter names.
 */
export function registerCoreServices(container: AppContainer): void {
  container.register({
    // Database service - persistent storage (auto-resolves 'config' parameter)
    databaseService: asClass(DatabaseService).singleton(),

    // Cache service - Redis-based caching (auto-resolves 'config' parameter)
    cacheService: asClass(CacheService).singleton(),

    // Session manager - conversation session management (auto-resolves 'cacheService' parameter)
    sessionManager: asClass(SessionManager).singleton(),

    // Encryption service - data encryption/decryption
    encryptionService: asClass(EncryptionService).singleton(),

    // Sentry service - error tracking (no constructor parameters)
    sentryService: asClass(SentryService).singleton(),

    // Error handling service - centralized error handling (no constructor parameters)
    errorHandlingService: asClass(ErrorHandlingService).singleton(),
  });
}
