# API Client Standardization

This module provides a standardized foundation for all third-party API integrations in the application.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Email Agent │ │Calendar Agent│ │ Slack Agent │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Tool Layer                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Email Tools │ │Calendar Tools│ │ Slack Tools │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Domain Service Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │Email Service│ │Calendar Svc │ │ Slack Svc   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                API Client Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │Google Client│ │Slack Client │ │OpenAI Client│          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Base API Client                                │
│  • Authentication Management                               │
│  • Retry Logic & Circuit Breakers                         │
│  • Error Standardization                                  │
│  • Request/Response Logging                               │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### BaseAPIClient

Abstract base class that provides standardized patterns for all API clients:

- **Authentication Management**: OAuth2, API keys, bearer tokens
- **Request/Response Handling**: Standardized request/response format
- **Error Standardization**: Consistent error handling across all APIs
- **Retry Logic**: Configurable retry strategies with exponential backoff
- **Circuit Breaker**: Protection against cascading failures
- **Rate Limiting**: Built-in rate limiting support
- **Logging**: Comprehensive request/response logging
- **Health Monitoring**: Connection testing and health status

### APIClientFactory

Centralized factory for creating and managing API clients:

- **Client Registration**: Register new API client types
- **Instance Management**: Create and manage client instances
- **Configuration Management**: Merge default and service-specific configs
- **Health Monitoring**: Monitor health of all clients
- **Lifecycle Management**: Proper initialization and cleanup

### API Types

Comprehensive TypeScript interfaces for type safety:

- `APIClientConfig`: Configuration for API clients
- `APIRequest`: Standardized request format
- `APIResponse`: Standardized response format
- `APIError`: Standardized error format
- `AuthCredentials`: Authentication credential types

## Usage Examples

### 1. Register a New API Client

```typescript
import { APIClientFactory } from './api-client-factory';
import { GoogleAPIClient } from './clients/google-api-client';

// Register Google API client
apiClientFactory.registerClient('google', GoogleAPIClient, {
  baseUrl: 'https://www.googleapis.com',
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    baseDelay: 1000
  }
});
```

### 2. Create and Use a Client

```typescript
// Get a client instance
const googleClient = await apiClientFactory.getClient('google');

// Authenticate
await googleClient.authenticate({
  type: 'oauth2',
  accessToken: 'your-access-token'
});

// Make a request
const response = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/gmail/v1/users/me/messages',
  query: { maxResults: 10 }
});
```

### 3. Implement a Custom API Client

```typescript
import { BaseAPIClient } from './base-api-client';
import { APIRequest, APIResponse, APIError, AuthCredentials } from '../types/api-client.types';

class CustomAPIClient extends BaseAPIClient {
  constructor(config: APIClientConfig) {
    super('CustomAPIClient', config);
  }

  protected async performAuthentication(credentials: AuthCredentials): Promise<void> {
    // Implement custom authentication logic
    if (credentials.type === 'api_key') {
      // Set API key in headers
      this.config.defaultHeaders = {
        ...this.config.defaultHeaders,
        'X-API-Key': credentials.apiKey!
      };
    }
  }

  protected async performRequest<T>(
    request: APIRequest, 
    requestId: string
  ): Promise<APIResponse<T>> {
    // Implement custom request logic
    const url = `${this.config.baseUrl}${request.endpoint}`;
    
    const response = await fetch(url, {
      method: request.method,
      headers: {
        ...this.config.defaultHeaders,
        ...request.headers
      },
      body: request.data ? JSON.stringify(request.data) : undefined
    });

    const data = await response.json();

    return {
      data,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        executionTime: 0 // Will be calculated by base class
      }
    };
  }

  protected handleError(error: unknown, request?: APIRequest): APIError {
    // Implement custom error handling
    return this.createAPIError(
      'CUSTOM_API_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
      error
    );
  }
}
```

## Configuration

### Default Configuration

```typescript
const defaultConfig: APIClientConfig = {
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    strategy: 'exponential_backoff'
  },
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
    timeout: 30000
  }
};
```

### Service-Specific Configuration

```typescript
const serviceConfigs = {
  google: {
    baseUrl: 'https://www.googleapis.com',
    timeout: 45000, // Longer timeout for Google APIs
    retry: {
      maxAttempts: 5 // More retries for Google APIs
    }
  },
  slack: {
    baseUrl: 'https://slack.com/api',
    timeout: 15000, // Shorter timeout for Slack
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000 // 100 requests per minute
    }
  }
};
```

## Error Handling

All API clients use standardized error handling:

```typescript
try {
  const response = await client.makeRequest(request);
  // Handle success
} catch (error) {
  if (error.code === 'AUTHENTICATION_FAILED') {
    // Handle auth error
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limit
  } else if (error.category === 'network') {
    // Handle network errors
  }
}
```

## Health Monitoring

Monitor the health of all API clients:

```typescript
// Get health status
const health = await apiClientFactory.getHealthStatus();

// Test all connections
const connectionTests = await apiClientFactory.testAllConnections();

// Get individual client health
const googleClient = apiClientFactory.getClientInstance('google');
const clientHealth = googleClient?.client.getHealth();
```

## Migration Strategy

1. **Phase 1**: Create base infrastructure (✅ Complete)
2. **Phase 2**: Implement Google API client
3. **Phase 3**: Migrate Gmail and Calendar services
4. **Phase 4**: Implement Slack and OpenAI clients
5. **Phase 5**: Migrate remaining services
6. **Phase 6**: Remove old implementations

## Benefits

- **Consistency**: All APIs follow the same patterns
- **Reliability**: Built-in retry logic and circuit breakers
- **Maintainability**: Centralized configuration and error handling
- **Type Safety**: Comprehensive TypeScript interfaces
- **Monitoring**: Built-in health checks and logging
- **Scalability**: Easy to add new API integrations
