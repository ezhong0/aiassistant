/**
 * Standardized API response formats
 * Ensures consistent response structure across all endpoints
 */

/**
 * Standard API response structure for all endpoints
 */
export interface StandardAPIResponse<T = any> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Response type for client handling */
  type: 'response' | 'action_completed' | 'confirmation_required' | 'error' | 'session_data' | 'partial_success';
  
  /** Human-readable message describing the result */
  message: string;
  
  /** Response data (optional) */
  data?: T | undefined;
  
  /** Error code for failed operations (optional) */
  error?: string | undefined;
  
  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Response metadata included in all API responses
 */
export interface ResponseMetadata {
  /** Request timestamp */
  timestamp: string;
  
  /** Request ID for tracking */
  requestId?: string | undefined;
  
  /** Session ID if applicable */
  sessionId?: string | undefined;
  
  /** User ID if authenticated */
  userId?: string | undefined;
  
  /** Execution time in milliseconds */
  executionTime?: number | undefined;
  
  /** API version */
  version?: string | undefined;
  
  /** Additional context-specific metadata */
  [key: string]: any;
}

/**
 * Error details for failed responses
 */
export interface ErrorDetails {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Additional error context */
  details?: Record<string, any>;
  
  /** Stack trace (development only) */
  stack?: string;
  
  /** Suggestions for resolution */
  suggestions?: string[];
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMetadata {
  /** Current page number */
  page: number;
  
  /** Number of items per page */
  limit: number;
  
  /** Total number of items */
  total: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Whether there are more pages */
  hasNext: boolean;
  
  /** Whether there are previous pages */
  hasPrev: boolean;
}

/**
 * Specialized response types for different operations
 */

/** Authentication response */
export interface AuthenticationResponse extends StandardAPIResponse {
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
    tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };
    jwt: string;
  };
}

/** Assistant operation response */
export interface AssistantResponse extends StandardAPIResponse {
  data?: {
    sessionId: string;
    toolResults?: any[];
    pendingActions?: any[];
    conversationContext?: any;
    executionStats?: {
      successful: number;
      failed: number;
      total: number;
    };
  };
}

/** Session data response */
export interface SessionResponse extends StandardAPIResponse {
  data?: {
    session: {
      sessionId: string;
      userId: string;
      createdAt: string;
      lastActivity: string;
      expiresAt: string;
      isActive: boolean;
    };
    conversationHistory: any[];
    recentToolResults: any[];
    statistics: any;
  };
}

/** Email operation response */
export interface EmailResponse extends StandardAPIResponse {
  data?: {
    emailId?: string;
    threadId?: string;
    emails?: any[];
    count?: number;
    draft?: any;
  };
}

/** Contact search response */
export interface ContactResponse extends StandardAPIResponse {
  data?: {
    contacts: any[];
    totalCount: number;
    pagination?: PaginationMetadata;
  };
}

/** Health check response */
export interface HealthResponse extends StandardAPIResponse {
  data?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'operational' | 'degraded' | 'down'>;
    uptime: number;
    version: string;
  };
}

/**
 * Response builder utilities
 */
export class ResponseBuilder {
  /**
   * Create a successful response
   */
  static success<T>(
    message: string,
    data?: T,
    type: StandardAPIResponse['type'] = 'response',
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type,
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    errorCode: string,
    statusCode: number = 500,
    details?: any,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse {
    return {
      success: false,
      type: 'error',
      message,
      error: errorCode,
      data: details ? { error: details } : undefined,
      metadata: {
        timestamp: new Date().toISOString(),
        statusCode,
        ...metadata
      }
    };
  }

  /**
   * Create a confirmation required response
   */
  static confirmationRequired<T>(
    message: string,
    data: T,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type: 'confirmation_required',
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create an action completed response
   */
  static actionCompleted<T>(
    message: string,
    data?: T,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type: 'action_completed',
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create a partial success response
   */
  static partialSuccess<T>(
    message: string,
    data?: T,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type: 'partial_success',
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Add standard metadata to response
   */
  static withMetadata<T>(
    response: StandardAPIResponse<T>,
    additionalMetadata: Partial<ResponseMetadata>
  ): StandardAPIResponse<T> {
    return {
      ...response,
      metadata: {
        ...response.metadata,
        ...additionalMetadata
      }
    };
  }

  /**
   * Add execution timing to response
   */
  static withTiming<T>(
    response: StandardAPIResponse<T>,
    startTime: number
  ): StandardAPIResponse<T> {
    const executionTime = Date.now() - startTime;
    return this.withMetadata(response, { executionTime });
  }

  /**
   * Add pagination to response
   */
  static withPagination<T>(
    response: StandardAPIResponse<T>,
    pagination: PaginationMetadata
  ): StandardAPIResponse<T> {
    return this.withMetadata(response, { pagination });
  }
}

/**
 * Common HTTP status codes for responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * Common error codes
 */
export const ERROR_CODES = {
  // Authentication errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // Operation errors
  OPERATION_FAILED: 'OPERATION_FAILED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;
