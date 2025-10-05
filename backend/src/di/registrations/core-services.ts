import { asClass, asFunction } from 'awilix';
import { AppContainer } from '../container';
import { CacheService } from '../../services/cache.service';
import { EncryptionService } from '../../services/encryption.service';
import { SentryService } from '../../services/sentry.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { APIClientFactory } from '../../services/api/api-client-factory';
import { registerAllAPIClients } from '../../services/api/api-client-registry';
import { GoogleAPIClient } from '../../services/api/clients/google-api-client';
import { OpenAIClient } from '../../services/api/clients/openai-api-client';
import { UserContextService } from '../../services/user-context.service';
import { UserPreferencesService } from '../../services/user-preferences.service';

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
    // Cache service - Redis-based caching (auto-resolves 'config' parameter)
    cacheService: asClass(CacheService).singleton(),

    // Encryption service - data encryption/decryption
    encryptionService: asClass(EncryptionService).singleton(),

    // Sentry service - error tracking (no constructor parameters)
    sentryService: asClass(SentryService).singleton(),

    // Error handling service - centralized error handling (no constructor parameters)
    errorHandlingService: asClass(ErrorHandlingService).singleton(),

    // Feature Flags service - feature toggles and gradual rollouts
    featureFlagsService: asClass(FeatureFlagsService).singleton(),

    // API Client Factory - manages all third-party API clients
    apiClientFactory: asClass(APIClientFactory).singleton(),

    // Google API Client - for Gmail, Calendar, Contacts
    googleAPIClient: asFunction(({ apiClientFactory }) => {
      // Register all clients on first access
      registerAllAPIClients(apiClientFactory);
      return apiClientFactory.getClient('google');
    }).singleton() as any,

    // OpenAI API Client - for AI operations
    openAIClient: asFunction(({ apiClientFactory }) => {
      // Clients are already registered by googleAPIClient initialization
      return apiClientFactory.getClient('openai');
    }).singleton() as any,

    // User Context Service - manages user context and preferences
    userContextService: asFunction(({ cacheService, supabaseUrl, supabaseServiceRoleKey }) => {
      return new UserContextService(cacheService, supabaseUrl, supabaseServiceRoleKey);
    }).singleton(),

    // User Preferences Service - manages user preferences
    userPreferencesService: asFunction(({ cacheService, supabaseUrl, supabaseServiceRoleKey }) => {
      return new UserPreferencesService(cacheService, supabaseUrl, supabaseServiceRoleKey);
    }).singleton(),
  });
}
