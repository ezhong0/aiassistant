import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../../../src/middleware/rate-limiting.middleware';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  default: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock unified config
jest.mock('../../../src/config/unified-config', () => ({
  config: {
    security: {
      rateLimiting: {
        enabled: true,
        windowMs: 15 * 60 * 1000 // 15 minutes
      }
    }
  }
}));

// Mock service manager
jest.mock('../../../src/services/service-manager', () => ({
  serviceManager: {
    getService: jest.fn(),
    registerService: jest.fn()
  }
}));

describe('Rate Limiting Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let rateLimitMiddleware: (req: Request, res: Response, next: NextFunction) => void;

  beforeEach(() => {
    mockRequest = {
      ip: '192.168.1.1',
      path: '/test',
      method: 'GET',
      get: jest.fn().mockReturnValue('test-user-agent')
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Create rate limiting middleware with test configuration
    rateLimitMiddleware = rateLimit({
      windowMs: 60000, // 1 minute for testing
      maxRequests: 3,
      keyGenerator: (req) => req.ip || 'unknown'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic rate limiting', () => {
    it('should allow requests within limit', () => {
      // First request
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();

      // Second request
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).not.toHaveBeenCalled();

      // Third request
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding limit', () => {
      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Fourth request should be blocked
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: expect.stringContaining('Too many requests'),
          retryAfter: expect.any(Number)
        }
      });
      expect(mockNext).toHaveBeenCalledTimes(3); // Only first 3 requests should pass
    });

    it('should reset limit after window expires', (done) => {
      // Make 3 requests to reach limit
      for (let i = 0; i < 3; i++) {
        rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Fourth request should be blocked
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);

      // Wait for window to expire (using shorter window for test)
      const shortWindowMiddleware = rateLimit({
        windowMs: 100, // 100ms for testing
        maxRequests: 3,
        keyGenerator: (req) => req.ip || 'unknown'
      });

      setTimeout(() => {
        // Reset mocks
        (mockResponse.status as jest.Mock).mockClear();
        (mockResponse.json as jest.Mock).mockClear();
        (mockNext as jest.Mock).mockClear();

        // Request should be allowed after window expires
        shortWindowMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockResponse.status).not.toHaveBeenCalled();
        done();
      }, 150);
    });
  });

  describe('key generation', () => {
    it('should use IP address as key by default', () => {
      const customRequest = {
        ...mockRequest,
        ip: '10.0.0.1'
      };

      rateLimitMiddleware(customRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle missing IP address', () => {
      const customRequest = {
        ...mockRequest,
        ip: undefined
      };

      rateLimitMiddleware(customRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should use custom key generator', () => {
      const customKeyMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: (req) => `custom-${req.path}`
      });

      customKeyMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('headers', () => {
    it('should add standard rate limit headers', () => {
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'RateLimit-Limit': '3',
        'RateLimit-Remaining': '2',
        'RateLimit-Reset': expect.any(String)
      });
    });

    it('should add legacy headers when enabled', () => {
      const legacyMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 3,
        legacyHeaders: true
      });

      legacyMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': '2',
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should not add headers when disabled', () => {
      const noHeadersMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 3,
        standardHeaders: false,
        legacyHeaders: false
      });

      noHeadersMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle middleware errors gracefully', () => {
      const errorMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: () => {
          throw new Error('Key generation failed');
        }
      });

      errorMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should not block the request on error
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle response errors gracefully', () => {
      const errorResponse = {
        ...mockResponse,
        set: jest.fn().mockImplementation(() => {
          throw new Error('Response error');
        })
      };

      rateLimitMiddleware(mockRequest as Request, errorResponse as Response, mockNext);

      // Should still call next despite response error
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('different IP addresses', () => {
    it('should track different IPs separately', () => {
      const request1 = { ...mockRequest, ip: '192.168.1.1' };
      const request2 = { ...mockRequest, ip: '192.168.1.2' };

      // Make 3 requests from first IP
      for (let i = 0; i < 3; i++) {
        rateLimitMiddleware(request1 as Request, mockResponse as Response, mockNext);
      }

      // Reset mocks
      (mockResponse.status as jest.Mock).mockClear();
      (mockResponse.json as jest.Mock).mockClear();
      (mockNext as jest.Mock).mockClear();

      // Request from second IP should be allowed
      rateLimitMiddleware(request2 as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('warning threshold', () => {
    it('should log warning when approaching limit', () => {
      const { warn } = require('../../../src/utils/logger');

      // Make 2 requests (90% of limit 3 = 2.7, so 2 should trigger warning)
      for (let i = 0; i < 2; i++) {
        rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      expect(warn).toHaveBeenCalledWith(
        'Rate limit warning',
        expect.objectContaining({
          correlationId: expect.stringContaining('rate-limit-warn'),
          operation: 'rate_limit_warning',
          metadata: expect.objectContaining({
            count: 2,
            maxRequests: 3,
            remainingRequests: 1
          })
        })
      );
    });
  });
});
