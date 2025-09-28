import { SlackAgent, SlackMessage, SlackThread, SlackDraft } from '../../src/agents/slack.agent';
import { SlackAgentRequest, SlackAgentResult } from '../../src/agents/slack.agent';
import { ToolExecutionContext } from '../../src/types/tools';
import { SlackContext } from '../../src/types/slack.types';
import { getService } from '../../src/services/service-manager';

// Mock the service manager
jest.mock('../../src/services/service-manager', () => ({
  getService: jest.fn()
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  child: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('SlackAgent', () => {
  let slackAgent: SlackAgent;
  let mockSlackDomainService: any;
  let mockExecutionContext: ToolExecutionContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock Slack domain service
    mockSlackDomainService = {
      readChannelMessages: jest.fn(),
      readThreadMessages: jest.fn(),
      detectDraftMessages: jest.fn(),
      checkConfirmationStatus: jest.fn()
    };

    // Mock service manager
    (getService as jest.Mock).mockImplementation((serviceName: string) => {
      if (serviceName === 'slackInterfaceService') {
        return mockSlackDomainService;
      }
      return null;
    });

    // Create agent instance
    slackAgent = new SlackAgent();

    // Create mock execution context
    mockExecutionContext = {
      sessionId: 'test-session-123',
      userId: 'test-user-456',
      timestamp: new Date(),
      slackContext: {
        userId: 'test-user-456',
        channelId: 'test-channel-789',
        teamId: 'test-team-101',
        isDirectMessage: true
      } as SlackContext
    };
  });

  describe('Constructor and Configuration', () => {
    it('should create SlackAgent with correct configuration', () => {
      expect(slackAgent).toBeInstanceOf(SlackAgent);
      expect(slackAgent.getConfig().name).toBe('slackAgent');
      expect(slackAgent.getConfig().description).toBe('Read Slack message history, manage drafts, and handle confirmations');
      expect(slackAgent.isEnabled()).toBe(true);
    });

    it('should have correct timeout and retry settings', () => {
      expect(slackAgent.getTimeout()).toBe(15000);
      expect(slackAgent.getRetries()).toBe(2);
    });

    it('should have AI planning enabled', () => {
      const aiConfig = slackAgent.getAIConfig();
      expect(aiConfig.enableAIPlanning).toBe(true);
      expect(aiConfig.maxPlanningSteps).toBe(5);
      expect(aiConfig.planningTimeout).toBe(10000);
    });
  });

  describe('OpenAI Function Schema', () => {
    it('should generate correct OpenAI function schema', () => {
      const schema = SlackAgent.getOpenAIFunctionSchema();
      
      expect(schema.name).toBe('slack_operations');
      expect(schema.description).toContain('Read Slack message history');
      expect(schema.parameters.type).toBe('object');
      expect(schema.parameters.required).toEqual(['query']);
      
      // Check required properties
      expect(schema.parameters.properties.query).toBeDefined();
      expect(schema.parameters.properties.operation).toBeDefined();
      expect(schema.parameters.properties.channelId).toBeDefined();
      expect(schema.parameters.properties.threadTs).toBeDefined();
      expect(schema.parameters.properties.limit).toBeDefined();
    });

    it('should have correct operation enum values', () => {
      const schema = SlackAgent.getOpenAIFunctionSchema();
      const operationEnum = schema.parameters.properties.operation.enum;
      
      expect(operationEnum).toEqual([
        'read_messages',
        'read_thread', 
        'detect_drafts',
        'manage_drafts',
        'confirmation_handling'
      ]);
    });
  });

  describe('Capabilities and Limitations', () => {
    it('should return correct capabilities', () => {
      const capabilities = SlackAgent.getCapabilities();
      
      expect(capabilities).toContain('Read Slack message history from channels and threads');
      expect(capabilities).toContain('Detect and manage draft messages');
      expect(capabilities).toContain('Handle confirmation workflows for pending actions');
      expect(capabilities).toContain('Parse conversation context and extract key information');
    });

    it('should return correct limitations', () => {
      const limitations = SlackAgent.getLimitations();
      
      expect(limitations).toContain('Requires Slack bot token and proper permissions');
      expect(limitations).toContain('Limited to channels the bot has access to');
      expect(limitations).toContain('Cannot send messages (read-only operations)');
      expect(limitations).toContain('Draft detection depends on message metadata');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required access token', async () => {
      const invalidParams: SlackAgentRequest = {
        query: 'test query',
        accessToken: ''
      };

      await expect(slackAgent.execute(invalidParams, mockExecutionContext))
        .rejects.toThrow('Access token is required for Slack operations');
    });

    it('should validate query length', async () => {
      const longQuery = 'a'.repeat(201); // Exceeds MAX_QUERY_LENGTH
      const invalidParams: SlackAgentRequest = {
        query: longQuery,
        accessToken: 'valid-token'
      };

      await expect(slackAgent.execute(invalidParams, mockExecutionContext))
        .rejects.toThrow('Query is too long for Slack search');
    });

    it('should validate message limit range', async () => {
      const invalidParams: SlackAgentRequest = {
        query: 'test query',
        accessToken: 'valid-token',
        limit: 150 // Exceeds MAX_MESSAGE_LIMIT
      };

      await expect(slackAgent.execute(invalidParams, mockExecutionContext))
        .rejects.toThrow('Message limit must be between 1 and 100');
    });

    it('should accept valid parameters', async () => {
      const validParams: SlackAgentRequest = {
        query: 'read recent messages',
        accessToken: 'valid-token',
        channelId: 'test-channel',
        limit: 20
      };

      // Mock successful execution
      mockSlackDomainService.readChannelMessages.mockResolvedValue([]);

      const result = await slackAgent.execute(validParams, mockExecutionContext);
      expect(result.success).toBe(true);
    });
  });

  describe('Operation Detection', () => {
    it('should detect read_messages operation', () => {
      const params: SlackAgentRequest = {
        query: 'read messages from channel',
        accessToken: 'token'
      };

      // Access private method through type assertion
      const operation = (slackAgent as any).determineOperation(params.query);
      expect(operation).toBe('read_messages');
    });

    it('should detect read_thread operation', () => {
      const params: SlackAgentRequest = {
        query: 'show conversation thread',
        accessToken: 'token'
      };

      const operation = (slackAgent as any).determineOperation(params.query);
      expect(operation).toBe('read_thread');
    });

    it('should detect detect_drafts operation', () => {
      const params: SlackAgentRequest = {
        query: 'check for pending drafts',
        accessToken: 'token'
      };

      const operation = (slackAgent as any).determineOperation(params.query);
      expect(operation).toBe('detect_drafts');
    });

    it('should detect confirmation_handling operation', () => {
      const params: SlackAgentRequest = {
        query: 'approve pending confirmation',
        accessToken: 'token'
      };

      const operation = (slackAgent as any).determineOperation(params.query);
      expect(operation).toBe('confirmation_handling');
    });
  });

  describe('Message Reading Operations', () => {
    it('should handle read_messages operation successfully', async () => {
      const mockMessages: SlackMessage[] = [
        {
          id: 'msg1',
          text: 'Hello world',
          userId: 'user1',
          channelId: 'channel1',
          timestamp: '1234567890.123',
          isBot: false
        },
        {
          id: 'msg2',
          text: 'How are you?',
          userId: 'user2',
          channelId: 'channel1',
          timestamp: '1234567891.123',
          isBot: false
        }
      ];

      mockSlackDomainService.readChannelMessages.mockResolvedValue(mockMessages);

      const params: SlackAgentRequest = {
        query: 'read recent messages',
        accessToken: 'token',
        channelId: 'channel1',
        limit: 10
      };

      const result = await slackAgent.execute(params, mockExecutionContext);
      
      expect(result.success).toBe(true);
      expect(result.result.operation).toBe('read_messages');
      expect(result.result.totalCount).toBe(2);
      expect(result.result.messages).toEqual(mockMessages);
    });

    it('should handle read_thread operation successfully', async () => {
      const mockMessages: SlackMessage[] = [
        {
          id: 'msg1',
          text: 'Thread message 1',
          userId: 'user1',
          channelId: 'channel1',
          timestamp: '1234567890.123',
          threadTs: '1234567890.123',
          isBot: false
        }
      ];

      mockSlackDomainService.readThreadMessages.mockResolvedValue(mockMessages);

      const params: SlackAgentRequest = {
        query: 'read thread messages',
        accessToken: 'token',
        channelId: 'channel1',
        threadTs: '1234567890.123'
      };

      const result = await slackAgent.execute(params, mockExecutionContext);
      
      expect(result.success).toBe(true);
      expect(result.result.operation).toBe('read_thread');
      expect(result.result.threads).toHaveLength(1);
      expect(result.result.threads[0].participantCount).toBe(1);
    });

    it('should require threadTs for read_thread operation', async () => {
      const params: SlackAgentRequest = {
        query: 'read thread messages',
        accessToken: 'token',
        channelId: 'channel1'
        // Missing threadTs
      };

      await expect(slackAgent.execute(params, mockExecutionContext))
        .rejects.toThrow('Thread timestamp is required for thread reading');
    });
  });

  describe('Draft Detection Operations', () => {
    it('should handle detect_drafts operation successfully', async () => {
      const mockDrafts: SlackDraft[] = [
        {
          id: 'draft1',
          channelId: 'channel1',
          content: 'Draft message content',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          isPendingConfirmation: true,
          confirmationId: 'confirm1'
        }
      ];

      mockSlackDomainService.detectDraftMessages.mockResolvedValue(mockDrafts);

      const params: SlackAgentRequest = {
        query: 'check for drafts',
        accessToken: 'token',
        channelId: 'channel1'
      };

      const result = await slackAgent.execute(params, mockExecutionContext);
      
      expect(result.success).toBe(true);
      expect(result.result.operation).toBe('detect_drafts');
      expect(result.result.drafts).toEqual(mockDrafts);
    });
  });

  describe('Confirmation Handling Operations', () => {
    it('should handle confirmation_handling operation successfully', async () => {
      mockSlackDomainService.checkConfirmationStatus.mockResolvedValue('pending');

      const params: SlackAgentRequest = {
        query: 'check confirmation status',
        accessToken: 'token',
        channelId: 'channel1',
        threadTs: '1234567890.123'
      };

      const result = await slackAgent.execute(params, mockExecutionContext);
      
      expect(result.success).toBe(true);
      expect(result.result.operation).toBe('confirmation_handling');
      expect(result.result.confirmationStatus).toBe('pending');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Slack service gracefully', async () => {
      (getService as jest.Mock).mockReturnValue(null);

      const params: SlackAgentRequest = {
        query: 'read messages',
        accessToken: 'token'
      };

      await expect(slackAgent.execute(params, mockExecutionContext))
        .rejects.toThrow('Slack service not available');
    });

    it('should handle service errors gracefully', async () => {
      mockSlackDomainService.readChannelMessages.mockRejectedValue(new Error('Slack API error'));

      const params: SlackAgentRequest = {
        query: 'read messages',
        accessToken: 'token'
      };

      await expect(slackAgent.execute(params, mockExecutionContext))
        .rejects.toThrow();
    });

    it('should create user-friendly error messages', () => {
      const error = new Error('Test error');
      (error as any).code = 'MISSING_ACCESS_TOKEN';

      const userMessage = (slackAgent as any).createUserFriendlyErrorMessage(error, {});
      expect(userMessage).toContain('I need access to your Slack workspace');
    });
  });

  describe('Static Utility Methods', () => {
    const mockMessages: SlackMessage[] = [
      {
        id: 'msg1',
        text: 'Message 1',
        userId: 'user1',
        channelId: 'channel1',
        timestamp: '1234567890.123',
        isBot: false
      },
      {
        id: 'msg2',
        text: 'Message 2',
        userId: 'user2',
        channelId: 'channel1',
        timestamp: '1234567891.123',
        isBot: false
      }
    ];

    it('should format messages for other agents', () => {
      const formatted = SlackAgent.formatMessagesForAgent(mockMessages);
      
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toEqual({
        id: 'msg1',
        text: 'Message 1',
        userId: 'user1',
        timestamp: '1234567890.123',
        threadTs: undefined
      });
    });

    it('should get most recent message', () => {
      const mostRecent = SlackAgent.getMostRecentMessage(mockMessages);
      expect(mostRecent?.id).toBe('msg2');
    });

    it('should check for active drafts', () => {
      const drafts: SlackDraft[] = [
        {
          id: 'draft1',
          channelId: 'channel1',
          content: 'Draft',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          isPendingConfirmation: true
        },
        {
          id: 'draft2',
          channelId: 'channel1',
          content: 'Another draft',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          isPendingConfirmation: false
        }
      ];

      expect(SlackAgent.hasActiveDrafts(drafts)).toBe(true);
    });

    it('should filter messages by user', () => {
      const userMessages = SlackAgent.filterMessagesByUser(mockMessages, 'user1');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].userId).toBe('user1');
    });

    it('should generate conversation summary', () => {
      const summary = SlackAgent.getConversationSummary(mockMessages);
      
      expect(summary.messageCount).toBe(2);
      expect(summary.participantCount).toBe(2);
      expect(summary.timeSpan).toBe('1 minutes');
      expect(summary.lastActivity).toBeDefined();
    });

    it('should handle empty message list in summary', () => {
      const summary = SlackAgent.getConversationSummary([]);
      
      expect(summary.messageCount).toBe(0);
      expect(summary.participantCount).toBe(0);
      expect(summary.timeSpan).toBe('0 minutes');
      expect(summary.lastActivity).toBe('');
    });
  });

  describe('Preview Generation', () => {
    it('should generate preview for read-only operations', async () => {
      const params: SlackAgentRequest = {
        query: 'read messages',
        accessToken: 'token'
      };

      const preview = await (slackAgent as any).generatePreview(params, mockExecutionContext);
      
      expect(preview.success).toBe(true);
      expect(preview.fallbackMessage).toContain('read-only');
    });
  });

  describe('Custom Tool Execution', () => {
    it('should execute Slack-specific tools', async () => {
      const result = await (slackAgent as any).executeCustomTool(
        'slack_operations',
        { query: 'test', accessToken: 'token' },
        mockExecutionContext
      );

      expect(result.success).toBe(true);
    });

    it('should handle unknown tools', async () => {
      const result = await (slackAgent as any).executeCustomTool(
        'unknown_tool',
        {},
        mockExecutionContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('Parameter Extraction', () => {
    it('should extract search parameters from natural language', () => {
      const query = 'read first 10 messages from #general';
      const params = (slackAgent as any).extractSearchParameters(query);
      
      expect(params.searchTerm).toContain('messages');
      expect(params.limit).toBe(10);
    });

    it('should handle channel mentions', () => {
      const query = 'read messages from <#C1234567890|general>';
      const params = (slackAgent as any).extractSearchParameters(query);
      
      expect(params.channelId).toBe('C1234567890');
    });

    it('should handle limit requests', () => {
      const query = 'show last 5 messages';
      const params = (slackAgent as any).extractSearchParameters(query);
      
      expect(params.limit).toBe(5);
    });
  });

  describe('Sanitization for Logging', () => {
    it('should sanitize sensitive data from logs', () => {
      const params: SlackAgentRequest = {
        query: 'This is a very long query that should be truncated for logging purposes to prevent excessive log data',
        accessToken: 'sensitive-token',
        channelId: 'channel123',
        limit: 20
      };

      const sanitized = (slackAgent as any).sanitizeForLogging(params);
      
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.query).toHaveLength(103); // 100 chars + '...'
      expect(sanitized.channelId).toBe('channel123');
      expect(sanitized.limit).toBe(20);
    });
  });
});
