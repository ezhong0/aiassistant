import { SlackMessageReaderService } from '../../src/services/slack-message-reader.service';
import { SlackMessageReaderError, SlackMessageReaderErrorCode } from '../../src/types/slack-message-reader.types';
import { WebClient } from '@slack/web-api';
import { serviceManager } from '../../src/services/service-manager';
import { CacheService } from '../../src/services/cache.service';
import { DatabaseService } from '../../src/services/database.service';

// Mock dependencies
jest.mock('@slack/web-api');
jest.mock('../../src/services/service-manager');
jest.mock('../../src/services/cache.service');
jest.mock('../../src/services/database.service');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('SlackMessageReaderService', () => {
  let service: SlackMessageReaderService;
  let mockWebClient: jest.Mocked<WebClient>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  const mockBotToken = 'xoxb-test-token';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock WebClient
    mockWebClient = {
      auth: {
        test: jest.fn()
      },
      conversations: {
        history: jest.fn(),
        replies: jest.fn(),
        info: jest.fn()
      },
      search: {
        messages: jest.fn()
      }
    } as any;

    (WebClient as jest.MockedClass<typeof WebClient>).mockImplementation(() => mockWebClient);

    // Mock service manager
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn()
    } as any;

    mockDatabaseService = {} as any;

    (serviceManager.getService as jest.Mock).mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'cacheService':
          return mockCacheService;
        case 'databaseService':
          return mockDatabaseService;
        default:
          return null;
      }
    });

    // Create service instance
    service = new SlackMessageReaderService(mockBotToken);
  });

  afterEach(async () => {
    if (service && !service.destroyed) {
      await service.destroy();
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with valid configuration', async () => {
      // Mock successful auth test
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });

      await service.initialize();

      expect(service.isReady()).toBe(true);
      expect(service.initialized).toBe(true);
      expect(mockWebClient.auth.test).toHaveBeenCalled();
    });

    it('should fail initialization with invalid bot token', async () => {
      const invalidService = new SlackMessageReaderService('');
      
      await expect(invalidService.initialize()).rejects.toThrow('Bot token is required');
    });

    it('should handle Slack connection failure', async () => {
      mockWebClient.auth.test.mockRejectedValue(new Error('Invalid token'));

      await expect(service.initialize()).rejects.toThrow(SlackMessageReaderError);
    });

    it('should destroy service properly', async () => {
      await service.initialize();
      await service.destroy();

      expect(service.destroyed).toBe(true);
    });
  });

  describe('Message History Reading', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should read message history successfully', async () => {
      const mockMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Hello world',
          type: 'message'
        },
        {
          ts: '1234567891.123456',
          channel: 'C123456',
          user: 'U789012',
          text: 'Reply message',
          type: 'message'
        }
      ];

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages
      });

      const result = await service.readMessageHistory('C123456');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1234567890.123456');
      expect(result[0].text).toBe('Hello world');
      expect(result[0].channelId).toBe('C123456');
      expect(mockWebClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C123456',
        limit: 100,
        oldest: undefined,
        latest: undefined,
        inclusive: false
      });
    });

    it('should apply message filtering correctly', async () => {
      const mockMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Hello world',
          type: 'message'
        },
        {
          ts: '1234567891.123456',
          channel: 'C123456',
          user: 'U789012',
          text: 'Bot message',
          type: 'message',
          bot_id: 'B123456'
        },
        {
          ts: '1234567892.123456',
          channel: 'C123456',
          user: 'U789012',
          text: 'System message',
          type: 'message',
          subtype: 'bot_message'
        }
      ];

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages
      });

      const result = await service.readMessageHistory('C123456', {
        filter: {
          excludeBotMessages: true,
          excludeSystemMessages: true
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Hello world');
    });

    it('should handle empty message history', async () => {
      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: []
      });

      const result = await service.readMessageHistory('C123456');

      expect(result).toHaveLength(0);
    });

    it('should handle channel not found error', async () => {
      mockWebClient.conversations.history.mockRejectedValue({
        error: 'channel_not_found'
      });

      await expect(service.readMessageHistory('C123456')).rejects.toThrow(SlackMessageReaderError);
    });
  });

  describe('Thread Message Reading', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should read thread messages successfully', async () => {
      const mockThreadMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Original message',
          type: 'message'
        },
        {
          ts: '1234567891.123456',
          channel: 'C123456',
          user: 'U789012',
          text: 'Thread reply',
          type: 'message',
          thread_ts: '1234567890.123456'
        }
      ];

      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: mockThreadMessages
      });

      const result = await service.readThreadMessages('C123456', '1234567890.123456');

      expect(result).toHaveLength(2);
      expect(result[1].isThreadReply).toBe(true);
      expect(result[1].threadTs).toBe('1234567890.123456');
    });

    it('should handle empty thread', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: []
      });

      const result = await service.readThreadMessages('C123456', '1234567890.123456');

      expect(result).toHaveLength(0);
    });
  });

  describe('Message Search', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should search messages successfully', async () => {
      const mockSearchResults = {
        messages: {
          matches: [
            {
              ts: '1234567890.123456',
              channel: 'C123456',
              user: 'U123456',
              text: 'Search result message',
              type: 'message'
            }
          ]
        }
      };

      mockWebClient.search.messages.mockResolvedValue(mockSearchResults);

      const result = await service.searchMessages('test query');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Search result message');
      expect(mockWebClient.search.messages).toHaveBeenCalledWith({
        query: 'test query',
        count: 20,
        sort: 'score',
        sort_dir: 'desc'
      });
    });

    it('should filter search results by channels', async () => {
      const mockSearchResults = {
        messages: {
          matches: [
            {
              ts: '1234567890.123456',
              channel: 'C123456',
              user: 'U123456',
              text: 'Message in channel 1',
              type: 'message'
            },
            {
              ts: '1234567891.123456',
              channel: 'C789012',
              user: 'U123456',
              text: 'Message in channel 2',
              type: 'message'
            }
          ]
        }
      };

      mockWebClient.search.messages.mockResolvedValue(mockSearchResults);

      const result = await service.searchMessages('test query', {
        channels: ['C123456']
      });

      expect(result).toHaveLength(1);
      expect(result[0].channelId).toBe('C123456');
    });
  });

  describe('Channel Information', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should get channel information successfully', async () => {
      const mockChannelInfo = {
        id: 'C123456',
        name: 'test-channel',
        is_private: false,
        is_im: false,
        num_members: 5,
        topic: { value: 'Channel topic' },
        purpose: { value: 'Channel purpose' }
      };

      mockWebClient.conversations.info.mockResolvedValue({
        ok: true,
        channel: mockChannelInfo
      });

      const result = await service.getChannelInfo('C123456');

      expect(result.id).toBe('C123456');
      expect(result.name).toBe('test-channel');
      expect(result.type).toBe('public');
      expect(result.isPrivate).toBe(false);
      expect(result.memberCount).toBe(5);
    });

    it('should handle channel not found', async () => {
      mockWebClient.conversations.info.mockRejectedValue({
        error: 'channel_not_found'
      });

      await expect(service.getChannelInfo('C123456')).rejects.toThrow(SlackMessageReaderError);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should enforce rate limits', async () => {
      // Mock successful response
      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: []
      });

      // Make requests up to the limit
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(service.readMessageHistory('C123456'));
      }

      await Promise.all(promises);

      // The 51st request should be rate limited
      await expect(service.readMessageHistory('C123456')).rejects.toThrow(SlackMessageReaderError);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should use cached messages when available', async () => {
      const cachedMessages = [
        {
          id: '1234567890.123456',
          channelId: 'C123456',
          userId: 'U123456',
          text: 'Cached message',
          timestamp: new Date(),
          isThreadReply: false,
          attachments: [],
          files: [],
          reactions: [],
          metadata: { type: 'message' }
        }
      ];

      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedMessages));

      const result = await service.readMessageHistory('C123456');

      expect(result).toEqual(cachedMessages);
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockWebClient.conversations.history).not.toHaveBeenCalled();
    });

    it('should cache messages after fetching', async () => {
      const mockMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Hello world',
          type: 'message'
        }
      ];

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages
      });

      await service.readMessageHistory('C123456');

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('Sensitive Content Handling', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should redact sensitive content', async () => {
      const mockMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'My email is test@example.com and my password is secret123',
          type: 'message'
        }
      ];

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages
      });

      const result = await service.readMessageHistory('C123456');

      expect(result[0].text).toContain('[REDACTED-EMAIL]');
      expect(result[0].text).toContain('[REDACTED]');
    });

    it('should exclude messages with sensitive content when configured', async () => {
      const mockMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'My email is test@example.com',
          type: 'message'
        },
        {
          ts: '1234567891.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Regular message',
          type: 'message'
        }
      ];

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages
      });

      const result = await service.readMessageHistory('C123456', {
        filter: {
          excludeSensitiveContent: true
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Regular message');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should handle authentication errors', async () => {
      mockWebClient.conversations.history.mockRejectedValue({
        error: 'not_authed'
      });

      await expect(service.readMessageHistory('C123456')).rejects.toThrow(SlackMessageReaderError);
    });

    it('should handle permission errors', async () => {
      mockWebClient.conversations.history.mockRejectedValue({
        error: 'permission_denied'
      });

      await expect(service.readMessageHistory('C123456')).rejects.toThrow(SlackMessageReaderError);
    });

    it('should handle rate limit errors', async () => {
      mockWebClient.conversations.history.mockRejectedValue({
        error: 'rate_limited'
      });

      await expect(service.readMessageHistory('C123456')).rejects.toThrow(SlackMessageReaderError);
    });
  });

  describe('Health Status', () => {
    it('should report healthy status when properly initialized', async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });

      await service.initialize();

      const health = service.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details?.configured).toBe(true);
      expect(health.details?.hasClient).toBe(true);
    });

    it('should report unhealthy status when not initialized', () => {
      const health = service.getHealth();

      expect(health.healthy).toBe(false);
    });
  });

  describe('Recent Messages', () => {
    beforeEach(async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123456',
        user_id: 'U123456',
        bot_id: 'B123456'
      });
      await service.initialize();
    });

    it('should read recent messages with specified count', async () => {
      const mockMessages = [
        {
          ts: '1234567890.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Message 1',
          type: 'message'
        },
        {
          ts: '1234567891.123456',
          channel: 'C123456',
          user: 'U123456',
          text: 'Message 2',
          type: 'message'
        }
      ];

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages
      });

      const result = await service.readRecentMessages('C123456', 2);

      expect(result).toHaveLength(2);
      expect(mockWebClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C123456',
        limit: 2,
        oldest: undefined,
        latest: undefined,
        inclusive: false
      });
    });

    it('should respect maximum message limit', async () => {
      const result = await service.readRecentMessages('C123456', 200);

      expect(mockWebClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C123456',
        limit: 100, // Should be capped at maxMessagesPerRequest
        oldest: undefined,
        latest: undefined,
        inclusive: false
      });
    });
  });
});
