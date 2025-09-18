import { serviceManager } from './service-manager';
import { serviceDependencyManager, ServiceHealth } from './service-dependency-manager';
import { initializeAllCoreServices } from './service-initialization';
import logger from '../utils/logger';

/**
 * Enhanced service registration and initialization
 *
 * This module replaces the original service-initialization.ts with
 * enhanced dependency management, fallback strategies, and mock services.
 *
 * Key improvements:
 * - Environment-aware service registration
 * - Dependency specifications with health checks
 * - Mock service providers for development/testing
 * - Graceful degradation strategies
 */

/**
 * Initialize all services with enhanced monitoring
 */
export async function initializeAllCoreServicesEnhanced(): Promise<void> {
  try {
    logger.info('Starting enhanced service initialization...');

    // Use the existing service initialization
    await initializeAllCoreServices();

    // Log final service health using dependency manager
    const healthCheck = await serviceDependencyManager.healthCheck();

    logger.info('Enhanced service initialization completed', {
      overall: healthCheck.overall,
      summary: healthCheck.summary,
      environment: process.env.NODE_ENV
    });

    // Log degraded services for awareness
    const degradedServices = Object.entries(healthCheck.services)
      .filter(([, health]) => health.health === ServiceHealth.DEGRADED)
      .map(([name, health]) => ({
        name,
        capabilities: health.capabilities,
        limitations: health.limitations
      }));

    if (degradedServices.length > 0) {
      logger.warn('Services running in degraded mode', { degradedServices });
    }

    // Log disabled services
    const disabledServices = Object.entries(healthCheck.services)
      .filter(([, health]) => health.health === ServiceHealth.DISABLED)
      .map(([name]) => name);

    if (disabledServices.length > 0) {
      logger.info('Disabled services', { disabledServices });
    }

  } catch (error) {
    logger.error('Enhanced service initialization failed:', error);

    // Try to get partial health information
    try {
      const healthCheck = await serviceDependencyManager.healthCheck();
      logger.error('Service states at failure', {
        healthy: healthCheck.summary.healthy,
        degraded: healthCheck.summary.degraded,
        unhealthy: healthCheck.summary.unhealthy
      });
    } catch (healthError) {
      logger.error('Could not retrieve service health information:', healthError);
    }

    throw error;
  }
}

// Utility functions for service management

export function getEnhancedServiceManager() {
  return serviceDependencyManager;
}

export async function getServiceHealthReport(): Promise<{
  timestamp: string;
  environment: string;
  overall: ServiceHealth;
  services: Record<string, any>;
  capabilities: Record<string, string[]>;
  recommendations: string[];
}> {
  const healthCheck = await serviceDependencyManager.healthCheck();

  // Generate capability map
  const capabilities: Record<string, string[]> = {};
  for (const [serviceName] of Object.entries(healthCheck.services)) {
    capabilities[serviceName] = serviceDependencyManager.getServiceCapabilities(serviceName);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (healthCheck.summary.degraded > 0) {
    recommendations.push(`${healthCheck.summary.degraded} service(s) running in degraded mode - check dependencies`);
  }

  if (healthCheck.summary.unhealthy > 0) {
    recommendations.push(`${healthCheck.summary.unhealthy} service(s) unhealthy - immediate attention required`);
  }

  if (process.env.NODE_ENV === 'production' && healthCheck.overall !== ServiceHealth.HEALTHY) {
    recommendations.push('Production environment has non-healthy services - review configuration');
  }

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    overall: healthCheck.overall,
    services: healthCheck.services,
    capabilities,
    recommendations
  };
}

// Backward compatibility function - renamed to avoid conflicts
export async function initializeAllCoreServicesLegacy(): Promise<void> {
  logger.info('Legacy service initialization called - redirecting to enhanced initialization');
  return initializeAllCoreServicesEnhanced();
}