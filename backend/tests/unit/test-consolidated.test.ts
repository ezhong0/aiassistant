/**
 * Consolidated test to verify test infrastructure works
 * Tests basic utilities without full service initialization
 */

import { TestUtils, TestMocks, TestAssertions } from '../test-utils';
import { TEST_CONFIG } from '../test-setup';

describe('Consolidated Test Infrastructure', () => {
  
  describe('TestUtils', () => {
    it('should create unique session IDs', () => {
      const sessionId1 = TestUtils.createTestSessionId('unit');
      const sessionId2 = TestUtils.createTestSessionId('unit');
      
      expect(sessionId1).toContain('unit-');
      expect(sessionId2).toContain('unit-');
      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should handle async operations', async () => {
      const startTime = Date.now();
      await TestUtils.waitForAsyncOperations(50);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should force garbage collection safely', () => {
      expect(() => TestUtils.forceGC()).not.toThrow();
    });

    it('should get memory usage without errors', () => {
      expect(() => TestUtils.getMemoryUsage()).not.toThrow();
    });

    it('should run cleanup function properly', async () => {
      let testRan = false;
      const result = await TestUtils.runWithCleanup(async () => {
        testRan = true;
        return 'success';
      });

      expect(testRan).toBe(true);
      expect(result).toBe('success');
    });
  });

  describe('TestMocks', () => {
    it('should create mock OAuth tokens', () => {
      const tokens = TestMocks.createMockOAuthTokens();
      
      expect(tokens).toBeDefined();
      expect(tokens.google).toBeDefined();
      expect(tokens.google.access_token).toBe('mock_access_token_123');
      expect(tokens.google.refresh_token).toBe('mock_refresh_token_456');
      expect(tokens.slack).toBeDefined();
      expect(tokens.slack.team_id).toBe('T123456789');
    });

    it('should create mock session', () => {
      const session = TestMocks.createMockSession();
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('user:T123456789:U123456789');
      expect(session.userId).toBe('U123456789');
      expect(session.teamId).toBe('T123456789');
      expect(session.oauthTokens).toBeDefined();
    });

    it('should create mock session with custom IDs', () => {
      const session = TestMocks.createMockSession('T999', 'U999');
      
      expect(session.sessionId).toBe('user:T999:U999');
      expect(session.userId).toBe('U999');
      expect(session.teamId).toBe('T999');
    });
  });

  describe('TestAssertions', () => {
    it('should validate OAuth tokens', () => {
      const validTokens = TestMocks.createMockOAuthTokens();
      expect(() => TestAssertions.assertValidOAuthTokens(validTokens)).not.toThrow();
    });

    it('should validate session structure', () => {
      const validSession = TestMocks.createMockSession();
      expect(() => TestAssertions.assertValidSession(validSession)).not.toThrow();
    });

    it('should fail validation for invalid tokens', () => {
      const invalidTokens = { invalid: true };
      expect(() => TestAssertions.assertValidOAuthTokens(invalidTokens)).toThrow();
    });

    it('should fail validation for invalid session', () => {
      const invalidSession = { invalid: true };
      expect(() => TestAssertions.assertValidSession(invalidSession)).toThrow();
    });
  });

  describe('TEST_CONFIG', () => {
    it('should have proper configuration values', () => {
      expect(TEST_CONFIG.TIMEOUT).toBe(30000);
      expect(TEST_CONFIG.SERVICE_INIT_TIMEOUT).toBe(10000);
      expect(TEST_CONFIG.MEMORY_CLEANUP_DELAY).toBe(100);
      expect(TEST_CONFIG.MOCK_TEAM_ID).toBe('T123456789');
      expect(TEST_CONFIG.MOCK_USER_ID).toBe('U123456789');
    });
  });

  describe('Memory Management', () => {
    it('should handle memory-intensive operations', async () => {
      const iterations = 100;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const sessionId = TestUtils.createTestSessionId('memory');
        const mockData = TestMocks.createMockOAuthTokens();
        results.push({ sessionId, mockData });
      }
      
      expect(results).toHaveLength(iterations);
      
      // Force cleanup
      TestUtils.forceGC();
      await TestUtils.waitForAsyncOperations(TEST_CONFIG.MEMORY_CLEANUP_DELAY);
      
      // Memory test passed if we get here without errors
      expect(true).toBe(true);
    });
  });
});