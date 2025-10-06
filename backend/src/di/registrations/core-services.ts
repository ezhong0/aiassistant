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

    // Encryption service - data encryption/decryption (inject tokenEncryptionKey)
    encryptionService: asFunction(({ config }) => {
      return new EncryptionService(config.tokenEncryptionKey);
    }).singleton(),

    // Sentry service - error tracking (no constructor parameters)
    sentryService: asClass(SentryService).singleton(),

    // Error handling service - centralized error handling (no constructor parameters)
    errorHandlingService: asClass(ErrorHandlingService).singleton(),

    // Feature Flags service - feature toggles and gradual rollouts
    featureFlagsService: asClass(FeatureFlagsService).singleton(),

    // API Client Factory - manages all third-party API clients
    apiClientFactory: asFunction(() => {
      const factory = new APIClientFactory();
      // Register all API clients immediately
      registerAllAPIClients(factory);
      return factory;
    }).singleton(),

    // Google API Client - for Gmail, Calendar, Contacts
    googleAPIClient: asFunction(() => {
      return new GoogleAPIClient({
        baseUrl: 'https://www.googleapis.com',
        timeout: 45000,
        retry: {
          maxAttempts: 5,
          baseDelay: 1000,
          maxDelay: 15000,
          backoffMultiplier: 2,
          jitter: true,
          strategy: 'EXPONENTIAL_BACKOFF'
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 60000,
          successThreshold: 3,
          timeout: 45000
        },
        defaultHeaders: {
          'Content-Type': 'application/json',
          'User-Agent': 'AssistantApp/1.0'
        }
      });
    }).singleton(),

    // OpenAI API Client - for AI operations
    openAIClient: asFunction(() => {
      const e2eTesting = process.env.E2E_TESTING === 'true';
      const openAITimeout = e2eTesting ? 300000 : 60000;

      return new OpenAIClient({
        baseUrl: 'https://api.openai.com/v1',
        timeout: openAITimeout,
        retry: {
          maxAttempts: 3,
          baseDelay: 2000,
          maxDelay: 20000,
          backoffMultiplier: 2,
          jitter: true,
          strategy: 'EXPONENTIAL_BACKOFF'
        },
        circuitBreaker: {
          failureThreshold: e2eTesting ? 10000 : 3,
          recoveryTimeout: 120000,
          successThreshold: 2,
          timeout: openAITimeout
        },
        rateLimit: {
          maxRequests: 50,
          windowMs: 60000,
          queueRequests: true
        },
        defaultHeaders: {
          'Content-Type': 'application/json',
          'User-Agent': 'AssistantApp/1.0'
        }
      });
    }).singleton(),

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
