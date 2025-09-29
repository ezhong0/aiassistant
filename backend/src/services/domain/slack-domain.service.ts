import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { SlackAPIClient } from '../api/clients/slack-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError, APIClientErrorCode } from '../../errors/api-client.errors';
import { ValidationHelper, SlackValidationSchemas } from '../../validation/api-client.validation';
import { ISlackDomainService } from './interfaces/domain-service.interfaces';
import { SlackOAuthManager } from '../oauth/slack-oauth-manager';
import { serviceManager } from '../service-manager';
import { SlackContext } from '../../types/slack/slack.types';

/**
 * Slack Domain Service - High-level Slack operations using standardized API client
 * 
 * This service provides domain-specific Slack operations that wrap the Slack Web API.
 * It handles messaging, channel management, user operations, and file handling
 * with a clean interface that's easy to use from agents and other services.
 * 
 * Features:
 * - Send and manage messages
 * - Channel and conversation operations
 * - User and team information
 * - File uploads and management
 * - Bot token authentication
 */
export class SlackDomainService extends BaseService implements ISlackDomainService {
  private slackClient: SlackAPIClient | null = null;
  private slackOAuthManager: SlackOAuthManager | null = null;

  constructor() {
    super('SlackDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Slack Domain Service');
      
      // Get Slack API client
      this.slackClient = await getAPIClient<SlackAPIClient>('slack');
      
      // Get OAuth manager
      this.slackOAuthManager = serviceManager.getService<SlackOAuthManager>('slackOAuthManager') || null;
      
      this.logInfo('Slack Domain Service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Slack Domain Service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.slackClient = null;
      this.logInfo('Slack Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Slack Domain Service', error);
    }
  }

  /**
   * OAuth management methods
   */
  async initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw new Error('SlackOAuthManager not available');
    }
    
    const authUrl = await this.slackOAuthManager.generateAuthUrl(context);
    return { authUrl, state: 'generated' }; // TODO: Return actual state from OAuth manager
  }

  async completeOAuth(userId: string, code: string, state: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw new Error('SlackOAuthManager not available');
    }
    
    const result = await this.slackOAuthManager.exchangeCodeForTokens(code, state);
    if (!result.success) {
      throw new Error(result.error || 'OAuth completion failed');
    }
  }

  async refreshTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw new Error('SlackOAuthManager not available');
    }
    
    // Slack doesn't typically use refresh tokens, but we can implement token validation
    const isValid = await this.slackOAuthManager.validateTokens(userId);
    if (!isValid.isValid) {
      throw new Error('Token validation failed');
    }
  }

  async revokeTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw new Error('SlackOAuthManager not available');
    }
    
    const success = await this.slackOAuthManager.revokeTokens(userId);
    if (!success) {
      throw new Error('Token revocation failed');
    }
  }

  async requiresOAuth(userId: string): Promise<boolean> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      return true; // Assume OAuth required if manager not available
    }
    
    return await this.slackOAuthManager.requiresOAuth(userId);
  }

  /**
   * Legacy authentication method (to be removed)
   */
  async authenticate(botToken: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Slack client not available',
        { serviceName: 'SlackDomainService' }
      );
    }

    try {
      const credentials: AuthCredentials = {
        type: 'bearer',
        accessToken: botToken
      };

      await this.slackClient.authenticate(credentials);
      this.logInfo('Slack service authenticated successfully');
    } catch (error) {
      throw APIClientError.fromError(error, {
        serviceName: 'SlackDomainService',
        endpoint: 'authenticate'
      });
    }
  }

  /**
   * Send a message to a channel (with automatic authentication)
   */
  async sendMessage(userId: string, params: {
    channel: string;
    text?: string;
    blocks?: any[];
    attachments?: any[];
    threadTs?: string;
    replyBroadcast?: boolean;
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
  }): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
    message: {
      text: string;
      user: string;
      botId?: string;
      attachments?: any[];
      blocks?: any[];
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Slack client not available',
        { serviceName: 'SlackDomainService' }
      );
    }

    try {
      // Use bot token for sending messages (not user OAuth tokens)
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        throw new Error('Slack bot token not configured');
      }

      // Authenticate with bot token
      await this.authenticate(botToken);
      
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(SlackValidationSchemas.sendMessage, params);

      this.logInfo('Sending Slack message', {
        channel: validatedParams.channel,
        hasText: !!validatedParams.text,
        hasBlocks: !!(validatedParams.blocks?.length),
        threadTs: validatedParams.threadTs
      });

      const response = await this.slackClient.makeRequest({
        method: 'POST',
        endpoint: '/chat.postMessage',
        data: {
          channel: validatedParams.channel,
          text: validatedParams.text,
          blocks: validatedParams.blocks,
          attachments: validatedParams.attachments,
          thread_ts: validatedParams.threadTs,
          reply_broadcast: validatedParams.replyBroadcast,
          unfurl_links: validatedParams.unfurlLinks,
          unfurl_media: validatedParams.unfurlMedia
        }
      });

      const result = {
        ok: response.data.ok,
        channel: response.data.channel,
        ts: response.data.ts,
        message: response.data.message
      };

      this.logInfo('Slack message sent successfully', {
        channel: result.channel,
        ts: result.ts
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'SlackDomainService',
        endpoint: 'sendMessage',
        method: 'POST'
      });
    }
  }

  /**
   * Update a message
   */
  async updateMessage(params: {
    channel: string;
    ts: string;
    text?: string;
    blocks?: any[];
    attachments?: any[];
  }): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
    text: string;
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Updating Slack message', {
        channel: params.channel,
        ts: params.ts
      });

      const response = await this.slackClient.makeRequest({
        method: 'POST',
        endpoint: '/chat.update',
        data: {
          channel: params.channel,
          ts: params.ts,
          text: params.text,
          blocks: params.blocks,
          attachments: params.attachments
        }
      });

      const result = {
        ok: response.data.ok,
        channel: response.data.channel,
        ts: response.data.ts,
        text: response.data.text
      };

      this.logInfo('Slack message updated successfully', {
        channel: result.channel,
        ts: result.ts
      });

      return result;
    } catch (error) {
      this.logError('Failed to update Slack message', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(channel: string, ts: string): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Deleting Slack message', { channel, ts });

      const response = await this.slackClient.makeRequest({
        method: 'POST',
        endpoint: '/chat.delete',
        data: {
          channel,
          ts
        }
      });

      const result = {
        ok: response.data.ok,
        channel: response.data.channel,
        ts: response.data.ts
      };

      this.logInfo('Slack message deleted successfully', {
        channel: result.channel,
        ts: result.ts
      });

      return result;
    } catch (error) {
      this.logError('Failed to delete Slack message', error);
      throw error;
    }
  }

  /**
   * Get channel history
   */
  async getChannelHistory(params: {
    channel: string;
    limit?: number;
    oldest?: string;
    latest?: string;
    inclusive?: boolean;
    cursor?: string;
  }): Promise<{
    ok: boolean;
    messages: Array<{
      type: string;
      subtype?: string;
      text: string;
      user: string;
      ts: string;
      threadTs?: string;
      replyCount?: number;
      replies?: any[];
      attachments?: any[];
      blocks?: any[];
    }>;
    hasMore: boolean;
    pinCount: number;
    responseMetadata?: {
      nextCursor?: string;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Getting channel history', {
        channel: params.channel,
        limit: params.limit || 100
      });

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/conversations.history',
        query: {
          channel: params.channel,
          limit: params.limit || 100,
          oldest: params.oldest,
          latest: params.latest,
          inclusive: params.inclusive,
          cursor: params.cursor
        }
      });

      const result = {
        ok: response.data.ok,
        messages: response.data.messages || [],
        hasMore: !!response.data.has_more,
        pinCount: response.data.pin_count || 0,
        responseMetadata: response.data.response_metadata
      };

      this.logInfo('Channel history retrieved successfully', {
        channel: params.channel,
        messageCount: result.messages.length,
        hasMore: result.hasMore
      });

      return result;
    } catch (error) {
      this.logError('Failed to get channel history', error);
      throw error;
    }
  }

  /**
   * Get thread replies
   */
  async getThreadReplies(params: {
    channel: string;
    ts: string;
    limit?: number;
    oldest?: string;
    latest?: string;
    inclusive?: boolean;
    cursor?: string;
  }): Promise<{
    ok: boolean;
    messages: Array<{
      type: string;
      subtype?: string;
      text: string;
      user: string;
      ts: string;
      threadTs?: string;
      replyCount?: number;
      replies?: any[];
      attachments?: any[];
      blocks?: any[];
    }>;
    hasMore: boolean;
    responseMetadata?: {
      nextCursor?: string;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Getting thread replies', {
        channel: params.channel,
        ts: params.ts,
        limit: params.limit || 100
      });

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/conversations.replies',
        query: {
          channel: params.channel,
          ts: params.ts,
          limit: params.limit || 100,
          oldest: params.oldest,
          latest: params.latest,
          inclusive: params.inclusive,
          cursor: params.cursor
        }
      });

      const result = {
        ok: response.data.ok,
        messages: response.data.messages || [],
        hasMore: !!response.data.has_more,
        responseMetadata: response.data.response_metadata
      };

      this.logInfo('Thread replies retrieved successfully', {
        channel: params.channel,
        ts: params.ts,
        messageCount: result.messages.length,
        hasMore: result.hasMore
      });

      return result;
    } catch (error) {
      this.logError('Failed to get thread replies', error);
      throw error;
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<{
    ok: boolean;
    user: {
      id: string;
      name: string;
      realName: string;
      displayName?: string;
      email?: string;
      isBot: boolean;
      isAdmin: boolean;
      isOwner: boolean;
      profile: {
        title?: string;
        phone?: string;
        skype?: string;
        realName: string;
        realNameNormalized: string;
        displayName?: string;
        displayNameNormalized?: string;
        email?: string;
        image24?: string;
        image32?: string;
        image48?: string;
        image72?: string;
        image192?: string;
        image512?: string;
      };
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Getting user info', { userId });

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/users.info',
        query: { user: userId }
      });

      const result = {
        ok: response.data.ok,
        user: response.data.user
      };

      this.logInfo('User info retrieved successfully', {
        userId: result.user.id,
        name: result.user.name
      });

      return result;
    } catch (error) {
      this.logError('Failed to get user info', error);
      throw error;
    }
  }

  /**
   * List users
   */
  async listUsers(params: {
    limit?: number;
    cursor?: string;
    includeLocale?: boolean;
  }): Promise<{
    ok: boolean;
    members: Array<{
      id: string;
      name: string;
      realName: string;
      displayName?: string;
      email?: string;
      isBot: boolean;
      isAdmin: boolean;
      isOwner: boolean;
      profile: {
        title?: string;
        phone?: string;
        skype?: string;
        realName: string;
        realNameNormalized: string;
        displayName?: string;
        displayNameNormalized?: string;
        email?: string;
        image24?: string;
        image32?: string;
        image48?: string;
        image72?: string;
        image192?: string;
        image512?: string;
      };
    }>;
    cacheTs: number;
    responseMetadata?: {
      nextCursor?: string;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Listing users', {
        limit: params.limit || 1000
      });

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/users.list',
        query: {
          limit: params.limit || 1000,
          cursor: params.cursor,
          include_locale: params.includeLocale
        }
      });

      const result = {
        ok: response.data.ok,
        members: response.data.members || [],
        cacheTs: response.data.cache_ts,
        responseMetadata: response.data.response_metadata
      };

      this.logInfo('Users listed successfully', {
        memberCount: result.members.length
      });

      return result;
    } catch (error) {
      this.logError('Failed to list users', error);
      throw error;
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(params: {
    channels?: string;
    content?: string;
    file?: Buffer;
    filename?: string;
    title?: string;
    initialComment?: string;
    threadTs?: string;
  }): Promise<{
    ok: boolean;
    file: {
      id: string;
      name: string;
      title: string;
      mimetype: string;
      filetype: string;
      prettyType: string;
      user: string;
      size: number;
      urlPrivate: string;
      urlPrivateDownload: string;
      permalink: string;
      permalinkPublic: string;
      isExternal: boolean;
      isPublic: boolean;
      publicUrlShared: boolean;
      displayAsBot: boolean;
      username: string;
      created: number;
      updated: number;
      mode: string;
      editable: boolean;
      isStarred: boolean;
      hasRichPreview: boolean;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Uploading file', {
        filename: params.filename,
        hasContent: !!params.content,
        hasFile: !!params.file,
        channels: params.channels
      });

      const response = await this.slackClient.makeRequest({
        method: 'POST',
        endpoint: '/files.upload',
        data: {
          channels: params.channels,
          content: params.content,
          file: params.file,
          filename: params.filename,
          title: params.title,
          initial_comment: params.initialComment,
          thread_ts: params.threadTs
        }
      });

      const result = {
        ok: response.data.ok,
        file: response.data.file
      };

      this.logInfo('File uploaded successfully', {
        fileId: result.file.id,
        filename: result.file.name
      });

      return result;
    } catch (error) {
      this.logError('Failed to upload file', error);
      throw error;
    }
  }

  /**
   * Test authentication
   */
  async testAuth(): Promise<{
    ok: boolean;
    url: string;
    team: string;
    user: string;
    teamId: string;
    userId: string;
    botId?: string;
    isEnterpriseInstall: boolean;
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw new Error('Slack client not available');
    }

    try {
      this.logInfo('Testing Slack authentication');

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/auth.test'
      });

      const result = {
        ok: response.data.ok,
        url: response.data.url,
        team: response.data.team,
        user: response.data.user,
        teamId: response.data.team_id,
        userId: response.data.user_id,
        botId: response.data.bot_id,
        isEnterpriseInstall: response.data.is_enterprise_install
      };

      this.logInfo('Slack authentication test successful', {
        team: result.team,
        user: result.user
      });

      return result;
    } catch (error) {
      this.logError('Failed to test Slack authentication', error);
      throw error;
    }
  }

  /**
   * Process Slack events with deduplication and validation
   */
  async processEvent(event: any, context: any): Promise<any> {
    this.assertReady();
    
    try {
      this.logInfo('Processing Slack event', {
        eventType: event.type,
        userId: context.userId,
        channelId: context.channelId,
        teamId: context.teamId
      });

      // Handle different event types
      switch (event.type) {
        case 'message':
          return await this.handleMessageEvent(event, context);
        case 'app_mention':
          return await this.handleAppMentionEvent(event, context);
        default:
          this.logInfo('Unhandled event type', { eventType: event.type });
          return { success: true, message: 'Event type not handled' };
      }
    } catch (error) {
      this.logError('Failed to process Slack event', error, {
        eventType: event.type,
        userId: context.userId
      });
      return {
        success: false,
        message: 'Failed to process event',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle message events
   */
  private async handleMessageEvent(event: any, context: any): Promise<any> {
    try {
      // Enhanced debugging for bot message detection
      this.logInfo('Received message event - debugging', {
        eventBotId: event.bot_id,
        eventSubtype: event.subtype,
        eventUserId: event.user,
        contextUserId: context.userId,
        messageText: (event.text || '').substring(0, 100),
        fullEvent: JSON.stringify(event).substring(0, 500)
      });

      // Ignore bot messages to prevent infinite loops
      // Check multiple conditions for bot detection
      const isBotMessage = event.bot_id ||
                          event.subtype === 'bot_message' ||
                          event.user === 'U09C27B5W1Z' || // Bot user ID
                          (event.text && event.text.includes('🤔 Processing your request')) ||
                          (event.text && event.text.includes('I received your message and I\'m working on it!'));

      if (isBotMessage) {
        this.logInfo('🛑 IGNORING BOT MESSAGE to prevent infinite loop', {
          reason: {
            hasBotId: !!event.bot_id,
            isBotSubtype: event.subtype === 'bot_message',
            isBotUser: event.user === 'U09C27B5W1Z',
            hasProcessingText: event.text && event.text.includes('🤔 Processing your request'),
            hasWorkingText: event.text && event.text.includes('I received your message and I\'m working on it!')
          },
          eventBotId: event.bot_id,
          eventSubtype: event.subtype,
          eventUser: event.user,
          channelId: context.channelId
        });
        return {
          success: true,
          message: 'Bot message ignored'
        };
      }

      const messageText = event.text || '';

      this.logInfo('✅ PROCESSING USER MESSAGE', {
        messageText: messageText.substring(0, 100),
        userId: context.userId,
        channelId: context.channelId
      });

      // Construct the combined userId format expected by SlackOAuthManager
      const combinedUserId = `${context.teamId}:${context.userId}`;

      // Send acknowledgment
      await this.sendMessage(combinedUserId, {
        channel: context.channelId,
        text: "🤔 Processing your request...",
        threadTs: event.thread_ts
      });

      // Process the message with MasterAgent (orchestrator only)
      try {
        const { MasterAgent } = await import('../../agents/master.agent');
        const masterAgent = new MasterAgent();

        const slackContext = {
          userId: context.userId,
          channelId: context.channelId,
          teamId: context.teamId,
          isDirectMessage: true
        };

        this.logInfo('Starting MasterAgent orchestration', {
          messageText: messageText.substring(0, 100),
          userId: context.userId
        });

        this.logInfo('🔧 DEBUG: About to call masterAgent.processUserInput', {
          messageText: messageText.substring(0, 50),
          sessionId: context.channelId,
          userId: combinedUserId,
          hasSlackContext: !!slackContext
        });

        // MasterAgent orchestrates subagents - doesn't do direct processing
        const result = await masterAgent.processUserInput(
          messageText,
          context.channelId, // Use channel as session ID
          combinedUserId,
          slackContext
        );

        this.logInfo('🔧 DEBUG: masterAgent.processUserInput returned', {
          success: result.success,
          messageLength: result.message.length,
          hasMetadata: !!result.metadata
        });

        // Send the orchestrated response
        await this.sendMessage(combinedUserId, {
          channel: context.channelId,
          text: result.message,
          threadTs: event.thread_ts
        });

        this.logInfo('MasterAgent orchestration completed', {
          success: result.success,
          userId: context.userId,
          processingTime: result.metadata?.processingTime
        });

        return {
          success: true,
          message: 'Message processed via MasterAgent orchestration'
        };
      } catch (processingError) {
        this.logError('MasterAgent orchestration failed', processingError);

        // Send error response to user
        await this.sendMessage(combinedUserId, {
          channel: context.channelId,
          text: "Sorry, I encountered an error processing your request. Please try again.",
          threadTs: event.thread_ts
        });

        return {
          success: false,
          message: 'MasterAgent orchestration failed'
        };
      }
    } catch (error) {
      this.logError('Failed to handle message event', error);
      throw error;
    }
  }

  /**
   * Handle app mention events
   */
  private async handleAppMentionEvent(event: any, context: any): Promise<any> {
    // Similar to message handling but for mentions
    return await this.handleMessageEvent(event, context);
  }

  /**
   * Send response via response_url (for slash commands)
   */
  async sendToResponseUrl(responseUrl: string, payload: any): Promise<void> {
    this.assertReady();
    
    try {
      this.logInfo('Sending response via response_url', {
        responseUrl: responseUrl.substring(0, 100) + '...',
        hasPayload: !!payload
      });

      const response = await fetch(responseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Response URL request failed: ${response.statusText}`);
      }

      this.logInfo('Sent response via response_url successfully', {
        statusCode: response.status
      });
    } catch (error) {
      this.logError('Failed to send to response_url', error, {
        responseUrl: responseUrl.substring(0, 100) + '...'
      });
      throw error;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.slackClient;
      const details = {
        initialized: this.initialized,
        hasSlackClient: !!this.slackClient,
        authenticated: this.slackClient?.isAuthenticated() || false
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
