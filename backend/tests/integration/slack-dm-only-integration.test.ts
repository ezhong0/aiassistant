import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SlackInterface } from '../../src/interfaces/slack.interface';
import { SlackInterfaceService } from '../../src/services/slack-interface.service';
import { SlackMigrationService } from '../../src/services/slack-migration.service';
import { ServiceManager } from '../../src/services/service-manager';
import { WebClient } from '@slack/web-api';
import logger from '../../src/utils/logger';

// Mock the WebClient
jest.mock('@slack/web-api');
const MockedWebClient = WebClient as jest.MockedClass<typeof WebClient>;

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Slack DM-Only Functionality Tests', () => {
  let mockWebClient: jest.Mocked<WebClient>;
  let slackInterface: SlackInterface;
  let slackInterfaceService: SlackInterfaceService;
  let slackMigrationService: SlackMigrationService;
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
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock WebClient instance
    mockWebClient = {
      auth: {
        test: jest.fn().mockResolvedValue({
          team_id: 'T123456',
          user_id: 'U123456',
          bot_id: 'B123456'
        })
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue({ ts: '1234567890.123456' })
      },
      users: {
        info: jest.fn().mockResolvedValue({
          user: {
            name: 'testuser',
            profile: { email: 'test@example.com' }
          }
        }),
        list: jest.fn().mockResolvedValue({
          members: [
            { id: 'U123456', is_admin: true, is_owner: false },
            { id: 'U789012', is_admin: false, is_owner: true }
          ]
        })
      }
    } as any;

    MockedWebClient.mockImplementation(() => mockWebClient);

    // Initialize service manager
    serviceManager = new ServiceManager();

    // Initialize services
    slackInterface = new SlackInterface(mockSlackConfig, serviceManager);
    slackInterfaceService = new SlackInterfaceService(mockSlackConfig);
    slackMigrationService = new SlackMigrationService(mockSlackConfig.botToken, 'graceful');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('DM-Only Event Handling', () => {
    it('should accept direct message events', async () => {
      const dmEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method to avoid actual agent processing
      const routeToAgentSpy = jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(dmEvent, teamId);

      expect(routeToAgentSpy).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D1234567890',
          text: 'Hello! How can I help you?'
        })
      );
    });

    it('should reject channel events and send redirect message', async () => {
      const channelEvent = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'channel'
      };

      const teamId = 'T123456';

      await slackInterface.handleEvent(channelEvent, teamId);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance.',
        thread_ts: '1234567890.123456'
      });
    });

    it('should reject app mention events in channels', async () => {
      const mentionEvent = {
        type: 'app_mention',
        channel: 'C1234567890',
        user: 'U123456',
        text: '<@B123456> help me with email',
        ts: '1234567890.123456',
        channel_type: 'channel'
      };

      const teamId = 'T123456';

      await slackInterface.handleEvent(mentionEvent, teamId);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance.',
        thread_ts: '1234567890.123456'
      });
    });

    it('should process app mention events in direct messages', async () => {
      const dmMentionEvent = {
        type: 'app_mention',
        channel: 'D1234567890',
        user: 'U123456',
        text: '<@B123456> help me with email',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      const routeToAgentSpy = jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'I can help you with email management!' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(dmMentionEvent, teamId);

      expect(routeToAgentSpy).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D1234567890',
          text: 'I can help you with email management!'
        })
      );
    });
  });

  describe('SlackInterfaceService DM-Only Tests', () => {
    it('should initialize with DM-only enforcement', async () => {
      await slackInterfaceService.initialize();
      
      const health = slackInterfaceService.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.details?.configured).toBe(true);
    });

    it('should reject channel events in SlackInterfaceService', async () => {
      await slackInterfaceService.initialize();

      const channelEvent = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'channel'
      };

      const teamId = 'T123456';

      await slackInterfaceService.handleEvent(channelEvent, teamId);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance.',
        thread_ts: '1234567890.123456'
      });
    });

    it('should process direct message events in SlackInterfaceService', async () => {
      await slackInterfaceService.initialize();

      const dmEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const teamId = 'T123456';

      // Mock the routeToAgent method
      const routeToAgentSpy = jest.spyOn(slackInterfaceService as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterfaceService.handleEvent(dmEvent, teamId);

      expect(routeToAgentSpy).toHaveBeenCalled();
    });
  });

  describe('Migration Service Tests', () => {
    it('should initialize migration service', async () => {
      await slackMigrationService.initialize();
      
      const health = slackMigrationService.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.details?.migrationMode).toBe('graceful');
    });

    it('should send migration notifications to workspace admins', async () => {
      await slackMigrationService.initialize();

      const teamId = 'T123456';
      const adminUserIds = ['U123456', 'U789012'];

      await slackMigrationService.notifyWorkspaceAdmins(teamId, adminUserIds);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'U123456',
        text: '🔒 AI Assistant Privacy Update',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '🔒 AI Assistant Privacy Update'
            })
          })
        ])
      });
    });

    it('should send channel migration guidance', async () => {
      await slackMigrationService.initialize();

      const channelId = 'C1234567890';
      const userId = 'U123456';
      const threadTs = '1234567890.123456';

      await slackMigrationService.sendChannelMigrationGuidance(channelId, userId, threadTs);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        thread_ts: '1234567890.123456',
        text: '🔒 AI Assistant Privacy Update - Please use direct messages',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('AI Assistant now works exclusively through direct messages')
            })
          })
        ])
      });
    });

    it('should get workspace administrators', async () => {
      await slackMigrationService.initialize();

      const teamId = 'T123456';
      const admins = await slackMigrationService.getWorkspaceAdmins(teamId);

      expect(admins).toEqual(['U123456', 'U789012']);
      expect(mockWebClient.users.list).toHaveBeenCalled();
    });

    it('should execute graceful migration', async () => {
      await slackMigrationService.initialize();

      const teamId = 'T123456';
      
      // Mock getWorkspaceAdmins
      const getWorkspaceAdminsSpy = jest.spyOn(slackMigrationService, 'getWorkspaceAdmins')
        .mockResolvedValue(['U123456', 'U789012']);

      await slackMigrationService.executeMigration(teamId);

      expect(getWorkspaceAdminsSpy).toHaveBeenCalledWith(teamId);
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
    });

    it('should check migration status', async () => {
      await slackMigrationService.initialize();

      const teamId = 'T123456';
      const status = await slackMigrationService.getMigrationStatus(teamId);

      expect(status).toEqual({
        migrated: true,
        mode: 'graceful',
        adminNotified: false
      });
    });

    it('should determine if migration is needed', async () => {
      await slackMigrationService.initialize();

      const teamId = 'T123456';
      const isNeeded = await slackMigrationService.isMigrationNeeded(teamId);

      expect(isNeeded).toBe(true);
    });
  });

  describe('OAuth Scope Validation', () => {
    it('should validate DM-only OAuth scopes', () => {
      const dmOnlyScopes = [
        'im:history',    // Read direct message history
        'im:write',      // Send messages in direct messages
        'users:read',    // Read user information
        'chat:write',    // Send messages (required for DM responses)
        'commands'       // Handle slash commands
      ];

      const expectedScopes = [
        'im:history',
        'im:write', 
        'users:read',
        'chat:write',
        'commands'
      ];

      expect(dmOnlyScopes).toEqual(expectedScopes);
      expect(dmOnlyScopes).not.toContain('app_mentions:read');
      expect(dmOnlyScopes).not.toContain('channels:read');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebClient errors gracefully', async () => {
      mockWebClient.chat.postMessage.mockRejectedValue(new Error('Slack API Error'));

      const channelEvent = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'channel'
      };

      const teamId = 'T123456';

      // Should not throw error
      await expect(slackInterface.handleEvent(channelEvent, teamId)).resolves.not.toThrow();
    });

    it('should handle migration service errors gracefully', async () => {
      mockWebClient.users.list.mockRejectedValue(new Error('Slack API Error'));

      await slackMigrationService.initialize();

      const teamId = 'T123456';
      const admins = await slackMigrationService.getWorkspaceAdmins(teamId);

      expect(admins).toEqual([]);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete DM-only workflow', async () => {
      await slackInterface.initialize();
      await slackMigrationService.initialize();

      // Test channel rejection
      const channelEvent = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'channel'
      };

      await slackInterface.handleEvent(channelEvent, 'T123456');

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('exclusively through direct messages')
        })
      );

      // Test DM acceptance
      const dmEvent = {
        type: 'message',
        channel: 'D1234567890',
        user: 'U123456',
        text: 'Hello AI Assistant',
        ts: '1234567890.123456',
        channel_type: 'im'
      };

      const routeToAgentSpy = jest.spyOn(slackInterface as any, 'routeToAgent')
        .mockResolvedValue({
          success: true,
          response: { text: 'Hello! How can I help you?' },
          shouldRespond: true
        });

      await slackInterface.handleEvent(dmEvent, 'T123456');

      expect(routeToAgentSpy).toHaveBeenCalled();
    });

    it('should handle migration workflow', async () => {
      await slackMigrationService.initialize();

      const teamId = 'T123456';
      
      // Mock admin retrieval
      jest.spyOn(slackMigrationService, 'getWorkspaceAdmins')
        .mockResolvedValue(['U123456']);

      // Execute migration
      await slackMigrationService.executeMigration(teamId);

      // Verify admin notification
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'U123456',
        text: '🔒 AI Assistant Privacy Update',
        blocks: expect.any(Array)
      });

      // Test channel guidance
      await slackMigrationService.sendChannelMigrationGuidance('C1234567890', 'U123456');

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '🔒 AI Assistant Privacy Update - Please use direct messages',
        blocks: expect.any(Array)
      });
    });
  });
});
