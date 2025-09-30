import { asValue, createContainer, AwilixContainer } from 'awilix';
import { unifiedConfig } from '../config/unified-config';
import logger from '../utils/logger';

/**
 * Application Dependency Injection Container
{{ ... }}
 * 
 * Uses awilix for clean constructor-based dependency injection.
 * 
 * Principles:
 * - All dependencies injected via constructor
 * - Explicit lifetime management (singleton/scoped/transient)
 * - Type-safe resolution
 * - No service locator pattern
 * - Easy testing with container scopes
 * 
 * @example
 * ```typescript
 * const container = createAppContainer();
 * const emailService = container.resolve('emailDomainService');
 * ```
 */

export interface Cradle {
  // Configuration
  config: typeof unifiedConfig;

  // Core Infrastructure Services
  databaseService: any;
  cacheService: any;
  encryptionService: any;
  sentryService: any;

  // Auth Services
  authService: any;
  tokenStorageService: any;
  tokenManager: any;
  authStatusService: any;
  oauthStateService: any;

  // OAuth Managers
  googleOAuthManager: any;
  slackOAuthManager: any;

  // Domain Services
  emailDomainService: any;
  calendarDomainService: any;
  contactsDomainService: any;
  slackDomainService: any;
  aiDomainService: any;

  // AI Services
  genericAIService: any;
  aiCircuitBreakerService: any;

  // Context & Workflow
  contextManager: any;

  // Prompt Builders (will be added as needed)
  environmentCheckBuilder: any;
  actionExecutionBuilder: any;
  progressAssessmentBuilder: any;
}

export type AppContainer = AwilixContainer<Cradle>;

/**
 * Create and configure the application DI container
 */
export function createAppContainer(): AppContainer {
  const container = createContainer<Cradle>({
    injectionMode: 'CONSTRUCTOR' as any,
    strict: true // Fail fast on missing dependencies
  });

  // Register configuration as singleton value
  container.register({
    config: asValue(unifiedConfig)
  });

  logger.info('DI Container created', {
    correlationId: `di-container-${Date.now()}`,
    operation: 'container_creation',
    metadata: { mode: 'constructor_injection', strict: true }
  });

  return container;
}

/**
 * Initialize all services that extend BaseService
 * Services are initialized in dependency order automatically by awilix
 */
export async function initializeAllServices(container: AppContainer): Promise<void> {
  logger.info('Starting service initialization', {
    correlationId: `service-init-${Date.now()}`,
    operation: 'service_initialization_start'
  });

  const cradle = container.cradle;
  const services: any[] = [];

  // Collect all services that have an initialize method
  for (const [name, service] of Object.entries(cradle)) {
    if (service && typeof service.initialize === 'function') {
      services.push({ name, service });
    }
  }

  logger.debug('Initializing services', {
    correlationId: `service-init-${Date.now()}`,
    operation: 'service_initialization',
    metadata: { serviceCount: services.length }
  });

  // Initialize each service
  for (const { name, service } of services) {
    try {
      await service.initialize();
      logger.debug(`Service initialized: ${name}`, {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialized',
        metadata: { serviceName: name }
      });
    } catch (error) {
      logger.error(`Failed to initialize service: ${name}`, error as Error, {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization_error',
        metadata: { serviceName: name }
      });
      throw error;
    }
  }

  logger.info('All services initialized successfully', {
    correlationId: `service-init-${Date.now()}`,
    operation: 'service_initialization_complete',
    metadata: { initializedServices: services.length }
  });
}

/**
 * Create a test container with optional overrides
 * Perfect for unit testing with mocked dependencies
 */
export function createTestContainer(overrides: Partial<Record<keyof Cradle, any>> = {}): AppContainer {
  const container = createAppContainer();

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    container.register({
      [key]: asValue(value)
    });
  }

  return container;
}

/**
 * Gracefully shutdown all services
 */
export async function shutdownAllServices(container: AppContainer): Promise<void> {
  logger.info('Starting graceful shutdown', {
    correlationId: `shutdown-${Date.now()}`,
    operation: 'shutdown_start'
  });

  const cradle = container.cradle;
  const services: any[] = [];

  // Collect all services that have a destroy method
  for (const [name, service] of Object.entries(cradle)) {
    if (service && typeof service.destroy === 'function') {
      services.push({ name, service });
    }
  }

  // Shutdown in reverse order
  services.reverse();

  for (const { name, service } of services) {
    try {
      await service.destroy();
      logger.debug(`Service destroyed: ${name}`, {
        correlationId: `shutdown-${Date.now()}`,
        operation: 'service_destroyed',
        metadata: { serviceName: name }
      });
    } catch (error) {
      logger.error(`Error destroying service: ${name}`, error as Error, {
        correlationId: `shutdown-${Date.now()}`,
        operation: 'service_destruction_error',
        metadata: { serviceName: name }
      });
    }
  }

  logger.info('Graceful shutdown completed', {
    correlationId: `shutdown-${Date.now()}`,
    operation: 'shutdown_complete'
  });
}
