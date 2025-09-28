/**
 * Unified Error Handling - Consolidates multiple error patterns
 *
 * Simplifies error handling by:
 * - Using existing AppError as foundation
 * - Reducing error factory complexity
 * - Providing consistent patterns
 * - Easy integration with existing logging
 */

import { AppError, ErrorFactory, ERROR_CATEGORIES, ERROR_SEVERITY } from '../../utils/app-error';

/**
 * Unified workflow error codes (simplified)
 */
export const UNIFIED_ERROR_CODES = {
  // Service errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  SERVICE_INITIALIZATION_FAILED: 'SERVICE_INITIALIZATION_FAILED',

  // Workflow errors
  WORKFLOW_EXECUTION_FAILED: 'WORKFLOW_EXECUTION_FAILED',
  WORKFLOW_ITERATION_LIMIT: 'WORKFLOW_ITERATION_LIMIT',

  // Builder errors
  BUILDER_NOT_INITIALIZED: 'BUILDER_NOT_INITIALIZED',
  BUILDER_EXECUTION_FAILED: 'BUILDER_EXECUTION_FAILED',

  // Token errors
  TOKEN_UNAVAILABLE: 'TOKEN_UNAVAILABLE',
  TOKEN_AUTHENTICATION_FAILED: 'TOKEN_AUTHENTICATION_FAILED',

  // Agent errors
  AGENT_EXECUTION_FAILED: 'AGENT_EXECUTION_FAILED',

  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
} as const;

/**
 * Unified error context interface
 */
export interface UnifiedErrorContext {
  sessionId?: string;
  userId?: string;
  operation?: string;
  component?: string;
  iteration?: number;
  metadata?: Record<string, any>;
}

/**
 * Unified error factory - simplified version of WorkflowErrorFactory
 */
export class UnifiedErrorFactory {

  /**
   * Create service unavailable error
   */
  static serviceUnavailable(serviceName: string, context?: UnifiedErrorContext): AppError {
    return new AppError(
      `Service '${serviceName}' is not available`,
      UNIFIED_ERROR_CODES.SERVICE_UNAVAILABLE,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.HIGH,
        service: serviceName,
        operation: context?.operation,
        metadata: {
          serviceName,
          ...context?.metadata
        },
        correlationId: context?.sessionId,
        userId: context?.userId,
        retryable: true,
        retryAfter: 10
      }
    );
  }

  /**
   * Create builder error
   */
  static builderError(builderName: string, originalError: Error, context?: UnifiedErrorContext): AppError {
    return new AppError(
      `Builder '${builderName}' failed: ${originalError.message}`,
      UNIFIED_ERROR_CODES.BUILDER_EXECUTION_FAILED,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.MEDIUM,
        service: 'prompt-builder',
        operation: context?.operation,
        metadata: {
          builderName,
          ...context?.metadata
        },
        correlationId: context?.sessionId,
        userId: context?.userId,
        originalError,
        retryable: true,
        retryAfter: 5
      }
    );
  }

  /**
   * Create workflow execution error
   */
  static workflowError(message: string, context?: UnifiedErrorContext): AppError {
    return new AppError(
      message,
      UNIFIED_ERROR_CODES.WORKFLOW_EXECUTION_FAILED,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        severity: ERROR_SEVERITY.MEDIUM,
        service: 'workflow',
        operation: context?.operation,
        metadata: {
          iteration: context?.iteration,
          ...context?.metadata
        },
        correlationId: context?.sessionId,
        userId: context?.userId,
        retryable: false
      }
    );
  }

  /**
   * Create iteration limit error
   */
  static iterationLimit(currentIteration: number, maxIterations: number, context?: UnifiedErrorContext): AppError {
    return new AppError(
      `Workflow reached maximum iterations (${maxIterations}). This may indicate a complex task requiring user intervention.`,
      UNIFIED_ERROR_CODES.WORKFLOW_ITERATION_LIMIT,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        severity: ERROR_SEVERITY.MEDIUM,
        service: 'workflow',
        operation: context?.operation,
        metadata: {
          currentIteration,
          maxIterations,
          ...context?.metadata
        },
        correlationId: context?.sessionId,
        userId: context?.userId,
        retryable: false,
        userFriendly: true
      }
    );
  }

  /**
   * Create token error
   */
  static tokenError(message: string, context?: UnifiedErrorContext): AppError {
    return new AppError(
      message,
      UNIFIED_ERROR_CODES.TOKEN_AUTHENTICATION_FAILED,
      {
        category: ERROR_CATEGORIES.AUTH,
        severity: ERROR_SEVERITY.HIGH,
        service: 'token-service',
        operation: context?.operation,
        metadata: context?.metadata,
        correlationId: context?.sessionId,
        userId: context?.userId,
        retryable: false
      }
    );
  }

  /**
   * Create agent execution error
   */
  static agentError(agentName: string, originalError: Error, context?: UnifiedErrorContext): AppError {
    return new AppError(
      `Agent '${agentName}' execution failed: ${originalError.message}`,
      UNIFIED_ERROR_CODES.AGENT_EXECUTION_FAILED,
      {
        category: ERROR_CATEGORIES.EXTERNAL,
        severity: ERROR_SEVERITY.MEDIUM,
        service: agentName,
        operation: context?.operation,
        metadata: {
          agentName,
          ...context?.metadata
        },
        correlationId: context?.sessionId,
        userId: context?.userId,
        originalError,
        retryable: true,
        retryAfter: 5
      }
    );
  }

  /**
   * Wrap any error with context
   */
  static wrapError(error: Error, context?: UnifiedErrorContext): AppError {
    if (error instanceof AppError) {
      // If it's already an AppError, just add context
      return error.addContext({
        correlationId: context?.sessionId,
        userId: context?.userId,
        service: context?.component,
        operation: context?.operation,
        metadata: context?.metadata
      });
    }

    // Wrap regular Error in AppError
    return new AppError(
      error.message,
      UNIFIED_ERROR_CODES.SERVICE_UNAVAILABLE,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.MEDIUM,
        service: context?.component,
        operation: context?.operation,
        metadata: context?.metadata,
        correlationId: context?.sessionId,
        userId: context?.userId,
        originalError: error,
        retryable: false
      }
    );
  }
}

/**
 * Error context builder utility
 */
export class ErrorContextBuilder {
  private context: UnifiedErrorContext = {};

  static create(): ErrorContextBuilder {
    return new ErrorContextBuilder();
  }

  sessionId(sessionId: string): ErrorContextBuilder {
    this.context.sessionId = sessionId;
    return this;
  }

  userId(userId?: string): ErrorContextBuilder {
    if (userId) {
      this.context.userId = userId;
    }
    return this;
  }

  operation(operation: string): ErrorContextBuilder {
    this.context.operation = operation;
    return this;
  }

  component(component: string): ErrorContextBuilder {
    this.context.component = component;
    return this;
  }

  iteration(iteration: number): ErrorContextBuilder {
    this.context.iteration = iteration;
    return this;
  }

  metadata(key: string, value: any): ErrorContextBuilder {
    if (!this.context.metadata) {
      this.context.metadata = {};
    }
    this.context.metadata[key] = value;
    return this;
  }

  build(): UnifiedErrorContext {
    return { ...this.context };
  }
}

/**
 * Simplified error handling utilities
 */
export class ErrorUtils {

  /**
   * Safe error execution wrapper
   */
  static async safeExecute<T>(
    operation: () => Promise<T>,
    errorContext: UnifiedErrorContext,
    fallback?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const wrappedError = UnifiedErrorFactory.wrapError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      if (fallback !== undefined) {
        // Log error but return fallback
        console.error('Operation failed, using fallback', wrappedError);
        return fallback;
      }

      throw wrappedError;
    }
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof AppError) {
      return error.retryable;
    }
    return false;
  }

  /**
   * Get retry delay from error
   */
  static getRetryDelay(error: Error): number {
    if (error instanceof AppError && error.retryAfter) {
      return error.retryAfter * 1000; // Convert seconds to ms
    }
    return 1000; // Default 1 second
  }
}