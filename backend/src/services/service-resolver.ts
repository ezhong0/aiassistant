/**
 * Enhanced Service Resolver with proper typing and error handling
 */

import { getService } from "./service-manager";

export interface ServiceResolverConfig {
  /** Whether to throw errors on service resolution failure */
  throwOnError?: boolean;
  /** Default timeout for service resolution */
  timeout?: number;
  /** Whether to log service resolution attempts */
  logResolution?: boolean;
}

export class ServiceResolver {
  private config: ServiceResolverConfig;

  constructor(config: ServiceResolverConfig = {}) {
    this.config = {
      throwOnError: true,
      timeout: 5000,
      logResolution: false,
      ...config
    };
  }

  /**
   * Resolve a service with proper typing and error handling
   */
  async resolve<T = any>(serviceName: string): Promise<T> {
    if (this.config.logResolution) {
      
    }

    try {
      const service = getService(serviceName) as T;
      
      if (!service) {
        const error = new Error(`Service '${serviceName}' not found`);
        
        if (this.config.throwOnError) {
          throw error;
        }
        
        return null as T;
      }

      if (this.config.logResolution) {
        
      }

      return service;
    } catch (error) {
      
      if (this.config.throwOnError) {
        throw error;
      }
      
      return null as T;
    }
  }

  /**
   * Resolve a service with fallback
   */
  async resolveWithFallback<T>(
    serviceName: string, 
    fallback: T
  ): Promise<T> {
    try {
      const service = await this.resolve<T>(serviceName);
      return service || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Resolve multiple services
   */
  async resolveMultiple<T extends Record<string, any>>(
    services: { [K in keyof T]: string }
  ): Promise<T> {
    const results = {} as T;
    
    for (const [key, serviceName] of Object.entries(services)) {
      try {
        results[key as keyof T] = await this.resolve(serviceName);
      } catch (error) {
        
        if (this.config.throwOnError) {
          throw error;
        }
      }
    }
    
    return results;
  }

  /**
   * Check if a service is available
   */
  isAvailable(serviceName: string): boolean {
    try {
      const service = getService(serviceName);
      return service !== null && service !== undefined;
    } catch {
      return false;
    }
  }
}

// Default service resolver instance
export const serviceResolver = new ServiceResolver({
  throwOnError: true,
  logResolution: process.env.NODE_ENV === 'development'
});

// Convenience functions for common services
export async function resolveGmailService() {
  return serviceResolver.resolve<any>('gmailService');
}

export async function resolveCalendarService() {
  return serviceResolver.resolve<any>('calendarService');
}

export async function resolveSlackService() {
  return serviceResolver.resolve<any>('slackService');
}

export async function resolveContactService() {
  return serviceResolver.resolve<any>('contactService');
}

export async function resolveOpenAIService() {
  return serviceResolver.resolve<any>('openaiService');
}
