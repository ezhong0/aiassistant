/**
 * Cache Performance Monitoring Service
 * Tracks hit rates, cost savings, and performance metrics across all cache services
 * 
 * Monitors:
 * - Gmail API cache (cost savings)
 * - Contact Resolution cache (speed improvements)
 * - Slack Message cache (rate limit protection)
 * - Overall cache performance
 */

import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { GmailCacheService } from './email/gmail-cache.service';
import { ContactCacheService } from './contact/contact-cache.service';
import { SlackCacheService } from './slack/slack-cache.service';
import { ServiceManager } from './service-manager';

export interface OverallCacheMetrics {
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  totalCostSavings: number;
  totalRateLimitSavings: number;
  avgResponseTimeImprovement: number;
  lastReset: Date;
  services: {
    gmail: {
      hits: number;
      misses: number;
      hitRate: number;
      costSavings: number;
    };
    contact: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    };
    slack: {
      hits: number;
      misses: number;
      hitRate: number;
      rateLimitSavings: number;
    };
  };
}

export interface CachePerformanceReport {
  timestamp: Date;
  metrics: OverallCacheMetrics;
  recommendations: string[];
  costImpact: {
    monthlySavings: number;
    apiCallReduction: number;
  };
}

export class CachePerformanceMonitoringService extends BaseService {
  private cacheService: CacheService | null = null;
  private gmailCacheService: GmailCacheService | null = null;
  private contactCacheService: ContactCacheService | null = null;
  private slackCacheService: SlackCacheService | null = null;

  constructor() {
    super('CachePerformanceMonitoringService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Cache Performance Monitoring Service...');

    try {
      // Get dependencies from service manager
      const serviceManager = ServiceManager.getInstance();
      this.cacheService = serviceManager.getService('cacheService') as unknown as CacheService;
      this.gmailCacheService = serviceManager.getService('gmailCacheService') as unknown as GmailCacheService;
      this.contactCacheService = serviceManager.getService('contactCacheService') as unknown as ContactCacheService;
      this.slackCacheService = serviceManager.getService('slackCacheService') as unknown as SlackCacheService;

      this.logInfo('Cache Performance Monitoring Service initialized successfully');

    } catch (error) {
      this.logError('Failed to initialize Cache Performance Monitoring Service', error);
      throw error;
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('Cache Performance Monitoring Service destroyed');
  }

  /**
   * Get overall cache performance metrics
   */
  getOverallMetrics(): OverallCacheMetrics {
    const gmailMetrics = this.gmailCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, costSavings: 0 };
    const contactMetrics = this.contactCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0 };
    const slackMetrics = this.slackCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, rateLimitSavings: 0 };

    const totalHits = gmailMetrics.hits + contactMetrics.hits + slackMetrics.hits;
    const totalMisses = gmailMetrics.misses + contactMetrics.misses + slackMetrics.misses;
    const overallHitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

    return {
      totalHits,
      totalMisses,
      overallHitRate,
      totalCostSavings: gmailMetrics.costSavings,
      totalRateLimitSavings: slackMetrics.rateLimitSavings,
      avgResponseTimeImprovement: contactMetrics.avgResponseTime,
      lastReset: new Date(),
      services: {
        gmail: {
          hits: gmailMetrics.hits,
          misses: gmailMetrics.misses,
          hitRate: gmailMetrics.hitRate,
          costSavings: gmailMetrics.costSavings
        },
        contact: {
          hits: contactMetrics.hits,
          misses: contactMetrics.misses,
          hitRate: contactMetrics.hitRate,
          avgResponseTime: contactMetrics.avgResponseTime
        },
        slack: {
          hits: slackMetrics.hits,
          misses: slackMetrics.misses,
          hitRate: slackMetrics.hitRate,
          rateLimitSavings: slackMetrics.rateLimitSavings
        }
      }
    };
  }

  /**
   * Generate comprehensive cache performance report
   */
  generatePerformanceReport(): CachePerformanceReport {
    const metrics = this.getOverallMetrics();
    const recommendations = this.generateRecommendations(metrics);
    const costImpact = this.calculateCostImpact(metrics);

    return {
      timestamp: new Date(),
      metrics,
      recommendations,
      costImpact
    };
  }

  /**
   * Generate performance recommendations based on metrics
   */
  private generateRecommendations(metrics: OverallCacheMetrics): string[] {
    const recommendations: string[] = [];

    // Overall hit rate recommendations
    if (metrics.overallHitRate < 50) {
      recommendations.push('Overall cache hit rate is low (<50%). Consider increasing cache TTL or optimizing cache keys.');
    } else if (metrics.overallHitRate > 80) {
      recommendations.push('Excellent cache performance! Hit rate >80% indicates optimal caching strategy.');
    }

    // Gmail cache recommendations
    if (metrics.services.gmail.hitRate < 60) {
      recommendations.push('Gmail cache hit rate is low. Consider increasing search cache TTL from 1 hour to 2 hours.');
    }

    // Contact cache recommendations
    if (metrics.services.contact.hitRate < 70) {
      recommendations.push('Contact cache hit rate is low. Consider implementing fuzzy name matching for better hit rates.');
    }

    // Slack cache recommendations
    if (metrics.services.slack.hitRate < 50) {
      recommendations.push('Slack cache hit rate is low. Consider increasing channel history cache TTL from 30 minutes to 1 hour.');
    }

    // Performance recommendations
    if (metrics.avgResponseTimeImprovement > 200) {
      recommendations.push('Contact resolution is still slow (>200ms). Consider implementing additional caching layers.');
    }

    // Cost savings recommendations
    if (metrics.totalCostSavings > 100) {
      recommendations.push(`Great cost savings! Cache has saved $${metrics.totalCostSavings.toFixed(2)} in API costs.`);
    }

    return recommendations;
  }

  /**
   * Calculate cost impact and monthly projections
   */
  private calculateCostImpact(metrics: OverallCacheMetrics): {
    monthlySavings: number;
    apiCallReduction: number;
  } {
    // Project monthly savings based on current metrics
    const dailySavings = metrics.totalCostSavings;
    const monthlySavings = dailySavings * 30;

    // Calculate API call reduction percentage
    const totalRequests = metrics.totalHits + metrics.totalMisses;
    const apiCallReduction = totalRequests > 0 ? (metrics.totalHits / totalRequests) * 100 : 0;

    return {
      monthlySavings,
      apiCallReduction
    };
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary(): void {
    const report = this.generatePerformanceReport();
    
    this.logInfo('Cache Performance Summary', {
      overallHitRate: `${report.metrics.overallHitRate.toFixed(1)}%`,
      totalHits: report.metrics.totalHits,
      totalMisses: report.metrics.totalMisses,
      costSavings: `$${report.metrics.totalCostSavings.toFixed(2)}`,
      monthlyProjection: `$${report.costImpact.monthlySavings.toFixed(2)}`,
      apiCallReduction: `${report.costImpact.apiCallReduction.toFixed(1)}%`,
      recommendations: report.recommendations.length
    });

    // Log individual service performance
    this.logInfo('Service Performance Breakdown', {
      gmail: {
        hitRate: `${report.metrics.services.gmail.hitRate.toFixed(1)}%`,
        costSavings: `$${report.metrics.services.gmail.costSavings.toFixed(2)}`
      },
      contact: {
        hitRate: `${report.metrics.services.contact.hitRate.toFixed(1)}%`,
        avgResponseTime: `${report.metrics.services.contact.avgResponseTime.toFixed(0)}ms`
      },
      slack: {
        hitRate: `${report.metrics.services.slack.hitRate.toFixed(1)}%`,
        rateLimitSavings: `${report.metrics.services.slack.rateLimitSavings.toFixed(0)}s`
      }
    });
  }

  /**
   * Reset all cache metrics
   */
  async resetAllMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.gmailCacheService?.resetMetrics(),
        this.contactCacheService?.resetMetrics(),
        this.slackCacheService?.resetMetrics()
      ]);

      this.logInfo('All cache metrics reset');
    } catch (error) {
      this.logError('Failed to reset cache metrics', error);
    }
  }

  /**
   * Health check
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    const metrics = this.getOverallMetrics();
    
    return {
      healthy: true,
      details: {
        cacheServiceAvailable: !!this.cacheService,
        gmailCacheAvailable: !!this.gmailCacheService,
        contactCacheAvailable: !!this.contactCacheService,
        slackCacheAvailable: !!this.slackCacheService,
        overallHitRate: metrics.overallHitRate,
        totalCostSavings: metrics.totalCostSavings,
        totalRateLimitSavings: metrics.totalRateLimitSavings
      }
    };
  }
}
