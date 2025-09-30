/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { BaseService } from './base-service';
import { unifiedConfig } from '../config/unified-config';

/**
 * Sentry error tracking and performance monitoring service
 */
export class SentryService extends BaseService {
  private isInitialized = false;

  constructor() {
    super('SentryService');
  }

  /**
   * Cleanup resources when service is destroyed
   */
  protected async onDestroy(): Promise<void> {
    // Sentry cleanup is handled automatically
    this.logInfo('SentryService destroyed');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing SentryService...');

    try {
      const config = unifiedConfig;
      const sentryDsn = process.env.SENTRY_DSN;

      if (!sentryDsn) {
        this.logWarn('SENTRY_DSN not provided, Sentry will be disabled', {
          operation: 'sentry_initialization'
        });
        return;
      }

      // Initialize Sentry
      Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.npm_package_version || '1.0.0',
        
        // Performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        
        // Error filtering
        beforeSend(event, hint) {
          // Filter out known non-critical errors
          if (event.exception) {
            const error = hint.originalException;
            if (error instanceof Error) {
              // Filter out rate limiting errors
              if (error.message.includes('RATE_LIMITED')) {
                return null;
              }
              
              // Filter out validation errors
              if (error.message.includes('validation') || error.message.includes('Invalid')) {
                return null;
              }
            }
          }
          
          return event;
        },

        // Integrations
        integrations: [
          nodeProfilingIntegration(),
          Sentry.httpIntegration({
            breadcrumbs: true,
          }),
          Sentry.expressIntegration(),
        ],

        // Additional options
        maxBreadcrumbs: 50,
        attachStacktrace: true,
        sendDefaultPii: false, // Don't send personally identifiable information
      });

      this.isInitialized = true;
      this.logInfo('SentryService initialized successfully', {
        operation: 'sentry_initialization',
        metadata: {
          environment: process.env.NODE_ENV || 'development',
          dsn: sentryDsn.substring(0, 20) + '...' // Log partial DSN for verification
        }
      });

    } catch (error) {
      this.logError('Failed to initialize SentryService', { error });
      // Don't throw - Sentry is optional
    }
  }

  /**
   * Capture an exception
   */
  public captureException(error: Error, context?: Record<string, any>): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
        }
        
        Sentry.captureException(error);
      });
    } catch (sentryError) {
      this.logError('Failed to capture exception in Sentry', { 
        originalError: error,
        sentryError 
      });
    }
  }

  /**
   * Capture a message
   */
  public captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
        }
        
        Sentry.captureMessage(message, level);
      });
    } catch (sentryError) {
      this.logError('Failed to capture message in Sentry', { 
        message,
        sentryError 
      });
    }
  }

  /**
   * Add breadcrumb
   */
  public addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      Sentry.addBreadcrumb(breadcrumb);
    } catch (sentryError) {
      this.logError('Failed to add breadcrumb in Sentry', { 
        breadcrumb,
        sentryError 
      });
    }
  }

  /**
   * Set user context
   */
  public setUser(user: Sentry.User): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      Sentry.setUser(user);
    } catch (sentryError) {
      this.logError('Failed to set user in Sentry', { 
        user,
        sentryError 
      });
    }
  }

  /**
   * Set tags
   */
  public setTags(tags: Record<string, string>): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      Sentry.setTags(tags);
    } catch (sentryError) {
      this.logError('Failed to set tags in Sentry', { 
        tags,
        sentryError 
      });
    }
  }

  /**
   * Set extra context
   */
  public setExtra(key: string, value: any): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      Sentry.setExtra(key, value);
    } catch (sentryError) {
      this.logError('Failed to set extra in Sentry', { 
        key,
        value,
        sentryError 
      });
    }
  }

  /**
   * Start a transaction
   */
  public startTransaction(name: string, op: string): any | undefined {
    if (!this.isInitialized) {
      return undefined;
    }

    try {
      return Sentry.startSpan({ name, op }, () => {});
    } catch (sentryError) {
      this.logError('Failed to start transaction in Sentry', { 
        name,
        op,
        sentryError 
      });
      return undefined;
    }
  }

  /**
   * Get Sentry service health status
   */
  public getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        state: this._state,
        isInitialized: this.isInitialized,
        hasDsn: !!process.env.SENTRY_DSN
      }
    };
  }

  /**
   * Get Sentry service statistics
   */
  public getStats(): { isInitialized: boolean; hasDsn: boolean } {
    return {
      isInitialized: this.isInitialized,
      hasDsn: !!process.env.SENTRY_DSN
    };
  }
}
