/**
 * Standardized Retry Manager for AI Assistant
 *
 * Provides configurable retry strategies with exponential backoff,
 * circuit breaker integration, and comprehensive error handling.
 */

import { BaseError, ErrorSeverity, ErrorRecoveryStrategy } from './error-types';

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryIf?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
  strategy: RetryStrategy;
}

/**
 * Retry strategies
 */
export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  FIXED_INTERVAL = 'fixed_interval',
  IMMEDIATE = 'immediate',
  CUSTOM = 'custom'
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  recoveryStrategy?: ErrorRecoveryStrategy;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
  minimumThroughput: number;
}

/**
 * Default retry configurations for different scenarios
 */
export const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  database: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    retryIf: (error: Error) => {
      // Retry on connection issues but not on syntax errors
      const message = error.message.toLowerCase();
      return message.includes('connection') ||
             message.includes('timeout') ||
             message.includes('econnrefused');
    }
  },

  externalAPI: {
    maxAttempts: 5,
    baseDelay: 500,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    retryIf: (error: Error) => {
      // Retry on 5xx errors and network issues
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
             message.includes('network') ||
             message.includes('5') || // 5xx status codes
             message.includes('econnrefused') ||
             message.includes('enotfound');
    }
  },

  serviceInitialization: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitter: false,
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    retryIf: (error: Error) => {
      const message = error.message.toLowerCase();
      return message.includes('connection') ||
             message.includes('dependency') ||
             message.includes('unavailable');
    }
  },

  openai: {
    maxAttempts: 4,
    baseDelay: 1000,
    maxDelay: 20000,
    backoffMultiplier: 2,
    jitter: true,
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    retryIf: (error: Error) => {
      const message = error.message.toLowerCase();
      return message.includes('rate limit') ||
             message.includes('timeout') ||
             message.includes('overloaded') ||
             message.includes('5');
    }
  },

  immediate: {
    maxAttempts: 1,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
    strategy: RetryStrategy.IMMEDIATE
  }
};

/**
 * RetryManager class for handling retries with various strategies
 */
export class RetryManager {
  private circuitBreakers = new Map<string, {
    state: CircuitBreakerState;
    failures: number;
    lastFailureTime: number;
    lastAttemptTime: number;
    config: CircuitBreakerConfig;
  }>();

  private defaultConfig: RetryConfig = DEFAULT_RETRY_CONFIGS.externalAPI || {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF
  };

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    context?: { service?: string; operation?: string }
  ): Promise<RetryResult<T>> {
    const retryConfig: RetryConfig = { ...this.defaultConfig, ...(config || {}) };
    const startTime = Date.now();
    let lastError: Error = new Error('Unknown error');
    let attempts = 0;

    // Check circuit breaker if context provided
    if (context?.service) {
      const circuitBreakerKey = `${context.service}:${context.operation || 'default'}`;
      if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
        return {
          success: false,
          error: new Error(`Circuit breaker is open for ${circuitBreakerKey}`),
          attempts: 0,
          totalTime: 0,
          recoveryStrategy: ErrorRecoveryStrategy.CIRCUIT_BREAKER
        };
      }
    }

    for (attempts = 1; attempts <= retryConfig.maxAttempts; attempts++) {
      try {
        const result = await operation();

        // Reset circuit breaker on success
        if (context?.service) {
          this.recordSuccess(context.service, context.operation);
        }

        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failure for circuit breaker
        if (context?.service) {
          this.recordFailure(context.service, context.operation);
        }

        // Log retry attempt
        if (attempts < retryConfig.maxAttempts) {

          // Check if we should retry this error
          if (retryConfig.retryIf && !retryConfig.retryIf(lastError)) {
            break;
          }

          // Call onRetry callback if provided
          if (retryConfig.onRetry) {
            retryConfig.onRetry(attempts, lastError);
          }

          // Calculate delay and wait
          const delay = this.calculateDelay(attempts, retryConfig);
          if (delay > 0) {
            await this.sleep(delay);
          }
        }
      }
    }

    // All attempts failed
    const recoveryStrategy = this.determineRecoveryStrategy(lastError, context);

    return {
      success: false,
      error: lastError,
      attempts,
      totalTime: Date.now() - startTime,
      recoveryStrategy
    };
  }

  /**
   * Execute with automatic fallback
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    context?: { service?: string; operation?: string }
  ): Promise<RetryResult<T>> {
    // Try primary operation first
    const primaryResult = await this.execute(primaryOperation, config, context);

    if (primaryResult.success) {
      return primaryResult;
    }

    // Log fallback attempt

    // Try fallback operation
    const fallbackResult = await this.execute(
      fallbackOperation,
      { ...config, maxAttempts: 2 }, // Reduce attempts for fallback
      { ...context, operation: `${context?.operation || 'fallback'}_fallback` }
    );

    return {
      ...fallbackResult,
      attempts: primaryResult.attempts + fallbackResult.attempts,
      totalTime: primaryResult.totalTime + fallbackResult.totalTime,
      recoveryStrategy: ErrorRecoveryStrategy.FALLBACK
    };
  }

  /**
   * Register circuit breaker for a service
   */
  registerCircuitBreaker(
    service: string,
    operation: string = 'default',
    config: Partial<CircuitBreakerConfig> = {}
  ): void {
    const key = `${service}:${operation}`;
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      minimumThroughput: 10
    };

    this.circuitBreakers.set(key, {
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      lastFailureTime: 0,
      lastAttemptTime: 0,
      config: { ...defaultConfig, ...config }
    });
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(service: string, operation: string = 'default'): {
    state: CircuitBreakerState;
    failures: number;
    isOpen: boolean;
  } {
    const key = `${service}:${operation}`;
    const breaker = this.circuitBreakers.get(key);

    if (!breaker) {
      return {
        state: CircuitBreakerState.CLOSED,
        failures: 0,
        isOpen: false
      };
    }

    return {
      state: breaker.state,
      failures: breaker.failures,
      isOpen: breaker.state === CircuitBreakerState.OPEN
    };
  }

  /**
   * Manually reset circuit breaker
   */
  resetCircuitBreaker(service: string, operation: string = 'default'): void {
    const key = `${service}:${operation}`;
    const breaker = this.circuitBreakers.get(key);

    if (breaker) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.failures = 0;
      breaker.lastFailureTime = 0;
    }
  }

  /**
   * Calculate delay based on retry strategy
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.strategy) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        break;

      case RetryStrategy.LINEAR_BACKOFF:
        delay = Math.min(
          config.baseDelay * attempt,
          config.maxDelay
        );
        break;

      case RetryStrategy.FIXED_INTERVAL:
        delay = config.baseDelay;
        break;

      case RetryStrategy.IMMEDIATE:
        delay = 0;
        break;

      default:
        delay = config.baseDelay;
    }

    // Add jitter if enabled
    if (config.jitter && delay > 0) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      return false;
    }

    const now = Date.now();

    // Check if circuit breaker should transition from open to half-open
    if (breaker.state === CircuitBreakerState.OPEN) {
      if (now - breaker.lastFailureTime >= breaker.config.recoveryTimeout) {
        breaker.state = CircuitBreakerState.HALF_OPEN;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(service: string, operation?: string): void {
    const key = `${service}:${operation || 'default'}`;
    const breaker = this.circuitBreakers.get(key);

    if (breaker) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.failures = 0;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(service: string, operation?: string): void {
    const key = `${service}:${operation || 'default'}`;
    const breaker = this.circuitBreakers.get(key);

    if (breaker) {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
      breaker.lastAttemptTime = Date.now();

      // Check if we should open the circuit breaker
      if (breaker.failures >= breaker.config.failureThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
      }
    }
  }

  /**
   * Determine recovery strategy based on error and context
   */
  private determineRecoveryStrategy(
    error: Error,
    context?: { service?: string; operation?: string }
  ): ErrorRecoveryStrategy {
    if (error instanceof BaseError) {
      return error.recoveryStrategy;
    }

    const message = error.message.toLowerCase();

    // Network/connection issues
    if (message.includes('connection') || message.includes('network') || message.includes('timeout')) {
      return ErrorRecoveryStrategy.CIRCUIT_BREAKER;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorRecoveryStrategy.RETRY;
    }

    // Service unavailable
    if (message.includes('unavailable') || message.includes('503') || message.includes('502')) {
      return ErrorRecoveryStrategy.FALLBACK;
    }

    // Authentication/authorization
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorRecoveryStrategy.FAIL_FAST;
    }

    // Default to retry for unknown errors
    return ErrorRecoveryStrategy.RETRY;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
export const retryManager = new RetryManager();