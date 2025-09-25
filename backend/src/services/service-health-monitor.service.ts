import logger from '../utils/logger';
import { IService, ServiceState } from './service-manager';
import { ServiceRegistry, ServiceInfo } from './service-registry.service';

/**
 * Health status for a service
 */
export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  details?: any;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

/**
 * Comprehensive health report for all services
 */
export interface HealthReport {
  overall: {
    healthy: boolean;
    status: 'healthy' | 'degraded' | 'critical';
    totalServices: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
  };
  services: Record<string, HealthStatus>;
  generatedAt: Date;
  systemInfo: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    pid: number;
  };
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retryCount: number;
  alertThreshold: number;
}

/**
 * Alert callback function
 */
export type AlertCallback = (serviceName: string, status: HealthStatus, error?: Error) => void;

/**
 * ServiceHealthMonitor - Single Responsibility: Service Health Monitoring
 *
 * Handles all health monitoring operations including health checks,
 * status reporting, alerting, and health trend analysis.
 * Extracted from ServiceManager to follow SRP.
 */
export class ServiceHealthMonitor implements IService {
  readonly name = 'serviceHealthMonitor';
  private _state: ServiceState = ServiceState.INITIALIZING;
  private healthCache: Map<string, HealthStatus> = new Map();
  private alertCallbacks: Map<string, AlertCallback[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthHistory: Map<string, HealthStatus[]> = new Map();
  private readonly maxHistoryLength = 100;

  get state(): ServiceState {
    return this._state;
  }

  async initialize(): Promise<void> {
    this._state = ServiceState.READY;
  }

  isReady(): boolean {
    return this._state === ServiceState.READY;
  }

  async destroy(): Promise<void> {
    this.stopMonitoring();
    this.alertCallbacks.clear();
    this.healthCache.clear();
    this.healthHistory.clear();
    this._state = ServiceState.DESTROYED;
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        cachedHealthStatuses: this.healthCache.size,
        activeAlertCallbacks: Array.from(this.alertCallbacks.values()).flat().length,
        monitoringActive: this.monitoringInterval !== null,
        historySize: Array.from(this.healthHistory.values()).reduce((sum, arr) => sum + arr.length, 0)
      }
    };
  }

  private config: HealthCheckConfig = {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retryCount: 3,
    alertThreshold: 2 // Alert after 2 consecutive failures
  };

  constructor(private serviceRegistry: ServiceRegistry) {}

  /**
   * Check health of a specific service
   */
  async checkHealth(serviceName: string): Promise<HealthStatus> {
    const service = this.serviceRegistry.get(serviceName);
    if (!service) {
      return {
        healthy: false,
        status: 'unknown',
        lastCheck: new Date(),
        error: 'Service not found'
      };
    }

    const startTime = Date.now();
    let status: HealthStatus;

    try {
      const healthDetails = service.getHealth();
      const responseTime = Date.now() - startTime;

      status = {
        healthy: healthDetails.healthy && service.isReady(),
        status: this.determineHealthStatus(service, healthDetails),
        details: healthDetails.details,
        lastCheck: new Date(),
        responseTime,
        error: healthDetails.healthy ? undefined : 'Service reported unhealthy'
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      status = {
        healthy: false,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown health check error'
      };
    }

    // Cache the result
    this.healthCache.set(serviceName, status);

    // Store in history
    this.addToHistory(serviceName, status);

    // Check for alerts
    if (!status.healthy) {
      await this.checkAndTriggerAlerts(serviceName, status);
    }

    return status;
  }

  /**
   * Monitor all registered services
   */
  async monitorServices(): Promise<HealthReport> {
    const services = this.serviceRegistry.listServices();
    const serviceHealth: Record<string, HealthStatus> = {};

    const healthChecks = services.map(async (serviceInfo) => {
      try {
        const health = await this.checkHealth(serviceInfo.name);
        serviceHealth[serviceInfo.name] = health;
        return health;
      } catch (error) {
        const errorHealth: HealthStatus = {
          healthy: false,
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        serviceHealth[serviceInfo.name] = errorHealth;
        return errorHealth;
      }
    });

    const healthResults = await Promise.all(healthChecks);

    const healthyCount = healthResults.filter(h => h.healthy).length;
    const degradedCount = healthResults.filter(h => h.status === 'degraded').length;
    const unhealthyCount = healthResults.filter(h => !h.healthy).length;

    const overallStatus = this.determineOverallHealth(healthyCount, degradedCount, unhealthyCount, services.length);

    const report: HealthReport = {
      overall: {
        healthy: overallStatus !== 'critical',
        status: overallStatus,
        totalServices: services.length,
        healthyCount,
        degradedCount,
        unhealthyCount
      },
      services: serviceHealth,
      generatedAt: new Date(),
      systemInfo: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      }
    };

    logger.debug('Health monitoring completed', {
      correlationId: `health-monitor-${Date.now()}`,
      operation: 'health_monitoring',
      metadata: {
        totalServices: services.length,
        healthyCount,
        degradedCount,
        unhealthyCount,
        overallStatus
      }
    });

    return report;
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(config?: Partial<HealthCheckConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      logger.info('Health monitoring is disabled');
      return;
    }

    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorServices();
      } catch (error) {
        logger.error('Health monitoring failed', {
          correlationId: `health-monitor-${Date.now()}`,
          operation: 'health_monitoring_error',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }, this.config.interval);

    logger.info('Health monitoring started', {
      correlationId: `health-monitor-${Date.now()}`,
      operation: 'health_monitoring_start',
      metadata: { interval: this.config.interval, enabled: this.config.enabled }
    });
  }

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;

      logger.info('Health monitoring stopped', {
        correlationId: `health-monitor-${Date.now()}`,
        operation: 'health_monitoring_stop'
      });
    }
  }

  /**
   * Register alert callback for service failures
   */
  alertOnFailure(serviceName: string, callback: AlertCallback): void {
    if (!this.alertCallbacks.has(serviceName)) {
      this.alertCallbacks.set(serviceName, []);
    }
    this.alertCallbacks.get(serviceName)!.push(callback);

    logger.debug(`Alert callback registered for service: ${serviceName}`, {
      correlationId: `health-monitor-${Date.now()}`,
      operation: 'alert_callback_register',
      metadata: { serviceName }
    });
  }

  /**
   * Get health history for a service
   */
  getHealthHistory(serviceName: string): HealthStatus[] {
    return this.healthHistory.get(serviceName) || [];
  }

  /**
   * Get current health status from cache
   */
  getCachedHealth(serviceName: string): HealthStatus | undefined {
    return this.healthCache.get(serviceName);
  }

  /**
   * Get health statistics
   */
  getHealthStats(): {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    averageResponseTime: number;
    lastMonitoringRun: Date | null;
  } {
    const allHealth = Array.from(this.healthCache.values());
    const healthyCount = allHealth.filter(h => h.healthy).length;
    const degradedCount = allHealth.filter(h => h.status === 'degraded').length;
    const unhealthyCount = allHealth.filter(h => !h.healthy).length;

    const responseTimes = allHealth
      .map(h => h.responseTime)
      .filter(rt => rt !== undefined) as number[];

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
      : 0;

    const lastRun = allHealth.length > 0
      ? new Date(Math.max(...allHealth.map(h => h.lastCheck.getTime())))
      : null;

    return {
      totalServices: allHealth.length,
      healthyServices: healthyCount,
      degradedServices: degradedCount,
      unhealthyServices: unhealthyCount,
      averageResponseTime,
      lastMonitoringRun: lastRun
    };
  }

  /**
   * Clear health cache and history
   */
  clearHealthData(): void {
    this.healthCache.clear();
    this.healthHistory.clear();

    logger.debug('Health data cleared', {
      correlationId: `health-monitor-${Date.now()}`,
      operation: 'health_data_clear'
    });
  }

  /**
   * Determine health status based on service state and health details
   */
  private determineHealthStatus(service: IService, healthDetails: any): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (service.state === ServiceState.ERROR) {
      return 'unhealthy';
    }

    if (!service.isReady() || !healthDetails.healthy) {
      return service.state === ServiceState.READY ? 'degraded' : 'unhealthy';
    }

    // Check for performance degradation indicators
    if (healthDetails.details?.warnings?.length > 0 || healthDetails.details?.slowQueries) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(
    healthy: number,
    degraded: number,
    unhealthy: number,
    total: number
  ): 'healthy' | 'degraded' | 'critical' {
    const healthPercentage = (healthy / total) * 100;

    if (unhealthy > 0 && unhealthy >= total * 0.3) {
      return 'critical'; // 30%+ unhealthy services
    }

    if (healthPercentage < 70) {
      return 'critical';
    }

    if (degraded > 0 || healthPercentage < 90) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Add health status to history
   */
  private addToHistory(serviceName: string, status: HealthStatus): void {
    if (!this.healthHistory.has(serviceName)) {
      this.healthHistory.set(serviceName, []);
    }

    const history = this.healthHistory.get(serviceName)!;
    history.push(status);

    // Keep only recent history
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
  }

  /**
   * Check for alert conditions and trigger callbacks
   */
  private async checkAndTriggerAlerts(serviceName: string, status: HealthStatus): Promise<void> {
    const callbacks = this.alertCallbacks.get(serviceName);
    if (!callbacks || callbacks.length === 0) {
      return;
    }

    const history = this.getHealthHistory(serviceName);
    const recentFailures = history
      .slice(-this.config.alertThreshold)
      .filter(h => !h.healthy).length;

    // Only alert if we've reached the threshold of consecutive failures
    if (recentFailures >= this.config.alertThreshold) {
      for (const callback of callbacks) {
        try {
          const error = status.error ? new Error(status.error) : undefined;
          await callback(serviceName, status, error);
        } catch (error) {
          logger.error(`Alert callback failed for service ${serviceName}`, {
            correlationId: `health-monitor-${Date.now()}`,
            operation: 'alert_callback_error',
            metadata: {
              serviceName,
              error: error instanceof Error ? error.message : 'Unknown callback error'
            }
          });
        }
      }
    }
  }

}