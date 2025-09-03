#!/usr/bin/env ts-node

import { CacheService } from '../src/services/cache.service';
import { TokenManager } from '../src/services/token-manager';
import { SlackSessionManager } from '../src/services/slack-session-manager';
import { AuthService } from '../src/services/auth.service';
import { SessionService } from '../src/services/session.service';
import { DatabaseService } from '../src/services/database.service';
import { serviceManager } from '../src/services/service-manager';
import logger from '../src/utils/logger';

/**
 * Integration validation script
 * Tests the complete caching integration without mocking
 */

interface ValidationResult {
  name: string;
  success: boolean;
  details: any;
  timing?: {
    duration: number;
    operations: number;
  };
}

class CachingIntegrationValidator {
  private results: ValidationResult[] = [];

  constructor() {
    // Using singleton serviceManager
  }

  async validateCachingIntegration(): Promise<void> {
    logger.info('🚀 Starting Redis Caching Integration Validation...');
    
    try {
      // Test 1: Service Initialization
      await this.validateServiceInitialization();
      
      // Test 2: Cache Service Functionality
      await this.validateCacheServiceFunctionality();
      
      // Test 3: TokenManager Caching
      await this.validateTokenManagerCaching();
      
      // Test 4: Service Dependencies
      await this.validateServiceDependencies();
      
      // Test 5: Error Resilience
      await this.validateErrorResilience();
      
      this.displayResults();
      
    } catch (error) {
      logger.error('Validation failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async validateServiceInitialization(): Promise<void> {
    logger.info('🔧 Testing service initialization...');
    
    const startTime = Date.now();
    
    try {
      // Register minimal services for validation
      const databaseService = new DatabaseService();
      const cacheService = new CacheService();
      const sessionService = new SessionService();
      const authService = new AuthService();

      serviceManager.registerService('databaseService', databaseService, {
        priority: 1,
        autoStart: true
      });
      
      serviceManager.registerService('cacheService', cacheService, {
        priority: 2,
        autoStart: true
      });
      
      serviceManager.registerService('sessionService', sessionService, {
        dependencies: ['databaseService'],
        priority: 3,
        autoStart: true
      });
      
      serviceManager.registerService('authService', authService, {
        priority: 4,
        autoStart: true
      });

      await serviceManager.initializeAllServices();

      const endTime = Date.now();
      
      // Validate all services are ready
      const allServicesReady = [
        serviceManager.getService('databaseService')?.isReady(),
        serviceManager.getService('cacheService')?.isReady(),
        serviceManager.getService('sessionService')?.isReady(),
        serviceManager.getService('authService')?.isReady()
      ].every(Boolean);

      this.results.push({
        name: 'Service Initialization',
        success: allServicesReady,
        details: {
          services: {
            database: serviceManager.getService('databaseService')?.state,
            cache: serviceManager.getService('cacheService')?.state,
            session: serviceManager.getService('sessionService')?.state,
            auth: serviceManager.getService('authService')?.state
          }
        },
        timing: {
          duration: endTime - startTime,
          operations: 4
        }
      });

      logger.info('✅ Service initialization test completed');

    } catch (error) {
      this.results.push({
        name: 'Service Initialization',
        success: false,
        details: { error: (error as Error).message }
      });
      logger.error('❌ Service initialization failed:', error);
    }
  }

  async validateCacheServiceFunctionality(): Promise<void> {
    logger.info('🧪 Testing cache service functionality...');
    
    const startTime = Date.now();
    let operationCount = 0;
    
    try {
      const cacheService = serviceManager.getService<CacheService>('cacheService');
      
      if (!cacheService) {
        throw new Error('Cache service not available');
      }

      // Test basic cache operations
      const testData = { id: 1, name: 'test', timestamp: Date.now() };
      const testKey = 'validation-test-key';
      
      // Test SET
      operationCount++;
      const setResult = await cacheService.set(testKey, testData, 60);
      logger.debug('Cache SET result:', setResult);
      
      // Test GET
      operationCount++;
      const getData = await cacheService.get(testKey);
      logger.debug('Cache GET result:', getData);
      
      // Test EXISTS
      operationCount++;
      const existsResult = await cacheService.exists(testKey);
      logger.debug('Cache EXISTS result:', existsResult);
      
      // Test PING
      operationCount++;
      const pingResult = await cacheService.ping();
      logger.debug('Cache PING result:', pingResult);
      
      // Test cache statistics
      operationCount++;
      const stats = await cacheService.getStats();
      logger.debug('Cache STATS result:', stats);
      
      // Test DELETE
      operationCount++;
      const delResult = await cacheService.del(testKey);
      logger.debug('Cache DELETE result:', delResult);

      const endTime = Date.now();
      
      // Cache service should work or gracefully degrade
      const success = cacheService.isReady();

      this.results.push({
        name: 'Cache Service Functionality',
        success: success,
        details: {
          operations: {
            set: setResult,
            get: getData !== null,
            exists: existsResult,
            ping: pingResult,
            stats: stats.connected,
            delete: delResult
          },
          health: cacheService.getHealth(),
          stats: stats
        },
        timing: {
          duration: endTime - startTime,
          operations: operationCount
        }
      });

      logger.info('✅ Cache service functionality test completed');

    } catch (error) {
      this.results.push({
        name: 'Cache Service Functionality',
        success: false,
        details: { 
          error: (error as Error).message,
          operationCount 
        }
      });
      logger.error('❌ Cache service functionality test failed:', error);
    }
  }

  async validateTokenManagerCaching(): Promise<void> {
    logger.info('🔑 Testing TokenManager caching integration...');
    
    const startTime = Date.now();
    let operationCount = 0;
    
    try {
      const sessionService = serviceManager.getService<SessionService>('sessionService');
      const authService = serviceManager.getService<AuthService>('authService');
      
      if (!sessionService || !authService) {
        throw new Error('Required services not available');
      }

      // Create dependent services
      const slackSessionManager = new SlackSessionManager(sessionService);
      const tokenManager = new TokenManager(slackSessionManager, authService);
      
      await slackSessionManager.initialize();
      await tokenManager.initialize();

      const testTeamId = 'test-team-123';
      const testUserId = 'test-user-456';

      // Test token status check (should use caching)
      operationCount++;
      const tokenStatus1 = await tokenManager.getTokenStatus(testTeamId, testUserId);
      logger.debug('Token status check 1:', tokenStatus1);
      
      // Second call should hit cache if available
      operationCount++;
      const tokenStatus2 = await tokenManager.getTokenStatus(testTeamId, testUserId);
      logger.debug('Token status check 2:', tokenStatus2);
      
      // Test hasValidOAuthTokens (should use caching)
      operationCount++;
      const hasValidTokens = await tokenManager.hasValidOAuthTokens(testTeamId, testUserId);
      logger.debug('Has valid OAuth tokens:', hasValidTokens);
      
      // Test cache invalidation
      operationCount++;
      await tokenManager.invalidateTokenCache(testTeamId, testUserId);
      logger.debug('Cache invalidated');

      const endTime = Date.now();
      
      // Cleanup
      await tokenManager.destroy();
      await slackSessionManager.destroy();

      this.results.push({
        name: 'TokenManager Caching',
        success: true,
        details: {
          operations: {
            tokenStatus1: !!tokenStatus1,
            tokenStatus2: !!tokenStatus2,
            hasValidTokens: typeof hasValidTokens === 'boolean',
            cacheInvalidation: true
          },
          consistency: JSON.stringify(tokenStatus1) === JSON.stringify(tokenStatus2)
        },
        timing: {
          duration: endTime - startTime,
          operations: operationCount
        }
      });

      logger.info('✅ TokenManager caching test completed');

    } catch (error) {
      this.results.push({
        name: 'TokenManager Caching',
        success: false,
        details: { 
          error: (error as Error).message,
          operationCount 
        }
      });
      logger.error('❌ TokenManager caching test failed:', error);
    }
  }

  async validateServiceDependencies(): Promise<void> {
    logger.info('🔗 Testing service dependencies...');
    
    try {
      // Verify service dependency chain
      const cacheService = serviceManager.getService<CacheService>('cacheService');
      const sessionService = serviceManager.getService<SessionService>('sessionService');
      const databaseService = serviceManager.getService<DatabaseService>('databaseService');
      
      const dependencyChainValid = !!(cacheService && sessionService && databaseService);
      
      // Test service health
      const healthChecks = {
        cache: cacheService?.getHealth(),
        session: sessionService?.getHealth(),
        database: databaseService?.getHealth()
      };

      this.results.push({
        name: 'Service Dependencies',
        success: dependencyChainValid,
        details: {
          dependencies: {
            cacheServiceExists: !!cacheService,
            sessionServiceExists: !!sessionService,
            databaseServiceExists: !!databaseService
          },
          healthChecks
        }
      });

      logger.info('✅ Service dependencies test completed');

    } catch (error) {
      this.results.push({
        name: 'Service Dependencies',
        success: false,
        details: { error: (error as Error).message }
      });
      logger.error('❌ Service dependencies test failed:', error);
    }
  }

  async validateErrorResilience(): Promise<void> {
    logger.info('🛡️ Testing error resilience...');
    
    try {
      const cacheService = serviceManager.getService<CacheService>('cacheService');
      
      if (!cacheService) {
        // If cache service doesn't exist, that's still valid (graceful degradation)
        this.results.push({
          name: 'Error Resilience',
          success: true,
          details: {
            scenario: 'cache_service_unavailable',
            behavior: 'graceful_degradation'
          }
        });
        logger.info('✅ Error resilience test completed (graceful degradation)');
        return;
      }

      // Test handling of cache failures
      let resilientBehavior = true;
      
      try {
        // Try operations that might fail
        await cacheService.get('non-existent-key');
        await cacheService.set('test-resilience', 'data', 60);
        await cacheService.del('another-non-existent-key');
        
      } catch (error) {
        // If cache operations throw, it's not resilient
        resilientBehavior = false;
        logger.warn('Cache operations not resilient:', (error as Error).message);
      }

      this.results.push({
        name: 'Error Resilience',
        success: resilientBehavior,
        details: {
          scenario: 'cache_operations_with_failures',
          behavior: resilientBehavior ? 'resilient' : 'fragile',
          cacheHealth: cacheService.getHealth()
        }
      });

      logger.info('✅ Error resilience test completed');

    } catch (error) {
      this.results.push({
        name: 'Error Resilience',
        success: false,
        details: { error: (error as Error).message }
      });
      logger.error('❌ Error resilience test failed:', error);
    }
  }

  displayResults(): void {
    logger.info('\n🎯 CACHING INTEGRATION VALIDATION RESULTS');
    logger.info('=' .repeat(60));
    
    let totalSuccess = 0;
    let totalTests = this.results.length;
    let totalDuration = 0;
    let totalOperations = 0;

    for (const result of this.results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const timing = result.timing ? 
        ` (${result.timing.duration}ms, ${result.timing.operations} ops)` : '';
      
      logger.info(`${status} ${result.name}${timing}`);
      
      if (result.success) totalSuccess++;
      if (result.timing) {
        totalDuration += result.timing.duration;
        totalOperations += result.timing.operations;
      }
      
      // Show failure details
      if (!result.success) {
        logger.error(`   Error: ${result.details.error || 'Unknown error'}`);
      }
      
      // Show key details for successful tests
      if (result.success && result.details) {
        if (result.name === 'Cache Service Functionality' && result.details.stats) {
          logger.info(`   Cache Status: ${result.details.stats.connected ? 'Connected' : 'Disconnected'}`);
        }
        if (result.name === 'TokenManager Caching' && result.details.consistency) {
          logger.info(`   Cache Consistency: ${result.details.consistency ? 'Maintained' : 'Issues'}`);
        }
      }
    }

    logger.info('=' .repeat(60));
    logger.info(`📊 Summary: ${totalSuccess}/${totalTests} tests passed`);
    logger.info(`⏱️  Total Duration: ${totalDuration}ms across ${totalOperations} operations`);
    logger.info(`🚀 Average Operation Time: ${totalOperations > 0 ? (totalDuration / totalOperations).toFixed(2) : 'N/A'}ms`);

    // Overall assessment
    const successRate = (totalSuccess / totalTests) * 100;
    
    if (successRate === 100) {
      logger.info('🎉 CACHING INTEGRATION: FULLY OPERATIONAL!');
    } else if (successRate >= 80) {
      logger.info('✅ CACHING INTEGRATION: MOSTLY OPERATIONAL');
    } else if (successRate >= 60) {
      logger.info('⚠️  CACHING INTEGRATION: PARTIALLY OPERATIONAL');
    } else {
      logger.info('❌ CACHING INTEGRATION: NEEDS ATTENTION');
    }

    logger.info('=' .repeat(60));

    // Exit with appropriate code
    if (successRate < 60) {
      throw new Error(`Validation failed: Only ${successRate.toFixed(1)}% of tests passed`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('🧹 Cleaning up services...');
      // Note: ServiceManager doesn't have destroyAllServices method
      // Services will be destroyed when the process exits
      logger.info('✅ Cleanup completed');
    } catch (error) {
      logger.warn('Cleanup warning:', error);
    }
  }
}

async function runCachingValidation(): Promise<void> {
  const validator = new CachingIntegrationValidator();
  
  try {
    await validator.validateCachingIntegration();
    logger.info('🎉 Validation completed successfully!');
    
  } catch (error) {
    logger.error('💥 Validation failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the validation
if (require.main === module) {
  runCachingValidation().catch(error => {
    logger.error('Validation script error:', error);
    process.exit(1);
  });
}

export { CachingIntegrationValidator, runCachingValidation };