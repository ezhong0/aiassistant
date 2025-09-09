import { AIEmailAgent } from '../../../src/agents/ai-email.agent';
import { ToolExecutionContext } from '../../../src/types/tools';
import { GmailService } from '../../../src/services/gmail.service';
import { OpenAIService } from '../../../src/services/openai.service';
import { getService } from '../../../src/services/service-manager';
import { EMAIL_CONSTANTS } from '../../../src/config/constants';

// Mock dependencies
jest.mock('../../../src/services/service-manager');
jest.mock('../../../src/utils/logger');

const mockGetService = getService as jest.MockedFunction<typeof getService>;
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger)
};

describe('AIEmailAgent', () => {
  let aiEmailAgent: AIEmailAgent;
  let mockGmailService: jest.Mocked<GmailService>;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let testContext: ToolExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock services
    mockGmailService = {
      sendEmail: jest.fn(),
      searchEmails: jest.fn(),
      replyToEmail: jest.fn(),
      getEmail: jest.fn(),
      isReady: jest.fn(() => true)
    } as any;

    mockOpenAIService = {
      generateStructuredData: jest.fn(),
      generateText: jest.fn(),
      createChatCompletion: jest.fn(),
      isReady: jest.fn(() => true)
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

    aiEmailAgent = new AIEmailAgent();
    testContext = {
      sessionId: 'test-session-123',
      userId: 'test-user-456'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const config = aiEmailAgent.getConfig();
      const aiConfig = aiEmailAgent.getAIConfig();
      
      expect(config.name).toBe('ai-emailAgent');
      expect(config.description).toContain('AI-powered email agent');
      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(45000); // Increased for AI planning
      
      expect(aiConfig.enableAIPlanning).toBe(true);
      expect(aiConfig.maxPlanningSteps).toBe(8);
      expect(aiConfig.planningTimeout).toBe(15000);
    });

    it('should register email-specific tools', () => {
      const tools = aiEmailAgent.getRegisteredTools();
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('sendEmail');
      expect(toolNames).toContain('searchEmails');
      expect(toolNames).toContain('replyEmail');
      expect(toolNames).toContain('lookupContact');
      expect(toolNames).toContain('generateEmailContent');
      expect(toolNames).toContain('think'); // Default tool

      // Verify send email tool configuration
      const sendEmailTool = tools.find(tool => tool.name === 'sendEmail');
      expect(sendEmailTool?.requiresConfirmation).toBe(true);
      expect(sendEmailTool?.estimatedExecutionTime).toBe(3000);
      expect(sendEmailTool?.capabilities).toContain('email-sending');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const invalidParams = { query: 'send email' } as any;

      const result = await aiEmailAgent.execute(invalidParams, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access token is required');
    });

    it('should validate access token format', async () => {
      const invalidParams = {
        query: 'send email',
        accessToken: 'x'.repeat(EMAIL_CONSTANTS.MAX_LOG_BODY_LENGTH + 1)
      };

      const result = await aiEmailAgent.execute(invalidParams, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access token appears to be invalid');
    });

    it('should accept valid parameters', async () => {
      const validParams = {
        query: 'simple email query',
        accessToken: 'valid-token-123'
      };

      // Mock manual execution (AI planning disabled for simple queries)
      mockGmailService.searchEmails.mockResolvedValue([]);

      const result = await aiEmailAgent.execute(validParams, testContext);

      expect(result.success).toBe(true);
    });
  });

  describe('AI Planning Decision Logic', () => {
    it('should use AI planning for complex queries', () => {
      const complexQueries = [
        'Send email to john about the meeting and then schedule a follow-up',
        'Email the team about the project update and also send a reminder',
        'Find emails from sarah and then reply to the most recent one',
        'This is a very long query that suggests complexity due to its length and multiple requirements'
      ];

      complexQueries.forEach(query => {
        const shouldUse = aiEmailAgent['canUseAIPlanning']({
          query,
          accessToken: 'test-token'
        });
        expect(shouldUse).toBe(true);
      });
    });

    it('should not use AI planning for simple queries', () => {
      const simpleQueries = [
        'Send email',
        'Search emails',
        'Reply to messageId:123',
        'Get threadId:456'
      ];

      simpleQueries.forEach(query => {
        const shouldUse = aiEmailAgent['canUseAIPlanning']({
          query,
          accessToken: 'test-token'
        });
        expect(shouldUse).toBe(false);
      });
    });

    it('should not use AI planning for direct action queries', () => {
      const directActionQueries = [
        'Reply to messageId:abc123',
        'Get email threadId:def456',
        'Search emails messageId:ghi789'
      ];

      directActionQueries.forEach(query => {
        const shouldUse = aiEmailAgent['canUseAIPlanning']({
          query,
          accessToken: 'test-token'
        });
        expect(shouldUse).toBe(false);
      });
    });
  });

  describe('Tool Execution', () => {
    it('should execute sendEmail tool successfully', async () => {
      const mockSendResult = {
        messageId: 'msg-123',
        threadId: 'thread-456'
      };
      mockGmailService.sendEmail.mockResolvedValue(mockSendResult);

      const parameters = {
        to: ['john@example.com'],
        subject: 'Test Email',
        body: 'This is a test email',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'sendEmail',
        parameters,
        { ...testContext, accessToken: 'valid-token' }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(result.threadId).toBe('thread-456');
      expect(result.action).toBe('send');
      expect(mockGmailService.sendEmail).toHaveBeenCalledWith(
        'valid-token',
        'john@example.com',
        'Test Email',
        'This is a test email',
        { cc: undefined, bcc: undefined }
      );
    });

    it('should handle sendEmail tool failure', async () => {
      mockGmailService.sendEmail.mockRejectedValue(new Error('Gmail API error'));

      const parameters = {
        to: ['john@example.com'],
        subject: 'Test Email',
        body: 'This is a test email',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'sendEmail',
        parameters,
        { ...testContext, accessToken: 'valid-token' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gmail API error');
    });

    it('should execute searchEmails tool successfully', async () => {
      const mockSearchResults = [
        { id: 'email1', subject: 'Test 1' },
        { id: 'email2', subject: 'Test 2' }
      ];
      mockGmailService.searchEmails.mockResolvedValue(mockSearchResults as any);

      const parameters = {
        query: 'from:john@example.com',
        maxResults: 10,
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'searchEmails',
        parameters,
        { ...testContext, accessToken: 'valid-token' }
      );

      expect(result.success).toBe(true);
      expect(result.emails).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.action).toBe('search');
      expect(mockGmailService.searchEmails).toHaveBeenCalledWith(
        'valid-token',
        'from:john@example.com',
        {
          maxResults: 10,
          includeSpamTrash: false
        }
      );
    });

    it('should execute replyEmail tool successfully', async () => {
      const mockReplyResult = {
        messageId: 'reply-123',
        threadId: 'thread-456'
      };
      mockGmailService.replyToEmail.mockResolvedValue(mockReplyResult);

      const parameters = {
        messageId: 'original-msg-123',
        threadId: 'thread-456',
        body: 'This is my reply',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'replyEmail',
        parameters,
        { ...testContext, accessToken: 'valid-token' }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('reply-123');
      expect(result.action).toBe('reply');
      expect(mockGmailService.replyToEmail).toHaveBeenCalledWith(
        'valid-token',
        'original-msg-123',
        'This is my reply'
      );
    });

    it('should execute generateEmailContent tool successfully', async () => {
      mockOpenAIService.generateText.mockResolvedValue(`Subject: Meeting Follow-up
      
Thank you for the productive meeting today. I wanted to follow up on the key points we discussed and outline the next steps.

Best regards`);

      const parameters = {
        intent: 'Follow up on meeting',
        context: 'Had a productive discussion about project timeline',
        tone: 'professional',
        recipient: 'team member'
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'generateEmailContent',
        parameters,
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.subject).toContain('Meeting Follow-up');
      expect(result.body).toContain('Thank you for the productive meeting');
      expect(result.tone).toBe('professional');
      expect(mockOpenAIService.generateText).toHaveBeenCalled();
    });

    it('should handle missing access token in tool execution', async () => {
      const parameters = {
        to: ['john@example.com'],
        subject: 'Test Email',
        body: 'This is a test email'
        // accessToken missing
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'sendEmail',
        parameters,
        testContext // No accessToken in context either
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access token not available');
    });

    it('should handle missing Gmail service', async () => {
      mockGetService.mockImplementation((serviceName: string) => {
        if (serviceName === 'gmailService') {
          return undefined;
        }
        return mockOpenAIService;
      });

      const parameters = {
        to: ['john@example.com'],
        subject: 'Test Email',
        body: 'This is a test email',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent['executeCustomTool'](
        'sendEmail',
        parameters,
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gmail service not available');
    });
  });

  describe('Email Content Generation', () => {
    it('should generate email content with AI when available', async () => {
      const mockAIResponse = {
        success: true,
        subject: 'AI Generated Subject',
        body: 'AI generated email body content'
      };

      // Mock the generateEmailContent tool
      jest.spyOn(aiEmailAgent, 'executeCustomTool' as any)
        .mockImplementation(async (toolName: string) => {
          if (toolName === 'generateEmailContent') {
            return mockAIResponse;
          }
          return { success: false };
        });

      const result = await aiEmailAgent['extractEmailContent'](
        'Send a professional email to the team',
        [{ name: 'John', email: 'john@example.com' }]
      );

      expect(result.subject).toBe('AI Generated Subject');
      expect(result.body).toBe('AI generated email body content');
      expect(result.to).toEqual(['john@example.com']);
    });

    it('should fallback to basic extraction when AI fails', async () => {
      // Mock AI service to be unavailable
      mockGetService.mockImplementation((serviceName: string) => {
        if (serviceName === 'gmailService') {
          return mockGmailService;
        }
        return undefined; // OpenAI service unavailable
      });

      const result = await aiEmailAgent['extractEmailContent'](
        'Send email about "Project Update" saying "The project is on track"',
        [{ name: 'John', email: 'john@example.com' }]
      );

      expect(result.to).toEqual(['john@example.com']);
      expect(result.body).toContain('Project Update'); // Should extract from quotes
    });

    it('should extract email content using basic patterns', () => {
      const result = aiEmailAgent['extractEmailContentBasic'](
        'Send email to team about "Quarterly Review" saying "Please prepare your reports"',
        [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' }
        ]
      );

      expect(result.to).toEqual(['alice@example.com', 'bob@example.com']);
      expect(result.subject).toBe('Email from AI Assistant'); // Default subject
      expect(result.body).toContain('Please prepare your reports');
    });
  });

  describe('Manual Execution Fallback', () => {
    beforeEach(() => {
      // Disable AI planning to test manual execution
      aiEmailAgent.updateAIConfig({ enableAIPlanning: false });
    });

    it('should execute send email manually', async () => {
      const mockSendResult = {
        messageId: 'msg-manual-123',
        threadId: 'thread-manual-456'
      };
      mockGmailService.sendEmail.mockResolvedValue(mockSendResult);

      const params = {
        query: 'Send email to john@example.com about meeting',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.messageId).toBe('msg-manual-123');
      expect(result.result.action).toBe('send');
    });

    it('should execute search emails manually', async () => {
      const mockSearchResults = [
        { id: 'email1', subject: 'Test 1' }
      ];
      mockGmailService.searchEmails.mockResolvedValue(mockSearchResults as any);

      const params = {
        query: 'search for emails from john',
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.emails).toHaveLength(1);
      expect(result.result.action).toBe('search');
    });

    it('should execute reply email manually', async () => {
      const mockReplyResult = {
        messageId: 'reply-manual-123',
        threadId: 'thread-manual-456'
      };
      mockGmailService.replyToEmail.mockResolvedValue(mockReplyResult);

      const params = {
        query: 'reply saying thanks',
        accessToken: 'valid-token',
        messageId: 'original-msg-123',
        threadId: 'thread-456'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.messageId).toBe('reply-manual-123');
      expect(result.result.action).toBe('reply');
    });
  });

  describe('Operation Detection', () => {
    it('should detect send operations correctly', () => {
      const sendQueries = [
        'send email to john about meeting',
        'send a message to the team',
        'email john about the project'
      ];

      sendQueries.forEach(query => {
        const operation = aiEmailAgent['detectOperation']({ query, accessToken: 'token' });
        expect(operation).toBe('send');
      });
    });

    it('should detect reply operations correctly', () => {
      const replyQueries = [
        'reply to the email',
        'respond to john\'s message',
        'reply saying yes'
      ];

      replyQueries.forEach(query => {
        const operation = aiEmailAgent['detectOperation']({ query, accessToken: 'token' });
        expect(operation).toBe('reply');
      });
    });

    it('should detect search operations correctly', () => {
      const searchQueries = [
        'search for emails from john',
        'find emails about meetings',
        'look for messages from last week'
      ];

      searchQueries.forEach(query => {
        const operation = aiEmailAgent['detectOperation']({ query, accessToken: 'token' });
        expect(operation).toBe('search');
      });
    });

    it('should default to search for unknown operations', () => {
      const unknownQuery = 'what is this about?';
      const operation = aiEmailAgent['detectOperation']({ query: unknownQuery, accessToken: 'token' });
      expect(operation).toBe('search');
    });
  });

  describe('Result Building', () => {
    it('should build AI plan result correctly', () => {
      const summary = {
        planId: 'test-plan-123',
        totalSteps: 3,
        successfulSteps: 2,
        failedSteps: 1
      };

      const successfulResults = [
        { success: true, action: 'send', messageId: 'msg-123', subject: 'Test' },
        { success: true, analysis: 'Complete' }
      ];

      const failedResults = [
        { success: false, error: 'Failed step' }
      ];

      const result = aiEmailAgent['buildFinalResult'](
        summary,
        successfulResults,
        failedResults,
        { query: 'test', accessToken: 'token' },
        testContext
      );

      expect(result.aiPlanExecuted).toBe(true);
      expect(result.action).toBe('send');
      expect(result.messageId).toBe('msg-123');
      expect(result.executionSummary).toContain('2/3 successful steps');
    });

    it('should synthesize results when no primary email operation found', () => {
      const summary = { totalSteps: 2 };
      const successfulResults = [
        { success: true, analysis: 'Step 1 complete' },
        { success: true, thinking: 'Step 2 complete' }
      ];

      const result = aiEmailAgent['buildFinalResult'](
        summary,
        successfulResults,
        [],
        { query: 'test', accessToken: 'token' },
        testContext
      );

      expect(result.aiPlanExecuted).toBe(true);
      expect(result.action).toBe('search'); // Default action
      expect(result.count).toBe(0);
      expect(result.executionSummary).toContain('AI plan executed 0 operations');
    });
  });

  describe('Parameter Sanitization', () => {
    it('should sanitize tool parameters for logging', () => {
      const parameters = {
        to: ['john@example.com'],
        subject: 'Test Email',
        body: 'This is a very long email body that should be truncated for logging purposes because it exceeds the character limit',
        accessToken: 'sensitive-token-123',
        cc: ['jane@example.com']
      };

      const sanitized = aiEmailAgent['sanitizeToolParameters'](parameters);

      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.body).toContain('...');
      expect(sanitized.body.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(sanitized.to).toEqual(['john@example.com']); // Non-sensitive data preserved
      expect(sanitized.subject).toBe('Test Email');
    });

    it('should sanitize agent parameters for logging', () => {
      const params = {
        query: 'This is a very long query that should be truncated for logging purposes because it exceeds one hundred characters in length',
        accessToken: 'sensitive-token-123',
        contactEmail: 'contact@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        contacts: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' }
        ]
      };

      const sanitized = aiEmailAgent['sanitizeForLogging'](params);

      expect(sanitized.query).toContain('...');
      expect(sanitized.query.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.contactEmail).toBe('[EMAIL]');
      expect(sanitized.body).toBe('[BODY_PRESENT]');
      expect(sanitized.contactsCount).toBe(2);
      expect(sanitized.subject).toBe('Test Subject');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const parameters = {
        to: ['invalid-email'],
        subject: 'Test',
        body: 'Test body',
        accessToken: 'valid-token'
      };

      mockGmailService.sendEmail.mockRejectedValue(new Error('Invalid recipient'));

      const result = await aiEmailAgent['executeCustomTool'](
        'sendEmail',
        parameters,
        { ...testContext, accessToken: 'valid-token' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient');
      expect(result.toolName).toBe('sendEmail');
    });

    it('should handle unknown tool execution', async () => {
      const result = await aiEmailAgent['executeCustomTool'](
        'unknownTool',
        { input: 'test' },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool: unknownTool');
    });

    it('should handle missing required parameters in manual execution', async () => {
      aiEmailAgent.updateAIConfig({ enableAIPlanning: false });

      const params = {
        query: 'reply to email', // Reply without messageId/threadId
        accessToken: 'valid-token'
      };

      const result = await aiEmailAgent.execute(params, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing reply information');
    });
  });
});