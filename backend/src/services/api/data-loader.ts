/**
 * Generic DataLoader for batching and caching
 *
 * Inspired by Facebook's DataLoader pattern:
 * - Automatic request batching within event loop tick
 * - Per-request caching to avoid duplicate fetches
 * - Graceful error handling (partial failures OK)
 * - Type-safe generic implementation
 *
 * @see https://github.com/graphql/dataloader
 *
 * @example
 * ```typescript
 * const emailLoader = new DataLoader(
 *   async (messageIds) => batchFetchEmails(messageIds),
 *   { maxBatchSize: 50 }
 * );
 *
 * // These 3 calls are automatically batched into 1 API request
 * const email1 = emailLoader.load('msg-1');
 * const email2 = emailLoader.load('msg-2');
 * const email3 = emailLoader.load('msg-3');
 * ```
 */

export interface DataLoaderOptions {
  /**
   * Maximum number of keys to batch together
   * Default: Infinity (no limit)
   */
  maxBatchSize?: number;

  /**
   * Enable per-request caching
   * Default: true
   */
  cacheEnabled?: boolean;

  /**
   * Function to schedule batch execution
   * Default: process.nextTick (Node.js event loop)
   */
  batchScheduleFn?: (callback: () => void) => void;

  /**
   * Custom cache key function
   * Default: key.toString()
   */
  cacheKeyFn?: (key: any) => string;
}

interface BatchItem<K, V> {
  key: K;
  resolve: (value: V) => void;
  reject: (error: Error) => void;
}

export class DataLoader<K, V> {
  private batchLoadFn: (keys: readonly K[]) => Promise<(V | Error)[]>;
  private options: Required<DataLoaderOptions>;
  private cache = new Map<string, Promise<V>>();
  private batch: BatchItem<K, V>[] = [];
  private batchScheduled = false;

  constructor(
    batchLoadFn: (keys: readonly K[]) => Promise<(V | Error)[]>,
    options: DataLoaderOptions = {}
  ) {
    this.batchLoadFn = batchLoadFn;
    this.options = {
      maxBatchSize: options.maxBatchSize ?? Infinity,
      cacheEnabled: options.cacheEnabled ?? true,
      batchScheduleFn: options.batchScheduleFn ?? process.nextTick,
      cacheKeyFn: options.cacheKeyFn ?? ((key: any) => String(key)),
    };
  }

  /**
   * Load a single value (automatically batched with other loads in same tick)
   *
   * @param key - The key to load
   * @returns Promise that resolves to the loaded value
   *
   * @example
   * ```typescript
   * const email = await emailLoader.load('msg-123');
   * ```
   */
  async load(key: K): Promise<V> {
    if (this.options.cacheEnabled) {
      const cacheKey = this.options.cacheKeyFn(key);
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const promise = new Promise<V>((resolve, reject) => {
      this.batch.push({ key, resolve, reject });

      if (!this.batchScheduled) {
        this.batchScheduled = true;
        this.options.batchScheduleFn(() => {
          this.dispatchBatch();
        });
      }
    });

    if (this.options.cacheEnabled) {
      const cacheKey = this.options.cacheKeyFn(key);
      this.cache.set(cacheKey, promise);
    }

    return promise;
  }

  /**
   * Load multiple values (automatically batched)
   *
   * @param keys - Array of keys to load
   * @returns Promise that resolves to array of values or errors
   *
   * @example
   * ```typescript
   * const results = await emailLoader.loadMany(['msg-1', 'msg-2', 'msg-3']);
   * ```
   */
  async loadMany(keys: readonly K[]): Promise<(V | Error)[]> {
    return Promise.all(keys.map(key => this.load(key).catch(err => err)));
  }

  /**
   * Clear cache for a specific key
   *
   * @param key - The key to clear from cache
   * @returns This DataLoader instance (for chaining)
   */
  clear(key: K): this {
    const cacheKey = this.options.cacheKeyFn(key);
    this.cache.delete(cacheKey);
    return this;
  }

  /**
   * Clear all cached values
   *
   * @returns This DataLoader instance (for chaining)
   */
  clearAll(): this {
    this.cache.clear();
    return this;
  }

  /**
   * Prime the cache with a value
   * Useful for preloading data you already have
   *
   * @param key - The key to prime
   * @param value - The value to cache
   * @returns This DataLoader instance (for chaining)
   */
  prime(key: K, value: V): this {
    if (this.options.cacheEnabled) {
      const cacheKey = this.options.cacheKeyFn(key);
      this.cache.set(cacheKey, Promise.resolve(value));
    }
    return this;
  }

  /**
   * Dispatch the batched requests
   * Called automatically by batch scheduler
   * @private
   */
  private async dispatchBatch(): Promise<void> {
    this.batchScheduled = false;
    const currentBatch = this.batch;
    this.batch = [];

    if (currentBatch.length === 0) return;

    // Split into chunks if max batch size is set
    const batches = this.chunkBatch(currentBatch);

    for (const batch of batches) {
      await this.processBatch(batch);
    }
  }

  /**
   * Split batch into chunks based on maxBatchSize
   * @private
   */
  private chunkBatch(batch: BatchItem<K, V>[]): BatchItem<K, V>[][] {
    if (this.options.maxBatchSize === Infinity) {
      return [batch];
    }

    const chunks: BatchItem<K, V>[][] = [];
    for (let i = 0; i < batch.length; i += this.options.maxBatchSize) {
      chunks.push(batch.slice(i, i + this.options.maxBatchSize));
    }
    return chunks;
  }

  /**
   * Process a single batch
   * @private
   */
  private async processBatch(batch: BatchItem<K, V>[]): Promise<void> {
    const keys = batch.map(item => item.key);

    try {
      const values = await this.batchLoadFn(keys);

      // Validate response length
      if (values.length !== keys.length) {
        const error = new Error(
          `DataLoader batch function returned ${values.length} values, expected ${keys.length}`
        );

        // Reject all items in batch
        for (const item of batch) {
          item.reject(error);
          this.clear(item.key); // Don't cache errors
        }
        return;
      }

      // Resolve or reject each item based on result
      for (let i = 0; i < batch.length; i++) {
        const value = values[i];
        const item = batch[i];

        if (!item) continue;

        if (value instanceof Error) {
          item.reject(value);
          this.clear(item.key); // Don't cache errors
        } else if (value !== undefined) {
          item.resolve(value);
        }
      }
    } catch (error) {
      // If batch fails completely, reject all requests
      const err = error instanceof Error ? error : new Error(String(error));
      for (const item of batch) {
        item.reject(err);
        this.clear(item.key); // Don't cache errors
      }
    }
  }
}
