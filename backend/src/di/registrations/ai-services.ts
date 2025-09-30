import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { GenericAIService } from '../../services/generic-ai.service';
import { AIServiceCircuitBreaker } from '../../services/ai-circuit-breaker.service';

/**
 * Register AI and machine learning services
 * 
 * These services handle AI operations, including
 * OpenAI integration and circuit breaker patterns.
 */
export function registerAIServices(container: AppContainer): void {
  container.register({
    // Generic AI service for OpenAI operations (requires aiDomainService + config)
    genericAIService: asClass(GenericAIService)
      .singleton()
      .inject(() => ({
        aiDomainService: container.resolve('aiDomainService'),
        config: undefined // Uses DEFAULT_CONFIG
      })),

    // Circuit breaker for AI service reliability (config via environment variables)
    aiCircuitBreakerService: asClass(AIServiceCircuitBreaker).singleton(),
  });
}
