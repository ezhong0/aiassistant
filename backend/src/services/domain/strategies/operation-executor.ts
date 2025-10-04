import { BaseService } from '../../base-service';
import { IOperationStrategy, OperationContext, OperationResult } from './base-operation-strategy';
import { ErrorFactory } from '../../../errors';

/**
 * Operation Executor
 *
 * Central service that routes operations to appropriate strategies.
 * Manages strategy lifecycle and provides a unified interface for executing
 * domain operations.
 *
 * This follows the Command pattern combined with Strategy pattern:
 * - Commands are represented by operation names
 * - Strategies implement the actual business logic
 * - Executor routes commands to strategies
 */
export class OperationExecutor extends BaseService {
  private strategies: Map<string, IOperationStrategy<any, any>> = new Map();

  constructor() {
    super('OperationExecutor');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Operation Executor initialized', {
      registeredStrategies: this.strategies.size
    });
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.strategies.clear();
    this.logInfo('Operation Executor destroyed');
  }

  /**
   * Register a strategy for handling operations
   */
  registerStrategy(strategy: IOperationStrategy<any, any>): void {
    if (this.strategies.has(strategy.name)) {
      this.logWarn('Overwriting existing strategy', { name: strategy.name });
    }

    this.strategies.set(strategy.name, strategy);
    this.logInfo('Strategy registered', {
      name: strategy.name,
      domain: strategy.domain,
      requiresAuth: strategy.requiresAuth
    });
  }

  /**
   * Register multiple strategies at once
   */
  registerStrategies(strategies: IOperationStrategy<any, any>[]): void {
    for (const strategy of strategies) {
      this.registerStrategy(strategy);
    }
  }

  /**
   * Get a strategy by name
   */
  getStrategy(operationName: string): IOperationStrategy<any, any> | undefined {
    return this.strategies.get(operationName);
  }

  /**
   * Check if a strategy is registered
   */
  hasStrategy(operationName: string): boolean {
    return this.strategies.has(operationName);
  }

  /**
   * Get all registered strategies for a domain
   */
  getStrategiesForDomain(domain: string): IOperationStrategy<any, any>[] {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.domain === domain);
  }

  /**
   * Execute an operation using the appropriate strategy
   */
  async execute<TInput, TOutput>(
    operationName: string,
    input: TInput,
    context: OperationContext
  ): Promise<OperationResult<TOutput>> {
    this.assertReady();

    const startTime = Date.now();
    const correlationId = context.correlationId || `op-${Date.now()}`;

    this.logInfo('Executing operation', {
      operationName,
      userId: context.userId,
      correlationId
    });

    // Find strategy
    const strategy = this.strategies.get(operationName);
    if (!strategy) {
      const error = `No strategy found for operation: ${operationName}`;
      this.logError(error, new Error(error), { operationName, availableStrategies: Array.from(this.strategies.keys()) });
      return {
        success: false,
        error,
        metadata: {
          correlationId,
          executionTime: Date.now() - startTime
        }
      };
    }

    try {
      // Validate input
      const validation = await strategy.validate(input, context);
      if (!validation.valid) {
        this.logWarn('Operation validation failed', {
          operationName,
          errors: validation.errors,
          correlationId
        });
        return {
          success: false,
          error: `Validation failed: ${validation.errors?.join(', ')}`,
          metadata: {
            correlationId,
            validationErrors: validation.errors,
            executionTime: Date.now() - startTime
          }
        };
      }

      // Execute strategy
      const result = await strategy.execute(input, context);

      const executionTime = Date.now() - startTime;
      this.logInfo('Operation executed', {
        operationName,
        success: result.success,
        executionTime,
        correlationId
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          correlationId,
          executionTime
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logError('Operation execution failed', error as Error, {
        operationName,
        userId: context.userId,
        correlationId,
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          correlationId,
          executionTime,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        }
      };
    }
  }

  /**
   * Get operation metadata (for introspection/debugging)
   */
  getOperationMetadata() {
    return {
      totalStrategies: this.strategies.size,
      strategies: Array.from(this.strategies.values()).map(strategy => ({
        name: strategy.name,
        domain: strategy.domain,
        requiresAuth: strategy.requiresAuth
      })),
      domains: [...new Set(Array.from(this.strategies.values()).map(s => s.domain))]
    };
  }
}
