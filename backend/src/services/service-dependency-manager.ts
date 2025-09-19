import { serviceManager, IService } from './service-manager';

export enum ServiceHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  DISABLED = 'disabled',
  UNKNOWN = 'unknown'
}

export interface ServiceHealthInfo {
  health: ServiceHealth;
  dependencies: Record<string, ServiceHealth>;
  capabilities: string[];
  limitations: string[];
  lastHealthCheck: Date;
}

/**
 * Service Dependency Manager
 *
 * A simpler approach that wraps the existing ServiceManager
 * with enhanced health monitoring and dependency tracking.
 */
export class ServiceDependencyManager {
  private static instance: ServiceDependencyManager;
  private serviceHealth = new Map<string, ServiceHealthInfo>();

  private constructor() {}

  static getInstance(): ServiceDependencyManager {
    if (!ServiceDependencyManager.instance) {
      ServiceDependencyManager.instance = new ServiceDependencyManager();
    }
    return ServiceDependencyManager.instance;
  }

  /**
   * Get service health information
   */
  getServiceHealth(serviceName: string): ServiceHealthInfo | undefined {
    // Update health info if not exists or stale
    const service = serviceManager.getService(serviceName);
    if (service) {
      const existingHealth = this.serviceHealth.get(serviceName);
      const now = new Date();

      // Update health if stale (older than 30 seconds) or doesn't exist
      if (!existingHealth || (now.getTime() - existingHealth.lastHealthCheck.getTime() > 30000)) {
        this.updateServiceHealth(serviceName, service);
      }
    }

    return this.serviceHealth.get(serviceName);
  }

  /**
   * Get all services health
   */
  getAllServicesHealth(): Record<string, ServiceHealthInfo> {
    const result: Record<string, ServiceHealthInfo> = {};

    // Update all service health
    for (const serviceName of serviceManager.getRegisteredServices()) {
      const health = this.getServiceHealth(serviceName);
      if (health) {
        result[serviceName] = health;
      }
    }

    return result;
  }

  /**
   * Comprehensive health check
   */
  async healthCheck(): Promise<{
    overall: ServiceHealth;
    services: Record<string, ServiceHealthInfo>;
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      disabled: number;
      total: number;
    };
  }> {
    const services = this.getAllServicesHealth();
    const summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      disabled: 0,
      total: Object.keys(services).length
    };

    for (const healthInfo of Object.values(services)) {
      switch (healthInfo.health) {
        case ServiceHealth.HEALTHY:
          summary.healthy++;
          break;
        case ServiceHealth.DEGRADED:
          summary.degraded++;
          break;
        case ServiceHealth.UNHEALTHY:
          summary.unhealthy++;
          break;
        case ServiceHealth.DISABLED:
          summary.disabled++;
          break;
      }
    }

    const overall = summary.unhealthy > 0
      ? ServiceHealth.UNHEALTHY
      : summary.degraded > 0
        ? ServiceHealth.DEGRADED
        : ServiceHealth.HEALTHY;

    return {
      overall,
      services,
      summary
    };
  }

  /**
   * Get service capabilities
   */
  getServiceCapabilities(serviceName: string): string[] {
    const health = this.getServiceHealth(serviceName);
    return health?.capabilities || [];
  }

  /**
   * Check if service has capability
   */
  hasServiceCapability(serviceName: string, capability: string): boolean {
    return this.getServiceCapabilities(serviceName).includes(capability);
  }

  /**
   * Get services with specific capability
   */
  getServicesWithCapability(capability: string): string[] {
    const services: string[] = [];

    for (const serviceName of serviceManager.getRegisteredServices()) {
      if (this.hasServiceCapability(serviceName, capability)) {
        services.push(serviceName);
      }
    }

    return services;
  }

  /**
   * Get a service instance (proxy to serviceManager)
   */
  getService<T = any>(serviceName: string): T | undefined {
    return serviceManager.getService(serviceName) as T | undefined;
  }

  /**
   * Get registered services (proxy to serviceManager)
   */
  getRegisteredServices(): string[] {
    return serviceManager.getRegisteredServices();
  }

  private updateServiceHealth(serviceName: string, service: IService): void {
    let health = ServiceHealth.HEALTHY;
    const capabilities: string[] = [];
    const limitations: string[] = [];
    const dependencies: Record<string, ServiceHealth> = {};

    // Determine health based on service state and readiness
    if (!service.isReady()) {
      health = ServiceHealth.UNHEALTHY;
      limitations.push('service_not_ready');
    } else {
      try {
        const serviceHealth = service.getHealth();
        if (!serviceHealth.healthy) {
          health = ServiceHealth.DEGRADED;
          limitations.push('health_check_failed');
        }
      } catch (error) {
        health = ServiceHealth.DEGRADED;
        limitations.push('health_check_error');
      }
    }

    // Service-specific capabilities and limitations
    capabilities.push(...this.getServiceSpecificCapabilities(serviceName, health));
    limitations.push(...this.getServiceSpecificLimitations(serviceName, health));

    this.serviceHealth.set(serviceName, {
      health,
      dependencies,
      capabilities,
      limitations,
      lastHealthCheck: new Date()
    });
  }

  private getServiceSpecificCapabilities(serviceName: string, health: ServiceHealth): string[] {
    const capabilities: string[] = [];

    switch (serviceName) {
      case 'databaseService':
        if (health === ServiceHealth.HEALTHY) {
          capabilities.push('persistent_storage', 'transactions', 'complex_queries');
        } else if (health === ServiceHealth.DEGRADED) {
          capabilities.push('in_memory_storage');
        }
        break;
      case 'emailService':
      case 'emailAgent':
        if (health === ServiceHealth.HEALTHY) {
          capabilities.push('authenticated_email', 'full_email_features');
        } else if (health === ServiceHealth.DEGRADED) {
          capabilities.push('basic_email_only');
        }
        break;
      case 'calendarService':
      case 'calendarAgent':
        if (health === ServiceHealth.HEALTHY) {
          capabilities.push('calendar_crud', 'event_notifications');
        } else if (health === ServiceHealth.DEGRADED) {
          capabilities.push('read_only_calendar');
        }
        break;
      case 'openaiService':
        if (health === ServiceHealth.HEALTHY) {
          capabilities.push('full_ai_features', 'text_generation', 'classification');
        } else if (health === ServiceHealth.DEGRADED) {
          capabilities.push('limited_ai_features');
        }
        break;
      default:
        if (health === ServiceHealth.HEALTHY) {
          capabilities.push('full_functionality');
        } else if (health === ServiceHealth.DEGRADED) {
          capabilities.push('limited_functionality');
        }
        break;
    }

    return capabilities;
  }

  private getServiceSpecificLimitations(serviceName: string, health: ServiceHealth): string[] {
    const limitations: string[] = [];

    if (health === ServiceHealth.DEGRADED) {
      limitations.push('reduced_functionality');
    } else if (health === ServiceHealth.UNHEALTHY) {
      limitations.push('service_unavailable');
    } else if (health === ServiceHealth.DISABLED) {
      limitations.push('service_disabled');
    }

    // Service-specific limitations
    switch (serviceName) {
      case 'databaseService':
        if (health === ServiceHealth.DEGRADED) {
          limitations.push('no_data_persistence', 'memory_only_storage');
        }
        break;
      case 'emailService':
      case 'emailAgent':
        if (health === ServiceHealth.DEGRADED) {
          limitations.push('no_authenticated_email');
        }
        break;
      case 'calendarService':
      case 'calendarAgent':
        if (health === ServiceHealth.DEGRADED) {
          limitations.push('no_event_modifications');
        }
        break;
    }

    return limitations;
  }
}

// Export singleton instance
export const serviceDependencyManager = ServiceDependencyManager.getInstance();