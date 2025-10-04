/**
 * End-to-End Test Suite for Whole Inbox Testing
 *
 * Demonstrates comprehensive E2E testing with whole inbox mocking.
 * Tests complete user workflows with realistic data.
 */

import { GenericAIService } from '../../src/services/generic-ai.service';
import { WholeInboxGenerator, InboxData, InboxTemplate } from '../generators/whole-inbox-generator';
import { UnifiedMockManager } from '../mocks/unified-mock-manager';
import { AIDomainService } from '../../src/services/domain/ai-domain.service';
import { OrchestratorService } from '../../src/layers/orchestrator.service';
import { QueryDecomposerService } from '../../src/layers/layer1-decomposition/query-decomposer.service';
import { ExecutionCoordinatorService } from '../../src/layers/layer2-execution/execution-coordinator.service';
import { SynthesisService } from '../../src/layers/layer3-synthesis/synthesis.service';
import { EmailDomainService } from '../../src/services/domain/email-domain.service';
import { GoogleOAuthManager } from '../../src/services/oauth/google-oauth-manager';
import { getAPIClient } from '../../src/services/api';
import { GoogleAPIClient } from '../../src/services/api/clients/google-api-client';

describe('End-to-End Testing with Whole Inbox Mocking', () => {
  let inboxGenerator: WholeInboxGenerator;
  let mockManager: UnifiedMockManager;
  let aiService: GenericAIService;
  let aiDomainService: AIDomainService;
  let orchestrator: OrchestratorService;
  let googleClient: GoogleAPIClient;

  let executiveInbox: InboxData;
  let managerInbox: InboxData;
  let individualInbox: InboxData;

  beforeAll(async () => {
    // Initialize AI services
    aiDomainService = new AIDomainService();
    await aiDomainService.initialize();

    aiService = new GenericAIService(aiDomainService);
    await aiService.initialize();

    // Initialize inbox generator
    inboxGenerator = new WholeInboxGenerator(aiService);
    await inboxGenerator.initialize();

    // Initialize mock manager
    mockManager = UnifiedMockManager.getInstance();
    await mockManager.initialize();

    // Initialize Google API client
    googleClient = await getAPIClient<GoogleAPIClient>('google');

    // IMPORTANT: Set mock manager on Google client for E2E testing
    googleClient.setMockManager(mockManager);

    // Initialize 3-layer orchestrator
    const queryDecomposer = new QueryDecomposerService(aiDomainService);
    await queryDecomposer.initialize();

    const executionCoordinator = new ExecutionCoordinatorService(aiDomainService);
    await executionCoordinator.initialize();

    const synthesisService = new SynthesisService(aiDomainService);
    await synthesisService.initialize();

    orchestrator = new OrchestratorService(
      queryDecomposer,
      executionCoordinator,
      synthesisService
    );
    await orchestrator.initialize();
  }, 30000); // 30 second timeout for initialization

  afterAll(async () => {
    // Clear mock manager from Google client
    if (googleClient) {
      googleClient.clearMockManager();
    }
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
      const userQuery = "Show me all urgent emails that need immediate attention";

      // Execute workflow using real orchestrator
      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: executiveInbox,
          userProfile: executiveInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
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
      const userQuery = "Find all emails about the Q4 planning meeting and show me the current status";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: executiveInbox,
          userProfile: executiveInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000);
      
      // Verify meeting-related content
      expect(result.response.toLowerCase()).toContain('meeting');
      expect(result.response.toLowerCase()).toContain('q4');
    });

    it('should handle complex information gathering workflow', async () => {
      const userQuery = "I need to understand the status of all projects mentioned in emails from the last month. Show me what's been completed, what's in progress, and what needs attention";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: executiveInbox,
          userProfile: executiveInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
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
      const userQuery = "Show me all follow-up emails from my team members that I haven't responded to";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: managerInbox,
          userProfile: managerInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000);
      
      // Verify follow-up content
      expect(result.response.toLowerCase()).toContain('follow');
    });

    it('should handle project status coordination workflow', async () => {
      const userQuery = "What's the current status of all active projects? Show me any blockers or issues";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: managerInbox,
          userProfile: managerInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
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
      const userQuery = "Show me all task-related emails and what I need to work on this week";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: individualInbox,
          userProfile: individualInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(8000);
      
      // Verify task-related content
      expect(result.response.toLowerCase()).toContain('task');
    });

    it('should handle meeting preparation workflow', async () => {
      const userQuery = "I have a meeting tomorrow about the new feature. Show me all related emails and prepare a summary";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: individualInbox,
          userProfile: individualInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeLessThan(10000);
      
      // Verify meeting preparation content
      expect(result.response.toLowerCase()).toContain('meeting');
    });
  });

  describe('Cross-Domain Workflows', () => {
    it('should handle email-to-calendar coordination workflow', async () => {
      const userQuery = "Find all emails about meetings this week and show me what's on my calendar";

      const result = await executeE2EWorkflow(
        userQuery,
        {
          inboxData: executiveInbox,
          userProfile: executiveInbox.metadata.userProfile
        },
        orchestrator,
        mockManager
      );
      
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

        const result = await executeE2EWorkflow(
          "Show me urgent emails",
          {
            inboxData: inbox,
            userProfile: template.userProfile
          },
          orchestrator,
          mockManager
        );

        results.push({
          role: template.userProfile.role,
          emailCount: inbox.emails.length,
          executionTime: result.executionTime
        });

        expect(result.executionTime).toBeLessThan(15000); // 15 seconds max regardless of size
      }
      
      // Log performance results
      console.log('Performance Results:', results);
    });

    it('should generate realistic and diverse email content', async () => {
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
 * E2E workflow execution using real orchestrator
 * Executes the full 3-layer architecture with mocked API responses
 */
async function executeE2EWorkflow(
  userQuery: string,
  context: { inboxData: InboxData; userProfile: any },
  orchestratorInstance: OrchestratorService,
  mockManagerInstance: UnifiedMockManager
): Promise<{
  response: string;
  executionTime: number;
  tokensUsed: number;
  apiCalls: any[];
  metadata?: any;
}> {
  const startTime = Date.now();

  // Setup mock context with inbox data
  await mockManagerInstance.setupMockContext(context.inboxData, context.userProfile);

  // Clear previous API call records
  mockManagerInstance.clearApiCallRecords();

  try {
    // Execute through the real 3-layer orchestrator
    const result = await orchestratorInstance.processUserInput(
      userQuery,
      'test-user-id',
      [], // Empty conversation history for simplicity
      undefined // No previous state
    );

    const executionTime = Date.now() - startTime;

    // Get API calls made during execution
    const apiCalls = mockManagerInstance.getApiCallRecords();

    return {
      response: result.message,
      executionTime,
      tokensUsed: result.metadata?.tokensUsed || 0,
      apiCalls,
      metadata: result.metadata
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      response: `Error: ${error.message}`,
      executionTime,
      tokensUsed: 0,
      apiCalls: mockManagerInstance.getApiCallRecords(),
      metadata: { error: error.message }
    };
  }
}
