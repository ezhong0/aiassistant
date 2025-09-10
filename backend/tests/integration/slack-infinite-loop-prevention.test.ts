import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SlackInterface } from '../../src/interfaces/slack.interface';
import { SlackInterfaceService } from '../../src/services/slack-interface.service';
import { ServiceManager } from '../../src/services/service-manager';
import { WebClient } from '@slack/web-api';
import logger from '../../src/utils/logger';

// Mock the WebClient
jest.mock('@slack/web-api');
const MockedWebClient = WebClient as jest.MockedClass<typeof WebClient>;

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Slack Infinite Loop Prevention Tests', () => {
  let mockWebClient: jest.Mocked<WebClient>;
  let slackInterface: SlackInterface;
  let slackInterfaceService: SlackInterfaceService;
  let serviceManager: ServiceManager;

  const mockSlackConfig = {
    signingSecret: 'test-signing-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://test.com/oauth/callback',
    development: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWebClient = {
      auth: {
        test: jest.fn().mockResolvedValue({
          team_id: 'T123456',
          user_id: 'U123456', // Bot user ID
          bot_id: 'B123456'
        })
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue({ ts: '1234567890.123456' })
      }
    } as any;

    MockedWebClient.mockImplementation(() => mockWebClient);

    serviceManager = new ServiceManager();
    slackInterface = new SlackInterface(mockSlackConfig, serviceManager);
    slackInterfaceService = new SlackInterfaceService(mockSlackConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Bot Message Filtering', () => {
    it('should skip messages with bot_id', async () => {
      const botEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im',
        bot_id: 'B123456' // Bot message indicator
      };

      const teamId = 'T123456';

      await slackInterface.handleEvent(botEvent, teamId);

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Bot message detected, skipping to prevent infinite loop',
        expect.objectContaining({
          botId: 'B123456'
        })
      );
    });

    it('should skip messages with bot_message subtype', async () => {
      const botEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im',
        subtype: 'bot_message' // Bot message subtype
      };

      const teamId = 'T123456';

      await slackInterface.handleEvent(botEvent, teamId);

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Bot message detected, skipping to prevent infinite loop',
        expect.objectContaining({
          subtype: 'bot_message'
        })
      );
    });

    it('should skip messages from bot user ID', async () => {
      const botUserEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456', // Same as bot user ID
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      await slackInterface.handleEvent(botUserEvent, teamId);

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Bot user ID cached',
        expect.objectContaining({
          botUserId: 'U123456'
        })
      );
    });

    it('should process messages from regular users', async () => {
      const userEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U789012', // Different from bot user ID
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      const routeToAgentSpy = jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(userEvent, teamId);

      // Should process the message
      expect(routeToAgentSpy).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D1234567890',
          text: 'Hello! How can I help you?'
        })
      );
    });
  });

  describe('SlackInterfaceService Bot Filtering', () => {
    it('should skip bot messages in SlackInterfaceService', async () => {
      await slackInterfaceService.initialize();

      const botEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im',
        bot_id: 'B123456'
      };

      const teamId = 'T123456';

      await slackInterfaceService.handleEvent(botEvent, teamId);

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should skip messages from bot user in SlackInterfaceService', async () => {
      await slackInterfaceService.initialize();

      const botUserEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456', // Same as bot user ID
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      await slackInterfaceService.handleEvent(botUserEvent, teamId);

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Bot User ID Caching', () => {
    it('should cache bot user ID on first call', async () => {
      const userEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U789012',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(userEvent, teamId);

      // Should call auth.test to get bot user ID
      expect(mockWebClient.auth.test).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'Bot user ID cached',
        expect.objectContaining({
          botUserId: 'U123456'
        })
      );
    });

    it('should use cached bot user ID on subsequent calls', async () => {
      const userEvent1 = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U789012',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const userEvent2 = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U789012',
        text: 'Another message',
        ts: '1234567890.123457',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      // Process first event
      await slackInterface.handleEvent(userEvent1, teamId);

      // Process second event
      await slackInterface.handleEvent(userEvent2, teamId);

      // Should only call auth.test once (for caching)
      expect(mockWebClient.auth.test).toHaveBeenCalledTimes(1);
    });

    it('should handle auth.test errors gracefully', async () => {
      mockWebClient.auth.test.mockRejectedValue(new Error('Auth failed'));

      const userEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U789012',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(userEvent, teamId);

      // Should still process the message despite auth error
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Could not verify bot user ID, continuing with processing',
        expect.any(Error)
      );
    });
  });

  describe('Infinite Loop Prevention Integration', () => {
    it('should prevent infinite loop with bot user message', async () => {
      const botUserEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456', // Bot user ID
        text: 'This is a bot message',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Process the bot message
      await slackInterface.handleEvent(botUserEvent, teamId);

      // Should not send any response
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();

      // Should log the bot user detection
      expect(logger.debug).toHaveBeenCalledWith(
        'Message from bot user detected (cached check), skipping to prevent infinite loop',
        expect.objectContaining({
          botUserId: 'U123456',
          eventUserId: 'U123456'
        })
      );
    });

    it('should prevent infinite loop with bot_id message', async () => {
      const botIdEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'This is a bot message',
        ts: '1234567890.123456',
        channel_type: 'im',
        bot_id: 'B123456'
      };

      const teamId = 'T123456';

      // Process the bot message
      await slackInterface.handleEvent(botIdEvent, teamId);

      // Should not send any response
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();

      // Should log the bot message detection
      expect(logger.debug).toHaveBeenCalledWith(
        'Bot message detected, skipping to prevent infinite loop',
        expect.objectContaining({
          botId: 'B123456'
        })
      );
    });

    it('should allow normal user messages to be processed', async () => {
      const userEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U789012', // Regular user
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      const routeToAgentSpy = jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(userEvent, teamId);

      // Should process the message normally
      expect(routeToAgentSpy).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D1234567890',
          text: 'Hello! How can I help you?'
        })
      );
    });
  });
});
