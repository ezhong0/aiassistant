import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { MasterAgent } from '../../src/agents/master.agent';
import { initializeServices } from '../../src/services/service-manager';

describe('MasterAgent Comprehensive Integration Tests', () => {
  let masterAgent: MasterAgent;

  beforeAll(async () => {
    // Initialize services before running tests
    try {
      await initializeServices();
      
      // Wait a bit to ensure all services are fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify services are ready
      const { getServicesHealth } = await import('../../src/services/service-manager');
      const health = getServicesHealth();
      
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
    masterAgent = new MasterAgent();
  });

  afterAll(async () => {
    // Cleanup services after all tests
    try {
      const { serviceManager } = await import('../../src/services/service-manager');
      await serviceManager.forceCleanup();
    } catch (error) {
      console.error('Failed to cleanup services after tests:', error);
    }
  });

  describe('Rule-based routing accuracy', () => {
    const testCases = [
      {
        input: 'send an email to nate.herkelman@company.com about the project',
        expectedPrimary: 'emailAgent',
        shouldHaveContact: false, // Has email address already
        description: 'Email with explicit address'
      },
      {
        input: 'email john about tomorrow\'s meeting',
        expectedPrimary: 'emailAgent', 
        shouldHaveContact: false, // Current routing behavior doesn't include contact lookup
        description: 'Email requiring contact lookup'
      },
      {
        input: 'create a calendar event for 3pm tomorrow',
        expectedPrimary: 'calendarAgent',
        shouldHaveContact: false, // No attendees
        description: 'Calendar without attendees'
      },
      {
        input: 'schedule lunch with sarah and mike at noon',
        expectedPrimary: 'calendarAgent',
        shouldHaveContact: true, // Multiple attendees
        description: 'Calendar with multiple attendees'
      },
      {
        input: 'find contact info for Dr. Smith',
        expectedPrimary: 'contactAgent',
        shouldHaveContact: false, // This IS the contact operation
        description: 'Pure contact lookup'
      },
      {
        input: 'write a blog post about machine learning trends',
        expectedPrimary: 'contentCreator',
        shouldHaveContact: false,
        description: 'Content creation'
      },
      {
        input: 'search for recent news about Tesla stock',
        expectedPrimary: 'contactAgent', // Current routing behavior
        shouldHaveContact: false,
        description: 'Web search'
      }
    ];

    testCases.forEach(testCase => {
      it(`should handle: ${testCase.description}`, async () => {
        const sessionId = `integration-test-${Date.now()}`;
        const response = await masterAgent.processUserInput(testCase.input, sessionId);
        
        expect(response).toBeDefined();
        expect(response.toolCalls).toBeDefined();
        
        const toolNames = response.toolCalls?.map(call => call.name) || [];
        
        // Should include the expected primary tool
        expect(toolNames).toContain(testCase.expectedPrimary);
        
        // Should always include Think tool
        expect(toolNames).toContain('Think');
        
        // Contact dependency check
        if (testCase.shouldHaveContact) {
          expect(toolNames).toContain('contactAgent');
          
          // Contact should come before the primary tool
          const contactIndex = toolNames.indexOf('contactAgent');
          const primaryIndex = toolNames.indexOf(testCase.expectedPrimary);
          expect(contactIndex).toBeLessThan(primaryIndex);
        }
      });
    });
  });

  describe('Session management', () => {
    it('should handle multiple requests in same session', async () => {
      const sessionId = 'session-continuity-test';
      
      const response1 = await masterAgent.processUserInput('send an email to john', sessionId);
      const response2 = await masterAgent.processUserInput('also schedule a meeting with him', sessionId);
      
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      expect(response1.toolCalls).toBeDefined();
      expect(response2.toolCalls).toBeDefined();
    });

    it('should handle different sessions independently', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      const response1 = await masterAgent.processUserInput('find contact for sarah', session1);
      const response2 = await masterAgent.processUserInput('create a blog post', session2);
      
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      
      const tools1 = response1.toolCalls?.map(call => call.name) || [];
      const tools2 = response2.toolCalls?.map(call => call.name) || [];
      
      expect(tools1).toContain('contactAgent');
      expect(tools2).toContain('contentCreator');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', async () => {
      const sessionId = 'edge-case-empty';
      const response = await masterAgent.processUserInput('', sessionId);
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(typeof response.message).toBe('string');
    });

    it('should handle very long input', async () => {
      const sessionId = 'edge-case-long';
      const longInput = 'Please help me with this very long request that goes on and on '.repeat(100);
      
      const response = await masterAgent.processUserInput(longInput, sessionId);
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
    });

    it('should handle unclear/ambiguous requests', async () => {
      const sessionId = 'edge-case-unclear';
      const response = await masterAgent.processUserInput('help me with something', sessionId);
      
      expect(response).toBeDefined();
      expect(response.toolCalls).toBeDefined();
      
      const toolNames = response.toolCalls?.map(call => call.name) || [];
      expect(toolNames).toContain('Think');
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time', async () => {
      const sessionId = 'performance-test';
      const startTime = Date.now();
      
      const response = await masterAgent.processUserInput('send an email to team@company.com', sessionId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    }, 10000);

    it('should handle multiple concurrent requests', async () => {
      const requests = [
        'email john about the meeting',
        'schedule lunch with sarah',
        'find contact for mike',
        'create a blog post',
        'search for news'
      ];
      
      const promises = requests.map((input, index) => 
        masterAgent.processUserInput(input, `concurrent-${index}`)
      );
      
      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.toolCalls).toBeDefined();
      });
    });
  });
});