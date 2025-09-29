/**
 * Base Domain Service Interface
 * Core interface that all domain services must implement
 */

import { SlackContext } from '../../../types/slack/slack.types';

/**
 * Health status information
 */
export interface HealthStatus {
  healthy: boolean;
  details?: Record<string, unknown>;
}

/**
 * OAuth initialization result
 */
export interface OAuthResult {
  authUrl: string;
  state: string;
}

/**
 * OAuth token data
 */
export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
}

/**
 * Base domain service interface
 * All domain services extend this interface
 */
export interface IDomainService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Destroy the service and clean up resources
   */
  destroy(): Promise<void>;

  /**
   * Get health status of the service
   */
  getHealth(): HealthStatus;
}

/**
 * OAuth-enabled domain service interface
 * For services that require OAuth authentication
 */
export interface IOAuthEnabledDomainService extends IDomainService {
  /**
   * Initialize OAuth flow for a user
   */
  initializeOAuth(userId: string, context: SlackContext): Promise<OAuthResult>;

  /**
   * Complete OAuth flow with authorization code
   */
  completeOAuth(userId: string, code: string, state: string): Promise<void>;

  /**
   * Refresh OAuth tokens for a user
   */
  refreshTokens(userId: string): Promise<void>;

  /**
   * Revoke OAuth tokens for a user
   */
  revokeTokens(userId: string): Promise<void>;

  /**
   * Check if user requires OAuth authentication
   */
  requiresOAuth(userId: string): Promise<boolean>;
}