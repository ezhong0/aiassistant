import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { AIServiceCircuitBreaker } from '../../services/ai-circuit-breaker.service';

/**
 * Register AI and machine learning services
 *
 * These services handle AI/ML operations including OpenAI integration,
 * circuit breakers for AI service failures, and AI-related utilities.
 */
import { asFunction } from 'awilix';

export function registerAIServices(container: AppContainer): void {
  container.register({
    // Alias 'aiService' to 'aiDomainService' to support both parameter names in constructors
    // This allows services to inject via either 'aiDomainService' or 'aiService'
    // Using asFunction to create an alias that resolves to the same singleton
    // NOTE: aiDomainService is registered in domain-services.ts
    aiService: asFunction(({ aiDomainService }) => aiDomainService).singleton(),

    // AI Circuit breaker service
    aiCircuitBreakerService: asClass(AIServiceCircuitBreaker).singleton(),
  });
}
