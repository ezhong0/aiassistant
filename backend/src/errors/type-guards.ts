/**
 * Error Type Guards
 *
 * Type guards for checking error types and providing type-safe error handling.
 */

import { AppError } from '../utils/app-error';
import {
  APIClientError,
  WorkflowError,
  DomainError,
  ValidationError,
  AuthenticationError,
} from './specialized-errors';
import { ERROR_CODES } from './error-codes';
import type { ErrorCode } from './error-codes';

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is an APIClientError
 */
export function isAPIClientError(error: unknown): error is APIClientError {
  return error instanceof APIClientError;
}

/**
 * Check if error is a WorkflowError
 */
export function isWorkflowError(error: unknown): error is WorkflowError {
  return error instanceof WorkflowError;
}

/**
 * Check if error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return (
    error.code === ERROR_CODES.RATE_LIMITED ||
    error.code === ERROR_CODES.RATE_LIMIT_EXCEEDED ||
    error.code === ERROR_CODES.RATE_LIMIT_QUOTA_EXCEEDED ||
    error.code === ERROR_CODES.GOOGLE_RATE_LIMIT ||
    error.code === ERROR_CODES.OPENAI_RATE_LIMIT ||
    error.code === ERROR_CODES.SLACK_RATE_LIMIT
  );
}

/**
 * Check if error is an authentication error (by code)
 */
export function isAuthError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  const authCodes = [
    ERROR_CODES.AUTH_REQUIRED,
    ERROR_CODES.AUTH_FAILED,
    ERROR_CODES.AUTH_EXPIRED,
    ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    ERROR_CODES.AUTHENTICATION_FAILED,
    ERROR_CODES.TOKEN_EXPIRED,
    ERROR_CODES.TOKEN_INVALID,
    ERROR_CODES.TOKEN_UNAVAILABLE,
    ERROR_CODES.TOKEN_AUTHENTICATION_FAILED,
    ERROR_CODES.UNAUTHORIZED,
    ERROR_CODES.NOT_AUTHENTICATED,
    ERROR_CODES.GOOGLE_AUTH_FAILED,
    ERROR_CODES.OPENAI_AUTH_FAILED,
    ERROR_CODES.SLACK_AUTH_FAILED,
  ];

  return (authCodes as readonly ErrorCode[]).includes(error.code);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return (
    error.code === ERROR_CODES.NETWORK_ERROR ||
    error.code === ERROR_CODES.NETWORK_TIMEOUT ||
    error.code === ERROR_CODES.NETWORK_CONNECTION_FAILED ||
    error.code === ERROR_CODES.TIMEOUT
  );
}

/**
 * Check if error is a service unavailable error
 */
export function isServiceUnavailableError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return (
    error.code === ERROR_CODES.SERVICE_UNAVAILABLE ||
    error.code === ERROR_CODES.CIRCUIT_BREAKER_OPEN ||
    error.code === ERROR_CODES.GATEWAY_TIMEOUT
  );
}

/**
 * Check if error is a validation error (by code)
 */
export function isValidationErrorCode(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return (
    error.code === ERROR_CODES.VALIDATION_ERROR ||
    error.code === ERROR_CODES.VALIDATION_FAILED ||
    error.code === ERROR_CODES.INVALID_INPUT ||
    error.code === ERROR_CODES.BAD_REQUEST
  );
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return error.statusCode >= 400 && error.statusCode < 500;
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return error.statusCode >= 500 && error.statusCode < 600;
}

/**
 * Check if error has a specific category
 */
export function hasErrorCategory(error: unknown, category: string): boolean {
  if (!isAppError(error)) {
    return false;
  }

  return error.category === category;
}

/**
 * Get error retry delay (in milliseconds)
 */
export function getErrorRetryDelay(error: unknown): number | null {
  if (!isAppError(error) || !error.retryable) {
    return null;
  }

  if (error.retryAfter) {
    return error.retryAfter * 1000; // Convert seconds to milliseconds
  }

  // Default retry delays based on error type
  if (isRateLimitError(error)) {
    return 60000; // 60 seconds for rate limits
  }

  if (isNetworkError(error)) {
    return 5000; // 5 seconds for network errors
  }

  if (isServiceUnavailableError(error)) {
    return 30000; // 30 seconds for service unavailable
  }

  return 10000; // Default 10 seconds
}

/**
 * Convert unknown error to AppError (safe wrapper)
 */
export function ensureAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      ERROR_CODES.UNKNOWN_ERROR,
      {
        originalError: error,
        metadata: {
          errorName: error.name,
          errorStack: error.stack,
        },
      },
    );
  }

  return new AppError(
    String(error),
    ERROR_CODES.UNKNOWN_ERROR,
    {
      metadata: {
        originalValue: error,
      },
    },
  );
}

/**
 * Extract error message (safe for any error type)
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Extract error code (safe for any error type)
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Check if error should be logged
 */
export function shouldLogError(error: unknown): boolean {
  // Always log server errors
  if (isServerError(error)) {
    return true;
  }

  // Always log auth errors
  if (isAuthError(error)) {
    return true;
  }

  // Don't log client validation errors (they're expected)
  if (isValidationError(error) || isValidationErrorCode(error)) {
    return false;
  }

  // Log everything else
  return true;
}

/**
 * Check if error should be sent to Sentry
 */
export function shouldCaptureInSentry(error: unknown): boolean {
  // Only capture server errors and critical errors
  if (isServerError(error)) {
    return true;
  }

  // Capture auth errors for security monitoring
  if (isAuthError(error)) {
    return true;
  }

  // Capture workflow errors
  if (isWorkflowError(error)) {
    return true;
  }

  // Don't capture expected client errors
  return false;
}
