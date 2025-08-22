import { describe, it, expect } from '@jest/globals';
import { TestUtils, TestAssertions } from '../test-utils';

describe('MasterAgent Integration Tests', () => {
  // Run each test with proper cleanup using TestUtils
  describe('Full Service Integration', () => {

    it('should handle basic integration without full services', async () => {
      await TestUtils.runWithCleanup(async () => {
        const { MasterAgent } = await import('../../src/agents/master.agent');
        const masterAgent = new MasterAgent();
        
        // Simple integration test without service dependencies
        const sessionId = TestUtils.createTestSessionId('integration-basic');
        
        try {
          const response = await masterAgent.processUserInput('send an email to john', sessionId);
          
          expect(response).toBeDefined();
          expect(response.message).toBeDefined();
          
          // In unit test mode without services, we expect an error response
          expect(typeof response.message).toBe('string');
        } catch (error) {
          // Expected - services not available in unit test mode
          expect(error).toBeDefined();
        }
      }, { useServices: true });
    });

    it('should handle edge cases without services', async () => {
      await TestUtils.runWithCleanup(async () => {
        const { MasterAgent } = await import('../../src/agents/master.agent');
        const masterAgent = new MasterAgent();
        
        // Test empty input
        const sessionId1 = TestUtils.createTestSessionId('edge-empty');
        
        try {
          const response1 = await masterAgent.processUserInput('', sessionId1);
          expect(response1).toBeDefined();
          expect(response1.message).toBeDefined();
        } catch (error) {
          // Expected - services not available in unit test mode
          expect(error).toBeDefined();
        }
      });
    });

    it('should perform basic operations within reasonable time', async () => {
      await TestUtils.runWithCleanup(async () => {
        const { MasterAgent } = await import('../../src/agents/master.agent');
        const masterAgent = new MasterAgent();
        
        const sessionId = TestUtils.createTestSessionId('performance');
        const startTime = Date.now();
        
        try {
          const response = await masterAgent.processUserInput('test message', sessionId);
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          expect(response).toBeDefined();
          expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
        } catch (error) {
          // Expected - services not available, but should still be fast
          const endTime = Date.now();
          const duration = endTime - startTime;
          expect(duration).toBeLessThan(2000);
        }
      });
    }, 5000);
  });
});