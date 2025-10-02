/**
 * Type definitions for external API errors
 *
 * These types define the expected structure of errors from external services
 * to avoid using 'as any' in error transformers.
 */

/**
 * Common HTTP error response structure
 */
export interface HTTPErrorResponse {
  response?: {
    status?: number;
    data?: unknown;
    headers?: Record<string, string | string[]>;
  };
  status?: number;
  statusCode?: number;
  data?: unknown;
  message?: string;
}

/**
 * Google API error structure
 */
export interface GoogleAPIError extends HTTPErrorResponse {
  response?: {
    status?: number;
    data?: {
      error?: {
        code?: number;
        message?: string;
        errors?: Array<{
          message?: string;
          domain?: string;
          reason?: string;
        }>;
      };
    };
    headers?: Record<string, string | string[]>;
  };
}

/**
 * OpenAI API error structure
 */
export interface OpenAIError extends HTTPErrorResponse {
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
        type?: string;
        param?: string;
        code?: string;
      };
    };
    headers?: Record<string, string | string[]>;
  };
  error?: {
    message?: string;
    type?: string;
    param?: string;
    code?: string;
  };
  type?: string;
}

/**
 * Slack API error structure
 */
export interface SlackAPIError extends HTTPErrorResponse {
  response?: {
    status?: number;
    data?: {
      ok?: boolean;
      error?: string;
      warning?: string;
    };
    headers?: Record<string, string | string[]>;
  };
  data?: {
    ok?: boolean;
    error?: string;
    warning?: string;
  };
}

/**
 * Type guard to check if error has HTTP response structure
 */
export function hasHTTPResponse(error: unknown): error is HTTPErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'status' in error || 'statusCode' in error)
  );
}

/**
 * Type guard for Google API errors
 */
export function isGoogleAPIError(error: unknown): error is GoogleAPIError {
  return hasHTTPResponse(error);
}

/**
 * Type guard for OpenAI errors
 */
export function isOpenAIError(error: unknown): error is OpenAIError {
  return hasHTTPResponse(error) && typeof error === 'object' && 'error' in error;
}

/**
 * Type guard for Slack API errors
 */
export function isSlackAPIError(error: unknown): error is SlackAPIError {
  return hasHTTPResponse(error);
}
