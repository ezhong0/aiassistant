import { CacheService } from '../../../src/services/cache.service';
import { ServiceState } from '../../../src/services/service-manager';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    info: jest.fn(),
    dbSize: jest.fn(),
    flushAll: jest.fn(),
    quit: jest.fn(),
    on: jest.fn()
  }))
}));

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new cache service instance
    cacheService = new CacheService();
    
    // Get the mocked Redis client
    const { createClient } = require('redis');
    mockRedisClient = createClient();
  });

  afterEach(async () => {
    if (cacheService && cacheService.state !== ServiceState.DESTROYED) {
      try {
        await cacheService.destroy();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with Redis connection', async () => {
      await cacheService.initialize();
      
      expect(cacheService.state).toBe(ServiceState.READY);
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should handle Redis connection failures gracefully in development', async () => {
      process.env.NODE_ENV = 'development';
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await cacheService.initialize();
      
      // Should still be ready in development mode
      expect(cacheService.state).toBe(ServiceState.READY);
      
      delete process.env.NODE_ENV;
    });

    it('should fail initialization in production when Redis is unavailable', async () => {
      process.env.NODE_ENV = 'production';
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(cacheService.initialize()).rejects.toThrow('Connection failed');
      expect(cacheService.state).toBe(ServiceState.ERROR);
      
      delete process.env.NODE_ENV;
    });

    it('should destroy successfully', async () => {
      await cacheService.initialize();
      await cacheService.destroy();
      
      expect(cacheService.state).toBe(ServiceState.DESTROYED);
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    describe('get/set operations', () => {
      it('should set and get a value successfully', async () => {
        const testData = { id: 1, name: 'test' };
        const key = 'test-key';
        
        mockRedisClient.setEx.mockResolvedValue('OK');
        mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));
        
        const setResult = await cacheService.set(key, testData);
        expect(setResult).toBe(true);
        expect(mockRedisClient.setEx).toHaveBeenCalledWith(
          'assistantapp:test-key',
          300, // default TTL
          JSON.stringify(testData)
        );
        
        const retrievedData = await cacheService.get(key);
        expect(retrievedData).toEqual(testData);
        expect(mockRedisClient.get).toHaveBeenCalledWith('assistantapp:test-key');
      });

      it('should set a value with custom TTL', async () => {
        const testData = { id: 2 };
        const key = 'test-key-ttl';
        const customTTL = 600;
        
        mockRedisClient.setEx.mockResolvedValue('OK');
        
        const result = await cacheService.set(key, testData, customTTL);
        expect(result).toBe(true);
        expect(mockRedisClient.setEx).toHaveBeenCalledWith(
          'assistantapp:test-key-ttl',
          customTTL,
          JSON.stringify(testData)
        );
      });

      it('should return null for non-existent keys', async () => {
        const key = 'non-existent';
        
        mockRedisClient.get.mockResolvedValue(null);
        
        const result = await cacheService.get(key);
        expect(result).toBeNull();
      });

      it('should handle JSON parsing errors gracefully', async () => {
        const key = 'invalid-json-key';
        
        mockRedisClient.get.mockResolvedValue('invalid-json');
        
        const result = await cacheService.get(key);
        expect(result).toBeNull();
      });
    });

    describe('delete operations', () => {
      it('should delete a key successfully', async () => {
        const key = 'delete-test';
        
        mockRedisClient.del.mockResolvedValue(1);
        
        const result = await cacheService.del(key);
        expect(result).toBe(true);
        expect(mockRedisClient.del).toHaveBeenCalledWith('assistantapp:delete-test');
      });

      it('should return false when deleting non-existent key', async () => {
        const key = 'non-existent-delete';
        
        mockRedisClient.del.mockResolvedValue(0);
        
        const result = await cacheService.del(key);
        expect(result).toBe(false);
      });
    });

    describe('exists operations', () => {
      it('should return true for existing keys', async () => {
        const key = 'existing-key';
        
        mockRedisClient.exists.mockResolvedValue(1);
        
        const result = await cacheService.exists(key);
        expect(result).toBe(true);
        expect(mockRedisClient.exists).toHaveBeenCalledWith('assistantapp:existing-key');
      });

      it('should return false for non-existing keys', async () => {
        const key = 'non-existing-key';
        
        mockRedisClient.exists.mockResolvedValue(0);
        
        const result = await cacheService.exists(key);
        expect(result).toBe(false);
      });
    });

    describe('expire operations', () => {
      it('should set expiration successfully', async () => {
        const key = 'expire-test';
        const ttl = 300;
        
        mockRedisClient.expire.mockResolvedValue(true);
        
        const result = await cacheService.expire(key, ttl);
        expect(result).toBe(true);
        expect(mockRedisClient.expire).toHaveBeenCalledWith('assistantapp:expire-test', ttl);
      });
    });

    describe('statistics operations', () => {
      it('should get cache statistics', async () => {
        const mockInfo = 'used_memory_human:1.5M\r\nother_stat:value';
        const mockDbSize = 100;
        
        mockRedisClient.info.mockResolvedValue(mockInfo);
        mockRedisClient.dbSize.mockResolvedValue(mockDbSize);
        
        const stats = await cacheService.getStats();
        
        expect(stats).toEqual({
          connected: true,
          memoryUsage: '1.5M',
          keyCount: 100
        });
      });

      it('should handle stats errors gracefully', async () => {
        mockRedisClient.info.mockRejectedValue(new Error('Info failed'));
        
        const stats = await cacheService.getStats();
        
        expect(stats).toEqual({
          connected: false
        });
      });
    });

    describe('utility operations', () => {
      it('should ping successfully', async () => {
        mockRedisClient.ping.mockResolvedValue('PONG');
        
        const result = await cacheService.ping();
        expect(result).toBe(true);
      });

      it('should handle ping failures', async () => {
        mockRedisClient.ping.mockRejectedValue(new Error('Ping failed'));
        
        const result = await cacheService.ping();
        expect(result).toBe(false);
      });

      it('should flush all data', async () => {
        mockRedisClient.flushAll.mockResolvedValue('OK');
        
        const result = await cacheService.flushAll();
        expect(result).toBe(true);
        expect(mockRedisClient.flushAll).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should handle Redis errors gracefully during operations', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.get('error-key');
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully during set operations', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.set('error-key', 'value');
      expect(result).toBe(false);
    });
  });

  describe('Service Health', () => {
    it('should report healthy when ready and connected', async () => {
      await cacheService.initialize();
      
      const health = cacheService.getHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        connected: expect.any(Boolean),
        state: ServiceState.READY,
        redisUrl: 'configured'
      });
    });

    it('should report unhealthy when not ready', () => {
      const health = cacheService.getHealth();
      
      expect(health.healthy).toBe(false);
      expect(health.details.state).toBe(ServiceState.INITIALIZING);
    });
  });

  describe('Key Prefixing', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should prefix all keys with namespace', async () => {
      const key = 'user:123';
      const prefixedKey = 'assistantapp:user:123';
      
      mockRedisClient.get.mockResolvedValue(null);
      
      await cacheService.get(key);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(prefixedKey);
    });
  });
});