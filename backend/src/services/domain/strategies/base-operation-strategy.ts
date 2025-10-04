/**
 * Base Operation Strategy
 *
 * Defines the contract for all domain operation strategies.
 * Each strategy encapsulates a single domain operation with its own
 * validation, execution, and error handling logic.
 *
 * Benefits:
 * - Single Responsibility: Each strategy handles one operation
 * - Open/Closed: Easy to add new operations without modifying existing code
 * - Testability: Each operation can be tested in isolation
 * - Composability: Strategies can be combined and chained
 */

export interface OperationContext {
  userId: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base interface for all domain operation strategies
 */
export interface IOperationStrategy<TInput, TOutput> {
  /**
   * Name of the operation (e.g., 'send_email', 'create_event')
   */
  readonly name: string;

  /**
   * Domain this operation belongs to (e.g., 'email', 'calendar')
   */
  readonly domain: string;

  /**
   * Whether this operation requires authentication
   */
  readonly requiresAuth: boolean;

  /**
   * Validate input parameters before execution
   */
  validate(input: TInput, context: OperationContext): Promise<{ valid: boolean; errors?: string[] }>;

  /**
   * Execute the operation
   */
  execute(input: TInput, context: OperationContext): Promise<OperationResult<TOutput>>;

  /**
   * Check if this strategy can handle the given operation name
   */
  canHandle(operationName: string): boolean;
}

/**
 * Abstract base class for operation strategies
 * Provides common functionality and enforces the strategy contract
 */
export abstract class BaseOperationStrategy<TInput, TOutput> implements IOperationStrategy<TInput, TOutput> {
  constructor(
    public readonly name: string,
    public readonly domain: string,
    public readonly requiresAuth: boolean = true
  ) {}

  /**
   * Default validation - override for custom validation
   */
  async validate(input: TInput, context: OperationContext): Promise<{ valid: boolean; errors?: string[] }> {
    // Basic validation - check for required fields
    if (!input) {
      return { valid: false, errors: ['Input is required'] };
    }
    if (!context.userId) {
      return { valid: false, errors: ['userId is required in context'] };
    }
    return { valid: true };
  }

  /**
   * Execute the operation - must be implemented by subclasses
   */
  abstract execute(input: TInput, context: OperationContext): Promise<OperationResult<TOutput>>;

  /**
   * Check if this strategy can handle the given operation name
   */
  canHandle(operationName: string): boolean {
    return operationName === this.name;
  }

  /**
   * Helper method to create success result
   */
  protected success(data: TOutput, metadata?: Record<string, unknown>): OperationResult<TOutput> {
    return {
      success: true,
      data,
      metadata
    };
  }

  /**
   * Helper method to create error result
   */
  protected error(error: string, metadata?: Record<string, unknown>): OperationResult<TOutput> {
    return {
      success: false,
      error,
      metadata
    };
  }
}
