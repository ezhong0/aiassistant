import { asValue, createContainer, AwilixContainer, InjectionMode } from 'awilix';
import { unifiedConfig } from '../config/unified-config';
import logger from '../utils/logger';
import { ErrorFactory } from '../errors/error-factory';

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
  // Configuration and logging
  config: typeof unifiedConfig;
  logger: typeof logger;

  // Core Infrastructure Services
  cacheService: import('../services/cache.service').CacheService;
  encryptionService: import('../services/encryption.service').EncryptionService;
  sentryService: import('../services/sentry.service').SentryService;
  errorHandlingService: import('../services/error-handling.service').ErrorHandlingService;
  featureFlagsService: import('../services/feature-flags.service').FeatureFlagsService;

  // API Client Services
  apiClientFactory: import('../services/api/api-client-factory').APIClientFactory;
  googleAPIClient: import('../services/api/clients/google-api-client').GoogleAPIClient;
  openAIClient: import('../services/api/clients/openai-api-client').OpenAIClient;

  // Framework Services
  toolRegistry: import('../framework/tool-registry').ToolRegistry;
  operationExecutor: import('../services/domain/strategies/operation-executor').OperationExecutor;

  // Auth Services (Supabase handles OAuth)
  supabaseTokenProvider: import('../services/supabase-token-provider').SupabaseTokenProvider;

  // Middleware
  errorHandler: import('../middleware/errorHandler').ErrorHandlerMiddleware;
  notFoundHandler: import('../middleware/errorHandler').NotFoundHandlerMiddleware;

  // Domain Services
  emailDomainService: import('../services/domain/email-domain.service').EmailDomainService;
  calendarDomainService: import('../services/domain/calendar-domain.service').CalendarDomainService;
  contactsDomainService: import('../services/domain/contacts-domain.service').ContactsDomainService;
  aiDomainService: import('../services/domain/ai-domain.service').AIDomainService;

  // Aliases for strategy injection (strategies use shorter names)
  emailService: import('../services/domain/email-domain.service').EmailDomainService;
  calendarService: import('../services/domain/calendar-domain.service').CalendarDomainService;
  contactsService: import('../services/domain/contacts-domain.service').ContactsDomainService;

  // AI Services
  aiService: import('../services/domain/ai-domain.service').AIDomainService; // Alias for aiDomainService
  aiCircuitBreakerService: import('../services/ai-circuit-breaker.service').AIServiceCircuitBreaker;

  // Middleware Services
  rateLimitStore: import('../middleware/rate-limiting.middleware').RateLimitStore;

  // 3-Layer Architecture Services
  strategyRegistry: import('../layers/layer2-execution/strategy-registry').StrategyRegistry;
  decompositionPromptBuilder: import('../layers/layer1-decomposition/decomposition-prompt-builder').DecompositionPromptBuilder;
  executionGraphValidator: import('../layers/layer1-decomposition/execution-graph-validator').ExecutionGraphValidator;
  queryDecomposer: import('../layers/layer1-decomposition/query-decomposer.service').QueryDecomposerService;
  executionCoordinator: import('../layers/layer2-execution/execution-coordinator.service').ExecutionCoordinatorService;
  synthesisService: import('../layers/layer3-synthesis/synthesis.service').SynthesisService;
  orchestrator: import('../layers/orchestrator.service').OrchestratorService;

  // Phase 2: Strategy Executors
  metadataFilterStrategy: import('../layers/layer2-execution/strategies/metadata-filter-strategy').MetadataFilterStrategy;
  keywordSearchStrategy: import('../layers/layer2-execution/strategies/keyword-search-strategy').KeywordSearchStrategy;
  batchThreadReadStrategy: import('../layers/layer2-execution/strategies/batch-thread-read-strategy').BatchThreadReadStrategy;
  crossReferenceStrategy: import('../layers/layer2-execution/strategies/cross-reference-strategy').CrossReferenceStrategy;
  semanticAnalysisStrategy: import('../layers/layer2-execution/strategies/semantic-analysis-strategy').SemanticAnalysisStrategy;
}

export type AppContainer = AwilixContainer<Cradle>;

/**
 * Create and configure the application DI container
 */
export function createAppContainer(): AppContainer {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC,
    strict: true, // Fail fast on missing dependencies
  });

  // Register configuration and logger as singleton values
  container.register({
    config: asValue(unifiedConfig),
    logger: asValue(logger),
  });

  logger.info('DI Container created', {
    correlationId: `di-container-${Date.now()}`,
    operation: 'container_creation',
    metadata: { mode: 'constructor_injection', strict: true },
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
    operation: 'service_initialization_start',
  });

  const cradle = container.cradle;
  const services: Array<{ name: string; service: { initialize(): Promise<void> } }> = [];

  // Collect all services that have an initialize method
  for (const [name, service] of Object.entries(cradle)) {
    if (service && typeof service.initialize === 'function') {
      services.push({ name, service });
    }
  }

  logger.debug('Initializing services', {
    correlationId: `service-init-${Date.now()}`,
    operation: 'service_initialization',
    metadata: { serviceCount: services.length },
  });

  // Initialize each service
  for (const { name, service } of services) {
    try {
      await service.initialize();
      logger.debug(`Service initialized: ${name}`, {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialized',
        metadata: { serviceName: name },
      });
    } catch (error) {
      logger.error(`Failed to initialize service: ${name}`, error as Error, {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization_error',
        metadata: { serviceName: name },
      });
      throw error;
    }
  }

  logger.info('All services initialized successfully', {
    correlationId: `service-init-${Date.now()}`,
    operation: 'service_initialization_complete',
    metadata: { initializedServices: services.length },
  });
}

/**
 * Create a test container with optional overrides
 * Perfect for unit testing with mocked dependencies
 */
export function createTestContainer(overrides: Partial<Record<keyof Cradle, unknown>> = {}): AppContainer {
  const container = createAppContainer();

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    container.register({
      [key]: asValue(value),
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
    operation: 'shutdown_start',
  });

  const cradle = container.cradle;
  const services: Array<{ name: string; service: { destroy(): Promise<void> } }> = [];

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
        metadata: { serviceName: name },
      });
    } catch (error) {
      logger.error(`Error destroying service: ${name}`, error as Error, {
        correlationId: `shutdown-${Date.now()}`,
        operation: 'service_destruction_error',
        metadata: { serviceName: name },
      });
    }
  }

  logger.info('Graceful shutdown completed', {
    correlationId: `shutdown-${Date.now()}`,
    operation: 'shutdown_complete',
  });
}

/**
 * Validate that all services can be resolved from the container
 * Catches circular dependencies and missing registrations early
 */
export function validateContainer(container: AppContainer): void {
  logger.info('Starting container validation', {
    correlationId: `container-validation-${Date.now()}`,
    operation: 'container_validation_start',
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  const registrationNames = Object.keys(container.registrations);

  for (const serviceName of registrationNames) {
    try {
      // Try to resolve the service
      container.resolve(serviceName as keyof Cradle);
      logger.debug(`Service validated: ${serviceName}`, {
        correlationId: `container-validation-${Date.now()}`,
        operation: 'service_validation_success',
        metadata: { serviceName },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to resolve '${serviceName}': ${errorMessage}`);
      logger.error(`Service validation failed: ${serviceName}`, error as Error, {
        correlationId: `container-validation-${Date.now()}`,
        operation: 'service_validation_error',
        metadata: { serviceName },
      });
    }
  }

  if (errors.length > 0) {
    const errorSummary = `Container validation failed with ${errors.length} error(s):\n${errors.join('\n')}`;
    logger.error('Container validation failed', new Error(errorSummary), {
      correlationId: `container-validation-${Date.now()}`,
      operation: 'container_validation_failed',
      metadata: { errorCount: errors.length, errors },
    });
    throw ErrorFactory.domain.serviceError('AppContainer', errorSummary);
  }

  if (warnings.length > 0) {
    logger.warn('Container validation completed with warnings', {
      correlationId: `container-validation-${Date.now()}`,
      operation: 'container_validation_warnings',
      metadata: { warningCount: warnings.length, warnings },
    });
  }

  logger.info('Container validation completed successfully', {
    correlationId: `container-validation-${Date.now()}`,
    operation: 'container_validation_complete',
    metadata: { servicesValidated: registrationNames.length },
  });
}
