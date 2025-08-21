import { serviceManager } from './service-manager';
import { SessionService } from './session.service';
import { ToolExecutorService } from './tool-executor.service';
import { AuthService } from './auth.service';
import { ContactService } from './contact.service';
import { GmailService } from './gmail.service';
import { OpenAIService } from './openai.service';
import logger from '../utils/logger';

/**
 * Service registry for managing all application services
 * Handles service initialization, dependency injection, and lifecycle management
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, any> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Initialize all services with proper dependency injection
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Service registry already initialized');
      return;
    }

    try {
      logger.info('Initializing service registry...');

      // Register core services with dependencies
      await this.registerCoreServices();

      // Initialize all services in dependency order
      await serviceManager.initializeAllServices();

      this.initialized = true;
      logger.info('Service registry initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize service registry:', error);
      throw error;
    }
  }

  /**
   * Register core services with their dependencies
   */
  private async registerCoreServices(): Promise<void> {
    try {
      // 1. SessionService - No dependencies, highest priority
      const sessionService = new SessionService();
      serviceManager.registerService('sessionService', sessionService, {
        priority: 10,
        autoStart: true
      });
      this.services.set('sessionService', sessionService);

      // 2. ToolExecutorService - Depends on sessionService
      const toolExecutorService = new ToolExecutorService();
      serviceManager.registerService('toolExecutorService', toolExecutorService, {
        dependencies: ['sessionService'],
        priority: 20,
        autoStart: true
      });
      this.services.set('toolExecutorService', toolExecutorService);

      // 3. AuthService - No external dependencies
      const authService = new AuthService();
      serviceManager.registerService('authService', authService, {
        priority: 30,
        autoStart: true
      });
      this.services.set('authService', authService);

      // 4. ContactService - Depends on authService
      const contactService = new ContactService();
      serviceManager.registerService('contactService', contactService, {
        dependencies: ['authService'],
        priority: 40,
        autoStart: true
      });
      this.services.set('contactService', contactService);

      // 5. GmailService - Depends on authService
      const gmailService = new GmailService();
      serviceManager.registerService('gmailService', gmailService, {
        dependencies: ['authService'],
        priority: 50,
        autoStart: true
      });
      this.services.set('gmailService', gmailService);

      // 6. OpenAIService - No external dependencies
      const openaiService = new OpenAIService({
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
      });
      serviceManager.registerService('openaiService', openaiService, {
        priority: 60,
        autoStart: true
      });
      this.services.set('openaiService', openaiService);

      logger.info('Core services registered successfully', {
        serviceCount: this.services.size,
        serviceNames: Array.from(this.services.keys())
      });

    } catch (error) {
      logger.error('Failed to register core services:', error);
      throw error;
    }
  }

  /**
   * Get a service by name
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /**
   * Get all registered services
   */
  getAllServices(): Map<string, any> {
    return new Map(this.services);
  }

  /**
   * Get service health status
   */
  getServicesHealth(): Record<string, any> {
    return serviceManager.getAllServicesHealth();
  }

  /**
   * Check if all services are healthy
   */
  areAllServicesHealthy(): boolean {
    const health = this.getServicesHealth();
    return Object.values(health).every(service => service.healthy);
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    readyServices: number;
    initializingServices: number;
    errorServices: number;
  } {
    const health = this.getServicesHealth();
    const services = Object.values(health);

    return {
      totalServices: services.length,
      healthyServices: services.filter(s => s.healthy).length,
      unhealthyServices: services.filter(s => !s.healthy).length,
      readyServices: services.filter(s => s.state === 'ready').length,
      initializingServices: services.filter(s => s.state === 'initializing').length,
      errorServices: services.filter(s => s.state === 'error').length
    };
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      logger.debug('Service registry not initialized, nothing to shutdown');
      return;
    }

    try {
      logger.info('Shutting down service registry...');
      
      // ServiceManager will handle graceful shutdown of all services
      // This is triggered by process signals (SIGTERM, SIGINT)
      
      this.initialized = false;
      this.services.clear();
      
      logger.info('Service registry shutdown completed');
    } catch (error) {
      logger.error('Error during service registry shutdown:', error);
      throw error;
    }
  }

  /**
   * Force cleanup of all services (for testing)
   */
  async forceCleanup(): Promise<void> {
    try {
      logger.warn('Force cleanup of service registry requested');
      
      await serviceManager.forceCleanup();
      this.services.clear();
      this.initialized = false;
      
      logger.info('Service registry force cleanup completed');
    } catch (error) {
      logger.error('Error during force cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();

// Convenience function to initialize services
export async function initializeServices(): Promise<void> {
  return serviceRegistry.initialize();
}

// Convenience function to get a service
export function getService<T>(name: string): T | undefined {
  return serviceRegistry.getService<T>(name);
}

// Convenience function to check service health
export function getServicesHealth(): Record<string, any> {
  return serviceRegistry.getServicesHealth();
}
