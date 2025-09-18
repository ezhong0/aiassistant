/**
 * Cache Consistency Service
 * Provides different consistency levels for cache operations based on data sensitivity and use case
 *
 * Consistency Levels:
 * - REALTIME: Always fresh data (0s TTL) - for critical operations
 * - EVENTUAL: Standard TTL strategy - for normal operations
 * - BEST_EFFORT: Extended TTL for performance - for non-critical operations
 * - ADAPTIVE: Dynamic TTL based on usage patterns and data change frequency
 *
 * Features:
 * - Automatic consistency level detection based on operation type
 * - Dynamic TTL adjustment based on data access patterns
 * - Consistency scoring and monitoring
 * - Graceful degradation when consistency requirements can't be met
 */

import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { ServiceManager } from './service-manager';

export enum ConsistencyLevel {
  REALTIME = 0,     // Always fresh (bypass cache or 0 TTL)
  EVENTUAL = 1,     // Standard TTL strategy (current implementation)
  BEST_EFFORT = 2,  // Extended TTL for performance
  ADAPTIVE = 3      // Dynamic TTL based on patterns
}

export enum OperationType {
  // High consistency operations
  FINANCIAL = 'financial',
  BOOKING = 'booking',
  AVAILABILITY_CHECK = 'availability_check',
  TOKEN_VALIDATION = 'token_validation',

  // Medium consistency operations
  EMAIL_SEND = 'email_send',
  CALENDAR_CREATE = 'calendar_create',
  CONTACT_UPDATE = 'contact_update',

  // Low consistency operations
  EMAIL_SEARCH = 'email_search',
  CONTACT_SEARCH = 'contact_search',
  CALENDAR_LIST = 'calendar_list',
  USER_PROFILE = 'user_profile'
}

export interface ConsistencyRule {
  operationType: OperationType;
  defaultLevel: ConsistencyLevel;
  maxStaleness: number; // Maximum age in seconds
  fallbackLevel: ConsistencyLevel;
  conditions?: {
    timeOfDay?: string; // e.g., "business_hours"
    userContext?: string; // e.g., "meeting_in_progress"
    systemLoad?: string; // e.g., "high_load"
  };
}

export interface CacheOperation {
  key: string;
  operationType: OperationType;
  userId?: string;
  requiredLevel?: ConsistencyLevel;
  context?: Record<string, any>;
}

export interface ConsistencyMetrics {
  operationsByLevel: Record<ConsistencyLevel, number>;
  averageResponseTime: Record<ConsistencyLevel, number>;
  consistencyViolations: number;
  adaptiveAdjustments: number;
  lastViolation: Date | null;
}

export interface DataPattern {
  key: string;
  accessCount: number;
  lastAccessed: Date;
  averageAccessInterval: number;
  changeFrequency: number;
  consistencyScore: number;
}

export class CacheConsistencyService extends BaseService {
  private cacheService: CacheService | null = null;
  private metrics: ConsistencyMetrics = {
    operationsByLevel: {
      [ConsistencyLevel.REALTIME]: 0,
      [ConsistencyLevel.EVENTUAL]: 0,
      [ConsistencyLevel.BEST_EFFORT]: 0,
      [ConsistencyLevel.ADAPTIVE]: 0
    },
    averageResponseTime: {
      [ConsistencyLevel.REALTIME]: 0,
      [ConsistencyLevel.EVENTUAL]: 0,
      [ConsistencyLevel.BEST_EFFORT]: 0,
      [ConsistencyLevel.ADAPTIVE]: 0
    },
    consistencyViolations: 0,
    adaptiveAdjustments: 0,
    lastViolation: null
  };

  // Data access patterns for adaptive consistency
  private dataPatterns: Map<string, DataPattern> = new Map();

  // Consistency rules mapping
  private readonly consistencyRules: Record<OperationType, ConsistencyRule> = {
    // High consistency operations
    [OperationType.FINANCIAL]: {
      operationType: OperationType.FINANCIAL,
      defaultLevel: ConsistencyLevel.REALTIME,
      maxStaleness: 0,
      fallbackLevel: ConsistencyLevel.REALTIME
    },
    [OperationType.BOOKING]: {
      operationType: OperationType.BOOKING,
      defaultLevel: ConsistencyLevel.REALTIME,
      maxStaleness: 30,
      fallbackLevel: ConsistencyLevel.EVENTUAL
    },
    [OperationType.AVAILABILITY_CHECK]: {
      operationType: OperationType.AVAILABILITY_CHECK,
      defaultLevel: ConsistencyLevel.REALTIME,
      maxStaleness: 300, // 5 minutes
      fallbackLevel: ConsistencyLevel.EVENTUAL
    },
    [OperationType.TOKEN_VALIDATION]: {
      operationType: OperationType.TOKEN_VALIDATION,
      defaultLevel: ConsistencyLevel.REALTIME,
      maxStaleness: 60,
      fallbackLevel: ConsistencyLevel.EVENTUAL
    },

    // Medium consistency operations
    [OperationType.EMAIL_SEND]: {
      operationType: OperationType.EMAIL_SEND,
      defaultLevel: ConsistencyLevel.EVENTUAL,
      maxStaleness: 300,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    },
    [OperationType.CALENDAR_CREATE]: {
      operationType: OperationType.CALENDAR_CREATE,
      defaultLevel: ConsistencyLevel.EVENTUAL,
      maxStaleness: 600,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    },
    [OperationType.CONTACT_UPDATE]: {
      operationType: OperationType.CONTACT_UPDATE,
      defaultLevel: ConsistencyLevel.EVENTUAL,
      maxStaleness: 1800,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    },

    // Low consistency operations
    [OperationType.EMAIL_SEARCH]: {
      operationType: OperationType.EMAIL_SEARCH,
      defaultLevel: ConsistencyLevel.BEST_EFFORT,
      maxStaleness: 3600,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    },
    [OperationType.CONTACT_SEARCH]: {
      operationType: OperationType.CONTACT_SEARCH,
      defaultLevel: ConsistencyLevel.BEST_EFFORT,
      maxStaleness: 7200,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    },
    [OperationType.CALENDAR_LIST]: {
      operationType: OperationType.CALENDAR_LIST,
      defaultLevel: ConsistencyLevel.BEST_EFFORT,
      maxStaleness: 14400,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    },
    [OperationType.USER_PROFILE]: {
      operationType: OperationType.USER_PROFILE,
      defaultLevel: ConsistencyLevel.BEST_EFFORT,
      maxStaleness: 3600,
      fallbackLevel: ConsistencyLevel.BEST_EFFORT
    }
  };

  constructor() {
    super('CacheConsistencyService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Cache Consistency Service...');

    try {
      // Get dependencies from service manager
      const serviceManager = ServiceManager.getInstance();
      this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;

      if (!this.cacheService) {
        this.logWarn('CacheService not available - consistency management disabled');
        return;
      }

      // Load existing metrics and patterns
      await this.loadMetrics();
      await this.loadDataPatterns();

      this.logInfo('Cache Consistency Service initialized successfully', {
        rulesCount: Object.keys(this.consistencyRules).length,
        patternsCount: this.dataPatterns.size
      });

    } catch (error) {
      this.logError('Failed to initialize Cache Consistency Service', error);
      throw error;
    }
  }

  /**
   * Determine appropriate consistency level for an operation
   */
  determineConsistencyLevel(operation: CacheOperation): ConsistencyLevel {
    try {
      // Use explicitly requested level if provided
      if (operation.requiredLevel !== undefined) {
        this.logDebug('Using explicitly requested consistency level', {
          key: operation.key,
          level: operation.requiredLevel
        });
        return operation.requiredLevel;
      }

      // Get rule for operation type
      const rule = this.consistencyRules[operation.operationType];
      if (!rule) {
        this.logWarn('No consistency rule found for operation type', {
          operationType: operation.operationType
        });
        return ConsistencyLevel.EVENTUAL; // Safe default
      }

      // Check adaptive consistency for this key
      const pattern = this.dataPatterns.get(operation.key);
      if (pattern && rule.defaultLevel === ConsistencyLevel.ADAPTIVE) {
        return this.determineAdaptiveLevel(pattern, rule);
      }

      // Apply contextual adjustments
      const contextualLevel = this.applyContextualAdjustments(rule, operation.context);

      this.logDebug('Determined consistency level', {
        key: operation.key,
        operationType: operation.operationType,
        level: contextualLevel,
        rule: rule.defaultLevel
      });

      return contextualLevel;

    } catch (error) {
      this.logError('Failed to determine consistency level', { operation, error });
      return ConsistencyLevel.EVENTUAL; // Safe fallback
    }
  }

  /**
   * Get cache value with consistency level enforcement
   */
  async getCacheWithConsistency<T>(operation: CacheOperation): Promise<{
    value: T | null;
    level: ConsistencyLevel;
    fresh: boolean;
    source: 'cache' | 'forced_refresh';
  }> {
    if (!this.cacheService) {
      return {
        value: null,
        level: ConsistencyLevel.REALTIME,
        fresh: false,
        source: 'forced_refresh'
      };
    }

    const startTime = Date.now();
    const level = this.determineConsistencyLevel(operation);

    try {
      // Update access pattern
      this.updateAccessPattern(operation.key);

      // Handle REALTIME consistency (always fresh)
      if (level === ConsistencyLevel.REALTIME) {
        this.updateMetrics(level, Date.now() - startTime);
        return {
          value: null,
          level,
          fresh: true,
          source: 'forced_refresh'
        };
      }

      // Get from cache
      const cached = await this.cacheService.get<{
        data: T;
        timestamp: number;
        level: ConsistencyLevel;
      }>(operation.key);

      if (!cached) {
        this.updateMetrics(level, Date.now() - startTime);
        return {
          value: null,
          level,
          fresh: true,
          source: 'forced_refresh'
        };
      }

      // Check staleness
      const age = Date.now() - cached.timestamp;
      const maxStaleness = this.getMaxStaleness(operation.operationType, level);

      if (age > maxStaleness * 1000) {
        // Data is too stale for required consistency level
        this.recordConsistencyViolation(operation, age, maxStaleness);

        const rule = this.consistencyRules[operation.operationType];
        if (rule && rule.fallbackLevel !== level) {
          // Try fallback level
          const fallbackMaxStaleness = this.getMaxStaleness(operation.operationType, rule.fallbackLevel);
          if (age <= fallbackMaxStaleness * 1000) {
            this.logInfo('Using fallback consistency level', {
              key: operation.key,
              originalLevel: level,
              fallbackLevel: rule.fallbackLevel,
              age: `${Math.round(age / 1000)}s`
            });

            this.updateMetrics(rule.fallbackLevel, Date.now() - startTime);
            return {
              value: cached.data,
              level: rule.fallbackLevel,
              fresh: false,
              source: 'cache'
            };
          }
        }

        // Force refresh
        this.updateMetrics(level, Date.now() - startTime);
        return {
          value: null,
          level,
          fresh: true,
          source: 'forced_refresh'
        };
      }

      // Data meets consistency requirements
      this.updateMetrics(level, Date.now() - startTime);
      return {
        value: cached.data,
        level,
        fresh: age < 60000, // Consider fresh if less than 1 minute old
        source: 'cache'
      };

    } catch (error) {
      this.logError('Failed to get cache with consistency', { operation, level, error });
      this.updateMetrics(level, Date.now() - startTime);
      return {
        value: null,
        level,
        fresh: true,
        source: 'forced_refresh'
      };
    }
  }

  /**
   * Set cache value with consistency level
   */
  async setCacheWithConsistency<T>(
    operation: CacheOperation,
    value: T,
    level?: ConsistencyLevel
  ): Promise<void> {
    if (!this.cacheService) return;

    const consistencyLevel = level || this.determineConsistencyLevel(operation);
    const ttl = this.getTTLForLevel(operation.operationType, consistencyLevel);

    // Don't cache REALTIME data
    if (consistencyLevel === ConsistencyLevel.REALTIME) {
      return;
    }

    try {
      const cacheData = {
        data: value,
        timestamp: Date.now(),
        level: consistencyLevel
      };

      await this.cacheService.set(operation.key, cacheData, ttl);

      // Update data pattern
      this.updateDataPattern(operation.key, value);

      this.logDebug('Set cache with consistency level', {
        key: operation.key,
        level: consistencyLevel,
        ttl
      });

    } catch (error) {
      this.logError('Failed to set cache with consistency', { operation, level, error });
    }
  }

  /**
   * Determine adaptive consistency level based on data patterns
   */
  private determineAdaptiveLevel(pattern: DataPattern, rule: ConsistencyRule): ConsistencyLevel {
    try {
      // High access frequency with low change frequency = can use longer TTL
      if (pattern.accessCount > 10 && pattern.changeFrequency < 0.1) {
        this.metrics.adaptiveAdjustments++;
        this.logDebug('Adaptive: Using BEST_EFFORT for stable, frequently accessed data', {
          key: pattern.key,
          accessCount: pattern.accessCount,
          changeFrequency: pattern.changeFrequency
        });
        return ConsistencyLevel.BEST_EFFORT;
      }

      // High change frequency = needs shorter TTL
      if (pattern.changeFrequency > 0.5) {
        this.metrics.adaptiveAdjustments++;
        this.logDebug('Adaptive: Using REALTIME for frequently changing data', {
          key: pattern.key,
          changeFrequency: pattern.changeFrequency
        });
        return ConsistencyLevel.REALTIME;
      }

      // Recent access with medium change frequency = eventual consistency
      const timeSinceLastAccess = Date.now() - pattern.lastAccessed.getTime();
      if (timeSinceLastAccess < 300000 && pattern.changeFrequency < 0.3) { // 5 minutes
        this.metrics.adaptiveAdjustments++;
        return ConsistencyLevel.EVENTUAL;
      }

      // Default to rule's fallback level
      return rule.fallbackLevel;

    } catch (error) {
      this.logError('Failed to determine adaptive level', { pattern, rule, error });
      return rule.fallbackLevel;
    }
  }

  /**
   * Apply contextual adjustments to consistency level
   */
  private applyContextualAdjustments(
    rule: ConsistencyRule,
    context?: Record<string, any>
  ): ConsistencyLevel {
    let level = rule.defaultLevel;

    if (!context || !rule.conditions) {
      return level;
    }

    try {
      // Time-based adjustments
      if (rule.conditions.timeOfDay === 'business_hours' && this.isBusinessHours()) {
        // Higher consistency during business hours
        if (level === ConsistencyLevel.BEST_EFFORT) {
          level = ConsistencyLevel.EVENTUAL;
        }
      }

      // User context adjustments
      if (rule.conditions.userContext === 'meeting_in_progress' && context.inMeeting) {
        // Higher consistency during meetings
        if (level === ConsistencyLevel.BEST_EFFORT) {
          level = ConsistencyLevel.EVENTUAL;
        } else if (level === ConsistencyLevel.EVENTUAL) {
          level = ConsistencyLevel.REALTIME;
        }
      }

      // System load adjustments
      if (rule.conditions.systemLoad === 'high_load' && context.systemLoad === 'high') {
        // Lower consistency under high load
        if (level === ConsistencyLevel.REALTIME) {
          level = ConsistencyLevel.EVENTUAL;
        } else if (level === ConsistencyLevel.EVENTUAL) {
          level = ConsistencyLevel.BEST_EFFORT;
        }
      }

      return level;

    } catch (error) {
      this.logError('Failed to apply contextual adjustments', { rule, context, error });
      return rule.defaultLevel;
    }
  }

  /**
   * Get TTL for consistency level
   */
  private getTTLForLevel(operationType: OperationType, level: ConsistencyLevel): number {
    const rule = this.consistencyRules[operationType];
    const baseTTL = rule?.maxStaleness || 300;

    switch (level) {
      case ConsistencyLevel.REALTIME:
        return 0; // No caching
      case ConsistencyLevel.EVENTUAL:
        return baseTTL;
      case ConsistencyLevel.BEST_EFFORT:
        return baseTTL * 2; // Extended TTL
      case ConsistencyLevel.ADAPTIVE:
        return baseTTL; // Default, will be adjusted dynamically
      default:
        return baseTTL;
    }
  }

  /**
   * Get maximum staleness for operation type and level
   */
  private getMaxStaleness(operationType: OperationType, level: ConsistencyLevel): number {
    const rule = this.consistencyRules[operationType];
    const baseStaleness = rule?.maxStaleness || 300;

    switch (level) {
      case ConsistencyLevel.REALTIME:
        return 0;
      case ConsistencyLevel.EVENTUAL:
        return baseStaleness;
      case ConsistencyLevel.BEST_EFFORT:
        return baseStaleness * 3; // More tolerant of staleness
      case ConsistencyLevel.ADAPTIVE:
        return baseStaleness;
      default:
        return baseStaleness;
    }
  }

  /**
   * Update access pattern for adaptive consistency
   */
  private updateAccessPattern(key: string): void {
    const now = new Date();
    const existing = this.dataPatterns.get(key);

    if (existing) {
      const timeSinceLastAccess = now.getTime() - existing.lastAccessed.getTime();
      const newInterval = (existing.averageAccessInterval + timeSinceLastAccess) / 2;

      existing.accessCount++;
      existing.lastAccessed = now;
      existing.averageAccessInterval = newInterval;
    } else {
      this.dataPatterns.set(key, {
        key,
        accessCount: 1,
        lastAccessed: now,
        averageAccessInterval: 0,
        changeFrequency: 0,
        consistencyScore: 100
      });
    }
  }

  /**
   * Update data pattern when data changes
   */
  private updateDataPattern(key: string, newValue: any): void {
    const pattern = this.dataPatterns.get(key);
    if (!pattern) return;

    // Simple change detection (in production, use more sophisticated comparison)
    const currentDataHash = JSON.stringify(newValue).length;
    if (pattern.consistencyScore !== currentDataHash) {
      pattern.changeFrequency = Math.min(pattern.changeFrequency + 0.1, 1.0);
      pattern.consistencyScore = currentDataHash;
    }
  }

  /**
   * Record consistency violation
   */
  private recordConsistencyViolation(
    operation: CacheOperation,
    actualAge: number,
    maxAge: number
  ): void {
    this.metrics.consistencyViolations++;
    this.metrics.lastViolation = new Date();

    this.logWarn('Consistency violation detected', {
      key: operation.key,
      operationType: operation.operationType,
      actualAge: `${Math.round(actualAge / 1000)}s`,
      maxAge: `${maxAge}s`,
      violation: `${Math.round((actualAge - maxAge * 1000) / 1000)}s over limit`
    });
  }

  /**
   * Update consistency metrics
   */
  private updateMetrics(level: ConsistencyLevel, responseTime: number): void {
    this.metrics.operationsByLevel[level]++;

    const currentAvg = this.metrics.averageResponseTime[level];
    this.metrics.averageResponseTime[level] = currentAvg === 0 ?
      responseTime : (currentAvg + responseTime) / 2;
  }

  /**
   * Utility methods
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Monday to Friday, 9 AM to 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Get consistency metrics
   */
  getMetrics(): ConsistencyMetrics {
    return { ...this.metrics };
  }

  /**
   * Get data patterns for analysis
   */
  getDataPatterns(): DataPattern[] {
    return Array.from(this.dataPatterns.values());
  }

  /**
   * Reset consistency metrics
   */
  async resetMetrics(): Promise<void> {
    this.metrics = {
      operationsByLevel: {
        [ConsistencyLevel.REALTIME]: 0,
        [ConsistencyLevel.EVENTUAL]: 0,
        [ConsistencyLevel.BEST_EFFORT]: 0,
        [ConsistencyLevel.ADAPTIVE]: 0
      },
      averageResponseTime: {
        [ConsistencyLevel.REALTIME]: 0,
        [ConsistencyLevel.EVENTUAL]: 0,
        [ConsistencyLevel.BEST_EFFORT]: 0,
        [ConsistencyLevel.ADAPTIVE]: 0
      },
      consistencyViolations: 0,
      adaptiveAdjustments: 0,
      lastViolation: null
    };

    if (this.cacheService) {
      await this.cacheService.set('cache_consistency_metrics', this.metrics, 86400);
    }

    this.logInfo('Cache consistency metrics reset');
  }

  /**
   * Load metrics from cache
   */
  private async loadMetrics(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<ConsistencyMetrics>('cache_consistency_metrics');
      if (cached) {
        this.metrics = cached;
        this.logDebug('Cache consistency metrics loaded', this.metrics);
      }
    } catch (error) {
      this.logWarn('Failed to load cache consistency metrics', { error });
    }
  }

  /**
   * Load data patterns from cache
   */
  private async loadDataPatterns(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<DataPattern[]>('cache_data_patterns');
      if (cached && Array.isArray(cached)) {
        this.dataPatterns.clear();
        cached.forEach(pattern => {
          this.dataPatterns.set(pattern.key, pattern);
        });
        this.logDebug('Cache data patterns loaded', { count: cached.length });
      }
    } catch (error) {
      this.logWarn('Failed to load cache data patterns', { error });
    }
  }

  /**
   * Save data patterns to cache
   */
  private async saveDataPatterns(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const patterns = Array.from(this.dataPatterns.values());
      await this.cacheService.set('cache_data_patterns', patterns, 86400);
    } catch (error) {
      this.logWarn('Failed to save cache data patterns', { error });
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.cacheService) {
      await Promise.all([
        this.cacheService.set('cache_consistency_metrics', this.metrics, 86400),
        this.saveDataPatterns()
      ]);
    }
  }

  /**
   * Health check
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    return {
      healthy: true,
      details: {
        cacheServiceAvailable: !!this.cacheService,
        rulesCount: Object.keys(this.consistencyRules).length,
        patternsCount: this.dataPatterns.size,
        metrics: this.metrics,
        consistencyViolationRate: this.metrics.consistencyViolations /
          (Object.values(this.metrics.operationsByLevel).reduce((a, b) => a + b, 0) || 1)
      }
    };
  }
}