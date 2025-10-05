/**
 * Unified Configuration System
 * 
 * Elegant, type-safe configuration management with:
 * - Environment variable validation with Zod
 * - Hierarchical configuration groups
 * - Intelligent defaults per environment
 * - Runtime validation and health checks
 * - Hot-reload capability for development
 */

import { z } from 'zod';
import { BaseService } from '../services/base-service';

// Core environment schema
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Authentication and OAuth
const AuthSchema = z.object({
  // OAuth Providers
  google: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
    webClientId: z.string().optional(),
  }).optional(),

  // JWT Configuration
  jwt: z.object({
    secret: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('development_jwt_secret_key_at_least_32_characters_long_for_security'),
    expiresIn: z.string().default('24h'),
    issuer: z.string().default('assistantapp'),
    audience: z.string().default('assistantapp-client'),
  }).default({
    secret: 'development_jwt_secret_key_at_least_32_characters_long_for_security',
    expiresIn: '24h',
    issuer: 'assistantapp',
    audience: 'assistantapp-client',
  }),
  
  // OAuth State
  oauthState: z.object({
    secret: z.string().min(32).optional(),
  }).optional(),
});

// External Services
const ServicesSchema = z.object({
  redis: z.object({
    url: z.string().optional(),
    timeout: z.number().positive().default(5000),
  }).optional(),

  openai: z.object({
    apiKey: z.string().optional(),
    timeout: z.number().positive().default(30000),
    maxRetries: z.number().min(0).max(5).default(2),
  }).optional(),

  supabase: z.object({
    url: z.string().optional(),
    serviceRoleKey: z.string().optional(),
    anonKey: z.string().optional(),
  }).optional(),
});

// AI Configuration
const AIConfigSchema = z.object({
  models: z.object({
    general: z.object({
      model: z.string().default('gpt-5-nano'),
      temperature: z.number().min(0).max(2).default(0.3),
      maxTokens: z.number().positive().default(1000),
      timeout: z.number().positive().default(25000),
    }).default({
      model: 'gpt-5-nano',
      temperature: 0.3,
      maxTokens: 1000,
      timeout: 25000,
    }),
    
    routing: z.object({
      model: z.string().default('gpt-5-nano'),
      temperature: z.number().min(0).max(2).default(0.1),
      maxTokens: z.number().positive().default(500),
      timeout: z.number().positive().default(15000),
    }).default({
      model: 'gpt-5-nano',
      temperature: 0.1,
      maxTokens: 500,
      timeout: 15000,
    }),
    
    content: z.object({
      model: z.string().default('gpt-5-mini'),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().positive().default(2000),
      timeout: z.number().positive().default(30000),
    }).default({
      model: 'gpt-5-mini',
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 30000,
    }),
    
    analysis: z.object({
      model: z.string().default('gpt-5-nano'),
      temperature: z.number().min(0).max(2).default(0.0),
      maxTokens: z.number().positive().default(1000),
      timeout: z.number().positive().default(20000),
    }).default({
      model: 'gpt-5-nano',
      temperature: 0.0,
      maxTokens: 1000,
      timeout: 20000,
    }),
  }),
  
  timeouts: z.object({
    toolExecution: z.number().positive().default(30000),
    sessionTimeout: z.number().positive().default(30 * 60 * 1000), // 30 minutes
    gracefulShutdown: z.number().positive().default(10000),
  }).default({
    toolExecution: 30000,
    sessionTimeout: 30 * 60 * 1000,
    gracefulShutdown: 10000,
  }),
});

// Security Configuration
const SecuritySchema = z.object({
  cors: z.object({
    origin: z.string().default('*'),
    credentials: z.boolean().default(true),
  }).default({
    origin: '*',
    credentials: true,
  }),

  rateLimiting: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().positive().default(15 * 60 * 1000), // 15 minutes
    maxRequests: z.number().positive().default(100),
    authWindowMs: z.number().positive().default(15 * 60 * 1000),
    authMaxRequests: z.number().positive().default(10),
  }).default({
    enabled: true,
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    authWindowMs: 15 * 60 * 1000,
    authMaxRequests: 10,
  }),

  requestLimits: z.object({
    jsonBodySize: z.string().default('10mb'),
    urlEncodedBodySize: z.string().default('10mb'),
    maxCommandLength: z.number().positive().default(5000),
  }).default({
    jsonBodySize: '10mb',
    urlEncodedBodySize: '10mb',
    maxCommandLength: 5000,
  }),

  securityHeaders: z.boolean().default(true),
  bcryptRounds: z.number().min(10).max(15).default(12),
}).default({
  cors: { origin: '*', credentials: true },
  rateLimiting: {
    enabled: true,
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    authWindowMs: 15 * 60 * 1000,
    authMaxRequests: 10,
  },
  requestLimits: {
    jsonBodySize: '10mb',
    urlEncodedBodySize: '10mb',
    maxCommandLength: 5000,
  },
  securityHeaders: true,
  bcryptRounds: 12,
});

// Feature Flags Configuration
const FeatureFlagsSchema = z.object({
  // 3-Layer Architecture Migration
  enable3LayerArchitecture: z.boolean().default(false),

  // Percentage of traffic to route to 3-layer (0-100)
  // Only applies if enable3LayerArchitecture is true
  threeLayerTrafficPercent: z.number().min(0).max(100).default(0),
}).default({
  enable3LayerArchitecture: false,
  threeLayerTrafficPercent: 0,
});

// Main configuration schema
const UnifiedConfigSchema = z.object({
  environment: EnvironmentSchema,
  auth: AuthSchema,
  services: ServicesSchema,
  ai: AIConfigSchema,
  security: SecuritySchema,
  featureFlags: FeatureFlagsSchema,
}).default({
  environment: {
    NODE_ENV: 'development',
    PORT: '3000',
    LOG_LEVEL: 'info',
  },
  auth: {
    jwt: {
      secret: 'development_jwt_secret_key_at_least_32_characters_long_for_security',
      expiresIn: '24h',
      issuer: 'assistantapp',
      audience: 'assistantapp-client',
    },
  },
  services: {},
  ai: {
    models: {
      general: {
        model: 'gpt-5-nano',
        temperature: 0.3,
        maxTokens: 1000,
        timeout: 25000,
      },
      routing: {
        model: 'gpt-5-nano',
        temperature: 0.1,
        maxTokens: 500,
        timeout: 15000,
      },
      content: {
        model: 'gpt-5-mini',
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 30000,
      },
      analysis: {
        model: 'gpt-5-nano',
        temperature: 0.0,
        maxTokens: 1000,
        timeout: 20000,
      },
    },
    timeouts: {
      toolExecution: 30000,
      sessionTimeout: 30 * 60 * 1000,
      gracefulShutdown: 10000,
    },
  },
  security: {
    cors: { origin: '*', credentials: true },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      authWindowMs: 15 * 60 * 1000,
      authMaxRequests: 10,
    },
    requestLimits: {
      jsonBodySize: '10mb',
      urlEncodedBodySize: '10mb',
      maxCommandLength: 5000,
    },
    securityHeaders: true,
    bcryptRounds: 12,
  },
  featureFlags: {
    enable3LayerArchitecture: false,
    threeLayerTrafficPercent: 0,
  },
});

// Type definitions
export type UnifiedConfig = z.infer<typeof UnifiedConfigSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;
export type AuthConfig = z.infer<typeof AuthSchema>;
export type ServicesConfig = z.infer<typeof ServicesSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type SecurityConfig = z.infer<typeof SecuritySchema>;
export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsSchema>;

/**
 * Elegant Unified Configuration Service
 * 
 * Features:
 * - Type-safe configuration access
 * - Environment-aware defaults
 * - Runtime validation with detailed errors
 * - Health checking
 * - Hot-reload in development
 */
export class UnifiedConfigService extends BaseService {
  private config: UnifiedConfig;

  constructor() {
    super('UnifiedConfigService');
    this.config = this.loadAndValidateConfig();
    
    this.logConfigurationSummary();
    this.validateProductionRequirements();
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    // Configuration is validated in constructor
    console.log('Configuration validated successfully', {
      environment: this.config.environment.NODE_ENV,
    });
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    console.log('Configuration service destroyed');
  }

  /**
   * Load and validate configuration from environment
   */
  private loadAndValidateConfig(): UnifiedConfig {
    try {
      // Map environment variables to our schema structure
      const envConfig = {
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          LOG_LEVEL: process.env.LOG_LEVEL,
        },
        auth: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            redirectUri: process.env.GOOGLE_REDIRECT_URI,
            webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
          },
          jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES_IN,
            issuer: process.env.JWT_ISSUER,
            audience: process.env.JWT_AUDIENCE,
          },
          oauthState: {
            secret: process.env.OAUTH_STATE_SECRET,
          },
        },
        services: {
          redis: {
            url: process.env.REDIS_URL,
            timeout: process.env.REDIS_TIMEOUT ? parseInt(process.env.REDIS_TIMEOUT) : undefined,
          },
          openai: {
            apiKey: process.env.OPENAI_API_KEY,
            timeout: process.env.OPENAI_TIMEOUT ? parseInt(process.env.OPENAI_TIMEOUT) : undefined,
            maxRetries: process.env.OPENAI_MAX_RETRIES ? parseInt(process.env.OPENAI_MAX_RETRIES) : undefined,
          },
          supabase: {
            url: process.env.SUPABASE_URL,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            anonKey: process.env.SUPABASE_ANON_KEY,
          },
        },
        ai: {
          models: {
            general: {
              model: process.env.AI_GENERAL_MODEL,
              temperature: process.env.AI_GENERAL_TEMPERATURE ? parseFloat(process.env.AI_GENERAL_TEMPERATURE) : undefined,
              maxTokens: process.env.AI_GENERAL_MAX_TOKENS ? parseInt(process.env.AI_GENERAL_MAX_TOKENS) : undefined,
              timeout: process.env.AI_GENERAL_TIMEOUT ? parseInt(process.env.AI_GENERAL_TIMEOUT) : undefined,
            },
            routing: {
              model: process.env.AI_ROUTING_MODEL,
              temperature: process.env.AI_ROUTING_TEMPERATURE ? parseFloat(process.env.AI_ROUTING_TEMPERATURE) : undefined,
              maxTokens: process.env.AI_ROUTING_MAX_TOKENS ? parseInt(process.env.AI_ROUTING_MAX_TOKENS) : undefined,
              timeout: process.env.AI_ROUTING_TIMEOUT ? parseInt(process.env.AI_ROUTING_TIMEOUT) : undefined,
            },
            content: {
              model: process.env.AI_CONTENT_MODEL,
              temperature: process.env.AI_CONTENT_TEMPERATURE ? parseFloat(process.env.AI_CONTENT_TEMPERATURE) : undefined,
              maxTokens: process.env.AI_CONTENT_MAX_TOKENS ? parseInt(process.env.AI_CONTENT_MAX_TOKENS) : undefined,
              timeout: process.env.AI_CONTENT_TIMEOUT ? parseInt(process.env.AI_CONTENT_TIMEOUT) : undefined,
            },
            analysis: {
              model: process.env.AI_ANALYSIS_MODEL,
              temperature: process.env.AI_ANALYSIS_TEMPERATURE ? parseFloat(process.env.AI_ANALYSIS_TEMPERATURE) : undefined,
              maxTokens: process.env.AI_ANALYSIS_MAX_TOKENS ? parseInt(process.env.AI_ANALYSIS_MAX_TOKENS) : undefined,
              timeout: process.env.AI_ANALYSIS_TIMEOUT ? parseInt(process.env.AI_ANALYSIS_TIMEOUT) : undefined,
            },
          },
          timeouts: {
            toolExecution: process.env.AI_TOOL_EXECUTION_TIMEOUT ? parseInt(process.env.AI_TOOL_EXECUTION_TIMEOUT) : undefined,
            sessionTimeout: process.env.AI_SESSION_TIMEOUT ? parseInt(process.env.AI_SESSION_TIMEOUT) : undefined,
            gracefulShutdown: process.env.AI_GRACEFUL_SHUTDOWN_TIMEOUT ? parseInt(process.env.AI_GRACEFUL_SHUTDOWN_TIMEOUT) : undefined,
          },
        },
        security: {
          cors: {
            origin: process.env.SECURITY_CORS_ORIGIN,
            credentials: process.env.SECURITY_CORS_CREDENTIALS === 'true',
          },
          rateLimiting: {
            enabled: process.env.SECURITY_RATE_LIMITING_ENABLED !== 'false',
            windowMs: process.env.SECURITY_RATE_LIMITING_WINDOW_MS ? parseInt(process.env.SECURITY_RATE_LIMITING_WINDOW_MS) : undefined,
            maxRequests: process.env.SECURITY_RATE_LIMITING_MAX_REQUESTS ? parseInt(process.env.SECURITY_RATE_LIMITING_MAX_REQUESTS) : undefined,
            authWindowMs: process.env.SECURITY_RATE_LIMITING_AUTH_WINDOW_MS ? parseInt(process.env.SECURITY_RATE_LIMITING_AUTH_WINDOW_MS) : undefined,
            authMaxRequests: process.env.SECURITY_RATE_LIMITING_AUTH_MAX_REQUESTS ? parseInt(process.env.SECURITY_RATE_LIMITING_AUTH_MAX_REQUESTS) : undefined,
          },
          requestLimits: {
            jsonBodySize: process.env.SECURITY_REQUEST_LIMITS_JSON_BODY_SIZE,
            maxCommandLength: process.env.SECURITY_REQUEST_LIMITS_MAX_COMMAND_LENGTH ? parseInt(process.env.SECURITY_REQUEST_LIMITS_MAX_COMMAND_LENGTH) : undefined,
            urlEncodedBodySize: process.env.SECURITY_REQUEST_LIMITS_URL_ENCODED_BODY_SIZE,
          },
          securityHeaders: process.env.SECURITY_SECURITY_HEADERS !== 'false',
          bcryptRounds: process.env.SECURITY_BCRYPT_ROUNDS ? parseInt(process.env.SECURITY_BCRYPT_ROUNDS) : undefined,
        },
        // Feature flags removed - 3-layer architecture is now the default
      };

      const result = UnifiedConfigSchema.parse(envConfig);
      // Configuration loaded successfully - using console to avoid circular dependency
      return result;

    } catch (error) {
      const message = 'Configuration validation failed';
      // Use console.error to avoid circular dependency with logger
      console.error(message, error);
      throw error;
    }
  }

  /**
   * Validate production requirements
   */
  private validateProductionRequirements(): void {
    if (!this.isProduction) return;

    const issues: string[] = [];

    // Check required secrets
    if (!this.config.auth.jwt.secret || this.config.auth.jwt.secret.length < 32) {
      issues.push('JWT_SECRET must be at least 32 characters in production');
    }

    if (!this.config.services.openai?.apiKey) {
      issues.push('OPENAI_API_KEY is required in production');
    }

    if (!this.config.auth.google?.clientId || !this.config.auth.google?.clientSecret) {
      issues.push('Google OAuth credentials required in production');
    }

    if (issues.length > 0) {
      const error = new Error(`Production configuration issues: ${issues.join(', ')}`);
      console.error('Production configuration validation failed', error, issues);
      throw error;
    }

    console.log('Production configuration validated');
  }

  /**
   * Log configuration summary (sanitized)
   */
  private logConfigurationSummary(): void {
    const summary = {
      environment: this.config.environment.NODE_ENV,
      port: this.config.environment.PORT,
      hasGoogleAuth: !!(this.config.auth.google?.clientId && this.config.auth.google?.clientSecret),
      hasOpenAI: !!this.config.services.openai?.apiKey,
      hasRedis: !!this.config.services.redis?.url,
      aiModels: Object.keys(this.config.ai.models),
      rateLimiting: this.config.security.rateLimiting.enabled,
      corsEnabled: this.config.security.cors.origin !== '*',
    };

    console.log('Configuration loaded', summary);
  }

  /**
   * Get entire configuration
   */
  get all(): UnifiedConfig {
    return this.config;
  }

  /**
   * Get environment configuration
   */
  get environment(): EnvironmentConfig {
    return this.config.environment;
  }

  /**
   * Get authentication configuration
   */
  get auth(): AuthConfig {
    return this.config.auth;
  }

  /**
   * Get services configuration
   */
  get services(): ServicesConfig {
    return this.config.services;
  }

  /**
   * Get AI configuration
   */
  get ai(): AIConfig {
    return this.config.ai;
  }

  /**
   * Get security configuration
   */
  get security(): SecurityConfig {
    return this.config.security;
  }

  /**
   * Convenience getters for common configs
   */
  get isProduction(): boolean {
    return this.config.environment.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.config.environment.NODE_ENV === 'development';
  }

  get isTest(): boolean {
    return this.config.environment.NODE_ENV === 'test';
  }

  get port(): number {
    return this.config.environment.PORT;
  }

  get logLevel(): string {
    return this.config.environment.LOG_LEVEL;
  }

  get nodeEnv(): string {
    return this.config.environment.NODE_ENV;
  }

  get jwtSecret(): string {
    return this.config.auth.jwt.secret;
  }

  get openaiApiKey(): string | undefined {
    return this.config.services.openai?.apiKey;
  }

  get googleAuth(): AuthConfig['google'] {
    return this.config.auth.google;
  }

  get redisUrl(): string | undefined {
    return this.config.services.redis?.url;
  }

  get supabaseUrl(): string | undefined {
    return this.config.services.supabase?.url;
  }

  get supabaseServiceRoleKey(): string | undefined {
    return this.config.services.supabase?.serviceRoleKey;
  }

  get supabaseAnonKey(): string | undefined {
    return this.config.services.supabase?.anonKey;
  }

  /**
   * Get AI model configuration by name
   */
  getAIModelConfig(modelName: keyof AIConfig['models']) {
    return this.config.ai.models[modelName];
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: string): boolean {
    const flag = process.env[`ENABLE_${feature.toUpperCase()}`];
    return flag === 'true' || flag === '1';
  }

  /**
   * Health check for configuration
   */
  getHealth() {
    const issues: string[] = [];
    
    if (this.isProduction) {
      if (!this.jwtSecret || this.jwtSecret.length < 32) issues.push('JWT_SECRET insecure');
      if (!this.openaiApiKey) issues.push('OpenAI API key missing');
      if (!this.googleAuth?.clientId) issues.push('Google OAuth missing');
    }

    return {
      healthy: issues.length === 0,
      details: {
        environment: this.nodeEnv,
        port: this.port,
        features: {
          googleAuth: !!this.googleAuth?.clientId,
          openai: !!this.openaiApiKey,
          redis: !!this.redisUrl,
        },
        issues,
      },
    };
  }

  /**
   * Reload configuration (development only)
   */
  reload(): void {
    if (this.isProduction) {
      console.warn('Configuration reload prevented in production');
      return;
    }

    console.log('Reloading configuration');

    try {
      this.config = this.loadAndValidateConfig();
      this.validateProductionRequirements();
      console.log('Configuration reloaded successfully');
    } catch (error) {
      console.error('Configuration reload failed', error);
      throw error;
    }
  }
}

// Export singleton instances for easy access
// Config service is a special case - it has no dependencies and is needed everywhere
// eslint-disable-next-line custom-rules/enforce-dependency-injection
export const config = new UnifiedConfigService();
export const unifiedConfig = config;
