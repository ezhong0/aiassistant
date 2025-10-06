import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { ErrorFactory } from '../errors';

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100, for gradual rollouts
  enabledForUsers?: string[]; // Specific user IDs
  disabledForUsers?: string[]; // Specific user IDs to exclude
  environment?: string[]; // Environments where flag is active
  metadata?: Record<string, unknown>;
}

/**
 * Feature Flags Service
 *
 * Manages feature flags for controlled rollouts, A/B testing, and feature toggles.
 *
 * Features:
 * - Simple on/off flags
 * - Gradual rollout percentages
 * - User-specific flags
 * - Environment-based flags
 * - Caching for performance
 *
 * Benefits:
 * - Deploy features behind flags
 * - Test in production safely
 * - Gradual rollouts
 * - Quick rollback
 * - A/B testing support
 */
export class FeatureFlagsService extends BaseService {
  private flags: Map<string, FeatureFlag> = new Map();
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly cacheService: CacheService | undefined,
    private readonly config: typeof import('../config').config
  ) {
    super('FeatureFlagsService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Feature Flags Service');

    // Register default flags
    this.registerDefaultFlags();

    this.logInfo('Feature Flags Service initialized', {
      flagCount: this.flags.size,
      flags: Array.from(this.flags.keys())
    });
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.flags.clear();
    this.logInfo('Feature Flags Service destroyed');
  }

  /**
   * Register a feature flag
   */
  registerFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
    this.logInfo('Feature flag registered', {
      name: flag.name,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage
    });

    // Invalidate cache for this flag
    if (this.cacheService) {
      this.cacheService.del(`feature-flag:${flag.name}`).catch(() => {
        // Ignore cache errors
      });
    }
  }

  /**
   * Check if a feature is enabled for a user
   */
  async isEnabled(featureName: string, userId?: string): Promise<boolean> {
    const flag = await this.getFlag(featureName);
    if (!flag) {
      this.logWarn('Unknown feature flag', { featureName });
      return false; // Unknown flags default to disabled
    }

    // Check if globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check user-specific disabling
    if (userId && flag.disabledForUsers?.includes(userId)) {
      return false;
    }

    // Check user-specific enabling
    if (userId && flag.enabledForUsers?.includes(userId)) {
      return true;
    }

    // Check environment
    if (flag.environment && flag.environment.length > 0) {
      if (!flag.environment.includes(this.config.nodeEnv)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const userHash = this.hashUserId(userId);
      const userPercentile = userHash % 100;
      return userPercentile < flag.rolloutPercentage;
    }

    // If rollout percentage is set but no userId, only enable for 100% rollout
    if (flag.rolloutPercentage !== undefined) {
      return flag.rolloutPercentage === 100;
    }

    return true;
  }

  /**
   * Get all enabled features for a user
   */
  async getEnabledFeatures(userId?: string): Promise<string[]> {
    const enabledFeatures: string[] = [];

    for (const flagName of this.flags.keys()) {
      if (await this.isEnabled(flagName, userId)) {
        enabledFeatures.push(flagName);
      }
    }

    return enabledFeatures;
  }

  /**
   * Get a feature flag configuration
   */
  async getFlag(featureName: string): Promise<FeatureFlag | null> {
    // Try cache first
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get<FeatureFlag>(`feature-flag:${featureName}`);
        if (cached) {
          return cached;
        }
      } catch (_error) {
        // Ignore cache errors, fall through to direct lookup
      }
    }

    const flag = this.flags.get(featureName) || null;

    // Cache the result
    if (flag && this.cacheService) {
      this.cacheService.set(`feature-flag:${featureName}`, flag, this.CACHE_TTL).catch(() => {
        // Ignore cache errors
      });
    }

    return flag;
  }

  /**
   * Get all registered flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Update a flag's enabled status
   */
  setEnabled(featureName: string, enabled: boolean): void {
    const flag = this.flags.get(featureName);
    if (flag) {
      flag.enabled = enabled;
      this.logInfo('Feature flag updated', { featureName, enabled });

      // Invalidate cache
      if (this.cacheService) {
        this.cacheService.del(`feature-flag:${featureName}`).catch(() => {
          // Ignore cache errors
        });
      }
    }
  }

  /**
   * Update a flag's rollout percentage
   */
  setRolloutPercentage(featureName: string, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw ErrorFactory.api.badRequest('Rollout percentage must be between 0 and 100');
    }

    const flag = this.flags.get(featureName);
    if (flag) {
      flag.rolloutPercentage = percentage;
      this.logInfo('Feature flag rollout updated', { featureName, percentage });

      // Invalidate cache
      if (this.cacheService) {
        this.cacheService.del(`feature-flag:${featureName}`).catch(() => {
          // Ignore cache errors
        });
      }
    }
  }

  /**
   * Hash user ID for consistent rollout assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Register default feature flags
   */
  private registerDefaultFlags(): void {
    // Example flags - customize these for your application
    this.registerFlag({
      name: 'new_email_composer',
      description: 'New email composition UI with improved UX',
      enabled: true,
      rolloutPercentage: 50, // 50% rollout
      environment: ['development', 'staging', 'production']
    });

    this.registerFlag({
      name: 'advanced_calendar_features',
      description: 'Advanced calendar features like availability finder',
      enabled: true,
      environment: ['development', 'staging']
    });

    this.registerFlag({
      name: 'ai_email_suggestions',
      description: 'AI-powered email response suggestions',
      enabled: false // Disabled by default
    });

    this.registerFlag({
      name: 'batch_operations',
      description: 'Batch email operations for power users',
      enabled: true,
      rolloutPercentage: 25
    });
  }
}
