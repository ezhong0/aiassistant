/**
 * Agent Result Types - Railway-Oriented Programming Pattern
 *
 * This module implements a type-safe result pattern that enforces
 * error checking at compile time, preventing null reference errors
 * and ensuring explicit error handling.
 *
 * Key Benefits:
 * - TypeScript enforces checking result.ok before accessing result.value
 * - Prevents uncaught errors from causing production crashes
 * - Clear separation between success and error code paths
 * - No silent fallbacks - errors are always explicit
 */

/**
 * Core result type - discriminated union for type safety
 *
 * Success case: { ok: true, value: T }
 * Error case: { ok: false, error: AgentError }
 */
export type AgentResult<T> =
  | { ok: true; value: T; metadata?: ResultMetadata }
  | { ok: false; error: AgentError; recoverable: boolean };

/**
 * Standardized error structure for all agent operations
 */
export interface AgentError {
  /** Error code for programmatic handling (e.g., 'SERVICE_UNAVAILABLE', 'INVALID_PARAMS') */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Additional context about the error */
  context?: Record<string, any>;

  /** Suggestions for how to resolve the error */
  suggestions?: string[];

  /** The original error object if applicable */
  originalError?: Error;
}

/**
 * Metadata attached to successful results
 */
export interface ResultMetadata {
  /** Operation that was performed */
  operation: string;

  /** Duration of the operation in milliseconds */
  duration?: number;

  /** Whether this operation requires user confirmation */
  requiresConfirmation?: boolean;

  /** Suggested next steps for the user */
  nextSteps?: string[];

  /** Additional metadata specific to the operation */
  [key: string]: any;
}

/**
 * Standard error codes used across all agents
 */
export enum AgentErrorCode {
  // Service-level errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_INITIALIZATION_FAILED = 'SERVICE_INITIALIZATION_FAILED',

  // Authentication/Authorization errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Input validation errors
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Operation errors
  OPERATION_FAILED = 'OPERATION_FAILED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',

  // AI-specific errors
  AI_ANALYSIS_FAILED = 'AI_ANALYSIS_FAILED',
  AI_RESPONSE_INVALID = 'AI_RESPONSE_INVALID',
  AI_SCHEMA_VALIDATION_FAILED = 'AI_SCHEMA_VALIDATION_FAILED',

  // Agent routing errors
  NO_AGENT_AVAILABLE = 'NO_AGENT_AVAILABLE',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_CANNOT_HANDLE = 'AGENT_CANNOT_HANDLE',

  // External service errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Loop/retry errors
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  REPEATED_FAILURES_DETECTED = 'REPEATED_FAILURES_DETECTED',

  // Unknown/unexpected errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Helper to create a success result
 */
export function success<T>(value: T, metadata?: ResultMetadata): AgentResult<T> {
  return { ok: true, value, metadata };
}

/**
 * Helper to create an error result
 */
export function failure<T>(
  error: AgentError,
  recoverable: boolean = true
): AgentResult<T> {
  return { ok: false, error, recoverable };
}

/**
 * Helper to create an error result from an Error object
 */
export function failureFromError<T>(
  error: Error,
  code: string = AgentErrorCode.UNKNOWN_ERROR,
  recoverable: boolean = true,
  suggestions?: string[]
): AgentResult<T> {
  return {
    ok: false,
    error: {
      code,
      message: error.message,
      originalError: error,
      suggestions,
    },
    recoverable,
  };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: AgentResult<T>): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * Type guard to check if result is an error
 */
export function isFailure<T>(
  result: AgentResult<T>
): result is { ok: false; error: AgentError; recoverable: boolean } {
  return result.ok === false;
}

/**
 * Helper to unwrap a result or throw an error
 * Use sparingly - prefer explicit error handling
 */
export function unwrap<T>(result: AgentResult<T>): T {
  if (result.ok) {
    return result.value;
  }
  const error = new Error(result.error.message);
  (error as any).code = result.error.code;
  (error as any).context = result.error.context;
  throw error;
}

/**
 * Helper to unwrap a result or return a default value
 */
export function unwrapOr<T>(result: AgentResult<T>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Map a successful result to a new value
 */
export function mapResult<T, U>(
  result: AgentResult<T>,
  mapper: (value: T) => U
): AgentResult<U> {
  if (result.ok) {
    return { ok: true, value: mapper(result.value), metadata: result.metadata };
  }
  return result;
}

/**
 * Chain results together (flatMap/bind)
 */
export async function chainResult<T, U>(
  result: AgentResult<T>,
  mapper: (value: T) => Promise<AgentResult<U>>
): Promise<AgentResult<U>> {
  if (result.ok) {
    return await mapper(result.value);
  }
  return result;
}