/**
 * API Client Errors - Standardized error types for API client operations
 * 
 * This module defines consistent error types and handling for all API client
 * operations, ensuring uniform error reporting across the application.
 */

export enum APIClientErrorCode {
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_QUOTA_EXCEEDED = 'RATE_LIMIT_QUOTA_EXCEEDED',
  
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  
  // Circuit breaker
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  
  // Configuration errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  CLIENT_NOT_REGISTERED = 'CLIENT_NOT_REGISTERED',
  CLIENT_NOT_INITIALIZED = 'CLIENT_NOT_INITIALIZED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED'
}

export enum APIClientErrorCategory {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  CLIENT = 'client',
  SERVER = 'server',
  CIRCUIT_BREAKER = 'circuit_breaker',
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  GENERAL = 'general'
}

export interface APIClientErrorDetails {
  serviceName?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  timestamp?: string;
  originalError?: string;
  retryable?: boolean;
  context?: Record<string, any>;
}

/**
 * Standardized API Client Error
 */
export class APIClientError extends Error {
  public readonly code: APIClientErrorCode;
  public readonly category: APIClientErrorCategory;
  public readonly details: APIClientErrorDetails;
  public readonly retryable: boolean;

  constructor(
    code: APIClientErrorCode,
    message: string,
    details: APIClientErrorDetails = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'APIClientError';
    this.code = code;
    this.category = this.categorizeError(code);
    this.details = {
      timestamp: new Date().toISOString(),
      ...details
    };
    this.retryable = retryable;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, APIClientError.prototype);
  }

  private categorizeError(code: APIClientErrorCode): APIClientErrorCategory {
    if (code.startsWith('AUTH')) return APIClientErrorCategory.AUTHENTICATION;
    if (code.startsWith('NETWORK')) return APIClientErrorCategory.NETWORK;
    if (code.startsWith('RATE_LIMIT')) return APIClientErrorCategory.RATE_LIMIT;
    if (code.startsWith('CIRCUIT_BREAKER')) return APIClientErrorCategory.CIRCUIT_BREAKER;
    if (code.startsWith('CONFIG') || code.startsWith('CLIENT_NOT')) return APIClientErrorCategory.CONFIGURATION;
    if (code === APIClientErrorCode.VALIDATION_ERROR) return APIClientErrorCategory.VALIDATION;
    if (['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT'].includes(code)) {
      return APIClientErrorCategory.CLIENT;
    }
    if (['INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE', 'GATEWAY_TIMEOUT'].includes(code)) {
      return APIClientErrorCategory.SERVER;
    }
    return APIClientErrorCategory.GENERAL;
  }

  /**
   * Create a retryable error
   */
  static retryable(code: APIClientErrorCode, message: string, details: APIClientErrorDetails = {}): APIClientError {
    return new APIClientError(code, message, details, true);
  }

  /**
   * Create a non-retryable error
   */
  static nonRetryable(code: APIClientErrorCode, message: string, details: APIClientErrorDetails = {}): APIClientError {
    return new APIClientError(code, message, details, false);
  }

  /**
   * Create from HTTP status code
   */
  static fromHttpStatus(statusCode: number, message: string, details: APIClientErrorDetails = {}): APIClientError {
    let code: APIClientErrorCode;
    let retryable = false;

    switch (statusCode) {
      case 400:
        code = APIClientErrorCode.BAD_REQUEST;
        break;
      case 401:
        code = APIClientErrorCode.UNAUTHORIZED;
        break;
      case 403:
        code = APIClientErrorCode.FORBIDDEN;
        break;
      case 404:
        code = APIClientErrorCode.NOT_FOUND;
        break;
      case 409:
        code = APIClientErrorCode.CONFLICT;
        break;
      case 429:
        code = APIClientErrorCode.RATE_LIMIT_EXCEEDED;
        retryable = true;
        break;
      case 500:
        code = APIClientErrorCode.INTERNAL_SERVER_ERROR;
        retryable = true;
        break;
      case 502:
      case 503:
        code = APIClientErrorCode.SERVICE_UNAVAILABLE;
        retryable = true;
        break;
      case 504:
        code = APIClientErrorCode.GATEWAY_TIMEOUT;
        retryable = true;
        break;
      default:
        code = APIClientErrorCode.UNKNOWN_ERROR;
        retryable = statusCode >= 500;
    }

    return new APIClientError(code, message, { ...details, statusCode }, retryable);
  }

  /**
   * Create from original error
   */
  static fromError(error: unknown, details: APIClientErrorDetails = {}): APIClientError {
    if (error instanceof APIClientError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to extract meaningful information from the error
      const message = error.message || 'Unknown error occurred';
      
      // Check for common error patterns
      if (message.includes('timeout')) {
        return APIClientError.retryable(APIClientErrorCode.NETWORK_TIMEOUT, message, {
          ...details,
          originalError: error.message
        });
      }
      
      if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
        return APIClientError.retryable(APIClientErrorCode.NETWORK_CONNECTION_FAILED, message, {
          ...details,
          originalError: error.message
        });
      }
      
      if (message.includes('unauthorized') || message.includes('401')) {
        return APIClientError.nonRetryable(APIClientErrorCode.UNAUTHORIZED, message, {
          ...details,
          originalError: error.message
        });
      }
      
      if (message.includes('forbidden') || message.includes('403')) {
        return APIClientError.nonRetryable(APIClientErrorCode.FORBIDDEN, message, {
          ...details,
          originalError: error.message
        });
      }
      
      if (message.includes('not found') || message.includes('404')) {
        return APIClientError.nonRetryable(APIClientErrorCode.NOT_FOUND, message, {
          ...details,
          originalError: error.message
        });
      }
      
      // Default to retryable unknown error
      return APIClientError.retryable(APIClientErrorCode.UNKNOWN_ERROR, message, {
        ...details,
        originalError: error.message
      });
    }

    // Handle non-Error objects
    const message = String(error);
    return APIClientError.retryable(APIClientErrorCode.UNKNOWN_ERROR, message, {
      ...details,
      originalError: message
    });
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case APIClientErrorCode.AUTH_REQUIRED:
        return 'Authentication is required to access this service.';
      case APIClientErrorCode.AUTH_FAILED:
        return 'Authentication failed. Please check your credentials.';
      case APIClientErrorCode.AUTH_EXPIRED:
        return 'Your session has expired. Please re-authenticate.';
      case APIClientErrorCode.NETWORK_ERROR:
        return 'A network error occurred. Please check your connection.';
      case APIClientErrorCode.NETWORK_TIMEOUT:
        return 'The request timed out. Please try again.';
      case APIClientErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment and try again.';
      case APIClientErrorCode.BAD_REQUEST:
        return 'Invalid request. Please check your input.';
      case APIClientErrorCode.UNAUTHORIZED:
        return 'You are not authorized to perform this action.';
      case APIClientErrorCode.FORBIDDEN:
        return 'Access to this resource is forbidden.';
      case APIClientErrorCode.NOT_FOUND:
        return 'The requested resource was not found.';
      case APIClientErrorCode.INTERNAL_SERVER_ERROR:
        return 'A server error occurred. Please try again later.';
      case APIClientErrorCode.SERVICE_UNAVAILABLE:
        return 'The service is temporarily unavailable. Please try again later.';
      case APIClientErrorCode.CIRCUIT_BREAKER_OPEN:
        return 'The service is currently unavailable due to high error rates.';
      case APIClientErrorCode.CLIENT_NOT_REGISTERED:
        return 'The API client is not properly configured.';
      case APIClientErrorCode.CLIENT_NOT_INITIALIZED:
        return 'The API client is not initialized.';
      case APIClientErrorCode.VALIDATION_ERROR:
        return 'The request data is invalid. Please check your input.';
      default:
        return this.message || 'An unexpected error occurred.';
    }
  }
}
