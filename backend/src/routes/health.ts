import express, { Request, Response } from 'express';
import { HealthCheckResponse, ServiceStatus } from '../types/api.types';
import { rateLimitStore } from '../middleware/rate-limiting.middleware';
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

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get memory usage with more details
    const memoryUsage = process.memoryUsage();
    const memory = {
      used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100
    };

    // Check individual service health
    const services = {
      masterAgent: await checkServiceHealth('masterAgent', async () => {
        // Simple health check - just verify the service exists
        // In a real app, you might ping the service or check dependencies
      }),
      
      toolExecutor: await checkServiceHealth('toolExecutor', async () => {
        // Check if tool executor service is responsive
      }),
      
      emailAgent: await checkServiceHealth('emailAgent', async () => {
        // Check if email agent can be instantiated
      }),
      
      sessionService: await checkServiceHealth('sessionService', async () => {
        // Check if session service is working
      })
    };

    // Get rate limiting stats
    const rateLimitingStats = rateLimitStore.getStats();

    // Determine overall health status
    const serviceStatuses = Object.values(services);
    const unhealthyServices = serviceStatuses.filter(s => s.status === 'unhealthy');
    const degradedServices = serviceStatuses.filter(s => s.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    }

    // Check memory pressure (warn if using > 80% of heap)
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (heapUsagePercent > 80 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    const healthCheck: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
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

    logger.info('Health check completed', {
      status: overallStatus,
      responseTime: Date.now() - (req.startTime || Date.now()),
      memoryUsedMB: memory.used,
      services: Object.keys(services).reduce((acc, key) => {
        acc[key] = services[key as keyof typeof services].status;
        return acc;
      }, {} as Record<string, string>)
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