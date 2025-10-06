/**
 * User Preferences Service
 *
 * Manages user preferences for synthesis (tone, verbosity, format).
 * Stores in PostgreSQL (via Supabase), caches in Redis for performance.
 * Stateless: fetches fresh data on cache miss.
 */

import { BaseService } from './base-service';
import { UserPreferences } from '../layers/layer3-synthesis/synthesis.types';
import { CacheService } from './cache.service';
import { ErrorFactory } from '../errors';

const DEFAULT_PREFERENCES: UserPreferences = {
  tone: 'professional',
  format_preference: 'mixed',
  verbosity: 'brief'
};

export class UserPreferencesService extends BaseService {
  private readonly CACHE_TTL = 1800; // 30 minutes in seconds
  private readonly CACHE_PREFIX = 'user:prefs:';

  constructor(
    private readonly cacheService: CacheService,
    private readonly supabaseUrl: string,
    private readonly supabaseServiceKey: string
  ) {
    super('UserPreferencesService');

    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw ErrorFactory.domain.serviceError('UserPreferencesService', 'Supabase URL and Service Role Key are required');
    }
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('UserPreferencesService initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('UserPreferencesService destroyed');
  }

  /**
   * Get user preferences with caching
   *
   * @param userId - Supabase user ID
   * @returns User preferences for synthesis
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    this.assertReady();

    // Check Redis cache first
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    const cached = await this.cacheService.get<UserPreferences>(cacheKey);

    if (cached) {
      this.logDebug('User preferences cache hit', { userId });
      return cached;
    }

    // Cache miss - fetch from database
    this.logDebug('User preferences cache miss, fetching from DB', { userId });

    try {
      const preferences = await this.fetchPreferencesFromDB(userId);

      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, preferences, this.CACHE_TTL);

      return preferences;
    } catch (error) {
      this.logError('Failed to fetch user preferences', { error, userId });
      // Return default preferences on error (graceful degradation)
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /**
   * Update user preferences
   *
   * @param userId - Supabase user ID
   * @param preferences - Partial preferences to update
   */
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    this.assertReady();

    try {
      const updated = await this.updatePreferencesInDB(userId, preferences);

      // Invalidate cache
      await this.invalidateCache(userId);

      return updated;
    } catch (error) {
      this.logError('Failed to update user preferences', { error, userId });
      throw ErrorFactory.domain.serviceError(
        this.name,
        'Failed to update user preferences',
        { userId, operation: 'updatePreferences' }
      );
    }
  }

  /**
   * Invalidate user preferences cache
   *
   * @param userId - Supabase user ID
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    await this.cacheService.del(cacheKey);
    this.logInfo('User preferences cache invalidated', { userId });
  }

  /**
   * Fetch preferences from database (user_metadata)
   *
   * @private
   * @param userId - Supabase user ID
   * @returns User preferences
   */
  private async fetchPreferencesFromDB(userId: string): Promise<UserPreferences> {
    // Fetch user from Supabase
    const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.supabaseServiceKey}`,
        'apikey': this.supabaseServiceKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw ErrorFactory.api.badRequest(`Failed to fetch user from Supabase: ${error}`);
    }

    const data = await response.json() as { user?: any };
    const user = data.user;

    if (!user) {
      throw ErrorFactory.api.notFound('User not found');
    }

    // Extract preferences from user_metadata, fallback to defaults
    const storedPrefs = user.user_metadata?.preferences || {};

    return {
      tone: storedPrefs.tone || DEFAULT_PREFERENCES.tone,
      format_preference: storedPrefs.format_preference || DEFAULT_PREFERENCES.format_preference,
      verbosity: storedPrefs.verbosity || DEFAULT_PREFERENCES.verbosity
    };
  }

  /**
   * Update preferences in database (user_metadata)
   *
   * @private
   * @param userId - Supabase user ID
   * @param preferences - Partial preferences to update
   * @returns Updated preferences
   */
  private async updatePreferencesInDB(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    // First, fetch current preferences
    const current = await this.fetchPreferencesFromDB(userId);

    // Merge with new preferences
    const updated: UserPreferences = {
      ...current,
      ...preferences
    };

    // Update user_metadata in Supabase
    const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.supabaseServiceKey}`,
        'apikey': this.supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_metadata: {
          preferences: updated
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw ErrorFactory.api.badRequest(`Failed to update user preferences in Supabase: ${error}`);
    }

    return updated;
  }

  getHealth() {
    return {
      healthy: this.isReady(),
      service: 'UserPreferencesService',
      status: 'operational'
    };
  }
}
