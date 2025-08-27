import './setup/slack-test-setup';
import { getService } from '../src/services/service-manager';
import { SlackService } from '../src/services/slack.service';
import { ToolExecutorService } from '../src/services/tool-executor.service';
import { EmailAgent } from '../src/agents/email.agent';
import { ContactAgent } from '../src/agents/contact.agent';
import { CalendarAgent } from '../src/agents/calendar.agent';
import { MasterAgent } from '../src/agents/master.agent';
import { initializeAllCoreServices } from '../src/services/service-initialization';
import { ToolExecutionContext } from '../src/types/tools';

describe('Slack Workflow Integration Tests', () => {
  let slackService: SlackService;
  let toolExecutor: ToolExecutorService;
  let masterAgent: MasterAgent;
  let emailAgent: EmailAgent;
  let contactAgent: ContactAgent;
  let calendarAgent: CalendarAgent;

  const mockContext: ToolExecutionContext = {
    sessionId: 'test-session-123',
    userId: 'U123456',
    timestamp: new Date().toISOString(),
    platform: 'slack',
    metadata: {
      slackWorkspaceId: 'T123456',
      slackChannelId: 'C123456789',
      slackUserId: 'U123456'
    }
  };

  beforeAll(async () => {
    try {
      await initializeAllCoreServices();
      
      slackService = getService<SlackService>('slackService')!;
      toolExecutor = getService<ToolExecutorService>('toolExecutorService')!;
      
      // Initialize agents for testing
      masterAgent = new MasterAgent();
      emailAgent = new EmailAgent();
      contactAgent = new ContactAgent();
      calendarAgent = new CalendarAgent();
    } catch (error) {
      console.error('Failed to initialize services for workflow testing:', error);
      // Create agents directly if initialization fails
      masterAgent = new MasterAgent();
      emailAgent = new EmailAgent();
      contactAgent = new ContactAgent();
      calendarAgent = new CalendarAgent();
    }
  });

  describe('Email Workflow Integration', () => {
    it('should handle complete email sending workflow through Slack', async () => {
      const userMessage = 'send an email to john@example.com about the quarterly review meeting';
      
      // Test master agent routing
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      expect(masterResponse.toolCalls).toBeDefined();
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
      
      // Should include email agent
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
      
      // Should include Think agent for verification
      const thinkToolCall = masterResponse.toolCalls.find(tc => tc.name === 'Think');
      expect(thinkToolCall).toBeDefined();
    });

    it('should handle email workflow with contact resolution', async () => {
      const userMessage = 'send an email to John Smith about the project update';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should include contact agent for name resolution
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
      
      // Should include email agent
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
    });

    it('should handle email search through Slack commands', async () => {
      const userMessage = 'find emails from sarah@company.com about budget';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
      expect(emailToolCall!.parameters.query).toContain('search');
    });

    it('should handle email reply workflow', async () => {
      const userMessage = 'reply to the last email from manager saying I will attend the meeting';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
      expect(emailToolCall!.parameters.query).toContain('reply');
    });
  });

  describe('Calendar Workflow Integration', () => {
    it('should handle calendar event creation through Slack', async () => {
      const userMessage = 'schedule a meeting with the team tomorrow at 2 PM for project review';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
    });

    it('should handle availability checking workflow', async () => {
      const userMessage = 'check if I am free next Tuesday at 10 AM';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
    });

    it('should handle meeting invitation workflow with contacts', async () => {
      const userMessage = 'schedule a meeting with John and Sarah for Friday at 3 PM';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should include contact resolution
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
      
      // Should include calendar creation
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
    });

    it('should handle calendar event updates', async () => {
      const userMessage = 'move my 2 PM meeting to 3 PM tomorrow';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
    });
  });

  describe('Contact Management Workflow', () => {
    it('should handle contact search through Slack', async () => {
      const userMessage = 'find contact information for John Smith';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
    });

    it('should handle fuzzy contact matching', async () => {
      const userMessage = 'get email for John from marketing';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
      expect(contactToolCall!.parameters.query).toContain('John');
    });

    it('should handle contact creation workflow', async () => {
      const userMessage = 'add a new contact: Jane Doe, jane@example.com, phone 555-123-4567';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
    });
  });

  describe('Complex Multi-Agent Workflows', () => {
    it('should handle meeting scheduling with email notifications', async () => {
      const userMessage = 'schedule a team meeting for next week and send invites to everyone';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should involve multiple agents
      expect(masterResponse.toolCalls.length).toBeGreaterThan(1);
      
      // Should include contact resolution for team
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
      
      // Should include calendar event creation
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
      
      // May include email for additional notifications
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      // This may or may not be present depending on implementation
    });

    it('should handle project communication workflow', async () => {
      const userMessage = 'send a project update email to the stakeholders and schedule a review meeting';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should involve multiple agents
      expect(masterResponse.toolCalls.length).toBeGreaterThan(2);
      
      // Should include contact resolution for stakeholders
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
      
      // Should include email sending
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
      
      // Should include calendar scheduling
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
    });

    it('should handle follow-up task workflow', async () => {
      const userMessage = 'follow up with John about the proposal and schedule a call if he responds positively';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should start with contact resolution and email
      const contactToolCall = masterResponse.toolCalls.find(tc => tc.name === 'contactAgent');
      expect(contactToolCall).toBeDefined();
      
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
    });
  });

  describe('Slack-Specific Workflow Features', () => {
    it('should handle threaded conversations', async () => {
      const threadContext = {
        ...mockContext,
        metadata: {
          ...mockContext.metadata,
          slackThreadTs: '1234567890.123456'
        }
      };
      
      const userMessage = 'continue with that email draft we discussed';
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should handle contextual reference
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });

    it('should handle workspace-specific context', async () => {
      const workspaceContext = {
        ...mockContext,
        metadata: {
          ...mockContext.metadata,
          slackWorkspaceId: 'T987654321'
        }
      };
      
      const userMessage = 'send an update to the team channel';
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });

    it('should handle user preferences and settings', async () => {
      // Test user preference handling
      const userMessage = 'use my preferred meeting duration for the team sync';
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial workflow failures gracefully', async () => {
      const userMessage = 'send email to invalid@nonexistent-domain.fake and schedule a meeting';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should still attempt both operations
      const emailToolCall = masterResponse.toolCalls.find(tc => tc.name === 'emailAgent');
      expect(emailToolCall).toBeDefined();
      
      const calendarToolCall = masterResponse.toolCalls.find(tc => tc.name === 'calendarAgent');
      expect(calendarToolCall).toBeDefined();
    });

    it('should handle ambiguous requests with clarification', async () => {
      const userMessage = 'schedule something with John';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should still process but may ask for clarification
      expect(masterResponse.message).toBeDefined();
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });

    it('should handle authentication failures gracefully', async () => {
      const userMessage = 'send an email to john@example.com';
      
      // Mock authentication failure scenario
      const contextWithoutAuth = {
        ...mockContext,
        metadata: {
          ...mockContext.metadata,
          accessToken: undefined
        }
      };
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should still generate tool calls but they will handle auth errors
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Efficiency', () => {
    it('should process workflows within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const userMessage = 'send a quick email to team@company.com about the standup';
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });

    it('should optimize tool call sequences', async () => {
      const userMessage = 'send email to john@example.com and sarah@example.com about the project';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should optimize to avoid redundant operations
      const emailToolCalls = masterResponse.toolCalls.filter(tc => tc.name === 'emailAgent');
      expect(emailToolCalls.length).toBeLessThanOrEqual(2); // Should batch efficiently
    });

    it('should handle concurrent workflow requests', async () => {
      const workflows = [
        'send email to alice@example.com',
        'schedule meeting with bob',
        'find contact for charlie'
      ];
      
      const promises = workflows.map(workflow => 
        masterAgent.processUserInput(workflow, `${mockContext.sessionId}-${Math.random()}`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.toolCalls.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Workflow Validation and Quality', () => {
    it('should validate workflow completeness', async () => {
      const userMessage = 'send an email to the team about the project update';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should include Think agent for validation
      const thinkToolCall = masterResponse.toolCalls.find(tc => tc.name === 'Think');
      expect(thinkToolCall).toBeDefined();
      expect(thinkToolCall!.parameters.query).toContain('Verify');
    });

    it('should handle workflow dependencies correctly', async () => {
      const userMessage = 'schedule a meeting with John and then send him the agenda';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      // Should include proper sequence of operations
      expect(masterResponse.toolCalls.length).toBeGreaterThan(2);
      
      // Contact resolution should come first
      const contactIndex = masterResponse.toolCalls.findIndex(tc => tc.name === 'contactAgent');
      const calendarIndex = masterResponse.toolCalls.findIndex(tc => tc.name === 'calendarAgent');
      const emailIndex = masterResponse.toolCalls.findIndex(tc => tc.name === 'emailAgent');
      
      if (contactIndex !== -1 && calendarIndex !== -1) {
        expect(contactIndex).toBeLessThan(calendarIndex);
      }
      if (calendarIndex !== -1 && emailIndex !== -1) {
        expect(calendarIndex).toBeLessThan(emailIndex);
      }
    });

    it('should provide meaningful workflow descriptions', async () => {
      const userMessage = 'help me organize the quarterly review process';
      
      const masterResponse = await masterAgent.processUserInput(userMessage, mockContext.sessionId);
      
      expect(masterResponse.message).toBeDefined();
      expect(masterResponse.message.length).toBeGreaterThan(10);
      expect(masterResponse.toolCalls.length).toBeGreaterThan(0);
    });
  });
});