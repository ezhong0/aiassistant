import { apiClientFactory } from './api-client-factory';
import { GoogleAPIClient, SlackAPIClient, OpenAIClient } from './clients';

/**
 * API Client Registry - Centralized registration of all API clients
 * 
 * This module registers all API client implementations with the factory,
 * providing default configurations and ensuring consistent setup across
 * the application.
 */

/**
 * Register all API clients with the factory
 */
export function registerAllAPIClients(): void {
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

  // Register Slack API client
  apiClientFactory.registerClient('slack', SlackAPIClient, {
    baseUrl: 'https://slack.com/api',
    timeout: 15000, // Shorter timeout for Slack
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      strategy: 'EXPONENTIAL_BACKOFF'
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      successThreshold: 2,
      timeout: 15000
    },
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000, // 100 requests per minute
      queueRequests: true
    },
    defaultHeaders: {
      'Content-Type': 'application/json',
      'User-Agent': 'AssistantApp/1.0'
    }
  });

  // Register OpenAI API client
  apiClientFactory.registerClient('openai', OpenAIClient, {
    baseUrl: 'https://api.openai.com/v1',
    timeout: 60000, // Longer timeout for AI requests
    retry: {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffMultiplier: 2,
      jitter: true,
      strategy: 'EXPONENTIAL_BACKOFF'
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 120000, // 2 minutes for AI services
      successThreshold: 2,
      timeout: 60000
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
 */
export async function getAPIClient<T = any>(name: string, configOverride?: any): Promise<T> {
  return apiClientFactory.getClient<T>(name, configOverride);
}

/**
 * Check if an API client is registered
 */
export function isAPIClientRegistered(name: string): boolean {
  return apiClientFactory.isClientRegistered(name);
}

/**
 * Get all registered API client names
 */
export function getRegisteredAPIClients(): string[] {
  return apiClientFactory.getRegisteredClients();
}

/**
 * Get API client health status
 */
export async function getAPIClientHealth(): Promise<any> {
  return apiClientFactory.getHealthStatus();
}

/**
 * Test all API client connections
 */
export async function testAllAPIConnections(): Promise<Record<string, boolean>> {
  return apiClientFactory.testAllConnections();
}

// Auto-register all clients when this module is imported
registerAllAPIClients();
