/**
 * Validation Helpers
 * Reusable validation schemas and utilities for common patterns
 */

import { z } from 'zod';
import { ErrorFactory } from '../errors/error-factory';
import { createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// Common Field Validators
// ============================================================================

export const CommonValidators = {
  /**
   * User ID validation
   */
  userId: z.string().min(1, 'User ID is required').max(255, 'User ID too long'),

  /**
   * OAuth code validation
   */
  oauthCode: z.string().min(1, 'OAuth code is required'),

  /**
   * OAuth state validation
   */
  oauthState: z.string().min(1, 'OAuth state is required'),

  /**
   * JWT token validation
   */
  jwtToken: z.string().min(1, 'JWT token is required'),

  /**
   * Email validation
   */
  email: z.string().email('Invalid email format'),

  /**
   * URL validation
   */
  url: z.string().url('Invalid URL format'),

  /**
   * Optional string field
   */
  optionalString: z.string().optional(),

  /**
   * Non-empty optional string
   */
  optionalNonEmptyString: z.string().min(1).optional(),
};

// ============================================================================
// OAuth Request Schemas
// ============================================================================

/**
 * Google OAuth callback query parameters
 */
export const GoogleOAuthCallbackQuerySchema = z.object({
  code: CommonValidators.oauthCode.optional(),
  state: CommonValidators.oauthState.optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  scope: z.string().optional(),
}).refine(
  data => data.code || data.error,
  { message: 'Either code or error must be present' },
);

/**
 * OAuth initiation query parameters
 */
export const OAuthInitQuerySchema = z.object({
  return_url: CommonValidators.url.optional(),
});

// ============================================================================
// Token Management Schemas
// ============================================================================

/**
 * Token refresh request body
 */
export const TokenRefreshRequestSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
  user_id: CommonValidators.userId.optional(),
});

/**
 * Token revocation request body
 */
export const TokenRevocationRequestSchema = z.object({
  user_id: CommonValidators.userId,
  provider: z.enum(['google'], { message: 'Provider must be google' }),
});

/**
 * Mobile token exchange request body
 */
export const MobileTokenExchangeSchema = z.object({
  auth_code: CommonValidators.oauthCode,
  user_id: CommonValidators.userId,
  platform: z.enum(['ios', 'android'], { message: 'Platform must be ios or android' }),
});

// ============================================================================
// Debug and Testing Schemas
// ============================================================================

/**
 * Debug query parameters (allows any string fields)
 */
export const DebugQuerySchema = z.object({
  user_id: z.string().optional(),
  team_id: z.string().optional(),
  channel_id: z.string().optional(),
  code: z.string().optional(),
  token: z.string().optional(),
  client_id: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  response_type: z.string().optional(),
  access_type: z.string().optional(),
  prompt: z.string().optional(),
  error: z.string().optional(),
  return_url: z.string().optional(),
});

/**
 * Empty schemas for endpoints that don't expect data
 */
export const EmptyQuerySchema = z.object({});
export const EmptyBodySchema = z.object({});

// ============================================================================
// Validation Utilities
// ============================================================================

export class ValidationUtils {
  /**
   * Validate and parse OAuth state parameter
   */
  static parseOAuthState(state: string): { source?: string; user_id?: string; team_id?: string; channel_id?: string; timestamp?: number } {
    try {
      const parsed = JSON.parse(state);

      // Basic schema for state parameter
      const StateSchema = z.object({
        source: z.string().optional(),
        user_id: z.string().optional(),
        team_id: z.string().optional(),
        channel_id: z.string().optional(),
        timestamp: z.number().optional(),
      });

      const validated = StateSchema.parse(parsed);

      // Check if state is not too old (30 minutes)
      if (validated.timestamp && Date.now() - validated.timestamp > 30 * 60 * 1000) {
        throw ErrorFactory.api.badRequest('OAuth state expired');
      }

      return validated;
    } catch {
      throw ErrorFactory.api.badRequest('Invalid or expired OAuth state parameter');
    }
  }

  /**
   * Create OAuth state parameter
   */
  static createOAuthState(data: {
    source?: string;
    user_id?: string;
    team_id?: string;
    channel_id?: string;
    [key: string]: unknown;
  }): string {
    return JSON.stringify({
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Sanitize user input for logging
   */
  static sanitizeForLogging(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized: Record<string, unknown> = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    for (const [key, value] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = ValidationUtils.sanitizeForLogging(value);
      }
    }

    return sanitized;
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type GoogleOAuthCallbackQuery = z.infer<typeof GoogleOAuthCallbackQuerySchema>;
export type OAuthInitQuery = z.infer<typeof OAuthInitQuerySchema>;
export type TokenRefreshRequest = z.infer<typeof TokenRefreshRequestSchema>;
export type TokenRevocationRequest = z.infer<typeof TokenRevocationRequestSchema>;
export type MobileTokenExchange = z.infer<typeof MobileTokenExchangeSchema>;
export type DebugQuery = z.infer<typeof DebugQuerySchema>;