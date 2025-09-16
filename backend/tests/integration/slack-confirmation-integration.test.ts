/**
 * Integration tests for Slack-based confirmation system
 * Tests the enhanced SlackInterface with confirmation detection and proposal parsing
 */

import { SlackInterfaceService } from '../../src/services/slack-interface.service';
// import { SlackMessageReaderService } from '../../src/services/slack-message-reader.service';
import { ToolExecutorService } from '../../src/services/tool-executor.service';
import { TokenManager } from '../../src/services/token-manager';
import { serviceManager } from '../../src/services/service-manager';
import { SlackContext } from '../../src/types/slack.types';

describe('Slack Confirmation Integration', () => {
  let slackInterface: SlackInterfaceService;
  let mockSlackMessageReader: jest.Mocked<any>; // SlackMessageReaderService>;
  let mockToolExecutor: jest.Mocked<ToolExecutorService>;
  let mockTokenManager: jest.Mocked<TokenManager>;

  const mockSlackConfig = {
    signingSecret: 'test-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    development: true
  };

  beforeEach(async () => {
    // Mock services
    mockSlackMessageReader = {
      readRecentMessages: jest.fn(),
      readMessageHistory: jest.fn(),
      readThreadMessages: jest.fn(),
      searchMessages: jest.fn(),
      getChannelInfo: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
      getHealth: jest.fn().mockReturnValue({ healthy: true }),
      name: 'SlackMessageReaderService',
      state: 'ready' as any
    } as any;

    mockToolExecutor = {
      executeTool: jest.fn(),
      executeTools: jest.fn(),
      getExecutionStats: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
      getHealth: jest.fn().mockReturnValue({ healthy: true }),
      name: 'ToolExecutorService',
      state: 'ready' as any
    } as any;

    mockTokenManager = {
      hasValidOAuthTokens: jest.fn(),
      getValidTokens: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
      getHealth: jest.fn().mockReturnValue({ healthy: true }),
      name: 'TokenManager',
      state: 'ready' as any
    } as any;

    // Register mock services
    serviceManager.registerService('slackMessageReaderService', mockSlackMessageReader);
    serviceManager.registerService('toolExecutorService', mockToolExecutor);
    serviceManager.registerService('tokenManager', mockTokenManager);

    // Create SlackInterface
    slackInterface = new SlackInterfaceService(mockSlackConfig);
    await slackInterface.initialize();
  });

  afterEach(async () => {
    await slackInterface.destroy();
    serviceManager.forceCleanup();
    jest.clearAllMocks();
  });

  describe('Confirmation Detection', () => {
    it('should detect positive confirmation responses', async () => {
      const testCases = [
        'yes',
        'y',
        'yeah',
        'sure',
        'ok',
        'okay',
        'go ahead',
        'send it',
        'do it',
        'execute',
        'confirm',
        'approved',
        'yes, send it',
        'yes, go ahead'
      ];

      for (const response of testCases) {
        const event = {
          type: 'message',
          text: response,
          user: 'U123456',
          channel: 'D123456',
          channel_type: 'im',
          ts: '1234567890.123456'
        };

        const context: SlackContext = {
          userId: 'U123456',
          channelId: 'D123456',
          teamId: 'T123456',
          isDirectMessage: true
        };

        // Mock the confirmation response handling
        const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
        handleConfirmationResponseSpy.mockResolvedValue(undefined);

        await slackInterface.handleEvent(event, 'T123456');

        expect(handleConfirmationResponseSpy).toHaveBeenCalledWith(response, context);
      }
    });

    it('should detect negative confirmation responses', async () => {
      const testCases = [
        'no',
        'n',
        'nope',
        'cancel',
        'stop',
        'abort',
        'reject',
        'denied',
        'no, don\'t',
        'no, do not'
      ];

      for (const response of testCases) {
        const event = {
          type: 'message',
          text: response,
          user: 'U123456',
          channel: 'D123456',
          channel_type: 'im',
          ts: '1234567890.123456'
        };

        const context: SlackContext = {
          userId: 'U123456',
          channelId: 'D123456',
          teamId: 'T123456',
          isDirectMessage: true
        };

        // Mock the confirmation response handling
        const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
        handleConfirmationResponseSpy.mockResolvedValue(undefined);

        await slackInterface.handleEvent(event, 'T123456');

        expect(handleConfirmationResponseSpy).toHaveBeenCalledWith(response, context);
      }
    });

    it('should not detect non-confirmation messages', async () => {
      const testCases = [
        'hello',
        'how are you',
        'what can you do',
        'help me with something',
        'send an email to john@example.com',
        'schedule a meeting'
      ];

      for (const response of testCases) {
        const event = {
          type: 'message',
          text: response,
          user: 'U123456',
          channel: 'D123456',
          channel_type: 'im',
          ts: '1234567890.123456'
        };

        // Mock the confirmation response handling
        const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
        handleConfirmationResponseSpy.mockResolvedValue(undefined);

        await slackInterface.handleEvent(event, 'T123456');

        expect(handleConfirmationResponseSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('Proposal Parsing', () => {
    it('should find recent proposals in message history', async () => {
      const mockMessages = [
        {
          id: '1234567890.123456',
          channelId: 'D123456',
          userId: 'B123456', // Bot user
          text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder" and body "Don\'t forget about our meeting tomorrow."',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: 'B123456',
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        },
        {
          id: '1234567890.123457',
          channelId: 'D123456',
          userId: 'U123456', // User
          text: 'yes',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: undefined,
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        }
      ];

      mockSlackMessageReader.readRecentMessages.mockResolvedValue(mockMessages);

      const findRecentProposalSpy = jest.spyOn(slackInterface as any, 'findRecentProposal');
      const proposal = findRecentProposalSpy(mockMessages, 'U123456');

      expect(proposal).toBeTruthy();
      expect(proposal.text).toContain('send an email');
    });

    it('should parse email proposals correctly', async () => {
      const proposalText = 'I\'ll send an email to john@example.com with subject "Meeting Reminder" and body "Don\'t forget about our meeting tomorrow."';
      
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const actionDetails = parseProposalActionSpy(proposalText);

      expect(actionDetails).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'Meeting Reminder',
        body: 'Don\'t forget about our meeting tomorrow.'
      });
    });

    it('should parse calendar proposals correctly', async () => {
      const proposalText = 'I\'ll schedule a meeting "Project Review" at 2:00 PM tomorrow';
      
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const actionDetails = parseProposalActionSpy(proposalText);

      expect(actionDetails).toEqual({
        actionType: 'calendar',
        action: 'create',
        title: 'Project Review',
        time: '2:00 PM tomorrow'
      });
    });

    it('should parse contact proposals correctly', async () => {
      const proposalText = 'I\'ll add contact "John Doe" with email john@example.com';
      
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const actionDetails = parseProposalActionSpy(proposalText);

      expect(actionDetails).toEqual({
        actionType: 'contact',
        action: 'create',
        name: 'John Doe',
        email: 'john@example.com'
      });
    });
  });

  describe('Action Execution', () => {
    it('should execute confirmed email actions', async () => {
      const mockProposal = {
        id: '1234567890.123456',
        text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder" and body "Don\'t forget about our meeting tomorrow."',
        timestamp: new Date('2023-01-01T10:00:00Z')
      };

      const mockToolResult = {
        toolName: 'email_agent',
        success: true,
        result: 'Email sent successfully',
        error: undefined,
        executionTime: 150
      };

      mockToolExecutor.executeTool.mockResolvedValue(mockToolResult);

      const executeProposalActionSpy = jest.spyOn(slackInterface as any, 'executeProposalAction');
      const result = await executeProposalActionSpy(mockProposal, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result.success).toBe(true);
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'email_agent',
          parameters: expect.objectContaining({
            action: 'send',
            recipient: 'john@example.com',
            subject: 'Meeting Reminder',
            body: 'Don\'t forget about our meeting tomorrow.'
          })
        }),
        expect.any(Object),
        undefined
      );
    });

    it('should handle execution failures gracefully', async () => {
      const mockProposal = {
        id: '1234567890.123456',
        text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder"',
        timestamp: new Date('2023-01-01T10:00:00Z')
      };

      const mockToolResult = {
        toolName: 'email_agent',
        success: false,
        result: null,
        error: 'OAuth authentication required',
        executionTime: 50
      };

      mockToolExecutor.executeTool.mockResolvedValue(mockToolResult);

      const executeProposalActionSpy = jest.spyOn(slackInterface as any, 'executeProposalAction');
      const result = await executeProposalActionSpy(mockProposal, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth authentication required');
    });
  });

  describe('End-to-End Confirmation Flow', () => {
    it('should handle complete confirmation flow from proposal to execution', async () => {
      // Mock recent messages with a proposal
      const mockMessages = [
        {
          id: '1234567890.123456',
          channelId: 'D123456',
          userId: 'B123456', // Bot user
          text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder" and body "Don\'t forget about our meeting tomorrow."',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: 'B123456',
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        },
        {
          id: '1234567890.123457',
          channelId: 'D123456',
          userId: 'U123456', // User
          text: 'yes',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: undefined,
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        }
      ];

      mockSlackMessageReader.readRecentMessages.mockResolvedValue(mockMessages);

      const mockToolResult = {
        toolName: 'email_agent',
        success: true,
        result: 'Email sent successfully',
        error: undefined,
        executionTime: 150
      };

      mockToolExecutor.executeTool.mockResolvedValue(mockToolResult);

      // Mock the sendMessage method
      const sendMessageSpy = jest.spyOn(slackInterface as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      // Handle the confirmation response
      const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
      await handleConfirmationResponseSpy('yes', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(mockSlackMessageReader.readRecentMessages).toHaveBeenCalledWith(
        'D123456',
        20,
        { filter: { excludeBotMessages: false } }
      );

      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'email_agent',
          parameters: expect.objectContaining({
            action: 'send',
            recipient: 'john@example.com'
          })
        }),
        expect.any(Object),
        undefined
      );

      expect(sendMessageSpy).toHaveBeenCalledWith('D123456', {
        text: '✅ Action completed successfully!',
        thread_ts: undefined
      });
    });

    it('should handle cancellation responses', async () => {
      // Mock recent messages with a proposal
      const mockMessages = [
        {
          id: '1234567890.123456',
          channelId: 'D123456',
          userId: 'B123456', // Bot user
          text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder"',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: 'B123456',
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        },
        {
          id: '1234567890.123457',
          channelId: 'D123456',
          userId: 'U123456', // User
          text: 'no',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: undefined,
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        }
      ];

      mockSlackMessageReader.readRecentMessages.mockResolvedValue(mockMessages);

      // Mock the sendMessage method
      const sendMessageSpy = jest.spyOn(slackInterface as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      // Handle the cancellation response
      const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
      await handleConfirmationResponseSpy('no', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(mockToolExecutor.executeTool).not.toHaveBeenCalled();
      expect(sendMessageSpy).toHaveBeenCalledWith('D123456', {
        text: '❌ Action cancelled as requested.',
        thread_ts: undefined
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing SlackMessageReaderService gracefully', async () => {
      // Remove the mock service
      serviceManager.unregisterService('slackMessageReaderService');
      
      // Reinitialize SlackInterface without SlackMessageReaderService
      await slackInterface.destroy();
      slackInterface = new SlackInterfaceService(mockSlackConfig);
      await slackInterface.initialize();

      // Mock the sendMessage method
      const sendMessageSpy = jest.spyOn(slackInterface as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      // Handle confirmation response without SlackMessageReaderService
      const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
      await handleConfirmationResponseSpy('yes', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(sendMessageSpy).toHaveBeenCalledWith('D123456', {
        text: "I detected a confirmation response, but I can't process it without access to recent messages. Please try again.",
        thread_ts: undefined
      });
    });

    it('should handle missing proposals gracefully', async () => {
      // Mock empty message history
      mockSlackMessageReader.readRecentMessages.mockResolvedValue([]);

      // Mock the sendMessage method
      const sendMessageSpy = jest.spyOn(slackInterface as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      // Handle confirmation response with no proposals
      const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
      await handleConfirmationResponseSpy('yes', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(sendMessageSpy).toHaveBeenCalledWith('D123456', {
        text: "I couldn't find a recent proposal to confirm. Please make a request first, then confirm it.",
        thread_ts: undefined
      });
    });

    it('should handle proposal parsing failures gracefully', async () => {
      const mockMessages = [
        {
          id: '1234567890.123456',
          channelId: 'D123456',
          userId: 'B123456', // Bot user
          text: 'I\'ll do something unclear and ambiguous',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          subtype: undefined,
          botId: 'B123456',
          attachments: [],
          files: [],
          reactions: [],
          edited: undefined,
          metadata: {}
        }
      ];

      mockSlackMessageReader.readRecentMessages.mockResolvedValue(mockMessages);

      // Mock the sendMessage method
      const sendMessageSpy = jest.spyOn(slackInterface as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      // Handle confirmation response with unparseable proposal
      const handleConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'handleConfirmationResponse');
      await handleConfirmationResponseSpy('yes', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(sendMessageSpy).toHaveBeenCalledWith('D123456', {
        text: '❌ Action failed: Could not parse action from proposal',
        thread_ts: undefined
      });
    });
  });
});
