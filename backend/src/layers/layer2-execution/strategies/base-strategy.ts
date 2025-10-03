/**
 * Base Strategy Executor
 *
 * Abstract base class for all strategy executors.
 * Provides common functionality and logging.
 */

import { StrategyExecutor, NodeResult } from '../execution.types';
import logger from '../../../utils/logger';

export abstract class BaseStrategy implements StrategyExecutor {
  abstract readonly type: string;

  constructor() {}

  /**
   * Execute the strategy
   * @param params - Strategy-specific parameters
   * @param userId - User ID for authentication
   * @returns Node result with data or error
   */
  abstract execute(params: Record<string, unknown>, userId: string): Promise<NodeResult>;

  /**
   * Create a success result
   */
  protected createSuccessResult(nodeId: string, data: unknown, tokensUsed: number): NodeResult {
    return {
      success: true,
      node_id: nodeId,
      data: data as any,
      tokens_used: tokensUsed
    };
  }

  /**
   * Create an error result
   */
  protected createErrorResult(nodeId: string, error: string): NodeResult {
    return {
      success: false,
      node_id: nodeId,
      error,
      tokens_used: 0
    };
  }

  /**
   * Log strategy execution
   */
  protected log(message: string, metadata?: Record<string, unknown>): void {
    logger.info(message, {
      strategy: this.type,
      ...metadata
    });
  }
}
