/**
 * Centralized Error Manager Service for AI Assistant
 *
 * Provides centralized error handling, logging, monitoring, and analytics.
 * Integrates with retry manager and service health monitoring.
 */

import { BaseService } from '../services/base-service';
import { BaseError, ErrorSeverity, ErrorCategory, ErrorFactory, IError } from './error-types';
import { retryManager, RetryConfig } from './retry-manager';

/**
 * Error statistics and metrics
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByService: Record<string, number>;
  recentErrors: IError[];
  topErrors: Array<{ code: string; count: number; lastOccurred: Date }>;
  uptime: number;
  errorRate: number; // errors per minute
}

/**
 * Error notification configuration
 */
export interface ErrorNotificationConfig {
  enabled: boolean;
  severityThreshold: ErrorSeverity;
  rateLimitWindow: number; // milliseconds
  maxNotificationsPerWindow: number;
  webhookUrl?: string;
  emailRecipients?: string[];
}

/**
 * Error aggregation and tracking
 */
interface ErrorTracker {
  code: string;
  count: number;
  firstOccurred: Date;
  lastOccurred: Date;
  services: Set<string>;
  operations: Set<string>;
  recentOccurrences: Date[];
}

/**
 * Centralized Error Manager Service
 */
export class ErrorManagerService extends BaseService {
  private errorTrackers = new Map<string, ErrorTracker>();
  private recentErrors: IError[] = [];
  private maxRecentErrors = 1000;
  private startTime = Date.now();

  private notificationConfig: ErrorNotificationConfig = {
    enabled: process.env.NODE_ENV === 'production',
    severityThreshold: ErrorSeverity.HIGH,
    rateLimitWindow: 300000, // 5 minutes
    maxNotificationsPerWindow: 10
  };

  private notificationHistory = new Map<string, Date[]>();

  constructor() {
    super('errorManager');
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing ErrorManager...');

    // Register circuit breakers for critical services
    this.registerCircuitBreakers();

    // Start periodic cleanup
    this.startPeriodicCleanup();

    this.logInfo('ErrorManager initialized successfully');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('Destroying ErrorManager...');
    // Cleanup resources if needed
    this.logInfo('ErrorManager destroyed successfully');
  }

  /**
   * Handle error with centralized processing
   */
  handleCentralizedError(
    error: Error | BaseError,
    context?: {
      service?: string;
      operation?: string;
      correlationId?: string;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): BaseError {
    let processedError: BaseError;

    // Convert to BaseError if needed
    if (error instanceof BaseError) {
      processedError = error;
    } else {
      processedError = this.classifyError(error, context);
    }

    // Set context if provided
    if (context) {
      processedError.setContext(
        context.service,
        context.operation,
        context.correlationId
      );

      if (context.metadata) {
        Object.entries(context.metadata).forEach(([key, value]) => {
          processedError.addDetails(key, value);
        });
      }
    }

    // Track the error
    this.trackError(processedError);

    // Log the error
    this.logStructuredErrorDetails(processedError, context);

    // Send notifications if needed
    this.sendNotificationIfNeeded(processedError);

    // Update service health if applicable
    this.updateServiceHealth(processedError);

    return processedError;
  }

  /**
   * Execute operation with error handling and retry logic
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: {
      service: string;
      operation: string;
      retryConfig?: Partial<RetryConfig>;
      correlationId?: string;
      fallbackOperation?: () => Promise<T>;
    }
  ): Promise<T> {
    try {
      const result = context.fallbackOperation
        ? await retryManager.executeWithFallback(
            operation,
            context.fallbackOperation,
            context.retryConfig,
            { service: context.service, operation: context.operation }
          )
        : await retryManager.execute(
            operation,
            context.retryConfig,
            { service: context.service, operation: context.operation }
          );

      if (!result.success) {
        const error = this.handleCentralizedError(result.error!, {
          service: context.service,
          operation: context.operation,
          correlationId: context.correlationId,
          metadata: {
            attempts: result.attempts,
            totalTime: result.totalTime,
            recoveryStrategy: result.recoveryStrategy
          }
        });
        throw error;
      }

      return result.result!;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      const handledError = this.handleCentralizedError(error as Error, {
        service: context.service,
        operation: context.operation,
        correlationId: context.correlationId
      });
      throw handledError;
    }
  }

  /**
   * Get error statistics and metrics
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const uptime = now - this.startTime;
    const oneMinuteAgo = now - 60000;

    // Count recent errors for error rate
    const recentErrorCount = this.recentErrors.filter(
      error => error.timestamp && error.timestamp.getTime() > oneMinuteAgo
    ).length;

    // Aggregate statistics
    const errorsByCategory: Record<ErrorCategory, number> = Object.values(ErrorCategory)
      .reduce((acc, category) => ({ ...acc, [category]: 0 }), {} as Record<ErrorCategory, number>);

    const errorsBySeverity: Record<ErrorSeverity, number> = Object.values(ErrorSeverity)
      .reduce((acc, severity) => ({ ...acc, [severity]: 0 }), {} as Record<ErrorSeverity, number>);

    const errorsByService: Record<string, number> = {};

    this.recentErrors.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;

      if (error.service) {
        errorsByService[error.service] = (errorsByService[error.service] || 0) + 1;
      }
    });

    // Top errors
    const topErrors = Array.from(this.errorTrackers.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(tracker => ({
        code: tracker.code,
        count: tracker.count,
        lastOccurred: tracker.lastOccurred
      }));

    return {
      totalErrors: this.recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      errorsByService,
      recentErrors: this.recentErrors.slice(-50), // Last 50 errors
      topErrors,
      uptime,
      errorRate: recentErrorCount
    };
  }

  /**
   * Get errors for specific service
   */
  getServiceErrors(serviceName: string, limit: number = 50): IError[] {
    return this.recentErrors
      .filter(error => error.service === serviceName)
      .slice(-limit);
  }

  /**
   * Clear error history (for testing or reset)
   */
  clearErrorHistory(): void {
    this.recentErrors = [];
    this.errorTrackers.clear();
    this.notificationHistory.clear();
  }

  /**
   * Update notification configuration
   */
  updateNotificationConfig(config: Partial<ErrorNotificationConfig>): void {
    this.notificationConfig = { ...this.notificationConfig, ...config };
  }

  /**
   * Classify error based on content and context
   */
  private classifyError(error: Error, context?: any): BaseError {
    const message = error.message.toLowerCase();

    // Service errors
    if (message.includes('service') || message.includes('initialization')) {
      if (message.includes('dependency') || message.includes('unavailable')) {
        return ErrorFactory.createError(ErrorCategory.DEPENDENCY, error.message, {}, error);
      }
      return ErrorFactory.createError(ErrorCategory.SERVICE, error.message, {}, error);
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') ||
        message.includes('timeout') || message.includes('econnrefused')) {
      return ErrorFactory.createError(ErrorCategory.NETWORK, error.message, {}, error);
    }

    // Database errors
    if (message.includes('database') || message.includes('query') ||
        message.includes('postgres') || message.includes('sql')) {
      return ErrorFactory.createError(ErrorCategory.DATABASE, error.message, {}, error);
    }

    // API errors
    if (message.includes('api') || message.includes('request') ||
        message.includes('response') || message.includes('validation')) {
      return ErrorFactory.createError(ErrorCategory.API, error.message, {}, error);
    }

    // External service errors
    if (message.includes('openai') || message.includes('google') ||
        message.includes('slack') || message.includes('external')) {
      return ErrorFactory.createError(ErrorCategory.EXTERNAL, error.message, {}, error);
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('token') ||
        message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorFactory.createError(ErrorCategory.AUTHENTICATION, error.message, {}, error);
    }

    // Default to service error
    return ErrorFactory.createError(ErrorCategory.SERVICE, error.message, {}, error);
  }

  /**
   * Track error for analytics
   */
  private trackError(error: BaseError): void {
    const tracker = this.errorTrackers.get(error.code);
    const now = new Date();

    if (tracker) {
      tracker.count++;
      tracker.lastOccurred = now;
      if (error.service) tracker.services.add(error.service);
      if (error.operation) tracker.operations.add(error.operation);
      tracker.recentOccurrences.push(now);

      // Keep only recent occurrences (last hour)
      const oneHourAgo = now.getTime() - 3600000;
      tracker.recentOccurrences = tracker.recentOccurrences.filter(
        date => date.getTime() > oneHourAgo
      );
    } else {
      this.errorTrackers.set(error.code, {
        code: error.code,
        count: 1,
        firstOccurred: now,
        lastOccurred: now,
        services: new Set(error.service ? [error.service] : []),
        operations: new Set(error.operation ? [error.operation] : []),
        recentOccurrences: [now]
      });
    }

    // Add to recent errors
    this.recentErrors.push(error);

    // Maintain size limit
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(-this.maxRecentErrors * 0.8);
    }
  }

  /**
   * Log error with appropriate level
   */
  private logStructuredErrorDetails(error: BaseError, context?: any): void {
    const logData = {
      ...error.toJSON(),
      context
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        
        break;
      case ErrorSeverity.HIGH:
        
        break;
      case ErrorSeverity.MEDIUM:
        
        break;
      case ErrorSeverity.LOW:
        
        break;
      default:
        
    }
  }

  /**
   * Send error notifications if thresholds are met
   */
  private sendNotificationIfNeeded(error: BaseError): void {
    if (!this.notificationConfig.enabled) {
      return;
    }

    // Check severity threshold
    const severityLevels = Object.values(ErrorSeverity);
    const currentSeverityIndex = severityLevels.indexOf(error.severity);
    const thresholdIndex = severityLevels.indexOf(this.notificationConfig.severityThreshold);

    if (currentSeverityIndex > thresholdIndex) {
      return; // Error severity is below threshold
    }

    // Check rate limiting
    const notificationKey = `${error.code}:${error.service || 'unknown'}`;
    const now = new Date();
    const windowStart = now.getTime() - this.notificationConfig.rateLimitWindow;

    let recentNotifications = this.notificationHistory.get(notificationKey) || [];
    recentNotifications = recentNotifications.filter(date => date.getTime() > windowStart);

    if (recentNotifications.length >= this.notificationConfig.maxNotificationsPerWindow) {
      return; // Rate limit exceeded
    }

    // Send notification (implementation would depend on notification channels)
    this.sendNotification(error);

    // Update notification history
    recentNotifications.push(now);
    this.notificationHistory.set(notificationKey, recentNotifications);
  }

  /**
   * Send notification (placeholder for actual implementation)
   */
  private sendNotification(error: BaseError): void {
    // This would integrate with actual notification systems
  }

  /**
   * Update service health based on error
   */
  private updateServiceHealth(error: BaseError): void {
    // This would integrate with the service dependency manager
    // to update service health states based on error patterns
    if (error.service && error.severity === ErrorSeverity.CRITICAL) {
      this.logInfo('Critical error detected, considering service health degradation', {
        service: error.service,
        error: error.code
      });
    }
  }

  /**
   * Register circuit breakers for critical services
   */
  private registerCircuitBreakers(): void {
    const criticalServices = [
      'databaseService',
      'openaiService',
      'emailService',
      'calendarService',
      'slackInterfaceService'
    ];

    criticalServices.forEach(service => {
      retryManager.registerCircuitBreaker(service, 'default', {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 300000,
        minimumThroughput: 10
      });
    });
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // 5 minutes
  }

  /**
   * Cleanup old error data
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - 3600000; // 1 hour ago

    // Clean recent errors
    this.recentErrors = this.recentErrors.filter(
      error => error.timestamp && error.timestamp.getTime() > cutoffTime
    );

    // Clean notification history
    this.notificationHistory.forEach((notifications, key) => {
      const filteredNotifications = notifications.filter(
        date => date.getTime() > cutoffTime
      );

      if (filteredNotifications.length === 0) {
        this.notificationHistory.delete(key);
      } else {
        this.notificationHistory.set(key, filteredNotifications);
      }
    });
  }
}

/**
 * Singleton instance
 */
export const errorManager = new ErrorManagerService();