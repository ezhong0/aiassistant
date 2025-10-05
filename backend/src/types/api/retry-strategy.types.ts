/**
 * Type-safe retry strategies using discriminated unions
 */
export type RetryStrategy =
  | {
      type: 'EXPONENTIAL_BACKOFF';
      baseDelay: number;
      maxDelay: number;
      multiplier: number;
    }
  | {
      type: 'LINEAR_BACKOFF';
      baseDelay: number;
      increment: number;
      maxAttempts: number;
    }
  | {
      type: 'FIXED_DELAY';
      delay: number;
      maxAttempts: number;
    }
  | {
      type: 'FIBONACCI_BACKOFF';
      baseDelay: number;
      maxDelay: number;
    };

// Type guards
export function isExponentialBackoff(
  strategy: RetryStrategy
): strategy is Extract<RetryStrategy, { type: 'EXPONENTIAL_BACKOFF' }> {
  return strategy.type === 'EXPONENTIAL_BACKOFF';
}

export function isLinearBackoff(
  strategy: RetryStrategy
): strategy is Extract<RetryStrategy, { type: 'LINEAR_BACKOFF' }> {
  return strategy.type === 'LINEAR_BACKOFF';
}

export function isFixedDelay(
  strategy: RetryStrategy
): strategy is Extract<RetryStrategy, { type: 'FIXED_DELAY' }> {
  return strategy.type === 'FIXED_DELAY';
}

export function isFibonacciBackoff(
  strategy: RetryStrategy
): strategy is Extract<RetryStrategy, { type: 'FIBONACCI_BACKOFF' }> {
  return strategy.type === 'FIBONACCI_BACKOFF';
}

/**
 * Factory functions with proper types
 */
export const RetryStrategies = {
  exponentialBackoff: (config: {
    baseDelay?: number;
    maxDelay?: number;
    multiplier?: number;
  } = {}): Extract<RetryStrategy, { type: 'EXPONENTIAL_BACKOFF' }> => ({
    type: 'EXPONENTIAL_BACKOFF',
    baseDelay: config.baseDelay ?? 1000,
    maxDelay: config.maxDelay ?? 10000,
    multiplier: config.multiplier ?? 2,
  }),

  linearBackoff: (config: {
    baseDelay?: number;
    increment?: number;
    maxAttempts?: number;
  } = {}): Extract<RetryStrategy, { type: 'LINEAR_BACKOFF' }> => ({
    type: 'LINEAR_BACKOFF',
    baseDelay: config.baseDelay ?? 1000,
    increment: config.increment ?? 1000,
    maxAttempts: config.maxAttempts ?? 3,
  }),

  fixedDelay: (config: {
    delay?: number;
    maxAttempts?: number;
  } = {}): Extract<RetryStrategy, { type: 'FIXED_DELAY' }> => ({
    type: 'FIXED_DELAY',
    delay: config.delay ?? 1000,
    maxAttempts: config.maxAttempts ?? 3,
  }),

  fibonacciBackoff: (config: {
    baseDelay?: number;
    maxDelay?: number;
  } = {}): Extract<RetryStrategy, { type: 'FIBONACCI_BACKOFF' }> => ({
    type: 'FIBONACCI_BACKOFF',
    baseDelay: config.baseDelay ?? 1000,
    maxDelay: config.maxDelay ?? 10000,
  }),
};
