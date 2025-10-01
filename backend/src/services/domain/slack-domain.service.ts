import { ErrorFactory, ERROR_CATEGORIES } from '../../errors';
import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { SlackAPIClient } from '../api/clients/slack-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError } from '../../errors';
import { ValidationHelper, SlackValidationSchemas } from '../../validation/api-client.validation';
import { ISlackDomainService } from './interfaces/slack-domain.interface';
import { SlackOAuthManager } from '../oauth/slack-oauth-manager';
import { SlackContext } from '../../types/slack/slack.types';
import { GenericAIService } from '../generic-ai.service';
import { ContextManager } from '../context-manager.service';
import { TokenManager } from '../token-manager';

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
export class SlackDomainService extends BaseService implements Partial<ISlackDomainService> {
  private slackClient: SlackAPIClient | null = null;
  private botUserId: string | null = null;

  constructor(
    private readonly slackOAuthManager: SlackOAuthManager,
    private readonly aiService: GenericAIService,
    private readonly contextManager: ContextManager,
    private readonly tokenManager: TokenManager,
    private readonly masterAgent: import('../../agents/master.agent').MasterAgent
  ) {
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
      
      // Get bot user ID dynamically
      await this.initializeBotUserId();
      
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
      this.botUserId = null;
      this.logInfo('Slack Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Slack Domain Service', error);
    }
  }

  /**
   * Initialize bot user ID by calling auth.test
   */
  private async initializeBotUserId(): Promise<void> {
    try {
      if (!this.slackClient) {
        throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
      }

      // Use bot token for authentication
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        throw ErrorFactory.domain.serviceError('SlackDomainService', 'Slack bot token not configured. Please set SLACK_BOT_TOKEN environment variable.');
      }

      const credentials = {
        type: 'api_key' as const,
        apiKey: botToken
      };
      await this.slackClient.authenticate(credentials);

      // Call auth.test directly without using testAuth() to avoid circular dependency
      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/auth.test'
      });

      this.botUserId = response.data.user_id;
      
      this.logInfo('Bot user ID initialized', {
        botUserId: this.botUserId,
        botId: response.data.bot_id
      });
    } catch (error) {
      this.logError('Failed to initialize bot user ID', error);
      // Don't throw - continue without bot user ID filtering
      this.botUserId = null;
    }
  }

  /**
   * OAuth management methods
   */
  async initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw ErrorFactory.domain.serviceUnavailable('SlackOAuthManager', {
        service: 'SlackDomainService',
        operation: 'oauth-operation'
      });
    }
    
    const authUrl = await this.slackOAuthManager.generateAuthUrl(context);
    return { authUrl, state: 'generated' };
  }

  async completeOAuth(userId: string, code: string, state: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw ErrorFactory.domain.serviceUnavailable('SlackOAuthManager', {
        service: 'SlackDomainService',
        operation: 'oauth-operation'
      });
    }
    
    const result = await this.slackOAuthManager.exchangeCodeForTokens(code, state);
    if (!result.success) {
      throw ErrorFactory.domain.serviceError('SlackOAuthManager', result.error || 'OAuth completion failed');
    }
  }

  async refreshTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw ErrorFactory.domain.serviceUnavailable('SlackOAuthManager', {
        service: 'SlackDomainService',
        operation: 'oauth-operation'
      });
    }
    
    // Slack doesn't typically use refresh tokens, but we can implement token validation
    const isValid = await this.slackOAuthManager.validateTokens(userId);
    if (!isValid.isValid) {
      throw ErrorFactory.api.unauthorized('Slack token validation failed. Re-authentication required.');
    }
  }

  async revokeTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.slackOAuthManager) {
      throw ErrorFactory.domain.serviceUnavailable('SlackOAuthManager', {
        service: 'SlackDomainService',
        operation: 'oauth-operation'
      });
    }
    
    const success = await this.slackOAuthManager.revokeTokens(userId);
    if (!success) {
      throw ErrorFactory.domain.serviceError('SlackOAuthManager', 'Token revocation failed');
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
      type: string;
      user?: string;
      text?: string;
      ts: string;
      blocks?: any[];
      attachments?: any[];
    };
  }> {
    this.assertReady();

    if (!this.slackClient) {
      throw ErrorFactory.domain.serviceError('SlackDomainService', 'Slack client not available');
    }

    try {
      // Use bot token for sending messages (not user OAuth tokens)
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        throw ErrorFactory.domain.serviceError('SlackDomainService', 'Slack bot token not configured. Please set SLACK_BOT_TOKEN environment variable.');
      }

      // Authenticate with bot token
      const credentials = {
        type: 'api_key' as const,
        apiKey: botToken
      };
      await this.slackClient.authenticate(credentials);
      
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
        message: {
          type: response.data.message?.type || 'message',
          user: response.data.message?.user,
          text: response.data.message?.text,
          ts: response.data.ts,
          blocks: response.data.message?.blocks,
          attachments: response.data.message?.attachments
        }
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
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'SlackDomainService',
        metadata: { endpoint: 'sendMessage', method: 'POST' }
      });
    }
  }

  /**
   * Send an ephemeral message (visible only to specific user)
   */
  async sendEphemeralMessage(userId: string, params: {
    channel: string;
    user: string;
    text?: string;
    blocks?: any[];
    attachments?: any[];
    threadTs?: string;
  }): Promise<{
    ok: boolean;
    messageTs: string;
  }> {
    this.assertReady();

    if (!this.slackClient) {
      throw ErrorFactory.domain.serviceError('SlackDomainService', 'Slack client not available');
    }

    try {
      // Use bot token for sending ephemeral messages
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        throw ErrorFactory.domain.serviceError('SlackDomainService', 'Slack bot token not configured. Please set SLACK_BOT_TOKEN environment variable.');
      }

      // Authenticate with bot token
      const credentials = {
        type: 'api_key' as const,
        apiKey: botToken
      };
      await this.slackClient.authenticate(credentials);

      this.logInfo('Sending ephemeral Slack message', {
        channel: params.channel,
        user: params.user,
        hasText: !!params.text,
        hasBlocks: !!(params.blocks?.length),
        hasAttachments: !!(params.attachments?.length)
      });

      const response = await this.slackClient.makeRequest({
        endpoint: 'chat.postEphemeral',
        method: 'POST',
        data: params
      });

      this.logInfo('Ephemeral Slack message sent successfully', {
        channel: params.channel,
        user: params.user,
        messageTs: response.data?.message_ts
      });

      return {
        ok: response.data?.ok || false,
        messageTs: response.data?.message_ts || ''
      };
    } catch (error) {
      this.logError('Failed to send ephemeral Slack message', error, {
        channel: params.channel,
        user: params.user,
        endpoint: 'sendEphemeralMessage',
        method: 'POST'
      });
      throw error;
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
    asUser?: boolean;
  }): Promise<{
    ok: boolean;
    channel: string;
    ts: string;
    message: {
      type: string;
      user?: string;
      text?: string;
      ts: string;
      blocks?: any[];
      attachments?: any[];
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
    }

    try {
      // Use bot token for updating messages (same as sendMessage)
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        throw ErrorFactory.domain.serviceError('SlackDomainService', 'Slack bot token not configured. Please set SLACK_BOT_TOKEN environment variable.');
      }

      // Authenticate with bot token
      const credentials = {
        type: 'api_key' as const,
        apiKey: botToken
      };
      await this.slackClient.authenticate(credentials);

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
        message: {
          type: response.data.message?.type || 'message',
          user: response.data.message?.user,
          text: response.data.text,
          ts: response.data.ts,
          blocks: response.data.message?.blocks,
          attachments: response.data.message?.attachments
        }
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
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
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
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
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
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
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
  async getUserInfo(user: string): Promise<{
    ok: boolean;
    user: {
      id: string;
      teamId: string;
      name: string;
      deleted: boolean;
      color: string;
      realName?: string;
      tz?: string;
      tzLabel?: string;
      tzOffset?: number;
      profile: {
        title?: string;
        phone?: string;
        skype?: string;
        realName?: string;
        realNameNormalized?: string;
        displayName?: string;
        displayNameNormalized?: string;
        fields?: any;
        statusText?: string;
        statusEmoji?: string;
        statusExpiration?: number;
        avatarHash?: string;
        email?: string;
        image24?: string;
        image32?: string;
        image48?: string;
        image72?: string;
        image192?: string;
        image512?: string;
        statusTextCanonical?: string;
        team?: string;
      };
      isAdmin?: boolean;
      isOwner?: boolean;
      isPrimaryOwner?: boolean;
      isRestricted?: boolean;
      isUltraRestricted?: boolean;
      isBot?: boolean;
      isAppUser?: boolean;
      updated?: number;
      isEmailConfirmed?: boolean;
      whoCanShareContactCard?: string;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
    }

    try {
      this.logInfo('Getting user info', { user });

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/users.info',
        query: { user }
      });

      const result = {
        ok: response.data.ok,
        user: {
          id: response.data.user.id,
          teamId: response.data.user.team_id || '',
          name: response.data.user.name,
          deleted: response.data.user.deleted || false,
          color: response.data.user.color || '',
          realName: response.data.user.real_name,
          tz: response.data.user.tz,
          tzLabel: response.data.user.tz_label,
          tzOffset: response.data.user.tz_offset,
          profile: response.data.user.profile,
          isAdmin: response.data.user.is_admin,
          isOwner: response.data.user.is_owner,
          isPrimaryOwner: response.data.user.is_primary_owner,
          isRestricted: response.data.user.is_restricted,
          isUltraRestricted: response.data.user.is_ultra_restricted,
          isBot: response.data.user.is_bot,
          isAppUser: response.data.user.is_app_user,
          updated: response.data.user.updated,
          isEmailConfirmed: response.data.user.is_email_confirmed,
          whoCanShareContactCard: response.data.user.who_can_share_contact_card
        }
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
  async listUsers(params?: {
    cursor?: string;
    includeLocale?: boolean;
    limit?: number;
  }): Promise<{
    ok: boolean;
    members: Array<{
      id: string;
      teamId: string;
      name: string;
      deleted: boolean;
      color: string;
      realName?: string;
      tz?: string;
      tzLabel?: string;
      tzOffset?: number;
      profile: {
        title?: string;
        phone?: string;
        skype?: string;
        realName?: string;
        realNameNormalized?: string;
        displayName?: string;
        displayNameNormalized?: string;
        fields?: any;
        statusText?: string;
        statusEmoji?: string;
        statusExpiration?: number;
        avatarHash?: string;
        email?: string;
        image24?: string;
        image32?: string;
        image48?: string;
        image72?: string;
        image192?: string;
        image512?: string;
        statusTextCanonical?: string;
        team?: string;
      };
      isAdmin?: boolean;
      isOwner?: boolean;
      isPrimaryOwner?: boolean;
      isRestricted?: boolean;
      isUltraRestricted?: boolean;
      isBot?: boolean;
      isAppUser?: boolean;
      updated?: number;
      isEmailConfirmed?: boolean;
      whoCanShareContactCard?: string;
    }>;
    cacheTs: number;
    responseMetadata?: {
      nextCursor: string;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
    }

    try {
      this.logInfo('Listing users', {
        limit: params?.limit || 1000
      });

      const response = await this.slackClient.makeRequest({
        method: 'GET',
        endpoint: '/users.list',
        query: {
          limit: params?.limit || 1000,
          cursor: params?.cursor,
          include_locale: params?.includeLocale
        }
      });

      const result = {
        ok: response.data.ok,
        members: (response.data.members || []).map((member: any) => ({
          id: member.id,
          teamId: member.team_id || '',
          name: member.name,
          deleted: member.deleted || false,
          color: member.color || '',
          realName: member.real_name,
          tz: member.tz,
          tzLabel: member.tz_label,
          tzOffset: member.tz_offset,
          profile: member.profile,
          isAdmin: member.is_admin,
          isOwner: member.is_owner,
          isPrimaryOwner: member.is_primary_owner,
          isRestricted: member.is_restricted,
          isUltraRestricted: member.is_ultra_restricted,
          isBot: member.is_bot,
          isAppUser: member.is_app_user,
          updated: member.updated,
          isEmailConfirmed: member.is_email_confirmed,
          whoCanShareContactCard: member.who_can_share_contact_card
        })),
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
  async uploadFile(userId: string, params: {
    channels?: string[];
    content?: string;
    file?: Buffer;
    filename?: string;
    filetype?: string;
    initialComment?: string;
    threadTs?: string;
    title?: string;
  }): Promise<{
    ok: boolean;
    file: {
      id: string;
      created: number;
      timestamp: number;
      name: string;
      title: string;
      mimetype: string;
      filetype: string;
      prettyType: string;
      user: string;
      userTeam: string;
      editable: boolean;
      size: number;
      mode: string;
      isExternal: boolean;
      externalType: string;
      isPublic: boolean;
      publicUrlShared: boolean;
      displayAsBot: boolean;
      username: string;
      urlPrivate: string;
      urlPrivateDownload: string;
      permalink: string;
      permalinkPublic: string;
      commentsCount: number;
      isStarred: boolean;
      shares: any;
      channels: string[];
      groups: string[];
      ims: string[];
      hasRichPreview: boolean;
    };
  }> {
    this.assertReady();
    
    if (!this.slackClient) {
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
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
          channels: params.channels?.join(','),
          content: params.content,
          file: params.file,
          filename: params.filename,
          filetype: params.filetype,
          title: params.title,
          initial_comment: params.initialComment,
          thread_ts: params.threadTs
        }
      });

      const result = {
        ok: response.data.ok,
        file: {
          id: response.data.file.id,
          created: response.data.file.created,
          timestamp: response.data.file.timestamp,
          name: response.data.file.name,
          title: response.data.file.title,
          mimetype: response.data.file.mimetype,
          filetype: response.data.file.filetype,
          prettyType: response.data.file.pretty_type,
          user: response.data.file.user,
          userTeam: response.data.file.user_team || '',
          editable: response.data.file.editable,
          size: response.data.file.size,
          mode: response.data.file.mode,
          isExternal: response.data.file.is_external,
          externalType: response.data.file.external_type || '',
          isPublic: response.data.file.is_public,
          publicUrlShared: response.data.file.public_url_shared,
          displayAsBot: response.data.file.display_as_bot,
          username: response.data.file.username,
          urlPrivate: response.data.file.url_private,
          urlPrivateDownload: response.data.file.url_private_download,
          permalink: response.data.file.permalink,
          permalinkPublic: response.data.file.permalink_public,
          commentsCount: response.data.file.comments_count || 0,
          isStarred: response.data.file.is_starred || false,
          shares: response.data.file.shares || {},
          channels: response.data.file.channels || [],
          groups: response.data.file.groups || [],
          ims: response.data.file.ims || [],
          hasRichPreview: response.data.file.has_rich_preview || false
        }
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
      throw ErrorFactory.domain.serviceUnavailable('slack-api-client', {
        service: 'SlackDomainService',
        operation: 'slack-operation'
      });
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
      // Log message event for monitoring
      this.logInfo('Processing message event', {
        eventUser: event.user,
        eventSubtype: event.subtype,
        messageText: (event.text || '').substring(0, 50)
      });

      // Ignore bot messages and message updates to prevent infinite loops
      if (event.bot_id || 
          event.subtype === 'message_changed' || 
          event.subtype === 'message_deleted' ||
          (this.botUserId && event.user === this.botUserId)) {
        return {
          success: true,
          message: 'Bot message ignored'
        };
      }

      const messageText = event.text || '';

      // Construct the combined userId format expected by SlackOAuthManager
      const combinedUserId = `${context.teamId}:${context.userId}`;

      // Send initial progress message and store timestamp for updates
      const progressMessage = await this.sendMessage(combinedUserId, {
        channel: context.channelId,
        text: "🤔 Processing your request...",
        threadTs: event.thread_ts
      });

      const progressMessageTs = progressMessage.ts;

      // Process the message with MasterAgent (orchestrator only)
      try {
        // Create progress updater function
        const updateProgress = async (step: string) => {
          try {
            await this.updateMessage({
              channel: context.channelId,
              ts: progressMessageTs,
              text: `⏳ ${step}`
            });
          } catch (error) {
            this.logWarn('Failed to update progress message', { step, error: error instanceof Error ? error.message : String(error) });
          }
        };

        const slackContext = {
          userId: context.userId,
          channelId: context.channelId,
          teamId: context.teamId,
          isDirectMessage: true,
          updateProgress // Add progress updater
        };

        this.logInfo('Starting MasterAgent orchestration', {
          messageText: messageText.substring(0, 100),
          userId: context.userId
        });

        // Use injected MasterAgent from DI container
        // MasterAgent orchestrates subagents - doesn't do direct processing
        const result = await this.masterAgent.processUserInput(
          messageText,
          context.channelId, // Use channel as session ID
          combinedUserId,
          slackContext
        );


        // Update the progress message with the final response
        await this.updateMessage({
          channel: context.channelId,
          ts: progressMessageTs,
          text: result.message
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
        this.logError('MasterAgent orchestration failed', processingError, {
          messageText: messageText.substring(0, 50),
          userId: context.userId
        });

        // Update progress message with error response
        await this.updateMessage({
          channel: context.channelId,
          ts: progressMessageTs,
          text: "I encountered an error while processing your request. Please try again."
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
        throw ErrorFactory.domain.serviceError('SlackDomainService', `Response URL request failed: ${response.statusText}`, {
          statusCode: response.status,
          operation: 'sendToResponseUrl'
        });
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
