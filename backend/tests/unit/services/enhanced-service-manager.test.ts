import {
  EnhancedServiceManager,
  FallbackStrategy,
  ServiceHealth,
  MockServiceProvider
} from '../../../src/services/enhanced-service-manager';
import { BaseService } from '../../../src/services/base-service';
import { ServiceState } from '../../../src/services/service-manager';

// Mock services for testing
class MockHealthyService extends BaseService {
  constructor(name: string = 'mockHealthyService') {
    super(name);
  }

  protected async onInitialize(): Promise<void> {
    // Simulate successful initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  protected async onDestroy(): Promise<void> {
    // Clean shutdown
  }
}

class MockFailingService extends BaseService {
  constructor(name: string = 'mockFailingService') {
    super(name);
  }

  protected async onInitialize(): Promise<void> {
    throw new Error('Mock service initialization failure');
  }

  protected async onDestroy(): Promise<void> {
    // Clean shutdown
  }
}

class MockSlowService extends BaseService {
  constructor(name: string = 'mockSlowService') {
    super(name);
  }

  protected async onInitialize(): Promise<void> {
    // Simulate slow initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  protected async onDestroy(): Promise<void> {
    // Clean shutdown
  }
}

class MockDependentService extends BaseService {
  constructor(name: string = 'mockDependentService') {
    super(name);
  }

  protected async onInitialize(): Promise<void> {
    // This service would typically check its dependencies here
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  protected async onDestroy(): Promise<void> {
    // Clean shutdown
  }
}

// Mock service provider
const mockServiceProvider: MockServiceProvider = {
  createMock: () => new MockHealthyService('mockReplacement'),
  isCompatible: (service) => service.name.includes('failing')
};

describe('EnhancedServiceManager', () => {
  let serviceManager: EnhancedServiceManager;

  beforeEach(() => {
    serviceManager = new EnhancedServiceManager();
  });

  afterEach(async () => {
    // Clean up services
    try {
      await serviceManager.forceCleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Basic Service Registration', () => {
    it('should register service with enhanced options', () => {
      const service = new MockHealthyService('testService');

      serviceManager.registerServiceEnhanced('testService', service, {
        priority: 10,
        autoStart: true,
        fallbackStrategy: FallbackStrategy.FAIL,
        environment: {
          required: ['test'],
          optional: [],
          disabled: []
        }
      });

      expect(serviceManager.getService('testService')).toBe(service);
      expect(serviceManager.getServiceCount()).toBe(1);
    });

    it('should skip service registration for disabled environments', () => {
      process.env.NODE_ENV = 'test';
      const service = new MockHealthyService('testService');

      serviceManager.registerServiceEnhanced('testService', service, {
        environment: {
          required: [],
          optional: [],
          disabled: ['test']
        }
      });

      expect(serviceManager.getService('testService')).toBeUndefined();
      expect(serviceManager.getServiceCount()).toBe(0);
    });

    it('should register service in required environment', () => {
      process.env.NODE_ENV = 'test';
      const service = new MockHealthyService('testService');

      serviceManager.registerServiceEnhanced('testService', service, {
        environment: {
          required: ['test'],
          optional: [],
          disabled: []
        }
      });

      expect(serviceManager.getService('testService')).toBe(service);
    });
  });

  describe('Dependency Resolution', () => {
    it('should initialize services with all dependencies available', async () => {
      const serviceA = new MockHealthyService('serviceA');
      const serviceB = new MockHealthyService('serviceB');

      // Register services with dependencies
      serviceManager.registerServiceEnhanced('serviceB', serviceB, {
        priority: 1
      });

      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        priority: 2,
        dependencies: [
          { name: 'serviceB', required: true }
        ]
      });

      await serviceManager.initializeAllServicesEnhanced();

      expect(serviceA.isReady()).toBe(true);
      expect(serviceB.isReady()).toBe(true);

      const healthA = serviceManager.getServiceHealth('serviceA');
      expect(healthA?.health).toBe(ServiceHealth.HEALTHY);
      expect(healthA?.dependencies['serviceB']).toBe(ServiceHealth.HEALTHY);
    });

    it('should fail when required dependency is missing', async () => {
      const serviceA = new MockHealthyService('serviceA');

      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        dependencies: [
          { name: 'missingService', required: true }
        ],
        fallbackStrategy: FallbackStrategy.FAIL
      });

      await expect(serviceManager.initializeAllServicesEnhanced())
        .rejects.toThrow(/Critical dependencies failed/);
    });

    it('should continue when optional dependency is missing', async () => {
      const serviceA = new MockHealthyService('serviceA');

      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        dependencies: [
          { name: 'missingService', required: false }
        ]
      });

      await serviceManager.initializeAllServicesEnhanced();

      expect(serviceA.isReady()).toBe(true);
      const health = serviceManager.getServiceHealth('serviceA');
      expect(health?.health).toBe(ServiceHealth.HEALTHY);
    });
  });

  describe('Fallback Strategies', () => {
    it('should use mock service when fallback strategy is MOCK', async () => {
      const failingService = new MockFailingService('failingService');

      serviceManager.registerServiceEnhanced('failingService', failingService, {
        fallbackStrategy: FallbackStrategy.MOCK,
        mockProvider: mockServiceProvider
      });

      await serviceManager.initializeAllServicesEnhanced();

      const service = serviceManager.getService('failingService');
      expect(service).toBeDefined();
      expect(service?.isReady()).toBe(true);
      expect(service?.name).toBe('mockReplacement');

      const health = serviceManager.getServiceHealth('failingService');
      expect(health?.health).toBe(ServiceHealth.DEGRADED);
    });

    it('should mark service as degraded when fallback strategy is DEGRADE', async () => {
      const failingService = new MockFailingService('failingService');

      serviceManager.registerServiceEnhanced('failingService', failingService, {
        fallbackStrategy: FallbackStrategy.DEGRADE
      });

      await serviceManager.initializeAllServicesEnhanced();

      const health = serviceManager.getServiceHealth('failingService');
      expect(health?.health).toBe(ServiceHealth.DEGRADED);
      expect(health?.limitations).toContain('reduced_functionality');
    });

    it('should skip service when fallback strategy is SKIP', async () => {
      const failingService = new MockFailingService('failingService');

      serviceManager.registerServiceEnhanced('failingService', failingService, {
        fallbackStrategy: FallbackStrategy.SKIP
      });

      await serviceManager.initializeAllServicesEnhanced();

      const health = serviceManager.getServiceHealth('failingService');
      expect(health?.health).toBe(ServiceHealth.DISABLED);
      expect(health?.limitations).toContain('service_disabled');
    });

    it('should fail when fallback strategy is FAIL', async () => {
      const failingService = new MockFailingService('failingService');

      serviceManager.registerServiceEnhanced('failingService', failingService, {
        fallbackStrategy: FallbackStrategy.FAIL
      });

      await expect(serviceManager.initializeAllServicesEnhanced())
        .rejects.toThrow(/Mock service initialization failure/);
    });
  });

  describe('Health Monitoring', () => {
    it('should track service health correctly', async () => {
      const healthyService = new MockHealthyService('healthyService');
      const failingService = new MockFailingService('failingService');

      serviceManager.registerServiceEnhanced('healthyService', healthyService);
      serviceManager.registerServiceEnhanced('failingService', failingService, {
        fallbackStrategy: FallbackStrategy.DEGRADE
      });

      await serviceManager.initializeAllServicesEnhanced();

      const healthCheck = await serviceManager.healthCheck();

      expect(healthCheck.summary.healthy).toBe(1);
      expect(healthCheck.summary.degraded).toBe(1);
      expect(healthCheck.summary.total).toBe(2);

      expect(healthCheck.services['healthyService'].health).toBe(ServiceHealth.HEALTHY);
      expect(healthCheck.services['failingService'].health).toBe(ServiceHealth.DEGRADED);
    });

    it('should provide detailed health information', async () => {
      const serviceA = new MockHealthyService('serviceA');
      const serviceB = new MockHealthyService('serviceB');

      serviceManager.registerServiceEnhanced('serviceB', serviceB);
      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        dependencies: [
          { name: 'serviceB', required: true }
        ]
      });

      await serviceManager.initializeAllServicesEnhanced();

      const healthA = serviceManager.getServiceHealth('serviceA');
      expect(healthA).toBeDefined();
      expect(healthA?.dependencies['serviceB']).toBe(ServiceHealth.HEALTHY);
      expect(healthA?.capabilities).toContain('full_functionality');
      expect(healthA?.lastHealthCheck).toBeInstanceOf(Date);
    });
  });

  describe('Capability Management', () => {
    it('should track service capabilities correctly', async () => {
      const emailService = new MockHealthyService('emailService');
      const authService = new MockHealthyService('authService');

      serviceManager.registerServiceEnhanced('authService', authService);
      serviceManager.registerServiceEnhanced('emailService', emailService, {
        dependencies: [
          { name: 'authService', required: false }
        ]
      });

      await serviceManager.initializeAllServicesEnhanced();

      const capabilities = serviceManager.getServiceCapabilities('emailService');
      expect(capabilities).toContain('authenticated_email');
      expect(capabilities).toContain('full_email_features');

      expect(serviceManager.hasServiceCapability('emailService', 'authenticated_email')).toBe(true);
      expect(serviceManager.hasServiceCapability('emailService', 'nonexistent_capability')).toBe(false);
    });

    it('should find services by capability', async () => {
      const emailService = new MockHealthyService('emailService');
      const calendarService = new MockHealthyService('calendarService');
      const authService = new MockHealthyService('authService');

      serviceManager.registerServiceEnhanced('authService', authService);
      serviceManager.registerServiceEnhanced('emailService', emailService, {
        dependencies: [{ name: 'authService', required: false }]
      });
      serviceManager.registerServiceEnhanced('calendarService', calendarService, {
        dependencies: [{ name: 'authService', required: true }]
      });

      await serviceManager.initializeAllServicesEnhanced();

      const servicesWithAuth = serviceManager.getServicesWithCapability('authenticated_email');
      expect(servicesWithAuth).toContain('emailService');
    });
  });

  describe('Circular Dependencies', () => {
    it('should detect and handle circular dependencies', async () => {
      const serviceA = new MockDependentService('serviceA');
      const serviceB = new MockDependentService('serviceB');

      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        dependencies: [{ name: 'serviceB', required: true }]
      });

      serviceManager.registerServiceEnhanced('serviceB', serviceB, {
        dependencies: [{ name: 'serviceA', required: true }]
      });

      await expect(serviceManager.initializeAllServicesEnhanced())
        .rejects.toThrow(/circular dependency/i);
    });
  });

  describe('Service Initialization Order', () => {
    it('should initialize services in correct dependency order', async () => {
      const initOrder: string[] = [];

      class TrackingService extends BaseService {
        constructor(name: string) {
          super(name);
        }

        protected async onInitialize(): Promise<void> {
          initOrder.push(this.name);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        protected async onDestroy(): Promise<void> {
          // Clean shutdown
        }
      }

      const serviceA = new TrackingService('serviceA');
      const serviceB = new TrackingService('serviceB');
      const serviceC = new TrackingService('serviceC');

      // C depends on B, B depends on A
      serviceManager.registerServiceEnhanced('serviceA', serviceA, { priority: 3 });
      serviceManager.registerServiceEnhanced('serviceB', serviceB, {
        priority: 2,
        dependencies: [{ name: 'serviceA', required: true }]
      });
      serviceManager.registerServiceEnhanced('serviceC', serviceC, {
        priority: 1,
        dependencies: [{ name: 'serviceB', required: true }]
      });

      await serviceManager.initializeAllServicesEnhanced();

      expect(initOrder).toEqual(['serviceA', 'serviceB', 'serviceC']);
    });
  });

  describe('Health Checks with Dependencies', () => {
    it('should use custom health checks for dependencies', async () => {
      let healthCheckCalled = false;
      const serviceA = new MockHealthyService('serviceA');
      const serviceB = new MockHealthyService('serviceB');

      serviceManager.registerServiceEnhanced('serviceB', serviceB);
      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        dependencies: [{
          name: 'serviceB',
          required: true,
          healthCheck: async () => {
            healthCheckCalled = true;
            return true;
          }
        }]
      });

      await serviceManager.initializeAllServicesEnhanced();

      expect(healthCheckCalled).toBe(true);
      expect(serviceA.isReady()).toBe(true);
    });

    it('should handle failing health checks', async () => {
      const serviceA = new MockHealthyService('serviceA');
      const serviceB = new MockHealthyService('serviceB');

      serviceManager.registerServiceEnhanced('serviceB', serviceB);
      serviceManager.registerServiceEnhanced('serviceA', serviceA, {
        dependencies: [{
          name: 'serviceB',
          required: true,
          healthCheck: async () => {
            return false; // Health check fails
          }
        }],
        fallbackStrategy: FallbackStrategy.FAIL
      });

      await expect(serviceManager.initializeAllServicesEnhanced())
        .rejects.toThrow(/unhealthy/);
    });
  });

  describe('Performance', () => {
    it('should handle multiple services efficiently', async () => {
      const serviceCount = 20;
      const services: MockHealthyService[] = [];

      // Register many services
      for (let i = 0; i < serviceCount; i++) {
        const service = new MockHealthyService(`service${i}`);
        services.push(service);
        serviceManager.registerServiceEnhanced(`service${i}`, service, {
          priority: i
        });
      }

      const startTime = Date.now();
      await serviceManager.initializeAllServicesEnhanced();
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (less than 1 second for 20 services)
      expect(duration).toBeLessThan(1000);

      // All services should be ready
      const healthCheck = await serviceManager.healthCheck();
      expect(healthCheck.summary.healthy).toBe(serviceCount);
      expect(healthCheck.summary.total).toBe(serviceCount);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from partial failures', async () => {
      const healthyService = new MockHealthyService('healthyService');
      const failingService = new MockFailingService('failingService');

      serviceManager.registerServiceEnhanced('healthyService', healthyService);
      serviceManager.registerServiceEnhanced('failingService', failingService, {
        fallbackStrategy: FallbackStrategy.MOCK,
        mockProvider: mockServiceProvider
      });

      await serviceManager.initializeAllServicesEnhanced();

      const healthCheck = await serviceManager.healthCheck();
      expect(healthCheck.summary.healthy).toBe(1);
      expect(healthCheck.summary.degraded).toBe(1);
      expect(healthCheck.overall).toBe(ServiceHealth.DEGRADED);
    });
  });
});

describe('Service Integration Scenarios', () => {
  let serviceManager: EnhancedServiceManager;

  beforeEach(() => {
    serviceManager = new EnhancedServiceManager();
  });

  afterEach(async () => {
    try {
      await serviceManager.forceCleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should handle database service failure with mock fallback', async () => {
    const databaseService = new MockFailingService('databaseService');
    const authService = new MockHealthyService('authService');

    serviceManager.registerServiceEnhanced('databaseService', databaseService, {
      fallbackStrategy: FallbackStrategy.MOCK,
      mockProvider: {
        createMock: () => new MockHealthyService('databaseMock'),
        isCompatible: () => true
      }
    });

    serviceManager.registerServiceEnhanced('authService', authService, {
      dependencies: [{ name: 'databaseService', required: true }]
    });

    await serviceManager.initializeAllServicesEnhanced();

    const dbHealth = serviceManager.getServiceHealth('databaseService');
    const authHealth = serviceManager.getServiceHealth('authService');

    expect(dbHealth?.health).toBe(ServiceHealth.DEGRADED);
    expect(authHealth?.health).toBe(ServiceHealth.HEALTHY);

    const dbCapabilities = serviceManager.getServiceCapabilities('databaseService');
    expect(dbCapabilities).toContain('in_memory_storage');
  });

  it('should handle complex dependency chains with partial failures', async () => {
    const configService = new MockHealthyService('configService');
    const databaseService = new MockFailingService('databaseService');
    const authService = new MockHealthyService('authService');
    const emailService = new MockHealthyService('emailService');

    // Register services with complex dependencies
    serviceManager.registerServiceEnhanced('configService', configService, { priority: 1 });

    serviceManager.registerServiceEnhanced('databaseService', databaseService, {
      priority: 2,
      dependencies: [{ name: 'configService', required: true }],
      fallbackStrategy: FallbackStrategy.MOCK,
      mockProvider: {
        createMock: () => new MockHealthyService('databaseMock'),
        isCompatible: () => true
      }
    });

    serviceManager.registerServiceEnhanced('authService', authService, {
      priority: 3,
      dependencies: [
        { name: 'databaseService', required: true },
        { name: 'configService', required: true }
      ],
      fallbackStrategy: FallbackStrategy.DEGRADE
    });

    serviceManager.registerServiceEnhanced('emailService', emailService, {
      priority: 4,
      dependencies: [
        { name: 'authService', required: false },
        { name: 'configService', required: true }
      ]
    });

    await serviceManager.initializeAllServicesEnhanced();

    const healthCheck = await serviceManager.healthCheck();

    expect(healthCheck.services['configService'].health).toBe(ServiceHealth.HEALTHY);
    expect(healthCheck.services['databaseService'].health).toBe(ServiceHealth.DEGRADED);
    expect(healthCheck.services['authService'].health).toBe(ServiceHealth.HEALTHY);
    expect(healthCheck.services['emailService'].health).toBe(ServiceHealth.HEALTHY);

    expect(healthCheck.overall).toBe(ServiceHealth.DEGRADED);
  });
});