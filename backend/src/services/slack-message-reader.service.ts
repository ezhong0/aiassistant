import { WebClient } from '@slack/web-api';
import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { CacheService } from './cache.service';
import { DatabaseService } from './database.service';
import { SlackMessageReaderError, SlackMessageReaderErrorCode } from '../types/slack-message-reader.types';
import { SlackMessage, SlackMessageHistoryOptions, SlackMessageFilter } from '../types/slack-message-reader.types';
import { serviceManager } from './service-manager';
import logger from '../utils/logger';

/**
 * SlackMessageReaderService - Dedicated service for reading Slack message history
 * Extends BaseService and follows our established service lifecycle patterns
 * Provides safe, rate-limited access to Slack message history with privacy controls
 */
export class SlackMessageReaderService extends BaseService {
  private client: WebClient;
  private botToken: string;
  
  // Injected service dependencies
  private cacheService: CacheService | null = null;
  private databaseService: DatabaseService | null = null;
  
  // Rate limiting and quota management
  private readonly rateLimitConfig = {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 1000,
    maxMessagesPerRequest: 100,
    cacheExpirationMinutes: 5
  };
  
  private requestCounts = {
    minute: { count: 0, resetTime: Date.now() + 60000 },
    hour: { count: 0, resetTime: Date.now() + 3600000 }
  };

  constructor(botToken: string) {
    super('SlackMessageReaderService');
    this.botToken = botToken;
    this.client = new WebClient(botToken);
  }

  /**
   * Service-specific initialization
   * Sets up dependency injection and validates configuration
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Starting SlackMessageReader initialization...', {
        hasBotToken: !!this.botToken,
        rateLimitConfig: this.rateLimitConfig
      });

      // Validate configuration
      this.validateConfig();

      // Initialize service dependencies through service manager
      await this.initializeDependencies();

      // Test Slack client connection
      await this.testSlackConnection();

      this.logInfo('SlackMessageReader initialized successfully', {
        hasCacheService: !!this.cacheService,
        hasDatabaseService: !!this.databaseService
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
      // Reset service references
      this.cacheService = null;
      this.databaseService = null;

      // Clear rate limiting counters
      this.requestCounts = {
        minute: { count: 0, resetTime: Date.now() + 60000 },
        hour: { count: 0, resetTime: Date.now() + 3600000 }
      };

      this.logInfo('SlackMessageReader destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackMessageReader destruction', error);
    }
  }

  /**
   * Validate required configuration
   */
  private validateConfig(): void {
    if (!this.botToken) {
      throw new Error('Bot token is required for SlackMessageReaderService');
    }

    this.logDebug('SlackMessageReader configuration validated successfully');
  }

  /**
   * Initialize service dependencies through dependency injection
   */
  private async initializeDependencies(): Promise<void> {
    // Get CacheService (optional)
    this.cacheService = serviceManager.getService('cacheService') as CacheService;
    if (!this.cacheService) {
      this.logWarn('CacheService not available - message caching will be disabled');
    } else {
      this.logDebug('CacheService injected successfully');
    }

    // Get DatabaseService (optional for audit logging)
    this.databaseService = serviceManager.getService('databaseService') as DatabaseService;
    if (!this.databaseService) {
      this.logWarn('DatabaseService not available - audit logging will be disabled');
    } else {
      this.logDebug('DatabaseService injected successfully');
    }
  }

  /**
   * Test Slack client connection
   */
  private async testSlackConnection(): Promise<void> {
    try {
      const authTest = await this.client.auth.test();
      this.logInfo('Slack connection verified', {
        teamId: authTest.team_id,
        userId: authTest.user_id,
        botId: authTest.bot_id
      });
    } catch (error) {
      this.logError('Failed to verify Slack connection', error);
      throw new SlackMessageReaderError('Slack client authentication failed', SlackMessageReaderErrorCode.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Read message history from a Slack channel or DM
   */
  async readMessageHistory(
    channelId: string,
    options: SlackMessageHistoryOptions = {}
  ): Promise<SlackMessage[]> {
    this.assertReady();

    const startTime = Date.now();
    const requestId = `msg-read-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logInfo('Reading Slack message history', {
        requestId,
        channelId,
        options: {
          limit: options.limit || this.rateLimitConfig.maxMessagesPerRequest,
          oldest: options.oldest,
          latest: options.latest,
          includeAllMetadata: options.includeAllMetadata || false
        }
      });

      // Check rate limits
      await this.checkRateLimits();

      // Apply message filtering
      const filter = options.filter || this.getDefaultMessageFilter();

      // Check cache first
      const cacheKey = this.generateCacheKey(channelId, options);
      let messages = await this.getCachedMessages(cacheKey);

      if (!messages) {
        // Fetch from Slack API
        messages = await this.fetchMessagesFromSlack(channelId, options);
        
        // Cache the results
        await this.cacheMessages(cacheKey, messages);
      }

      // Ensure messages is an array before filtering
      if (!Array.isArray(messages)) {
        this.logWarn('Messages is not an array, forcing empty array', { 
          messagesType: typeof messages,
          messagesValue: messages,
          channelId 
        });
        messages = [];
      }

      // Apply filtering
      const filteredMessages = this.applyMessageFilter(messages, filter);

      // Log audit trail
      await this.logAuditTrail(requestId, channelId, filteredMessages.length, startTime);

      const processingTime = Date.now() - startTime;
      this.logInfo('Message history read successfully', {
        requestId,
        channelId,
        totalMessages: messages.length,
        filteredMessages: filteredMessages.length,
        processingTimeMs: processingTime
      });

      return filteredMessages;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Error reading message history', error, {
        requestId,
        channelId,
        processingTimeMs: processingTime
      });
      throw this.handleSlackError(error, 'readMessageHistory');
    }
  }

  /**
   * Read recent messages from a channel (last N messages)
   */
  async readRecentMessages(
    channelId: string,
    count: number = 10,
    options: Omit<SlackMessageHistoryOptions, 'limit'> = {}
  ): Promise<SlackMessage[]> {
    return this.readMessageHistory(channelId, {
      ...options,
      limit: Math.min(count, this.rateLimitConfig.maxMessagesPerRequest)
    });
  }

  /**
   * Read messages from a specific thread
   */
  async readThreadMessages(
    channelId: string,
    threadTs: string,
    options: SlackMessageHistoryOptions = {}
  ): Promise<SlackMessage[]> {
    this.assertReady();

    try {
      this.logInfo('Reading Slack thread messages', {
        channelId,
        threadTs,
        limit: options.limit || 50
      });

      // Fetch thread replies
      const response = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: options.limit || 50,
        oldest: options.oldest,
        latest: options.latest
      });

      if (!response.messages) {
        this.logDebug('No thread messages found', { channelId, threadTs });
        return [];
      }

      // Convert to our message format
      const messages = this.convertSlackMessages(response.messages, channelId);

      // Apply filtering
      const filter = options.filter || this.getDefaultMessageFilter();
      const filteredMessages = this.applyMessageFilter(messages, filter);

      this.logInfo('Thread messages read successfully', {
        channelId,
        threadTs,
        totalMessages: messages.length,
        filteredMessages: filteredMessages.length
      });

      return filteredMessages;

    } catch (error) {
      this.logError('Error reading thread messages', error, { channelId, threadTs });
      throw this.handleSlackError(error, 'readThreadMessages');
    }
  }

  /**
   * Search messages across channels
   */
  async searchMessages(
    query: string,
    options: {
      channels?: string[];
      limit?: number;
      sort?: 'score' | 'timestamp';
      sortDir?: 'asc' | 'desc';
    } = {}
  ): Promise<SlackMessage[]> {
    this.assertReady();

    try {
      this.logInfo('Searching Slack messages', {
        query,
        channels: options.channels,
        limit: options.limit || 20
      });

      // Check rate limits
      await this.checkRateLimits();

      // Use Slack search API
      const response = await this.client.search.messages({
        query,
        count: options.limit || 20,
        sort: options.sort || 'score',
        sort_dir: options.sortDir || 'desc'
      });

      if (!response.messages?.matches) {
        this.logDebug('No search results found', { query });
        return [];
      }

      // Convert to our message format
      const messages = this.convertSlackMessages(response.messages.matches);

      // Filter by channels if specified
      let filteredMessages = messages;
      if (options.channels && options.channels.length > 0) {
        filteredMessages = messages.filter(msg => 
          options.channels!.includes(msg.channelId)
        );
      }

      this.logInfo('Message search completed', {
        query,
        totalResults: messages.length,
        filteredResults: filteredMessages.length
      });

      return filteredMessages;

    } catch (error) {
      this.logError('Error searching messages', error, { query });
      throw this.handleSlackError(error, 'searchMessages');
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channelId: string): Promise<{
    id: string;
    name: string;
    type: string;
    isPrivate: boolean;
    memberCount?: number;
    topic?: string;
    purpose?: string;
  }> {
    this.assertReady();

    try {
      this.logDebug('Getting channel information', { channelId });

      const response = await this.client.conversations.info({
        channel: channelId
      });

      if (!response.channel) {
        throw new SlackMessageReaderError(`Channel not found: ${channelId}`, SlackMessageReaderErrorCode.NOT_FOUND);
      }

      const channel = response.channel;
      const channelInfo = {
        id: channel.id!,
        name: channel.name || 'Unknown',
        type: channel.is_im ? 'im' : channel.is_private ? 'private' : 'public',
        isPrivate: channel.is_private || false,
        memberCount: channel.num_members,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value
      };

      this.logDebug('Channel information retrieved', channelInfo);
      return channelInfo;

    } catch (error) {
      this.logError('Error getting channel information', error, { channelId });
      throw this.handleSlackError(error, 'getChannelInfo');
    }
  }

  /**
   * Check rate limits before making API calls
   */
  private async checkRateLimits(): Promise<void> {
    const now = Date.now();

    // Reset counters if time windows have passed
    if (now >= this.requestCounts.minute.resetTime) {
      this.requestCounts.minute = { count: 0, resetTime: now + 60000 };
    }
    if (now >= this.requestCounts.hour.resetTime) {
      this.requestCounts.hour = { count: 0, resetTime: now + 3600000 };
    }

    // Check minute limit
    if (this.requestCounts.minute.count >= this.rateLimitConfig.maxRequestsPerMinute) {
      const waitTime = this.requestCounts.minute.resetTime - now;
      this.logWarn('Rate limit exceeded (minute)', {
        currentCount: this.requestCounts.minute.count,
        limit: this.rateLimitConfig.maxRequestsPerMinute,
        waitTimeMs: waitTime
      });
      throw new SlackMessageReaderError(
        `Rate limit exceeded: ${this.requestCounts.minute.count}/${this.rateLimitConfig.maxRequestsPerMinute} requests per minute`,
        SlackMessageReaderErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    // Check hour limit
    if (this.requestCounts.hour.count >= this.rateLimitConfig.maxRequestsPerHour) {
      const waitTime = this.requestCounts.hour.resetTime - now;
      this.logWarn('Rate limit exceeded (hour)', {
        currentCount: this.requestCounts.hour.count,
        limit: this.rateLimitConfig.maxRequestsPerHour,
        waitTimeMs: waitTime
      });
      throw new SlackMessageReaderError(
        `Rate limit exceeded: ${this.requestCounts.hour.count}/${this.rateLimitConfig.maxRequestsPerHour} requests per hour`,
        SlackMessageReaderErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    // Increment counters
    this.requestCounts.minute.count++;
    this.requestCounts.hour.count++;
  }

  /**
   * Fetch messages from Slack API
   */
  private async fetchMessagesFromSlack(
    channelId: string,
    options: SlackMessageHistoryOptions
  ): Promise<SlackMessage[]> {
    const response = await this.client.conversations.history({
      channel: channelId,
      limit: Math.min(options.limit || this.rateLimitConfig.maxMessagesPerRequest, this.rateLimitConfig.maxMessagesPerRequest),
      oldest: options.oldest,
      latest: options.latest,
      inclusive: options.inclusive || false
    });

    if (!response.messages) {
      this.logDebug('No messages found in channel', { channelId });
      return [];
    }

    return this.convertSlackMessages(response.messages, channelId);
  }

  /**
   * Convert Slack API messages to our internal format
   */
  private convertSlackMessages(slackMessages: any[], channelId?: string): SlackMessage[] {
    return slackMessages.map(msg => ({
      id: msg.ts,
      channelId: channelId || msg.channel || 'unknown',
      userId: msg.user || 'unknown',
      text: msg.text || '',
      timestamp: new Date(parseFloat(msg.ts) * 1000),
      threadTs: msg.thread_ts,
      isThreadReply: !!msg.thread_ts,
      subtype: msg.subtype,
      botId: msg.bot_id,
      attachments: msg.attachments || [],
      files: msg.files || [],
      reactions: msg.reactions || [],
      edited: msg.edited ? {
        user: msg.edited.user,
        timestamp: new Date(parseFloat(msg.edited.ts) * 1000)
      } : undefined,
      metadata: {
        clientMsgId: msg.client_msg_id,
        type: msg.type,
        hasMore: msg.has_more || false
      }
    }));
  }

  /**
   * Apply message filtering based on privacy and content rules
   */
  private applyMessageFilter(messages: SlackMessage[], filter: SlackMessageFilter): SlackMessage[] {
    return messages.filter(msg => {
      // Filter out bot messages if requested
      if (filter.excludeBotMessages && msg.botId) {
        return false;
      }

      // Filter out system messages if requested
      if (filter.excludeSystemMessages && msg.subtype) {
        return false;
      }

      // Filter by user if specified
      if (filter.userIds && filter.userIds.length > 0) {
        if (!filter.userIds.includes(msg.userId)) {
          return false;
        }
      }

      // Filter by content keywords if specified
      if (filter.excludeKeywords && filter.excludeKeywords.length > 0) {
        const messageText = msg.text.toLowerCase();
        if (filter.excludeKeywords.some(keyword => messageText.includes(keyword.toLowerCase()))) {
          return false;
        }
      }

      // Filter by date range if specified
      if (filter.dateAfter && msg.timestamp < filter.dateAfter) {
        return false;
      }
      if (filter.dateBefore && msg.timestamp > filter.dateBefore) {
        return false;
      }

      // Filter sensitive content
      if (this.containsSensitiveContent(msg.text)) {
        if (filter.excludeSensitiveContent) {
          return false;
        }
        // Redact sensitive content instead of excluding
        msg.text = this.redactSensitiveContent(msg.text);
      }

      return true;
    });
  }

  /**
   * Check if message contains sensitive content
   */
  private containsSensitiveContent(text: string): boolean {
    const sensitivePatterns = [
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/, // IP addresses
      /\bpassword\s*[:=]\s*\S+/i, // Password fields
      /\btoken\s*[:=]\s*\S+/i, // Token fields
      /\bapi[_-]?key\s*[:=]\s*\S+/i // API keys
    ];

    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Redact sensitive content from message text
   */
  private redactSensitiveContent(text: string): string {
    return text
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED-CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED-EMAIL]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED-IP]')
      .replace(/\b(password|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1: [REDACTED]');
  }

  /**
   * Get default message filter
   */
  private getDefaultMessageFilter(): SlackMessageFilter {
    return {
      excludeBotMessages: true,
      excludeSystemMessages: true,
      excludeSensitiveContent: false, // Redact instead of exclude
      excludeKeywords: ['password', 'secret', 'private', 'confidential']
    };
  }

  /**
   * Generate cache key for message history
   */
  private generateCacheKey(channelId: string, options: SlackMessageHistoryOptions): string {
    const keyParts = [
      'slack-messages',
      channelId,
      options.limit || 'default',
      options.oldest || 'none',
      options.latest || 'none'
    ];
    return keyParts.join(':');
  }

  /**
   * Get cached messages
   */
  private async getCachedMessages(cacheKey: string): Promise<SlackMessage[] | null> {
    if (!this.cacheService) {
      return null;
    }

    try {
      const cached = await this.cacheService.get<SlackMessage[]>(cacheKey);
      if (cached) {
        this.logDebug('Messages retrieved from cache', { cacheKey });
        return cached;
      }
    } catch (error) {
      this.logWarn('Error retrieving cached messages', { cacheKey, error });
    }

    return null;
  }

  /**
   * Cache messages
   */
  private async cacheMessages(cacheKey: string, messages: SlackMessage[]): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    try {
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(messages),
        this.rateLimitConfig.cacheExpirationMinutes * 60
      );
      this.logDebug('Messages cached successfully', { 
        cacheKey, 
        messageCount: messages.length 
      });
    } catch (error) {
      this.logWarn('Error caching messages', { cacheKey, error });
    }
  }

  /**
   * Log audit trail for message reading operations
   */
  private async logAuditTrail(
    requestId: string,
    channelId: string,
    messageCount: number,
    startTime: number
  ): Promise<void> {
    if (!this.databaseService) {
      return;
    }

    try {
      const auditLog = {
        requestId,
        channelId,
        messageCount,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        service: this.name
      };

      // Log to database (implement based on your audit logging requirements)
      this.logDebug('Audit trail logged', auditLog);
    } catch (error) {
      this.logWarn('Error logging audit trail', { requestId, error });
    }
  }

  /**
   * Handle Slack API errors
   */
  private handleSlackError(error: any, operation: string): SlackMessageReaderError {
    let message = 'Unknown error occurred';
    let code = SlackMessageReaderErrorCode.UNKNOWN_ERROR;

    if (error instanceof Error) {
      message = error.message;
      
      if (message.includes('not_authed') || message.includes('invalid_auth')) {
        code = SlackMessageReaderErrorCode.AUTHENTICATION_FAILED;
      } else if (message.includes('channel_not_found')) {
        code = SlackMessageReaderErrorCode.NOT_FOUND;
      } else if (message.includes('rate_limited')) {
        code = SlackMessageReaderErrorCode.RATE_LIMIT_EXCEEDED;
      } else if (message.includes('permission')) {
        code = SlackMessageReaderErrorCode.PERMISSION_DENIED;
      } else if (message.includes('invalid_request')) {
        code = SlackMessageReaderErrorCode.INVALID_REQUEST;
      }
    }

    return new SlackMessageReaderError(message, code);
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy && !!this.client,
      details: {
        ...baseHealth.details,
        configured: !!this.botToken,
        hasClient: !!this.client,
        dependencies: {
          cacheService: !!this.cacheService,
          databaseService: !!this.databaseService
        },
        rateLimits: {
          minute: this.requestCounts.minute,
          hour: this.requestCounts.hour,
          config: this.rateLimitConfig
        }
      }
    };
  }
}
