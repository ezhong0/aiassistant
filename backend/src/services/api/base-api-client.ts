import { BaseService } from '../base-service';
import { retryManager, RetryConfig, RetryStrategy } from '../../errors/retry-manager';
import { AIServiceCircuitBreaker } from '../ai-circuit-breaker.service';
import {
  APIClientConfig,
  APIRequest,
  APIResponse,
  AuthCredentials,
  RequestOptions,
  ResponseMetadata
} from '../../types/api/api-client.types';
import { APIClientError, ErrorFactory, ERROR_CODES } from '../../errors';
import { ErrorTransformer } from '../../errors/transformers';
import logger from '../../utils/logger';

/**
 * Base API Client - Standardized foundation for all third-party API integrations
 * 
 * This abstract class provides a consistent interface and implementation for:
 * - Authentication management
 * - Request/response handling
 * - Error standardization
 * - Retry logic with circuit breaker protection
 * - Rate limiting and timeout management
 * - Comprehensive logging and monitoring
 * 
 * All third-party API clients should extend this class to ensure consistency
 * across the application.
 * 
 * @abstract
 * @extends BaseService
 * 
 * @example
 * ```typescript
 * class GoogleAPIClient extends BaseAPIClient {
 *   constructor(config: GoogleAPIClientConfig) {
 *     super('GoogleAPIClient', config);
 *   }
 * 
 *   protected async authenticate(credentials: AuthCredentials): Promise<void> {
 *     // Google-specific authentication logic
 *   }
 * 
 *   protected async makeRequest<T>(request: APIRequest): Promise<APIResponse<T>> {
 *     // Google-specific request implementation
 *   }
 * 
 *   protected handleError(error: unknown): APIError {
 *     // Google-specific error handling
 *   }
 * }
 * ```
 */
export abstract class BaseAPIClient extends BaseService {
  protected config: APIClientConfig;
  protected retryManager: typeof retryManager;
  protected circuitBreaker: AIServiceCircuitBreaker | null = null;
  protected authenticated: boolean = false;
  protected authCredentials: AuthCredentials | null = null;
  protected requiresCircuitBreaker: boolean = false;

  constructor(serviceName: string, config: APIClientConfig, requiresCircuitBreaker: boolean = false) {
    super(serviceName);
    this.config = config;
    this.retryManager = retryManager;
    this.requiresCircuitBreaker = requiresCircuitBreaker;

    // Only initialize circuit breaker for AI operations
    if (requiresCircuitBreaker) {
      // AIServiceCircuitBreaker now uses environment variables for config
      this.circuitBreaker = new AIServiceCircuitBreaker();
    }
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing API client', {
        serviceName: this.name,
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        retryConfig: this.config.retry
      });

      // Initialize circuit breaker if it exists
      if (this.circuitBreaker) {
        await this.circuitBreaker.initialize();
      }

      this.logInfo('API client initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize API client', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      // Cleanup circuit breaker if it exists
      if (this.circuitBreaker) {
        await this.circuitBreaker.destroy();
      }

      // Clear authentication
      this.authenticated = false;
      this.authCredentials = null;

      this.logInfo('API client destroyed successfully');
    } catch (error) {
      this.logError('Error destroying API client', error);
    }
  }

  /**
   * Authenticate with the API service
   * 
   * @param credentials - Authentication credentials
   * @throws {APIError} When authentication fails
   */
  async authenticate(credentials: AuthCredentials): Promise<void> {
    this.assertReady();

    try {
      this.logDebug('Authenticating with API', {
        serviceName: this.name,
        credentialType: credentials.type
      });

      await this.performAuthentication(credentials);

      this.authenticated = true;
      this.authCredentials = credentials;

      this.logInfo('API authentication successful', {
        serviceName: this.name,
        credentialType: credentials.type
      });
    } catch (error) {
      this.logError('API authentication failed', error);
      throw ErrorFactory.external.generic(this.name, 'Authentication failed');
    }
  }

  /**
   * Make a standardized API request
   * 
   * @param request - API request configuration
   * @returns Promise resolving to standardized API response
   * @throws {APIError} When request fails
   */
  async makeRequest<T = any>(request: APIRequest): Promise<APIResponse<T>> {
    // E2E Testing: Intercept external API calls for testing (EXCEPT OpenAI - those should be real)
    if (process.env.E2E_TESTING === 'true' && this.name !== 'OpenAIClient') {
      logger.debug('E2E_TESTING enabled, attempting to intercept external API call', {
        clientName: this.name,
        endpoint: request.endpoint
      });

      try {
        // Dynamic import to avoid build issues when tests directory doesn't exist
        const path = await import('path');
        const mockManagerPath = path.resolve(process.cwd(), 'tests/e2e/framework/api-mock-manager');
        logger.debug('Importing mock manager', { path: mockManagerPath });
        const mockManagerModule = await import(mockManagerPath);
        logger.debug('Mock manager imported successfully', { hasClass: !!mockManagerModule.ApiMockManager });
        const result = await mockManagerModule.ApiMockManager.interceptRequest(this.name, request);
        logger.debug('Mock API call successful', { clientName: this.name, endpoint: request.endpoint });
        return result;
      } catch (error) {
        // Fallback to real API if mock manager not available (expected in production builds)
        logger.error('E2E mock manager failed, falling back to real API', {
          error: (error as Error).message,
          stack: (error as Error).stack,
          clientName: this.name,
          endpoint: request.endpoint
        });
      }
    }

    this.assertReady();

    if (!this.authenticated && request.requiresAuth !== false) {
      throw ErrorFactory.api.unauthorized('Client not authenticated');
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    // CENTRALIZED API CALL LOGGING - Input
    logger.info('API_REQUEST_INPUT', {
      correlationId: requestId,
      operation: 'external_api_request',
      service: this.name,
      timestamp: new Date().toISOString(),
      request: {
        method: request.method,
        endpoint: request.endpoint,
        url: `${this.config.baseUrl}${request.endpoint}`,
        query: request.query ? JSON.stringify(request.query) : undefined,
        data: request.data ? JSON.stringify(request.data).substring(0, 2000) + (JSON.stringify(request.data).length > 2000 ? '...[TRUNCATED]' : '') : undefined,
        headers: request.headers ? JSON.stringify(request.headers) : undefined,
        requiresAuth: request.requiresAuth !== false
      },
      client: {
        authenticated: this.authenticated,
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout
      }
    });
    
    try {
      this.logDebug('Making API request', {
        requestId,
        method: request.method,
        endpoint: request.endpoint,
        serviceName: this.name
      });

      // Execute request with circuit breaker protection (only for AI operations)
      const response = this.circuitBreaker
        ? await this.circuitBreaker.execute(async () => {
            return this.executeRequestWithRetry<T>(request, requestId);
          })
        : await this.executeRequestWithRetry<T>(request, requestId);

      const executionTime = Date.now() - startTime;
      
      // Record OpenAI calls for E2E testing
      if (process.env.E2E_TESTING === 'true' && this.name === 'OpenAIClient') {
        try {
          const path = await import('path');
          const mockManagerPath = path.resolve(process.cwd(), 'tests/e2e/framework/api-mock-manager');
          const mockManagerModule = await import(mockManagerPath);
          mockManagerModule.ApiMockManager.recordOpenAICall(request, response, executionTime);
        } catch (error) {
          // Ignore errors in E2E recording
          logger.debug('Failed to record OpenAI call for E2E testing', { error: (error as Error).message });
        }
      }
      
      // CENTRALIZED API CALL LOGGING - Output on Success
      logger.info('API_REQUEST_OUTPUT_SUCCESS', {
        correlationId: requestId,
        operation: 'external_api_request_success',
        service: this.name,
        timestamp: new Date().toISOString(),
        request: {
          method: request.method,
          endpoint: request.endpoint,
          url: `${this.config.baseUrl}${request.endpoint}`
        },
        response: {
          statusCode: response.statusCode,
          headers: response.headers ? JSON.stringify(response.headers) : undefined,
          data: response.data ? JSON.stringify(response.data).substring(0, 2000) + (JSON.stringify(response.data).length > 2000 ? '...[TRUNCATED]' : '') : undefined,
          dataSize: response.data ? `${JSON.stringify(response.data).length} characters` : '0 characters'
        },
        metadata: {
          executionTime,
          requestId,
          timestamp: response.metadata.timestamp
        }
      });
      
      this.logInfo('API request completed successfully', {
        requestId,
        method: request.method,
        endpoint: request.endpoint,
        statusCode: response.statusCode,
        executionTime,
        serviceName: this.name
      });

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // CENTRALIZED API CALL LOGGING - Output on Error
      logger.error('API_REQUEST_OUTPUT_ERROR', {
        correlationId: requestId,
        operation: 'external_api_request_error',
        service: this.name,
        timestamp: new Date().toISOString(),
        request: {
          method: request.method,
          endpoint: request.endpoint,
          url: `${this.config.baseUrl}${request.endpoint}`
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Error',
          stack: error instanceof Error ? error.stack : undefined,
          code: error instanceof Error && (error as any).code ? (error as any).code : undefined,
          status: error instanceof Error && (error as any).status ? (error as any).status : undefined
        },
        metadata: {
          executionTime,
          authenticated: this.authenticated
        }
      });
      
      this.logError('API request failed', error, {
        requestId,
        method: request.method,
        endpoint: request.endpoint,
        executionTime,
        serviceName: this.name
      });

      throw this.handleAPIError(error, request);
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequestWithRetry<T>(
    request: APIRequest, 
    requestId: string
  ): Promise<APIResponse<T>> {
    const retryConfig: RetryConfig = {
      maxAttempts: this.config.retry?.maxAttempts || 3,
      baseDelay: this.config.retry?.baseDelay || 1000,
      maxDelay: this.config.retry?.maxDelay || 10000,
      backoffMultiplier: this.config.retry?.backoffMultiplier || 2,
      jitter: this.config.retry?.jitter !== false,
      strategy: (this.config.retry?.strategy as RetryStrategy) || RetryStrategy.EXPONENTIAL_BACKOFF
    };

    const result = await this.retryManager.execute(
      async () => {
        return this.performRequest<T>(request, requestId);
      },
      retryConfig,
      { 
        service: this.name, 
        operation: `${request.method}:${request.endpoint}` 
      }
    );

    if (!result.success) {
      throw result.error || new Error('Request failed after retries');
    }

    return result.result as APIResponse<T>;
  }

  /**
   * Perform the actual API request (to be implemented by subclasses)
   */
  protected abstract performRequest<T>(
    request: APIRequest,
    requestId: string
  ): Promise<APIResponse<T>>;

  /**
   * Perform authentication (to be implemented by subclasses)
   */
  protected abstract performAuthentication(credentials: AuthCredentials): Promise<void>;

  /**
   * Handle and standardize errors using error transformers
   * Subclasses can override this for service-specific handling
   */
  protected handleAPIError(error: unknown, request?: APIRequest): APIClientError {
    // Use error transformer to convert external errors to our unified system
    return ErrorTransformer.transform(error, {
      serviceName: this.name,
      endpoint: request?.endpoint,
      method: request?.method
    });
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Get authentication status
   */
  getAuthStatus(): { authenticated: boolean; credentialType?: string } {
    return {
      authenticated: this.authenticated,
      credentialType: this.authCredentials?.type
    };
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized;
      const details = {
        initialized: this.initialized,
        authenticated: this.authenticated,
        circuitBreakerState: 'unknown', // Circuit breaker state not exposed
        serviceName: this.name,
        baseUrl: this.config.baseUrl
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Implement a simple health check request
      const testRequest: APIRequest = {
        method: 'GET',
        endpoint: '/health',
        requiresAuth: false
      };

      await this.makeRequest(testRequest);
      return true;
    } catch (error) {
      this.logError('API connection test failed', error);
      return false;
    }
  }
}
