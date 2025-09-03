import { TokenManager, OAuthTokens } from '../../../src/services/token-manager';
import { SlackSessionManager } from '../../../src/services/slack-session-manager';
import { AuthService } from '../../../src/services/auth.service';
import { CacheService } from '../../../src/services/cache.service';
import { ServiceManager } from '../../../src/services/service-manager';

// Mock dependencies
jest.mock('../../../src/services/slack-session-manager');
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/services/service-manager');

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let mockSessionManager: jest.Mocked<SlackSessionManager>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockServiceManager: jest.Mocked<ServiceManager>;

  const testTokens: OAuthTokens = {
    google: {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'email profile',
      expiry_date: Date.now() + 3600000 // 1 hour from now
    },
    slack: {
      access_token: 'slack-token',
      team_id: 'team123',
      user_id: 'user123'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked instances
    mockSessionManager = new SlackSessionManager({} as any) as jest.Mocked<SlackSessionManager>;
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    mockServiceManager = ServiceManager.prototype as jest.Mocked<ServiceManager>;

    // Mock ServiceManager.getService to return our mocked cache service
    mockServiceManager.getService = jest.fn().mockImplementation((serviceName: string) => {
      if (serviceName === 'cacheService') {
        return mockCacheService;
      }
      return null;
    });

    // Mock cache service methods
    mockCacheService.get = jest.fn();
    mockCacheService.set = jest.fn().mockResolvedValue(true);
    mockCacheService.del = jest.fn().mockResolvedValue(true);

    // Create TokenManager instance
    tokenManager = new TokenManager(mockSessionManager, mockAuthService);
  });

  describe('Service Initialization', () => {
    it('should initialize with caching enabled when cache service is available', async () => {
      await tokenManager.initialize();
      
      expect(mockServiceManager.getService).toHaveBeenCalledWith('cacheService');
    });

    it('should initialize without caching when cache service is not available', async () => {
      mockServiceManager.getService = jest.fn().mockReturnValue(null);
      
      await tokenManager.initialize();
      
      expect(mockServiceManager.getService).toHaveBeenCalledWith('cacheService');
    });
  });

  describe('getValidTokens', () => {
    beforeEach(async () => {
      await tokenManager.initialize();
    });

    it('should return cached token when available and valid', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      const expectedCacheKey = `tokens:${teamId}:${userId}`;
      
      mockCacheService.get.mockResolvedValue(testTokens);
      
      const result = await tokenManager.getValidTokens(teamId, userId);
      
      expect(result).toBe(testTokens.google!.access_token);
      expect(mockCacheService.get).toHaveBeenCalledWith(expectedCacheKey);
      expect(mockSessionManager.getOAuthTokens).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when cache miss', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      const expectedCacheKey = `tokens:${teamId}:${userId}`;
      
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      
      const result = await tokenManager.getValidTokens(teamId, userId);
      
      expect(result).toBe(testTokens.google!.access_token);
      expect(mockCacheService.get).toHaveBeenCalledWith(expectedCacheKey);
      expect(mockSessionManager.getOAuthTokens).toHaveBeenCalledWith(teamId, userId);
      expect(mockCacheService.set).toHaveBeenCalledWith(expectedCacheKey, testTokens, 900);
    });

    it('should remove expired cached token and fetch fresh one', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      const expectedCacheKey = `tokens:${teamId}:${userId}`;
      
      // Expired cached token
      const expiredTokens = {
        ...testTokens,
        google: {
          ...testTokens.google!,
          expiry_date: Date.now() - 1000 // Expired 1 second ago
        }
      };
      
      mockCacheService.get.mockResolvedValue(expiredTokens);
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      
      const result = await tokenManager.getValidTokens(teamId, userId);
      
      expect(result).toBe(testTokens.google!.access_token);
      expect(mockCacheService.del).toHaveBeenCalledWith(expectedCacheKey);
      expect(mockSessionManager.getOAuthTokens).toHaveBeenCalledWith(teamId, userId);
    });

    it('should attempt token refresh when token is expired and has refresh token', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      
      const expiredTokens = {
        ...testTokens,
        google: {
          ...testTokens.google!,
          expiry_date: Date.now() - 1000 // Expired
        }
      };
      
      const refreshedTokens = {
        ...testTokens.google!,
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000
      };
      
      mockCacheService.get.mockResolvedValue(null);
      mockSessionManager.getOAuthTokens.mockResolvedValue(expiredTokens);
      mockAuthService.refreshGoogleToken.mockResolvedValue(refreshedTokens);
      mockSessionManager.storeOAuthTokens.mockResolvedValue(true);
      
      const result = await tokenManager.getValidTokens(teamId, userId);
      
      expect(mockAuthService.refreshGoogleToken).toHaveBeenCalledWith(expiredTokens.google!.refresh_token);
      expect(result).toBe('new-access-token');
    });

    it('should return null when no tokens exist', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      
      mockCacheService.get.mockResolvedValue(null);
      mockSessionManager.getOAuthTokens.mockResolvedValue(null);
      
      const result = await tokenManager.getValidTokens(teamId, userId);
      
      expect(result).toBeNull();
    });

    it('should work without caching when cache service is unavailable', async () => {
      // Reinitialize without cache service
      mockServiceManager.getService = jest.fn().mockReturnValue(null);
      const tokenManagerNoCache = new TokenManager(mockSessionManager, mockAuthService);
      await tokenManagerNoCache.initialize();
      
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      
      const result = await tokenManagerNoCache.getValidTokens('team123', 'user123');
      
      expect(result).toBe(testTokens.google!.access_token);
      expect(mockSessionManager.getOAuthTokens).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    beforeEach(async () => {
      await tokenManager.initialize();
    });

    it('should refresh tokens and update cache', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      const expectedCacheKey = `tokens:${teamId}:${userId}`;
      
      const refreshedGoogleTokens = {
        ...testTokens.google!,
        access_token: 'refreshed-access-token',
        expiry_date: Date.now() + 3600000
      };
      
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      mockAuthService.refreshGoogleToken.mockResolvedValue(refreshedGoogleTokens);
      mockSessionManager.storeOAuthTokens.mockResolvedValue(true);
      
      const result = await tokenManager.refreshTokens(teamId, userId);
      
      expect(result).toEqual({
        google: refreshedGoogleTokens,
        slack: testTokens.slack
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expectedCacheKey, 
        { google: refreshedGoogleTokens, slack: testTokens.slack }, 
        900
      );
    });

    it('should return null when no refresh token available', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      
      const tokensWithoutRefresh = {
        ...testTokens,
        google: {
          ...testTokens.google!,
          refresh_token: undefined
        }
      };
      
      mockSessionManager.getOAuthTokens.mockResolvedValue(tokensWithoutRefresh);
      
      const result = await tokenManager.refreshTokens(teamId, userId);
      
      expect(result).toBeNull();
      expect(mockAuthService.refreshGoogleToken).not.toHaveBeenCalled();
    });

    it('should handle refresh failures gracefully', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      mockAuthService.refreshGoogleToken.mockRejectedValue(new Error('Refresh failed'));
      
      const result = await tokenManager.refreshTokens(teamId, userId);
      
      expect(result).toBeNull();
    });
  });

  describe('getTokenStatus', () => {
    beforeEach(async () => {
      await tokenManager.initialize();
    });

    it('should return cached status when available', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      const expectedStatusCacheKey = `token-status:${teamId}:${userId}`;
      
      const cachedStatus = {
        hasTokens: true,
        hasAccessToken: true,
        hasRefreshToken: true,
        isExpired: false,
        status: 'valid'
      };
      
      mockCacheService.get.mockResolvedValue(cachedStatus);
      
      const result = await tokenManager.getTokenStatus(teamId, userId);
      
      expect(result).toEqual(cachedStatus);
      expect(mockCacheService.get).toHaveBeenCalledWith(expectedStatusCacheKey);
      expect(mockSessionManager.getOAuthTokens).not.toHaveBeenCalled();
    });

    it('should fetch status from database and cache when cache miss', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      const expectedStatusCacheKey = `token-status:${teamId}:${userId}`;
      
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      
      const result = await tokenManager.getTokenStatus(teamId, userId);
      
      expect(result).toMatchObject({
        hasTokens: true,
        hasAccessToken: true,
        hasRefreshToken: true,
        isExpired: false,
        status: 'valid'
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(expectedStatusCacheKey, expect.any(Object), 300);
    });
  });

  describe('hasValidOAuthTokens', () => {
    beforeEach(async () => {
      await tokenManager.initialize();
    });

    it('should return true when valid tokens exist', async () => {
      mockCacheService.get.mockResolvedValue(testTokens);
      
      const result = await tokenManager.hasValidOAuthTokens('team123', 'user123');
      
      expect(result).toBe(true);
    });

    it('should return false when no valid tokens exist', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockSessionManager.getOAuthTokens.mockResolvedValue(null);
      
      const result = await tokenManager.hasValidOAuthTokens('team123', 'user123');
      
      expect(result).toBe(false);
    });
  });

  describe('invalidateTokenCache', () => {
    beforeEach(async () => {
      await tokenManager.initialize();
    });

    it('should invalidate both token and status caches', async () => {
      const teamId = 'team123';
      const userId = 'user123';
      
      await tokenManager.invalidateTokenCache(teamId, userId);
      
      expect(mockCacheService.del).toHaveBeenCalledWith(`tokens:${teamId}:${userId}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`token-status:${teamId}:${userId}`);
    });

    it('should handle cache invalidation gracefully when cache service unavailable', async () => {
      // Reinitialize without cache service
      mockServiceManager.getService = jest.fn().mockReturnValue(null);
      const tokenManagerNoCache = new TokenManager(mockSessionManager, mockAuthService);
      await tokenManagerNoCache.initialize();
      
      // Should not throw
      await expect(tokenManagerNoCache.invalidateTokenCache('team123', 'user123')).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await tokenManager.initialize();
    });

    it('should handle cache service errors gracefully during get operations', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      
      const result = await tokenManager.getValidTokens('team123', 'user123');
      
      expect(result).toBe(testTokens.google!.access_token);
      expect(mockSessionManager.getOAuthTokens).toHaveBeenCalled();
    });

    it('should handle cache service errors gracefully during set operations', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockRejectedValue(new Error('Cache set error'));
      mockSessionManager.getOAuthTokens.mockResolvedValue(testTokens);
      
      const result = await tokenManager.getValidTokens('team123', 'user123');
      
      expect(result).toBe(testTokens.google!.access_token);
      // Should not throw despite cache error
    });
  });
});