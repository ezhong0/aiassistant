/**
 * User Context Service
 *
 * Fetches user context (email accounts, calendars, timezone) from the database.
 * Implements Redis caching with 30-minute TTL for performance.
 * Stateless: fetches fresh data on cache miss.
 */

import { BaseService } from './base-service';
import { UserContext } from '../layers/layer1-decomposition/execution-graph.types';
import { CacheService } from './cache.service';
import { ErrorFactory } from '../errors';

export interface UserEmailAccount {
  id: string;
  email: string;
  primary?: boolean;
  provider?: string;
}

export interface UserCalendar {
  id: string;
  name: string;
  primary?: boolean;
}

export class UserContextService extends BaseService {
  private readonly CACHE_TTL = 1800; // 30 minutes in seconds
  private readonly CACHE_PREFIX = 'user:context:';

  constructor(
    private readonly cacheService: CacheService,
    private readonly supabaseUrl: string,
    private readonly supabaseServiceKey: string
  ) {
    super('UserContextService');

    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw ErrorFactory.domain.serviceError('UserContextService', 'Supabase URL and Service Role Key are required');
    }
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('UserContextService initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('UserContextService destroyed');
  }

  /**
   * Get user context with caching
   *
   * @param userId - Supabase user ID
   * @returns User context including email accounts, calendars, and timezone
   */
  async getUserContext(userId: string): Promise<UserContext> {
    this.assertReady();

    // Check Redis cache first
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    const cached = await this.cacheService.get<UserContext>(cacheKey);

    if (cached) {
      this.logDebug('User context cache hit', { userId });
      return cached;
    }

    // Cache miss - fetch from database
    this.logDebug('User context cache miss, fetching from DB', { userId });

    try {
      const context = await this.fetchUserContextFromDB(userId);

      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, context, this.CACHE_TTL);

      return context;
    } catch (error) {
      this.logError('Failed to fetch user context', { error, userId });
      throw ErrorFactory.domain.serviceError(
        this.name,
        'Failed to fetch user context',
        { userId, operation: 'getUserContext' }
      );
    }
  }

  /**
   * Invalidate user context cache
   * Call this when user data changes (e.g., adds/removes email account)
   *
   * @param userId - Supabase user ID
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    await this.cacheService.del(cacheKey);
    this.logInfo('User context cache invalidated', { userId });
  }

  /**
   * Fetch user context from database
   *
   * @private
   * @param userId - Supabase user ID
   * @returns User context
   */
  private async fetchUserContextFromDB(userId: string): Promise<UserContext> {
    // Fetch user profile from Supabase
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

    // Extract email accounts from identities
    const emailAccounts: UserEmailAccount[] = [];
    if (user.identities && Array.isArray(user.identities)) {
      for (const identity of user.identities) {
        if (identity.provider === 'google' && identity.identity_data) {
          emailAccounts.push({
            id: identity.id || user.id,
            email: identity.identity_data.email || user.email,
            primary: true, // First Google account is primary
            provider: 'google'
          });
        }
      }
    }

    // If no identities, use user's email as fallback
    if (emailAccounts.length === 0 && user.email) {
      emailAccounts.push({
        id: user.id,
        email: user.email,
        primary: true
      });
    }

    // TODO: Fetch calendars from a separate table
    // For now, return default calendar
    const calendars: UserCalendar[] = [{
      id: 'primary',
      name: 'Primary Calendar',
      primary: true
    }];

    // TODO: Fetch timezone from user_metadata or separate table
    // For now, default to UTC
    const timezone = user.user_metadata?.timezone || 'UTC';

    return {
      email_accounts: emailAccounts,
      calendars,
      timezone
    };
  }

  getHealth() {
    return {
      healthy: this.isReady(),
      service: 'UserContextService',
      status: 'operational'
    };
  }
}
