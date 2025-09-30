/**
 * Validation Helpers
 * Reusable validation schemas and utilities for common patterns
 */

import { z } from 'zod';
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
   * Slack team ID validation
   */
  slackTeamId: z.string().regex(/^T[A-Z0-9]{8,10}$/, 'Invalid Slack team ID format'),

  /**
   * Slack user ID validation
   */
  slackUserId: z.string().regex(/^U[A-Z0-9]{8,10}$/, 'Invalid Slack user ID format'),

  /**
   * Slack channel ID validation
   */
  slackChannelId: z.string().regex(/^[CDG][A-Z0-9]{8,10}$/, 'Invalid Slack channel ID format'),

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
  { message: 'Either code or error must be present' }
);

/**
 * Slack OAuth callback query parameters
 */
export const SlackOAuthCallbackQuerySchema = z.object({
  code: CommonValidators.oauthCode.optional(),
  state: CommonValidators.oauthState.optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
}).refine(
  data => data.code || data.error,
  { message: 'Either code or error must be present' }
);

/**
 * OAuth initiation query parameters
 */
export const OAuthInitQuerySchema = z.object({
  user_id: CommonValidators.slackUserId.optional(),
  team_id: CommonValidators.slackTeamId.optional(),
  channel_id: CommonValidators.slackChannelId.optional(),
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
  provider: z.enum(['google', 'slack'], { message: 'Provider must be google or slack' }),
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
        throw new Error('OAuth state expired');
      }

      return validated;
    } catch {
      throw new Error('Invalid or expired OAuth state parameter');
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
    [key: string]: any;
  }): string {
    return JSON.stringify({
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Validate Slack event signature
   */
  static validateSlackSignature(signature: string, timestamp: string, body: string, secret: string): boolean {

    // Check timestamp is within 5 minutes
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      return false;
    }

    // Create expected signature
    const sigBasestring = `v0:${timestamp}:${body}`;
    const expectedSignature = `v0=${createHmac('sha256', secret)
      .update(sigBasestring)
      .digest('hex')}`;

    // Compare signatures
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Sanitize user input for logging
   */
  static sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
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
export type SlackOAuthCallbackQuery = z.infer<typeof SlackOAuthCallbackQuerySchema>;
export type OAuthInitQuery = z.infer<typeof OAuthInitQuerySchema>;
export type TokenRefreshRequest = z.infer<typeof TokenRefreshRequestSchema>;
export type TokenRevocationRequest = z.infer<typeof TokenRevocationRequestSchema>;
export type MobileTokenExchange = z.infer<typeof MobileTokenExchangeSchema>;
export type DebugQuery = z.infer<typeof DebugQuerySchema>;