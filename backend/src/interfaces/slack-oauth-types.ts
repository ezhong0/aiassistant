/**
 * Slack OAuth Types and Definitions
 * Focused type definitions for Slack OAuth handling
 */

/**
 * Slack OAuth configuration
 */
export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
}

/**
 * Slack OAuth token data
 */
export interface SlackOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  teamId: string;
  userId: string;
}

/**
 * Slack OAuth authorization result
 */
export interface SlackOAuthAuthorizationResult {
  success: boolean;
  authorizationUrl?: string;
  error?: string;
  state?: string;
}

/**
 * Slack OAuth token exchange result
 */
export interface SlackOAuthTokenExchangeResult {
  success: boolean;
  tokens?: SlackOAuthTokens;
  error?: string;
  needsReauth?: boolean;
}

/**
 * Slack OAuth validation result
 */
export interface SlackOAuthValidationResult {
  isValid: boolean;
  hasValidTokens: boolean;
  needsRefresh: boolean;
  needsReauth: boolean;
  error?: string;
  tokens?: SlackOAuthTokens;
}

/**
 * Slack OAuth requirement detection result
 */
export interface SlackOAuthRequirementResult {
  requiresOAuth: boolean;
  oauthType: 'email_send' | 'email_read' | 'calendar_access' | 'contact_access' | 'calendar_create' | 'calendar_read' | 'none';
  confidence: number;
  reasoning: string;
}

/**
 * Slack OAuth URL generation parameters
 */
export interface SlackOAuthUrlParams {
  teamId: string;
  userId: string;
  returnUrl?: string;
  state?: string;
}

/**
 * Slack OAuth success message data
 */
export interface SlackOAuthSuccessMessageData {
  teamId: string;
  userId: string;
  channelId: string;
  tokens: SlackOAuthTokens;
  messageKey: string;
}
