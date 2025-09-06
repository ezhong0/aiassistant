import { SlackInterfaceService } from '../../src/services/slack-interface.service';
import { TokenManager } from '../../src/services/token-manager';
import { ToolExecutorService } from '../../src/services/tool-executor.service';
import { SlackFormatterService } from '../../src/services/slack-formatter.service';
import { ServiceManager } from '../../src/services/service-manager';
import { SlackContext, SlackEventType } from '../../src/types/slack.types';
import { WebClient } from '@slack/web-api';

// Mock the service manager
jest.mock('../../src/services/service-manager', () => ({
  serviceManager: {
    getService: jest.fn()
  }
}));

// Mock WebClient
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    auth: {
      test: jest.fn().mockResolvedValue({
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      })
    },
    users: {
      info: jest.fn().mockResolvedValue({
        user: {
          name: 'testuser',
          profile: { email: 'test@example.com' }
        }
      })
    },
    chat: {
      postMessage: jest.fn().mockResolvedValue({ ts: '1234567890.123' })
    }
  }))
}));

// Mock agent factory
jest.mock('../../src/config/agent-factory-init', () => ({
  createMasterAgent: jest.fn().mockImplementation(() => ({
    processUserInput: jest.fn().mockResolvedValue({
      message: 'Test response',
      toolCalls: []
    })
  }))
}));

// Mock environment
jest.mock('../../src/config/environment', () => ({
  ENVIRONMENT: {
    baseUrl: 'https://test.example.com',
    google: {
      clientId: 'test-client-id',
      redirectUri: 'https://test.example.com/auth/callback'
    }
  }
}));

describe('SlackInterfaceService', () => {
  let slackService: SlackInterfaceService;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockToolExecutor: jest.Mocked<ToolExecutorService>;
  let mockSlackFormatter: jest.Mocked<SlackFormatterService>;
  let mockServiceManager: jest.Mocked<ServiceManager>;

  const mockSlackConfig = {
    signingSecret: 'test-signing-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://test.example.com/slack/oauth/callback',
    development: true
  };

  const mockSlackContext: SlackContext = {
    userId: 'U123456',
    channelId: 'C123456',
    teamId: 'T123456',
    threadTs: '1234567890.123',
    isDirectMessage: false,
    userName: 'testuser',
    userEmail: 'test@example.com'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock services
    mockTokenManager = {
      hasValidOAuthTokens: jest.fn().mockResolvedValue(true),
      getValidTokens: jest.fn().mockResolvedValue('mock-access-token'),
      isReady: jest.fn().mockReturnValue(true),
      name: 'tokenManager',
      state: 'ready',
      initialized: true,
      destroyed: false
    } as unknown as jest.Mocked<TokenManager>;

    mockToolExecutor = {
      executeTool: jest.fn().mockResolvedValue({
        toolName: 'testTool',
        success: true,
        result: 'Tool executed successfully',
        executionTime: 100
      }),
      isReady: jest.fn().mockReturnValue(true),
      name: 'toolExecutorService',
      state: 'ready',
      initialized: true,
      destroyed: false
    } as unknown as jest.Mocked<ToolExecutorService>;

    mockSlackFormatter = {
      formatAgentResponse: jest.fn().mockResolvedValue({
        text: 'Formatted response',
        blocks: []
      }),
      isReady: jest.fn().mockReturnValue(true),
      name: 'slackFormatterService',
      state: 'ready',
      initialized: true,
      destroyed: false
    } as unknown as jest.Mocked<SlackFormatterService>;

    // Setup service manager mock
    const mockServiceManagerInstance = {
      getService: jest.fn().mockImplementation((serviceName: string) => {
        switch (serviceName) {
          case 'tokenManager':
            return mockTokenManager;
          case 'toolExecutorService':
            return mockToolExecutor;
          case 'slackFormatterService':
            return mockSlackFormatter;
          default:
            return null;
        }
      })
    };

    (require('../../src/services/service-manager').serviceManager as any) = mockServiceManagerInstance;

    // Create service instance
    slackService = new SlackInterfaceService(mockSlackConfig);
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with valid configuration', async () => {
      await slackService.initialize();

      expect(slackService.isReady()).toBe(true);
      expect(slackService.state).toBe('ready');
    });

    it('should fail initialization with invalid configuration', async () => {
      const invalidConfig = { ...mockSlackConfig, signingSecret: '' };
      const invalidService = new SlackInterfaceService(invalidConfig);

      await expect(invalidService.initialize()).rejects.toThrow(
        'Missing required Slack configuration: signingSecret'
      );
    });

    it('should destroy successfully', async () => {
      await slackService.initialize();
      await slackService.destroy();

      expect(slackService.state).toBe(ServiceState.DESTROYED);
      expect(slackService.destroyed).toBe(true);
    });

    it('should inject dependencies correctly during initialization', async () => {
      await slackService.initialize();

      const health = slackService.getHealth();
      expect(health.details.dependencies).toEqual({
        tokenManager: true,
        toolExecutorService: true,
        slackFormatterService: true
      });
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await slackService.initialize();
    });

    it('should handle message events successfully', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'Hello, assistant!',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Verify WebClient was called to send response
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should handle app mention events successfully', async () => {
      const mockEvent = {
        type: 'app_mention',
        user: 'U123456',
        channel: 'C123456',
        text: '<@U123456> help me with email',
        ts: '1234567890.123'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Verify event was processed
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should deduplicate duplicate events', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'Hello, assistant!',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      // Process same event twice
      await slackService.handleEvent(mockEvent, 'T123456');
      await slackService.handleEvent(mockEvent, 'T123456');

      // Should only be called once due to deduplication
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalledTimes(1);
    });

    it('should skip unsupported event types', async () => {
      const mockEvent = {
        type: 'unsupported_event',
        user: 'U123456',
        channel: 'C123456',
        text: 'Hello, assistant!',
        ts: '1234567890.123'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Should not call postMessage for unsupported events
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should handle empty messages gracefully', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: '',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Should send empty message response
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('empty')
        })
      );
    });
  });

  describe('OAuth Integration', () => {
    beforeEach(async () => {
      await slackService.initialize();
    });

    it('should detect email-related requests without OAuth', async () => {
      mockTokenManager.hasValidOAuthTokens.mockResolvedValue(false);

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'send an email to john@example.com',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Should send OAuth required message
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({
                text: expect.stringContaining('Gmail Authentication Required')
              })
            })
          ])
        })
      );
    });

    it('should proceed with email requests when OAuth is available', async () => {
      mockTokenManager.hasValidOAuthTokens.mockResolvedValue(true);
      mockTokenManager.getValidTokens.mockResolvedValue('valid-access-token');

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'send an email to john@example.com',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Should proceed to agent processing, not send OAuth message
      expect(mockTokenManager.getValidTokens).toHaveBeenCalledWith('T123456', 'U123456');
    });
  });

  describe('Message Formatting', () => {
    beforeEach(async () => {
      await slackService.initialize();
    });

    it('should use SlackFormatterService when available', async () => {
      mockSlackFormatter.formatAgentResponse.mockResolvedValue({
        text: 'Formatted by service',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Formatted content' } }]
      });

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'test message',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      expect(mockSlackFormatter.formatAgentResponse).toHaveBeenCalled();
    });

    it('should use fallback formatting when service is unavailable', async () => {
      // Remove formatter service
      const mockServiceManagerInstance = {
        getService: jest.fn().mockImplementation((serviceName: string) => {
          switch (serviceName) {
            case 'tokenManager':
              return mockTokenManager;
            case 'toolExecutorService':
              return mockToolExecutor;
            case 'slackFormatterService':
              return null; // Service not available
            default:
              return null;
          }
        })
      };

      (require('../../src/services/service-manager').serviceManager as any) = mockServiceManagerInstance;

      const fallbackService = new SlackInterfaceService(mockSlackConfig);
      await fallbackService.initialize();

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'test message',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await fallbackService.handleEvent(mockEvent, 'T123456');

      // Should still send a response using fallback formatting
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[1];
      expect(mockClient.chat.postMessage).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await slackService.initialize();
    });

    it('should handle WebClient errors gracefully', async () => {
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      mockClient.chat.postMessage.mockRejectedValue(new Error('Slack API error'));

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'test message',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      // Should not throw despite WebClient error
      await expect(slackService.handleEvent(mockEvent, 'T123456')).resolves.not.toThrow();
    });

    it('should handle tool execution errors gracefully', async () => {
      mockToolExecutor.executeTool.mockRejectedValue(new Error('Tool execution failed'));

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'test message',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      // Should still send a response despite tool execution error
      await slackService.handleEvent(mockEvent, 'T123456');

      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should handle agent processing errors gracefully', async () => {
      // Mock agent factory to throw an error
      const mockCreateMasterAgent = require('../../src/config/agent-factory-init').createMasterAgent;
      mockCreateMasterAgent.mockImplementation(() => ({
        processUserInput: jest.fn().mockRejectedValue(new Error('Agent processing failed'))
      }));

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'test message',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Should send error response
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('error')
        })
      );
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when properly initialized', async () => {
      await slackService.initialize();

      const health = slackService.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.details).toEqual(
        expect.objectContaining({
          configured: true,
          development: true,
          hasClient: true,
          dependencies: {
            tokenManager: true,
            toolExecutorService: true,
            slackFormatterService: true
          }
        })
      );
    });

    it('should report unhealthy when not initialized', () => {
      const health = slackService.getHealth();
      expect(health.healthy).toBe(false);
    });

    it('should report configuration status', async () => {
      await slackService.initialize();

      const health = slackService.getHealth();
      expect(health.details.configured).toBe(true);
    });
  });

  describe('Context Extraction', () => {
    beforeEach(async () => {
      await slackService.initialize();
    });

    it('should extract user information when available', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'Hello!',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // Verify users.info was called to get additional context
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U123456' });
    });

    it('should handle missing user information gracefully', async () => {
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      mockClient.users.info.mockRejectedValue(new Error('User not found'));

      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'Hello!',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      // Should not throw despite users.info error
      await expect(slackService.handleEvent(mockEvent, 'T123456')).resolves.not.toThrow();
    });
  });

  describe('Message Cleaning', () => {
    beforeEach(async () => {
      await slackService.initialize();
    });

    it('should clean Slack mentions from messages', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: '<@U987654> hello there!',
        ts: '1234567890.123',
        channel_type: 'channel'
      };

      await slackService.handleEvent(mockEvent, 'T123456');

      // The cleaned message should be passed to agent processing
      // This is tested indirectly through successful processing
      const mockClient = (WebClient as jest.MockedClass<typeof WebClient>).mock.instances[0];
      expect(mockClient.chat.postMessage).toHaveBeenCalled();
    });
  });
});