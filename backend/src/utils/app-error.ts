/**
 * Streamlined Error Handling System
 * 
 * A single error class that handles all error cases with automatic context injection,
 * proper HTTP status codes, and Winston logging integration.
 */

// import logger from './logger';

/**
 * Error categories for classification
 */
export const ERROR_CATEGORIES = {
  SERVICE: 'service',
  API: 'api', 
  VALIDATION: 'validation',
  AUTH: 'auth',
  EXTERNAL: 'external',
  BUSINESS: 'business'
} as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

/**
 * Main error class that handles all error cases
 */
export class AppError extends Error {
  public readonly code: string;
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
    code: string,
    options: {
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
    } = {}
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
  private getDefaultStatusCode(code: string, category?: ErrorCategory): number {
    // Check for specific error codes first
    const statusCodeMap: Record<string, number> = {
      'AUTHENTICATION_FAILED': 401,
      'TOKEN_EXPIRED': 401,
      'AUTHORIZATION_DENIED': 403,
      'INSUFFICIENT_PERMISSIONS': 403,
      'VALIDATION_FAILED': 400,
      'INVALID_INPUT': 400,
      'BAD_REQUEST': 400,
      'NOT_FOUND': 404,
      'RATE_LIMITED': 429,
      'SERVICE_UNAVAILABLE': 503,
      'EXTERNAL_SERVICE_ERROR': 503,
      'NETWORK_ERROR': 503,
      'TIMEOUT': 408,
      'CONFIGURATION_ERROR': 500
    };

    if (statusCodeMap[code]) {
      return statusCodeMap[code];
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
   * Add context to error
   */
  public addContext(context: {
    correlationId?: string;
    userId?: string;
    service?: string;
    operation?: string;
    metadata?: Record<string, any>;
  }): AppError {
    return new AppError(this.message, this.code, {
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      correlationId: context.correlationId || this.correlationId,
      userId: context.userId || this.userId,
      service: context.service || this.service,
      operation: context.operation || this.operation,
      metadata: { ...this.metadata, ...context.metadata },
      userFriendly: this.userFriendly,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      originalError: this.originalError
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
      stack: this.stack
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
        retryAfter: 30
      }
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
        retryAfter: 10
      }
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
        retryable: true
      }
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
        retryable: false
      }
    );
  }

  static unauthorized(message: string = 'Authentication required'): AppError {
    return new AppError(
      message,
      'AUTHENTICATION_FAILED',
      {
        category: ERROR_CATEGORIES.AUTH,
        severity: ERROR_SEVERITY.HIGH,
        retryable: false
      }
    );
  }

  static forbidden(message: string = 'Access denied'): AppError {
    return new AppError(
      message,
      'AUTHORIZATION_DENIED',
      {
        category: ERROR_CATEGORIES.AUTH,
        severity: ERROR_SEVERITY.HIGH,
        retryable: false
      }
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
        retryable: false
      }
    );
  }

  static rateLimited(message: string = 'Rate limit exceeded'): AppError {
    return new AppError(
      message,
      'RATE_LIMITED',
      {
        category: ERROR_CATEGORIES.API,
        severity: ERROR_SEVERITY.MEDIUM,
        retryable: true,
        retryAfter: 60
      }
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
        retryable: false
      }
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
        retryable: false
      }
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
        retryAfter: 30
      }
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
        retryAfter: 15
      }
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
        retryable: false
      }
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
        retryable: false
      }
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
        retryable: false
      }
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
    ...additionalContext
  };
}
