/**
 * Cache Invalidation Service
 * Provides event-based cache invalidation to prevent stale data across all cache services
 *
 * Invalidation Strategies:
 * - Event-based: Clear cache when data changes
 * - Tag-based: Clear related cache entries using tags
 * - Pattern-based: Clear cache keys matching patterns
 * - Time-based: Force refresh based on data sensitivity
 *
 * Supported Events:
 * - Email operations (send, receive, delete)
 * - Calendar operations (create, update, delete events)
 * - Contact operations (add, update, delete contacts)
 * - Token operations (refresh, revoke)
 */

import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { GmailCacheService } from './email/gmail-cache.service';
import { ContactCacheService } from './contact/contact-cache.service';
import { SlackCacheService } from './slack/slack-cache.service';
import { CalendarCacheService } from './calendar/calendar-cache.service';
import { ServiceManager } from './service-manager';

export enum InvalidationReason {
  DATA_CHANGED = 'data_changed',
  USER_ACTION = 'user_action',
  EXTERNAL_UPDATE = 'external_update',
  CONSISTENCY_CHECK = 'consistency_check',
  FORCE_REFRESH = 'force_refresh'
}

export enum InvalidationScope {
  USER_SPECIFIC = 'user_specific',
  GLOBAL = 'global',
  SERVICE_SPECIFIC = 'service_specific',
  TAG_BASED = 'tag_based'
}

export interface InvalidationEvent {
  eventType: string;
  userId?: string;
  resourceId?: string;
  reason: InvalidationReason;
  scope: InvalidationScope;
  tags?: string[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface InvalidationRule {
  eventType: string;
  cachePatterns: string[];
  services: string[];
  cascading: boolean;
  delay?: number; // Delay in milliseconds before invalidation
}

export interface InvalidationMetrics {
  totalInvalidations: number;
  invalidationsByType: Record<string, number>;
  invalidationsByService: Record<string, number>;
  averageInvalidationTime: number;
  lastInvalidation: Date | null;
}

export class CacheInvalidationService extends BaseService {
  private cacheService: CacheService | null = null;
  private gmailCacheService: GmailCacheService | null = null;
  private contactCacheService: ContactCacheService | null = null;
  private slackCacheService: SlackCacheService | null = null;
  private calendarCacheService: CalendarCacheService | null = null;

  private metrics: InvalidationMetrics = {
    totalInvalidations: 0,
    invalidationsByType: {},
    invalidationsByService: {},
    averageInvalidationTime: 0,
    lastInvalidation: null
  };

  // Predefined invalidation rules
  private readonly invalidationRules: InvalidationRule[] = [
    // Email operations
    {
      eventType: 'email_sent',
      cachePatterns: ['gmail:search:*', 'gmail:thread:*'],
      services: ['gmailCacheService'],
      cascading: true
    },
    {
      eventType: 'email_received',
      cachePatterns: ['gmail:search:*', 'gmail:thread:*'],
      services: ['gmailCacheService'],
      cascading: true
    },
    {
      eventType: 'email_deleted',
      cachePatterns: ['gmail:search:*', 'gmail:thread:*', 'gmail:email:*'],
      services: ['gmailCacheService'],
      cascading: true
    },

    // Calendar operations
    {
      eventType: 'calendar_event_created',
      cachePatterns: ['calendar:events:*', 'calendar:availability:*', 'calendar:slots:*'],
      services: ['calendarCacheService'],
      cascading: true
    },
    {
      eventType: 'calendar_event_updated',
      cachePatterns: ['calendar:events:*', 'calendar:availability:*', 'calendar:slots:*'],
      services: ['calendarCacheService'],
      cascading: true
    },
    {
      eventType: 'calendar_event_deleted',
      cachePatterns: ['calendar:events:*', 'calendar:availability:*', 'calendar:slots:*'],
      services: ['calendarCacheService'],
      cascading: true
    },

    // Contact operations
    {
      eventType: 'contact_created',
      cachePatterns: ['contact:lookup:*', 'contact:search:*'],
      services: ['contactCacheService'],
      cascading: false
    },
    {
      eventType: 'contact_updated',
      cachePatterns: ['contact:lookup:*', 'contact:search:*'],
      services: ['contactCacheService'],
      cascading: false
    },
    {
      eventType: 'contact_deleted',
      cachePatterns: ['contact:lookup:*', 'contact:search:*'],
      services: ['contactCacheService'],
      cascading: false
    },

    // Slack operations
    {
      eventType: 'slack_message_sent',
      cachePatterns: ['slack:history:*'],
      services: ['slackCacheService'],
      cascading: false
    },
    {
      eventType: 'slack_channel_updated',
      cachePatterns: ['slack:channel:*', 'slack:history:*'],
      services: ['slackCacheService'],
      cascading: false
    },

    // Token operations
    {
      eventType: 'token_refreshed',
      cachePatterns: ['tokens:*'],
      services: ['all'],
      cascading: true
    },
    {
      eventType: 'token_revoked',
      cachePatterns: ['tokens:*', 'gmail:*', 'calendar:*', 'contact:*'],
      services: ['all'],
      cascading: true
    }
  ];

  constructor() {
    super('CacheInvalidationService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Cache Invalidation Service...');

    try {
      // Get dependencies from service manager
      const serviceManager = ServiceManager.getInstance();
      this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;
      this.gmailCacheService = serviceManager.getService<GmailCacheService>('gmailCacheService') || null;
      this.contactCacheService = serviceManager.getService<ContactCacheService>('contactCacheService') || null;
      this.slackCacheService = serviceManager.getService<SlackCacheService>('slackCacheService') || null;
      this.calendarCacheService = serviceManager.getService<CalendarCacheService>('calendarCacheService') || null;

      if (!this.cacheService) {
        this.logWarn('CacheService not available - invalidation disabled');
        return;
      }

      // Load existing metrics
      await this.loadMetrics();

      this.logInfo('Cache Invalidation Service initialized successfully', {
        rulesCount: this.invalidationRules.length,
        availableServices: {
          gmail: !!this.gmailCacheService,
          contact: !!this.contactCacheService,
          slack: !!this.slackCacheService,
          calendar: !!this.calendarCacheService
        }
      });

    } catch (error) {
      this.logError('Failed to initialize Cache Invalidation Service', error);
      throw error;
    }
  }

  /**
   * Invalidate cache based on an event
   */
  async invalidateOnEvent(event: InvalidationEvent): Promise<void> {
    if (!this.cacheService) {
      this.logWarn('Cache service not available, skipping invalidation', { event });
      return;
    }

    const startTime = Date.now();

    try {
      this.logInfo('Processing cache invalidation event', {
        eventType: event.eventType,
        userId: event.userId,
        resourceId: event.resourceId,
        reason: event.reason,
        scope: event.scope
      });

      // Find matching invalidation rules
      const matchingRules = this.invalidationRules.filter(rule => rule.eventType === event.eventType);

      if (matchingRules.length === 0) {
        this.logDebug('No invalidation rules found for event type', { eventType: event.eventType });
        return;
      }

      // Process each matching rule
      for (const rule of matchingRules) {
        await this.processInvalidationRule(rule, event);
      }

      // Update metrics
      const invalidationTime = Date.now() - startTime;
      this.updateMetrics(event.eventType, 'cacheInvalidationService', invalidationTime);

      this.logInfo('Cache invalidation completed', {
        eventType: event.eventType,
        rulesProcessed: matchingRules.length,
        duration: `${invalidationTime}ms`
      });

    } catch (error) {
      this.logError('Failed to process cache invalidation', { event, error });
    }
  }

  /**
   * Process a specific invalidation rule
   */
  private async processInvalidationRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    try {
      // Apply delay if specified
      if (rule.delay && rule.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, rule.delay));
      }

      // Invalidate cache patterns
      for (const pattern of rule.cachePatterns) {
        await this.invalidateCachePattern(pattern, event);
      }

      // Invalidate service-specific caches
      for (const serviceName of rule.services) {
        await this.invalidateServiceCache(serviceName, event);
      }

      // Handle cascading invalidation
      if (rule.cascading) {
        await this.handleCascadingInvalidation(event);
      }

    } catch (error) {
      this.logError('Failed to process invalidation rule', { rule, event, error });
    }
  }

  /**
   * Invalidate cache keys matching a pattern
   */
  private async invalidateCachePattern(pattern: string, event: InvalidationEvent): Promise<void> {
    try {
      // Replace placeholders in pattern with actual values
      let resolvedPattern = pattern;

      if (event.userId) {
        resolvedPattern = resolvedPattern.replace('{userId}', event.userId);
      }

      if (event.resourceId) {
        resolvedPattern = resolvedPattern.replace('{resourceId}', event.resourceId);
      }

      // For patterns with wildcards, we need to handle them specially
      if (resolvedPattern.includes('*')) {
        // In a production environment, you might want to implement
        // a more sophisticated pattern matching system
        this.logDebug('Pattern-based cache invalidation', {
          originalPattern: pattern,
          resolvedPattern,
          event: event.eventType
        });

        // For now, we'll clear known keys based on the pattern
        await this.clearPatternBasedCache(resolvedPattern, event);
      } else {
        // Direct key deletion
        await this.cacheService!.del(resolvedPattern);
        this.logDebug('Direct cache key invalidated', { key: resolvedPattern });
      }

    } catch (error) {
      this.logError('Failed to invalidate cache pattern', { pattern, event, error });
    }
  }

  /**
   * Clear cache based on pattern matching
   */
  private async clearPatternBasedCache(pattern: string, event: InvalidationEvent): Promise<void> {
    // This is a simplified implementation
    // In production, you might want to use Redis SCAN with pattern matching

    const basePattern = pattern.replace('*', '');

    // Clear user-specific patterns
    if (event.userId) {
      const userKeys = [
        `${basePattern}${event.userId}`,
        `${basePattern}user:${event.userId}`,
      ];

      for (const key of userKeys) {
        await this.cacheService!.del(key);
      }
    }

    // Clear resource-specific patterns
    if (event.resourceId) {
      const resourceKeys = [
        `${basePattern}${event.resourceId}`,
        `${basePattern}resource:${event.resourceId}`,
      ];

      for (const key of resourceKeys) {
        await this.cacheService!.del(key);
      }
    }
  }

  /**
   * Invalidate service-specific cache
   */
  private async invalidateServiceCache(serviceName: string, event: InvalidationEvent): Promise<void> {
    try {
      if (serviceName === 'all') {
        // Invalidate all service caches
        await Promise.all([
          this.invalidateGmailCache(event),
          this.invalidateContactCache(event),
          this.invalidateSlackCache(event),
          this.invalidateCalendarCache(event)
        ]);
        return;
      }

      switch (serviceName) {
        case 'gmailCacheService':
          await this.invalidateGmailCache(event);
          break;
        case 'contactCacheService':
          await this.invalidateContactCache(event);
          break;
        case 'slackCacheService':
          await this.invalidateSlackCache(event);
          break;
        case 'calendarCacheService':
          await this.invalidateCalendarCache(event);
          break;
        default:
          this.logWarn('Unknown service for cache invalidation', { serviceName });
      }

    } catch (error) {
      this.logError('Failed to invalidate service cache', { serviceName, event, error });
    }
  }

  /**
   * Service-specific cache invalidation methods
   */
  private async invalidateGmailCache(event: InvalidationEvent): Promise<void> {
    if (!this.gmailCacheService || !event.userId) return;

    // Gmail cache service would need an invalidation method
    // For now, we'll log the action
    this.logDebug('Gmail cache invalidation requested', {
      userId: event.userId,
      resourceId: event.resourceId
    });
  }

  private async invalidateContactCache(event: InvalidationEvent): Promise<void> {
    if (!this.contactCacheService || !event.userId) return;

    this.logDebug('Contact cache invalidation requested', {
      userId: event.userId,
      resourceId: event.resourceId
    });
  }

  private async invalidateSlackCache(event: InvalidationEvent): Promise<void> {
    if (!this.slackCacheService || !event.userId) return;

    this.logDebug('Slack cache invalidation requested', {
      userId: event.userId,
      resourceId: event.resourceId
    });
  }

  private async invalidateCalendarCache(event: InvalidationEvent): Promise<void> {
    if (!this.calendarCacheService || !event.userId) return;

    // Use the calendar cache service's invalidation method
    await this.calendarCacheService.invalidateUserCalendarCache(
      event.userId,
      event.resourceId
    );

    this.logDebug('Calendar cache invalidated', {
      userId: event.userId,
      calendarId: event.resourceId
    });
  }

  /**
   * Handle cascading invalidation (when one change affects multiple services)
   */
  private async handleCascadingInvalidation(event: InvalidationEvent): Promise<void> {
    try {
      // Define cascading rules based on event type
      const cascadingEvents: InvalidationEvent[] = [];

      switch (event.eventType) {
        case 'calendar_event_created':
        case 'calendar_event_updated':
          // Calendar changes might affect email search (meeting invites)
          cascadingEvents.push({
            ...event,
            eventType: 'email_received',
            reason: InvalidationReason.CONSISTENCY_CHECK
          });
          break;

        case 'token_refreshed':
          // Token refresh affects all services
          cascadingEvents.push(
            {
              ...event,
              eventType: 'gmail_cache_refresh',
              reason: InvalidationReason.CONSISTENCY_CHECK
            },
            {
              ...event,
              eventType: 'calendar_cache_refresh',
              reason: InvalidationReason.CONSISTENCY_CHECK
            },
            {
              ...event,
              eventType: 'contact_cache_refresh',
              reason: InvalidationReason.CONSISTENCY_CHECK
            }
          );
          break;
      }

      // Process cascading events
      for (const cascadingEvent of cascadingEvents) {
        await this.invalidateOnEvent(cascadingEvent);
      }

    } catch (error) {
      this.logError('Failed to handle cascading invalidation', { event, error });
    }
  }

  /**
   * Convenience methods for common invalidation scenarios
   */

  async invalidateOnEmailOperation(
    operation: 'sent' | 'received' | 'deleted',
    userId: string,
    emailId?: string
  ): Promise<void> {
    const event: InvalidationEvent = {
      eventType: `email_${operation}`,
      userId,
      resourceId: emailId,
      reason: InvalidationReason.DATA_CHANGED,
      scope: InvalidationScope.USER_SPECIFIC,
      timestamp: new Date()
    };

    await this.invalidateOnEvent(event);
  }

  async invalidateOnCalendarOperation(
    operation: 'created' | 'updated' | 'deleted',
    userId: string,
    eventId?: string,
    calendarId?: string
  ): Promise<void> {
    const event: InvalidationEvent = {
      eventType: `calendar_event_${operation}`,
      userId,
      resourceId: calendarId,
      reason: InvalidationReason.DATA_CHANGED,
      scope: InvalidationScope.USER_SPECIFIC,
      timestamp: new Date(),
      metadata: { eventId }
    };

    await this.invalidateOnEvent(event);
  }

  async invalidateOnContactOperation(
    operation: 'created' | 'updated' | 'deleted',
    userId: string,
    contactId?: string
  ): Promise<void> {
    const event: InvalidationEvent = {
      eventType: `contact_${operation}`,
      userId,
      resourceId: contactId,
      reason: InvalidationReason.DATA_CHANGED,
      scope: InvalidationScope.USER_SPECIFIC,
      timestamp: new Date()
    };

    await this.invalidateOnEvent(event);
  }

  async invalidateOnTokenOperation(
    operation: 'refreshed' | 'revoked',
    userId: string
  ): Promise<void> {
    const event: InvalidationEvent = {
      eventType: `token_${operation}`,
      userId,
      reason: InvalidationReason.DATA_CHANGED,
      scope: InvalidationScope.USER_SPECIFIC,
      timestamp: new Date()
    };

    await this.invalidateOnEvent(event);
  }

  /**
   * Force refresh cache for consistency
   */
  async forceRefreshUserCache(userId: string, services?: string[]): Promise<void> {
    const servicesToRefresh = services || ['gmail', 'calendar', 'contact', 'slack'];

    for (const service of servicesToRefresh) {
      const event: InvalidationEvent = {
        eventType: `${service}_cache_refresh`,
        userId,
        reason: InvalidationReason.FORCE_REFRESH,
        scope: InvalidationScope.USER_SPECIFIC,
        timestamp: new Date()
      };

      await this.invalidateOnEvent(event);
    }
  }

  /**
   * Get invalidation metrics
   */
  getMetrics(): InvalidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset invalidation metrics
   */
  async resetMetrics(): Promise<void> {
    this.metrics = {
      totalInvalidations: 0,
      invalidationsByType: {},
      invalidationsByService: {},
      averageInvalidationTime: 0,
      lastInvalidation: null
    };

    if (this.cacheService) {
      await this.cacheService.set('cache_invalidation_metrics', this.metrics, 86400);
    }

    this.logInfo('Cache invalidation metrics reset');
  }

  /**
   * Update invalidation metrics
   */
  private updateMetrics(eventType: string, service: string, duration: number): void {
    this.metrics.totalInvalidations++;
    this.metrics.invalidationsByType[eventType] = (this.metrics.invalidationsByType[eventType] || 0) + 1;
    this.metrics.invalidationsByService[service] = (this.metrics.invalidationsByService[service] || 0) + 1;
    this.metrics.lastInvalidation = new Date();

    // Update average invalidation time
    this.metrics.averageInvalidationTime =
      (this.metrics.averageInvalidationTime + duration) / 2;
  }

  /**
   * Load metrics from cache
   */
  private async loadMetrics(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<InvalidationMetrics>('cache_invalidation_metrics');
      if (cached) {
        this.metrics = cached;
        this.logDebug('Cache invalidation metrics loaded', this.metrics);
      }
    } catch (error) {
      this.logWarn('Failed to load cache invalidation metrics', { error });
    }
  }

  /**
   * Save metrics to cache
   */
  private async saveMetrics(): Promise<void> {
    if (!this.cacheService) return;

    try {
      await this.cacheService.set('cache_invalidation_metrics', this.metrics, 86400);
    } catch (error) {
      this.logWarn('Failed to save cache invalidation metrics', { error });
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.cacheService) {
      await this.saveMetrics();
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
        invalidationRulesCount: this.invalidationRules.length,
        metrics: this.metrics,
        availableServices: {
          gmail: !!this.gmailCacheService,
          contact: !!this.contactCacheService,
          slack: !!this.slackCacheService,
          calendar: !!this.calendarCacheService
        }
      }
    };
  }
}