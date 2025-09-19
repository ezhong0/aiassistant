import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/enhanced-validation.middleware';
import { getEnhancedServiceManager, getServiceHealthReport } from '../services/service-initialization';
import { ServiceHealth } from '../services/service-dependency-manager';

const router = express.Router();

/**
 * Enhanced health endpoints for detailed service monitoring
 *
 * These routes provide comprehensive service health information
 * including dependencies, capabilities, and operational recommendations.
 */

/**
 * GET /health/services - Detailed service health report
 */
router.get('/services',
  validateRequest({ query: z.object({}) }),
  async (req: Request, res: Response) => {
    try {
      const healthReport = await getServiceHealthReport();

      res.json({
        success: true,
        data: healthReport,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      

      res.status(503).json({
        success: false,
        error: 'Service health check failed',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /health/services/:serviceName - Individual service health
 */
router.get('/services/:serviceName',
  validateRequest({
    params: z.object({
      serviceName: z.string().min(1, 'Service name is required')
    }),
    query: z.object({})
  }),
  async (req: Request, res: Response) => {
    try {
      const { serviceName } = req.validatedParams as { serviceName: string };
      const serviceManager = getEnhancedServiceManager();

      const serviceHealth = serviceManager.getServiceHealth(serviceName);
      const service = serviceManager.getService(serviceName);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
          serviceName,
          availableServices: serviceManager.getRegisteredServices(),
          timestamp: new Date().toISOString()
        });
      }

      const capabilities = serviceManager.getServiceCapabilities(serviceName);
      let baseHealth;
      try {
        baseHealth = (service as any).getHealth?.() || { healthy: false, details: 'No health method available' };
      } catch (error) {
        baseHealth = { healthy: false, details: 'Health check failed' };
      }

      return res.json({
        success: true,
        data: {
          serviceName,
          health: serviceHealth?.health || ServiceHealth.UNKNOWN,
          ready: (service as any).isReady?.() || false,
          state: (service as any).state || 'unknown',
          capabilities,
          dependencies: serviceHealth?.dependencies || {},
          limitations: serviceHealth?.limitations || [],
          lastHealthCheck: serviceHealth?.lastHealthCheck || new Date(),
          baseHealth,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      

      return res.status(503).json({
        success: false,
        error: 'Service health check failed',
        serviceName: req.params.serviceName,
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /health/dependencies - Service dependency graph
 */
router.get('/dependencies',
  validateRequest({ query: z.object({}) }),
  async (req: Request, res: Response) => {
    try {
      const serviceManager = getEnhancedServiceManager();
      const healthReport = await getServiceHealthReport();

      // Build dependency graph
      const dependencyGraph: Record<string, {
        dependencies: string[];
        dependents: string[];
        health: ServiceHealth;
        capabilities: string[];
      }> = {};

      // Get all services and their dependencies
      for (const [serviceName, serviceHealth] of Object.entries(healthReport.services)) {
        const capabilities = serviceManager.getServiceCapabilities(serviceName);

        dependencyGraph[serviceName] = {
          dependencies: Object.keys(serviceHealth.dependencies),
          dependents: [], // Will be filled in next step
          health: serviceHealth.health,
          capabilities
        };
      }

      // Fill in dependents (reverse dependencies)
      for (const [serviceName, serviceInfo] of Object.entries(dependencyGraph)) {
        for (const dependency of serviceInfo.dependencies) {
          if (dependencyGraph[dependency]) {
            dependencyGraph[dependency].dependents.push(serviceName);
          }
        }
      }

      res.json({
        success: true,
        data: {
          dependencyGraph,
          summary: {
            totalServices: Object.keys(dependencyGraph).length,
            rootServices: Object.entries(dependencyGraph)
              .filter(([, info]) => info.dependencies.length === 0)
              .map(([name]) => name),
            leafServices: Object.entries(dependencyGraph)
              .filter(([, info]) => info.dependents.length === 0)
              .map(([name]) => name),
            criticalPaths: findCriticalPaths(dependencyGraph)
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      

      res.status(503).json({
        success: false,
        error: 'Dependency graph generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /health/capabilities - Service capabilities overview
 */
router.get('/capabilities',
  validateRequest({ query: z.object({}) }),
  async (req: Request, res: Response) => {
    try {
      const serviceManager = getEnhancedServiceManager();
      const healthReport = await getServiceHealthReport();

      // Build capability matrix
      const capabilityMatrix: Record<string, {
        services: string[];
        healthStatus: Record<string, ServiceHealth>;
        totalServices: number;
        healthyServices: number;
        description?: string;
      }> = {};

      // Collect all capabilities
      for (const [serviceName] of Object.entries(healthReport.services)) {
        const capabilities = serviceManager.getServiceCapabilities(serviceName);
        const serviceHealth = healthReport.services[serviceName];

        for (const capability of capabilities) {
          if (!capabilityMatrix[capability]) {
            capabilityMatrix[capability] = {
              services: [],
              healthStatus: {},
              totalServices: 0,
              healthyServices: 0,
              description: getCapabilityDescription(capability)
            };
          }

          capabilityMatrix[capability].services.push(serviceName);
          capabilityMatrix[capability].healthStatus[serviceName] = serviceHealth.health;
          capabilityMatrix[capability].totalServices++;

          if (serviceHealth.health === ServiceHealth.HEALTHY) {
            capabilityMatrix[capability].healthyServices++;
          }
        }
      }

      // Calculate capability availability
      const capabilityAvailability = Object.entries(capabilityMatrix).map(([capability, info]) => ({
        capability,
        availability: info.totalServices > 0 ? (info.healthyServices / info.totalServices) * 100 : 0,
        services: info.services,
        status: info.healthyServices === info.totalServices ? 'fully_available' :
                info.healthyServices > 0 ? 'partially_available' : 'unavailable'
      }));

      res.json({
        success: true,
        data: {
          capabilityMatrix,
          capabilityAvailability: capabilityAvailability.sort((a, b) => b.availability - a.availability),
          summary: {
            totalCapabilities: Object.keys(capabilityMatrix).length,
            fullyAvailable: capabilityAvailability.filter(c => c.status === 'fully_available').length,
            partiallyAvailable: capabilityAvailability.filter(c => c.status === 'partially_available').length,
            unavailable: capabilityAvailability.filter(c => c.status === 'unavailable').length
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      

      res.status(503).json({
        success: false,
        error: 'Capability analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /health/services/:serviceName/check - Force health check for specific service
 */
router.post('/services/:serviceName/check',
  validateRequest({
    params: z.object({
      serviceName: z.string().min(1, 'Service name is required')
    }),
    query: z.object({}),
    body: z.object({})
  }),
  async (req: Request, res: Response) => {
    try {
      const { serviceName } = req.validatedParams as { serviceName: string };
      const serviceManager = getEnhancedServiceManager();

      const service = serviceManager.getService(serviceName);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
          serviceName,
          availableServices: serviceManager.getRegisteredServices(),
          timestamp: new Date().toISOString()
        });
      }

      // Force health check
      const startTime = Date.now();
      let healthCheckResult;

      try {
        healthCheckResult = (service as any).getHealth?.() || { healthy: false, details: 'No health method available' };
      } catch (error) {
        healthCheckResult = {
          healthy: false,
          details: {
            error: error instanceof Error ? error.message : 'Health check failed'
          }
        };
      }

      const responseTime = Date.now() - startTime;

      // Get enhanced health info
      const serviceHealth = serviceManager.getServiceHealth(serviceName);
      const capabilities = serviceManager.getServiceCapabilities(serviceName);

      return res.json({
        success: true,
        data: {
          serviceName,
          healthCheck: healthCheckResult,
          enhancedHealth: serviceHealth,
          capabilities,
          responseTime,
          ready: (service as any).isReady?.() || false,
          state: (service as any).state || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      

      return res.status(503).json({
        success: false,
        error: 'Forced health check failed',
        serviceName: req.params.serviceName,
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Helper functions

function findCriticalPaths(dependencyGraph: Record<string, any>): string[][] {
  const criticalPaths: string[][] = [];

  // Find services with the most dependents (critical bottlenecks)
  const sortedByDependents = Object.entries(dependencyGraph)
    .sort(([, a], [, b]) => b.dependents.length - a.dependents.length)
    .slice(0, 3); // Top 3 critical services

  for (const [serviceName, serviceInfo] of sortedByDependents) {
    if (serviceInfo.dependents.length > 0) {
      criticalPaths.push([serviceName, ...serviceInfo.dependents]);
    }
  }

  return criticalPaths;
}

function getCapabilityDescription(capability: string): string {
  const descriptions: Record<string, string> = {
    'full_functionality': 'Service operating with all features available',
    'limited_functionality': 'Service operating with reduced feature set',
    'authenticated_email': 'Email operations with user authentication',
    'basic_email_only': 'Basic email operations without authentication',
    'full_email_features': 'Complete email functionality including attachments and formatting',
    'calendar_crud': 'Full calendar event management (create, read, update, delete)',
    'event_notifications': 'Calendar event notifications and reminders',
    'read_only_calendar': 'Calendar viewing without modification capabilities',
    'persistent_storage': 'Data persistence to permanent storage',
    'in_memory_storage': 'Temporary data storage in memory only',
    'transactions': 'Database transaction support',
    'complex_queries': 'Advanced database query capabilities'
  };

  return descriptions[capability] || `Service capability: ${capability}`;
}

export default router;