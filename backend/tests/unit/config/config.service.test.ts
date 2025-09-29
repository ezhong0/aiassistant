import { config } from '../../../src/config';

describe('UnifiedConfigService', () => {
  describe('Environment Configuration', () => {
    it('should have correct node environment', () => {
      expect(config.nodeEnv).toBe('test');
    });

    it('should have port configuration', () => {
      expect(typeof config.port).toBe('number');
      expect(config.port).toBeGreaterThanOrEqual(0);
    });

    it('should have JWT configuration', () => {
      expect(config.jwtSecret).toBeDefined();
      expect(typeof config.jwtSecret).toBe('string');
      expect(config.jwtSecret.length).toBeGreaterThan(0);
    });
  });

  describe('Google OAuth Configuration', () => {
    it('should have Google client configuration', () => {
      expect(config.googleAuth?.clientId).toBeDefined();
      expect(config.googleAuth?.clientSecret).toBeDefined();
      expect(config.googleAuth?.redirectUri).toBeDefined();
    });

    it('should have valid Google redirect URI format', () => {
      expect(config.googleAuth?.redirectUri).toMatch(/^https?:\/\/.+/);
    });
  });

  describe('API Keys Configuration', () => {
    it('should have OpenAI API key (if configured)', () => {
      if (config.openaiApiKey) {
        expect(typeof config.openaiApiKey).toBe('string');
        expect(config.openaiApiKey.length).toBeGreaterThan(0);
      }
    });

    it('should have Slack configuration (if configured)', () => {
      if (config.slackAuth?.botToken) {
        expect(typeof config.slackAuth.botToken).toBe('string');
        expect(config.slackAuth.botToken.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should have rate limiting settings', () => {
      expect(typeof config.security.rateLimiting.windowMs).toBe('number');
      expect(config.security.rateLimiting.windowMs).toBeGreaterThan(0);
      
      expect(typeof config.security.rateLimiting.maxRequests).toBe('number');
      expect(config.security.rateLimiting.maxRequests).toBeGreaterThan(0);
    });

    it('should respect rate limiting configuration', () => {
      expect(typeof config.security.rateLimiting.enabled).toBe('boolean');
    });
  });

  describe('Security Configuration', () => {
    it('should have bcrypt salt rounds', () => {
      expect(typeof config.security.bcryptRounds).toBe('number');
      expect(config.security.bcryptRounds).toBeGreaterThanOrEqual(10);
    });

    it('should validate production requirements', () => {
      if (config.isProduction) {
        expect(config.jwtSecret).not.toBe('test-jwt-secret');
        expect(config.googleAuth?.clientId).not.toMatch(/^test-/);
        expect(config.openaiApiKey).not.toMatch(/^test-/);
      }
    });
  });

  describe('Health Check', () => {
    it('should provide health status', () => {
      const health = config.getHealth();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('details');
      expect(typeof health.healthy).toBe('boolean');
    });
  });
});