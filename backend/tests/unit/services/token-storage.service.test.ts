import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TokenStorageService } from '../../../src/services/token-storage.service';
import {
  createMockDatabaseService,
  createMockCacheService,
  createMockEncryptionService,
  createMockConfig,
} from '../../utils/mock-services';

describe('TokenStorageService', () => {
  let tokenStorageService: TokenStorageService;
  let mockDatabaseService: ReturnType<typeof createMockDatabaseService>;
  let mockCacheService: ReturnType<typeof createMockCacheService>;
  let mockEncryptionService: ReturnType<typeof createMockEncryptionService>;
  let mockConfig: Record<string, unknown>;

  const testUserId = 'test-user-123';
  const testGoogleTokens = {
    access_token: 'google-access-token',
    refresh_token: 'google-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
  };

  const testSlackTokens = {
    access_token: 'slack-access-token',
    refresh_token: 'slack-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'chat:write,channels:read',
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockDatabaseService = createMockDatabaseService();
    mockCacheService = createMockCacheService();
    mockEncryptionService = createMockEncryptionService();
    mockConfig = createMockConfig();

    // Create service instance with mocked dependencies
    tokenStorageService = new TokenStorageService(
      mockDatabaseService as any,
      mockCacheService as any,
      mockEncryptionService as any,
      mockConfig,
    );
  });

  afterEach(async () => {
    // Clean up service if it was initialized
    if (tokenStorageService.isReady()) {
      await tokenStorageService.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with all dependencies', async () => {
      await tokenStorageService.initialize();

      expect(tokenStorageService.isReady()).toBe(true);
    });

    it('should initialize successfully even when database is not available', async () => {
      mockDatabaseService.isReady.mockReturnValue(false);

      await tokenStorageService.initialize();

      // Should still be ready, using in-memory storage as fallback
      expect(tokenStorageService.isReady()).toBe(true);
    });

    it('should initialize successfully even when cache is not available', async () => {
      mockCacheService.isReady.mockReturnValue(false);

      await tokenStorageService.initialize();

      // Should still be ready, operating without cache
      expect(tokenStorageService.isReady()).toBe(true);
    });
  });

  describe('storeUserTokens', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should store Google tokens in database when database is available', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);

      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens,
      });

      expect(mockDatabaseService.storeUserTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          googleTokens: expect.objectContaining({
            access_token: testGoogleTokens.access_token,
          }),
        }),
      );
      expect(mockEncryptionService.encryptSensitiveData).toHaveBeenCalledWith(
        testGoogleTokens.refresh_token,
      );
    });

    it('should store Slack tokens in database when database is available', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);

      await tokenStorageService.storeUserTokens(testUserId, {
        slack: testSlackTokens,
      });

      expect(mockDatabaseService.storeUserTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          slackTokens: testSlackTokens,
        }),
      );
    });

    it('should store both Google and Slack tokens', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);

      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens,
        slack: testSlackTokens,
      });

      expect(mockDatabaseService.storeUserTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          googleTokens: expect.any(Object),
          slackTokens: testSlackTokens,
        }),
      );
    });

    it('should cache tokens after storing in database', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);
      mockCacheService.isReady.mockReturnValue(true);

      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens,
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `tokens:${testUserId}`,
        expect.objectContaining({
          userId: testUserId,
          googleTokens: expect.any(Object),
        }),
        expect.any(Number), // TTL
      );
    });

    it('should throw error for invalid userId', async () => {
      await expect(
        tokenStorageService.storeUserTokens('', { google: testGoogleTokens }),
      ).rejects.toThrow('Valid userId is required');
    });

    it('should throw error for Google tokens without access_token', async () => {
      const invalidGoogleTokens = { ...testGoogleTokens };
      delete (invalidGoogleTokens as any).access_token;

      await expect(
        tokenStorageService.storeUserTokens(testUserId, { google: invalidGoogleTokens }),
      ).rejects.toThrow('Cannot store Google tokens without access_token');
    });

    it('should fall back to in-memory storage when database is not available', async () => {
      mockDatabaseService.isReady.mockReturnValue(false);

      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens,
      });

      // Should not attempt to store in database
      expect(mockDatabaseService.storeUserTokens).not.toHaveBeenCalled();

      // Should retrieve from in-memory storage
      const tokens = await tokenStorageService.getUserTokens(testUserId);
      expect(tokens?.userId).toBe(testUserId);
      expect(tokens?.googleTokens?.access_token).toBe(testGoogleTokens.access_token);
    });

    it('should fall back to in-memory storage when database operation fails', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);
      mockDatabaseService.storeUserTokens.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(
        tokenStorageService.storeUserTokens(testUserId, { google: testGoogleTokens }),
      ).resolves.not.toThrow();

      // Should retrieve from in-memory fallback
      const tokens = await tokenStorageService.getUserTokens(testUserId);
      expect(tokens?.userId).toBe(testUserId);
    });
  });

  describe('getUserTokens', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should retrieve tokens from cache if available', async () => {
      const cachedTokens = {
        userId: testUserId,
        googleTokens: { access_token: testGoogleTokens.access_token },
        slackTokens: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCacheService.get.mockResolvedValue(cachedTokens);

      const tokens = await tokenStorageService.getUserTokens(testUserId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`tokens:${testUserId}`);
      expect(tokens).toEqual(cachedTokens);
      // Should not query database if cache hit
      expect(mockDatabaseService.getUserTokens).not.toHaveBeenCalled();
    });

    it('should retrieve tokens from database if cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.isReady.mockReturnValue(true);

      // Create a properly base64-encoded mock encrypted token (>42 bytes when decoded)
      const encryptedToken = Buffer.from('encrypted_google_refresh_token_that_is_long_enough_to_pass_validation').toString('base64');

      mockDatabaseService.getUserTokens.mockResolvedValue({
        userId: testUserId,
        googleTokens: {
          access_token: testGoogleTokens.access_token,
          refresh_token: encryptedToken,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const tokens = await tokenStorageService.getUserTokens(testUserId);

      expect(mockDatabaseService.getUserTokens).toHaveBeenCalledWith(testUserId);
      expect(tokens?.userId).toBe(testUserId);
      expect(tokens?.googleTokens?.access_token).toBe(testGoogleTokens.access_token);

      // Should decrypt the refresh token (since it passes isEncrypted check)
      expect(mockEncryptionService.decryptSensitiveData).toHaveBeenCalledWith(encryptedToken);

      // Should cache the result
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return null for non-existent user', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.isReady.mockReturnValue(true);
      mockDatabaseService.getUserTokens.mockResolvedValue(null);

      const tokens = await tokenStorageService.getUserTokens('non-existent-user');

      expect(tokens).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.isReady.mockReturnValue(true);
      mockDatabaseService.getUserTokens.mockRejectedValue(new Error('Database error'));

      const tokens = await tokenStorageService.getUserTokens(testUserId);

      // Should return null instead of throwing
      expect(tokens).toBeNull();
    });

    it('should use in-memory storage when database is not available', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.isReady.mockReturnValue(false);

      // First store some tokens
      await tokenStorageService.storeUserTokens(testUserId, {
        google: testGoogleTokens,
      });

      // Then retrieve them
      const tokens = await tokenStorageService.getUserTokens(testUserId);

      expect(tokens?.userId).toBe(testUserId);
      expect(tokens?.googleTokens?.access_token).toBe(testGoogleTokens.access_token);
      expect(mockDatabaseService.getUserTokens).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserTokens', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should delete tokens from all storage locations', async () => {
      mockDatabaseService.deleteUserTokens.mockResolvedValue(undefined);

      const result = await tokenStorageService.deleteUserTokens(testUserId);

      expect(result).toBe(true);
      expect(mockDatabaseService.deleteUserTokens).toHaveBeenCalledWith(testUserId);
      expect(mockCacheService.del).toHaveBeenCalledWith(`tokens:${testUserId}`);
    });

    it('should handle deletion of non-existent user gracefully', async () => {
      mockDatabaseService.deleteUserTokens.mockResolvedValue(undefined);

      const result = await tokenStorageService.deleteUserTokens('non-existent-user');

      expect(result).toBe(true);
    });

    it('should return false on deletion error', async () => {
      mockDatabaseService.deleteUserTokens.mockRejectedValue(new Error('Database error'));

      const result = await tokenStorageService.deleteUserTokens(testUserId);

      expect(result).toBe(false);
    });
  });

  describe('token validation', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should validate user ID format', async () => {
      const invalidUserIds = ['', '   '];

      for (const invalidId of invalidUserIds) {
        await expect(
          tokenStorageService.storeUserTokens(invalidId, { google: testGoogleTokens }),
        ).rejects.toThrow('Valid userId is required');
      }
    });

    it('should accept valid user ID formats', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);

      const validUserIds = [
        'user-123',
        'T123456_U123456',
        'google-oauth-user-456',
        'slack-workspace-user-789',
      ];

      for (const validId of validUserIds) {
        await expect(
          tokenStorageService.storeUserTokens(validId, { google: testGoogleTokens }),
        ).resolves.not.toThrow();
      }
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await tokenStorageService.initialize();
    });

    it('should throw error when service is not ready', async () => {
      await tokenStorageService.destroy();

      await expect(
        tokenStorageService.storeUserTokens(testUserId, { google: testGoogleTokens }),
      ).rejects.toThrow('TokenStorageService is not ready');
    });

    it('should handle concurrent operations gracefully', async () => {
      mockDatabaseService.isReady.mockReturnValue(true);

      const promises = Array.from({ length: 5 }, (_, i) =>
        tokenStorageService.storeUserTokens(`user-${i}`, { google: testGoogleTokens }),
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(mockDatabaseService.storeUserTokens).toHaveBeenCalledTimes(5);
    });
  });
});
