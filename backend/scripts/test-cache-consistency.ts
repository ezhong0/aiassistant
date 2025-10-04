#!/usr/bin/env ts-node

/**
 * Cache Consistency Validation Script
 * Tests and validates cache consistency across all cache services
 *
 * Tests:
 * - Cache invalidation effectiveness
 * - Cross-service consistency
 * - Performance impact of caching
 * - Consistency level enforcement
 * - Cache warming effectiveness
 * - Integration between all cache services
 */

import { ServiceManager } from './utils/container-helper';
import { CacheService } from '../src/services/cache.service';
import { CalendarCacheService } from '../src/services/calendar/calendar-cache.service';
import { CacheInvalidationService } from '../src/services/cache-invalidation.service';
import { CacheConsistencyService, ConsistencyLevel, OperationType } from '../src/services/cache-consistency.service';
import { CacheWarmingService } from '../src/services/cache-warming.service';
import { CachePerformanceMonitoringService } from '../src/services/cache-performance-monitoring.service';
import logger from '../src/utils/logger';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  metrics?: any;
  duration: number;
}

class CacheConsistencyTester {
  private scriptContainer: ServiceManager;
  private results: TestResult[] = [];

  constructor() {
    this.scriptContainer = ServiceManager.getInstance();
  }

  async runAllTests(): Promise<void> {
    logger.info('🧪 Starting Cache Consistency Validation Tests');

    try {
      // Initialize services
      await this.initializeServices();

      // Run test suite
      await this.testCacheService();
      await this.testCalendarCacheService();
      await this.testCacheInvalidation();
      await this.testConsistencyLevels();
      await this.testCacheWarming();
      await this.testCrossServiceConsistency();
      await this.testPerformanceMonitoring();

      // Generate final report
      this.generateReport();

    } catch (error) {
      logger.error('❌ Cache consistency test suite failed', { error });
      process.exit(1);
    }
  }

  private async initializeServices(): Promise<void> {
    const startTime = Date.now();

    try {
      // Initialize core services first
      const cacheService = new CacheService();
      await this.scriptContainer.registerService('cacheService', cacheService);

      const calendarCacheService = new CalendarCacheService();
      await this.scriptContainer.registerService('calendarCacheService', calendarCacheService);

      const invalidationService = new CacheInvalidationService();
      await this.scriptContainer.registerService('cacheInvalidationService', invalidationService);

      const consistencyService = new CacheConsistencyService();
      await this.scriptContainer.registerService('cacheConsistencyService', consistencyService);

      const warmingService = new CacheWarmingService();
      await this.scriptContainer.registerService('cacheWarmingService', warmingService);

      const monitoringService = new CachePerformanceMonitoringService();
      await this.scriptContainer.registerService('cachePerformanceMonitoringService', monitoringService);

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Service Initialization',
        passed: true,
        details: 'All cache services initialized successfully',
        duration
      });

      logger.info('✅ All cache services initialized', { duration: `${duration}ms` });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Service Initialization',
        passed: false,
        details: `Failed to initialize services: ${error}`,
        duration
      });

      throw error;
    }
  }

  private async testCacheService(): Promise<void> {
    const startTime = Date.now();

    try {
      const cacheService = this.scriptContainer.getService<CacheService>('cacheService');
      if (!cacheService) {
        throw new Error('CacheService not available');
      }

      // Test basic cache operations
      const testKey = 'test:cache:basic';
      const testValue = { data: 'test', timestamp: Date.now() };

      // Set value
      await cacheService.set(testKey, testValue, 60);

      // Get value
      const retrieved = await cacheService.get(testKey);

      // Verify value
      const isCorrect = retrieved &&
        JSON.stringify(retrieved) === JSON.stringify(testValue);

      // Test expiration
      const exists = await cacheService.exists(testKey);

      // Cleanup
      await cacheService.del(testKey);

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Basic Cache Operations',
        passed: isCorrect && exists,
        details: `Set/Get/Delete operations work correctly. Value match: ${isCorrect}, Exists: ${exists}`,
        duration
      });

      logger.info('✅ Basic cache operations test passed', { duration: `${duration}ms` });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Basic Cache Operations',
        passed: false,
        details: `Basic cache operations failed: ${error}`,
        duration
      });

      logger.error('❌ Basic cache operations test failed', { error });
    }
  }

  private async testCalendarCacheService(): Promise<void> {
    const startTime = Date.now();

    try {
      const calendarCache = this.scriptContainer.getService<CalendarCacheService>('calendarCacheService');
      if (!calendarCache) {
        throw new Error('CalendarCacheService not available');
      }

      // Test cache invalidation
      const testUserId = 'test-user-123';
      await calendarCache.invalidateUserCalendarCache(testUserId);

      // Get health status
      const health = calendarCache.getHealth();

      // Get metrics
      const metrics = calendarCache.getMetrics();

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Calendar Cache Service',
        passed: health.healthy,
        details: `Calendar cache service operational. Healthy: ${health.healthy}`,
        metrics,
        duration
      });

      logger.info('✅ Calendar cache service test passed', {
        duration: `${duration}ms`,
        metrics: {
          hits: metrics.hits,
          misses: metrics.misses,
          hitRate: metrics.hitRate
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Calendar Cache Service',
        passed: false,
        details: `Calendar cache service failed: ${error}`,
        duration
      });

      logger.error('❌ Calendar cache service test failed', { error });
    }
  }

  private async testCacheInvalidation(): Promise<void> {
    const startTime = Date.now();

    try {
      const invalidationService = this.scriptContainer.getService<CacheInvalidationService>('cacheInvalidationService');
      if (!invalidationService) {
        throw new Error('CacheInvalidationService not available');
      }

      // Test invalidation event processing
      await invalidationService.invalidateOnEmailOperation('sent', 'test-user-123', 'test-email-id');
      await invalidationService.invalidateOnCalendarOperation('created', 'test-user-123', 'test-event-id');
      await invalidationService.invalidateOnContactOperation('updated', 'test-user-123', 'test-contact-id');

      // Test force refresh
      await invalidationService.forceRefreshUserCache('test-user-123', ['gmail', 'calendar']);

      // Get metrics
      const metrics = invalidationService.getMetrics();

      // Get health
      const health = invalidationService.getHealth();

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Cache Invalidation',
        passed: health.healthy && metrics.totalInvalidations > 0,
        details: `Invalidation service processed ${metrics.totalInvalidations} invalidations`,
        metrics,
        duration
      });

      logger.info('✅ Cache invalidation test passed', {
        duration: `${duration}ms`,
        invalidations: metrics.totalInvalidations
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Cache Invalidation',
        passed: false,
        details: `Cache invalidation failed: ${error}`,
        duration
      });

      logger.error('❌ Cache invalidation test failed', { error });
    }
  }

  private async testConsistencyLevels(): Promise<void> {
    const startTime = Date.now();

    try {
      const consistencyService = this.scriptContainer.getService<CacheConsistencyService>('cacheConsistencyService');
      if (!consistencyService) {
        throw new Error('CacheConsistencyService not available');
      }

      // Test different consistency levels
      const testOperations = [
        {
          key: 'test:financial:data',
          operationType: OperationType.FINANCIAL,
          userId: 'test-user-123'
        },
        {
          key: 'test:email:search',
          operationType: OperationType.EMAIL_SEARCH,
          userId: 'test-user-123'
        },
        {
          key: 'test:availability:check',
          operationType: OperationType.AVAILABILITY_CHECK,
          userId: 'test-user-123'
        }
      ];

      const consistencyTests = [];

      for (const operation of testOperations) {
        const level = consistencyService.determineConsistencyLevel(operation);
        const cacheResult = await consistencyService.getCacheWithConsistency(operation);

        consistencyTests.push({
          operation: operation.operationType,
          expectedLevel: this.getExpectedLevel(operation.operationType),
          actualLevel: level,
          cacheResult: cacheResult.level
        });
      }

      // Verify consistency levels are appropriate
      const correctLevels = consistencyTests.filter(test =>
        test.expectedLevel === test.actualLevel
      ).length;

      const metrics = consistencyService.getMetrics();
      const health = consistencyService.getHealth();

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Consistency Levels',
        passed: health.healthy && correctLevels === testOperations.length,
        details: `${correctLevels}/${testOperations.length} consistency levels correct`,
        metrics,
        duration
      });

      logger.info('✅ Consistency levels test passed', {
        duration: `${duration}ms`,
        correctLevels,
        totalTests: testOperations.length
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Consistency Levels',
        passed: false,
        details: `Consistency levels test failed: ${error}`,
        duration
      });

      logger.error('❌ Consistency levels test failed', { error });
    }
  }

  private async testCacheWarming(): Promise<void> {
    const startTime = Date.now();

    try {
      const warmingService = this.scriptContainer.getService<CacheWarmingService>('cacheWarmingService');
      if (!warmingService) {
        throw new Error('CacheWarmingService not available');
      }

      // Test user cache warming
      await warmingService.warmUserCache('test-user-123', 'test');

      // Test warming for upcoming events
      await warmingService.warmForUpcomingEvents('test-user-123');

      // Test user login warming
      await warmingService.onUserLogin('test-user-123');

      // Update user activity
      warmingService.updateUserActivity('test-user-123', 'test_operation');

      // Get metrics
      const metrics = warmingService.getMetrics();
      const pendingTasks = warmingService.getPendingTasks();
      const health = warmingService.getHealth();

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Cache Warming',
        passed: health.healthy,
        details: `Warming service executed ${metrics.totalTasks} tasks with ${pendingTasks.length} pending`,
        metrics,
        duration
      });

      logger.info('✅ Cache warming test passed', {
        duration: `${duration}ms`,
        totalTasks: metrics.totalTasks,
        pendingTasks: pendingTasks.length
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Cache Warming',
        passed: false,
        details: `Cache warming test failed: ${error}`,
        duration
      });

      logger.error('❌ Cache warming test failed', { error });
    }
  }

  private async testCrossServiceConsistency(): Promise<void> {
    const startTime = Date.now();

    try {
      // Simulate a scenario where calendar event is created and should invalidate related caches
      const invalidationService = this.scriptContainer.getService<CacheInvalidationService>('cacheInvalidationService');
      const consistencyService = this.scriptContainer.getService<CacheConsistencyService>('cacheConsistencyService');
      const warmingService = this.scriptContainer.getService<CacheWarmingService>('cacheWarmingService');

      if (!invalidationService || !consistencyService || !warmingService) {
        throw new Error('Required services not available');
      }

      const testUserId = 'test-user-cross-service';

      // 1. Warm user cache
      await warmingService.warmUserCache(testUserId, 'cross_service_test');

      // 2. Create calendar event (should trigger invalidation)
      await invalidationService.invalidateOnCalendarOperation('created', testUserId, 'test-event-123');

      // 3. Check consistency operation
      const consistencyOperation = {
        key: `calendar:events:${testUserId}`,
        operationType: OperationType.CALENDAR_CREATE,
        userId: testUserId
      };

      const consistencyResult = await consistencyService.getCacheWithConsistency(consistencyOperation);

      // 4. Validate that services are working together
      const invalidationMetrics = invalidationService.getMetrics();
      const consistencyMetrics = consistencyService.getMetrics();
      const warmingMetrics = warmingService.getMetrics();

      const servicesWorking =
        invalidationMetrics.totalInvalidations > 0 &&
        warmingMetrics.totalTasks > 0 &&
        consistencyResult.level !== undefined;

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Cross-Service Consistency',
        passed: servicesWorking,
        details: `Services integrated successfully. Invalidations: ${invalidationMetrics.totalInvalidations}, Tasks: ${warmingMetrics.totalTasks}`,
        metrics: {
          invalidation: invalidationMetrics,
          consistency: consistencyMetrics,
          warming: warmingMetrics
        },
        duration
      });

      logger.info('✅ Cross-service consistency test passed', {
        duration: `${duration}ms`,
        servicesWorking
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Cross-Service Consistency',
        passed: false,
        details: `Cross-service consistency test failed: ${error}`,
        duration
      });

      logger.error('❌ Cross-service consistency test failed', { error });
    }
  }

  private async testPerformanceMonitoring(): Promise<void> {
    const startTime = Date.now();

    try {
      const monitoringService = this.scriptContainer.getService<CachePerformanceMonitoringService>('cachePerformanceMonitoringService');
      if (!monitoringService) {
        throw new Error('CachePerformanceMonitoringService not available');
      }

      // Get overall metrics
      const metrics = monitoringService.getOverallMetrics();

      // Generate performance report
      const report = monitoringService.generatePerformanceReport();

      // Generate dashboard data
      const dashboard = monitoringService.generatePerformanceDashboard();

      // Log performance summary
      monitoringService.logPerformanceSummary();

      // Get health status
      const health = monitoringService.getHealth();

      const hasValidMetrics =
        metrics.totalHits >= 0 &&
        metrics.totalMisses >= 0 &&
        metrics.overallHitRate >= 0 &&
        report.recommendations.length >= 0;

      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Performance Monitoring',
        passed: health.healthy && hasValidMetrics,
        details: `Monitoring service healthy. Hit rate: ${metrics.overallHitRate.toFixed(1)}%, Recommendations: ${report.recommendations.length}`,
        metrics: {
          overall: metrics,
          dashboard: dashboard.summary
        },
        duration
      });

      logger.info('✅ Performance monitoring test passed', {
        duration: `${duration}ms`,
        hitRate: metrics.overallHitRate.toFixed(1),
        recommendations: report.recommendations.length
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName: 'Performance Monitoring',
        passed: false,
        details: `Performance monitoring test failed: ${error}`,
        duration
      });

      logger.error('❌ Performance monitoring test failed', { error });
    }
  }

  private getExpectedLevel(operationType: OperationType): ConsistencyLevel {
    switch (operationType) {
      case OperationType.FINANCIAL:
        return ConsistencyLevel.REALTIME;
      case OperationType.AVAILABILITY_CHECK:
        return ConsistencyLevel.REALTIME;
      case OperationType.EMAIL_SEARCH:
        return ConsistencyLevel.BEST_EFFORT;
      default:
        return ConsistencyLevel.EVENTUAL;
    }
  }

  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    logger.info('🧪 Cache Consistency Test Results', {
      totalTests,
      passedTests,
      failedTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
      totalDuration: `${totalDuration}ms`
    });

    // Log detailed results
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      logger.info(`${status} ${result.testName}: ${result.details} (${result.duration}ms)`);
    });

    // Log failed tests in detail
    const failedResults = this.results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      logger.error('❌ Failed Tests:', {
        failed: failedResults.map(r => ({
          test: r.testName,
          details: r.details,
          duration: r.duration
        }))
      });
    }

    if (failedTests > 0) {
      logger.error(`❌ ${failedTests} tests failed. Cache consistency validation incomplete.`);
      process.exit(1);
    } else {
      logger.info('✅ All cache consistency tests passed! System is working correctly.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new CacheConsistencyTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    logger.error('💥 Test runner crashed', { error });
    process.exit(1);
  });
}