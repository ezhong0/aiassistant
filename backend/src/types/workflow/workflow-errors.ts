/**
 * Workflow-specific error types and utilities
 *
 * Extends the existing AppError system with workflow-specific error handling
 * for the Master Agent and Sub-Agent architectures.
 */

import { AppError, ErrorFactory, ERROR_CATEGORIES, ERROR_SEVERITY } from '../../utils/app-error';

/**
 * Workflow-specific error codes
 */
export const WORKFLOW_ERROR_CODES = {
  // Builder-related errors
  BUILDER_NOT_INITIALIZED: 'BUILDER_NOT_INITIALIZED',
  BUILDER_EXECUTION_FAILED: 'BUILDER_EXECUTION_FAILED',

  // Context-related errors
  CONTEXT_INVALID: 'CONTEXT_INVALID',
  CONTEXT_PARSING_FAILED: 'CONTEXT_PARSING_FAILED',
  CONTEXT_UPDATE_FAILED: 'CONTEXT_UPDATE_FAILED',

  // Workflow execution errors
  WORKFLOW_ITERATION_LIMIT_EXCEEDED: 'WORKFLOW_ITERATION_LIMIT_EXCEEDED',
  WORKFLOW_EXECUTION_FAILED: 'WORKFLOW_EXECUTION_FAILED',
  WORKFLOW_INTERRUPTED: 'WORKFLOW_INTERRUPTED',
  WORKFLOW_STATE_INVALID: 'WORKFLOW_STATE_INVALID',

  // Agent communication errors
  AGENT_NOT_AVAILABLE: 'AGENT_NOT_AVAILABLE',
  AGENT_EXECUTION_FAILED: 'AGENT_EXECUTION_FAILED',
  AGENT_RESPONSE_INVALID: 'AGENT_RESPONSE_INVALID',

  // User input errors
  USER_INPUT_REQUIRED: 'USER_INPUT_REQUIRED',
  USER_INPUT_TIMEOUT: 'USER_INPUT_TIMEOUT',
  USER_INPUT_INVALID: 'USER_INPUT_INVALID'
} as const;

export type WorkflowErrorCode = typeof WORKFLOW_ERROR_CODES[keyof typeof WORKFLOW_ERROR_CODES];

/**
 * Factory for creating workflow-specific errors
 */
export class WorkflowErrorFactory extends ErrorFactory {

  /**
   * Builder initialization error
   */
  static builderNotInitialized(builderName: string, context?: Record<string, any>): AppError {
    return new AppError(
      `${builderName} is not initialized. Ensure the Master Agent is properly initialized before executing workflows.`,
      WORKFLOW_ERROR_CODES.BUILDER_NOT_INITIALIZED,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.CRITICAL,
        service: 'master-agent',
        operation: 'builder_access',
        metadata: { builderName, ...context },
        retryable: false,
        userFriendly: true
      }
    );
  }

  /**
   * Builder execution failure
   */
  static builderExecutionFailed(builderName: string, originalError: Error, context?: Record<string, any>): AppError {
    return new AppError(
      `${builderName} execution failed: ${originalError.message}`,
      WORKFLOW_ERROR_CODES.BUILDER_EXECUTION_FAILED,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.HIGH,
        service: 'master-agent',
        operation: 'builder_execution',
        metadata: { builderName, ...context },
        originalError,
        retryable: true,
        retryAfter: 5
      }
    );
  }

  /**
   * Context validation error
   */
  static contextInvalid(reason: string, context?: Record<string, any>): AppError {
    return new AppError(
      `Workflow context is invalid: ${reason}`,
      WORKFLOW_ERROR_CODES.CONTEXT_INVALID,
      {
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        service: 'master-agent',
        operation: 'context_validation',
        metadata: { reason, ...context },
        retryable: false,
        userFriendly: true
      }
    );
  }

  /**
   * Context parsing error
   */
  static contextParsingFailed(originalError: Error, contextSnippet?: string): AppError {
    return new AppError(
      `Failed to parse workflow context: ${originalError.message}`,
      WORKFLOW_ERROR_CODES.CONTEXT_PARSING_FAILED,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.MEDIUM,
        service: 'master-agent',
        operation: 'context_parsing',
        metadata: { contextSnippet: contextSnippet?.substring(0, 100) },
        originalError,
        retryable: true,
        retryAfter: 2
      }
    );
  }

  /**
   * Workflow iteration limit exceeded
   */
  static iterationLimitExceeded(currentIteration: number, maxIterations: number, sessionId: string): AppError {
    return new AppError(
      `Workflow execution reached maximum iterations (${maxIterations}). This may indicate a complex task requiring user intervention.`,
      WORKFLOW_ERROR_CODES.WORKFLOW_ITERATION_LIMIT_EXCEEDED,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        severity: ERROR_SEVERITY.MEDIUM,
        service: 'master-agent',
        operation: 'workflow_execution',
        metadata: { currentIteration, maxIterations, sessionId },
        retryable: false,
        userFriendly: true
      }
    );
  }

  /**
   * Agent not available error
   */
  static agentNotAvailable(agentName: string, reason?: string): AppError {
    return new AppError(
      `Agent '${agentName}' is not available${reason ? `: ${reason}` : ''}`,
      WORKFLOW_ERROR_CODES.AGENT_NOT_AVAILABLE,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.HIGH,
        service: 'agent-factory',
        operation: 'agent_access',
        metadata: { agentName, reason },
        retryable: true,
        retryAfter: 10,
        userFriendly: true
      }
    );
  }

  /**
   * Agent execution failure
   */
  static agentExecutionFailed(agentName: string, request: string, originalError: Error): AppError {
    return new AppError(
      `Agent '${agentName}' execution failed: ${originalError.message}`,
      WORKFLOW_ERROR_CODES.AGENT_EXECUTION_FAILED,
      {
        category: ERROR_CATEGORIES.EXTERNAL,
        severity: ERROR_SEVERITY.MEDIUM,
        service: agentName,
        operation: 'agent_execution',
        metadata: {
          agentName,
          request: request.substring(0, 100),
          originalErrorType: originalError.constructor.name
        },
        originalError,
        retryable: true,
        retryAfter: 5
      }
    );
  }

  /**
   * User input required (not an error, but a workflow pause)
   */
  static userInputRequired(requiredInfo: string, context?: Record<string, any>): AppError {
    return new AppError(
      `User input required: ${requiredInfo}`,
      WORKFLOW_ERROR_CODES.USER_INPUT_REQUIRED,
      {
        category: ERROR_CATEGORIES.BUSINESS,
        severity: ERROR_SEVERITY.LOW,
        service: 'master-agent',
        operation: 'workflow_pause',
        metadata: { requiredInfo, ...context },
        retryable: false,
        userFriendly: true
      }
    );
  }

  /**
   * Workflow state invalid
   */
  static workflowStateInvalid(currentState: string, expectedStates: string[], context?: Record<string, any>): AppError {
    return new AppError(
      `Invalid workflow state '${currentState}'. Expected one of: ${expectedStates.join(', ')}`,
      WORKFLOW_ERROR_CODES.WORKFLOW_STATE_INVALID,
      {
        category: ERROR_CATEGORIES.SERVICE,
        severity: ERROR_SEVERITY.HIGH,
        service: 'master-agent',
        operation: 'workflow_state_validation',
        metadata: { currentState, expectedStates, ...context },
        retryable: false,
        userFriendly: false
      }
    );
  }
}

/**
 * Workflow-specific error
 */
export class WorkflowError extends AppError {
  constructor(
    message: string,
    code: WorkflowErrorCode,
    options: {
      builderName?: string;
      agentName?: string;
      sessionId?: string;
      iteration?: number;
      contextSnippet?: string;
      [key: string]: any;
    } = {}
  ) {
    super(message, code, {
      ...options,
      category: ERROR_CATEGORIES.SERVICE,
      service: options.service || 'master-agent'
    });
  }
}