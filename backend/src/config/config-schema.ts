import { z } from 'zod';

/**
 * Configuration schema with Zod validation
 * Provides:
 * - Runtime validation
 * - Type inference
 * - Default values
 * - Environment variable mapping
 */

const EnvironmentSchema = z.enum(['development', 'staging', 'production', 'test']);

const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

export const ServiceConfigSchema = z.object({
  // Environment
  env: EnvironmentSchema.default('development'),

  // API Client Configuration
  apiClient: z.object({
    timeout: z.number().int().min(1000).max(300000).default(30000),
    retry: z.object({
      maxAttempts: z.number().int().min(1).max(10).default(3),
      baseDelay: z.number().int().min(100).max(10000).default(1000),
      maxDelay: z.number().int().min(1000).max(60000).default(10000),
      backoffMultiplier: z.number().min(1).max(10).default(2),
      jitter: z.boolean().default(true),
    }).default({}),
    circuitBreaker: z.object({
      failureThreshold: z.number().int().min(1).max(100).default(5),
      recoveryTimeout: z.number().int().min(1000).max(300000).default(60000),
      successThreshold: z.number().int().min(1).max(10).default(3),
      timeout: z.number().int().min(1000).max(300000).default(30000),
    }).default({}),
  }).default({}),

  // Logging Configuration
  logging: z.object({
    level: LogLevelSchema.default('info'),
    maxBodyLength: z.number().int().min(1000).max(100000).default(10000),
    sensitiveFields: z.array(z.string()).default([
      'password',
      'token',
      'authorization',
      'cookie',
      'access_token',
      'refresh_token',
      'api_key',
      'secret',
    ]),
    enableRequestLogging: z.boolean().default(true),
    enableResponseLogging: z.boolean().default(true),
    enableSlowQueryLogging: z.boolean().default(true),
    slowQueryThreshold: z.number().int().min(100).max(60000).default(5000),
  }).default({}),

  // Rate Limiting Configuration
  rateLimiting: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().int().min(1000).max(3600000).default(60000),
    maxRequests: z.number().int().min(1).max(10000).default(100),
    skipSuccessfulRequests: z.boolean().default(false),
    skipFailedRequests: z.boolean().default(false),
  }).default({}),

  // Cache Configuration
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().int().min(1).max(86400).default(300), // 5 minutes default
    maxSize: z.number().int().min(100).max(1000000).default(1000),
  }).default({}),

  // Email Service Configuration
  email: z.object({
    batchSize: z.number().int().min(1).max(100).default(50),
    maxSearchResults: z.number().int().min(1).max(500).default(100),
    enableDataLoader: z.boolean().default(true),
  }).default({}),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
