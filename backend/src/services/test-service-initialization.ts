/**
 * Test Service Initialization
 * Initializes services with mocks for E2E testing
 */

import { serviceManager } from './service-manager';
import { MockCacheService } from './mocks/mock-cache.service';
import { MockDatabaseService } from './mocks/mock-database.service';
import { MockContextManagerService } from './mocks/mock-context-manager.service';
import { OAuthStateService } from './oauth-state.service';
import { TokenStorageService } from './token-storage.service';
import { AuthStatusService } from './auth-status.service';
import { AuthService } from './auth.service';
import { TokenManager } from './token-manager';
import { GenericAIService } from './generic-ai.service';
import { EncryptionService } from './encryption.service';
import { SentryService } from './sentry.service';
// Use real domain services, not mocks
import logger from '../utils/logger';

/**
 * Initialize all core services for E2E testing
 * Uses real AI services with mocked external dependencies
 */
export const initializeTestServices = async (): Promise<void> => {
  try {
    logger.info('Initializing E2E test services with real AI and mocked external APIs', {
      operation: 'test_service_initialization',
      metadata: { phase: 'initialization' }
    });

    // Initialize real domain services for E2E testing
    const { DomainServiceRegistrations, DomainServiceResolver } = await import('./domain/dependency-injection/domain-service-container');
    DomainServiceRegistrations.registerForTesting();

    // Pre-initialize domain services by calling their factories
    // This ensures they exist before GenericAIService tries to access them
    logger.info('Pre-initializing domain services for E2E testing', {
      operation: 'test_service_initialization',
      metadata: { phase: 'domain_service_pre_init' }
    });

    try {
      const aiDomainService = DomainServiceResolver.getAIService();
      await aiDomainService.initialize();
      logger.info('AI Domain Service pre-initialized successfully', {
        operation: 'test_service_initialization'
      });
    } catch (error) {
      logger.error('Failed to pre-initialize AI Domain Service', error as Error, {
        operation: 'test_service_initialization'
      });
      throw error;
    }

    // Register core services with mocks
    await registerTestServices();

    // Initialize all services
    await serviceManager.initializeAllServices();

    logger.info('E2E test services initialized successfully with real AI', {
      operation: 'test_service_initialization',
      metadata: { phase: 'complete' }
    });
  } catch (error) {
    logger.error('Failed to initialize test services', error as Error, {
      operation: 'test_service_initialization',
      metadata: { phase: 'initialization' }
    });
    throw error;
  }
};

/**
 * Register core services with their dependencies for testing
 */
const registerTestServices = async (): Promise<void> => {
  try {
    // 1. Mock Database Service - No dependencies, high priority
    const mockDatabaseService = new MockDatabaseService();
    serviceManager.registerService('databaseService', mockDatabaseService, []);

    // 2. EncryptionService - No dependencies, high priority
    const encryptionService = new EncryptionService();
    serviceManager.registerService('encryptionService', encryptionService, []);

    // 3. SentryService - No dependencies, high priority (error tracking)
    const sentryService = new SentryService();
    serviceManager.registerService('sentryService', sentryService, []);

    // 4. Mock Cache Service - No dependencies, high priority
    const mockCacheService = new MockCacheService();
    serviceManager.registerService('cacheService', mockCacheService, []);

    // 3. OAuthStateService - depends on cacheService
    const oauthStateService = new OAuthStateService();
    serviceManager.registerService('oauthStateService', oauthStateService, ['cacheService']);

    // 5. TokenStorageService - Depends on databaseService and encryptionService
    const tokenStorageService = new TokenStorageService();
    serviceManager.registerService('tokenStorageService', tokenStorageService, ['databaseService', 'encryptionService']);

    // 6. AuthStatusService - Depends on tokenStorageService
    const authStatusService = new AuthStatusService();
    serviceManager.registerService('authStatusService', authStatusService, ['tokenStorageService']);

    // 7. AuthService - No external dependencies
    const authService = new AuthService();
    serviceManager.registerService('authService', authService, []);

    // 8. TokenManager - Depends on tokenStorageService and authService
    const tokenManager = new TokenManager();
    serviceManager.registerService('tokenManager', tokenManager, ['tokenStorageService', 'authService']);

    // 9. Mock Context Manager Service - No dependencies
    const mockContextManagerService = new MockContextManagerService();
    serviceManager.registerService('contextManager', mockContextManagerService, []);

    // 10. GenericAIService - Centralized AI operations with structured output (REAL AI)
    // Note: GenericAIService uses DomainServiceResolver.getAIService() which requires
    // domain services to be registered BEFORE initialization (not before registration)
    const genericAIService = new GenericAIService();
    serviceManager.registerService('genericAIService', genericAIService, []);

    logger.info('Test services registered successfully', {
      operation: 'test_service_registration'
    });
  } catch (error) {
    logger.error('Failed to register test services', error as Error, {
      operation: 'test_service_registration'
    });
    throw error;
  }
};

/**
 * Cleanup test services
 */
export const cleanupTestServices = async (): Promise<void> => {
  try {
    logger.info('Cleaning up test services', {
      operation: 'test_service_cleanup'
    });

    await serviceManager.forceCleanup();
    
    logger.info('Test services cleaned up successfully', {
      operation: 'test_service_cleanup'
    });
  } catch (error) {
    logger.error('Failed to cleanup test services', error as Error, {
      operation: 'test_service_cleanup'
    });
    throw error;
  }
};
