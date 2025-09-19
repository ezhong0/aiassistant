import { IService, ServiceState } from './service-manager';
import { OpenAIService } from './openai.service';

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
export class AIServiceCircuitBreaker implements IService {
  public readonly name = 'aiCircuitBreakerService';
  private _state: ServiceState = ServiceState.INITIALIZING;
  
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  
  private config: CircuitBreakerConfig = {
    failureThreshold: 5,      // Open circuit after 5 consecutive failures
    recoveryTimeout: 60000,   // Try recovery after 60 seconds
    successThreshold: 3,      // Close circuit after 3 consecutive successes
    timeout: 30000           // Timeout for individual requests
  };

  private openaiService: OpenAIService | null = null;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  get state(): ServiceState {
    return this._state;
  }

  async initialize(): Promise<void> {
    try {
      this._state = ServiceState.INITIALIZING;
      
      // Circuit breaker doesn't need external dependencies to initialize
      // It will get the OpenAI service reference when needed
      
      this._state = ServiceState.READY;
      
    } catch (error) {
      this._state = ServiceState.ERROR;
      
      throw error;
    }
  }

  isReady(): boolean {
    return this._state === ServiceState.READY;
  }

  async destroy(): Promise<void> {
    this._state = ServiceState.SHUTTING_DOWN;
    
    // Reset circuit state
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.openaiService = null;
    
    this._state = ServiceState.DESTROYED;
    
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this._state === ServiceState.READY && this.circuitState !== CircuitState.OPEN,
      details: {
        state: this._state,
        circuitState: this.circuitState,
        metrics: this.getMetrics()
      }
    };
  }

  /**
   * Set OpenAI service reference (called after service initialization)
   */
  setOpenAIService(openaiService: OpenAIService): void {
    this.openaiService = openaiService;
  }

  /**
   * Execute OpenAI operation with circuit breaker protection
   */
  async execute<T>(operation: (openai: OpenAIService) => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.circuitState === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.recoveryTimeout) {
        throw new AIServiceUnavailableError(
          '🤖 AI service is temporarily unavailable. Please try again in a few moments.',
          'CIRCUIT_OPEN'
        );
      } else {
        // Move to half-open state
        this.circuitState = CircuitState.HALF_OPEN;
        this.successCount = 0;
        
      }
    }

    if (!this.openaiService || !this.openaiService.isReady()) {
      this.recordFailure();
      throw new AIServiceUnavailableError(
        '🤖 AI service is not available. Please check your configuration.',
        'SERVICE_NOT_READY'
      );
    }

    try {
      // Execute with timeout
      const result = await this.withTimeout(
        operation(this.openaiService),
        this.config.timeout
      );

      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      
      if (error instanceof AIServiceUnavailableError) {
        throw error;
      }
      
      // Convert other errors to user-friendly messages
      throw new AIServiceUnavailableError(
        '🤖 I\'m having trouble processing your request right now. Please try again.',
        'AI_SERVICE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
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
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new AIServiceUnavailableError(
          '🤖 Request timed out. Please try again.',
          'TIMEOUT'
        ));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
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
      totalFailures: this.totalFailures
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

/**
 * Custom error for AI service unavailability
 */
export class AIServiceUnavailableError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIServiceUnavailableError';
    
    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIServiceUnavailableError);
    }
  }
}