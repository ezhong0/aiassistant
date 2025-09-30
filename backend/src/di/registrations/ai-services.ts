import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { GenericAIService } from '../../services/generic-ai.service';
import { AIServiceCircuitBreaker } from '../../services/ai-circuit-breaker.service';

/**
 * Register AI and machine learning services
 * 
 * These services handle AI/ML operations including OpenAI integration,
 * circuit breakers for AI service failures, and AI-related utilities.
 */
export function registerAIServices(container: AppContainer): void {
  container.register({
    // Generic AI service (OpenAI wrapper)
    genericAIService: asClass(GenericAIService).singleton(),
    
    // Alias for genericAIService to support 'aiService' parameter name in constructors
    // This allows services to inject via either 'genericAIService' or 'aiService'
    aiService: asClass(GenericAIService).singleton(),

    // AI Circuit breaker service
    aiCircuitBreakerService: asClass(AIServiceCircuitBreaker).singleton(),
  });
}
