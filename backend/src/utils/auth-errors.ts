import { AuthError, AuthErrorCode } from '../types/auth.types';
import logger from './logger';
import { setTimeout as delay } from 'timers/promises';

/**
 * Custom Authentication Error Class
 */
export class AuthenticationError extends Error implements AuthError {
  public readonly code: AuthErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean = true;

  constructor(
    code: AuthErrorCode,
    message: string,
    statusCode: number = 401,
    details?: any
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AuthenticationError);
  }
}

/**
 * Factory functions for common authentication errors
 */
export const AuthErrors = {
  invalidToken: (details?: any) => new AuthenticationError(
    AuthErrorCode.INVALID_TOKEN,
    'The provided token is invalid',
    401,
    details
  ),

  expiredToken: (details?: any) => new AuthenticationError(
    AuthErrorCode.EXPIRED_TOKEN,
    'The token has expired',
    401,
    details
  ),

  missingToken: (details?: any) => new AuthenticationError(
    AuthErrorCode.MISSING_TOKEN,
    'Authentication token is required',
    401,
    details
  ),

  invalidCredentials: (details?: any) => new AuthenticationError(
    AuthErrorCode.INVALID_CREDENTIALS,
    'Invalid credentials provided',
    401,
    details
  ),

  tokenExchangeFailed: (originalError?: Error) => new AuthenticationError(
    AuthErrorCode.TOKEN_EXCHANGE_FAILED,
    'Failed to exchange authorization code for tokens',
    400,
    { originalError: originalError?.message }
  ),

  tokenRefreshFailed: (originalError?: Error) => new AuthenticationError(
    AuthErrorCode.TOKEN_REFRESH_FAILED,
    'Failed to refresh access token',
    400,
    { originalError: originalError?.message }
  ),

  userInfoFailed: (originalError?: Error) => new AuthenticationError(
    AuthErrorCode.USER_INFO_FAILED,
    'Failed to retrieve user information',
    500,
    { originalError: originalError?.message }
  ),

  invalidGrant: (details?: any) => new AuthenticationError(
    AuthErrorCode.INVALID_GRANT,
    'The provided authorization grant is invalid, expired, or revoked',
    400,
    details
  ),

  accessDenied: (details?: any) => new AuthenticationError(
    AuthErrorCode.ACCESS_DENIED,
    'Access was denied by the user or authorization server',
    403,
    details
  ),

  redirectUriMismatch: (details?: any) => new AuthenticationError(
    AuthErrorCode.REDIRECT_URI_MISMATCH,
    'The redirect URI provided does not match the registered URI',
    400,
    details
  ),

  invalidClient: (details?: any) => new AuthenticationError(
    AuthErrorCode.INVALID_CLIENT,
    'Invalid client credentials',
    401,
    details
  ),

  rateLimited: (retryAfter?: number) => new AuthenticationError(
    AuthErrorCode.RATE_LIMITED,
    'Too many requests. Please try again later.',
    429,
    { retryAfter }
  ),

  insufficientPermissions: (requiredPermissions?: string[]) => new AuthenticationError(
    AuthErrorCode.INSUFFICIENT_PERMISSIONS,
    'Insufficient permissions to access this resource',
    403,
    { requiredPermissions }
  )
};

/**
 * Error mapper for Google OAuth errors
 */
export const mapGoogleOAuthError = (error: any): AuthenticationError => {
  const errorString = error?.message || error?.toString() || '';
  
  // Common Google OAuth error patterns
  if (errorString.includes('invalid_grant')) {
    return AuthErrors.invalidGrant(error);
  }
  
  if (errorString.includes('access_denied')) {
    return AuthErrors.accessDenied(error);
  }
  
  if (errorString.includes('redirect_uri_mismatch')) {
    return AuthErrors.redirectUriMismatch(error);
  }
  
  if (errorString.includes('invalid_client')) {
    return AuthErrors.invalidClient(error);
  }
  
  if (errorString.includes('invalid_token')) {
    return AuthErrors.invalidToken(error);
  }
  
  if (errorString.includes('expired')) {
    return AuthErrors.expiredToken(error);
  }

  // Default to token exchange failed for unknown OAuth errors
  return AuthErrors.tokenExchangeFailed(error);
};

/**
 * Error handler utility for OAuth operations
 */
export const handleOAuthError = (
  operation: string,
  error: any,
  context?: any
): AuthenticationError => {
  logger.error(`OAuth ${operation} failed`, {
    error: error?.message || error,
    stack: error?.stack,
    context
  });

  if (error instanceof AuthenticationError) {
    return error;
  }

  switch (operation) {
    case 'token_exchange':
      return mapGoogleOAuthError(error);
    
    case 'token_refresh':
      return AuthErrors.tokenRefreshFailed(error);
    
    case 'user_info':
      return AuthErrors.userInfoFailed(error);
    
    case 'token_validation':
      return AuthErrors.invalidToken(error);
    
    default:
      return new AuthenticationError(
        AuthErrorCode.INVALID_CREDENTIALS,
        `OAuth ${operation} failed: ${error?.message || 'Unknown error'}`,
        500,
        error
      );
  }
};

/**
 * Safe error response formatter
 * Ensures sensitive information is not leaked in production
 */
export const formatAuthErrorResponse = (error: AuthenticationError | Error) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (error instanceof AuthenticationError) {
    const response: any = {
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    };

    // Only include details in non-production environments
    if (!isProduction && error.details) {
      response.error.details = error.details;
    }

    return response;
  }

  // For non-AuthenticationError instances, provide generic message
  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: isProduction 
        ? 'An authentication error occurred' 
        : error.message || 'Unknown error'
    }
  };
};

/**
 * Retry logic for transient OAuth errors
 */
export const shouldRetryOAuthOperation = (error: AuthenticationError): boolean => {
  const retryableCodes = [
    AuthErrorCode.TOKEN_REFRESH_FAILED,
    AuthErrorCode.USER_INFO_FAILED
  ];
  
  return retryableCodes.includes(error.code);
};

export const retryOAuthOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof AuthenticationError && !shouldRetryOAuthOperation(error)) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      logger.warn(`OAuth operation attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: error instanceof Error ? error.message : error,
        attempt,
        maxRetries
      });
      
      await delay(delayMs * attempt);
    }
  }
  
  throw lastError!;
};

/**
 * Validation helpers
 */
export const validateTokenFormat = (token: string): { valid: boolean; error?: string } => {
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }
  
  if (typeof token !== 'string') {
    return { valid: false, error: 'Token must be a string' };
  }
  
  if (token.length < 10) {
    return { valid: false, error: 'Token too short' };
  }
  
  return { valid: true };
};

export const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateGoogleUserInfo = (userInfo: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!userInfo) {
    errors.push('No user info received');
  }
  
  if (!userInfo.sub) {
    errors.push('Missing user ID');
  }
  
  if (!userInfo.email) {
    errors.push('Missing user email');
  }
  
  if (userInfo.email && !validateEmailFormat(userInfo.email)) {
    errors.push('Invalid email format');
  }
  
  if (userInfo.email_verified === false) {
    errors.push('Email not verified');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};