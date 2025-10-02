/**
 * Unified Error Handling System
 *
 * Base error class that handles all error cases with automatic context injection,
 * proper HTTP status codes, and comprehensive error tracking.
 *
 * This is the foundation for all errors in the application. Specialized error
 * types (APIClientError, WorkflowError, etc.) extend from this base class.
 */

import { ERROR_CODES, type ErrorCode } from '../errors/error-codes';

// Re-export for backward compatibility
export { ERROR_CODES, type ErrorCode };

/**
 * Error categories for classification
 */
export const ERROR_CATEGORIES = {
  SERVICE: 'service',
  API: 'api',
  VALIDATION: 'validation',
  AUTH: 'auth',
  EXTERNAL: 'external',
  BUSINESS: 'business',
} as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

/**
 * Options for creating an AppError
 */
export interface AppErrorOptions {
  statusCode?: number;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  correlationId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  metadata?: Record<string, any>;
  userFriendly?: boolean;
  retryable?: boolean;
  retryAfter?: number;
  originalError?: Error;
}

/**
 * Main error class that handles all error cases
 *
 * This is the base error class for the entire application. All errors
 * should either be instances of AppError or extend from it.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;

  // Context & tracing (auto-populated)
  public readonly correlationId?: string;
  public readonly userId?: string;
  public readonly service?: string;
  public readonly operation?: string;
  public readonly metadata?: Record<string, any>;
  public readonly timestamp: Date;

  // User experience
  public readonly userFriendly: boolean;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  // Original error for debugging
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: ErrorCode,
    options: AppErrorOptions = {},
  ) {
    super(message);
    this.name = 'AppError';

    // Core properties
    this.code = code;
    this.statusCode = options.statusCode || this.getDefaultStatusCode(code, options.category);
    this.severity = options.severity || this.getDefaultSeverity(options.category);
    this.category = options.category || ERROR_CATEGORIES.SERVICE;

    // Context & tracing
    this.correlationId = options.correlationId;
    this.userId = options.userId;
    this.service = options.service;
    this.operation = options.operation;
    this.metadata = options.metadata;
    this.timestamp = new Date();

    // User experience
    this.userFriendly = options.userFriendly ?? true;
    this.retryable = options.retryable ?? this.isRetryableByDefault(options.category);
    this.retryAfter = options.retryAfter;

    // Original error
    this.originalError = options.originalError;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Get default HTTP status code based on error code and category
   */
  private getDefaultStatusCode(code: ErrorCode, category?: ErrorCategory): number {
    // Check for specific error codes first
    const statusCodeMap: Partial<Record<ErrorCode, number>> = {
      // Auth errors - 401
      [ERROR_CODES.AUTH_REQUIRED]: 401,
      [ERROR_CODES.AUTH_FAILED]: 401,
      [ERROR_CODES.AUTH_EXPIRED]: 401,
      [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 401,
      [ERROR_CODES.AUTHENTICATION_FAILED]: 401,
      [ERROR_CODES.TOKEN_EXPIRED]: 401,
      [ERROR_CODES.TOKEN_INVALID]: 401,
      [ERROR_CODES.TOKEN_UNAVAILABLE]: 401,
      [ERROR_CODES.TOKEN_AUTHENTICATION_FAILED]: 401,
      [ERROR_CODES.UNAUTHORIZED]: 401,
      [ERROR_CODES.NOT_AUTHENTICATED]: 401,

      // Permission errors - 403
      [ERROR_CODES.AUTHORIZATION_DENIED]: 403,
      [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
      [ERROR_CODES.FORBIDDEN]: 403,

      // Validation errors - 400
      [ERROR_CODES.VALIDATION_FAILED]: 400,
      [ERROR_CODES.VALIDATION_ERROR]: 400,
      [ERROR_CODES.INVALID_INPUT]: 400,
      [ERROR_CODES.BAD_REQUEST]: 400,
      [ERROR_CODES.USER_INPUT_INVALID]: 400,

      // Not found - 404
      [ERROR_CODES.NOT_FOUND]: 404,

      // Timeout - 408
      [ERROR_CODES.TIMEOUT]: 408,
      [ERROR_CODES.NETWORK_TIMEOUT]: 408,
      [ERROR_CODES.USER_INPUT_TIMEOUT]: 408,

      // Conflict - 409
      [ERROR_CODES.CONFLICT]: 409,

      // Rate limiting - 429
      [ERROR_CODES.RATE_LIMITED]: 429,
      [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
      [ERROR_CODES.RATE_LIMIT_QUOTA_EXCEEDED]: 429,

      // Internal Server Error - 500
      [ERROR_CODES.INTERNAL_SERVER_ERROR]: 500,
      [ERROR_CODES.CONFIGURATION_ERROR]: 500,
      [ERROR_CODES.CONFIG_ERROR]: 500,

      // Service Unavailable - 503
      [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
      [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 503,
      [ERROR_CODES.NETWORK_ERROR]: 503,
      [ERROR_CODES.NETWORK_CONNECTION_FAILED]: 503,
      [ERROR_CODES.CIRCUIT_BREAKER_OPEN]: 503,

      // Gateway Timeout - 504
      [ERROR_CODES.GATEWAY_TIMEOUT]: 504,
    };

    if (statusCodeMap[code]) {
      return statusCodeMap[code]!;
    }

    // Fallback to category-based mapping
    switch (category) {
      case ERROR_CATEGORIES.AUTH:
        return 401;
      case ERROR_CATEGORIES.VALIDATION:
        return 400;
      case ERROR_CATEGORIES.EXTERNAL:
        return 503;
      case ERROR_CATEGORIES.SERVICE:
        return 500;
      case ERROR_CATEGORIES.API:
        return 400;
      case ERROR_CATEGORIES.BUSINESS:
        return 400;
      default:
        return 500;
    }
  }

  /**
   * Get default severity based on category
   */
  private getDefaultSeverity(category?: ErrorCategory): ErrorSeverity {
    switch (category) {
      case ERROR_CATEGORIES.AUTH:
        return ERROR_SEVERITY.HIGH;
      case ERROR_CATEGORIES.EXTERNAL:
        return ERROR_SEVERITY.MEDIUM;
      case ERROR_CATEGORIES.VALIDATION:
        return ERROR_SEVERITY.LOW;
      case ERROR_CATEGORIES.SERVICE:
        return ERROR_SEVERITY.HIGH;
      case ERROR_CATEGORIES.API:
        return ERROR_SEVERITY.MEDIUM;
      case ERROR_CATEGORIES.BUSINESS:
        return ERROR_SEVERITY.MEDIUM;
      default:
        return ERROR_SEVERITY.MEDIUM;
    }
  }

  /**
   * Determine if error is retryable by default based on category
   */
  private isRetryableByDefault(category?: ErrorCategory): boolean {
    switch (category) {
      case ERROR_CATEGORIES.EXTERNAL:
      case ERROR_CATEGORIES.SERVICE:
        return true;
      case ERROR_CATEGORIES.AUTH:
      case ERROR_CATEGORIES.VALIDATION:
      case ERROR_CATEGORIES.BUSINESS:
        return false;
      default:
        return false;
    }
  }

  /**
   * Add context to error (creates a new error with merged context)
   */
  public addContext(context: Partial<AppErrorOptions>): AppError {
    // Use the current class constructor (supports inheritance)
    const ErrorClass = this.constructor as typeof AppError;

    return new ErrorClass(this.message, this.code, {
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      correlationId: context.correlationId || this.correlationId,
      userId: context.userId || this.userId,
      service: context.service || this.service,
      operation: context.operation || this.operation,
      metadata: { ...this.metadata, ...context.metadata },
      userFriendly: context.userFriendly ?? this.userFriendly,
      retryable: context.retryable ?? this.retryable,
      retryAfter: context.retryAfter ?? this.retryAfter,
      originalError: context.originalError || this.originalError,
    });
  }

  /**
   * Convert to JSON for logging
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      correlationId: this.correlationId,
      userId: this.userId,
      service: this.service,
      operation: this.operation,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      userFriendly: this.userFriendly,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      stack: this.stack,
    };
  }
}

/**
 * Error factory for creating common error patterns
 */
export class ErrorFactory {
  // Service errors (most common)
  static serviceUnavailable(service: string, details?: any): AppError {
    return new AppError(
      `Service '${service}' is not available`,
      'SERVICE_UNAVAILABLE',
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.HIGH,
        service,
        metadata: details,
        retryable: true,
        retryAfter: 30,
      },
    );
  }

  static serviceTimeout(service: string, timeout: number): AppError {
    return new AppError(
      `Service '${service}' timed out after ${timeout}ms`,
      'TIMEOUT',
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.MEDIUM,
        service,
        metadata: { timeout },
        retryable: true,
        retryAfter: 10,
      },
    );
  }

  static serviceError(service: string, message: string, details?: any): AppError {
    return new AppError(
      message,
      'SERVICE_ERROR',
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.MEDIUM,
        service,
        metadata: details,
        retryable: true,
      },
    );
  }

  // API errors
  static badRequest(message: string, details?: any): AppError {
    return new AppError(
      message,
      'BAD_REQUEST',
      {
        category: ERROR_CATEGORIES.API,
        severity: ERROR_SEVERITY.LOW,
        metadata: details,
        retryable: false,
      },
    );
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(
      message,
      'AUTHENTICATION_FAILED',
      {
        category: ERROR_CATEGORIES.AUTH,
        severity: ERROR_SEVERITY.HIGH,
        retryable: false,
      },
    );
  }

  static forbidden(message = 'Access denied'): AppError {
    return new AppError(
      message,
      'AUTHORIZATION_DENIED',
      {
        category: ERROR_CATEGORIES.AUTH,
        severity: ERROR_SEVERITY.HIGH,
        retryable: false,
      },
    );
  }

  static notFound(resource: string): AppError {
    return new AppError(
      `${resource} not found`,
      'NOT_FOUND',
      {
        category: ERROR_CATEGORIES.API,
        severity: ERROR_SEVERITY.LOW,
        metadata: { resource },
        retryable: false,
      },
    );
  }

  static rateLimited(message = 'Rate limit exceeded'): AppError {
    return new AppError(
      message,
      'RATE_LIMITED',
      {
        category: ERROR_CATEGORIES.API,
        severity: ERROR_SEVERITY.MEDIUM,
        retryable: true,
        retryAfter: 60,
      },
    );
  }

  // Validation errors
  static validationFailed(field: string, message: string): AppError {
    return new AppError(
      `Validation failed for ${field}: ${message}`,
      'VALIDATION_FAILED',
      {
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.LOW,
        metadata: { field, message },
        retryable: false,
      },
    );
  }

  static invalidInput(field: string, value: any): AppError {
    return new AppError(
      `Invalid input for ${field}`,
      'INVALID_INPUT',
      {
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.LOW,
        metadata: { field, value },
        retryable: false,
      },
    );
  }

  // External service errors
  static externalServiceError(service: string, message: string): AppError {
    return new AppError(
      `${service} service error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      {
        category: ERROR_CATEGORIES.EXTERNAL,
        severity: ERROR_SEVERITY.MEDIUM,
        service,
        retryable: true,
        retryAfter: 30,
      },
    );
  }

  static networkError(message: string): AppError {
    return new AppError(
      `Network error: ${message}`,
      'NETWORK_ERROR',
      {
        category: ERROR_CATEGORIES.EXTERNAL,
        severity: ERROR_SEVERITY.MEDIUM,
        retryable: true,
        retryAfter: 15,
      },
    );
  }

  // Business logic errors
  static businessRuleViolation(rule: string, details?: any): AppError {
    return new AppError(
      `Business rule violation: ${rule}`,
      'BUSINESS_RULE_VIOLATION',
      {
        category: ERROR_CATEGORIES.BUSINESS,
        severity: ERROR_SEVERITY.MEDIUM,
        metadata: { rule, ...details },
        retryable: false,
      },
    );
  }

  static insufficientPermissions(required: string): AppError {
    return new AppError(
      `Insufficient permissions. Required: ${required}`,
      'INSUFFICIENT_PERMISSIONS',
      {
        category: ERROR_CATEGORIES.AUTH,
        severity: ERROR_SEVERITY.HIGH,
        metadata: { required },
        retryable: false,
      },
    );
  }

  // Wrap existing errors (for migration)
  static wrapError(error: Error, category: ErrorCategory, context?: any): AppError {
    return new AppError(
      error.message,
      'WRAPPED_ERROR',
      {
        category,
        severity: ERROR_SEVERITY.MEDIUM,
        originalError: error,
        metadata: context,
        retryable: false,
      },
    );
  }
}

/**
 * Utility to extract correlation ID from request
 */
export function getCorrelationId(req: any): string {
  return req.correlationId || req.headers['x-correlation-id'] || `req-${Date.now()}`;
}

/**
 * Utility to create error context from request
 */
export function createErrorContext(req: any, additionalContext: Record<string, any> = {}): Record<string, any> {
  return {
    correlationId: getCorrelationId(req),
    userId: req.user?.userId || req.headers['x-user-id'],
    service: req.service || 'unknown',
    operation: req.operation || 'unknown',
    ...additionalContext,
  };
}
