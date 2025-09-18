/**
 * Cache Performance Monitoring Service
 * Tracks hit rates, cost savings, and performance metrics across all cache services
 *
 * Enhanced Monitoring:
 * - Gmail API cache (cost savings)
 * - Contact Resolution cache (speed improvements)
 * - Slack Message cache (rate limit protection)
 * - Calendar API cache (consistency improvements)
 * - Cache invalidation metrics
 * - Cache consistency metrics
 * - Cache warming effectiveness
 * - Overall cache performance analytics
 */

import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { GmailCacheService } from './email/gmail-cache.service';
import { ContactCacheService } from './contact/contact-cache.service';
import { SlackCacheService } from './slack/slack-cache.service';
import { CalendarCacheService } from './calendar/calendar-cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheConsistencyService } from './cache-consistency.service';
import { CacheWarmingService } from './cache-warming.service';
import { ServiceManager } from './service-manager';

export interface OverallCacheMetrics {
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  totalCostSavings: number;
  totalRateLimitSavings: number;
  avgResponseTimeImprovement: number;
  consistencyScore: number;
  warmingEffectiveness: number;
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
    calendar: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
      consistencyScore: number;
    };
  };
  invalidation: {
    totalInvalidations: number;
    invalidationsByType: Record<string, number>;
    averageInvalidationTime: number;
  };
  consistency: {
    operationsByLevel: Record<string, number>;
    consistencyViolations: number;
    adaptiveAdjustments: number;
  };
  warming: {
    totalTasks: number;
    successfulTasks: number;
    averageExecutionTime: number;
    cacheHitImprovement: number;
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
  private calendarCacheService: CalendarCacheService | null = null;
  private cacheInvalidationService: CacheInvalidationService | null = null;
  private cacheConsistencyService: CacheConsistencyService | null = null;
  private cacheWarmingService: CacheWarmingService | null = null;

  constructor() {
    super('CachePerformanceMonitoringService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing Enhanced Cache Performance Monitoring Service...');

    try {
      // Get dependencies from service manager
      const serviceManager = ServiceManager.getInstance();
      this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;
      this.gmailCacheService = serviceManager.getService<GmailCacheService>('gmailCacheService') || null;
      this.contactCacheService = serviceManager.getService<ContactCacheService>('contactCacheService') || null;
      this.slackCacheService = serviceManager.getService<SlackCacheService>('slackCacheService') || null;
      this.calendarCacheService = serviceManager.getService<CalendarCacheService>('calendarCacheService') || null;
      this.cacheInvalidationService = serviceManager.getService<CacheInvalidationService>('cacheInvalidationService') || null;
      this.cacheConsistencyService = serviceManager.getService<CacheConsistencyService>('cacheConsistencyService') || null;
      this.cacheWarmingService = serviceManager.getService<CacheWarmingService>('cacheWarmingService') || null;

      this.logInfo('Enhanced Cache Performance Monitoring Service initialized successfully', {
        availableServices: {
          cache: !!this.cacheService,
          gmail: !!this.gmailCacheService,
          contact: !!this.contactCacheService,
          slack: !!this.slackCacheService,
          calendar: !!this.calendarCacheService,
          invalidation: !!this.cacheInvalidationService,
          consistency: !!this.cacheConsistencyService,
          warming: !!this.cacheWarmingService
        }
      });

    } catch (error) {
      this.logError('Failed to initialize Enhanced Cache Performance Monitoring Service', error);
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
   * Get comprehensive cache performance metrics
   */
  getOverallMetrics(): OverallCacheMetrics {
    // Get metrics from all cache services
    const gmailMetrics = this.gmailCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, costSavings: 0 };
    const contactMetrics = this.contactCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0 };
    const slackMetrics = this.slackCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, rateLimitSavings: 0 };
    const calendarMetrics = this.calendarCacheService?.getMetrics() || { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0, consistencyScore: 100 };

    // Get metrics from advanced cache services
    const invalidationMetrics = this.cacheInvalidationService?.getMetrics() || {
      totalInvalidations: 0,
      invalidationsByType: {},
      averageInvalidationTime: 0
    };
    const consistencyMetrics = this.cacheConsistencyService?.getMetrics() || {
      operationsByLevel: {},
      consistencyViolations: 0,
      adaptiveAdjustments: 0
    };
    const warmingMetrics = this.cacheWarmingService?.getMetrics() || {
      totalTasks: 0,
      successfulTasks: 0,
      averageExecutionTime: 0,
      cacheHitImprovement: 0
    };

    // Calculate overall statistics
    const totalHits = gmailMetrics.hits + contactMetrics.hits + slackMetrics.hits + calendarMetrics.hits;
    const totalMisses = gmailMetrics.misses + contactMetrics.misses + slackMetrics.misses + calendarMetrics.misses;
    const overallHitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

    // Calculate composite scores
    const avgResponseTime = this.calculateAverageResponseTime(contactMetrics, calendarMetrics);
    const consistencyScore = this.calculateConsistencyScore(consistencyMetrics, calendarMetrics);
    const warmingEffectiveness = this.calculateWarmingEffectiveness(warmingMetrics);

    return {
      totalHits,
      totalMisses,
      overallHitRate,
      totalCostSavings: gmailMetrics.costSavings || 0,
      totalRateLimitSavings: slackMetrics.rateLimitSavings || 0,
      avgResponseTimeImprovement: avgResponseTime,
      consistencyScore,
      warmingEffectiveness,
      lastReset: new Date(),
      services: {
        gmail: {
          hits: gmailMetrics.hits,
          misses: gmailMetrics.misses,
          hitRate: gmailMetrics.hitRate,
          costSavings: gmailMetrics.costSavings || 0
        },
        contact: {
          hits: contactMetrics.hits,
          misses: contactMetrics.misses,
          hitRate: contactMetrics.hitRate,
          avgResponseTime: contactMetrics.avgResponseTime || 0
        },
        slack: {
          hits: slackMetrics.hits,
          misses: slackMetrics.misses,
          hitRate: slackMetrics.hitRate,
          rateLimitSavings: slackMetrics.rateLimitSavings || 0
        },
        calendar: {
          hits: calendarMetrics.hits,
          misses: calendarMetrics.misses,
          hitRate: calendarMetrics.hitRate,
          avgResponseTime: calendarMetrics.avgResponseTime || 0,
          consistencyScore: calendarMetrics.consistencyScore || 100
        }
      },
      invalidation: {
        totalInvalidations: invalidationMetrics.totalInvalidations,
        invalidationsByType: invalidationMetrics.invalidationsByType,
        averageInvalidationTime: invalidationMetrics.averageInvalidationTime
      },
      consistency: {
        operationsByLevel: consistencyMetrics.operationsByLevel,
        consistencyViolations: consistencyMetrics.consistencyViolations,
        adaptiveAdjustments: consistencyMetrics.adaptiveAdjustments
      },
      warming: {
        totalTasks: warmingMetrics.totalTasks,
        successfulTasks: warmingMetrics.successfulTasks,
        averageExecutionTime: warmingMetrics.averageExecutionTime,
        cacheHitImprovement: warmingMetrics.cacheHitImprovement
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
   * Helper methods for calculating composite scores
   */
  private calculateAverageResponseTime(contactMetrics: any, calendarMetrics: any): number {
    const contactTime = contactMetrics.avgResponseTime || 0;
    const calendarTime = calendarMetrics.avgResponseTime || 0;

    if (contactTime === 0 && calendarTime === 0) return 0;
    if (contactTime === 0) return calendarTime;
    if (calendarTime === 0) return contactTime;

    return (contactTime + calendarTime) / 2;
  }

  private calculateConsistencyScore(consistencyMetrics: any, calendarMetrics: any): number {
    const violations = consistencyMetrics.consistencyViolations || 0;
    const totalOps = Object.values(consistencyMetrics.operationsByLevel || {}).reduce((a: any, b: any) => a + b, 0) as number;
    const calendarConsistency = calendarMetrics.consistencyScore || 100;

    if (totalOps === 0) return calendarConsistency;

    const violationRate = violations / totalOps;
    const operationScore = Math.max(0, 100 - (violationRate * 100));

    return (operationScore + calendarConsistency) / 2;
  }

  private calculateWarmingEffectiveness(warmingMetrics: any): number {
    const total = warmingMetrics.totalTasks || 0;
    const successful = warmingMetrics.successfulTasks || 0;
    const hitImprovement = warmingMetrics.cacheHitImprovement || 0;

    if (total === 0) return 0;

    const successRate = (successful / total) * 100;
    const effectivenessScore = (successRate + hitImprovement) / 2;

    return Math.min(100, effectivenessScore);
  }

  /**
   * Generate enhanced performance recommendations based on comprehensive metrics
   */
  private generateRecommendations(metrics: OverallCacheMetrics): string[] {
    const recommendations: string[] = [];

    // Overall hit rate recommendations
    if (metrics.overallHitRate < 50) {
      recommendations.push('⚠️ Overall cache hit rate is low (<50%). Consider increasing cache TTL or optimizing cache keys.');
    } else if (metrics.overallHitRate > 80) {
      recommendations.push('✅ Excellent cache performance! Hit rate >80% indicates optimal caching strategy.');
    }

    // Service-specific recommendations
    if (metrics.services.gmail.hitRate < 60) {
      recommendations.push('📧 Gmail cache hit rate is low. Consider increasing search cache TTL from 1 hour to 2 hours.');
    }

    if (metrics.services.contact.hitRate < 70) {
      recommendations.push('👥 Contact cache hit rate is low. Consider implementing fuzzy name matching for better hit rates.');
    }

    if (metrics.services.slack.hitRate < 50) {
      recommendations.push('💬 Slack cache hit rate is low. Consider increasing channel history cache TTL from 30 minutes to 1 hour.');
    }

    if (metrics.services.calendar.hitRate < 60) {
      recommendations.push('📅 Calendar cache hit rate is low. Consider extending event list TTL or implementing predictive caching.');
    }

    // Performance recommendations
    if (metrics.avgResponseTimeImprovement > 200) {
      recommendations.push('⚡ Response times are still slow (>200ms). Consider implementing additional caching layers or cache warming.');
    }

    // Consistency recommendations
    if (metrics.consistencyScore < 90) {
      recommendations.push('🔄 Cache consistency score is below optimal. Review invalidation strategies and consistency levels.');
    }

    if (metrics.consistency.consistencyViolations > 10) {
      recommendations.push('⚠️ High number of consistency violations detected. Consider adjusting TTL values or consistency requirements.');
    }

    // Warming recommendations
    if (metrics.warmingEffectiveness < 50) {
      recommendations.push('🔥 Cache warming effectiveness is low. Review warming strategies and timing.');
    }

    if (metrics.warming.totalTasks > 0 && (metrics.warming.successfulTasks / metrics.warming.totalTasks) < 0.8) {
      recommendations.push('🔧 Cache warming failure rate is high. Check service dependencies and error handling.');
    }

    // Invalidation recommendations
    if (metrics.invalidation.totalInvalidations === 0) {
      recommendations.push('🗑️ No cache invalidations recorded. Ensure invalidation service is properly integrated.');
    } else if (metrics.invalidation.averageInvalidationTime > 100) {
      recommendations.push('⏱️ Cache invalidation is slow (>100ms). Consider optimizing invalidation patterns.');
    }

    // Cost savings recommendations
    if (metrics.totalCostSavings > 100) {
      recommendations.push(`💰 Great cost savings! Cache has saved $${metrics.totalCostSavings.toFixed(2)} in API costs.`);
    } else if (metrics.totalCostSavings < 10) {
      recommendations.push('💸 Low cost savings detected. Review cache hit rates for expensive API operations.');
    }

    // Adaptive recommendations
    if (metrics.consistency.adaptiveAdjustments > 50) {
      recommendations.push('🤖 High adaptive adjustments indicate dynamic optimization is working well.');
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
   * Reset all cache metrics across all services
   */
  async resetAllMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.gmailCacheService?.resetMetrics(),
        this.contactCacheService?.resetMetrics(),
        this.slackCacheService?.resetMetrics(),
        this.calendarCacheService?.resetMetrics(),
        this.cacheInvalidationService?.resetMetrics(),
        this.cacheConsistencyService?.resetMetrics()
      ]);

      this.logInfo('All cache metrics reset across all services');
    } catch (error) {
      this.logError('Failed to reset cache metrics', error);
    }
  }

  /**
   * Generate comprehensive performance dashboard data
   */
  generatePerformanceDashboard(): {
    summary: any;
    trends: any;
    alerts: string[];
    optimizations: string[];
  } {
    const metrics = this.getOverallMetrics();
    const recommendations = this.generateRecommendations(metrics);

    // Categorize recommendations
    const alerts = recommendations.filter(r => r.includes('⚠️') || r.includes('💸'));
    const optimizations = recommendations.filter(r => r.includes('📧') || r.includes('👥') || r.includes('💬') || r.includes('📅'));

    return {
      summary: {
        overallHitRate: `${metrics.overallHitRate.toFixed(1)}%`,
        totalOperations: metrics.totalHits + metrics.totalMisses,
        costSavings: `$${metrics.totalCostSavings.toFixed(2)}`,
        consistencyScore: `${metrics.consistencyScore.toFixed(1)}%`,
        warmingEffectiveness: `${metrics.warmingEffectiveness.toFixed(1)}%`
      },
      trends: {
        hitRateByService: {
          gmail: metrics.services.gmail.hitRate,
          contact: metrics.services.contact.hitRate,
          slack: metrics.services.slack.hitRate,
          calendar: metrics.services.calendar.hitRate
        },
        responseTimeTrend: metrics.avgResponseTimeImprovement,
        invalidationTrend: metrics.invalidation.totalInvalidations
      },
      alerts,
      optimizations
    };
  }

  /**
   * Enhanced health check with comprehensive service monitoring
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    const metrics = this.getOverallMetrics();

    // Determine overall health based on multiple factors
    const isHealthy = this.calculateOverallHealth(metrics);

    return {
      healthy: isHealthy,
      details: {
        services: {
          cache: !!this.cacheService,
          gmail: !!this.gmailCacheService,
          contact: !!this.contactCacheService,
          slack: !!this.slackCacheService,
          calendar: !!this.calendarCacheService,
          invalidation: !!this.cacheInvalidationService,
          consistency: !!this.cacheConsistencyService,
          warming: !!this.cacheWarmingService
        },
        performance: {
          overallHitRate: metrics.overallHitRate,
          totalOperations: metrics.totalHits + metrics.totalMisses,
          costSavings: metrics.totalCostSavings,
          rateLimitSavings: metrics.totalRateLimitSavings,
          avgResponseTime: metrics.avgResponseTimeImprovement,
          consistencyScore: metrics.consistencyScore,
          warmingEffectiveness: metrics.warmingEffectiveness
        },
        issues: {
          consistencyViolations: metrics.consistency.consistencyViolations,
          invalidationFailures: metrics.invalidation.totalInvalidations === 0,
          lowHitRate: metrics.overallHitRate < 50,
          slowInvalidation: metrics.invalidation.averageInvalidationTime > 100
        },
        recommendations: this.generateRecommendations(metrics).length
      }
    };
  }

  /**
   * Calculate overall health score based on multiple metrics
   */
  private calculateOverallHealth(metrics: OverallCacheMetrics): boolean {
    const healthFactors = [
      metrics.overallHitRate > 50, // Hit rate above 50%
      metrics.consistencyScore > 80, // Consistency above 80%
      metrics.consistency.consistencyViolations < 20, // Low violation count
      metrics.invalidation.averageInvalidationTime < 200, // Fast invalidation
      metrics.warmingEffectiveness > 30 || metrics.warming.totalTasks === 0 // Warming working or not needed
    ];

    const healthyFactors = healthFactors.filter(factor => factor).length;
    const healthScore = healthyFactors / healthFactors.length;

    return healthScore >= 0.6; // 60% of factors must be healthy
  }
}
