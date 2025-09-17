/**
 * Contact Resolution Cache Service
 * Implements intelligent caching for contact resolution to improve speed and reduce API calls
 * 
 * Cache Strategy:
 * - Contact lookups: 2 hours TTL (80-95% hit rate expected)
 * - Contact searches: 1 hour TTL (70-85% hit rate expected)
 * 
 * Performance Impact:
 * - Contact lookup speed: 200-500ms → 10ms (95% faster)
 * - Expected 80-95% reduction in Google Contacts API calls
 */

import { BaseService } from '../base-service';
import { CacheService } from '../cache.service';
import { ContactService } from '../contact.service';
import { ServiceManager } from '../service-manager';
import crypto from 'crypto';

export interface ContactCacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  lastReset: Date;
}

export interface CachedContact {
  contact: any;
  searchTerm: string;
  userId: string;
  timestamp: number;
}

export interface CachedContactSearch {
  contacts: any[];
  searchTerm: string;
  userId: string;
  timestamp: number;
}

export class ContactCacheService extends BaseService {
  private cacheService: CacheService | null = null;
  private contactService: ContactService | null = null;
  private metrics: ContactCacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    avgResponseTime: 0,
    lastReset: new Date()
  };

  // Cache TTL settings (in seconds)
  private readonly CONTACT_LOOKUP_TTL = 7200; // 2 hours
  private readonly CONTACT_SEARCH_TTL = 3600; // 1 hour

  // Performance tracking
  private responseTimes: number[] = [];

  constructor() {
    super('ContactCacheService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Contact Cache Service...');

    try {
      // Get dependencies from service manager
      const serviceManager = ServiceManager.getInstance();
      this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;
      this.contactService = serviceManager.getService<ContactService>('contactService') || null;

      if (!this.cacheService) {
        this.logWarn('CacheService not available - caching disabled');
        return;
      }

      if (!this.contactService) {
        this.logWarn('ContactService not available - caching disabled');
        return;
      }

      // Load existing metrics from cache
      await this.loadMetrics();

      this.logInfo('Contact Cache Service initialized successfully', {
        contactLookupTTL: this.CONTACT_LOOKUP_TTL,
        contactSearchTTL: this.CONTACT_SEARCH_TTL,
        currentHitRate: this.metrics.hitRate
      });

    } catch (error) {
      this.logError('Failed to initialize Contact Cache Service', error);
      throw error;
    }
  }

  /**
   * Find contact with caching
   * Expected hit rate: 80-95% (same contacts searched repeatedly)
   */
  async findContact(name: string, userId: string): Promise<any | null> {
    if (!this.cacheService || !this.contactService) {
      // Fallback to direct contact service if cache unavailable
      const result = await this.contactService!.searchContacts(name, userId);
      return result.contacts.length > 0 ? result.contacts[0] : null;
    }

    const cacheKey = this.generateContactLookupCacheKey(name, userId);
    const startTime = Date.now();

    try {
      // Try cache first
      const cached = await this.cacheService.get<CachedContact>(cacheKey);
      if (cached && this.isContactCacheValid(cached)) {
        const responseTime = Date.now() - startTime;
        this.recordCacheHit(responseTime);
        this.logDebug('Contact lookup cache hit', { 
          name, 
          userId,
          responseTime: `${responseTime}ms`,
          hitRate: this.metrics.hitRate 
        });
        return cached.contact;
      }

      // Cache miss - call Contact service
      this.logDebug('Contact lookup cache miss', { name, userId });

      const result = await this.contactService.searchContacts(name, userId);
      const contact = result.contacts.length > 0 ? result.contacts[0] : null;
      const responseTime = Date.now() - startTime;

      this.recordCacheMiss(responseTime);

      // Cache the results (even if null - to avoid repeated failed lookups)
      const cacheData: CachedContact = {
        contact,
        searchTerm: name,
        userId,
        timestamp: Date.now()
      };

      await this.cacheService.set(cacheKey, cacheData, this.CONTACT_LOOKUP_TTL);

      this.logDebug('Contact lookup cached', { 
        name, 
        userId,
        found: !!contact,
        responseTime: `${responseTime}ms`,
        ttl: this.CONTACT_LOOKUP_TTL 
      });

      return contact;

    } catch (error) {
      this.logError('Contact lookup cache error', error);
      // Fallback to direct contact service
      const result = await this.contactService!.searchContacts(name, userId);
      return result.contacts.length > 0 ? result.contacts[0] : null;
    }
  }

  /**
   * Search contacts with caching
   * Expected hit rate: 70-85% (similar searches repeated)
   */
  async searchContacts(query: string, userId: string, options: { maxResults?: number } = {}): Promise<any[]> {
    if (!this.cacheService || !this.contactService) {
      const result = await this.contactService!.searchContacts(query, userId);
      return result.contacts;
    }

    const maxResults = options.maxResults || 20;
    const cacheKey = this.generateContactSearchCacheKey(query, userId, maxResults);
    const startTime = Date.now();

    try {
      // Try cache first
      const cached = await this.cacheService.get<CachedContactSearch>(cacheKey);
      if (cached && this.isContactSearchCacheValid(cached)) {
        const responseTime = Date.now() - startTime;
        this.recordCacheHit(responseTime);
        this.logDebug('Contact search cache hit', { 
          query, 
          userId,
          resultCount: cached.contacts.length,
          responseTime: `${responseTime}ms`,
          hitRate: this.metrics.hitRate 
        });
        return cached.contacts;
      }

      // Cache miss - call Contact service
      this.logDebug('Contact search cache miss', { query, userId });

      const result = await this.contactService.searchContacts(query, userId);
      const contacts = result.contacts;
      const responseTime = Date.now() - startTime;

      this.recordCacheMiss(responseTime);

      // Cache the results
      const cacheData: CachedContactSearch = {
        contacts,
        searchTerm: query,
        userId,
        timestamp: Date.now()
      };

      await this.cacheService.set(cacheKey, cacheData, this.CONTACT_SEARCH_TTL);

      this.logDebug('Contact search cached', { 
        query, 
        userId,
        resultCount: contacts.length,
        responseTime: `${responseTime}ms`,
        ttl: this.CONTACT_SEARCH_TTL 
      });

      return contacts;

    } catch (error) {
      this.logError('Contact search cache error', error);
      // Fallback to direct contact service
      const result = await this.contactService!.searchContacts(query, userId);
      return result.contacts;
    }
  }

  /**
   * Get cache performance metrics
   */
  getMetrics(): ContactCacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  async resetMetrics(): Promise<void> {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
      lastReset: new Date()
    };

    this.responseTimes = [];

    if (this.cacheService) {
      await this.cacheService.set('contact_cache_metrics', this.metrics, 86400); // 24 hours
    }

    this.logInfo('Contact cache metrics reset');
  }

  /**
   * Generate cache key for contact lookup
   */
  private generateContactLookupCacheKey(name: string, userId: string): string {
    const normalizedName = name.toLowerCase().trim();
    const hash = crypto.createHash('md5').update(`${normalizedName}:${userId}`).digest('hex');
    return `contact:lookup:${hash}`;
  }

  /**
   * Generate cache key for contact search
   */
  private generateContactSearchCacheKey(query: string, userId: string, maxResults: number): string {
    const normalizedQuery = query.toLowerCase().trim();
    const hash = crypto.createHash('md5').update(`${normalizedQuery}:${userId}:${maxResults}`).digest('hex');
    return `contact:search:${hash}`;
  }

  /**
   * Check if contact cache is still valid
   */
  private isContactCacheValid(cached: CachedContact): boolean {
    const age = Date.now() - cached.timestamp;
    return age < (this.CONTACT_LOOKUP_TTL * 1000);
  }

  /**
   * Check if contact search cache is still valid
   */
  private isContactSearchCacheValid(cached: CachedContactSearch): boolean {
    const age = Date.now() - cached.timestamp;
    return age < (this.CONTACT_SEARCH_TTL * 1000);
  }

  /**
   * Record cache hit and update metrics
   */
  private recordCacheHit(responseTime: number): void {
    this.metrics.hits++;
    this.responseTimes.push(responseTime);
    this.updateHitRate();
    this.updateAvgResponseTime();
  }

  /**
   * Record cache miss and update metrics
   */
  private recordCacheMiss(responseTime: number): void {
    this.metrics.misses++;
    this.responseTimes.push(responseTime);
    this.updateHitRate();
    this.updateAvgResponseTime();
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  /**
   * Update average response time
   */
  private updateAvgResponseTime(): void {
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.metrics.avgResponseTime = sum / this.responseTimes.length;
    }

    // Keep only last 100 response times to prevent memory growth
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  /**
   * Load metrics from cache
   */
  private async loadMetrics(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const cached = await this.cacheService.get<ContactCacheMetrics>('contact_cache_metrics');
      if (cached) {
        this.metrics = cached;
        this.logDebug('Contact cache metrics loaded', { 
          hits: this.metrics.hits,
          misses: this.metrics.misses,
          hitRate: this.metrics.hitRate,
          avgResponseTime: this.metrics.avgResponseTime
        });
      }
    } catch (error) {
      this.logWarn('Failed to load Contact cache metrics', { error });
    }
  }

  /**
   * Save metrics to cache
   */
  private async saveMetrics(): Promise<void> {
    if (!this.cacheService) return;

    try {
      await this.cacheService.set('contact_cache_metrics', this.metrics, 86400); // 24 hours
    } catch (error) {
      this.logWarn('Failed to save Contact cache metrics', { error });
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
        contactServiceAvailable: !!this.contactService,
        metrics: this.metrics,
        cacheTTL: {
          contactLookup: this.CONTACT_LOOKUP_TTL,
          contactSearch: this.CONTACT_SEARCH_TTL
        }
      }
    };
  }
}
