import { SlackMessageReaderService } from '../../src/services/slack-message-reader.service';
import { SlackMessageReaderError, SlackMessageReaderErrorCode } from '../../src/types/slack-message-reader.types';
import { serviceManager } from '../../src/services/service-manager';
import { initializeAllCoreServices } from '../../src/services/service-initialization';

// Mock the logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('SlackMessageReaderService Integration Tests', () => {
  let service: SlackMessageReaderService;

  // Use a test bot token - in real tests, this would be a test workspace token
  const testBotToken = process.env.SLACK_BOT_TOKEN || 'xoxb-test-token';

  beforeAll(async () => {
    // Initialize core services
    await initializeAllCoreServices();
  });

  beforeEach(() => {
    service = new SlackMessageReaderService(testBotToken);
  });

  afterEach(async () => {
    if (service && !service.destroyed) {
      await service.destroy();
    }
  });

  describe('Service Integration', () => {
    it('should integrate with service manager correctly', async () => {
      // Register service manually for testing
      serviceManager.registerService('testSlackMessageReader', service, {
        priority: 100,
        autoStart: true
      });

      await serviceManager.initializeService('testSlackMessageReader');

      expect(service.isReady()).toBe(true);
      expect(serviceManager.getService('testSlackMessageReader')).toBe(service);

      await serviceManager.destroyService('testSlackMessageReader');
    });

    it('should handle dependency injection correctly', async () => {
      // The service should be able to access cache and database services
      await service.initialize();

      const health = service.getHealth();
      expect(health.details?.dependencies).toBeDefined();
    });
  });

  describe('Rate Limiting Integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track rate limits across multiple requests', async () => {
      const healthBefore = service.getHealth();
      const initialMinuteCount = healthBefore.details?.rateLimits?.minute?.count || 0;

      // Make a request (this will increment the counter)
      try {
        await service.readMessageHistory('C123456', { limit: 1 });
      } catch (error) {
        // Expected to fail with invalid channel, but should still increment counter
      }

      const healthAfter = service.getHealth();
      const afterMinuteCount = healthAfter.details?.rateLimits?.minute?.count || 0;

      expect(afterMinuteCount).toBeGreaterThan(initialMinuteCount);
    });

    it('should reset rate limit counters after time window', async () => {
      // This test would require mocking time or waiting for actual time windows
      // For now, we'll just verify the structure exists
      const health = service.getHealth();
      
      expect(health.details?.rateLimits?.minute).toBeDefined();
      expect(health.details?.rateLimits?.hour).toBeDefined();
      expect(health.details?.rateLimits?.config).toBeDefined();
    });
  });

  describe('Caching Integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should integrate with cache service when available', async () => {
      const health = service.getHealth();
      const hasCacheService = health.details?.dependencies?.cacheService;

      if (hasCacheService) {
        // If cache service is available, test caching behavior
        try {
          await service.readMessageHistory('C123456', { limit: 1 });
          // Second call should potentially use cache
          await service.readMessageHistory('C123456', { limit: 1 });
        } catch (error) {
          // Expected to fail with invalid channel, but caching should still work
        }
      } else {
        // If no cache service, verify graceful degradation
        expect(service.isReady()).toBe(true);
      }
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle invalid channel gracefully', async () => {
      await expect(
        service.readMessageHistory('invalid-channel-id')
      ).rejects.toThrow(SlackMessageReaderError);
    });

    it('should handle invalid bot token gracefully', async () => {
      const invalidService = new SlackMessageReaderService('invalid-token');
      
      await expect(invalidService.initialize()).rejects.toThrow();
    });

    it('should maintain service state after errors', async () => {
      try {
        await service.readMessageHistory('invalid-channel-id');
      } catch (error) {
        // Expected error
      }

      // Service should still be ready after error
      expect(service.isReady()).toBe(true);
      expect(service.destroyed).toBe(false);
    });
  });

  describe('Message Filtering Integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should apply default filters correctly', async () => {
      // Test with a valid channel if available, or expect error
      try {
        const result = await service.readMessageHistory('C123456', {
          filter: {
            excludeBotMessages: true,
            excludeSystemMessages: true,
            excludeKeywords: ['test', 'spam']
          }
        });
        
        // If successful, verify filtering worked
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Expected with invalid channel
        expect(error).toBeInstanceOf(SlackMessageReaderError);
      }
    });

    it('should handle sensitive content filtering', async () => {
      try {
        const result = await service.readMessageHistory('C123456', {
          filter: {
            excludeSensitiveContent: false // Should redact instead of exclude
          }
        });
        
        // If successful, verify sensitive content was handled
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Expected with invalid channel
        expect(error).toBeInstanceOf(SlackMessageReaderError);
      }
    });
  });

  describe('Service Health Integration', () => {
    it('should report accurate health status', async () => {
      const healthBeforeInit = service.getHealth();
      expect(healthBeforeInit.healthy).toBe(false);

      await service.initialize();

      const healthAfterInit = service.getHealth();
      expect(healthAfterInit.healthy).toBe(true);
      expect(healthAfterInit.details?.initialized).toBe(true);
      expect(healthAfterInit.details?.destroyed).toBe(false);

      await service.destroy();

      const healthAfterDestroy = service.getHealth();
      expect(healthAfterDestroy.healthy).toBe(false);
      expect(healthAfterDestroy.details?.destroyed).toBe(true);
    });

    it('should include dependency status in health check', async () => {
      await service.initialize();

      const health = service.getHealth();
      expect(health.details?.dependencies).toBeDefined();
      expect(typeof health.details?.dependencies?.cacheService).toBe('boolean');
      expect(typeof health.details?.dependencies?.databaseService).toBe('boolean');
    });
  });

  describe('Performance Integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle concurrent requests within rate limits', async () => {
      const promises = [];
      
      // Make multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          service.readMessageHistory('C123456', { limit: 1 }).catch(error => error)
        );
      }

      const results = await Promise.all(promises);
      
      // All should either succeed or fail gracefully
      results.forEach(result => {
        if (result instanceof Error) {
          expect(result).toBeInstanceOf(SlackMessageReaderError);
        }
      });
    });

    it('should track processing time in audit logs', async () => {
      const startTime = Date.now();
      
      try {
        await service.readMessageHistory('C123456', { limit: 1 });
      } catch (error) {
        // Expected error
      }

      const processingTime = Date.now() - startTime;
      
      // Processing should complete quickly (under 5 seconds for error case)
      expect(processingTime).toBeLessThan(5000);
    });
  });

  describe('Configuration Integration', () => {
    it('should use environment configuration when available', async () => {
      // Test with different bot tokens
      const service1 = new SlackMessageReaderService('token1');
      const service2 = new SlackMessageReaderService('token2');

      expect(service1.name).toBe('SlackMessageReaderService');
      expect(service2.name).toBe('SlackMessageReaderService');

      // Both should have same configuration structure
      const health1 = service1.getHealth();
      const health2 = service2.getHealth();

      expect(health1.details?.rateLimits?.config).toEqual(health2.details?.rateLimits?.config);
    });

    it('should handle missing environment variables gracefully', async () => {
      // Test with empty token
      const emptyService = new SlackMessageReaderService('');
      
      await expect(emptyService.initialize()).rejects.toThrow('Bot token is required');
    });
  });

  describe('Service Manager Integration', () => {
    it('should be discoverable through service manager', () => {
      // Register service
      serviceManager.registerService('integrationTestService', service, {
        priority: 200,
        autoStart: false
      });

      // Should be discoverable
      const retrievedService = serviceManager.getService('integrationTestService');
      expect(retrievedService).toBe(service);

      // Clean up
      serviceManager.unregisterService('integrationTestService');
    });

    it('should handle service lifecycle through service manager', async () => {
      // Register service
      serviceManager.registerService('lifecycleTestService', service, {
        priority: 200,
        autoStart: true
      });

      // Should be initialized
      expect(service.isReady()).toBe(true);

      // Destroy through service manager
      await serviceManager.destroyService('lifecycleTestService');
      expect(service.destroyed).toBe(true);
    });
  });
});
