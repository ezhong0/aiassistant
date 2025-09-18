/**
 * Comprehensive Error Classification System for AI Assistant
 *
 * This module defines a structured error taxonomy with severity levels,
 * error codes, and comprehensive error types for all aspects of the system.
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  SERVICE = 'service',
  API = 'api',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL = 'external',
  DATABASE = 'database',
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  BUSINESS_LOGIC = 'business_logic',
  RATE_LIMITING = 'rate_limiting',
  DEPENDENCY = 'dependency'
}

/**
 * Error recovery strategies
 */
export enum ErrorRecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  DEGRADE = 'degrade',
  FAIL_FAST = 'fail_fast',
  CIRCUIT_BREAKER = 'circuit_breaker',
  MANUAL_INTERVENTION = 'manual_intervention'
}

/**
 * Base error interface
 */
export interface IError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  recoveryStrategy: ErrorRecoveryStrategy;
  retryable: boolean;
  userFriendly: boolean;
  details?: Record<string, any>;
  timestamp?: Date;
  correlationId?: string;
  service?: string;
  operation?: string;
  originalError?: Error;
}

/**
 * Base custom error class
 */
export abstract class BaseError extends Error implements IError {
  abstract code: string;
  abstract severity: ErrorSeverity;
  abstract category: ErrorCategory;
  abstract recoveryStrategy: ErrorRecoveryStrategy;
  abstract retryable: boolean;
  abstract userFriendly: boolean;

  public details: Record<string, any> = {};
  public timestamp: Date;
  public correlationId?: string;
  public service?: string;
  public operation?: string;
  public originalError?: Error;

  constructor(
    message: string,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details || {};
    this.originalError = originalError;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Set context information
   */
  setContext(service?: string, operation?: string, correlationId?: string): this {
    this.service = service;
    this.operation = operation;
    this.correlationId = correlationId;
    return this;
  }

  /**
   * Add additional details
   */
  addDetails(key: string, value: any): this {
    this.details[key] = value;
    return this;
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    if (this.userFriendly) {
      return this.message;
    }
    return 'An unexpected error occurred. Please try again or contact support.';
  }

  /**
   * Serialize error for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      recoveryStrategy: this.recoveryStrategy,
      retryable: this.retryable,
      userFriendly: this.userFriendly,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      service: this.service,
      operation: this.operation,
      stack: this.stack
    };
  }
}

/**
 * Service-related errors
 */
export class ServiceError extends BaseError {
  code = 'SERVICE_ERROR';
  severity = ErrorSeverity.HIGH;
  category = ErrorCategory.SERVICE;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
  retryable = true;
  userFriendly = false;
}

export class ServiceInitializationError extends ServiceError {
  code = 'SERVICE_INITIALIZATION_FAILED';
  severity = ErrorSeverity.CRITICAL;
  recoveryStrategy = ErrorRecoveryStrategy.MANUAL_INTERVENTION;
  retryable = false;
}

export class ServiceDependencyError extends ServiceError {
  code = 'SERVICE_DEPENDENCY_UNAVAILABLE';
  severity = ErrorSeverity.MEDIUM;
  recoveryStrategy = ErrorRecoveryStrategy.DEGRADE;
  retryable = true;
}

export class ServiceUnavailableError extends ServiceError {
  code = 'SERVICE_UNAVAILABLE';
  severity = ErrorSeverity.HIGH;
  recoveryStrategy = ErrorRecoveryStrategy.CIRCUIT_BREAKER;
  retryable = true;
}

/**
 * API-related errors
 */
export class APIError extends BaseError {
  code = 'API_ERROR';
  severity = ErrorSeverity.MEDIUM;
  category = ErrorCategory.API;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
  retryable = true;
  userFriendly = true;
}

export class APIValidationError extends APIError {
  code = 'API_VALIDATION_FAILED';
  severity = ErrorSeverity.LOW;
  recoveryStrategy = ErrorRecoveryStrategy.FAIL_FAST;
  retryable = false;
}

export class APIRateLimitError extends APIError {
  code = 'API_RATE_LIMIT_EXCEEDED';
  severity = ErrorSeverity.MEDIUM;
  category = ErrorCategory.RATE_LIMITING;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
  retryable = true;
}

export class APITimeoutError extends APIError {
  code = 'API_TIMEOUT';
  severity = ErrorSeverity.MEDIUM;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
  retryable = true;
}

/**
 * External service errors
 */
export class ExternalServiceError extends BaseError {
  code = 'EXTERNAL_SERVICE_ERROR';
  severity = ErrorSeverity.MEDIUM;
  category = ErrorCategory.EXTERNAL;
  recoveryStrategy = ErrorRecoveryStrategy.FALLBACK;
  retryable = true;
  userFriendly = true;
}

export class OpenAIError extends ExternalServiceError {
  code = 'OPENAI_ERROR';
  recoveryStrategy = ErrorRecoveryStrategy.CIRCUIT_BREAKER;
}

export class GoogleAPIError extends ExternalServiceError {
  code = 'GOOGLE_API_ERROR';
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
}

export class SlackAPIError extends ExternalServiceError {
  code = 'SLACK_API_ERROR';
  recoveryStrategy = ErrorRecoveryStrategy.DEGRADE;
}

/**
 * Database errors
 */
export class DatabaseError extends BaseError {
  code = 'DATABASE_ERROR';
  severity = ErrorSeverity.HIGH;
  category = ErrorCategory.DATABASE;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
  retryable = true;
  userFriendly = false;
}

export class DatabaseConnectionError extends DatabaseError {
  code = 'DATABASE_CONNECTION_FAILED';
  severity = ErrorSeverity.CRITICAL;
  recoveryStrategy = ErrorRecoveryStrategy.FALLBACK;
}

export class DatabaseQueryError extends DatabaseError {
  code = 'DATABASE_QUERY_FAILED';
  severity = ErrorSeverity.MEDIUM;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends BaseError {
  code = 'AUTHENTICATION_FAILED';
  severity = ErrorSeverity.MEDIUM;
  category = ErrorCategory.AUTHENTICATION;
  recoveryStrategy = ErrorRecoveryStrategy.FAIL_FAST;
  retryable = false;
  userFriendly = true;
}

export class AuthorizationError extends BaseError {
  code = 'AUTHORIZATION_DENIED';
  severity = ErrorSeverity.MEDIUM;
  category = ErrorCategory.AUTHORIZATION;
  recoveryStrategy = ErrorRecoveryStrategy.FAIL_FAST;
  retryable = false;
  userFriendly = true;
}

export class TokenExpiredError extends AuthenticationError {
  code = 'TOKEN_EXPIRED';
  severity = ErrorSeverity.LOW;
  retryable = true;
}

/**
 * Validation errors
 */
export class ValidationError extends BaseError {
  code = 'VALIDATION_FAILED';
  severity = ErrorSeverity.LOW;
  category = ErrorCategory.VALIDATION;
  recoveryStrategy = ErrorRecoveryStrategy.FAIL_FAST;
  retryable = false;
  userFriendly = true;
}

/**
 * Network errors
 */
export class NetworkError extends BaseError {
  code = 'NETWORK_ERROR';
  severity = ErrorSeverity.MEDIUM;
  category = ErrorCategory.NETWORK;
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
  retryable = true;
  userFriendly = false;
}

export class TimeoutError extends NetworkError {
  code = 'NETWORK_TIMEOUT';
  recoveryStrategy = ErrorRecoveryStrategy.RETRY;
}

export class ConnectionError extends NetworkError {
  code = 'CONNECTION_FAILED';
  severity = ErrorSeverity.HIGH;
  recoveryStrategy = ErrorRecoveryStrategy.CIRCUIT_BREAKER;
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  code = 'CONFIGURATION_ERROR';
  severity = ErrorSeverity.CRITICAL;
  category = ErrorCategory.CONFIGURATION;
  recoveryStrategy = ErrorRecoveryStrategy.MANUAL_INTERVENTION;
  retryable = false;
  userFriendly = false;
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends BaseError {
  code = 'BUSINESS_LOGIC_ERROR';
  severity = ErrorSeverity.LOW;
  category = ErrorCategory.BUSINESS_LOGIC;
  recoveryStrategy = ErrorRecoveryStrategy.FAIL_FAST;
  retryable = false;
  userFriendly = true;
}

/**
 * Error factory for creating appropriate error instances
 */
export class ErrorFactory {
  /**
   * Create error from category and details
   */
  static createError(
    category: ErrorCategory,
    message: string,
    details?: Record<string, any>,
    originalError?: Error
  ): BaseError {
    switch (category) {
      case ErrorCategory.SERVICE:
        return new ServiceError(message, details, originalError);
      case ErrorCategory.API:
        return new APIError(message, details, originalError);
      case ErrorCategory.EXTERNAL:
        return new ExternalServiceError(message, details, originalError);
      case ErrorCategory.DATABASE:
        return new DatabaseError(message, details, originalError);
      case ErrorCategory.AUTHENTICATION:
        return new AuthenticationError(message, details, originalError);
      case ErrorCategory.AUTHORIZATION:
        return new AuthorizationError(message, details, originalError);
      case ErrorCategory.VALIDATION:
        return new ValidationError(message, details, originalError);
      case ErrorCategory.NETWORK:
        return new NetworkError(message, details, originalError);
      case ErrorCategory.CONFIGURATION:
        return new ConfigurationError(message, details, originalError);
      case ErrorCategory.BUSINESS_LOGIC:
        return new BusinessLogicError(message, details, originalError);
      default:
        return new ServiceError(message, details, originalError);
    }
  }

  /**
   * Wrap existing error with proper classification
   */
  static wrapError(
    error: Error,
    category: ErrorCategory,
    service?: string,
    operation?: string
  ): BaseError {
    const wrappedError = this.createError(category, error.message, {}, error);
    if (service || operation) {
      wrappedError.setContext(service, operation);
    }
    return wrappedError;
  }
}

/**
 * Error code registry for easy lookup
 */
export const ERROR_CODES = {
  // Service errors
  SERVICE_ERROR: 'SERVICE_ERROR',
  SERVICE_INITIALIZATION_FAILED: 'SERVICE_INITIALIZATION_FAILED',
  SERVICE_DEPENDENCY_UNAVAILABLE: 'SERVICE_DEPENDENCY_UNAVAILABLE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // API errors
  API_ERROR: 'API_ERROR',
  API_VALIDATION_FAILED: 'API_VALIDATION_FAILED',
  API_RATE_LIMIT_EXCEEDED: 'API_RATE_LIMIT_EXCEEDED',
  API_TIMEOUT: 'API_TIMEOUT',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  OPENAI_ERROR: 'OPENAI_ERROR',
  GOOGLE_API_ERROR: 'GOOGLE_API_ERROR',
  SLACK_API_ERROR: 'SLACK_API_ERROR',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',

  // Auth errors
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',

  // Configuration errors
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Business logic errors
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR'
} as const;

/**
 * Error message templates for user-friendly messages
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  [ERROR_CODES.API_VALIDATION_FAILED]: 'Invalid request data. Please check your input and try again.',
  [ERROR_CODES.API_RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment before trying again.',
  [ERROR_CODES.AUTHENTICATION_FAILED]: 'Authentication failed. Please check your credentials.',
  [ERROR_CODES.AUTHORIZATION_DENIED]: 'Access denied. You do not have permission to perform this action.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out. Please check your connection and try again.',
  [ERROR_CODES.DATABASE_ERROR]: 'Data service is temporarily unavailable. Please try again later.',
  [ERROR_CODES.OPENAI_ERROR]: 'AI service is temporarily unavailable. Please try again later.',
  [ERROR_CODES.GOOGLE_API_ERROR]: 'Google services are temporarily unavailable. Please try again later.',
  [ERROR_CODES.SLACK_API_ERROR]: 'Slack integration is temporarily unavailable. Please try again later.'
} as const;