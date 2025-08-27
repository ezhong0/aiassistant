/**
 * Centralized environment variable configuration
 * Provides type-safe access to environment variables with defaults and validation
 */

/** Environment variable names as constants to avoid typos */
export const ENV_VARS = {
  // Core application
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  LOG_LEVEL: 'LOG_LEVEL',
  
  // Database and external services
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
  GOOGLE_REDIRECT_URI: 'GOOGLE_REDIRECT_URI',
  
  // Security
  JWT_SECRET: 'JWT_SECRET',
  
  // API keys
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  TAVILY_API_KEY: 'TAVILY_API_KEY',
  
  // Slack configuration
  SLACK_SIGNING_SECRET: 'SLACK_SIGNING_SECRET',
  SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
  SLACK_CLIENT_ID: 'SLACK_CLIENT_ID',
  SLACK_CLIENT_SECRET: 'SLACK_CLIENT_SECRET',
  SLACK_OAUTH_REDIRECT_URI: 'SLACK_OAUTH_REDIRECT_URI',
  
  // Rate limiting and security
  DISABLE_RATE_LIMITING: 'DISABLE_RATE_LIMITING',
  CORS_ORIGIN: 'CORS_ORIGIN',
  
  // Feature flags
  ENABLE_OPENAI: 'ENABLE_OPENAI',
  ENABLE_RATE_LIMITING: 'ENABLE_RATE_LIMITING',
  ENABLE_REQUEST_LOGGING: 'ENABLE_REQUEST_LOGGING'
} as const;

/** Environment configuration with type-safe access and defaults */
export const ENVIRONMENT = {
  /**
   * Current environment (development, production, test)
   */
  nodeEnv: process.env[ENV_VARS.NODE_ENV] || 'development',
  
  /**
   * Server port number
   */
  port: parseInt(process.env[ENV_VARS.PORT] || '3000', 10),
  
  /**
   * Logging level for winston
   */
  logLevel: process.env[ENV_VARS.LOG_LEVEL] || 'info',
  
  /**
   * Google OAuth configuration
   */
  google: {
    clientId: process.env[ENV_VARS.GOOGLE_CLIENT_ID] || '',
    clientSecret: process.env[ENV_VARS.GOOGLE_CLIENT_SECRET] || '',
    redirectUri: process.env[ENV_VARS.GOOGLE_REDIRECT_URI] || ''
  },
  
  /**
   * JWT secret for token signing
   */
  jwtSecret: process.env[ENV_VARS.JWT_SECRET] || '',
  
  /**
   * External API keys
   */
  apiKeys: {
    openai: process.env[ENV_VARS.OPENAI_API_KEY] || '',
    tavily: process.env[ENV_VARS.TAVILY_API_KEY] || ''
  },
  
  /**
   * Slack integration configuration
   */
  slack: {
    signingSecret: process.env[ENV_VARS.SLACK_SIGNING_SECRET] || '',
    botToken: process.env[ENV_VARS.SLACK_BOT_TOKEN] || '',
    clientId: process.env[ENV_VARS.SLACK_CLIENT_ID] || '',
    clientSecret: process.env[ENV_VARS.SLACK_CLIENT_SECRET] || '',
    redirectUri: process.env[ENV_VARS.SLACK_OAUTH_REDIRECT_URI] || ''
  },
  
  /**
   * CORS origin configuration
   */
  corsOrigin: process.env[ENV_VARS.CORS_ORIGIN] || '*',
  
  /**
   * Feature flags and toggles
   */
  features: {
    /** Enable/disable rate limiting */
    rateLimiting: process.env[ENV_VARS.DISABLE_RATE_LIMITING] !== 'true',
    
    /** Enable OpenAI integration */
    openai: process.env[ENV_VARS.ENABLE_OPENAI] !== 'false' && !!process.env[ENV_VARS.OPENAI_API_KEY],
    
    /** Enable request logging */
    requestLogging: process.env[ENV_VARS.ENABLE_REQUEST_LOGGING] !== 'false'
  }
} as const;

/** Environment validation helpers */
export const ENV_VALIDATION = {
  /**
   * Check if running in development mode
   */
  isDevelopment: (): boolean => {
    return ENVIRONMENT.nodeEnv === 'development';
  },
  
  /**
   * Check if running in production mode
   */
  isProduction: (): boolean => {
    return ENVIRONMENT.nodeEnv === 'production';
  },
  
  /**
   * Check if running in test mode
   */
  isTest: (): boolean => {
    return ENVIRONMENT.nodeEnv === 'test';
  },
  
  /**
   * Validate required environment variables
   * Returns array of missing required variables
   */
  validateRequired: (): string[] => {
    const missing: string[] = [];
    
    // Core required variables (always needed)
    const coreRequired = [ENV_VARS.JWT_SECRET];
    
    // Production-only required variables
    const productionRequired = [
      ENV_VARS.GOOGLE_CLIENT_ID,
      ENV_VARS.GOOGLE_CLIENT_SECRET,
      ENV_VARS.GOOGLE_REDIRECT_URI
    ];
    
    // Check core required
    for (const envVar of coreRequired) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
    
    // Check production required only in production
    if (ENV_VALIDATION.isProduction()) {
      for (const envVar of productionRequired) {
        if (!process.env[envVar]) {
          missing.push(envVar);
        }
      }
    }
    
    return missing;
  },
  
  /**
   * Check if Google OAuth is properly configured
   */
  isGoogleConfigured: (): boolean => {
    return !!(ENVIRONMENT.google.clientId && 
              ENVIRONMENT.google.clientSecret && 
              ENVIRONMENT.google.redirectUri);
  },
  
  /**
   * Check if OpenAI is properly configured
   */
  isOpenAIConfigured: (): boolean => {
    return !!ENVIRONMENT.apiKeys.openai;
  },
  
  /**
   * Check if Tavily is properly configured
   */
  isTavilyConfigured: (): boolean => {
    return !!ENVIRONMENT.apiKeys.tavily;
  },
  
  /**
   * Check if Slack is properly configured
   */
  isSlackConfigured: (): boolean => {
    return !!(ENVIRONMENT.slack.signingSecret && 
              ENVIRONMENT.slack.botToken && 
              ENVIRONMENT.slack.clientId && 
              ENVIRONMENT.slack.clientSecret);
  },
  
  /**
   * Get configuration summary for logging
   */
  getConfigSummary: () => {
    return {
      nodeEnv: ENVIRONMENT.nodeEnv,
      port: ENVIRONMENT.port,
      logLevel: ENVIRONMENT.logLevel,
      features: ENVIRONMENT.features,
      services: {
        google: ENV_VALIDATION.isGoogleConfigured(),
        openai: ENV_VALIDATION.isOpenAIConfigured(),
        tavily: ENV_VALIDATION.isTavilyConfigured(),
        slack: ENV_VALIDATION.isSlackConfigured()
      }
    };
  }
} as const;

/** Default values for various configurations */
export const DEFAULTS = {
  /** Default server port */
  port: 3000,
  
  /** Default log level */
  logLevel: 'info',
  
  /** Default session timeout in minutes */
  sessionTimeout: 30,
  
  /** Default rate limit window in milliseconds */
  rateLimitWindow: 15 * 60 * 1000,
  
  /** Default rate limit max requests */
  rateLimitMaxRequests: 100,
  
  /** Default OpenAI model */
  openaiModel: 'gpt-4o-mini',
  
  /** Default request timeout in milliseconds */
  requestTimeout: 30000,
  
  /** Default CORS origins for development */
  corsOriginsDev: ['http://localhost:3000', 'http://127.0.0.1:3000']
} as const;

/** Helper functions for environment configuration */
export const ENV_HELPERS = {
  /**
   * Get environment variable with default value and type conversion
   */
  getEnvVar: <T = string>(
    key: string, 
    defaultValue: T, 
    converter?: (value: string) => T
  ): T => {
    const value = process.env[key];
    
    if (value === undefined) {
      return defaultValue;
    }
    
    if (converter) {
      try {
        return converter(value);
      } catch {
        return defaultValue;
      }
    }
    
    return value as T;
  },
  
  /**
   * Get boolean environment variable
   */
  getBooleanEnv: (key: string, defaultValue: boolean = false): boolean => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  },
  
  /**
   * Get number environment variable
   */
  getNumberEnv: (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  },
  
  /**
   * Get array environment variable (comma-separated)
   */
  getArrayEnv: (key: string, defaultValue: string[] = []): string[] => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.split(',').map(item => item.trim()).filter(Boolean);
  },
  
  /**
   * Mask sensitive environment variable for logging
   */
  maskSensitive: (value: string | undefined): string => {
    if (!value) return 'not_set';
    if (value.length <= 8) return '***';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  },
  
  /**
   * Get safe environment summary for logging (masks sensitive values)
   */
  getSafeEnvSummary: () => {
    return {
      NODE_ENV: ENVIRONMENT.nodeEnv,
      PORT: ENVIRONMENT.port,
      LOG_LEVEL: ENVIRONMENT.logLevel,
      GOOGLE_CLIENT_ID: ENV_HELPERS.maskSensitive(ENVIRONMENT.google.clientId),
      OPENAI_API_KEY: ENV_HELPERS.maskSensitive(ENVIRONMENT.apiKeys.openai),
      TAVILY_API_KEY: ENV_HELPERS.maskSensitive(ENVIRONMENT.apiKeys.tavily),
      JWT_SECRET: ENV_HELPERS.maskSensitive(ENVIRONMENT.jwtSecret),
      SLACK_BOT_TOKEN: ENV_HELPERS.maskSensitive(ENVIRONMENT.slack.botToken),
      SLACK_SIGNING_SECRET: ENV_HELPERS.maskSensitive(ENVIRONMENT.slack.signingSecret),
      SLACK_CLIENT_ID: ENV_HELPERS.maskSensitive(ENVIRONMENT.slack.clientId),
      features: ENVIRONMENT.features
    };
  }
} as const;