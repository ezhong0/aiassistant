import express, { Request, Response } from 'express';
import { z } from 'zod';
import { HealthCheckResponse, ServiceStatus } from '../types/api/api.types';
import { rateLimitStore } from '../middleware/rate-limiting.middleware';
import { HealthCheckSchema } from '../schemas/api.schemas';
import { validateRequest } from '../middleware/enhanced-validation.middleware';
import { getEnhancedServiceManager, getServiceHealthReport } from '../services/enhanced-service-initialization';
import { ServiceHealth } from '../services/service-dependency-manager';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Check service health by attempting a simple operation
 */
const checkServiceHealth = async (serviceName: string, checkFunction: () => Promise<void>): Promise<ServiceStatus> => {
  const startTime = Date.now();
  
  try {
    await checkFunction();
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    logger.warn(`Health check failed for ${serviceName}:`, error);
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

router.get('/', validateRequest({ query: z.object({}) }), async (req: Request, res: Response) => {
  try {
    // Get enhanced service health report
    const serviceHealthReport = await getServiceHealthReport();

    // Get memory usage with more details
    const memoryUsage = process.memoryUsage();
    const memory = {
      used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100
    };

    // Convert enhanced service health to legacy format
    const createServiceStatus = (serviceName: string): ServiceStatus => {
      const serviceHealth = serviceHealthReport.services[serviceName];
      if (!serviceHealth) {
        return {
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          error: 'Service not found'
        };
      }

      let status: 'healthy' | 'degraded' | 'unhealthy';
      switch (serviceHealth.health) {
        case ServiceHealth.HEALTHY:
          status = 'healthy';
          break;
        case ServiceHealth.DEGRADED:
          status = 'degraded';
          break;
        case ServiceHealth.UNHEALTHY:
        case ServiceHealth.DISABLED:
        default:
          status = 'unhealthy';
          break;
      }

      return {
        status,
        lastCheck: serviceHealth.lastHealthCheck.toISOString()
      };
    };

    const services = {
      database: createServiceStatus('databaseService'),
      masterAgent: createServiceStatus('masterAgent'),
      toolExecutor: createServiceStatus('toolExecutor'),
      emailAgent: createServiceStatus('emailAgent'),
      sessionService: createServiceStatus('sessionService')
    };

    // Get rate limiting stats
    const rateLimitingStats = rateLimitStore.getStats();

    // Map ServiceHealth enum to legacy status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    switch (serviceHealthReport.overall) {
      case ServiceHealth.HEALTHY:
        overallStatus = 'healthy';
        break;
      case ServiceHealth.DEGRADED:
        overallStatus = 'degraded';
        break;
      default:
        overallStatus = 'unhealthy';
        break;
    }

    // Check memory pressure (warn if using > 80% of heap)
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (heapUsagePercent > 80 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    const healthCheck: HealthCheckResponse = {
      status: overallStatus,
      timestamp: serviceHealthReport.timestamp,
      uptime: process.uptime(),
      environment: serviceHealthReport.environment,
      version: process.env.npm_package_version || '1.0.0',
      memory,
      services,
      rateLimiting: {
        totalEntries: rateLimitingStats.totalEntries,
        memoryUsage: rateLimitingStats.memoryUsage
      },
      nodeVersion: process.version,
      pid: process.pid
    };

    // Set appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    logger.info('Enhanced health check completed', {
      status: overallStatus,
      responseTime: Date.now() - (req.startTime || Date.now()),
      memoryUsedMB: memory.used,
      servicesCount: Object.keys(services).length,
      healthyServices: Object.values(services).filter(s => s.status === 'healthy').length,
      degradedServices: Object.values(services).filter(s => s.status === 'degraded').length,
      unhealthyServices: Object.values(services).filter(s => s.status === 'unhealthy').length,
      recommendations: serviceHealthReport.recommendations.length
    });

    res.status(httpStatus).json(healthCheck);

  } catch (error) {
    logger.error('Health check error:', error);
    
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: 0,
        total: 0,
        rss: 0,
        external: 0
      },
      services: {
        masterAgent: { status: 'unhealthy', error: 'Health check failed' },
        toolExecutor: { status: 'unhealthy', error: 'Health check failed' },
        emailAgent: { status: 'unhealthy', error: 'Health check failed' },
        sessionService: { status: 'unhealthy', error: 'Health check failed' }
      },
      rateLimiting: {
        totalEntries: 0,
        memoryUsage: 0
      },
      nodeVersion: process.version,
      pid: process.pid
    };

    res.status(503).json(errorResponse);
  }
});

export default router;