import { APIClientFactory } from './api-client-factory';
import { GoogleAPIClient, OpenAIClient } from './clients';

/**
 * API Client Registry - Centralized registration of all API clients
 *
 * This module registers all API client implementations with the factory,
 * providing default configurations and ensuring consistent setup across
 * the application.
 */

/**
 * Register all API clients with the factory
 * This is now called from DI container setup instead of module import
 */
export function registerAllAPIClients(apiClientFactory: APIClientFactory): void {
  // Register Google API client (Gmail, Calendar, Contacts)
  apiClientFactory.registerClient('google', GoogleAPIClient, {
    baseUrl: 'https://www.googleapis.com',
    timeout: 45000, // Longer timeout for Google APIs
    retry: {
      maxAttempts: 5, // More retries for Google APIs
      baseDelay: 1000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitter: true,
      strategy: 'EXPONENTIAL_BACKOFF'
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 3,
      timeout: 45000
    },
    defaultHeaders: {
      'Content-Type': 'application/json',
      'User-Agent': 'AssistantApp/1.0'
    }
  });

  // Register OpenAI API client
  // Note: E2E_TESTING is a test-specific env var, acceptable to read directly
  const e2eTesting = process.env.E2E_TESTING === 'true';
  const openAITimeout = e2eTesting ? 300000 : 60000; // 5 min for E2E, 1 min otherwise

  apiClientFactory.registerClient('openai', OpenAIClient, {
    baseUrl: 'https://api.openai.com/v1',
    timeout: openAITimeout,
    retry: {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffMultiplier: 2,
      jitter: true,
      strategy: 'EXPONENTIAL_BACKOFF'
    },
    circuitBreaker: {
      failureThreshold: e2eTesting ? 10000 : 3,
      recoveryTimeout: 120000, // 2 minutes for AI services
      successThreshold: 2,
      timeout: openAITimeout
    },
    rateLimit: {
      maxRequests: 50,
      windowMs: 60000, // 50 requests per minute for OpenAI
      queueRequests: true
    },
    defaultHeaders: {
      'Content-Type': 'application/json',
      'User-Agent': 'AssistantApp/1.0'
    }
  });
}

/**
 * Get a registered API client instance
 * NOTE: Prefer using DI-injected clients over this utility function
 */
export async function getAPIClient<T = any>(
  apiClientFactory: APIClientFactory,
  name: string,
  configOverride?: any
): Promise<T> {
  return apiClientFactory.getClient<T>(name, configOverride);
}

/**
 * Check if an API client is registered
 */
export function isAPIClientRegistered(apiClientFactory: APIClientFactory, name: string): boolean {
  return apiClientFactory.isClientRegistered(name);
}

/**
 * Get all registered API client names
 */
export function getRegisteredAPIClients(apiClientFactory: APIClientFactory): string[] {
  return apiClientFactory.getRegisteredClients();
}

/**
 * Get API client health status
 */
export async function getAPIClientHealth(apiClientFactory: APIClientFactory): Promise<any> {
  return apiClientFactory.getHealthStatus();
}

/**
 * Test all API client connections
 */
export async function testAllAPIConnections(apiClientFactory: APIClientFactory): Promise<Record<string, boolean>> {
  return apiClientFactory.testAllConnections();
}
