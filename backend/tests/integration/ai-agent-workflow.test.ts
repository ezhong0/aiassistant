import { AIEmailAgent } from '../../src/agents/ai-email.agent';
import { ToolExecutionContext } from '../../src/types/tools';
import { GmailService } from '../../src/services/gmail.service';
import { OpenAIService } from '../../src/services/openai.service';
import { getService, initializeServices } from '../../src/services/service-manager';
import { AIPlan } from '../../src/framework/ai-agent';

// Mock dependencies
jest.mock('../../src/services/service-manager');
jest.mock('../../src/utils/logger');

const mockGetService = getService as jest.MockedFunction<typeof getService>;
const mockInitializeServices = initializeServices as jest.MockedFunction<typeof initializeServices>;

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger)
};

describe('AIAgent Integration Workflow', () => {
  let aiEmailAgent: AIEmailAgent;
  let mockGmailService: jest.Mocked<GmailService>;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let testContext: ToolExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock services
    mockGmailService = {
      sendEmail: jest.fn(),
      searchEmails: jest.fn(),
      replyToEmail: jest.fn(),
      getEmail: jest.fn(),
      isReady: jest.fn(() => true),
      initialize: jest.fn(),
      destroy: jest.fn(),
      getHealth: jest.fn(() => ({ healthy: true }))
    } as any;

    mockOpenAIService = {
      generateStructuredData: jest.fn(),
      generateText: jest.fn(),
      createChatCompletion: jest.fn(),
      isReady: jest.fn(() => true),
      initialize: jest.fn(),
      destroy: jest.fn(),
      getHealth: jest.fn(() => ({ healthy: true }))
    } as any;

    mockGetService.mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'gmailService':
          return mockGmailService;
        case 'openaiService':
          return mockOpenAIService;
        default:
          return undefined;
      }
    });

    mockInitializeServices.mockResolvedValue();

    // Initialize services
    await initializeServices();

    // Create agent
    aiEmailAgent = new AIEmailAgent();
    
    testContext = {
      sessionId: 'integration-test-session',
      userId: 'integration-test-user'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complex Email Workflow with AI Planning', () => {
    it('should execute a complete multi-step email workflow', async () => {
      // Test scenario: "Send email to john about the meeting and then search for his previous emails"
      const complexQuery = 'Send email to john@example.com about the quarterly meeting and then search for his previous emails';
      
      // Mock AI plan generation
      const mockPlan: AIPlan = {
        id: 'complex-email-plan-123',
        query: complexQuery,
        steps: [
          {
            id: 'step1',
            tool: 'generateEmailContent',
            description: 'Generate professional email content about quarterly meeting',
            parameters: {
              intent: 'Send email about quarterly meeting',
              recipient: 'john',
              tone: 'professional'
            },
            estimatedTime: 2000,
            requiresConfirmation: false
          },
          {
            id: 'step2',
            tool: 'sendEmail',
            description: 'Send the generated email to john@example.com',
            parameters: {
              to: ['john@example.com'],
              subject: '{{step1.subject}}',
              body: '{{step1.body}}'
            },
            dependencies: ['step1'],
            estimatedTime: 3000,
            requiresConfirmation: true
          },
          {
            id: 'step3',
            tool: 'searchEmails',
            description: 'Search for previous emails from john@example.com',
            parameters: {
              query: 'from:john@example.com',
              maxResults: 10
            },
            dependencies: ['step2'],
            estimatedTime: 2000,
            requiresConfirmation: false
          },
          {
            id: 'step4',
            tool: 'think',
            description: 'Analyze the workflow completion and provide summary',
            parameters: {
              query: 'Analyze the email sending and search results',
              context: 'Email sent to john about quarterly meeting, searched his previous emails'
            },
            dependencies: ['step2', 'step3'],
            estimatedTime: 1000,
            requiresConfirmation: false
          }
        ],
        totalEstimatedTime: 8000,
        requiresConfirmation: true,
        confidence: 0.85,
        reasoning: 'Multi-step workflow requires generating content, sending email, searching history, and analysis',
        fallbackStrategy: 'manual'
      };

      // Mock AI responses
      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);
      
      // Mock email content generation
      mockOpenAIService.generateText
        .mockResolvedValueOnce(`Subject: Quarterly Meeting Discussion
      
Dear John,

I hope this email finds you well. I wanted to reach out regarding our upcoming quarterly meeting scheduled for next week.

Could you please confirm your availability and let me know if you have any specific topics you'd like to discuss?

Best regards`)
        .mockResolvedValueOnce('The email has been sent successfully and previous email history has been retrieved for context.');

      // Mock Gmail service responses
      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'sent-msg-123',
        threadId: 'thread-456'
      });

      mockGmailService.searchEmails.mockResolvedValue([
        { id: 'email1', subject: 'Previous discussion', from: 'john@example.com', date: '2024-01-15' },
        { id: 'email2', subject: 'Project update', from: 'john@example.com', date: '2024-01-10' },
        { id: 'email3', subject: 'Meeting notes', from: 'john@example.com', date: '2024-01-05' }
      ] as any);

      // Execute the complex workflow
      const params = {
        query: complexQuery,
        accessToken: 'valid-integration-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(true);
      expect(result.result.executionSummary).toContain('4/4 successful steps');

      // Verify AI plan was generated
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledTimes(1);
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledWith(
        expect.stringContaining(complexQuery),
        expect.stringContaining('AI planning assistant'),
        expect.any(Object),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 1500
        })
      );

      // Verify email content generation
      expect(mockOpenAIService.generateText).toHaveBeenCalledTimes(2);
      
      // Verify email was sent
      expect(mockGmailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockGmailService.sendEmail).toHaveBeenCalledWith(
        'valid-integration-token',
        'john@example.com',
        'Quarterly Meeting Discussion',
        expect.stringContaining('Dear John'),
        { cc: undefined, bcc: undefined }
      );

      // Verify email search was performed
      expect(mockGmailService.searchEmails).toHaveBeenCalledTimes(1);
      expect(mockGmailService.searchEmails).toHaveBeenCalledWith(
        'valid-integration-token',
        'from:john@example.com',
        {
          maxResults: 10,
          includeSpamTrash: false
        }
      );

      // Verify final result structure
      expect(result.result.action).toBe('send'); // Primary action
      expect(result.result.messageId).toBe('sent-msg-123');
      expect(result.result.recipient).toBe('john@example.com');
    });

    it('should handle partial workflow failure gracefully', async () => {
      // Test scenario where email sending fails but search succeeds
      const query = 'Send email to john about meeting and search his emails';
      
      const mockPlan: AIPlan = {
        id: 'partial-failure-plan',
        query,
        steps: [
          {
            id: 'step1',
            tool: 'sendEmail',
            description: 'Send email to john',
            parameters: {
              to: ['john@example.com'],
              subject: 'Meeting Discussion',
              body: 'Let\'s discuss the meeting.'
            },
            estimatedTime: 3000,
            requiresConfirmation: true
          },
          {
            id: 'step2',
            tool: 'searchEmails',
            description: 'Search for emails from john',
            parameters: {
              query: 'from:john@example.com'
            },
            estimatedTime: 2000,
            requiresConfirmation: false
          }
        ],
        totalEstimatedTime: 5000,
        requiresConfirmation: true,
        confidence: 0.8
      };

      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);
      
      // Mock email sending failure
      mockGmailService.sendEmail.mockRejectedValue(new Error('Quota exceeded'));
      
      // Mock successful search
      mockGmailService.searchEmails.mockResolvedValue([
        { id: 'email1', subject: 'Previous email', from: 'john@example.com' }
      ] as any);

      const params = {
        query,
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      // Should still succeed overall (non-critical step failed)
      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(true);
      expect(result.result.executionSummary).toContain('1/2 successful steps');

      // Verify both operations were attempted
      expect(mockGmailService.sendEmail).toHaveBeenCalled();
      expect(mockGmailService.searchEmails).toHaveBeenCalled();
    });

    it('should handle AI planning failure with manual fallback', async () => {
      // Mock AI planning failure
      mockOpenAIService.generateStructuredData.mockRejectedValue(new Error('AI service unavailable'));
      
      // Mock successful manual execution
      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'manual-msg-123',
        threadId: 'manual-thread-456'
      });

      const params = {
        query: 'Send email to john@example.com about the meeting',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false); // Fell back to manual
      expect(result.result.messageId).toBe('manual-msg-123');
      expect(result.result.action).toBe('send');

      // Verify AI planning was attempted but manual execution succeeded
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalled();
      expect(mockGmailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('Preview Generation with AI Planning', () => {
    it('should generate detailed preview using AI planning', async () => {
      const query = 'Send email to the team about project launch and follow up with stakeholders';
      
      const mockPlan: AIPlan = {
        id: 'preview-plan-123',
        query,
        steps: [
          {
            id: 'step1',
            tool: 'sendEmail',
            description: 'Send email to team about project launch',
            parameters: {
              to: ['team@company.com'],
              subject: 'Project Launch Announcement',
              body: 'I\'m excited to announce...'
            },
            estimatedTime: 3000,
            requiresConfirmation: true
          },
          {
            id: 'step2',
            tool: 'sendEmail',
            description: 'Follow up with stakeholders',
            parameters: {
              to: ['stakeholders@company.com'],
              subject: 'Project Launch - Stakeholder Update',
              body: 'Following our launch...'
            },
            dependencies: ['step1'],
            estimatedTime: 3000,
            requiresConfirmation: true
          }
        ],
        totalEstimatedTime: 6000,
        requiresConfirmation: true,
        confidence: 0.9,
        reasoning: 'Two-step email workflow with clear dependencies'
      };

      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);

      const params = {
        query,
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.executePreview(params, testContext);

      expect(result.success).toBe(true);
      expect(result.result.awaitingConfirmation).toBe(true);
      expect(result.result.preview).toBeDefined();

      const preview = result.result.preview!;
      expect(preview.actionType).toBe('EMAIL_SEND');
      expect(preview.requiresConfirmation).toBe(true);
      expect(preview.estimatedTime).toBe(6000);
      expect(preview.steps).toHaveLength(2);
      expect(preview.steps![0].description).toContain('Send email to team');
      expect(preview.steps![1].description).toContain('Follow up with stakeholders');
      expect(preview.riskAssessment.level).toBe('medium'); // Multiple steps = medium risk
    });

    it('should handle preview generation failure', async () => {
      mockOpenAIService.generateStructuredData.mockRejectedValue(new Error('Preview generation failed'));

      const params = {
        query: 'Send important email',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.executePreview(params, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Preview generation failed');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache AI plans for identical queries', async () => {
      const query = 'Send email to john about project status';
      
      const mockPlan: AIPlan = {
        id: 'cached-plan-123',
        query,
        steps: [
          {
            id: 'step1',
            tool: 'sendEmail',
            description: 'Send project status email',
            parameters: {
              to: ['john@example.com'],
              subject: 'Project Status Update',
              body: 'Here is the current project status...'
            },
            requiresConfirmation: true
          }
        ],
        totalEstimatedTime: 3000,
        requiresConfirmation: true,
        confidence: 0.85
      };

      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);
      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'cached-msg-1',
        threadId: 'cached-thread-1'
      });

      const params = {
        query,
        accessToken: 'valid-token'
      };

      // First execution - should generate plan
      const result1 = await aiEmailAgent.execute(params, testContext);
      expect(result1.success).toBe(true);
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledTimes(1);

      // Reset mock call count but keep the cached plan
      mockGmailService.sendEmail.mockClear();
      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'cached-msg-2',
        threadId: 'cached-thread-2'
      });

      // Second execution with same query - should use cached plan
      const result2 = await aiEmailAgent.execute(params, testContext);
      expect(result2.success).toBe(true);
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledTimes(1); // Still just 1 call

      // Both executions should have been successful
      expect(result1.result.aiPlanExecuted).toBe(true);
      expect(result2.result.aiPlanExecuted).toBe(true);
    });

    it('should complete execution within performance requirements', async () => {
      const startTime = Date.now();
      
      const query = 'Send quick email to john@example.com';
      
      const mockPlan: AIPlan = {
        id: 'performance-plan',
        query,
        steps: [
          {
            id: 'step1',
            tool: 'sendEmail',
            description: 'Send quick email',
            parameters: {
              to: ['john@example.com'],
              subject: 'Quick Update',
              body: 'Quick message'
            },
            estimatedTime: 1000,
            requiresConfirmation: false // No confirmation for speed
          }
        ],
        totalEstimatedTime: 1000,
        requiresConfirmation: false,
        confidence: 0.95
      };

      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);
      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'fast-msg-123',
        threadId: 'fast-thread-456'
      });

      const params = {
        query,
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(true);
      
      // Should complete within 2 seconds (performance requirement from docs)
      expect(executionTime).toBeLessThan(2000);
      expect(result.executionTime).toBeLessThan(2000);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient AI service failures', async () => {
      // First attempt fails, second succeeds
      mockOpenAIService.generateStructuredData
        .mockRejectedValueOnce(new Error('Temporary AI service error'))
        .mockResolvedValueOnce({
          id: 'recovery-plan',
          query: 'Send email',
          steps: [{
            id: 'step1',
            tool: 'sendEmail',
            description: 'Send email',
            parameters: {
              to: ['john@example.com'],
              subject: 'Recovery Test',
              body: 'Test message'
            },
            requiresConfirmation: false
          }],
          totalEstimatedTime: 2000,
          requiresConfirmation: false,
          confidence: 0.8
        } as AIPlan);

      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'recovery-msg-123',
        threadId: 'recovery-thread-456'
      });

      const params = {
        query: 'Send email to john@example.com',
        accessToken: 'valid-token'
      };

      // Should fall back to manual execution on first failure
      const result = await aiEmailAgent.execute(params, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false); // Fell back to manual
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledTimes(1);
      expect(mockGmailService.sendEmail).toHaveBeenCalled();
    });

    it('should maintain service isolation during failures', async () => {
      // Mock AI service failure but Gmail service working
      mockOpenAIService.generateStructuredData.mockRejectedValue(new Error('AI service down'));
      mockGmailService.sendEmail.mockResolvedValue({
        messageId: 'isolated-msg-123',
        threadId: 'isolated-thread-456'
      });

      const params = {
        query: 'Send email to john@example.com about isolation test',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      // Should succeed despite AI service failure
      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.messageId).toBe('isolated-msg-123');
      
      // AI service failure should not affect Gmail service
      expect(mockGmailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect custom AI configuration', async () => {
      // Create agent with custom configuration
      const customAgent = new (class extends AIEmailAgent {
        constructor() {
          super();
          this.updateAIConfig({
            enableAIPlanning: true,
            maxPlanningSteps: 3,
            planningTimeout: 5000,
            planningTemperature: 0.3
          });
        }
      })();

      const mockPlan: AIPlan = {
        id: 'custom-config-plan',
        query: 'test query',
        steps: [
          {
            id: 'step1',
            tool: 'think',
            description: 'Think about it',
            parameters: { query: 'custom config test' },
            requiresConfirmation: false
          }
        ],
        totalEstimatedTime: 1000,
        requiresConfirmation: false,
        confidence: 0.9
      };

      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);
      mockOpenAIService.generateText.mockResolvedValue('Custom configuration working');

      const params = {
        query: 'test custom configuration',
        accessToken: 'valid-token'
      };

      const result = await customAgent.execute(params, testContext);

      expect(result.success).toBe(true);
      
      // Verify custom temperature was used
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          temperature: 0.3, // Custom temperature
          maxTokens: 1500
        })
      );
    });

    it('should allow runtime configuration updates', () => {
      const initialConfig = aiEmailAgent.getAIConfig();
      expect(initialConfig.planningTimeout).toBe(15000);

      // Update configuration at runtime
      aiEmailAgent.updateAIConfig({
        planningTimeout: 10000,
        maxPlanningSteps: 5
      });

      const updatedConfig = aiEmailAgent.getAIConfig();
      expect(updatedConfig.planningTimeout).toBe(10000);
      expect(updatedConfig.maxPlanningSteps).toBe(5);
      expect(updatedConfig.enableAIPlanning).toBe(true); // Unchanged
    });
  });
});