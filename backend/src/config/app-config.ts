/**
 * Centralized application configuration
 * Contains timeouts, limits, intervals, and other operational settings
 */

/** Timeout configurations in milliseconds */
export const TIMEOUTS = {
  /** Tool execution timeout (30 seconds) */
  toolExecution: 30000,
  
  /** HTTP request timeout (30 seconds) */
  httpRequest: 30000,
  
  /** Session timeout (30 minutes) */
  session: 30 * 60 * 1000,
  
  /** Rate limit cleanup interval (5 minutes) */
  rateLimitCleanup: 5 * 60 * 1000,
  
  /** Session cleanup interval (24 hours - for long-lived sessions) */
  sessionCleanup: 24 * 60 * 60 * 1000,
  
  /** Graceful shutdown timeout (10 seconds) */
  gracefulShutdown: 10000,
  
  /** OpenAI API timeout (60 seconds) */
  openaiApi: 60000
} as const;

/** Rate limiting configuration */
export const RATE_LIMITS = {
  /** General API rate limiting */
  api: {
    /** 15 minutes window */
    windowMs: 15 * 60 * 1000,
    /** 100 requests per window */
    maxRequests: 100,
    message: 'Too many API requests. Please try again later.'
  },
  
  /** Authentication endpoint rate limiting */
  auth: {
    /** 15 minutes window */
    windowMs: 15 * 60 * 1000,
    /** Only 10 auth attempts per window */
    maxRequests: 10,
    message: 'Too many authentication attempts. Please try again later.'
  },
  
  /** Sensitive operations rate limiting */
  sensitive: {
    /** 1 hour window */
    windowMs: 60 * 60 * 1000,
    /** Only 5 sensitive operations per window */
    maxRequests: 5,
    message: 'Too many sensitive operations. Please try again later.'
  },
  
  /** User-specific rate limiting defaults */
  user: {
    /** Default requests per user */
    defaultMaxRequests: 100,
    /** Default window duration */
    defaultWindowMs: 15 * 60 * 1000
  },
  
  /** Assistant-specific rate limits */
  assistant: {
    /** Text command rate limit */
    textCommand: {
      maxRequests: 50,
      windowMs: 15 * 60 * 1000
    },
    /** Session operations rate limit */
    session: {
      maxRequests: 20,
      windowMs: 15 * 60 * 1000
    },
    /** Session deletion rate limit */
    sessionDelete: {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000
    }
  }
} as const;

/** Request size and content limits */
export const REQUEST_LIMITS = {
  /** JSON body size limit */
  jsonBodySize: '10mb',
  
  /** URL encoded body size limit */
  urlEncodedBodySize: '10mb',
  
  /** Command length limits */
  command: {
    minLength: 1,
    maxLength: 5000
  },
  
  /** Session ID length limit */
  sessionId: {
    maxLength: 100
  },
  
  /** Access token length limit */
  accessToken: {
    maxLength: 2000
  },
  
  /** Conversation history limits */
  conversation: {
    /** Maximum conversation entries to keep */
    maxHistory: 10,
    /** Maximum content length per entry */
    maxContentLength: 10000
  },
  
  /** Email search limits */
  emailSearch: {
    /** Default number of results */
    defaultMaxResults: 20,
    /** Maximum number of results allowed */
    maxResults: 100
  }
} as const;

/** Retry and execution configuration */
export const EXECUTION_CONFIG = {
  /** Tool execution retry configuration */
  toolExecution: {
    /** Default retry count */
    defaultRetryCount: 1,
    /** Maximum retry attempts */
    maxRetryCount: 3
  },
  
  /** Session configuration */
  session: {
    /** Default session timeout in minutes (90 days) */
    defaultTimeoutMinutes: 90 * 24 * 60,
    /** Maximum session timeout in minutes (1 year) */
    maxTimeoutMinutes: 365 * 24 * 60
  },
  
  /** Tool execution modes */
  executionModes: {
    /** Preview mode - prepare but don't execute */
    preview: 'preview',
    /** Normal execution mode */
    normal: 'normal'
  } as const
} as const;

/** Memory and performance limits */
export const PERFORMANCE_LIMITS = {
  /** Rate limiting store cleanup */
  rateLimitStore: {
    /** Cleanup interval (5 minutes) */
    cleanupInterval: 5 * 60 * 1000,
    /** Warning threshold for rate limit approaches (90% of max) */
    warningThreshold: 0.9
  },
  
  /** Session store limits */
  sessionStore: {
    /** Maximum number of active sessions */
    maxActiveSessions: 10000,
    /** Memory usage warning threshold (MB) */
    memoryWarningThreshold: 100
  },
  
  /** Tool execution limits */
  toolExecution: {
    /** Maximum concurrent tool executions */
    maxConcurrent: 10,
    /** Maximum tool calls per request */
    maxToolCallsPerRequest: 5
  }
} as const;

/** Logging and monitoring configuration */
export const MONITORING_CONFIG = {
  /** Request logging configuration */
  requestLogging: {
    /** Maximum request body length to log */
    maxBodyLength: 1000,
    /** Maximum response body length to log */
    maxResponseLength: 1000,
    /** Fields to exclude from logging (for security) */
    excludeFields: ['password', 'accessToken', 'refreshToken', 'authorization']
  },
  
  /** Error logging configuration */
  errorLogging: {
    /** Include stack traces in logs */
    includeStackTrace: true,
    /** Maximum error message length */
    maxErrorLength: 2000
  },
  
  /** Performance monitoring */
  performance: {
    /** Log slow requests (threshold in ms) */
    slowRequestThreshold: 5000,
    /** Log large responses (threshold in bytes) */
    largeResponseThreshold: 1024 * 1024 // 1MB
  }
} as const;

/** Security configuration */
export const SECURITY_CONFIG = {
  /** CORS configuration */
  cors: {
    /** Default allowed origins in development */
    developmentOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    /** Production origin validation required */
    productionRequiresOrigin: true
  },
  
  /** Request sanitization */
  sanitization: {
    /** Fields to sanitize in requests */
    sanitizeFields: ['command', 'sessionId', 'accessToken'],
    /** Maximum length for sanitized strings */
    maxSanitizedLength: 5000
  },
  
  /** Authentication configuration */
  auth: {
    /** JWT token expiration (24 hours) */
    jwtExpiration: '24h',
    /** Refresh token expiration (30 days) */
    refreshTokenExpiration: '30d'
  }
} as const;

/** Helper functions for app configuration */
export const APP_CONFIG_HELPERS = {
  /**
   * Get timeout value by name
   */
  getTimeout: (timeoutName: keyof typeof TIMEOUTS): number => {
    return TIMEOUTS[timeoutName];
  },
  
  /**
   * Get rate limit configuration by type
   */
  getRateLimit: (rateLimitType: keyof typeof RATE_LIMITS): any => {
    return RATE_LIMITS[rateLimitType];
  },
  
  /**
   * Check if request size is within limits
   */
  isWithinRequestLimits: (contentLength: number, type: 'json' | 'urlencoded' = 'json'): boolean => {
    const limitStr = type === 'json' ? REQUEST_LIMITS.jsonBodySize : REQUEST_LIMITS.urlEncodedBodySize;
    const limitBytes = parseInt(limitStr.replace('mb', '')) * 1024 * 1024;
    return contentLength <= limitBytes;
  },
  
  /**
   * Get session timeout in milliseconds
   */
  getSessionTimeout: (customTimeoutMinutes?: number): number => {
    const timeoutMinutes = customTimeoutMinutes || EXECUTION_CONFIG.session.defaultTimeoutMinutes;
    const maxTimeout = EXECUTION_CONFIG.session.maxTimeoutMinutes;
    const actualTimeout = Math.min(timeoutMinutes, maxTimeout);
    return actualTimeout * 60 * 1000;
  },
  
  /**
   * Check if performance threshold is exceeded
   */
  isPerformanceThresholdExceeded: (
    value: number, 
    thresholdType: 'slowRequest' | 'largeResponse' | 'memoryWarning'
  ): boolean => {
    switch (thresholdType) {
      case 'slowRequest':
        return value > MONITORING_CONFIG.performance.slowRequestThreshold;
      case 'largeResponse':
        return value > MONITORING_CONFIG.performance.largeResponseThreshold;
      case 'memoryWarning':
        return value > PERFORMANCE_LIMITS.sessionStore.memoryWarningThreshold * 1024 * 1024;
      default:
        return false;
    }
  }
} as const;