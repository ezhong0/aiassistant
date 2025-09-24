#!/usr/bin/env ts-node

/**
 * Simple Memory Test Script
 * 
 * This script tests the basic memory cleanup mechanisms without creating
 * excessive memory pressure.
 */

import { WorkflowOrchestrator } from '../src/framework/workflow-orchestrator';
import logger from '../src/utils/logger';

async function testWorkflowOrchestratorCleanup() {
  logger.info('Testing WorkflowOrchestrator cleanup...');
  
  const orchestrator = new WorkflowOrchestrator();
  
  // Create a few test workflows
  for (let i = 0; i < 5; i++) {
    const workflow = {
      workflowId: `test-workflow-${i}`,
      sessionId: `session-${i}`,
      status: 'active' as const,
      totalSteps: 3,
      currentStep: 0,
      context: { test: true },
      createdAt: new Date(),
      lastActivity: new Date(Date.now() - (i * 1000))
    };
    orchestrator.createWorkflow(workflow);
  }
  
  const initialStats = orchestrator.getStats();
  logger.info('Initial stats:', initialStats);
  
  // Force cleanup
  orchestrator.cleanupOldWorkflows();
  
  const finalStats = orchestrator.getStats();
  logger.info('Final stats:', finalStats);
  
  // Destroy orchestrator
  orchestrator.destroy();
  
  logger.info('✅ WorkflowOrchestrator cleanup test completed');
}

async function testMemoryUsage() {
  logger.info('Testing memory usage...');
  
  const memBefore = process.memoryUsage();
  logger.info('Memory before:', {
    heapUsed: `${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memBefore.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memBefore.rss / 1024 / 1024)}MB`
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    logger.info('✅ Garbage collection completed');
  } else {
    logger.warn('⚠️  Garbage collection not available (run with --expose-gc)');
  }
  
  const memAfter = process.memoryUsage();
  logger.info('Memory after:', {
    heapUsed: `${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memAfter.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memAfter.rss / 1024 / 1024)}MB`
  });
  
  const diff = {
    heapUsed: memAfter.heapUsed - memBefore.heapUsed,
    heapTotal: memAfter.heapTotal - memBefore.heapTotal,
    rss: memAfter.rss - memBefore.rss
  };
  
  logger.info('Memory difference:', {
    heapUsed: `${Math.round(diff.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(diff.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(diff.rss / 1024 / 1024)}MB`
  });
}

async function main() {
  logger.info('Starting simple memory tests...');
  
  try {
    await testWorkflowOrchestratorCleanup();
    await testMemoryUsage();
    
    logger.info('🎉 All memory tests completed successfully!');
  } catch (error) {
    logger.error('Memory test failed:', error as Error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  main();
}
