/**
 * Enhanced Domain Service Factory
 * 
 * ⚠️ DEPRECATED: This singleton factory pattern is being phased out in favor of proper DI.
 * 
 * **Why this is deprecated:**
 * - Creates services outside the DI container (bypasses lifecycle management)
 * - Uses `new` operator directly (prevents dependency injection)
 * - Singleton pattern creates global mutable state
 * - Makes testing difficult (can't inject mocks)
 * - Doesn't support constructor injection
 * 
 * **Migration path:**
 * Instead of:
 * ```typescript
 * const emailService = domainServiceFactory.createEmailService();
 * ```
 * 
 * Use DI container:
 * ```typescript
 * const emailService = container.resolve('emailDomainService');
 * ```
 * 
 * Or in routes/middleware:
 * ```typescript
 * export function createMyRoutes(container: AppContainer) {
 *   const emailService = container.resolve('emailDomainService');
 *   // use emailService
 * }
 * ```
 * 
 * @deprecated Use DI container (container.resolve('serviceName')) instead
 */

import { IEmailDomainService } from '../interfaces/email-domain.interface';
import { ICalendarDomainService } from '../interfaces/calendar-domain.interface';
import { IContactsDomainService } from '../interfaces/contacts-domain.interface';
import { ISlackDomainService } from '../interfaces/slack-domain.interface';
import { IAIDomainService } from '../interfaces/ai-domain.interface';
import { config } from '../../../config';
import logger from '../../../utils/logger';

/**
 * Service factory configuration
 */
export interface ServiceFactoryConfig {
  enableCaching?: boolean;
  enableHealthChecks?: boolean;
  enableMetrics?: boolean;
  environment?: 'production' | 'development' | 'test';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Service factory result
 */
export interface ServiceFactoryResult<T> {
  service: T;
  metadata: {
    createdAt: Date;
    config: ServiceFactoryConfig;
    serviceName: string;
    version: string;
  };
}

/**
 * Enhanced Domain Service Factory
 * Integrates with unified config system and provides advanced service creation patterns
 */
export class DomainServiceFactory {
  private static instance: DomainServiceFactory;
  private serviceCache = new Map<string, any>();
  private readonly defaultConfig: ServiceFactoryConfig;

  private constructor() {
    // Use unified config to set defaults
    this.defaultConfig = {
      enableCaching: true,
      enableHealthChecks: true,
      enableMetrics: config.isProduction,
      environment: config.nodeEnv as any,
      logLevel: config.logLevel as any
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DomainServiceFactory {
    if (!DomainServiceFactory.instance) {
      DomainServiceFactory.instance = new DomainServiceFactory();
    }
    return DomainServiceFactory.instance;
  }

  /**
   * Create email domain service with factory pattern
   */
  createEmailService(
    factoryConfig: Partial<ServiceFactoryConfig> = {}
  ): ServiceFactoryResult<IEmailDomainService> {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    const serviceName = 'EmailDomainService';
    
    // Check cache if enabled
    if (finalConfig.enableCaching && this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    try {
      const { EmailDomainService } = require('../email-domain.service');
      const service = new EmailDomainService();

      const result: ServiceFactoryResult<IEmailDomainService> = {
        service,
        metadata: {
          createdAt: new Date(),
          config: finalConfig,
          serviceName,
          version: '1.0.0'
        }
      };

      // Cache if enabled
      if (finalConfig.enableCaching) {
        this.serviceCache.set(serviceName, result);
      }

      this.logServiceCreation(serviceName, finalConfig);
      return result;

    } catch (error) {
      this.logServiceCreationError(serviceName, error);
      throw error;
    }
  }

  /**
   * Create calendar domain service with factory pattern
   */
  createCalendarService(
    factoryConfig: Partial<ServiceFactoryConfig> = {}
  ): ServiceFactoryResult<ICalendarDomainService> {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    const serviceName = 'CalendarDomainService';
    
    if (finalConfig.enableCaching && this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    try {
      const { CalendarDomainService } = require('../calendar-domain.service');
      const service = new CalendarDomainService();

      const result: ServiceFactoryResult<ICalendarDomainService> = {
        service,
        metadata: {
          createdAt: new Date(),
          config: finalConfig,
          serviceName,
          version: '1.0.0'
        }
      };

      if (finalConfig.enableCaching) {
        this.serviceCache.set(serviceName, result);
      }

      this.logServiceCreation(serviceName, finalConfig);
      return result;

    } catch (error) {
      this.logServiceCreationError(serviceName, error);
      throw error;
    }
  }

  /**
   * Create contacts domain service with factory pattern
   */
  createContactsService(
    factoryConfig: Partial<ServiceFactoryConfig> = {}
  ): ServiceFactoryResult<IContactsDomainService> {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    const serviceName = 'ContactsDomainService';
    
    if (finalConfig.enableCaching && this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    try {
      const { ContactsDomainService } = require('../contacts-domain.service');
      const service = new ContactsDomainService();

      const result: ServiceFactoryResult<IContactsDomainService> = {
        service,
        metadata: {
          createdAt: new Date(),
          config: finalConfig,
          serviceName,
          version: '1.0.0'
        }
      };

      if (finalConfig.enableCaching) {
        this.serviceCache.set(serviceName, result);
      }

      this.logServiceCreation(serviceName, finalConfig);
      return result;

    } catch (error) {
      this.logServiceCreationError(serviceName, error);
      throw error;
    }
  }

  /**
   * Create Slack domain service with factory pattern
   */
  createSlackService(
    factoryConfig: Partial<ServiceFactoryConfig> = {}
  ): ServiceFactoryResult<ISlackDomainService> {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    const serviceName = 'SlackDomainService';
    
    if (finalConfig.enableCaching && this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    try {
      const { SlackDomainService } = require('../slack-domain.service');
      const service = new SlackDomainService();

      const result: ServiceFactoryResult<ISlackDomainService> = {
        service,
        metadata: {
          createdAt: new Date(),
          config: finalConfig,
          serviceName,
          version: '1.0.0'
        }
      };

      if (finalConfig.enableCaching) {
        this.serviceCache.set(serviceName, result);
      }

      this.logServiceCreation(serviceName, finalConfig);
      return result;

    } catch (error) {
      this.logServiceCreationError(serviceName, error);
      throw error;
    }
  }

  /**
   * Create AI domain service with factory pattern
   */
  createAIService(
    factoryConfig: Partial<ServiceFactoryConfig> = {}
  ): ServiceFactoryResult<IAIDomainService> {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    const serviceName = 'AIDomainService';
    
    if (finalConfig.enableCaching && this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    try {
      const { AIDomainService } = require('../ai-domain.service');
      const service = new AIDomainService();

      const result: ServiceFactoryResult<IAIDomainService> = {
        service,
        metadata: {
          createdAt: new Date(),
          config: finalConfig,
          serviceName,
          version: '1.0.0'
        }
      };

      if (finalConfig.enableCaching) {
        this.serviceCache.set(serviceName, result);
      }

      this.logServiceCreation(serviceName, finalConfig);
      return result;

    } catch (error) {
      this.logServiceCreationError(serviceName, error);
      throw error;
    }
  }

  /**
   * Generic service creation method
   */
  createService<T>(
    serviceName: string,
    factoryFunction: () => T,
    factoryConfig: Partial<ServiceFactoryConfig> = {}
  ): ServiceFactoryResult<T> {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    
    if (finalConfig.enableCaching && this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    try {
      const service = factoryFunction();

      const result: ServiceFactoryResult<T> = {
        service,
        metadata: {
          createdAt: new Date(),
          config: finalConfig,
          serviceName,
          version: '1.0.0'
        }
      };

      if (finalConfig.enableCaching) {
        this.serviceCache.set(serviceName, result);
      }

      this.logServiceCreation(serviceName, finalConfig);
      return result;

    } catch (error) {
      this.logServiceCreationError(serviceName, error);
      throw error;
    }
  }

  /**
   * Batch create multiple services
   */
  createMultipleServices(
    serviceSpecs: Array<{
      name: string;
      factory: () => any;
      config?: Partial<ServiceFactoryConfig>;
    }>
  ): Map<string, ServiceFactoryResult<any>> {
    const results = new Map<string, ServiceFactoryResult<any>>();

    for (const spec of serviceSpecs) {
      try {
        const result = this.createService(spec.name, spec.factory, spec.config);
        results.set(spec.name, result);
      } catch (error) {
        logger.error(`Failed to create service: ${spec.name}`, error as Error, {
          correlationId: 'service-factory',
          operation: 'batch_service_creation'
        });
        // Continue with other services
      }
    }

    logger.info('Batch service creation completed', {
      correlationId: 'service-factory',
      operation: 'batch_service_creation',
      metadata: {
        total: serviceSpecs.length,
        successful: results.size,
        failed: serviceSpecs.length - results.size
      }
    });

    return results;
  }

  /**
   * Clear service cache
   */
  clearCache(): void {
    this.serviceCache.clear();
    logger.debug('Service factory cache cleared', {
      correlationId: 'service-factory',
      operation: 'cache_clear'
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.serviceCache.size,
      keys: Array.from(this.serviceCache.keys())
    };
  }

  /**
   * Log service creation
   */
  private logServiceCreation(serviceName: string, config: ServiceFactoryConfig): void {
    logger.debug(`Service created: ${serviceName}`, {
      correlationId: 'service-factory',
      operation: 'service_creation',
      metadata: {
        serviceName,
        config,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log service creation error
   */
  private logServiceCreationError(serviceName: string, error: unknown): void {
    logger.error(`Failed to create service: ${serviceName}`, error as Error, {
      correlationId: 'service-factory',
      operation: 'service_creation_error',
      metadata: { serviceName }
    });
  }
}

/**
 * Export singleton instance
 */
export const domainServiceFactory = DomainServiceFactory.getInstance();

/**
 * Convenience functions for quick service creation
 */
export const ServiceCreators = {
  /**
   * Create email service with default config
   */
  createEmailService: () => domainServiceFactory.createEmailService().service,

  /**
   * Create calendar service with default config
   */
  createCalendarService: () => domainServiceFactory.createCalendarService().service,

  /**
   * Create contacts service with default config
   */
  createContactsService: () => domainServiceFactory.createContactsService().service,

  /**
   * Create Slack service with default config
   */
  createSlackService: () => domainServiceFactory.createSlackService().service,

  /**
   * Create AI service with default config
   */
  createAIService: () => domainServiceFactory.createAIService().service,

  /**
   * Create all services
   */
  createAllServices: () => {
    return {
      emailService: ServiceCreators.createEmailService(),
      calendarService: ServiceCreators.createCalendarService(),
      contactsService: ServiceCreators.createContactsService(),
      slackService: ServiceCreators.createSlackService(),
      aiService: ServiceCreators.createAIService()
    };
  }
};
