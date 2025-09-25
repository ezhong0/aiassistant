import { z } from 'zod';
import { BaseService } from '../services/base-service';

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  
  // Google OAuth (optional in development)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_WEB_CLIENT_ID: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security').default('development_jwt_secret_key_at_least_32_characters_long_for_security'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_ISSUER: z.string().default('assistantapp'),
  JWT_AUDIENCE: z.string().default('assistantapp-client'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
  
  // Security
  BCRYPT_SALT_ROUNDS: z.string().regex(/^\d+$/).transform(Number).default('12'),
  
  // Database (for future use)
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export class ConfigService extends BaseService {
  private config: Config;
  
  constructor() {
    super('ConfigService');
    this.config = this.loadAndValidateConfig();
    this.logConfigSummary();
  }
  
  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Configuration is already loaded in constructor
    // No additional initialization needed
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    // No cleanup needed for configuration
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const healthy = this.isReady();
    return {
      healthy,
      details: {
        nodeEnv: this.config.NODE_ENV,
        port: this.config.PORT,
        logLevel: this.config.LOG_LEVEL,
        // Never include sensitive values in health checks
        googleClientIdSet: !!this.config.GOOGLE_CLIENT_ID,
        googleClientSecretSet: !!this.config.GOOGLE_CLIENT_SECRET,
        jwtSecretSet: !!this.config.JWT_SECRET,
      }
    };
  }
  
  private loadAndValidateConfig(): Config {
    try {
      const result = envSchema.safeParse(process.env);
      
      if (!result.success) {
        const errors = result.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');
        
        throw new Error(`Configuration validation failed:\n${errors}`);
      }
      
      return result.data;
    } catch (error) {
      
      throw error;
    }
  }
  
  private logConfigSummary(): void {
  }
  
  // Getter methods for type-safe access
  get nodeEnv(): string { return this.config.NODE_ENV; }
  get port(): number { return this.config.PORT; }
  get isDevelopment(): boolean { return this.config.NODE_ENV === 'development'; }
  get isProduction(): boolean { return this.config.NODE_ENV === 'production'; }
  get isTest(): boolean { return this.config.NODE_ENV === 'test'; }
  
  // Google OAuth
  get googleClientId(): string | undefined { return this.config.GOOGLE_CLIENT_ID; }
  get googleClientSecret(): string | undefined { return this.config.GOOGLE_CLIENT_SECRET; }
  get googleRedirectUri(): string | undefined { return this.config.GOOGLE_REDIRECT_URI; }
  get googleWebClientId(): string | undefined { return this.config.GOOGLE_WEB_CLIENT_ID; }
  
  // JWT
  get jwtSecret(): string { return this.config.JWT_SECRET; }
  get jwtExpiresIn(): string { return this.config.JWT_EXPIRES_IN; }
  get jwtIssuer(): string { return this.config.JWT_ISSUER; }
  get jwtAudience(): string { return this.config.JWT_AUDIENCE; }
  
  // Logging
  get logLevel(): string { return this.config.LOG_LEVEL; }
  get logFilePath(): string { return this.config.LOG_FILE_PATH; }
  
  // CORS
  get corsOrigin(): string { return this.config.CORS_ORIGIN; }
  
  // Rate Limiting
  get rateLimitWindowMs(): number { return this.config.RATE_LIMIT_WINDOW_MS; }
  get rateLimitMaxRequests(): number { return this.config.RATE_LIMIT_MAX_REQUESTS; }
  
  // Security
  get bcryptSaltRounds(): number { return this.config.BCRYPT_SALT_ROUNDS; }
  
  // Database
  get databaseUrl(): string | undefined { return this.config.DATABASE_URL; }
  get redisUrl(): string | undefined { return this.config.REDIS_URL; }
  
  // Get full config object (use with caution)
  getConfig(): Config {
    return { ...this.config };
  }
}

// ConfigService is now managed by the service manager
// Use getService('configService') to access it