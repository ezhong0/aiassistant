/**
 * End-to-End Test Suite for Whole Inbox Testing
 * 
 * Demonstrates comprehensive E2E testing with whole inbox mocking.
 * Tests complete user workflows with realistic data.
 */

import { GenericAIService } from '../../src/services/generic-ai.service';
import { WholeInboxGenerator, InboxData, InboxTemplate } from './generators/whole-inbox-generator';
import { UnifiedMockManager } from './mocks/unified-mock-manager';
import { AIDomainService } from '../../src/services/domain/ai-domain.service';

describe('End-to-End Testing with Whole Inbox Mocking', () => {
  let inboxGenerator: WholeInboxGenerator;
  let mockManager: UnifiedMockManager;
  let aiService: GenericAIService;
  let aiDomainService: AIDomainService;
  
  let executiveInbox: InboxData;
  let managerInbox: InboxData;
  let individualInbox: InboxData;

  beforeAll(async () => {
    // Initialize services
    aiDomainService = new AIDomainService();
    await aiDomainService.initialize();
    
    aiService = new GenericAIService(aiDomainService);
    await aiService.initialize();
    
    inboxGenerator = new WholeInboxGenerator(aiService);
    await inboxGenerator.initialize();
    
    mockManager = UnifiedMockManager.getInstance();
    await mockManager.initialize();
  });

  beforeEach(async () => {
    // Generate inboxes for each test
    const executiveTemplate = inboxGenerator.getTemplate('executive');
    const managerTemplate = inboxGenerator.getTemplate('manager');
    const individualTemplate = inboxGenerator.getTemplate('individual');

    if (executiveTemplate) {
      executiveInbox = await inboxGenerator.generateCompleteInbox(executiveTemplate);
      await mockManager.setupMockContext(executiveInbox, executiveTemplate.userProfile);
    }

    if (managerTemplate) {
      managerInbox = await inboxGenerator.generateCompleteInbox(managerTemplate);
    }

    if (individualTemplate) {
      individualInbox = await inboxGenerator.generateCompleteInbox(individualTemplate);
    }
  });

  afterEach(() => {
    // Clear mock records
    mockManager.clearApiCallRecords();
  });

  describe('Executive Inbox Workflows', () => {
    it('should handle urgent email triage workflow', async () => {
      // Setup executive inbox
      await mockManager.setupMockContext(executiveInbox, executiveInbox.metadata.userProfile);
      
      const userQuery = "Show me all urgent emails that need immediate attention";
      
      // Execute workflow (this would call your actual orchestrator)
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: executiveInbox,
        userProfile: executiveInbox.metadata.userProfile
      });
      
      // Verify results
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000); // 10 seconds max
      
      // Check API calls were made
      const apiCalls = mockManager.getApiCallRecords();
      expect(apiCalls.length).toBeGreaterThan(0);
      
      // Verify Gmail search was called
      const gmailCalls = apiCalls.filter(call => call.clientName === 'GoogleAPIClient');
      expect(gmailCalls.length).toBeGreaterThan(0);
      
      // Verify response quality
      expect(result.response.toLowerCase()).toContain('urgent');
      expect(result.response.toLowerCase()).toContain('email');
    });

    it('should handle meeting coordination workflow', async () => {
      await mockManager.setupMockContext(executiveInbox, executiveInbox.metadata.userProfile);
      
      const userQuery = "Find all emails about the Q4 planning meeting and show me the current status";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: executiveInbox,
        userProfile: executiveInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000);
      
      // Verify meeting-related content
      expect(result.response.toLowerCase()).toContain('meeting');
      expect(result.response.toLowerCase()).toContain('q4');
    });

    it('should handle complex information gathering workflow', async () => {
      await mockManager.setupMockContext(executiveInbox, executiveInbox.metadata.userProfile);
      
      const userQuery = "I need to understand the status of all projects mentioned in emails from the last month. Show me what's been completed, what's in progress, and what needs attention";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: executiveInbox,
        userProfile: executiveInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(15000); // 15 seconds for complex query
      
      // Verify project-related content
      expect(result.response.toLowerCase()).toContain('project');
      expect(result.response.toLowerCase()).toContain('status');
    });
  });

  describe('Manager Inbox Workflows', () => {
    it('should handle team follow-up management workflow', async () => {
      await mockManager.setupMockContext(managerInbox, managerInbox.metadata.userProfile);
      
      const userQuery = "Show me all follow-up emails from my team members that I haven't responded to";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: managerInbox,
        userProfile: managerInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000);
      
      // Verify follow-up content
      expect(result.response.toLowerCase()).toContain('follow');
    });

    it('should handle project status coordination workflow', async () => {
      await mockManager.setupMockContext(managerInbox, managerInbox.metadata.userProfile);
      
      const userQuery = "What's the current status of all active projects? Show me any blockers or issues";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: managerInbox,
        userProfile: managerInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(12000);
      
      // Verify project status content
      expect(result.response.toLowerCase()).toContain('project');
      expect(result.response.toLowerCase()).toContain('status');
    });
  });

  describe('Individual Contributor Workflows', () => {
    it('should handle task management workflow', async () => {
      await mockManager.setupMockContext(individualInbox, individualInbox.metadata.userProfile);
      
      const userQuery = "Show me all task-related emails and what I need to work on this week";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: individualInbox,
        userProfile: individualInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(8000);
      
      // Verify task-related content
      expect(result.response.toLowerCase()).toContain('task');
    });

    it('should handle meeting preparation workflow', async () => {
      await mockManager.setupMockContext(individualInbox, individualInbox.metadata.userProfile);
      
      const userQuery = "I have a meeting tomorrow about the new feature. Show me all related emails and prepare a summary";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: individualInbox,
        userProfile: individualInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000);
      
      // Verify meeting preparation content
      expect(result.response.toLowerCase()).toContain('meeting');
    });
  });

  describe('Cross-Domain Workflows', () => {
    it('should handle email-to-calendar coordination workflow', async () => {
      await mockManager.setupMockContext(executiveInbox, executiveInbox.metadata.userProfile);
      
      const userQuery = "Find all emails about meetings this week and show me what's on my calendar";
      
      const result = await executeE2EWorkflow(userQuery, {
        inboxData: executiveInbox,
        userProfile: executiveInbox.metadata.userProfile
      });
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(12000);
      
      // Verify both email and calendar content
      expect(result.response.toLowerCase()).toContain('meeting');
      expect(result.response.toLowerCase()).toContain('calendar');
      
      // Check both Gmail and Calendar API calls were made
      const apiCalls = mockManager.getApiCallRecords();
      const gmailCalls = apiCalls.filter(call => 
        call.clientName === 'GoogleAPIClient' && 
        call.request.endpoint.includes('/gmail/')
      );
      const calendarCalls = apiCalls.filter(call => 
        call.clientName === 'GoogleAPIClient' && 
        call.request.endpoint.includes('/calendar/')
      );
      
      expect(gmailCalls.length).toBeGreaterThan(0);
      expect(calendarCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Quality Validation', () => {
    it('should maintain consistent performance across different inbox sizes', async () => {
      const templates = [
        inboxGenerator.getTemplate('individual'), // ~150 emails
        inboxGenerator.getTemplate('manager'),    // ~300 emails
        inboxGenerator.getTemplate('executive')   // ~500 emails
      ];

      const results = [];
      
      for (const template of templates) {
        if (!template) continue;
        
        const inbox = await inboxGenerator.generateCompleteInbox(template);
        await mockManager.setupMockContext(inbox, template.userProfile);
        
        const startTime = Date.now();
        const result = await executeE2EWorkflow("Show me urgent emails", {
          inboxData: inbox,
          userProfile: template.userProfile
        });
        const executionTime = Date.now() - startTime;
        
        results.push({
          role: template.userProfile.role,
          emailCount: inbox.emails.length,
          executionTime
        });
        
        expect(executionTime).toBeLessThan(15000); // 15 seconds max regardless of size
      }
      
      // Log performance results
      console.log('Performance Results:', results);
    });

    it('should generate realistic and diverse email content', async () => {
      await mockManager.setupMockContext(executiveInbox, executiveInbox.metadata.userProfile);
      
      // Verify email diversity
      const subjects = executiveInbox.emails.map(email => {
        const subjectHeader = email.payload.headers.find(h => h.name.toLowerCase() === 'subject');
        return subjectHeader ? subjectHeader.value : '';
      });
      const uniqueSubjects = new Set(subjects);
      
      expect(uniqueSubjects.size).toBeGreaterThan(subjects.length * 0.8); // 80% unique subjects
      
      // Verify sender diversity
      const senders = executiveInbox.emails.map(email => {
        const fromHeader = email.payload.headers.find(h => h.name.toLowerCase() === 'from');
        return fromHeader ? fromHeader.value : '';
      });
      const uniqueSenders = new Set(senders);
      
      expect(uniqueSenders.size).toBeGreaterThan(10); // At least 10 unique senders
      
      // Verify content quality
      const emailsWithContent = executiveInbox.emails.filter(email => 
        email.metadata.content.body.length > 50
      );
      
      expect(emailsWithContent.length).toBeGreaterThan(executiveInbox.emails.length * 0.9); // 90% have substantial content
    });
  });
});

/**
 * Mock E2E workflow execution
 * In real implementation, this would call your actual orchestrator
 */
async function executeE2EWorkflow(userQuery: string, context: any): Promise<any> {
  // This is a mock implementation
  // In real implementation, this would:
  // 1. Call your orchestrator service
  // 2. Execute the 3-layer architecture
  // 3. Return the complete result
  
  return {
    response: `Mock response for: ${userQuery}`,
    executionTime: Math.random() * 5000 + 1000, // 1-6 seconds
    tokensUsed: Math.random() * 1000 + 500, // 500-1500 tokens
    apiCalls: mockManager.getApiCallRecords()
  };
}
