import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { SlackCacheService } from './slack-cache.service';
import { ServiceManager } from '../service-manager';
import { SlackContext } from '../../types/slack/slack.types';
import logger from '../../utils/logger';

export interface SlackContextExtractorConfig {
  enableUserInfoFetching: boolean;
  enableEmailExtraction: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * SlackContextExtractor - Focused service for extracting Slack context from events
 * Handles user information fetching, context creation, and message cleaning
 */
export class SlackContextExtractor extends BaseService {
  private config: SlackContextExtractorConfig;
  private client: WebClient;
  private slackCacheService: SlackCacheService | null = null;

  constructor(config: SlackContextExtractorConfig, client: WebClient) {
    super('SlackContextExtractor');
    this.config = config;
    this.client = client;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackContextExtractor...');
      
      // Get Slack cache service from service manager
      const serviceManager = ServiceManager.getInstance();
      this.slackCacheService = serviceManager.getService<SlackCacheService>('slackCacheService') || null;

      if (!this.slackCacheService) {
        this.logWarn('SlackCacheService not available - using direct Slack API calls');
      }
      
      this.logInfo('SlackContextExtractor initialized successfully', {
        enableUserInfoFetching: this.config.enableUserInfoFetching,
        enableEmailExtraction: this.config.enableEmailExtraction,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay,
        cacheServiceAvailable: !!this.slackCacheService
      });
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('SlackContextExtractor destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackContextExtractor destruction', error);
    }
  }

  /**
   * Extract Slack context from raw event
   */
  async extractSlackContext(event: any, teamId: string): Promise<SlackContext> {
    try {
      // Get additional user information if available
      let userName: string | undefined;
      let userEmail: string | undefined;
      
      if (this.config.enableUserInfoFetching && event.user) {
        try {
          const userInfo = await this.fetchUserInfoWithRetry(event.user);
          if (userInfo) {
            userName = userInfo.name;
            if (this.config.enableEmailExtraction) {
              userEmail = userInfo.profile?.email;
            }
          }
        } catch (userError) {
          this.logDebug('Could not fetch additional user info', { 
            error: userError,
            userId: event.user 
          });
        }
      }
      
      return {
        userId: event.user || 'unknown',
        channelId: event.channel || 'unknown',
        teamId: teamId,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im',
        userName,
        userEmail
      };
    } catch (error) {
      this.logError('Error extracting Slack context', error);
      
      // Return basic context as fallback
      return {
        userId: event.user || 'unknown',
        channelId: event.channel || 'unknown',
        teamId: teamId,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im'
      };
    }
  }

  /**
   * Clean Slack message (remove mentions, normalize whitespace)
   */
  cleanMessage(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/<@[UW][A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/<![^>]+>/g, '') // Remove special mentions (@channel, @here)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Fetch user information with retry logic
   */
  private async fetchUserInfoWithRetry(userId: string): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Try cache first if available
        if (this.slackCacheService) {
          const cachedUserInfo = await this.slackCacheService.getCachedUserInfo(userId);
          if (cachedUserInfo) {
            return cachedUserInfo;
          }
        }

        // Cache miss or no cache service - call Slack API
        const userInfo = await this.client.users.info({ user: userId });
        
        // Cache the result if cache service is available
        if (this.slackCacheService && userInfo.user) {
          await this.slackCacheService.cacheUserInfo(userId, userInfo.user);
        }
        
        return userInfo.user;
      } catch (error) {
        lastError = error as Error;
        this.logDebug(`User info fetch attempt ${attempt} failed`, { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay);
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch user info after all retries');
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy,
      details: {
        ...baseHealth.details,
        config: this.config,
        hasClient: !!this.client
      }
    };
  }
}
