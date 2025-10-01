/**
 * Specialized Error Classes
 *
 * Domain-specific error classes that extend from the base AppError.
 * These provide additional type safety and specialized fields for different contexts.
 */

import { AppError, AppErrorOptions, ERROR_CATEGORIES } from '../utils/app-error';
import { ERROR_CODES, type ErrorCode } from './error-codes';

/**
 * API Client Error
 *
 * Specialized error for API client operations (Google, OpenAI, Slack, etc.)
 * Extends AppError with API-specific context like endpoint, status codes, and request IDs.
 */
export class APIClientError extends AppError {
  public readonly serviceName?: string;
  public readonly endpoint?: string;
  public readonly method?: string;
  public readonly requestId?: string;
  public readonly responseData?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    options: AppErrorOptions & {
      serviceName?: string;
      endpoint?: string;
      method?: string;
      requestId?: string;
      responseData?: Record<string, unknown>;
    } = {},
  ) {
    super(message, code, {
      ...options,
      category: options.category || ERROR_CATEGORIES.API,
    });

    this.name = 'APIClientError';
    this.serviceName = options.serviceName;
    this.endpoint = options.endpoint;
    this.method = options.method;
    this.requestId = options.requestId;
    this.responseData = options.responseData;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, APIClientError.prototype);
  }

  /**
   * Convert to JSON for logging (includes API-specific fields)
   */
  public toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      serviceName: this.serviceName,
      endpoint: this.endpoint,
      method: this.method,
      requestId: this.requestId,
      responseData: this.responseData,
    };
  }
}

/**
 * Workflow Error
 *
 * Specialized error for workflow execution (Master Agent, execution loops, etc.)
 * Extends AppError with workflow-specific context like iteration counts and workflow states.
 */
export class WorkflowError extends AppError {
  public readonly workflowId?: string;
  public readonly iteration?: number;
  public readonly maxIterations?: number;
  public readonly workflowState?: string;
  public readonly stepName?: string;

  constructor(
    message: string,
    code: ErrorCode,
    options: AppErrorOptions & {
      workflowId?: string;
      iteration?: number;
      maxIterations?: number;
      workflowState?: string;
      stepName?: string;
    } = {},
  ) {
    super(message, code, {
      ...options,
      category: options.category || ERROR_CATEGORIES.SERVICE,
    });

    this.name = 'WorkflowError';
    this.workflowId = options.workflowId;
    this.iteration = options.iteration;
    this.maxIterations = options.maxIterations;
    this.workflowState = options.workflowState;
    this.stepName = options.stepName;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, WorkflowError.prototype);
  }

  /**
   * Convert to JSON for logging (includes workflow-specific fields)
   */
  public toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      workflowId: this.workflowId,
      iteration: this.iteration,
      maxIterations: this.maxIterations,
      workflowState: this.workflowState,
      stepName: this.stepName,
    };
  }
}

/**
 * Domain Error
 *
 * Specialized error for domain service operations (Calendar, Email, Contacts, etc.)
 * Extends AppError with domain-specific context.
 */
export class DomainError extends AppError {
  public readonly domainName?: string;
  public readonly resourceId?: string;
  public readonly resourceType?: string;
  public readonly action?: string;

  constructor(
    message: string,
    code: ErrorCode,
    options: AppErrorOptions & {
      domainName?: string;
      resourceId?: string;
      resourceType?: string;
      action?: string;
    } = {},
  ) {
    super(message, code, {
      ...options,
      category: options.category || ERROR_CATEGORIES.SERVICE,
    });

    this.name = 'DomainError';
    this.domainName = options.domainName;
    this.resourceId = options.resourceId;
    this.resourceType = options.resourceType;
    this.action = options.action;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, DomainError.prototype);
  }

  /**
   * Convert to JSON for logging (includes domain-specific fields)
   */
  public toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      domainName: this.domainName,
      resourceId: this.resourceId,
      resourceType: this.resourceType,
      action: this.action,
    };
  }
}

/**
 * Validation Error
 *
 * Specialized error for validation failures
 * Extends AppError with validation-specific context like field names and validation rules.
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: unknown;
  public readonly rule?: string;
  public readonly constraints?: Record<string, unknown>;

  constructor(
    message: string,
    options: AppErrorOptions & {
      field?: string;
      value?: unknown;
      rule?: string;
      constraints?: Record<string, unknown>;
    } = {},
  ) {
    super(message, ERROR_CODES.VALIDATION_FAILED, {
      ...options,
      category: ERROR_CATEGORIES.VALIDATION,
    });

    this.name = 'ValidationError';
    this.field = options.field;
    this.value = options.value;
    this.rule = options.rule;
    this.constraints = options.constraints;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * Convert to JSON for logging (includes validation-specific fields)
   */
  public toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value,
      rule: this.rule,
      constraints: this.constraints,
    };
  }
}

/**
 * Authentication Error
 *
 * Specialized error for authentication failures
 * Extends AppError with auth-specific context.
 */
export class AuthenticationError extends AppError {
  public readonly authType?: string;
  public readonly provider?: string;
  public readonly reason?: string;

  constructor(
    message: string,
    code: ErrorCode,
    options: AppErrorOptions & {
      authType?: string;
      provider?: string;
      reason?: string;
    } = {},
  ) {
    super(message, code, {
      ...options,
      category: ERROR_CATEGORIES.AUTH,
    });

    this.name = 'AuthenticationError';
    this.authType = options.authType;
    this.provider = options.provider;
    this.reason = options.reason;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }

  /**
   * Convert to JSON for logging (includes auth-specific fields)
   */
  public toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      authType: this.authType,
      provider: this.provider,
      reason: this.reason,
    };
  }
}

// Re-export for convenience
export { AppError, ERROR_CODES, ERROR_CATEGORIES };
