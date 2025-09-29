/**
 * Slack Domain Service Interface
 * Focused interface for Slack-related operations
 */

import { IOAuthEnabledDomainService } from './base-domain.interface';

/**
 * Slack message parameters
 */
export interface SlackMessageParams {
  channel: string;
  text?: string;
  blocks?: any[];
  attachments?: any[];
  threadTs?: string;
  replyBroadcast?: boolean;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
  asUser?: boolean;
  username?: string;
  iconUrl?: string;
  iconEmoji?: string;
  linkNames?: boolean;
  parse?: 'full' | 'none';
}

/**
 * Slack message result
 */
export interface SlackMessageResult {
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
}

/**
 * Slack channel information
 */
export interface SlackChannel {
  id: string;
  name: string;
  isChannel: boolean;
  isGroup: boolean;
  isIm: boolean;
  isMpim: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  isGeneral: boolean;
  unlinked: boolean;
  nameNormalized: string;
  isShared: boolean;
  isExtShared: boolean;
  isOrgShared: boolean;
  pendingShared: string[];
  isPendingExtShared: boolean;
  isMember: boolean;
  isOpen: boolean;
  topic?: {
    value: string;
    creator: string;
    lastSet: number;
  };
  purpose?: {
    value: string;
    creator: string;
    lastSet: number;
  };
  numMembers?: number;
  locale?: string;
}

/**
 * Slack user information
 */
export interface SlackUser {
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
}

/**
 * Slack message search parameters
 */
export interface SlackMessageSearchParams {
  query: string;
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
  highlight?: boolean;
  count?: number;
  page?: number;
}

/**
 * Slack message search result
 */
export interface SlackMessageSearchResult {
  query: string;
  messages: {
    total: number;
    pagination: {
      totalCount: number;
      page: number;
      perPage: number;
      pageCount: number;
      first: number;
      last: number;
    };
    paging: {
      count: number;
      total: number;
      page: number;
      pages: number;
    };
    matches: Array<{
      type: 'message';
      ts: string;
      user?: string;
      username?: string;
      text?: string;
      channel: {
        id: string;
        name: string;
      };
      permalink: string;
    }>;
  };
}

/**
 * Slack file upload parameters
 */
export interface SlackFileUploadParams {
  channels?: string[];
  content?: string;
  file?: Buffer;
  filename?: string;
  filetype?: string;
  initialComment?: string;
  threadTs?: string;
  title?: string;
}

/**
 * Slack file information
 */
export interface SlackFile {
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
}

/**
 * Slack conversation history parameters
 */
export interface SlackConversationHistoryParams {
  channel: string;
  cursor?: string;
  inclusive?: boolean;
  latest?: string;
  limit?: number;
  oldest?: string;
}

/**
 * Slack Domain Service Interface
 * Handles all Slack-related operations with automatic OAuth management
 */
export interface ISlackDomainService extends IOAuthEnabledDomainService {
  // ===== Message Operations =====

  /**
   * Send a message to a Slack channel
   */
  sendMessage(userId: string, params: SlackMessageParams): Promise<SlackMessageResult>;

  /**
   * Update a message
   */
  updateMessage(params: {
    channel: string;
    ts: string;
    text?: string;
    blocks?: any[];
    attachments?: any[];
    asUser?: boolean;
  }): Promise<SlackMessageResult>;

  /**
   * Delete a message
   */
  deleteMessage(channel: string, ts: string, asUser?: boolean): Promise<{ ok: boolean; channel: string; ts: string }>;

  /**
   * Get permalink for a message
   */
  getPermalink(channel: string, messageTs: string): Promise<{ ok: boolean; permalink: string }>;

  /**
   * Add reaction to message
   */
  addReaction(params: {
    channel: string;
    name: string;
    timestamp: string;
  }): Promise<{ ok: boolean }>;

  /**
   * Remove reaction from message
   */
  removeReaction(params: {
    channel: string;
    name: string;
    timestamp: string;
  }): Promise<{ ok: boolean }>;

  // ===== Channel Operations =====

  /**
   * List conversations (channels, groups, DMs)
   */
  listConversations(params?: {
    cursor?: string;
    excludeArchived?: boolean;
    limit?: number;
    types?: string[];
  }): Promise<{
    ok: boolean;
    channels: SlackChannel[];
    responseMetadata?: { nextCursor: string };
  }>;

  /**
   * Get conversation info
   */
  getConversationInfo(channel: string): Promise<{
    ok: boolean;
    channel: SlackChannel;
  }>;

  /**
   * Get conversation history
   */
  getConversationHistory(params: SlackConversationHistoryParams): Promise<{
    ok: boolean;
    messages: any[];
    hasMore: boolean;
    pinCount?: number;
    responseMetadata?: { nextCursor: string };
  }>;

  /**
   * Get conversation members
   */
  getConversationMembers(params: {
    channel: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    ok: boolean;
    members: string[];
    responseMetadata?: { nextCursor: string };
  }>;

  /**
   * Join conversation
   */
  joinConversation(channel: string): Promise<{
    ok: boolean;
    channel: SlackChannel;
  }>;

  /**
   * Leave conversation
   */
  leaveConversation(channel: string): Promise<{ ok: boolean }>;

  /**
   * Create conversation
   */
  createConversation(params: {
    name: string;
    isPrivate?: boolean;
  }): Promise<{
    ok: boolean;
    channel: SlackChannel;
  }>;

  /**
   * Archive conversation
   */
  archiveConversation(channel: string): Promise<{ ok: boolean }>;

  /**
   * Unarchive conversation
   */
  unarchiveConversation(channel: string): Promise<{ ok: boolean }>;

  /**
   * Rename conversation
   */
  renameConversation(channel: string, name: string): Promise<{
    ok: boolean;
    channel: SlackChannel;
  }>;

  /**
   * Set conversation topic
   */
  setConversationTopic(channel: string, topic: string): Promise<{
    ok: boolean;
    topic: string;
  }>;

  /**
   * Set conversation purpose
   */
  setConversationPurpose(channel: string, purpose: string): Promise<{
    ok: boolean;
    purpose: string;
  }>;

  /**
   * Invite users to conversation
   */
  inviteToConversation(channel: string, users: string[]): Promise<{
    ok: boolean;
    channel: SlackChannel;
  }>;

  /**
   * Kick user from conversation
   */
  kickFromConversation(channel: string, user: string): Promise<{ ok: boolean }>;

  // ===== User Operations =====

  /**
   * List users
   */
  listUsers(params?: {
    cursor?: string;
    includeLocale?: boolean;
    limit?: number;
  }): Promise<{
    ok: boolean;
    members: SlackUser[];
    cacheTs: number;
    responseMetadata?: { nextCursor: string };
  }>;

  /**
   * Get user info
   */
  getUserInfo(user: string): Promise<{
    ok: boolean;
    user: SlackUser;
  }>;

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Promise<{
    ok: boolean;
    user: SlackUser;
  }>;

  /**
   * Get user presence
   */
  getUserPresence(user: string): Promise<{
    ok: boolean;
    presence: 'active' | 'away';
    online?: boolean;
    autoAway?: boolean;
    manualAway?: boolean;
    connectionCount?: number;
    lastActivity?: number;
  }>;

  /**
   * Set user presence
   */
  setPresence(presence: 'auto' | 'away'): Promise<{ ok: boolean }>;

  // ===== File Operations =====

  /**
   * Upload file
   */
  uploadFile(userId: string, params: SlackFileUploadParams): Promise<{
    ok: boolean;
    file: SlackFile;
  }>;

  /**
   * Get file info
   */
  getFileInfo(file: string, count?: number, page?: number): Promise<{
    ok: boolean;
    file: SlackFile;
    comments: any[];
    paging: any;
  }>;

  /**
   * Delete file
   */
  deleteFile(file: string): Promise<{ ok: boolean }>;

  /**
   * List files
   */
  listFiles(params?: {
    channel?: string;
    count?: number;
    page?: number;
    tsFrom?: number;
    tsTo?: number;
    types?: string;
    user?: string;
  }): Promise<{
    ok: boolean;
    files: SlackFile[];
    paging: any;
  }>;

  // ===== Search Operations =====

  /**
   * Search messages
   */
  searchMessages(params: SlackMessageSearchParams): Promise<SlackMessageSearchResult>;

  /**
   * Search files
   */
  searchFiles(params: SlackMessageSearchParams): Promise<{
    query: string;
    files: {
      total: number;
      pagination: any;
      paging: any;
      matches: SlackFile[];
    };
  }>;

  /**
   * Search everything
   */
  searchAll(params: SlackMessageSearchParams): Promise<{
    query: string;
    messages: SlackMessageSearchResult['messages'];
    files: any;
  }>;

  // ===== Team Operations =====

  /**
   * Get team info
   */
  getTeamInfo(): Promise<{
    ok: boolean;
    team: {
      id: string;
      name: string;
      domain: string;
      emailDomain: string;
      icon: any;
      enterpriseId?: string;
      enterpriseName?: string;
    };
  }>;

  /**
   * Test authentication
   */
  testAuth(): Promise<{
    ok: boolean;
    url: string;
    team: string;
    user: string;
    teamId: string;
    userId: string;
    botId?: string;
  }>;

  // ===== Utility Operations =====

  /**
   * Process Slack event (webhook handler)
   */
  processEvent(event: any, context: any): Promise<void>;

  /**
   * Format message for Slack
   */
  formatMessage(text: string, options?: {
    escapeHtml?: boolean;
    convertMarkdown?: boolean;
    mentionUsers?: boolean;
  }): string;

  /**
   * Parse Slack message
   */
  parseMessage(text: string): {
    text: string;
    mentions: string[];
    channels: string[];
    links: string[];
  };

  /**
   * Get bot info
   */
  getBotInfo(bot?: string): Promise<{
    ok: boolean;
    bot: {
      id: string;
      deleted: boolean;
      name: string;
      updated: number;
      appId: string;
      icons: any;
    };
  }>;

  /**
   * Send response via response_url (for slash commands)
   */
  sendToResponseUrl(responseUrl: string, payload: any): Promise<void>;
}