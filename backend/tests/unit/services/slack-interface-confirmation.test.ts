import { SlackInterfaceService } from '../../../src/services/slack-interface.service';
import { ToolExecutorService } from '../../../src/services/tool-executor.service';
import { ResponseFormatterService } from '../../../src/services/response-formatter.service';
import { serviceManager } from '../../../src/services/service-manager';
import { 
  SlackContext, 
  SlackAgentRequest,
  SlackResponse 
} from '../../../src/types/slack.types';
import { 
  ConfirmationFlow, 
  ConfirmationStatus 
} from '../../../src/types/confirmation.types';
import logger from '../../../src/utils/logger';

/**
 * Unit Tests for SlackInterfaceService Confirmation Workflow
 * 
 * Tests the SlackInterfaceService confirmation-specific methods following
 * docs/TESTING.md unit testing patterns.
 */
describe('SlackInterfaceService Confirmation Workflow', () => {
  let slackInterface: SlackInterfaceService;
  let mockToolExecutorService: jest.Mocked<ToolExecutorService>;
  let mockResponseFormatterService: jest.Mocked<ResponseFormatterService>;

  // Mock Slack configuration
  const mockSlackConfig = {
    signingSecret: 'test-signing-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    development: true
  };

  beforeEach(async () => {
    // Create mock services
    mockToolExecutorService = createMockToolExecutorService();
    mockResponseFormatterService = createMockResponseFormatterService();

    // Mock service manager
    jest.spyOn(serviceManager, 'getService').mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'toolExecutorService':
          return mockToolExecutorService;
        case 'responseFormatterService':
          return mockResponseFormatterService;
        case 'tokenManager':
          return createMockTokenManager();
        default:
          return null;
      }
    });

    // Create service instance
    slackInterface = new SlackInterfaceService(mockSlackConfig);
    await slackInterface.initialize();
  });

  afterEach(async () => {
    if (slackInterface) {
      await slackInterface.destroy();
    }
    jest.clearAllMocks();
  });

  describe('formatConfirmationResponse', () => {
    it('should use ResponseFormatterService when available', async () => {
      // Arrange
      const mockConfirmationFlow: ConfirmationFlow = createMockConfirmationFlow();
      const mockMasterResponse = {
        message: 'I will send an email to John.',
        toolResults: [],
        confirmationFlows: [mockConfirmationFlow]
      };
      const mockSlackContext: SlackContext = createMockSlackContext();

      const expectedFormattedMessage = {
        text: 'Action Preview: Send Email to John',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '📧 **Action Preview**\\n*Send Email to John*' }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Yes, proceed' },
                action_id: `confirm_${mockConfirmationFlow.confirmationId}`,
                style: 'primary'
              }
            ]
          }
        ]
      };

      mockResponseFormatterService.formatConfirmationMessage.mockReturnValue(expectedFormattedMessage);

      // Act
      const result = await (slackInterface as any).formatConfirmationResponse(
        [mockConfirmationFlow],
        mockMasterResponse,
        mockSlackContext
      );

      // Assert
      expect(mockResponseFormatterService.formatConfirmationMessage).toHaveBeenCalledWith(
        mockConfirmationFlow,
        expect.objectContaining({
          includeRiskAssessment: true,
          includeExecutionTime: true,
          showDetailedPreview: true,
          useCompactFormat: false
        })
      );
      expect(result).toEqual(expectedFormattedMessage);
    });

    it('should use fallback formatting when ResponseFormatterService is not available', async () => {
      // Arrange
      const mockConfirmationFlow: ConfirmationFlow = createMockConfirmationFlow();
      const mockMasterResponse = {
        message: 'I will send an email to John.',
        confirmationFlows: [mockConfirmationFlow]
      };
      const mockSlackContext: SlackContext = createMockSlackContext();

      // Mock service as unavailable
      mockResponseFormatterService.formatConfirmationMessage = undefined as any;

      // Act
      const result = await (slackInterface as any).formatConfirmationResponse(
        [mockConfirmationFlow],
        mockMasterResponse,
        mockSlackContext
      );

      // Assert
      expect(result.text).toContain('📧 Action Preview: Send Email to John');
      expect(result.blocks).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(2);

      // Check for action buttons
      const actionBlock = result.blocks.find((block: any) => block.type === 'actions');
      expect(actionBlock).toBeDefined();
      expect(actionBlock.elements).toHaveLength(2);
      expect(actionBlock.elements[0].action_id).toBe(`confirm_${mockConfirmationFlow.confirmationId}`);
      expect(actionBlock.elements[1].action_id).toBe(`reject_${mockConfirmationFlow.confirmationId}`);
    });

    it('should handle multiple confirmation flows', async () => {
      // Arrange
      const mockConfirmationFlow1 = createMockConfirmationFlow('conf1', 'Send Email');
      const mockConfirmationFlow2 = createMockConfirmationFlow('conf2', 'Schedule Meeting');
      const mockMasterResponse = {
        message: 'I will handle multiple actions.',
        confirmationFlows: [mockConfirmationFlow1, mockConfirmationFlow2]
      };
      const mockSlackContext: SlackContext = createMockSlackContext();

      // Act - Should handle first confirmation (current implementation handles single)
      const result = await (slackInterface as any).formatConfirmationResponse(
        [mockConfirmationFlow1, mockConfirmationFlow2],
        mockMasterResponse,
        mockSlackContext
      );

      // Assert - Currently handles only first confirmation
      expect(mockResponseFormatterService.formatConfirmationMessage).toHaveBeenCalledWith(
        mockConfirmationFlow1,
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });
  });

  describe('createFallbackConfirmationResponse', () => {
    it('should create properly formatted fallback confirmation message', () => {
      // Arrange
      const mockConfirmationFlow: ConfirmationFlow = createMockConfirmationFlow();
      const mockMasterResponse = { message: 'Test message' };

      // Act
      const result = (slackInterface as any).createFallbackConfirmationResponse(
        mockConfirmationFlow,
        mockMasterResponse
      );

      // Assert
      expect(result.text).toBe('📧 Action Preview: Send Email to John');
      expect(result.blocks).toHaveLength(4); // Header, risk, prompt, actions
      
      // Check header block
      const headerBlock = result.blocks[0];
      expect(headerBlock.type).toBe('section');
      expect(headerBlock.text.text).toContain('📧 **Action Preview**');
      expect(headerBlock.text.text).toContain('*Send Email to John*');

      // Check risk assessment block
      const riskBlock = result.blocks[1];
      expect(riskBlock.type).toBe('section');
      expect(riskBlock.text.text).toContain('**Risk Level: MEDIUM**');

      // Check confirmation prompt block
      const promptBlock = result.blocks[2];
      expect(promptBlock.type).toBe('section');
      expect(promptBlock.text.text).toContain('*Do you want to proceed with this action?*');

      // Check action buttons block
      const actionBlock = result.blocks[3];
      expect(actionBlock.type).toBe('actions');
      expect(actionBlock.elements).toHaveLength(2);
      
      const confirmButton = actionBlock.elements[0];
      expect(confirmButton.text.text).toBe('Yes, proceed');
      expect(confirmButton.style).toBe('primary');
      expect(confirmButton.action_id).toBe(`confirm_${mockConfirmationFlow.confirmationId}`);
      
      const rejectButton = actionBlock.elements[1];
      expect(rejectButton.text.text).toBe('No, cancel');
      expect(rejectButton.style).toBe('danger');
      expect(rejectButton.action_id).toBe(`reject_${mockConfirmationFlow.confirmationId}`);
    });
  });

  describe('getActionIcon', () => {
    it('should return correct icons for different action types', () => {
      // Test all supported action types
      const testCases = [
        { actionType: 'email', expected: '📧' },
        { actionType: 'calendar', expected: '📅' },
        { actionType: 'contact', expected: '👤' },
        { actionType: 'content', expected: '📝' },
        { actionType: 'search', expected: '🔍' },
        { actionType: 'unknown', expected: '⚙️' },
        { actionType: '', expected: '⚙️' }
      ];

      testCases.forEach(({ actionType, expected }) => {
        const result = (slackInterface as any).getActionIcon(actionType);
        expect(result).toBe(expected);
      });
    });
  });

  describe('formatAgentResponse', () => {
    it('should route to confirmation formatting when confirmation flows exist', async () => {
      // Arrange
      const mockConfirmationFlow = createMockConfirmationFlow();
      const mockMasterResponse = {
        message: 'I will send an email.',
        toolResults: [],
        confirmationFlows: [mockConfirmationFlow]
      };
      const mockSlackContext = createMockSlackContext();

      const expectedConfirmationResponse = {
        text: 'Confirmation required',
        blocks: []
      };

      // Mock the formatConfirmationResponse method
      jest.spyOn(slackInterface as any, 'formatConfirmationResponse')
        .mockResolvedValue(expectedConfirmationResponse);

      // Act
      const result = await (slackInterface as any).formatAgentResponse(
        mockMasterResponse,
        mockSlackContext
      );

      // Assert
      expect((slackInterface as any).formatConfirmationResponse).toHaveBeenCalledWith(
        [mockConfirmationFlow],
        mockMasterResponse,
        mockSlackContext
      );
      expect(result).toEqual(expectedConfirmationResponse);
    });

    it('should use fallback formatting when no confirmation flows exist', async () => {
      // Arrange
      const mockMasterResponse = {
        message: 'Task completed successfully.',
        toolResults: [
          {
            toolName: 'emailAgent',
            success: true,
            result: { messageId: 'msg123' },
            executionTime: 1500
          }
        ]
      };
      const mockSlackContext = createMockSlackContext();

      // Act
      const result = await (slackInterface as any).formatAgentResponse(
        mockMasterResponse,
        mockSlackContext
      );

      // Assert
      expect(result.text).toBe('Task completed successfully.');
      // Should not call confirmation formatting
      expect(mockResponseFormatterService.formatConfirmationMessage).not.toHaveBeenCalled();
    });

    it('should handle formatting errors gracefully', async () => {
      // Arrange
      const mockConfirmationFlow = createMockConfirmationFlow();
      const mockMasterResponse = {
        message: 'Test message',
        confirmationFlows: [mockConfirmationFlow]
      };
      const mockSlackContext = createMockSlackContext();

      // Mock formatConfirmationResponse to throw an error
      jest.spyOn(slackInterface as any, 'formatConfirmationResponse')
        .mockRejectedValue(new Error('Formatting failed'));

      // Act
      const result = await (slackInterface as any).formatAgentResponse(
        mockMasterResponse,
        mockSlackContext
      );

      // Assert
      expect(result.text).toBe('Test message');
    });
  });

  describe('Service Health Reporting', () => {
    it('should include confirmation service dependencies in health check', () => {
      // Act
      const health = slackInterface.getHealth();

      // Assert
      expect(health.healthy).toBe(true);
      expect(health.details.dependencies).toBeDefined();
      expect(health.details.dependencies.toolExecutorService).toBe(true);
      expect(health.details.dependencies.responseFormatterService).toBe(true);
      expect(health.details.dependencies.confirmationService).toBe(false); // Not mocked
    });
  });

  // Helper functions to create mock objects
  function createMockConfirmationFlow(
    id: string = 'test-confirmation-123',
    title: string = 'Send Email to John'
  ): ConfirmationFlow {
    return {
      confirmationId: id,
      sessionId: 'test-session-123',
      userId: 'test-user-123',
      actionPreview: {
        actionId: 'test-action-id',
        actionType: 'email',
        title,
        description: 'Send an email to john@example.com about the meeting',
        riskAssessment: {
          level: 'medium',
          factors: ['External recipient'],
          warnings: ['Please review before sending']
        },
        estimatedExecutionTime: '2-3 seconds',
        reversible: false,
        requiresConfirmation: true,
        awaitingConfirmation: true,
        previewData: {
          operation: 'emailAgent',
          to: 'john@example.com',
          subject: 'Meeting'
        },
        originalQuery: 'Send email to john@example.com about meeting',
        parameters: {}
      },
      originalToolCall: {
        name: 'emailAgent',
        parameters: { query: 'Send email' }
      },
      status: ConfirmationStatus.PENDING,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      slackContext: {
        userId: 'test-user-123',
        channelId: 'test-channel',
        teamId: 'test-team',
        isDirectMessage: false
      }
    };
  }

  function createMockSlackContext(): SlackContext {
    return {
      userId: 'test-user-123',
      channelId: 'test-channel-456',
      teamId: 'test-team-789',
      isDirectMessage: false,
      userName: 'testuser',
      userEmail: 'testuser@example.com'
    };
  }

  function createMockToolExecutorService(): jest.Mocked<ToolExecutorService> {
    return {
      executeWithConfirmation: jest.fn(),
      respondToConfirmation: jest.fn(),
      executeConfirmedAction: jest.fn(),
      executeTool: jest.fn(),
      executeTools: jest.fn(),
      getPendingConfirmations: jest.fn(),
      isValidConfirmation: jest.fn(),
      getExecutionStats: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      name: 'toolExecutorService',
      state: 'ready' as any,
      initialize: jest.fn(),
      destroy: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      getHealth: jest.fn().mockReturnValue({ healthy: true }),
      assertReady: jest.fn(),
      handleError: jest.fn(),
      logInfo: jest.fn(),
      logDebug: jest.fn(),
      logWarn: jest.fn(),
      logError: jest.fn()
    } as any;
  }

  function createMockResponseFormatterService(): jest.Mocked<ResponseFormatterService> {
    return {
      formatConfirmationMessage: jest.fn(),
      formatCompletionMessage: jest.fn(),
      formatCancellationMessage: jest.fn(),
      formatSimpleConfirmationMessage: jest.fn(),
      name: 'responseFormatterService',
      state: 'ready' as any,
      initialize: jest.fn(),
      destroy: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      getHealth: jest.fn().mockReturnValue({ healthy: true }),
      assertReady: jest.fn(),
      handleError: jest.fn(),
      logInfo: jest.fn(),
      logDebug: jest.fn(),
      logWarn: jest.fn(),
      logError: jest.fn()
    } as any;
  }

  function createMockTokenManager(): any {
    return {
      hasValidOAuthTokens: jest.fn().mockResolvedValue(true),
      getValidTokens: jest.fn().mockResolvedValue('mock-access-token'),
      name: 'tokenManager',
      state: 'ready',
      isReady: jest.fn().mockReturnValue(true)
    };
  }
});