/**
 * External API Error Transformers
 *
 * Transforms external API errors (Google, OpenAI) into our unified AppError system.
 * These transformers are used at the boundary between external services and our application.
 */

import { APIClientError } from './specialized-errors';
import { ERROR_CODES } from './error-codes';
import { ERROR_CATEGORIES } from '../utils/app-error';
import type { GoogleAPIError, OpenAIError, HTTPErrorResponse } from './external-api-error-types';

/**
 * Context for error transformation
 */
export interface TransformContext {
  serviceName: string;
  endpoint?: string;
  method?: string;
  requestId?: string;
}

/**
 * Google API Error Transformer
 */
export class GoogleErrorTransformer {
  /**
   * Transform Google API error to APIClientError
   */
  static transform(error: unknown, context: TransformContext): APIClientError {
    const err = error as GoogleAPIError;
    const status = err?.response?.status || err?.status;
    const errorData = err?.response?.data || err?.data;
    let message = err?.message || 'Google API error';

    // Map status codes to specific error codes
    let errorCode: typeof ERROR_CODES[keyof typeof ERROR_CODES] = ERROR_CODES.GOOGLE_API_ERROR;
    let retryable = false;
    let retryAfter: number | undefined;

    if (status === 401) {
      errorCode = ERROR_CODES.GOOGLE_AUTH_FAILED;
      message = 'Google authentication failed. Please reconnect your account.';
    } else if (status === 403) {
      errorCode = ERROR_CODES.GOOGLE_PERMISSION_DENIED;
      message = 'Insufficient permissions for Google API access';
    } else if (status === 404) {
      errorCode = ERROR_CODES.GOOGLE_NOT_FOUND;
    } else if (status === 429) {
      errorCode = ERROR_CODES.GOOGLE_RATE_LIMIT;
      retryable = true;
      retryAfter = 60;
    } else if (status && status >= 500) {
      errorCode = ERROR_CODES.GOOGLE_SERVER_ERROR;
      retryable = true;
      retryAfter = 30;
    }

    return new APIClientError(
      message,
      errorCode,
      {
        serviceName: context.serviceName,
        endpoint: context.endpoint,
        method: context.method,
        requestId: context.requestId,
        category: ERROR_CATEGORIES.EXTERNAL,
        statusCode: status,
        responseData: errorData as Record<string, unknown>,
        originalError: err as Error,
        retryable,
        retryAfter,
      },
    );
  }
}

/**
 * OpenAI API Error Transformer
 */
export class OpenAIErrorTransformer {
  /**
   * Transform OpenAI API error to APIClientError
   */
  static transform(error: unknown, context: TransformContext): APIClientError {
    const err = error as OpenAIError;
    const status = err?.response?.status || err?.status || err?.statusCode;
    const errorData = err?.response?.data || err?.data;
    const errorMessage = err?.error?.message || err?.message || 'OpenAI API error';

    // Map OpenAI error types
    let errorCode: typeof ERROR_CODES[keyof typeof ERROR_CODES] = ERROR_CODES.OPENAI_API_ERROR;
    let retryable = false;
    let retryAfter: number | undefined;
    let message = errorMessage;

    // OpenAI-specific error codes
    const errorType = err?.error?.type || err?.type;

    if (status === 401 || errorType === 'invalid_api_key' || errorType === 'authentication_error') {
      errorCode = ERROR_CODES.OPENAI_AUTH_FAILED;
      message = 'OpenAI authentication failed. Please check your API key.';
      retryable = false;
    } else if (status === 429 || errorType === 'rate_limit_exceeded') {
      errorCode = ERROR_CODES.OPENAI_RATE_LIMIT;
      message = 'OpenAI API rate limit exceeded';
      retryable = true;
      const retryHeader = err?.response?.headers?.['retry-after'];
      retryAfter = parseInt(typeof retryHeader === 'string' ? retryHeader : (retryHeader?.[0] || '20')) || 20;
    } else if (errorType === 'timeout' || message.toLowerCase().includes('timeout')) {
      errorCode = ERROR_CODES.OPENAI_TIMEOUT;
      message = 'OpenAI API request timed out';
      retryable = true;
      retryAfter = 5;
    } else if ((status && status >= 500) || errorType === 'server_error') {
      errorCode = ERROR_CODES.OPENAI_SERVER_ERROR;
      message = `OpenAI server error: ${errorMessage}`;
      retryable = true;
      retryAfter = 10;
    } else if (status === 400 || errorType === 'invalid_request_error') {
      errorCode = ERROR_CODES.OPENAI_INVALID_REQUEST;
      message = `Invalid OpenAI request: ${errorMessage}`;
      retryable = false;
    }

    return new APIClientError(
      message,
      errorCode,
      {
        serviceName: context.serviceName,
        endpoint: context.endpoint,
        method: context.method,
        requestId: context.requestId,
        category: ERROR_CATEGORIES.EXTERNAL,
        statusCode: status,
        responseData: errorData as Record<string, unknown>,
        originalError: err as Error,
        retryable,
        retryAfter,
        metadata: {
          errorType,
          openaiRequestId: (() => {
            const reqId = err?.response?.headers?.['openai-request-id'];
            return typeof reqId === 'string' ? reqId : reqId?.[0];
          })(),
        },
      },
    );
  }
}

/**
 * Generic HTTP Error Transformer
 * For APIs that don't have specific transformers
 */
export class HTTPErrorTransformer {
  /**
   * Transform generic HTTP error to APIClientError
   */
  static transform(error: unknown, context: TransformContext): APIClientError {
    const err = error as HTTPErrorResponse;
    const status = err?.response?.status || err?.status || err?.statusCode || 500;
    const errorData = err?.response?.data || err?.data;
    const message = err?.message || `${context.serviceName} API error`;

    // Determine error code based on HTTP status
    let errorCode: typeof ERROR_CODES[keyof typeof ERROR_CODES] = ERROR_CODES.EXTERNAL_SERVICE_ERROR;
    let retryable = false;
    let retryAfter: number | undefined;

    if (status === 401) {
      errorCode = ERROR_CODES.UNAUTHORIZED;
      retryable = false;
    } else if (status === 403) {
      errorCode = ERROR_CODES.FORBIDDEN;
      retryable = false;
    } else if (status === 404) {
      errorCode = ERROR_CODES.NOT_FOUND;
      retryable = false;
    } else if (status === 429) {
      errorCode = ERROR_CODES.RATE_LIMITED;
      retryable = true;
      retryAfter = 60;
    } else if (status === 408) {
      errorCode = ERROR_CODES.TIMEOUT;
      retryable = true;
      retryAfter = 10;
    } else if (status >= 500 && status < 600) {
      errorCode = ERROR_CODES.SERVICE_UNAVAILABLE;
      retryable = true;
      retryAfter = 30;
    } else if (status >= 400 && status < 500) {
      errorCode = ERROR_CODES.BAD_REQUEST;
      retryable = false;
    }

    return new APIClientError(
      message,
      errorCode,
      {
        serviceName: context.serviceName,
        endpoint: context.endpoint,
        method: context.method,
        requestId: context.requestId,
        category: ERROR_CATEGORIES.EXTERNAL,
        statusCode: status,
        responseData: errorData as Record<string, unknown>,
        originalError: err as Error,
        retryable,
        retryAfter,
      },
    );
  }
}

/**
 * Main error transformer router
 * Selects the appropriate transformer based on service name
 */
export class ErrorTransformer {
  /**
   * Transform external API error to unified AppError
   */
  static transform(error: unknown, context: TransformContext): APIClientError {
    const serviceName = context.serviceName.toLowerCase();

    if (serviceName.includes('google') || serviceName.includes('gmail') || serviceName.includes('calendar')) {
      return GoogleErrorTransformer.transform(error, context);
    }

    if (serviceName.includes('openai') || serviceName.includes('gpt')) {
      return OpenAIErrorTransformer.transform(error, context);
    }

    // Fallback to generic HTTP transformer
    return HTTPErrorTransformer.transform(error, context);
  }
}

// Export as default
export { ErrorTransformer as default };
