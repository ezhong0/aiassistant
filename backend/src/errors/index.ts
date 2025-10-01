/**
 * Unified Error Handling System - Main Exports
 *
 * Single entry point for all error-related functionality.
 *
 * Usage:
 *   import { ErrorFactory, AppError, isAppError } from '@/errors';
 *   throw ErrorFactory.api.unauthorized();
 */

// Core error classes
export {
  AppError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../utils/app-error';

export type {
  AppErrorOptions,
  ErrorCategory,
  ErrorSeverity,
} from '../utils/app-error';

// Specialized error classes
export {
  APIClientError,
  WorkflowError,
  DomainError,
  ValidationError,
  AuthenticationError,
} from './specialized-errors';

// Error codes
export {
  ERROR_CODES,
  ERROR_CODE_CATEGORIES,
  getErrorCategory,
  isValidErrorCode,
} from './error-codes';

export type {
  ErrorCode,
  ErrorCodeCategory,
} from './error-codes';

// Error factory
export { ErrorFactory } from './error-factory';

// Type guards
export {
  isAppError,
  isAPIClientError,
  isWorkflowError,
  isDomainError,
  isValidationError,
  isAuthenticationError,
  isRetryableError,
  isRateLimitError,
  isAuthError,
  isNetworkError,
  isServiceUnavailableError,
  isValidationErrorCode,
  isClientError,
  isServerError,
  hasErrorCategory,
  getErrorRetryDelay,
  ensureAppError,
  getErrorMessage,
  getErrorCode,
  shouldLogError,
  shouldCaptureInSentry,
} from './type-guards';

// Error transformers
export {
  ErrorTransformer,
  GoogleErrorTransformer,
  OpenAIErrorTransformer,
  SlackErrorTransformer,
  HTTPErrorTransformer,
} from './transformers';

export type { TransformContext } from './transformers';
