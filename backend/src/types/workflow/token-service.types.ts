/**
 * Token Service types for the new simplified token management architecture
 *
 * This represents the interface that subagents will use to retrieve tokens,
 * implementing the hybrid approach where the central service manages tokens
 * but subagents are responsible for calling the service when needed.
 */

/**
 * Supported service types for token management
 */
export enum TokenServiceType {
  GOOGLE = 'google',
  SLACK = 'slack',
  MICROSOFT = 'microsoft'
}

/**
 * Access token with metadata
 */
export interface AccessToken {
  token: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
}

/**
 * Token error types
 */
export enum TokenErrorType {
  TOKEN_NOT_FOUND = 'token_not_found',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  REFRESH_FAILED = 'refresh_failed',
  INSUFFICIENT_SCOPE = 'insufficient_scope',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  AUTHENTICATION_REQUIRED = 'authentication_required'
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  reason?: TokenErrorType;
  expiresIn?: number; // seconds until expiration
  scopes?: string[];
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  accessToken?: AccessToken;
  error?: TokenErrorType;
  message?: string;
}

/**
 * Token service context for operations
 */
export interface TokenContext {
  userId: string;
  sessionId?: string;
  service: TokenServiceType;
  requiredScopes?: string[];
  correlationId?: string;
}

/**
 * Authentication error for token operations
 */
export class TokenAuthenticationError extends Error {
  constructor(
    public readonly errorType: TokenErrorType,
    message: string,
    public readonly context?: TokenContext
  ) {
    super(message);
    this.name = 'TokenAuthenticationError';
  }
}

/**
 * Token service interface for subagents
 *
 * This is the simplified interface that subagents will use.
 * The implementation bridges to the existing TokenManager.
 */
export interface TokenService {
  /**
   * Get a valid access token for a service
   * Automatically handles token refresh if needed
   */
  getAccessToken(context: TokenContext): Promise<AccessToken | null>;

  /**
   * Check if a token is valid without refreshing
   */
  isTokenValid(context: TokenContext): Promise<TokenValidationResult>;

  /**
   * Force refresh a token
   */
  refreshToken(context: TokenContext): Promise<TokenRefreshResult>;

  /**
   * Revoke/invalidate a token
   */
  revokeToken(context: TokenContext): Promise<void>;

  /**
   * Check if user needs to re-authenticate for a service
   */
  requiresAuthentication(context: TokenContext): Promise<boolean>;
}