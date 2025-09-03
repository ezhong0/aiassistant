import { configService } from '../../../src/config/config.service';

describe('ConfigService', () => {
  describe('Environment Configuration', () => {
    it('should have correct node environment', () => {
      expect(configService.nodeEnv).toBe('test');
    });

    it('should have port configuration', () => {
      expect(typeof configService.port).toBe('number');
      expect(configService.port).toBeGreaterThanOrEqual(0);
    });

    it('should have JWT configuration', () => {
      expect(configService.jwtSecret).toBeDefined();
      expect(typeof configService.jwtSecret).toBe('string');
      expect(configService.jwtSecret.length).toBeGreaterThan(0);
    });
  });

  describe('Google OAuth Configuration', () => {
    it('should have Google client configuration', () => {
      expect(configService.googleClientId).toBeDefined();
      expect(configService.googleClientSecret).toBeDefined();
      expect(configService.googleRedirectUri).toBeDefined();
    });

    it('should have valid Google redirect URI format', () => {
      expect(configService.googleRedirectUri).toMatch(/^https?:\/\/.+/);
    });
  });

  describe('API Keys Configuration', () => {
    it('should have OpenAI API key (if configured)', () => {
      if (configService.openaiApiKey) {
        expect(typeof configService.openaiApiKey).toBe('string');
        expect(configService.openaiApiKey.length).toBeGreaterThan(0);
      }
    });

    it('should have Tavily API key (if configured)', () => {
      if (configService.tavilyApiKey) {
        expect(typeof configService.tavilyApiKey).toBe('string');
        expect(configService.tavilyApiKey.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should have rate limiting settings', () => {
      expect(typeof configService.rateLimitWindowMs).toBe('number');
      expect(configService.rateLimitWindowMs).toBeGreaterThan(0);
      
      expect(typeof configService.rateLimitMaxRequests).toBe('number');
      expect(configService.rateLimitMaxRequests).toBeGreaterThan(0);
    });

    it('should respect disable rate limiting in test env', () => {
      const isDisabled = process.env.DISABLE_RATE_LIMITING === 'true';
      expect(isDisabled).toBe(true);
    });
  });

  describe('Security Configuration', () => {
    it('should have bcrypt salt rounds', () => {
      expect(typeof configService.bcryptSaltRounds).toBe('number');
      expect(configService.bcryptSaltRounds).toBeGreaterThanOrEqual(10);
    });

    it('should validate production requirements', () => {
      if (configService.nodeEnv === 'production') {
        expect(configService.jwtSecret).not.toBe('test-jwt-secret');
        expect(configService.googleClientId).not.toMatch(/^test-/);
        expect(configService.openaiApiKey).not.toMatch(/^test-/);
      }
    });
  });
});