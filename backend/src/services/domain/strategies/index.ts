/**
 * Domain Operation Strategies
 *
 * Central export point for all domain operation strategies.
 */

export { BaseOperationStrategy } from './base-operation-strategy';
export type { IOperationStrategy, OperationContext, OperationResult } from './base-operation-strategy';

export { OperationExecutor } from './operation-executor';

// Export all domain-specific strategies
// Email strategies removed - legacy OAuth pattern no longer used
