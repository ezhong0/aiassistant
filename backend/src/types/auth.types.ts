/**
 * OAuth Token Types
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  expiry_date?: number;
}

export interface TokenRefreshRequest {
  refresh_token: string;
}

export interface TokenRefreshResponse {
  success: boolean;
  tokens: GoogleTokens;
  jwt: string;
}

/**
 * User Data Types
 */

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  locale?: string;
  hd?: string; // Hosted domain for G Suite users
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
  locale?: string;
  verifiedEmail?: boolean;
}

export interface JWTPayload {
  sub: string;
  email: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * Authentication Response Types
 */

export interface AuthSuccessResponse {
  success: true;
  user: GoogleUserInfo;
  tokens: GoogleTokens;
  jwt: string;
}

export interface AuthErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: any;
}

export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

/**
 * Token Validation Types
 */

export interface TokenValidationResult {
  valid: boolean;
  userInfo?: GoogleUserInfo;
  error?: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * OAuth Flow Types
 */

export interface OAuthState {
  state: string;
  timestamp: number;
  returnUrl?: string;
}

export interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export interface OAuthInitiationResponse {
  authUrl: string;
  state: string;
}

/**
 * Error Types
 */

export enum AuthErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  USER_INFO_FAILED = 'USER_INFO_FAILED',
  INVALID_GRANT = 'INVALID_GRANT',
  ACCESS_DENIED = 'ACCESS_DENIED',
  REDIRECT_URI_MISMATCH = 'REDIRECT_URI_MISMATCH',
  INVALID_CLIENT = 'INVALID_CLIENT',
  RATE_LIMITED = 'RATE_LIMITED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS'
}

export interface AuthError extends Error {
  code: AuthErrorCode;
  statusCode: number;
  details?: any;
  isOperational: boolean;
}

/**
 * Middleware Types
 */

export interface AuthMiddlewareOptions {
  optional?: boolean;
  permissions?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * Service Configuration Types
 */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface JWTConfig {
  secret: string;
  expiresIn: string | number;
  issuer?: string;
  audience?: string;
}

export interface AuthServiceConfig {
  oauth: OAuthConfig;
  jwt: JWTConfig;
}

/**
 * Logout Types
 */

export interface LogoutRequest {
  access_token?: string;
  everywhere?: boolean; // Logout from all devices
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * Session Types
 */

export interface UserSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActiveAt: Date;
  deviceInfo?: {
    userAgent: string;
    ip: string;
    platform?: string;
  };
}

/**
 * Permission Types
 */

export enum Permission {
  READ_PROFILE = 'READ_PROFILE',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  READ_CALENDAR = 'READ_CALENDAR',
  WRITE_CALENDAR = 'WRITE_CALENDAR',
  READ_EMAIL = 'READ_EMAIL',
  SEND_EMAIL = 'SEND_EMAIL',
  ADMIN_ACCESS = 'ADMIN_ACCESS'
}

export interface UserPermissions {
  userId: string;
  permissions: Permission[];
  roles: string[];
}

/**
 * API Response Types
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Audit Log Types
 */

export interface AuthAuditLog {
  id: string;
  userId?: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE';
  ip: string;
  userAgent: string;
  timestamp: Date;
  details?: any;
}

/**
 * Rate Limiting Types
 */

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitResponse extends ApiErrorResponse {
  rateLimit: RateLimitInfo;
}

/**
 * Type Guards
 */

export const isAuthSuccessResponse = (response: AuthResponse): response is AuthSuccessResponse => {
  return response.success === true;
}

export const isAuthErrorResponse = (response: AuthResponse): response is AuthErrorResponse => {
  return response.success === false;
}

export const isAuthError = (error: any): error is AuthError => {
  return error instanceof Error && 'code' in error && 'statusCode' in error;
}

export const isApiSuccessResponse = <T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> => {
  return response.success === true;
}

export const isApiErrorResponse = <T>(response: ApiResponse<T>): response is ApiErrorResponse => {
  return response.success === false;
}