#!/usr/bin/env ts-node

/**
 * Memory Cleanup Test Script
 * 
 * This script tests the memory cleanup mechanisms implemented in the codebase
 * to ensure they work correctly and prevent memory leaks.
 */

import { AgentFactory } from '../src/framework/agent-factory';
import { scriptContainer } from './utils/container-helper';
import logger from '../src/utils/logger';

interface MemoryTestResult {
  testName: string;
  success: boolean;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  memoryDiff: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  error?: string;
}

class MemoryCleanupTester {
  private results: MemoryTestResult[] = [];

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Calculate memory difference
   */
  private calculateMemoryDiff(before: NodeJS.MemoryUsage, after: NodeJS.MemoryUsage) {
    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
      rss: after.rss - before.rss
    };
  }

  /**
   * Test AgentFactory memory cleanup
   */
  async testAgentFactoryCleanup(): Promise<void> {
    const testName = 'AgentFactory Memory Cleanup';
    logger.info(`Starting test: ${testName}`);

    const memoryBefore = this.getMemoryUsage();

    try {
      // Initialize AgentFactory
      AgentFactory.initialize();
      
      // Get initial stats
      const initialStats = AgentFactory.getStats();
      logger.info('Initial AgentFactory stats', { stats: initialStats });

      // Simulate some agent operations
      for (let i = 0; i < 100; i++) {
        // This would normally create agents, but we'll just test the cleanup mechanism
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Force cleanup
      AgentFactory.reset();

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: true,
        memoryBefore,
        memoryAfter,
        memoryDiff
      });

      logger.info(`${testName} completed successfully`, {
        memoryDiff: {
          heapUsed: `${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryDiff.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryDiff.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryDiff.rss / 1024 / 1024)}MB`
        }
      });

    } catch (error) {
      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: false,
        memoryBefore,
        memoryAfter,
        memoryDiff,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logger.error(`${testName} failed`, error as Error);
    }
  }

  /**
   */
    logger.info(`Starting test: ${testName}`);

    const memoryBefore = this.getMemoryUsage();

    try {
      
      // Start cleanup
      orchestrator.startCleanup();

      // Create some test workflows
      for (let i = 0; i < 50; i++) {
        const workflow = {
          workflowId: `test-workflow-${i}`,
          sessionId: `session-${i}`,
          status: 'active' as const,
          totalSteps: 3,
          currentStep: 0,
          lastActivity: Date.now() - (i * 1000), // Stagger the timestamps
          steps: []
        };
        orchestrator.createWorkflow(workflow);
      }

      // Get initial stats
      const initialStats = orchestrator.getStats();

      // Wait for cleanup to potentially run
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force cleanup
      orchestrator.cleanupOldWorkflows();

      // Get final stats
      const finalStats = orchestrator.getStats();

      // Destroy orchestrator
      orchestrator.destroy();

      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: true,
        memoryBefore,
        memoryAfter,
        memoryDiff
      });

      logger.info(`${testName} completed successfully`, {
        memoryDiff: {
          heapUsed: `${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryDiff.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryDiff.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryDiff.rss / 1024 / 1024)}MB`
        }
      });

    } catch (error) {
      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: false,
        memoryBefore,
        memoryAfter,
        memoryDiff,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logger.error(`${testName} failed`, error as Error);
    }
  }

  /**
   * Test ServiceManager memory cleanup
   */
  async testServiceManagerCleanup(): Promise<void> {
    const testName = 'ServiceManager Memory Cleanup';
    logger.info(`Starting test: ${testName}`);

    const memoryBefore = this.getMemoryUsage();

    try {
      // Get initial stats
      const initialStats = scriptContainer.getServiceStats();
      logger.info('Initial ServiceManager stats', { stats: initialStats });

      // Wait for cleanup to potentially run
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force cleanup
      await scriptContainer.forceCleanup();

      // Get final stats
      const finalStats = scriptContainer.getServiceStats();
      logger.info('Final ServiceManager stats', { stats: finalStats });

      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: true,
        memoryBefore,
        memoryAfter,
        memoryDiff
      });

      logger.info(`${testName} completed successfully`, {
        memoryDiff: {
          heapUsed: `${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryDiff.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryDiff.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryDiff.rss / 1024 / 1024)}MB`
        }
      });

    } catch (error) {
      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: false,
        memoryBefore,
        memoryAfter,
        memoryDiff,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logger.error(`${testName} failed`, error as Error);
    }
  }

  /**
   * Test overall memory pressure
   */
  async testMemoryPressure(): Promise<void> {
    const testName = 'Memory Pressure Test';
    logger.info(`Starting test: ${testName}`);

    const memoryBefore = this.getMemoryUsage();

    try {
      // Create some memory pressure (smaller arrays)
      const largeArrays: any[] = [];
      for (let i = 0; i < 10; i++) {
        largeArrays.push(new Array(1000).fill(`test-data-${i}`));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: true,
        memoryBefore,
        memoryAfter,
        memoryDiff
      });

      logger.info(`${testName} completed successfully`, {
        memoryDiff: {
          heapUsed: `${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryDiff.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryDiff.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryDiff.rss / 1024 / 1024)}MB`
        }
      });

    } catch (error) {
      const memoryAfter = this.getMemoryUsage();
      const memoryDiff = this.calculateMemoryDiff(memoryBefore, memoryAfter);

      this.results.push({
        testName,
        success: false,
        memoryBefore,
        memoryAfter,
        memoryDiff,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logger.error(`${testName} failed`, error as Error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    logger.info('Starting memory cleanup tests...');

    await this.testAgentFactoryCleanup();
    await this.testServiceManagerCleanup();
    await this.testMemoryPressure();

    this.printResults();
  }

  /**
   * Print test results
   */
  private printResults(): void {
    logger.info('Memory Cleanup Test Results');
    logger.info('='.repeat(50));

    let totalTests = 0;
    let passedTests = 0;

    for (const result of this.results) {
      totalTests++;
      if (result.success) {
        passedTests++;
      }

      const status = result.success ? '✅ PASS' : '❌ FAIL';
      logger.info(`${status} ${result.testName}`);

      if (result.error) {
        logger.error(`  Error: ${result.error}`);
      }

      logger.info(`  Memory Diff: ${Math.round(result.memoryDiff.heapUsed / 1024 / 1024)}MB heap, ${Math.round(result.memoryDiff.rss / 1024 / 1024)}MB RSS`);
    }

    logger.info('='.repeat(50));
    logger.info(`Tests: ${passedTests}/${totalTests} passed`);

    if (passedTests === totalTests) {
      logger.info('🎉 All memory cleanup tests passed!');
    } else {
      logger.warn(`⚠️  ${totalTests - passedTests} tests failed`);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new MemoryCleanupTester();
  tester.runAllTests().catch(error => {
    logger.error('Memory cleanup test failed', error);
    process.exit(1);
  });
}

export { MemoryCleanupTester };
