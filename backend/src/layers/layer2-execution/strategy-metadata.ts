/**
 * Strategy Metadata System - Symbol-Based Type-Safe Registration
 *
 * BREAKING CHANGE: Replaces string-based strategy registration with compile-time safe symbols
 *
 * Benefits:
 * - Compile-time type safety (no typos possible)
 * - Auto-discovery through decorators
 * - Zero-config strategy addition
 * - Self-documenting architecture
 *
 * @example
 * ```typescript
 * @Strategy({
 *   type: StrategyType.METADATA_FILTER,
 *   name: 'Metadata Filter',
 *   description: 'Filters emails by metadata'
 * })
 * export class MetadataFilterStrategy extends BaseStrategy {
 *   // Implementation
 * }
 * ```
 */

import { BaseStrategy } from './strategies/base-strategy';

/**
 * Symbol-based strategy identifiers (compile-time safe)
 *
 * Using symbols instead of strings prevents typos and provides autocomplete
 */
export const StrategyType = {
  METADATA_FILTER: Symbol.for('metadata_filter'),
  KEYWORD_SEARCH: Symbol.for('keyword_search'),
  BATCH_THREAD_READ: Symbol.for('batch_thread_read'),
  CROSS_REFERENCE: Symbol.for('cross_reference'),
  SEMANTIC_ANALYSIS: Symbol.for('semantic_analysis'),
} as const;

export type StrategyTypeSymbol = typeof StrategyType[keyof typeof StrategyType];

/**
 * Get string representation of a strategy type symbol
 * Useful for logging and debugging
 */
export function strategyTypeToString(type: StrategyTypeSymbol): string {
  const entry = Object.entries(StrategyType).find(([, value]) => value === type);
  return entry ? entry[0].toLowerCase() : 'unknown';
}

/**
 * Strategy metadata for registration
 */
export interface StrategyMetadata {
  type: StrategyTypeSymbol;
  name: string;
  description: string;
  constructor: new (...args: any[]) => BaseStrategy;
  dependencies?: string[]; // DI dependency names
}

/**
 * Global strategy metadata store
 */
class StrategyMetadataStore {
  private strategies = new Map<StrategyTypeSymbol, StrategyMetadata>();

  register(metadata: StrategyMetadata): void {
    if (this.strategies.has(metadata.type)) {
      console.warn(
        `Strategy ${strategyTypeToString(metadata.type)} already registered, overwriting`
      );
    }
    this.strategies.set(metadata.type, metadata);
  }

  get(type: StrategyTypeSymbol): StrategyMetadata | undefined {
    return this.strategies.get(type);
  }

  getAll(): IterableIterator<StrategyMetadata> {
    return this.strategies.values();
  }

  has(type: StrategyTypeSymbol): boolean {
    return this.strategies.has(type);
  }

  clear(): void {
    this.strategies.clear();
  }
}

export const strategyMetadataStore = new StrategyMetadataStore();

/**
 * Decorator for auto-registering strategies
 *
 * Apply this to strategy classes to automatically register them in the metadata store
 *
 * @param config - Strategy metadata (type, name, description)
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @Strategy({
 *   type: StrategyType.METADATA_FILTER,
 *   name: 'Metadata Filter',
 *   description: 'Filters emails by metadata like date, sender, labels'
 * })
 * export class MetadataFilterStrategy extends BaseStrategy {
 *   readonly type = 'metadata_filter';
 *
 *   async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export function Strategy(config: Omit<StrategyMetadata, 'constructor'>) {
  return function <T extends new (...args: any[]) => BaseStrategy>(constructor: T) {
    strategyMetadataStore.register({
      ...config,
      constructor,
    });
    return constructor;
  };
}
