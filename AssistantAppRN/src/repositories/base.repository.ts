import type { AppError, RetryConfig, OfflineQueueItem, CacheConfig } from '../types';

export abstract class BaseRepository {
  protected retryConfig: RetryConfig;
  protected cacheConfig: CacheConfig;
  protected offlineQueue: OfflineQueueItem[] = [];
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor(retryConfig?: Partial<RetryConfig>, cacheConfig?: Partial<CacheConfig>) {
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      ...retryConfig,
    };
    
    this.cacheConfig = {
      ttl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100,
      ...cacheConfig,
    };
  }

  /**
   * Execute a repository operation with retry logic and error handling
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt === this.retryConfig.maxRetries) {
          const appError = this.createAppError(lastError, operationName, context);
          throw appError;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
          await this.delay(delay);
        }
      }
    }
    
    // This should never be reached, but just in case
    const appError = this.createAppError(lastError!, operationName, context);
    throw appError;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMIT_EXCEEDED',
    ];
    
    // Check if the error message contains any retryable error code
    return retryableErrors.some(code => error.message.includes(code));
  }

  /**
   * Create a standardized app error
   */
  private createAppError(error: Error, operationName: string, context?: any): AppError {
    return {
      code: this.extractErrorCode(error),
      message: `${operationName} failed: ${error.message}`,
      details: { operationName, context, originalError: error.message },
      retryable: this.isRetryableError(error),
    };
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: Error): string {
    if (error.message.includes('NETWORK_ERROR')) return 'NETWORK_ERROR';
    if (error.message.includes('TIMEOUT')) return 'TIMEOUT';
    if (error.message.includes('SERVICE_UNAVAILABLE')) return 'SERVICE_UNAVAILABLE';
    if (error.message.includes('RATE_LIMIT_EXCEEDED')) return 'RATE_LIMIT_EXCEEDED';
    if (error.message.includes('UNAUTHORIZED')) return 'UNAUTHORIZED';
    if (error.message.includes('FORBIDDEN')) return 'FORBIDDEN';
    if (error.message.includes('NOT_FOUND')) return 'NOT_FOUND';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Add item to offline queue
   */
  protected addToOfflineQueue(action: string, data: any): void {
    const queueItem: OfflineQueueItem = {
      id: `${action}_${Date.now()}_${Math.random()}`,
      action,
      data,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.offlineQueue.push(queueItem);
    this.persistOfflineQueue();
  }

  /**
   * Process offline queue when back online
   */
  protected async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    
    const itemsToProcess = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const item of itemsToProcess) {
      try {
        await this.processOfflineItem(item);
      } catch (error) {
        // Re-add to queue if still failing
        if (item.retryCount < this.retryConfig.maxRetries) {
          item.retryCount++;
          this.offlineQueue.push(item);
        }
      }
    }
    
    this.persistOfflineQueue();
  }

  /**
   * Process a single offline queue item
   */
  protected abstract processOfflineItem(item: OfflineQueueItem): Promise<void>;

  /**
   * Cache management methods
   */
  protected setCache(key: string, data: any): void {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  protected getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheConfig.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  protected clearCache(): void {
    this.cache.clear();
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Persist offline queue to storage
   */
  private persistOfflineQueue(): void {
    // TODO: Implement AsyncStorage persistence
    // For now, just keep in memory
  }

  /**
   * Load offline queue from storage
   */
  private loadOfflineQueue(): void {
    // TODO: Implement AsyncStorage loading
    // For now, just keep in memory
  }
}
