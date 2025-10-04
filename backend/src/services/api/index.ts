/**
 * API Services - Standardized third-party API integration layer
 * 
 * This module exports the core components for standardized API client management:
 * - BaseAPIClient: Abstract base class for all API clients
 * - APIClientFactory: Centralized client creation and management
 * - API Clients: Specific implementations for Google, Slack, OpenAI
 * - API Registry: Centralized registration and management
 * - API Types: TypeScript interfaces and types
 */

export { BaseAPIClient } from './base-api-client';
export { APIClientFactory } from './api-client-factory';

// Export specific API clients
export { GoogleAPIClient, OpenAIClient } from './clients';

// Export registry functions
export {
  registerAllAPIClients,
  getAPIClient,
  isAPIClientRegistered,
  getRegisteredAPIClients,
  getAPIClientHealth,
  testAllAPIConnections
} from './api-client-registry';

// Re-export types for convenience
export type {
  APIClientConfig,
  APIRequest,
  APIResponse,
  APIError,
  AuthCredentials,
  APIClientFactoryConfig,
  APIClientInstance,
  APIHealthStatus
} from '../../types/api/api-client.types';
