// Circuit breaker for AI services
// Uses BaseService for service lifecycle management
import { BaseService } from './base-service';
import { ErrorFactory } from '../errors';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  successThreshold: number;
  timeout: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
}

/**
 * Circuit breaker service for OpenAI API calls
 * Protects against cascading failures when AI service is unavailable
 */
export class AIServiceCircuitBreaker extends BaseService {
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  
  private config: CircuitBreakerConfig;
  private aiService: any | null = null;

  constructor() {
    super('AIServiceCircuitBreaker');
    
    // Use environment variables for configuration
    const e2eTesting = process.env.E2E_TESTING === 'true';

    this.config = {
      failureThreshold: e2eTesting ? 10000 : 5,
      recoveryTimeout: e2eTesting ? 5000 : 60000,
      successThreshold: 3,
      timeout: e2eTesting ? 300000 : 30000, // 300s (5 min) for E2E to allow large AI generations
    };
  }

  protected async onInitialize(): Promise<void> {
    // Circuit breaker doesn't need external dependencies to initialize
    this.logInfo('AI Circuit Breaker initialized', {
      config: this.config,
    });
  }

  protected async onDestroy(): Promise<void> {
    // Reset circuit state
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.aiService = null;
    
    this.logInfo('AI Circuit Breaker destroyed');
  }

  /**
   * Set OpenAI service reference (called after service initialization)
   */
  setAIService(aiService: any): void {
    this.aiService = aiService;
  }

  /**
   * Execute OpenAI operation with circuit breaker protection
   */
  async execute<T>(operation: (openai: any) => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.circuitState === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.recoveryTimeout) {
        throw ErrorFactory.domain.serviceUnavailable(
          'ai-service',
          { message: '🤖 AI service is temporarily unavailable. Please try again in a few moments.' },
        );
      } else {
        // Move to half-open state
        this.circuitState = CircuitState.HALF_OPEN;
        this.successCount = 0;
      }
    }

    // For AI operations, check if AI service is available
    // For other operations (like Slack API calls), allow execution without AI service
    const hasAIService = this.aiService?.isReady();

    try {
      // Execute with timeout
      const result = await this.withTimeout(
        operation(hasAIService ? this.aiService : null),
        this.config.timeout,
      );

      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();

      // If already an AppError, just throw it
      if (error instanceof Error && error.name === 'AppError') {
        throw error;
      }

      // Convert other errors to user-friendly messages
      throw ErrorFactory.domain.serviceUnavailable(
        'ai-service',
        { message: '🤖 I\'m having trouble processing your request right now. Please try again.' },
      );
    }
  }

  /**
   * Execute operation without circuit breaker (for testing)
   */
  async executeDirect<T>(operation: (openai: any) => Promise<T>): Promise<T> {
    const hasAIService = this.aiService?.isReady();
    return operation(hasAIService ? this.aiService : null);
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.circuitState === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        
      }
    } else if (this.circuitState === CircuitState.OPEN) {
      // This shouldn't happen, but reset if it does
      this.circuitState = CircuitState.CLOSED;
      this.failureCount = 0;
      
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.circuitState === CircuitState.CLOSED || this.circuitState === CircuitState.HALF_OPEN) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.circuitState = CircuitState.OPEN;
        
      }
    }
  }

  /**
   * Execute operation with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: ReturnType<typeof globalThis.setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = globalThis.setTimeout(() => {
        reject(ErrorFactory.domain.serviceTimeout('ai-service', timeoutMs));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      globalThis.clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      globalThis.clearTimeout(timeoutHandle!);
      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Force circuit state (for testing)
   */
  forceState(state: CircuitState): void {
    this.circuitState = state;
    if (state === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  /**
   * Reset circuit breaker state
   */
  reset(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    
  }
}

// AIServiceUnavailableError removed - now using unified error system