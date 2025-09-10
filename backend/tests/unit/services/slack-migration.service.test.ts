import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SlackMigrationService } from '../../src/services/slack-migration.service';
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

describe('SlackMigrationService Unit Tests', () => {
  let mockWebClient: jest.Mocked<WebClient>;
  let migrationService: SlackMigrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
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
        list: jest.fn().mockResolvedValue({
          members: [
            { id: 'U123456', is_admin: true, is_owner: false },
            { id: 'U789012', is_admin: false, is_owner: true },
            { id: 'U345678', is_admin: false, is_owner: false }
          ]
        })
      }
    } as any;

    MockedWebClient.mockImplementation(() => mockWebClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize with graceful migration mode by default', () => {
      migrationService = new SlackMigrationService('test-token');
      
      expect(migrationService).toBeDefined();
      expect(migrationService.getHealth().details?.migrationMode).toBe('graceful');
    });

    it('should initialize with specified migration mode', () => {
      migrationService = new SlackMigrationService('test-token', 'immediate');
      
      expect(migrationService).toBeDefined();
      expect(migrationService.getHealth().details?.migrationMode).toBe('immediate');
    });

    it('should initialize with disabled migration mode', () => {
      migrationService = new SlackMigrationService('test-token', 'disabled');
      
      expect(migrationService).toBeDefined();
      expect(migrationService.getHealth().details?.migrationMode).toBe('disabled');
    });

    it('should initialize successfully', async () => {
      migrationService = new SlackMigrationService('test-token');
      
      await migrationService.initialize();
      
      const health = migrationService.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.details?.hasClient).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockWebClient.auth.test.mockRejectedValue(new Error('Auth failed'));
      
      migrationService = new SlackMigrationService('test-token');
      
      await expect(migrationService.initialize()).rejects.toThrow('Slack client authentication failed');
    });
  });

  describe('Admin Notification', () => {
    beforeEach(async () => {
      migrationService = new SlackMigrationService('test-token');
      await migrationService.initialize();
    });

    it('should send migration notification to single admin', async () => {
      const teamId = 'T123456';
      const adminUserIds = ['U123456'];

      await migrationService.notifyWorkspaceAdmins(teamId, adminUserIds);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'U123456',
        text: '🔒 AI Assistant Privacy Update',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '🔒 AI Assistant Privacy Update'
            })
          }),
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('exclusively through direct messages')
            })
          })
        ])
      });
    });

    it('should send migration notification to multiple admins', async () => {
      const teamId = 'T123456';
      const adminUserIds = ['U123456', 'U789012'];

      await migrationService.notifyWorkspaceAdmins(teamId, adminUserIds);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'U123456',
        text: '🔒 AI Assistant Privacy Update',
        blocks: expect.any(Array)
      });
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'U789012',
        text: '🔒 AI Assistant Privacy Update',
        blocks: expect.any(Array)
      });
    });

    it('should handle admin notification errors gracefully', async () => {
      mockWebClient.chat.postMessage.mockRejectedValue(new Error('Message failed'));
      
      const teamId = 'T123456';
      const adminUserIds = ['U123456'];

      await migrationService.notifyWorkspaceAdmins(teamId, adminUserIds);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send migration notification to admin',
        expect.any(Error),
        expect.objectContaining({ adminUserId: 'U123456', teamId })
      );
    });

    it('should handle empty admin list', async () => {
      const teamId = 'T123456';
      const adminUserIds: string[] = [];

      await migrationService.notifyWorkspaceAdmins(teamId, adminUserIds);

      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Channel Migration Guidance', () => {
    beforeEach(async () => {
      migrationService = new SlackMigrationService('test-token');
      await migrationService.initialize();
    });

    it('should send channel migration guidance', async () => {
      const channelId = 'C1234567890';
      const userId = 'U123456';
      const threadTs = '1234567890.123456';

      await migrationService.sendChannelMigrationGuidance(channelId, userId, threadTs);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        thread_ts: '1234567890.123456',
        text: '🔒 AI Assistant Privacy Update - Please use direct messages',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('exclusively through direct messages')
            })
          }),
          expect.objectContaining({
            type: 'actions',
            elements: expect.arrayContaining([
              expect.objectContaining({
                type: 'button',
                text: expect.objectContaining({
                  text: '💬 Start Direct Message'
                }),
                action_id: 'start_dm'
              })
            ])
          })
        ])
      });
    });

    it('should send channel migration guidance without thread timestamp', async () => {
      const channelId = 'C1234567890';
      const userId = 'U123456';

      await migrationService.sendChannelMigrationGuidance(channelId, userId);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '🔒 AI Assistant Privacy Update - Please use direct messages',
        blocks: expect.any(Array)
      });
    });

    it('should handle channel guidance errors gracefully', async () => {
      mockWebClient.chat.postMessage.mockRejectedValue(new Error('Message failed'));
      
      const channelId = 'C1234567890';
      const userId = 'U123456';

      await migrationService.sendChannelMigrationGuidance(channelId, userId);

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending channel migration guidance',
        expect.any(Error),
        expect.objectContaining({ channelId, userId })
      );
    });
  });

  describe('Workspace Admin Retrieval', () => {
    beforeEach(async () => {
      migrationService = new SlackMigrationService('test-token');
      await migrationService.initialize();
    });

    it('should retrieve workspace administrators', async () => {
      const teamId = 'T123456';
      
      const admins = await migrationService.getWorkspaceAdmins(teamId);

      expect(admins).toEqual(['U123456', 'U789012']);
      expect(mockWebClient.users.list).toHaveBeenCalled();
    });

    it('should handle empty member list', async () => {
      mockWebClient.users.list.mockResolvedValue({ members: [] });
      
      const teamId = 'T123456';
      const admins = await migrationService.getWorkspaceAdmins(teamId);

      expect(admins).toEqual([]);
    });

    it('should handle users list API errors', async () => {
      mockWebClient.users.list.mockRejectedValue(new Error('API Error'));
      
      const teamId = 'T123456';
      const admins = await migrationService.getWorkspaceAdmins(teamId);

      expect(admins).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Error retrieving workspace admins',
        expect.any(Error),
        expect.objectContaining({ teamId })
      );
    });

    it('should filter only admin and owner users', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          { id: 'U111111', is_admin: true, is_owner: false },
          { id: 'U222222', is_admin: false, is_owner: true },
          { id: 'U333333', is_admin: false, is_owner: false },
          { id: 'U444444', is_admin: true, is_owner: true }
        ]
      });
      
      const teamId = 'T123456';
      const admins = await migrationService.getWorkspaceAdmins(teamId);

      expect(admins).toEqual(['U111111', 'U222222', 'U444444']);
    });
  });

  describe('Migration Execution', () => {
    beforeEach(async () => {
      migrationService = new SlackMigrationService('test-token', 'graceful');
      await migrationService.initialize();
    });

    it('should execute graceful migration', async () => {
      const teamId = 'T123456';
      
      const getWorkspaceAdminsSpy = jest.spyOn(migrationService, 'getWorkspaceAdmins')
        .mockResolvedValue(['U123456', 'U789012']);

      await migrationService.executeMigration(teamId);

      expect(getWorkspaceAdminsSpy).toHaveBeenCalledWith(teamId);
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
    });

    it('should execute immediate migration', async () => {
      migrationService = new SlackMigrationService('test-token', 'immediate');
      await migrationService.initialize();

      const teamId = 'T123456';
      
      await migrationService.executeMigration(teamId);

      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should skip disabled migration', async () => {
      migrationService = new SlackMigrationService('test-token', 'disabled');
      await migrationService.initialize();

      const teamId = 'T123456';
      
      await migrationService.executeMigration(teamId);

      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should handle migration execution errors', async () => {
      const teamId = 'T123456';
      
      jest.spyOn(migrationService, 'getWorkspaceAdmins')
        .mockRejectedValue(new Error('Admin retrieval failed'));

      await expect(migrationService.executeMigration(teamId)).rejects.toThrow('Admin retrieval failed');
    });
  });

  describe('Migration Status', () => {
    beforeEach(async () => {
      migrationService = new SlackMigrationService('test-token', 'graceful');
      await migrationService.initialize();
    });

    it('should return migration status', async () => {
      const teamId = 'T123456';
      const status = await migrationService.getMigrationStatus(teamId);

      expect(status).toEqual({
        migrated: true,
        mode: 'graceful',
        adminNotified: false
      });
    });

    it('should check if migration is needed', async () => {
      const teamId = 'T123456';
      const isNeeded = await migrationService.isMigrationNeeded(teamId);

      expect(isNeeded).toBe(true);
    });

    it('should handle status check errors', async () => {
      const teamId = 'T123456';
      
      // Mock an error in status checking
      jest.spyOn(migrationService as any, 'getMigrationStatus')
        .mockRejectedValue(new Error('Status check failed'));

      const status = await migrationService.getMigrationStatus(teamId);

      expect(status).toEqual({
        migrated: false,
        mode: 'graceful',
        adminNotified: false
      });
    });
  });

  describe('Service Health', () => {
    it('should return healthy status when properly initialized', async () => {
      migrationService = new SlackMigrationService('test-token');
      await migrationService.initialize();

      const health = migrationService.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toEqual({
        healthy: true,
        migrationMode: 'graceful',
        hasClient: true
      });
    });

    it('should return unhealthy status when not initialized', () => {
      migrationService = new SlackMigrationService('test-token');

      const health = migrationService.getHealth();

      expect(health.healthy).toBe(false);
    });

    it('should return unhealthy status when WebClient fails', async () => {
      mockWebClient.auth.test.mockRejectedValue(new Error('Auth failed'));
      
      migrationService = new SlackMigrationService('test-token');
      
      try {
        await migrationService.initialize();
      } catch (error) {
        // Expected to fail
      }

      const health = migrationService.getHealth();

      expect(health.healthy).toBe(false);
    });
  });

  describe('Service Lifecycle', () => {
    it('should handle service destruction', async () => {
      migrationService = new SlackMigrationService('test-token');
      await migrationService.initialize();

      await migrationService.destroy();

      const health = migrationService.getHealth();
      expect(health.healthy).toBe(false);
    });

    it('should handle destruction errors gracefully', async () => {
      migrationService = new SlackMigrationService('test-token');
      await migrationService.initialize();

      // Mock an error during destruction
      jest.spyOn(migrationService as any, 'onDestroy')
        .mockRejectedValue(new Error('Destruction failed'));

      await migrationService.destroy();

      expect(logger.error).toHaveBeenCalledWith(
        'Error during Slack migration service destruction',
        expect.any(Error)
      );
    });
  });
});
