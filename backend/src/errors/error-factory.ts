/**
 * Consolidated Error Factory
 *
 * Single source of truth for creating errors throughout the application.
 * Provides a clean, namespaced API for creating errors with proper context.
 *
 * Usage:
 *   ErrorFactory.api.unauthorized()
 *   ErrorFactory.workflow.iterationLimit()
 *   ErrorFactory.external.google.authFailed()
 */

import { AppError, AppErrorOptions, ERROR_CATEGORIES } from '../utils/app-error';
import {
  APIClientError,
  WorkflowError,
  DomainError,
  ValidationError,
  AuthenticationError,
} from './specialized-errors';
import { ERROR_CODES } from './error-codes';

/**
 * API Error Factory
 * For creating API-related errors
 */
export class APIErrorFactory {
  /**
   * Bad request - client sent invalid data
   */
  static badRequest(message: string, details?: Record<string, unknown>): APIClientError {
    return new APIClientError(
      message,
      ERROR_CODES.BAD_REQUEST,
      {
        category: ERROR_CATEGORIES.API,
        metadata: details,
        retryable: false,
      },
    );
  }

  /**
   * Unauthorized - authentication required or failed
   */
  static unauthorized(message = 'Authentication required'): AuthenticationError {
    return new AuthenticationError(
      message,
      ERROR_CODES.UNAUTHORIZED,
      {
        retryable: false,
      },
    );
  }

  /**
   * Forbidden - insufficient permissions
   */
  static forbidden(message = 'Access denied'): AuthenticationError {
    return new AuthenticationError(
      message,
      ERROR_CODES.FORBIDDEN,
      {
        retryable: false,
      },
    );
  }

  /**
   * Not found - resource doesn't exist
   */
  static notFound(resource: string): APIClientError {
    return new APIClientError(
      `${resource} not found`,
      ERROR_CODES.NOT_FOUND,
      {
        category: ERROR_CATEGORIES.API,
        metadata: { resource },
        retryable: false,
      },
    );
  }

  /**
   * Rate limited - too many requests
   */
  static rateLimited(message = 'Rate limit exceeded', retryAfter?: number): APIClientError {
    return new APIClientError(
      message,
      ERROR_CODES.RATE_LIMITED,
      {
        category: ERROR_CATEGORIES.API,
        retryable: true,
        retryAfter: retryAfter || 60,
      },
    );
  }

  /**
   * Conflict - resource conflict (e.g., duplicate entry)
   */
  static conflict(message: string, details?: Record<string, unknown>): APIClientError {
    return new APIClientError(
      message,
      ERROR_CODES.CONFLICT,
      {
        category: ERROR_CATEGORIES.API,
        metadata: details,
        retryable: false,
      },
    );
  }
}

/**
 * Workflow Error Factory
 * For creating workflow execution errors
 */
export class WorkflowErrorFactory {
  /**
   * Workflow execution failed
   */
  static executionFailed(message: string, workflowId?: string, iteration?: number): WorkflowError {
    return new WorkflowError(
      message,
      ERROR_CODES.WORKFLOW_EXECUTION_FAILED,
      {
        workflowId,
        iteration,
        retryable: false,
      },
    );
  }

  /**
   * Workflow reached iteration limit
   */
  static iterationLimit(currentIteration: number, maxIterations: number, workflowId?: string): WorkflowError {
    return new WorkflowError(
      `Workflow reached maximum iterations (${maxIterations}). This may indicate a complex task requiring user intervention.`,
      ERROR_CODES.WORKFLOW_ITERATION_LIMIT,
      {
        workflowId,
        iteration: currentIteration,
        maxIterations,
        retryable: false,
        userFriendly: true,
      },
    );
  }

  /**
   * Workflow was interrupted
   */
  static interrupted(reason: string, workflowId?: string): WorkflowError {
    return new WorkflowError(
      `Workflow interrupted: ${reason}`,
      ERROR_CODES.WORKFLOW_INTERRUPTED,
      {
        workflowId,
        retryable: false,
      },
    );
  }

  /**
   * Invalid workflow state
   */
  static invalidState(currentState: string, expectedStates: string[], workflowId?: string): WorkflowError {
    return new WorkflowError(
      `Invalid workflow state '${currentState}'. Expected one of: ${expectedStates.join(', ')}`,
      ERROR_CODES.WORKFLOW_STATE_INVALID,
      {
        workflowId,
        workflowState: currentState,
        metadata: { expectedStates },
        retryable: false,
      },
    );
  }
}

/**
 * Domain Error Factory
 * For creating domain service errors
 */
export class DomainErrorFactory {
  /**
   * Service unavailable
   */
  static serviceUnavailable(serviceName: string, details?: Record<string, unknown>): DomainError {
    return new DomainError(
      `Service '${serviceName}' is not available`,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      {
        service: serviceName,
        metadata: details,
        retryable: true,
        retryAfter: 30,
      },
    );
  }

  /**
   * Service timeout
   */
  static serviceTimeout(serviceName: string, timeout: number): DomainError {
    return new DomainError(
      `Service '${serviceName}' timed out after ${timeout}ms`,
      ERROR_CODES.SERVICE_TIMEOUT,
      {
        service: serviceName,
        metadata: { timeout },
        retryable: true,
        retryAfter: 10,
      },
    );
  }

  /**
   * Generic service error
   */
  static serviceError(serviceName: string, message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError(
      message,
      ERROR_CODES.SERVICE_ERROR,
      {
        service: serviceName,
        metadata: details,
        retryable: true,
      },
    );
  }

  /**
   * Builder not initialized
   */
  static builderNotInitialized(builderName: string): DomainError {
    return new DomainError(
      `${builderName} is not initialized. Ensure the Master Agent is properly initialized before executing workflows.`,
      ERROR_CODES.BUILDER_NOT_INITIALIZED,
      {
        service: 'master-agent',
        metadata: { builderName },
        retryable: false,
        userFriendly: true,
      },
    );
  }

  /**
   * Builder execution failed
   */
  static builderFailed(builderName: string, originalError: Error): DomainError {
    return new DomainError(
      `Builder '${builderName}' failed: ${originalError.message}`,
      ERROR_CODES.BUILDER_EXECUTION_FAILED,
      {
        service: 'prompt-builder',
        metadata: { builderName },
        originalError,
        retryable: true,
        retryAfter: 5,
      },
    );
  }

  /**
   * Agent execution failed
   */
  static agentFailed(agentName: string, originalError: Error): DomainError {
    return new DomainError(
      `Agent '${agentName}' execution failed: ${originalError.message}`,
      ERROR_CODES.AGENT_EXECUTION_FAILED,
      {
        service: agentName,
        metadata: { agentName },
        originalError,
        retryable: true,
        retryAfter: 5,
      },
    );
  }

  /**
   * Agent not available
   */
  static agentNotAvailable(agentName: string, reason?: string): DomainError {
    return new DomainError(
      `Agent '${agentName}' is not available${reason ? `: ${reason}` : ''}`,
      ERROR_CODES.AGENT_NOT_AVAILABLE,
      {
        service: 'agent-factory',
        metadata: { agentName, reason },
        retryable: true,
        retryAfter: 10,
        userFriendly: true,
      },
    );
  }

  /**
   * Context invalid
   */
  static contextInvalid(reason: string): DomainError {
    return new DomainError(
      `Workflow context is invalid: ${reason}`,
      ERROR_CODES.CONTEXT_INVALID,
      {
        service: 'master-agent',
        metadata: { reason },
        retryable: false,
        userFriendly: true,
      },
    );
  }

  /**
   * Context parsing failed
   */
  static contextParsingFailed(originalError: Error, contextSnippet?: string): DomainError {
    return new DomainError(
      `Failed to parse workflow context: ${originalError.message}`,
      ERROR_CODES.CONTEXT_PARSING_FAILED,
      {
        service: 'master-agent',
        metadata: { contextSnippet: contextSnippet?.substring(0, 100) },
        originalError,
        retryable: true,
        retryAfter: 2,
      },
    );
  }
}

/**
 * Validation Error Factory
 * For creating validation errors
 */
export class ValidationErrorFactory {
  /**
   * Validation failed for a specific field
   */
  static fieldValidationFailed(field: string, message: string, value?: unknown): ValidationError {
    return new ValidationError(
      `Validation failed for ${field}: ${message}`,
      {
        field,
        value,
        metadata: { message },
        retryable: false,
      },
    );
  }

  /**
   * Invalid input
   */
  static invalidInput(field: string, value: unknown, expected?: string): ValidationError {
    return new ValidationError(
      `Invalid input for ${field}${expected ? `. Expected: ${expected}` : ''}`,
      {
        field,
        value,
        metadata: { expected },
        retryable: false,
      },
    );
  }

  /**
   * Multiple validation errors
   */
  static multipleErrors(errors: Record<string, string>): ValidationError {
    const fields = Object.keys(errors);
    const message = `Validation failed for ${fields.length} field(s): ${fields.join(', ')}`;

    return new ValidationError(
      message,
      {
        metadata: { errors },
        retryable: false,
      },
    );
  }
}

/**
 * External API Error Factory
 * For creating external service errors (Google, OpenAI, Slack, etc.)
 */
export class ExternalAPIErrorFactory {
  /**
   * Google API Errors
   */
  static google = {
    authFailed: (message = 'Google authentication failed'): APIClientError => {
      return new APIClientError(
        message,
        ERROR_CODES.GOOGLE_AUTH_FAILED,
        {
          serviceName: 'google',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: false,
        },
      );
    },

    permissionDenied: (resource: string): APIClientError => {
      return new APIClientError(
        `Insufficient permissions for Google resource: ${resource}`,
        ERROR_CODES.GOOGLE_PERMISSION_DENIED,
        {
          serviceName: 'google',
          category: ERROR_CATEGORIES.EXTERNAL,
          metadata: { resource },
          retryable: false,
        },
      );
    },

    notFound: (resource: string): APIClientError => {
      return new APIClientError(
        `Google resource not found: ${resource}`,
        ERROR_CODES.GOOGLE_NOT_FOUND,
        {
          serviceName: 'google',
          category: ERROR_CATEGORIES.EXTERNAL,
          metadata: { resource },
          retryable: false,
        },
      );
    },

    rateLimit: (): APIClientError => {
      return new APIClientError(
        'Google API rate limit exceeded',
        ERROR_CODES.GOOGLE_RATE_LIMIT,
        {
          serviceName: 'google',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: true,
          retryAfter: 60,
        },
      );
    },

    serverError: (message: string): APIClientError => {
      return new APIClientError(
        `Google API server error: ${message}`,
        ERROR_CODES.GOOGLE_SERVER_ERROR,
        {
          serviceName: 'google',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: true,
          retryAfter: 30,
        },
      );
    },
  };

  /**
   * OpenAI API Errors
   */
  static openai = {
    authFailed: (): APIClientError => {
      return new APIClientError(
        'OpenAI authentication failed',
        ERROR_CODES.OPENAI_AUTH_FAILED,
        {
          serviceName: 'openai',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: false,
        },
      );
    },

    rateLimit: (): APIClientError => {
      return new APIClientError(
        'OpenAI API rate limit exceeded',
        ERROR_CODES.OPENAI_RATE_LIMIT,
        {
          serviceName: 'openai',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: true,
          retryAfter: 20,
        },
      );
    },

    timeout: (): APIClientError => {
      return new APIClientError(
        'OpenAI API request timed out',
        ERROR_CODES.OPENAI_TIMEOUT,
        {
          serviceName: 'openai',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: true,
          retryAfter: 5,
        },
      );
    },

    serverError: (message: string): APIClientError => {
      return new APIClientError(
        `OpenAI API server error: ${message}`,
        ERROR_CODES.OPENAI_SERVER_ERROR,
        {
          serviceName: 'openai',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: true,
          retryAfter: 10,
        },
      );
    },

    invalidRequest: (message: string): APIClientError => {
      return new APIClientError(
        `Invalid OpenAI API request: ${message}`,
        ERROR_CODES.OPENAI_INVALID_REQUEST,
        {
          serviceName: 'openai',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: false,
        },
      );
    },
  };

  /**
   * Slack API Errors
   */
  static slack = {
    authFailed: (): APIClientError => {
      return new APIClientError(
        'Slack authentication failed',
        ERROR_CODES.SLACK_AUTH_FAILED,
        {
          serviceName: 'slack',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: false,
        },
      );
    },

    rateLimit: (): APIClientError => {
      return new APIClientError(
        'Slack API rate limit exceeded',
        ERROR_CODES.SLACK_RATE_LIMIT,
        {
          serviceName: 'slack',
          category: ERROR_CATEGORIES.EXTERNAL,
          retryable: true,
          retryAfter: 60,
        },
      );
    },

    channelNotFound: (channelId: string): APIClientError => {
      return new APIClientError(
        `Slack channel not found: ${channelId}`,
        ERROR_CODES.SLACK_CHANNEL_NOT_FOUND,
        {
          serviceName: 'slack',
          category: ERROR_CATEGORIES.EXTERNAL,
          metadata: { channelId },
          retryable: false,
        },
      );
    },

    permissionDenied: (action: string): APIClientError => {
      return new APIClientError(
        `Insufficient Slack permissions for action: ${action}`,
        ERROR_CODES.SLACK_PERMISSION_DENIED,
        {
          serviceName: 'slack',
          category: ERROR_CATEGORIES.EXTERNAL,
          metadata: { action },
          retryable: false,
        },
      );
    },
  };

  /**
   * Generic external service error
   */
  static generic(serviceName: string, message: string): APIClientError {
    return new APIClientError(
      `${serviceName} service error: ${message}`,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      {
        serviceName,
        category: ERROR_CATEGORIES.EXTERNAL,
        retryable: true,
        retryAfter: 30,
      },
    );
  }
}

/**
 * Network Error Factory
 * For creating network-related errors
 */
export class NetworkErrorFactory {
  static networkError(message: string): AppError {
    return new AppError(
      `Network error: ${message}`,
      ERROR_CODES.NETWORK_ERROR,
      {
        category: ERROR_CATEGORIES.EXTERNAL,
        retryable: true,
        retryAfter: 15,
      },
    );
  }

  static timeout(operation: string, duration: number): AppError {
    return new AppError(
      `Operation '${operation}' timed out after ${duration}ms`,
      ERROR_CODES.TIMEOUT,
      {
        category: ERROR_CATEGORIES.SERVICE,
        metadata: { operation, duration },
        retryable: true,
        retryAfter: 10,
      },
    );
  }

  static connectionFailed(endpoint: string): AppError {
    return new AppError(
      `Failed to connect to ${endpoint}`,
      ERROR_CODES.NETWORK_CONNECTION_FAILED,
      {
        category: ERROR_CATEGORIES.EXTERNAL,
        metadata: { endpoint },
        retryable: true,
        retryAfter: 20,
      },
    );
  }
}

/**
 * Business Logic Error Factory
 * For creating business rule violation errors
 */
export class BusinessErrorFactory {
  static ruleViolation(rule: string, details?: Record<string, unknown>): AppError {
    return new AppError(
      `Business rule violation: ${rule}`,
      ERROR_CODES.BUSINESS_RULE_VIOLATION,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        metadata: { rule, ...details },
        retryable: false,
      },
    );
  }

  static userInputRequired(requiredInfo: string): AppError {
    return new AppError(
      `User input required: ${requiredInfo}`,
      ERROR_CODES.USER_INPUT_REQUIRED,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        metadata: { requiredInfo },
        retryable: false,
        userFriendly: true,
      },
    );
  }

  static userInputTimeout(): AppError {
    return new AppError(
      'User input timed out',
      ERROR_CODES.USER_INPUT_TIMEOUT,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        retryable: false,
      },
    );
  }
}

/**
 * Utility Error Factory
 * For wrapping and creating generic errors
 */
export class UtilityErrorFactory {
  /**
   * Wrap an unknown error in AppError
   */
  static wrapError(error: Error, category: string, context?: Partial<AppErrorOptions>): AppError {
    return new AppError(
      error.message,
      ERROR_CODES.WRAPPED_ERROR,
      {
        category: category as any,
        originalError: error,
        ...context,
        retryable: false,
      },
    );
  }

  /**
   * Create unknown error
   */
  static unknown(message: string): AppError {
    return new AppError(
      message,
      ERROR_CODES.UNKNOWN_ERROR,
      {
        category: ERROR_CATEGORIES.SERVICE,
        retryable: false,
      },
    );
  }

  /**
   * Create operation failed error
   */
  static operationFailed(operation: string, reason?: string): AppError {
    return new AppError(
      `Operation '${operation}' failed${reason ? `: ${reason}` : ''}`,
      ERROR_CODES.OPERATION_FAILED,
      {
        category: ERROR_CATEGORIES.SERVICE,
        metadata: { operation, reason },
        retryable: false,
      },
    );
  }
}

/**
 * Main Error Factory
 * Provides namespaced access to all error creation methods
 */
export const ErrorFactory = {
  api: APIErrorFactory,
  workflow: WorkflowErrorFactory,
  domain: DomainErrorFactory,
  validation: ValidationErrorFactory,
  external: ExternalAPIErrorFactory,
  network: NetworkErrorFactory,
  business: BusinessErrorFactory,
  util: UtilityErrorFactory,
};
