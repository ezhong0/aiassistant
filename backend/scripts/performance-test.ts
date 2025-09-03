#!/usr/bin/env ts-node

import { DatabaseService } from '../src/services/database.service';
import { CacheService } from '../src/services/cache.service';
import { TokenManager } from '../src/services/token-manager';
import { SlackSessionManager } from '../src/services/slack-session-manager';
import { SessionService } from '../src/services/session.service';
import { AuthService } from '../src/services/auth.service';
import { ServiceManager } from '../src/services/service-manager';
import logger from '../src/utils/logger';

/**
 * Performance testing script
 * Measures the impact of caching on database operations
 */

interface PerformanceResults {
  operationName: string;
  withoutCache: {
    averageTime: number;
    totalTime: number;
    operations: number;
  };
  withCache: {
    averageTime: number;
    totalTime: number;
    operations: number;
    hitRate: number;
  };
  improvement: {
    speedup: number;
    percentImprovement: number;
  };
}

class PerformanceTester {
  private serviceManager: ServiceManager;
  private databaseService!: DatabaseService;
  private cacheService!: CacheService;
  private tokenManager!: TokenManager;
  private sessionService!: SessionService;
  private slackSessionManager!: SlackSessionManager;
  private authService!: AuthService;

  constructor() {
    this.serviceManager = new ServiceManager();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing services for performance testing...');

    // Initialize core services
    this.databaseService = new DatabaseService();
    this.cacheService = new CacheService();
    this.sessionService = new SessionService();
    this.authService = new AuthService();
    
    // Register services
    this.serviceManager.registerService('databaseService', this.databaseService, {
      priority: 1,
      autoStart: true
    });
    
    this.serviceManager.registerService('cacheService', this.cacheService, {
      priority: 2,
      autoStart: true
    });
    
    this.serviceManager.registerService('sessionService', this.sessionService, {
      dependencies: ['databaseService'],
      priority: 3,
      autoStart: true
    });
    
    this.serviceManager.registerService('authService', this.authService, {
      priority: 4,
      autoStart: true
    });

    // Initialize services
    await this.serviceManager.initializeAllServices();

    // Create dependent services
    this.slackSessionManager = new SlackSessionManager(this.sessionService);
    this.tokenManager = new TokenManager(this.slackSessionManager, this.authService);
    
    await this.slackSessionManager.initialize();
    await this.tokenManager.initialize();

    logger.info('All services initialized successfully');
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up services...');
    
    await this.tokenManager?.destroy();
    await this.slackSessionManager?.destroy();
    await this.serviceManager.destroyAllServices();
  }

  async runPerformanceTests(): Promise<PerformanceResults[]> {
    logger.info('Starting performance tests...');

    const results: PerformanceResults[] = [];

    // Test 1: Token retrieval
    results.push(await this.testTokenRetrieval());

    // Test 2: Session retrieval
    results.push(await this.testSessionRetrieval());

    // Test 3: Token status checks
    results.push(await this.testTokenStatusChecks());

    return results;
  }

  async testTokenRetrieval(): Promise<PerformanceResults> {
    logger.info('Testing token retrieval performance...');
    
    const testData = await this.setupTokenTestData();
    const iterations = 100;

    // Clear cache to start fresh
    await this.cacheService.flushAll();

    // Test without cache (simulate cache miss every time)
    const withoutCacheResults = await this.measureOperation(
      'Token Retrieval (No Cache)',
      iterations,
      async (i: number) => {
        const { teamId, userId } = testData[i % testData.length];
        // Clear cache before each operation to simulate no caching
        await this.cacheService.del(`tokens:${teamId}:${userId}`);
        return await this.tokenManager.getValidTokens(teamId, userId);
      }
    );

    // Test with cache (warm up cache first)
    logger.info('Warming up cache for token retrieval test...');
    for (const { teamId, userId } of testData) {
      await this.tokenManager.getValidTokens(teamId, userId);
    }

    const withCacheResults = await this.measureOperation(
      'Token Retrieval (With Cache)',
      iterations,
      async (i: number) => {
        const { teamId, userId } = testData[i % testData.length];
        return await this.tokenManager.getValidTokens(teamId, userId);
      }
    );

    const cacheHitRate = await this.calculateCacheHitRate(testData, 'tokens');

    return this.calculateImprovement(
      'Token Retrieval',
      withoutCacheResults,
      { ...withCacheResults, hitRate: cacheHitRate }
    );
  }

  async testSessionRetrieval(): Promise<PerformanceResults> {
    logger.info('Testing session retrieval performance...');
    
    const testData = await this.setupSessionTestData();
    const iterations = 100;

    // Clear cache
    await this.cacheService.flushAll();

    // Test without cache
    const withoutCacheResults = await this.measureOperation(
      'Session Retrieval (No Cache)',
      iterations,
      async (i: number) => {
        const sessionId = testData[i % testData.length];
        await this.cacheService.del(`session:${sessionId}`);
        return await this.sessionService.getSession(sessionId);
      }
    );

    // Test with cache (warm up cache first)
    logger.info('Warming up cache for session retrieval test...');
    for (const sessionId of testData) {
      await this.sessionService.getSession(sessionId);
    }

    const withCacheResults = await this.measureOperation(
      'Session Retrieval (With Cache)',
      iterations,
      async (i: number) => {
        const sessionId = testData[i % testData.length];
        return await this.sessionService.getSession(sessionId);
      }
    );

    const cacheHitRate = await this.calculateCacheHitRate(testData.map(id => ({ sessionId: id })), 'session');

    return this.calculateImprovement(
      'Session Retrieval',
      withoutCacheResults,
      { ...withCacheResults, hitRate: cacheHitRate }
    );
  }

  async testTokenStatusChecks(): Promise<PerformanceResults> {
    logger.info('Testing token status check performance...');
    
    const testData = await this.setupTokenTestData();
    const iterations = 100;

    // Clear cache
    await this.cacheService.flushAll();

    // Test without cache
    const withoutCacheResults = await this.measureOperation(
      'Token Status Check (No Cache)',
      iterations,
      async (i: number) => {
        const { teamId, userId } = testData[i % testData.length];
        await this.cacheService.del(`token-status:${teamId}:${userId}`);
        return await this.tokenManager.getTokenStatus(teamId, userId);
      }
    );

    // Test with cache (warm up cache first)
    logger.info('Warming up cache for token status test...');
    for (const { teamId, userId } of testData) {
      await this.tokenManager.getTokenStatus(teamId, userId);
    }

    const withCacheResults = await this.measureOperation(
      'Token Status Check (With Cache)',
      iterations,
      async (i: number) => {
        const { teamId, userId } = testData[i % testData.length];
        return await this.tokenManager.getTokenStatus(teamId, userId);
      }
    );

    const cacheHitRate = await this.calculateCacheHitRate(testData, 'token-status');

    return this.calculateImprovement(
      'Token Status Check',
      withoutCacheResults,
      { ...withCacheResults, hitRate: cacheHitRate }
    );
  }

  async measureOperation(
    name: string,
    iterations: number,
    operation: (i: number) => Promise<any>
  ): Promise<{ averageTime: number; totalTime: number; operations: number }> {
    logger.info(`Measuring ${name} (${iterations} iterations)...`);
    
    const startTime = Date.now();
    const operationTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const operationStart = process.hrtime.bigint();
      
      try {
        await operation(i);
      } catch (error) {
        logger.warn(`Operation ${i} failed:`, error);
      }
      
      const operationEnd = process.hrtime.bigint();
      const operationTimeMs = Number(operationEnd - operationStart) / 1000000; // Convert to ms
      operationTimes.push(operationTimeMs);

      // Log progress every 20 operations
      if ((i + 1) % 20 === 0) {
        logger.info(`Completed ${i + 1}/${iterations} operations`);
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;

    logger.info(`${name} completed:`, {
      iterations,
      totalTime,
      averageTime: averageTime.toFixed(2),
      minTime: Math.min(...operationTimes).toFixed(2),
      maxTime: Math.max(...operationTimes).toFixed(2)
    });

    return {
      averageTime,
      totalTime,
      operations: iterations
    };
  }

  async setupTokenTestData(): Promise<Array<{ teamId: string; userId: string }>> {
    const testData = [];
    
    for (let i = 1; i <= 10; i++) {
      const teamId = `team-${i}`;
      const userId = `user-${i}`;
      
      testData.push({ teamId, userId });

      // Create test tokens in database
      try {
        await this.slackSessionManager.storeOAuthTokens(teamId, userId, {
          google: {
            access_token: `test-token-${i}`,
            refresh_token: `refresh-token-${i}`,
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'email profile',
            expiry_date: Date.now() + 3600000
          }
        });
      } catch (error) {
        logger.warn(`Failed to create test token data for ${teamId}:${userId}`, error);
      }
    }

    return testData;
  }

  async setupSessionTestData(): Promise<string[]> {
    const testData = [];
    
    for (let i = 1; i <= 10; i++) {
      const sessionId = `test-session-${i}`;
      testData.push(sessionId);

      // Create test sessions
      try {
        await this.sessionService.getOrCreateSession(sessionId, `test-user-${i}`);
      } catch (error) {
        logger.warn(`Failed to create test session ${sessionId}`, error);
      }
    }

    return testData;
  }

  async calculateCacheHitRate(testData: any[], keyPrefix: string): Promise<number> {
    let hits = 0;
    const total = testData.length;

    for (const data of testData) {
      let key: string;
      
      if (keyPrefix === 'tokens' || keyPrefix === 'token-status') {
        key = `${keyPrefix}:${data.teamId}:${data.userId}`;
      } else {
        key = `${keyPrefix}:${data.sessionId}`;
      }

      const exists = await this.cacheService.exists(key);
      if (exists) hits++;
    }

    return total > 0 ? (hits / total) * 100 : 0;
  }

  calculateImprovement(
    operationName: string,
    withoutCache: { averageTime: number; totalTime: number; operations: number },
    withCache: { averageTime: number; totalTime: number; operations: number; hitRate: number }
  ): PerformanceResults {
    const speedup = withoutCache.averageTime / withCache.averageTime;
    const percentImprovement = ((withoutCache.averageTime - withCache.averageTime) / withoutCache.averageTime) * 100;

    return {
      operationName,
      withoutCache,
      withCache,
      improvement: {
        speedup,
        percentImprovement
      }
    };
  }

  logResults(results: PerformanceResults[]): void {
    logger.info('\n📊 PERFORMANCE TEST RESULTS 📊');
    logger.info('=' .repeat(80));

    for (const result of results) {
      logger.info(`\n🔍 ${result.operationName}`);
      logger.info('-'.repeat(50));
      logger.info(`Without Cache:`);
      logger.info(`  Average Time: ${result.withoutCache.averageTime.toFixed(2)}ms`);
      logger.info(`  Total Time: ${result.withoutCache.totalTime}ms`);
      logger.info(`  Operations: ${result.withoutCache.operations}`);
      
      logger.info(`With Cache:`);
      logger.info(`  Average Time: ${result.withCache.averageTime.toFixed(2)}ms`);
      logger.info(`  Total Time: ${result.withCache.totalTime}ms`);
      logger.info(`  Operations: ${result.withCache.operations}`);
      logger.info(`  Cache Hit Rate: ${result.withCache.hitRate.toFixed(1)}%`);
      
      logger.info(`Performance Improvement:`);
      logger.info(`  Speedup: ${result.improvement.speedup.toFixed(2)}x`);
      logger.info(`  Improvement: ${result.improvement.percentImprovement.toFixed(1)}%`);

      // Performance evaluation
      if (result.improvement.percentImprovement > 80) {
        logger.info(`  🚀 EXCELLENT - Major performance improvement!`);
      } else if (result.improvement.percentImprovement > 50) {
        logger.info(`  ✅ GOOD - Significant performance improvement`);
      } else if (result.improvement.percentImprovement > 20) {
        logger.info(`  📈 MODERATE - Noticeable improvement`);
      } else {
        logger.info(`  ⚠️  MINIMAL - Limited improvement`);
      }
    }

    // Overall summary
    const avgImprovement = results.reduce((sum, r) => sum + r.improvement.percentImprovement, 0) / results.length;
    const avgSpeedup = results.reduce((sum, r) => sum + r.improvement.speedup, 0) / results.length;

    logger.info('\n📊 OVERALL SUMMARY');
    logger.info('=' .repeat(50));
    logger.info(`Average Performance Improvement: ${avgImprovement.toFixed(1)}%`);
    logger.info(`Average Speedup: ${avgSpeedup.toFixed(2)}x`);
    
    if (avgImprovement > 70) {
      logger.info('🎉 CACHING IMPLEMENTATION: HIGHLY SUCCESSFUL!');
    } else if (avgImprovement > 40) {
      logger.info('✅ CACHING IMPLEMENTATION: SUCCESSFUL');
    } else {
      logger.info('📝 CACHING IMPLEMENTATION: NEEDS OPTIMIZATION');
    }

    logger.info('=' .repeat(80));
  }
}

async function runPerformanceTest(): Promise<void> {
  const tester = new PerformanceTester();

  try {
    await tester.initialize();
    const results = await tester.runPerformanceTests();
    tester.logResults(results);

  } catch (error) {
    logger.error('Performance test failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

// Run the performance test
if (require.main === module) {
  runPerformanceTest().catch(error => {
    logger.error('Performance test script failed:', error);
    process.exit(1);
  });
}

export { PerformanceTester, runPerformanceTest };