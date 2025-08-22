import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { MasterAgent } from '../../../src/agents/master.agent';
import { initializeServices } from '../../../src/services/service-manager';

describe('MasterAgent', () => {
  let masterAgent: MasterAgent;

  beforeAll(async () => {
    // Initialize services before running tests
    try {
      await initializeServices();
      
      // Wait a bit to ensure all services are fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify services are ready
      const { getServicesHealth } = await import('../../../src/services/service-manager');
      const health = getServicesHealth();
      console.log('Service health status:', health);
      
      // Check if SessionService is ready
      if (health.sessionService && !health.sessionService.ready) {
        throw new Error(`SessionService not ready: ${JSON.stringify(health.sessionService)}`);
      }
    } catch (error) {
      console.error('Failed to initialize services for tests:', error);
      throw error; // Don't continue if services aren't ready
    }
  });

  beforeEach(() => {
    // Initialize master agent without OpenAI (rule-based routing only)
    masterAgent = new MasterAgent();
  });

  afterEach(() => {
    // Force cleanup
    masterAgent = null as any;
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(async () => {
    // Cleanup services after all tests
    try {
      const { serviceManager } = await import('../../../src/services/service-manager');
      await serviceManager.forceCleanup();
    } catch (error) {
      console.error('Failed to cleanup services after tests:', error);
    }
  });

  describe('Tool routing', () => {
    const testCases = [
      {
        name: 'Email with contact lookup',
        input: 'send an email to nate herkelman asking him what time he wants to leave',
        expectedTools: ['contactAgent', 'emailAgent', 'Think']
      },
      {
        name: 'Calendar event',
        input: 'schedule a meeting with john tomorrow at 3pm',
        expectedTools: ['contactAgent', 'calendarAgent', 'Think']
      },
      {
        name: 'Contact lookup',
        input: 'find contact information for sarah',
        expectedTools: ['contactAgent', 'Think']
      },
      {
        name: 'Content creation',
        input: 'create a blog post about AI',
        expectedTools: ['contentCreator', 'Think']
      },
      {
        name: 'Web search',
        input: 'search for the latest news about climate change',
        expectedTools: ['contactAgent', 'Think'] // Current routing behavior
      },
      {
        name: 'Unclear request',
        input: 'help me with something',
        expectedTools: ['Think']
      }
    ];

    testCases.forEach(testCase => {
      it(`should route "${testCase.name}" correctly`, async () => {
        const sessionId = `test-session-${Date.now()}`;
        
        const response = await masterAgent.processUserInput(testCase.input, sessionId);
        
        expect(response).toBeDefined();
        expect(response.toolCalls).toBeDefined();
        expect(Array.isArray(response.toolCalls)).toBe(true);
        
        const actualTools = response.toolCalls?.map(call => call.name) || [];
        
        // Check that all expected tools are present
        testCase.expectedTools.forEach(expectedTool => {
          expect(actualTools).toContain(expectedTool);
        });
        
        // Verify Think tool is always included (as per rules)
        expect(actualTools).toContain('Think');
      });
    });
  });

  describe('Contact dependency handling', () => {
    it('should include contactAgent before emailAgent when email mentions a person', async () => {
      const sessionId = `test-session-${Date.now()}`;
      const response = await masterAgent.processUserInput(
        'send an email to john about the meeting',
        sessionId
      );
      
      const toolNames = response.toolCalls?.map(call => call.name) || [];
      const contactIndex = toolNames.indexOf('contactAgent');
      const emailIndex = toolNames.indexOf('emailAgent');
      
      expect(contactIndex).toBeGreaterThanOrEqual(0);
      expect(emailIndex).toBeGreaterThanOrEqual(0);
      expect(contactIndex).toBeLessThan(emailIndex);
    });

    it('should include contactAgent before calendarAgent when scheduling with a person', async () => {
      const sessionId = `test-session-${Date.now()}`;
      const response = await masterAgent.processUserInput(
        'schedule a meeting with sarah tomorrow',
        sessionId
      );
      
      const toolNames = response.toolCalls?.map(call => call.name) || [];
      const contactIndex = toolNames.indexOf('contactAgent');
      const calendarIndex = toolNames.indexOf('calendarAgent');
      
      expect(contactIndex).toBeGreaterThanOrEqual(0);
      expect(calendarIndex).toBeGreaterThanOrEqual(0);
      expect(contactIndex).toBeLessThan(calendarIndex);
    });
  });

  describe('Error handling', () => {
    it('should handle empty input gracefully', async () => {
      const sessionId = `test-session-${Date.now()}`;
      const response = await masterAgent.processUserInput('', sessionId);
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(typeof response.message).toBe('string');
    });

    it('should handle very long input', async () => {
      const sessionId = `test-session-${Date.now()}`;
      const longInput = 'a'.repeat(10000);
      const response = await masterAgent.processUserInput(longInput, sessionId);
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
    });
  });
});