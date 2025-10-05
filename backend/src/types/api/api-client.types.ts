/**
 * API Client Types - Standardized interfaces for third-party API integrations
 * 
 * This module defines the core types and interfaces used by the BaseAPIClient
 * and all API client implementations. It ensures consistency across all
 * third-party API integrations in the application.
 */

/**
 * Base configuration for all API clients
 */
export interface APIClientConfig {
  /** Base URL for the API */
  baseUrl: string;
  
  /** Default timeout for requests in milliseconds */
  timeout?: number;
  
  /** Default headers to include with all requests */
  defaultHeaders?: Record<string, string>;
  
  /** Retry configuration */
  retry?: RetryConfig;
  
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  
  /** Additional service-specific configuration */
  [key: string]: any;
}

/**
 * Retry configuration for API requests
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  
  /** Base delay between retries in milliseconds */
  baseDelay?: number;
  
  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;
  
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  
  /** Whether to add jitter to retry delays */
  jitter?: boolean;
  
  /** Retry strategy */
  strategy?: 'EXPONENTIAL_BACKOFF' | 'LINEAR_BACKOFF' | 'FIXED_INTERVAL' | 'IMMEDIATE' | 'CUSTOM';
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold?: number;
  
  /** Time to wait before attempting to close the circuit */
  recoveryTimeout?: number;
  
  /** Number of successful requests needed to close the circuit */
  successThreshold?: number;
  
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests?: number;
  
  /** Time window in milliseconds */
  windowMs?: number;
  
  /** Whether to queue requests when rate limited */
  queueRequests?: boolean;
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  /** Type of authentication */
  type: 'oauth2' | 'api_key' | 'bearer' | 'basic' | 'custom';
  
  /** Access token for OAuth2/Bearer auth */
  accessToken?: string;
  
  /** Refresh token for OAuth2 */
  refreshToken?: string;
  
  /** API key for API key auth */
  apiKey?: string;
  
  /** Username for basic auth */
  username?: string;
  
  /** Password for basic auth */
  password?: string;
  
  /** Additional custom credentials */
  custom?: Record<string, any>;
  
  /** Token expiration timestamp */
  expiresAt?: number;
}

/**
 * Standardized API request
 */
export interface APIRequest {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

  /** API endpoint (relative to base URL) */
  endpoint: string;

  /** Query parameters */
  query?: Record<string, any>;

  /** Request body data */
  data?: any;

  /** Request headers (merged with default headers) */
  headers?: Record<string, string>;

  /** Whether authentication is required (default: true) */
  requiresAuth?: boolean;

  /** Request timeout override */
  timeout?: number;

  /** Per-request credentials (overrides client-level authentication) */
  credentials?: AuthCredentials;

  /** Additional request options */
  options?: RequestOptions;
}

/**
 * Additional request options
 */
export interface RequestOptions {
  /** Whether to follow redirects */
  followRedirects?: boolean;
  
  /** Maximum redirects to follow */
  maxRedirects?: number;
  
  /** Whether to validate SSL certificates */
  validateSSL?: boolean;
  
  /** Custom request metadata */
  metadata?: Record<string, any>;
}

/**
 * Standardized API response
 */
export interface APIResponse<T = any> {
  /** Response data */
  data: T;
  
  /** HTTP status code */
  statusCode: number;
  
  /** Response headers */
  headers: Record<string, string>;
  
  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Request ID for tracking */
  requestId: string;
  
  /** Response timestamp */
  timestamp: string;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Number of retry attempts */
  retryAttempts?: number;
  
  /** Whether response was served from cache */
  fromCache?: boolean;
  
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Standardized API error
 */
export interface APIError extends Error {
  /** Error code */
  code: string;
  
  /** Service name that generated the error */
  serviceName: string;
  
  /** Error timestamp */
  timestamp: string;
  
  /** Error category */
  category: string;
  
  /** Original error message */
  originalError?: string;
  
  /** HTTP status code if applicable */
  statusCode?: number;
  
  /** Additional error context */
  context?: Record<string, any>;
}

/**
 * API client factory configuration
 */
export interface APIClientFactoryConfig {
  /** Default configuration for all clients */
  defaultConfig?: Partial<APIClientConfig>;
  
  /** Service-specific configurations */
  serviceConfigs?: Record<string, Partial<APIClientConfig>>;
  
  /** Whether to enable global rate limiting */
  enableGlobalRateLimit?: boolean;
  
  /** Global rate limit configuration */
  globalRateLimit?: RateLimitConfig;
}

/**
 * API client registration
 */
export interface APIClientRegistration {
  /** Client name/identifier */
  name: string;
  
  /** Client class constructor */
  clientClass: new (config: APIClientConfig) => any;
  
  /** Default configuration for this client */
  defaultConfig: APIClientConfig;
  
  /** Whether the client is enabled */
  enabled?: boolean;
}

/**
 * API client instance
 */
export interface APIClientInstance {
  /** Client name */
  name: string;
  
  /** Client instance */
  client: any;
  
  /** Client configuration */
  config: APIClientConfig;
  
  /** Whether client is initialized */
  initialized: boolean;
  
  /** Client health status */
  healthy: boolean;
}

/**
 * Request context for logging and tracking
 */
export interface RequestContext {
  /** Request ID */
  requestId: string;
  
  /** Service name */
  serviceName: string;
  
  /** User ID if available */
  userId?: string;
  
  /** Session ID if available */
  sessionId?: string;
  
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  
  /** Additional context */
  [key: string]: any;
}

/**
 * API client health status
 */
export interface APIHealthStatus {
  /** Overall health status */
  healthy: boolean;
  
  /** Individual client statuses */
  clients: Record<string, {
    healthy: boolean;
    initialized: boolean;
    authenticated: boolean;
    lastError?: string;
    lastCheck: string;
  }>;
  
  /** Global health metrics */
  metrics: {
    totalClients: number;
    healthyClients: number;
    failedClients: number;
    lastHealthCheck: string;
  };
}
