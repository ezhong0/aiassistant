import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TokenStorageService } from '../../../src/services/token-storage.service';
import { DatabaseService } from '../../../src/services/database.service';
import { CacheService } from '../../../src/services/cache.service';
import { EncryptionService } from '../../../src/services/encryption.service';
import { serviceManager } from '../../../src/services/service-manager';

// Mock dependencies
jest.mock('../../../src/services/database.service');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/services/encryption.service');
jest.mock('../../../src/services/service-manager', () => ({
  serviceManager: {
    getService: jest.fn()
  }
}));

describe('TokenStorageService', () => {
  let tokenStorageService: TokenStorageService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;

  const testUserId = 'test-user-123';
  const testGoogleTokens = {
    access_token: 'google-access-token',
    refresh_token: 'google-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly'
  };

  const testSlackTokens = {
    access_token: 'slack-access-token',
    refresh_token: 'slack-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'chat:write,channels:read'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances with proper Jest mock structure
    mockDatabaseService = {
      isReady: jest.fn().mockReturnValue(true),
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      getHealth: jest.fn().mockReturnValue({ healthy: true })
    } as any;

    mockCacheService = {
      isReady: jest.fn().mockReturnValue(true),
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      getHealth: jest.fn().mockReturnValue({ healthy: true })
    } as any;

    mockEncryptionService = {
      encryptSensitiveData: jest.fn().mockReturnValue('encrypted-refresh-token'),
      decryptSensitiveData: jest.fn().mockReturnValue('google-refresh-token'),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      getHealth: jest.fn().mockReturnValue({ healthy: true })
    } as any;

    // Mock service manager to return our mocks
    (serviceManager.getService as jest.Mock).mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'databaseService':
          return mockDatabaseService;
        case 'cacheService':
          return mockCacheService;
        case 'encryptionService':
          return mockEncryptionService;
        default:
          return null;
      }
    });

    // Create service instance
    tokenStorageService = new TokenStorageService();
  });

  afterEach(async () => {
    if (tokenStorageService.isReady()) {
      await tokenStorageService.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await tokenStorageService.initialize();
      
      expect(tokenStorageService.isReady()).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      mockDatabaseService.isReady.mockReturnValue(false);
      
      await tokenStorageService.initialize();
      
      // Should still be ready even if database is not available
      expect(tokenStorageService.isReady()).toBe(true);
    });
  });

  describe('storeUserTokens', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should store Google tokens successfully', async () => {
      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO oauth_tokens'),
        expect.arrayContaining([testUserId, testGoogleTokens.access_token])
      );
    });

    it('should store Slack tokens successfully', async () => {
      await tokenStorageService.storeUserTokens(testUserId, {
        slack: testSlackTokens
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO oauth_tokens'),
        expect.arrayContaining([testUserId, testSlackTokens.access_token])
      );
    });

    it('should store both Google and Slack tokens', async () => {
      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens,
        slack: testSlackTokens
      });

      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error for invalid userId', async () => {
      await expect(
        tokenStorageService.storeUserTokens('', { google: testGoogleTokens })
      ).rejects.toThrow('Valid userId is required');
    });

    it('should throw error for Google tokens without access_token', async () => {
      const invalidGoogleTokens = { ...testGoogleTokens };
      delete invalidGoogleTokens.access_token;

      await expect(
        tokenStorageService.storeUserTokens(testUserId, { google: invalidGoogleTokens })
      ).rejects.toThrow('Cannot store Google tokens without access_token');
    });

    it('should handle database errors gracefully', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Database connection failed'));

      // Should not throw, but log the error
      await expect(
        tokenStorageService.storeUserTokens(testUserId, { google: testGoogleTokens })
      ).resolves.not.toThrow();
    });
  });

  describe('getUserTokens', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should retrieve user tokens from database', async () => {
      const mockDbResult = {
        rows: [{
          session_id: testUserId,
          access_token: testGoogleTokens.access_token,
          refresh_token: 'encrypted-refresh-token',
          expires_at: new Date(Date.now() + 3600000),
          token_type: 'Bearer',
          scope: testGoogleTokens.scope
        }],
        rowCount: 1
      };

      mockDatabaseService.query.mockResolvedValue(mockDbResult);

      const tokens = await tokenStorageService.getUserTokens(testUserId);

      expect(tokens).toBeDefined();
      expect(tokens?.google?.access_token).toBe(testGoogleTokens.access_token);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [testUserId]
      );
    });

    it('should return null for non-existent user', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const tokens = await tokenStorageService.getUserTokens('non-existent-user');

      expect(tokens).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Database error'));

      const tokens = await tokenStorageService.getUserTokens(testUserId);

      expect(tokens).toBeNull();
    });
  });

  describe('deleteUserTokens', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should delete user tokens successfully', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await tokenStorageService.deleteUserTokens(testUserId);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM oauth_tokens'),
        [testUserId]
      );
    });

    it('should handle deletion of non-existent user gracefully', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(
        tokenStorageService.deleteUserTokens('non-existent-user')
      ).resolves.not.toThrow();
    });
  });

  describe('token validation', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should validate user ID format', async () => {
      const invalidUserIds = ['', '   ', null, undefined];

      for (const invalidId of invalidUserIds) {
        await expect(
          tokenStorageService.storeUserTokens(invalidId as any, { google: testGoogleTokens })
        ).rejects.toThrow('Valid userId is required');
      }
    });

    it('should accept valid user ID formats', async () => {
      const validUserIds = [
        'user-123',
        'T123456_U123456',
        'google-oauth-user-456',
        'slack-workspace-user-789'
      ];

      for (const validId of validUserIds) {
        await expect(
          tokenStorageService.storeUserTokens(validId, { google: testGoogleTokens })
        ).resolves.not.toThrow();
      }
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should handle service not ready state', async () => {
      await tokenStorageService.destroy();

      await expect(
        tokenStorageService.storeUserTokens(testUserId, { google: testGoogleTokens })
      ).rejects.toThrow('TokenStorageService is not ready');
    });

    it('should handle concurrent operations gracefully', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        tokenStorageService.storeUserTokens(`user-${i}`, { google: testGoogleTokens })
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});
