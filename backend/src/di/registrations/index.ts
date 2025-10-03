import { AppContainer } from '../container';
import { registerCoreServices } from './core-services';
import { registerAuthServices } from './auth-services';
import { registerDomainServices } from './domain-services';
import { registerAIServices } from './ai-services';
import { registerMiddlewareServices } from './middleware-services';
import { registerLayerServices } from './layer-services';
import logger from '../../utils/logger';

/**
 * Register all application services in the DI container
 *
 * Services are registered in dependency order:
 * 1. Core infrastructure (database, cache, encryption)
 * 2. Authentication (OAuth, tokens)
 * 3. Domain services (email, calendar, contacts)
 * 4. AI services (OpenAI, circuit breaker)
 * 5. Layer services (3-layer architecture)
 * 6. Middleware services
 *
 * Awilix automatically resolves dependencies based on constructor parameters.
 */
export function registerAllServices(container: AppContainer): AppContainer {
  logger.info('Registering all services', {
    correlationId: `service-registration-${Date.now()}`,
    operation: 'service_registration_start'
  });

  // Register in order (though awilix handles dependency resolution automatically)
  registerCoreServices(container);
  registerAuthServices(container);
  registerDomainServices(container);
  registerAIServices(container);
  registerLayerServices(container);
  registerMiddlewareServices(container);

  const registeredServices = Object.keys(container.registrations);
  logger.info('All services registered', {
    correlationId: `service-registration-${Date.now()}`,
    operation: 'service_registration_complete',
    metadata: {
      serviceCount: registeredServices.length,
      services: registeredServices
    }
  });

  return container;
}
