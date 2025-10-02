/**
 * Mock Service Utilities
 *
 * Provides pre-configured mocks for common services to simplify testing.
 * Use these mocks when you need to inject dependencies into services under test.
 */

import { jest } from '@jest/globals';
import type { DatabaseService } from '../../src/services/database.service';
import type { CacheService } from '../../src/services/cache.service';
import type { EncryptionService } from '../../src/services/encryption.service';

/**
 * Create a mock DatabaseService with common methods
 */
export function createMockDatabaseService(overrides?: Partial<DatabaseService>): jest.Mocked<DatabaseService> {
  const mock = {
    // BaseService methods
    name: 'databaseService',
    initialized: true,
    destroyed: false,
    isReady: jest.fn<() => boolean>().mockReturnValue(true),
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getHealth: jest.fn<() => { healthy: boolean }>().mockReturnValue({ healthy: true }),

    // DatabaseService methods
    query: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ rows: [], rowCount: 0 }),
    getClient: jest.fn<() => Promise<any>>().mockResolvedValue({} as any),
    transaction: jest.fn<(callback: (client: any) => Promise<any>) => Promise<any>>().mockImplementation(async (callback) => {
      return callback({} as any);
    }),

    // Token-related methods
    storeUserTokens: jest.fn<(tokens: any) => Promise<void>>().mockResolvedValue(undefined),
    getUserTokens: jest.fn<(userId: string) => Promise<any>>().mockResolvedValue(null),
    deleteUserTokens: jest.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined),
    updateUserTokenRefreshToken: jest.fn<(userId: string, refreshToken: string | null) => Promise<void>>().mockResolvedValue(undefined),
    cleanupExpiredTokens: jest.fn<() => Promise<number>>().mockResolvedValue(0),

    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;

  return mock;
}

/**
 * Create a mock CacheService with common methods
 */
export function createMockCacheService(overrides?: Partial<CacheService>): jest.Mocked<CacheService> {
  const mock = {
    // BaseService methods
    name: 'cacheService',
    initialized: true,
    destroyed: false,
    isReady: jest.fn<() => boolean>().mockReturnValue(true),
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getHealth: jest.fn<() => { healthy: boolean }>().mockReturnValue({ healthy: true }),

    // CacheService methods
    get: jest.fn<(key: string) => Promise<unknown>>().mockResolvedValue(null),
    set: jest.fn<(key: string, value: unknown, ttl?: number) => Promise<void>>().mockResolvedValue(undefined),
    del: jest.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
    delete: jest.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
    exists: jest.fn<(key: string) => Promise<boolean>>().mockResolvedValue(false),
    expire: jest.fn<(key: string, ttl: number) => Promise<void>>().mockResolvedValue(undefined),
    keys: jest.fn<(pattern: string) => Promise<string[]>>().mockResolvedValue([]),
    flushAll: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),

    ...overrides,
  } as unknown as jest.Mocked<CacheService>;

  return mock;
}

/**
 * Create a mock EncryptionService with common methods
 */
export function createMockEncryptionService(overrides?: Partial<EncryptionService>): jest.Mocked<EncryptionService> {
  const mock = {
    // BaseService methods
    name: 'encryptionService',
    initialized: true,
    destroyed: false,
    isReady: jest.fn<() => boolean>().mockReturnValue(true),
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getHealth: jest.fn<() => { healthy: boolean }>().mockReturnValue({ healthy: true }),

    // EncryptionService methods
    encryptSensitiveData: jest.fn<(data: string) => string>().mockImplementation((data: string) => `encrypted_${data}`),
    decryptSensitiveData: jest.fn<(data: string) => string>().mockImplementation((data: string) => data.replace('encrypted_', '')),
    hashPassword: jest.fn<(password: string) => string>().mockImplementation((password: string) => `hashed_${password}`),
    verifyPassword: jest.fn<(password: string, hash: string) => Promise<boolean>>().mockResolvedValue(true),

    ...overrides,
  } as unknown as jest.Mocked<EncryptionService>;

  return mock;
}

/**
 * Create a mock config object for services that need it
 */
export function createMockConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    googleAuth: {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      redirectUri: 'http://localhost:3001/auth/callback',
    },
    slackAuth: {
      clientId: 'test_slack_client_id',
      clientSecret: 'test_slack_client_secret',
      redirectUri: 'http://localhost:3001/slack/callback',
    },
    jwt: {
      secret: 'test_jwt_secret',
      issuer: 'test-issuer',
      audience: 'test-audience',
      expiresIn: '1h',
    },
    encryption: {
      key: 'test_encryption_key_32_chars_long',
    },
    ...overrides,
  };
}

/**
 * Helper to create a service with mocked dependencies
 *
 * @example
 * ```typescript
 * const { service, mocks } = createServiceWithMocks(
 *   TokenStorageService,
 *   {
 *     databaseService: createMockDatabaseService(),
 *     cacheService: createMockCacheService(),
 *     encryptionService: createMockEncryptionService(),
 *     config: createMockConfig(),
 *   }
 * );
 *
 * await service.initialize();
 * await service.storeUserTokens('user-123', { google: tokens });
 * expect(mocks.databaseService.storeUserTokens).toHaveBeenCalled();
 * ```
 */
export function createServiceWithMocks<T>(
  ServiceClass: new (...args: any[]) => T,
  dependencies: Record<string, unknown>,
): { service: T; mocks: Record<string, unknown> } {
  const service = new ServiceClass(...Object.values(dependencies));
  return { service, mocks: dependencies };
}
