/**
 * Agent Execution Context
 *
 * This class encapsulates execution context and eliminates the need
 * to thread context through every method call. It provides:
 * - Clean access to context properties
 * - Automatic correlation tracking
 * - Built-in metrics and event emission
 * - Child execution creation for nested operations
 */

import { AgentResult } from '../types/agents/agent-result';
import { AgentExecutionContext } from '../types/agents/natural-language.types';

/**
 * Simple event bus interface for agent execution events
 * Can be implemented with any event emitter (EventEmitter, custom, etc.)
 */
export interface EventBus {
  emit(event: string, data: any): void;
  on?(event: string, handler: (data: any) => void): void;
}

/**
 * Agent execution wrapper that encapsulates context and provides utilities
 *
 * Benefits:
 * - No more passing context through every method
 * - Automatic correlation tracking for logging
 * - Built-in duration tracking
 * - Event emission with auto-correlation
 * - Type-safe context access
 */
export class AgentExecution {
  private startTime: number;
  private operations: string[] = [];

  constructor(
    private context: AgentExecutionContext,
    private eventBus?: EventBus
  ) {
    this.startTime = Date.now();
  }

  // ========== Context Accessors ==========
  // Clean access to context without threading it through methods

  /** Unique session identifier */
  get sessionId(): string {
    return this.context.sessionId;
  }

  /** User identifier (may be undefined for unauthenticated requests) */
  get userId(): string | undefined {
    return this.context.userId;
  }

  /** Correlation ID for request tracing across services */
  get correlationId(): string {
    return this.context.correlationId;
  }

  /** Access token for OAuth-authenticated operations */
  get accessToken(): string | undefined {
    return this.context.accessToken;
  }

  /** Refresh token for OAuth token renewal */
  get refreshToken(): string | undefined {
    return this.context.refreshToken;
  }

  /** Token expiry timestamp for proactive refresh */
  get tokenExpiry(): number | undefined {
    return this.context.tokenExpiry;
  }

  /** Slack context if request originated from Slack */
  get slackContext(): any | undefined {
    return this.context.slackContext;
  }

  /** Request timestamp */
  get timestamp(): Date {
    return this.context.timestamp;
  }

  /** Additional metadata */
  get metadata(): Record<string, any> | undefined {
    return this.context.metadata;
  }

  /** Get the full context (use sparingly - prefer accessors) */
  get fullContext(): AgentExecutionContext {
    return this.context;
  }

  // ========== Event Emission ==========

  /**
   * Emit an event with automatic correlation tracking
   */
  emit(event: string, data: any = {}): void {
    if (!this.eventBus) return;

    this.eventBus.emit(event, {
      ...data,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  // ========== Execution Wrapper ==========

  /**
   * Execute an operation with automatic logging, metrics, and error handling
   *
   * This wrapper provides:
   * - Automatic event emission (started, completed, failed)
   * - Duration tracking
   * - Operation history for debugging
   * - Consistent error handling
   *
   * @param operationName - Name of the operation for logging/metrics
   * @param operation - The operation to execute
   * @returns The operation result
   */
  async execute<T>(
    operationName: string,
    operation: () => Promise<AgentResult<T>>
  ): Promise<AgentResult<T>> {
    this.operations.push(operationName);
    const operationStartTime = Date.now();

    this.emit('agent.operation.started', {
      operation: operationName,
      operationIndex: this.operations.length,
    });

    try {
      const result = await operation();

      const duration = Date.now() - operationStartTime;

      this.emit('agent.operation.completed', {
        operation: operationName,
        success: result.ok,
        duration,
        operationIndex: this.operations.length,
      });

      // Add duration to metadata
      if (result.ok) {
        if (!result.metadata) {
          result.metadata = { operation: operationName, duration };
        } else {
          result.metadata.duration = duration;
        }
      }

      return result;
    } catch (error) {
      const duration = Date.now() - operationStartTime;

      this.emit('agent.operation.failed', {
        operation: operationName,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
        duration,
        operationIndex: this.operations.length,
      });

      // Re-throw to let caller handle
      throw error;
    }
  }

  // ========== Child Execution ==========

  /**
   * Create a child execution context for nested operations
   *
   * Useful when delegating to sub-agents or creating execution scopes.
   * Child contexts inherit parent context but can have additional metadata.
   *
   * @param additionalMetadata - Extra metadata for the child context
   * @returns New AgentExecution instance with child context
   */
  createChild(additionalMetadata?: Record<string, any>): AgentExecution {
    const childContext: AgentExecutionContext = {
      ...this.context,
      metadata: {
        ...this.context.metadata,
        ...additionalMetadata,
        parentCorrelationId: this.correlationId,
      },
      // Generate new correlation ID for child (keeps parent in metadata)
      correlationId: `${this.correlationId}-child-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    };

    return new AgentExecution(childContext, this.eventBus);
  }

  // ========== Metrics & Debugging ==========

  /**
   * Get total execution duration since creation
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get history of operations executed in this context
   */
  getOperationHistory(): string[] {
    return [...this.operations];
  }

  /**
   * Get execution summary for logging/debugging
   */
  getSummary(): {
    sessionId: string;
    userId?: string;
    correlationId: string;
    duration: number;
    operations: string[];
    operationCount: number;
  } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      correlationId: this.correlationId,
      duration: this.getDuration(),
      operations: this.getOperationHistory(),
      operationCount: this.operations.length,
    };
  }

  // ========== Context Updates ==========

  /**
   * Update metadata (use sparingly - context should be mostly immutable)
   */
  updateMetadata(updates: Record<string, any>): void {
    this.context.metadata = {
      ...this.context.metadata,
      ...updates,
    };
  }

  /**
   * Check if execution has required authentication
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Check if execution is from Slack
   */
  isFromSlack(): boolean {
    return !!this.slackContext;
  }
}

/**
 * Create an execution context with sensible defaults
 */
export function createExecution(
  params: {
    sessionId?: string;
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
    slackContext?: any;
    correlationId?: string;
    metadata?: Record<string, any>;
  },
  eventBus?: EventBus
): AgentExecution {
  const context: AgentExecutionContext = {
    sessionId: params.sessionId || `session-${Date.now()}`,
    userId: params.userId,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    tokenExpiry: params.tokenExpiry,
    slackContext: params.slackContext,
    correlationId: params.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    metadata: params.metadata,
  };

  return new AgentExecution(context, eventBus);
}