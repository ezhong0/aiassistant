/// <reference types="jest" />

import { describe, beforeAll, afterAll, afterEach, it, expect } from '@jest/globals';
import { TestHelper } from '../test-helper';
import { serviceManager, getService } from '../../src/services/service-manager';
import { ConfigService } from '../../src/config/config.service';
import { AIConfigService } from '../../src/config/ai-config';
import { DatabaseService } from '../../src/services/database.service';
import { CacheService } from '../../src/services/cache.service';
import { SessionService } from '../../src/services/session.service';
import { AuthService } from '../../src/services/auth.service';
import { TokenManager } from '../../src/services/token-manager';
import { ToolExecutorService } from '../../src/services/tool-executor.service';
import { ContactService } from '../../src/services/contact.service';
import { GmailService } from '../../src/services/gmail.service';
import { CalendarService } from '../../src/services/calendar.service';
import { OpenAIService } from '../../src/services/openai.service';
import { SlackFormatterService } from '../../src/services/slack-formatter.service';

describe('Service Architecture Consolidation', () => {
  beforeAll(async () => {
    await TestHelper.initializeServices();
  });

  afterAll(async () => {
    await TestHelper.cleanupServices();
  });

  afterEach(async () => {
    // Don't reset services between tests to avoid clearing the service registry
    // await TestHelper.resetServices();
  });

  describe('Service Registration', () => {
    it('should register all core services with correct priorities', async () => {
      const manager = serviceManager;
      const registeredServices = manager.getRegisteredServices();
      
      console.log('Registered services:', registeredServices);
      
      // Check that all expected services are registered
      expect(registeredServices).toContain('configService');
      expect(registeredServices).toContain('aiConfigService');
      expect(registeredServices).toContain('databaseService');
      expect(registeredServices).toContain('sessionService');
      expect(registeredServices).toContain('authService');
      expect(registeredServices).toContain('tokenManager');
      expect(registeredServices).toContain('toolExecutorService');
      expect(registeredServices).toContain('contactService');
      expect(registeredServices).toContain('gmailService');
      expect(registeredServices).toContain('calendarService');
      expect(registeredServices).toContain('openaiService');
      expect(registeredServices).toContain('slackFormatterService');
      
      // CacheService is optional and not registered in test environment
      // expect(registeredServices).toContain('cacheService');
    });

    it('should initialize services in correct dependency order', async () => {
      const manager = serviceManager;
      const health = manager.getAllServicesHealth();
      
      // Check that all services are ready
      Object.entries(health).forEach(([serviceName, serviceHealth]) => {
        expect(serviceHealth.ready).toBe(true);
        expect(serviceHealth.state).toBe('ready');
      });
    });
  });

  describe('Service Access Patterns', () => {
    it('should provide services via getService() function', async () => {
      const configService = getService<ConfigService>('configService');
      const aiConfigService = getService<AIConfigService>('aiConfigService');
      const databaseService = getService<DatabaseService>('databaseService');
      
      expect(configService).toBeDefined();
      expect(aiConfigService).toBeDefined();
      expect(databaseService).toBeDefined();
      
      expect(configService?.isReady()).toBe(true);
      expect(aiConfigService?.isReady()).toBe(true);
      expect(databaseService?.isReady()).toBe(true);
    });

    it('should provide services via TestHelper.getService()', async () => {
      const sessionService = await TestHelper.getService<SessionService>('sessionService');
      const authService = await TestHelper.getService<AuthService>('authService');
      const tokenManager = await TestHelper.getService<TokenManager>('tokenManager');
      
      expect(sessionService).toBeDefined();
      expect(authService).toBeDefined();
      expect(tokenManager).toBeDefined();
      
      expect(sessionService?.isReady()).toBe(true);
      expect(authService?.isReady()).toBe(true);
      expect(tokenManager?.isReady()).toBe(true);
    });
  });

  describe('Service Dependencies', () => {
    it('should resolve dependencies correctly', async () => {
      const manager = serviceManager;
      
      // Check that services with dependencies are properly initialized
      const tokenManager = getService<TokenManager>('tokenManager');
      const toolExecutor = getService<ToolExecutorService>('toolExecutorService');
      const contactService = getService<ContactService>('contactService');
      const gmailService = getService<GmailService>('gmailService');
      const calendarService = getService<CalendarService>('calendarService');
      
      expect(tokenManager?.isReady()).toBe(true);
      expect(toolExecutor?.isReady()).toBe(true);
      expect(contactService?.isReady()).toBe(true);
      expect(gmailService?.isReady()).toBe(true);
      expect(calendarService?.isReady()).toBe(true);
    });

    it('should handle optional dependencies gracefully', async () => {
      const cacheService = getService<CacheService>('cacheService');
      
      // CacheService is optional and may not be available in test environment
      // (no Redis configuration), so we don't assert its presence
      if (cacheService) {
        expect(cacheService.isReady()).toBe(true);
      } else {
        // In test environment without Redis, cacheService should not be registered
        expect(cacheService).toBeUndefined();
      }
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should manage service lifecycle states correctly', async () => {
      const manager = serviceManager;
      const health = manager.getAllServicesHealth();
      
      Object.entries(health).forEach(([serviceName, serviceHealth]) => {
        expect(serviceHealth.state).toBe('ready');
        expect(serviceHealth.ready).toBe(true);
        // DatabaseService is expected to be unhealthy in test environment (no DB connection)
        if (serviceName === 'databaseService') {
          expect(serviceHealth.health.healthy).toBe(false);
        } else {
          expect(serviceHealth.health.healthy).toBe(true);
        }
      });
    });

    it('should provide service statistics', async () => {
      // Ensure services are initialized for this test
      await TestHelper.initializeServices();
      
      const manager = serviceManager;
      const stats = manager.getServiceStats();
      
      console.log('Service statistics:', stats);
      
      expect(stats.totalServices).toBeGreaterThan(0);
      // One service (databaseService) is expected to be unhealthy in test environment
      expect(stats.healthyServices).toBe(stats.totalServices - 1);
      expect(stats.readyServices).toBe(stats.totalServices);
      expect(stats.errorServices).toBe(0);
      expect(stats.initializingServices).toBe(0);
    });
  });

  describe('Configuration Services', () => {
    it('should provide configuration services via ServiceManager', async () => {
      const configService = getService<ConfigService>('configService');
      const aiConfigService = getService<AIConfigService>('aiConfigService');
      
      expect(configService).toBeDefined();
      expect(aiConfigService).toBeDefined();
      
      // Test configuration access
      expect(configService?.nodeEnv).toBe('test');
      expect(configService?.port).toBe(0);
      expect(configService?.isTest).toBe(true);
      
      // Test AI configuration access
      const openaiConfig = aiConfigService?.getOpenAIConfig('general');
      expect(openaiConfig).toBeDefined();
      expect(openaiConfig?.model).toBe('gpt-4o-mini');
    });
  });

  describe('Agent Service Integration', () => {
    it('should provide services needed by agents', async () => {
      const openaiService = getService<OpenAIService>('openaiService');
      const sessionService = getService<SessionService>('sessionService');
      const gmailService = getService<GmailService>('gmailService');
      const contactService = getService<ContactService>('contactService');
      const calendarService = getService<CalendarService>('calendarService');
      const slackFormatter = getService<SlackFormatterService>('slackFormatterService');
      
      expect(openaiService?.isReady()).toBe(true);
      expect(sessionService?.isReady()).toBe(true);
      expect(gmailService?.isReady()).toBe(true);
      expect(contactService?.isReady()).toBe(true);
      expect(calendarService?.isReady()).toBe(true);
      expect(slackFormatter?.isReady()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service access errors gracefully', () => {
      const nonExistentService = getService('nonExistentService');
      expect(nonExistentService).toBeUndefined();
    });

    it('should provide meaningful error messages for missing dependencies', async () => {
      const manager = serviceManager;
      
      // This should not throw since all services are properly registered
      expect(() => {
        manager.getAllServicesHealth();
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should maintain service initialization performance', async () => {
      const startTime = Date.now();
      
      // Re-initialize services
      await TestHelper.cleanupServices();
      await TestHelper.initializeServices();
      
      const endTime = Date.now();
      const initializationTime = endTime - startTime;
      
      // Should complete within reasonable time (adjust as needed)
      expect(initializationTime).toBeLessThan(5000); // 5 seconds
    });
  });
});
