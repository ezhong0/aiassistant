/**
 * Strategy Registry
 *
 * Registry for all Layer 2 strategy executors.
 * Maps strategy types to their executor implementations.
 */

import { StrategyExecutor, InformationNodeType } from './execution.types';

export class StrategyRegistry {
  private strategies: Map<InformationNodeType, StrategyExecutor> = new Map();

  /**
   * Register a strategy executor
   */
  register(type: InformationNodeType, executor: StrategyExecutor): void {
    this.strategies.set(type, executor);
  }

  /**
   * Get a strategy executor by type
   */
  get(type: InformationNodeType): StrategyExecutor {
    const executor = this.strategies.get(type);
    if (!executor) {
      throw new Error(`No strategy executor registered for type: ${type}`);
    }
    return executor;
  }

  /**
   * Check if a strategy is registered
   */
  has(type: InformationNodeType): boolean {
    return this.strategies.has(type);
  }

  /**
   * Get all registered strategy types
   */
  getRegisteredTypes(): InformationNodeType[] {
    return Array.from(this.strategies.keys());
  }
}
