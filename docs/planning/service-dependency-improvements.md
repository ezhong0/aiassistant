# Service Dependency Improvements - Detailed Implementation Plan

## Overview

This document provides a comprehensive plan to eliminate environment-specific service initialization hacks and implement robust dependency management with graceful degradation.

## Problem Analysis

### Current Issues

The service manager contains problematic environment-specific logic that creates unpredictable behavior:

```typescript
// Problematic code in service-manager.ts:326-334
if (serviceName === 'databaseService' && process.env.NODE_ENV === 'development') {
  logger.warn(`Database service failed to initialize in development mode, continuing without database`, error);
  (registration.service as any)._initializationFailed = true;
  continue;
}
```

### Problems This Creates
1. **Environment Inconsistency:** Different service availability between dev/prod
2. **Testing Unreliability:** Tests may pass in dev but fail in prod due to different service states
3. **Type Safety Issues:** Casting to `any` and adding dynamic properties
4. **Hidden Dependencies:** Services that depend on database don't know it might be unavailable
5. **Production Surprises:** Unexpected behavior when services fail in production

## Technical Design

### Enhanced Service Registration

```typescript
interface DependencySpec {
  name: string;
  required: boolean;
  fallbackProvider?: () => IService;
  healthCheck?: () => Promise<boolean>;
  initializeWith?: 'mock' | 'real' | 'disabled';
}

interface ServiceRegistration {
  service: IService;
  dependencies: DependencySpec[];
  priority: number;
  autoStart: boolean;
  fallbackStrategy: FallbackStrategy;
  environment: EnvironmentConstraints;
}

enum FallbackStrategy {
  FAIL = 'fail',           // Fail initialization if dependency unavailable
  DEGRADE = 'degrade',     // Continue with reduced functionality
  MOCK = 'mock',           // Use mock implementation
  SKIP = 'skip'            // Skip this service entirely
}

interface EnvironmentConstraints {
  required: string[];      // Environments where this service is required
  optional: string[];      // Environments where this service is optional
  disabled: string[];      // Environments where this service should not run
}
```

### Service Health and State Management

```typescript
enum ServiceHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  DISABLED = 'disabled'
}

interface ServiceHealthInfo {
  health: ServiceHealth;
  dependencies: Record<string, ServiceHealth>;
  capabilities: string[];
  limitations: string[];
  lastHealthCheck: Date;
}
```

## Implementation Details

### Phase 1: Enhanced Service Registry

#### File: `backend/src/services/enhanced-service-manager.ts`

```typescript
import { ServiceManager, IService, ServiceState } from './service-manager';
import logger from '../utils/logger';

export interface MockServiceProvider {
  createMock(): IService;
  isCompatible(originalService: IService): boolean;
}

export class EnhancedServiceManager extends ServiceManager {
  private mockProviders = new Map<string, MockServiceProvider>();
  private serviceHealth = new Map<string, ServiceHealthInfo>();
  private environmentConfig: EnvironmentConfig;

  constructor() {
    super();
    this.environmentConfig = this.loadEnvironmentConfig();
  }

  /**
   * Register a service with enhanced dependency specifications
   */
  registerServiceEnhanced(
    name: string,
    service: IService,
    options: {
      dependencies?: DependencySpec[];
      priority?: number;
      autoStart?: boolean;
      fallbackStrategy?: FallbackStrategy;
      environment?: EnvironmentConstraints;
      mockProvider?: MockServiceProvider;
    } = {}
  ): void {
    const registration: EnhancedServiceRegistration = {
      service,
      dependencies: options.dependencies || [],
      priority: options.priority || 100,
      autoStart: options.autoStart !== false,
      fallbackStrategy: options.fallbackStrategy || FallbackStrategy.FAIL,
      environment: options.environment || {
        required: ['production'],
        optional: ['development', 'test'],
        disabled: []
      }
    };

    // Check if service should run in current environment
    if (!this.shouldRunInEnvironment(registration.environment)) {
      logger.info(`Service ${name} disabled in ${process.env.NODE_ENV} environment`);
      return;
    }

    // Register mock provider if provided
    if (options.mockProvider) {
      this.mockProviders.set(name, options.mockProvider);
    }

    // Convert to standard registration format
    const standardDeps = registration.dependencies.map(dep => dep.name);

    super.registerService(name, service, {
      dependencies: standardDeps,
      priority: registration.priority,
      autoStart: registration.autoStart
    });

    // Store enhanced registration info
    this.enhancedRegistrations.set(name, registration);
  }

  /**
   * Initialize services with enhanced dependency resolution
   */
  async initializeAllServicesEnhanced(): Promise<void> {
    logger.info(`Initializing services with enhanced dependency management...`);

    // Calculate initialization order
    this.calculateInitializationOrder();

    for (const serviceName of this.initializationOrder) {
      try {
        await this.initializeServiceWithFallbacks(serviceName);
      } catch (error) {
        logger.error(`Failed to initialize service ${serviceName}:`, error);

        const registration = this.enhancedRegistrations.get(serviceName);
        if (registration?.fallbackStrategy === FallbackStrategy.FAIL) {
          throw error; // Fail fast for critical services
        }

        // Continue with other services for non-critical failures
        logger.warn(`Continuing initialization despite ${serviceName} failure`);
      }
    }

    logger.info('Service initialization completed');
  }

  private async initializeServiceWithFallbacks(name: string): Promise<void> {
    const registration = this.enhancedRegistrations.get(name);
    if (!registration) {
      // Fallback to standard initialization
      return super.initializeService(name);
    }

    // Check dependencies first
    const dependencyStatus = await this.resolveDependencies(registration.dependencies);

    if (dependencyStatus.hasFailures && registration.fallbackStrategy === FallbackStrategy.FAIL) {
      throw new Error(`Critical dependencies failed for service ${name}: ${dependencyStatus.failures.join(', ')}`);
    }

    // Attempt to initialize the service
    try {
      await registration.service.initialize();

      if (registration.service.isReady()) {
        this.updateServiceHealth(name, ServiceHealth.HEALTHY, dependencyStatus);
      } else {
        throw new Error(`Service ${name} failed to reach ready state after initialization`);
      }
    } catch (error) {
      logger.warn(`Service ${name} initialization failed, applying fallback strategy:`, error);

      switch (registration.fallbackStrategy) {
        case FallbackStrategy.MOCK:
          await this.initializeMockService(name);
          break;
        case FallbackStrategy.DEGRADE:
          await this.initializeDegradedService(name, dependencyStatus);
          break;
        case FallbackStrategy.SKIP:
          logger.info(`Skipping service ${name} due to fallback strategy`);
          break;
        case FallbackStrategy.FAIL:
        default:
          throw error;
      }
    }
  }

  private async resolveDependencies(dependencies: DependencySpec[]): Promise<DependencyResolutionResult> {
    const result: DependencyResolutionResult = {
      hasFailures: false,
      failures: [],
      available: [],
      mocked: []
    };

    for (const dep of dependencies) {
      const depService = this.getService(dep.name);

      if (!depService) {
        if (dep.required) {
          result.hasFailures = true;
          result.failures.push(dep.name);
        }
        continue;
      }

      // Check health if health check provided
      if (dep.healthCheck) {
        try {
          const isHealthy = await dep.healthCheck();
          if (!isHealthy && dep.required) {
            result.hasFailures = true;
            result.failures.push(`${dep.name} (unhealthy)`);
            continue;
          }
        } catch (error) {
          logger.warn(`Health check failed for dependency ${dep.name}:`, error);
          if (dep.required) {
            result.hasFailures = true;
            result.failures.push(`${dep.name} (health check failed)`);
            continue;
          }
        }
      }

      if (depService.isReady()) {
        result.available.push(dep.name);
      } else {
        // Try to initialize dependency with fallback
        if (dep.fallbackProvider) {
          const mockService = dep.fallbackProvider();
          await mockService.initialize();
          if (mockService.isReady()) {
            result.mocked.push(dep.name);
            // Replace the failed service with mock
            this.serviceInstances.set(dep.name, mockService);
          }
        } else if (dep.required) {
          result.hasFailures = true;
          result.failures.push(`${dep.name} (not ready)`);
        }
      }
    }

    return result;
  }

  private async initializeMockService(name: string): Promise<void> {
    const mockProvider = this.mockProviders.get(name);
    if (!mockProvider) {
      throw new Error(`No mock provider available for service ${name}`);
    }

    const mockService = mockProvider.createMock();
    await mockService.initialize();

    if (mockService.isReady()) {
      // Replace the failed service with mock
      this.serviceInstances.set(name, mockService);
      this.updateServiceHealth(name, ServiceHealth.DEGRADED, {
        hasFailures: false,
        failures: [],
        available: [],
        mocked: [name]
      });
      logger.info(`Service ${name} initialized with mock implementation`);
    } else {
      throw new Error(`Mock service ${name} failed to initialize`);
    }
  }

  private async initializeDegradedService(
    name: string,
    dependencyStatus: DependencyResolutionResult
  ): Promise<void> {
    // Mark service as degraded but operational
    this.updateServiceHealth(name, ServiceHealth.DEGRADED, dependencyStatus);

    // The service itself might still be partially functional
    const service = this.getService(name);
    if (service) {
      // Try to mark as ready with limitations
      (service as any)._degraded = true;
      (service as any)._availableDependencies = dependencyStatus.available;

      logger.info(`Service ${name} running in degraded mode`, {
        availableDependencies: dependencyStatus.available,
        missingDependencies: dependencyStatus.failures
      });
    }
  }

  private shouldRunInEnvironment(constraints: EnvironmentConstraints): boolean {
    const currentEnv = process.env.NODE_ENV || 'development';

    if (constraints.disabled.includes(currentEnv)) {
      return false;
    }

    if (constraints.required.includes(currentEnv)) {
      return true;
    }

    if (constraints.optional.includes(currentEnv)) {
      return true;
    }

    // Default: run in all environments not explicitly disabled
    return true;
  }

  private updateServiceHealth(
    name: string,
    health: ServiceHealth,
    dependencyStatus: DependencyResolutionResult
  ): void {
    const healthInfo: ServiceHealthInfo = {
      health,
      dependencies: {},
      capabilities: this.getServiceCapabilities(name, health, dependencyStatus),
      limitations: this.getServiceLimitations(name, health, dependencyStatus),
      lastHealthCheck: new Date()
    };

    // Map dependency health
    for (const depName of dependencyStatus.available) {
      healthInfo.dependencies[depName] = ServiceHealth.HEALTHY;
    }
    for (const depName of dependencyStatus.mocked) {
      healthInfo.dependencies[depName] = ServiceHealth.DEGRADED;
    }
    for (const depName of dependencyStatus.failures) {
      healthInfo.dependencies[depName] = ServiceHealth.UNHEALTHY;
    }

    this.serviceHealth.set(name, healthInfo);
  }

  private getServiceCapabilities(
    name: string,
    health: ServiceHealth,
    dependencyStatus: DependencyResolutionResult
  ): string[] {
    // Service-specific capability mapping
    const capabilities: string[] = [];

    switch (name) {
      case 'emailService':
        if (dependencyStatus.available.includes('authService')) {
          capabilities.push('authenticated_email');
        }
        if (health === ServiceHealth.DEGRADED) {
          capabilities.push('basic_email_only');
        }
        break;
      case 'calendarService':
        if (dependencyStatus.available.includes('authService')) {
          capabilities.push('calendar_crud');
        }
        if (dependencyStatus.available.includes('emailService')) {
          capabilities.push('event_notifications');
        }
        break;
    }

    return capabilities;
  }

  private getServiceLimitations(
    name: string,
    health: ServiceHealth,
    dependencyStatus: DependencyResolutionResult
  ): string[] {
    const limitations: string[] = [];

    if (health === ServiceHealth.DEGRADED) {
      limitations.push('reduced_functionality');
    }

    if (dependencyStatus.failures.length > 0) {
      limitations.push(`missing_dependencies: ${dependencyStatus.failures.join(', ')}`);
    }

    return limitations;
  }

  // Public API extensions

  getServiceHealth(name: string): ServiceHealthInfo | undefined {
    return this.serviceHealth.get(name);
  }

  getAllServicesHealthDetailed(): Record<string, ServiceHealthInfo> {
    const health: Record<string, ServiceHealthInfo> = {};

    for (const [name, healthInfo] of this.serviceHealth.entries()) {
      health[name] = { ...healthInfo };
    }

    return health;
  }

  async healthCheck(): Promise<{
    overall: ServiceHealth;
    services: Record<string, ServiceHealthInfo>;
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      total: number;
    };
  }> {
    const services = this.getAllServicesHealthDetailed();
    const summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
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
}

interface DependencyResolutionResult {
  hasFailures: boolean;
  failures: string[];
  available: string[];
  mocked: string[];
}

interface EnvironmentConfig {
  environment: string;
  requiredServices: string[];
  optionalServices: string[];
  mockServices: string[];
}
```

### Phase 2: Mock Service Providers

#### File: `backend/src/services/mocks/database-mock.service.ts`

```typescript
import { BaseService } from '../base-service';
import { DatabaseService } from '../database.service';
import logger from '../../utils/logger';

export class DatabaseMockService extends BaseService {
  private inMemoryData = new Map<string, any>();

  constructor() {
    super('databaseService');
  }

  protected async onInitialize(): Promise<void> {
    // Initialize with test data
    this.initializeTestData();
    logger.info('Database mock service initialized with in-memory storage');
  }

  protected async onDestroy(): Promise<void> {
    this.inMemoryData.clear();
    logger.info('Database mock service destroyed');
  }

  // Mock database operations
  async query(sql: string, params?: any[]): Promise<any[]> {
    logger.debug('Mock database query', { sql: sql.substring(0, 100) });

    // Simple query simulation
    if (sql.includes('SELECT')) {
      return this.handleSelect(sql, params);
    } else if (sql.includes('INSERT')) {
      return this.handleInsert(sql, params);
    } else if (sql.includes('UPDATE')) {
      return this.handleUpdate(sql, params);
    } else if (sql.includes('DELETE')) {
      return this.handleDelete(sql, params);
    }

    return [];
  }

  private initializeTestData(): void {
    // Initialize with common test data
    this.inMemoryData.set('users', [
      { id: 1, email: 'test@example.com', name: 'Test User' },
      { id: 2, email: 'admin@example.com', name: 'Admin User' }
    ]);

    this.inMemoryData.set('sessions', []);
    this.inMemoryData.set('tokens', []);
  }

  private handleSelect(sql: string, params?: any[]): any[] {
    // Simple table extraction - in production would use proper SQL parser
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      return this.inMemoryData.get(tableName) || [];
    }
    return [];
  }

  private handleInsert(sql: string, params?: any[]): any[] {
    // Mock insert - return affected rows
    return [{ insertId: Math.floor(Math.random() * 1000), affectedRows: 1 }];
  }

  private handleUpdate(sql: string, params?: any[]): any[] {
    return [{ affectedRows: 1 }];
  }

  private handleDelete(sql: string, params?: any[]): any[] {
    return [{ affectedRows: 1 }];
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: true,
      details: {
        type: 'mock',
        tables: Array.from(this.inMemoryData.keys()),
        totalRecords: Array.from(this.inMemoryData.values())
          .reduce((total, table) => total + table.length, 0)
      }
    };
  }
}
```

### Phase 3: Service Registration Updates

#### File: `backend/src/services/service-initialization.ts` (Enhanced)

```typescript
import { EnhancedServiceManager } from './enhanced-service-manager';
import { DatabaseMockService } from './mocks/database-mock.service';
import { EmailService } from './email/email.service';
import { CalendarService } from './calendar/calendar.service';
import { AuthService } from './auth.service';

const serviceManager = EnhancedServiceManager.getInstance();

export async function registerAllServicesEnhanced(): Promise<void> {
  // Core services with no dependencies
  serviceManager.registerServiceEnhanced('configService', new ConfigService(), {
    priority: 1,
    autoStart: true,
    fallbackStrategy: FallbackStrategy.FAIL,
    environment: {
      required: ['production', 'development', 'test'],
      optional: [],
      disabled: []
    }
  });

  // Database service with mock fallback
  serviceManager.registerServiceEnhanced('databaseService', new DatabaseService(), {
    priority: 5,
    autoStart: true,
    dependencies: [
      {
        name: 'configService',
        required: true
      }
    ],
    fallbackStrategy: FallbackStrategy.MOCK,
    environment: {
      required: ['production'],
      optional: ['development', 'test'],
      disabled: []
    },
    mockProvider: {
      createMock: () => new DatabaseMockService(),
      isCompatible: (service) => service.name === 'databaseService'
    }
  });

  // Auth service with database dependency
  serviceManager.registerServiceEnhanced('authService', new AuthService(), {
    priority: 10,
    autoStart: true,
    dependencies: [
      {
        name: 'databaseService',
        required: true,
        healthCheck: async () => {
          const dbService = serviceManager.getService('databaseService');
          return dbService?.getHealth().healthy || false;
        }
      },
      {
        name: 'configService',
        required: true
      }
    ],
    fallbackStrategy: FallbackStrategy.DEGRADE,
    environment: {
      required: ['production'],
      optional: ['development', 'test'],
      disabled: []
    }
  });

  // Email service with optional dependencies
  serviceManager.registerServiceEnhanced('emailService', new EmailService(), {
    priority: 20,
    autoStart: true,
    dependencies: [
      {
        name: 'authService',
        required: false, // Can work without auth for basic functionality
        healthCheck: async () => {
          const authService = serviceManager.getService('authService');
          return authService?.isReady() || false;
        }
      },
      {
        name: 'configService',
        required: true
      }
    ],
    fallbackStrategy: FallbackStrategy.DEGRADE,
    environment: {
      required: ['production'],
      optional: ['development', 'test'],
      disabled: []
    }
  });

  // Calendar service with multiple dependencies
  serviceManager.registerServiceEnhanced('calendarService', new CalendarService(), {
    priority: 30,
    autoStart: true,
    dependencies: [
      {
        name: 'authService',
        required: true
      },
      {
        name: 'emailService',
        required: false // Calendar works without email notifications
      }
    ],
    fallbackStrategy: FallbackStrategy.DEGRADE,
    environment: {
      required: ['production'],
      optional: ['development', 'test'],
      disabled: []
    }
  });

  logger.info('Enhanced service registrations completed');
}

export async function initializeAllCoreServicesEnhanced(): Promise<void> {
  await registerAllServicesEnhanced();
  await serviceManager.initializeAllServicesEnhanced();

  // Log final service health
  const healthCheck = await serviceManager.healthCheck();
  logger.info('Service initialization completed', {
    overall: healthCheck.overall,
    summary: healthCheck.summary,
    degradedServices: Object.entries(healthCheck.services)
      .filter(([, health]) => health.health === ServiceHealth.DEGRADED)
      .map(([name]) => name)
  });
}
```

## Migration Strategy

### Week 1: Foundation
1. **Day 1-2:** Implement `EnhancedServiceManager` with dependency specification support
2. **Day 3:** Create mock service providers for database and external services
3. **Day 4:** Add comprehensive unit tests for dependency resolution
4. **Day 5:** Create environment-specific service configurations

### Week 2: Service Migration
1. **Day 1-2:** Migrate database service registration to enhanced system
2. **Day 3:** Migrate auth service with database dependency
3. **Day 4-5:** Migrate remaining services (email, calendar, etc.)

### Week 3: Testing & Validation
1. **Day 1-2:** Comprehensive integration testing across environments
2. **Day 3:** Load testing with service failures
3. **Day 4:** Production deployment preparation
4. **Day 5:** Gradual rollout with monitoring

## Testing Strategy

### Unit Tests
```typescript
describe('EnhancedServiceManager', () => {
  describe('dependency resolution', () => {
    it('should initialize services with all dependencies available', async () => {
      const manager = new EnhancedServiceManager();

      // Register services with dependencies
      manager.registerServiceEnhanced('serviceA', new MockServiceA(), {
        dependencies: [{ name: 'serviceB', required: true }]
      });
      manager.registerServiceEnhanced('serviceB', new MockServiceB(), {});

      await manager.initializeAllServicesEnhanced();

      expect(manager.getService('serviceA')?.isReady()).toBe(true);
      expect(manager.getService('serviceB')?.isReady()).toBe(true);
    });

    it('should use mock service when dependency fails and fallback is MOCK', async () => {
      const manager = new EnhancedServiceManager();

      manager.registerServiceEnhanced('failingService', new FailingService(), {
        fallbackStrategy: FallbackStrategy.MOCK,
        mockProvider: {
          createMock: () => new MockFailingService(),
          isCompatible: () => true
        }
      });

      await manager.initializeAllServicesEnhanced();

      const service = manager.getService('failingService');
      expect(service?.isReady()).toBe(true);

      const health = manager.getServiceHealth('failingService');
      expect(health?.health).toBe(ServiceHealth.DEGRADED);
    });

    it('should handle circular dependencies gracefully', async () => {
      const manager = new EnhancedServiceManager();

      manager.registerServiceEnhanced('serviceA', new MockServiceA(), {
        dependencies: [{ name: 'serviceB', required: true }]
      });
      manager.registerServiceEnhanced('serviceB', new MockServiceB(), {
        dependencies: [{ name: 'serviceA', required: true }]
      });

      await expect(manager.initializeAllServicesEnhanced())
        .rejects.toThrow(/circular dependency/i);
    });
  });
});
```

### Integration Tests
```typescript
describe('Service Integration with Enhanced Manager', () => {
  it('should maintain service functionality with mocked dependencies', async () => {
    const manager = new EnhancedServiceManager();

    // Database service with mock fallback
    manager.registerServiceEnhanced('databaseService', new DatabaseService(), {
      fallbackStrategy: FallbackStrategy.MOCK,
      mockProvider: {
        createMock: () => new DatabaseMockService(),
        isCompatible: () => true
      }
    });

    // Auth service depending on database
    manager.registerServiceEnhanced('authService', new AuthService(), {
      dependencies: [{ name: 'databaseService', required: true }],
      fallbackStrategy: FallbackStrategy.DEGRADE
    });

    // Force database initialization to fail
    process.env.DATABASE_URL = 'invalid://connection';

    await manager.initializeAllServicesEnhanced();

    // Database should be mocked
    const dbHealth = manager.getServiceHealth('databaseService');
    expect(dbHealth?.health).toBe(ServiceHealth.DEGRADED);

    // Auth service should still work
    const authService = manager.getService<AuthService>('authService');
    expect(authService?.isReady()).toBe(true);

    // Basic auth operations should work with mock database
    const result = await authService.validateToken('test-token');
    expect(result).toBeDefined();
  });
});
```

## Monitoring & Alerting

### Service Health Endpoint
```typescript
// Add to health routes
app.get('/health/services', async (req, res) => {
  const healthCheck = await serviceManager.healthCheck();

  res.json({
    status: healthCheck.overall,
    timestamp: new Date().toISOString(),
    services: healthCheck.services,
    summary: healthCheck.summary,
    environment: process.env.NODE_ENV
  });
});
```

### Metrics Collection
```typescript
// Service health metrics
const serviceHealthMetrics = {
  'service_health_status': {
    type: 'gauge',
    help: 'Service health status (1=healthy, 0.5=degraded, 0=unhealthy)',
    labelNames: ['service_name', 'environment']
  },
  'service_initialization_time': {
    type: 'histogram',
    help: 'Service initialization time in seconds',
    labelNames: ['service_name', 'success']
  },
  'dependency_resolution_failures': {
    type: 'counter',
    help: 'Number of dependency resolution failures',
    labelNames: ['service_name', 'dependency_name']
  }
};
```

### Alerting Rules
- **Critical:** Any service with `FallbackStrategy.FAIL` that fails to initialize
- **Warning:** Services running in degraded mode for >1 hour
- **Info:** Mock services being used in production environment

## Rollback Plan

### Immediate Rollback
1. **Feature Flag:** `ENHANCED_SERVICE_MANAGEMENT=false`
2. **Gradual Migration:** Keep original service manager as fallback
3. **Service-by-Service:** Migrate individual services back to original registration

### Rollback Triggers
- **Increased Initialization Failures:** >5% failure rate increase
- **Service Health Issues:** Critical services showing as unhealthy
- **Performance Regression:** >20% increase in initialization time

## Success Criteria

### Reliability Metrics
- **Initialization Success Rate:** >99.5% across all environments
- **Environment Consistency:** Zero environment-specific service failures
- **Dependency Resolution:** 100% success rate for available dependencies

### Operational Metrics
- **Service Health Visibility:** Real-time health status for all services
- **Mock Service Usage:** Clear indication when mocks are active
- **Recovery Time:** <30 seconds for service failure recovery

### Development Experience
- **Local Development:** 100% success rate for development environment setup
- **Testing Reliability:** Zero test failures due to service initialization issues
- **Documentation:** Complete service dependency mapping

This implementation plan provides a robust, production-ready approach to service dependency management that eliminates environment-specific hacks while maintaining system reliability and improving operational visibility.