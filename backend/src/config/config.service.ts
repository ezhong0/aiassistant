import { z } from 'zod';
import logger from '../utils/logger';

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default(() => 3000),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url('GOOGLE_REDIRECT_URI must be a valid URL'),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_ISSUER: z.string().default('assistantapp'),
  JWT_AUDIENCE: z.string().default('assistantapp-client'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default(() => 900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default(() => 100),
  
  // Security
  BCRYPT_SALT_ROUNDS: z.string().regex(/^\d+$/).transform(Number).default(() => 12),
  
  // Database (for future use)
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

class ConfigService {
  private config: Config;
  
  constructor() {
    this.config = this.loadAndValidateConfig();
    this.logConfigSummary();
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
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }
  
  private logConfigSummary(): void {
    logger.info('Configuration loaded successfully', {
      nodeEnv: this.config.NODE_ENV,
      port: this.config.PORT,
      logLevel: this.config.LOG_LEVEL,
      jwtIssuer: this.config.JWT_ISSUER,
      corsOrigin: this.config.CORS_ORIGIN,
      // Never log sensitive values
      googleClientIdSet: !!this.config.GOOGLE_CLIENT_ID,
      googleClientSecretSet: !!this.config.GOOGLE_CLIENT_SECRET,
      jwtSecretSet: !!this.config.JWT_SECRET,
    });
  }
  
  // Getter methods for type-safe access
  get nodeEnv(): string { return this.config.NODE_ENV; }
  get port(): number { return this.config.PORT; }
  get isDevelopment(): boolean { return this.config.NODE_ENV === 'development'; }
  get isProduction(): boolean { return this.config.NODE_ENV === 'production'; }
  get isTest(): boolean { return this.config.NODE_ENV === 'test'; }
  
  // Google OAuth
  get googleClientId(): string { return this.config.GOOGLE_CLIENT_ID; }
  get googleClientSecret(): string { return this.config.GOOGLE_CLIENT_SECRET; }
  get googleRedirectUri(): string { return this.config.GOOGLE_REDIRECT_URI; }
  get googleIosClientId(): string | undefined { return this.config.GOOGLE_IOS_CLIENT_ID; }
  
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
  
  // Utility methods
  getAll(): Config {
    return { ...this.config };
  }
  
  validate(): void {
    // Additional runtime validation can be added here
    if (this.isProduction && this.config.JWT_SECRET.length < 64) {
      throw new Error('JWT_SECRET must be at least 64 characters in production');
    }
    
    if (this.isProduction && this.config.CORS_ORIGIN === '*') {
      logger.warn('CORS origin is set to "*" in production. Consider restricting it.');
    }
  }
}

// Export singleton instance
export const configService = new ConfigService();
export default configService;