/**
 * OAuth-related types
 *
 * Common types used across OAuth flows
 */

/**
 * Context information for OAuth initialization
 */
export interface OAuthContext {
  userId: string;
  teamId?: string;
  channelId?: string;
  [key: string]: unknown;
}
