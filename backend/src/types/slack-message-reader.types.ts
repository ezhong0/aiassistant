/**
 * Slack Message Reader Types
 * Defines interfaces and types for the SlackMessageReaderService
 */

/**
 * Slack message in our internal format
 */
export interface SlackMessage {
  id: string; // Message timestamp (ts)
  channelId: string;
  userId: string;
  text: string;
  timestamp: Date;
  threadTs?: string;
  isThreadReply: boolean;
  subtype?: string;
  botId?: string;
  attachments: SlackAttachment[];
  files: SlackFile[];
  reactions: SlackReaction[];
  edited?: {
    user: string;
    timestamp: Date;
  };
  metadata: {
    clientMsgId?: string;
    type: string;
    hasMore?: boolean;
  };
}

/**
 * Slack attachment
 */
export interface SlackAttachment {
  id: string;
  fallback: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/**
 * Slack file
 */
export interface SlackFile {
  id: string;
  name: string;
  title?: string;
  mimetype: string;
  filetype: string;
  pretty_type: string;
  user: string;
  size: number;
  url_private: string;
  url_private_download: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_160?: string;
  thumb_720?: string;
  thumb_720_w?: number;
  thumb_720_h?: number;
  thumb_800?: string;
  thumb_800_w?: number;
  thumb_800_h?: number;
  thumb_960?: string;
  thumb_960_w?: number;
  thumb_960_h?: number;
  thumb_1024?: string;
  thumb_1024_w?: number;
  thumb_1024_h?: number;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  permalink: string;
  permalink_public?: string;
  is_external?: boolean;
  external_type?: string;
  is_public?: boolean;
  public_url_shared?: boolean;
  display_as_bot?: boolean;
  username?: string;
  timestamp: number;
}

/**
 * Slack reaction
 */
export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

/**
 * Options for reading message history
 */
export interface SlackMessageHistoryOptions {
  limit?: number;
  oldest?: string; // Timestamp
  latest?: string; // Timestamp
  inclusive?: boolean;
  includeAllMetadata?: boolean;
  filter?: SlackMessageFilter;
}

/**
 * Message filtering options
 */
export interface SlackMessageFilter {
  excludeBotMessages?: boolean;
  excludeSystemMessages?: boolean;
  excludeSensitiveContent?: boolean;
  excludeKeywords?: string[];
  userIds?: string[]; // Only include messages from these users
  dateAfter?: Date;
  dateBefore?: Date;
}

/**
 * Channel information
 */
export interface SlackChannelInfo {
  id: string;
  name: string;
  type: 'im' | 'private' | 'public';
  isPrivate: boolean;
  memberCount?: number;
  topic?: string;
  purpose?: string;
}

/**
 * Search options
 */
export interface SlackMessageSearchOptions {
  channels?: string[];
  limit?: number;
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
}

/**
 * Error types for SlackMessageReaderService
 */
export class SlackMessageReaderError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'SlackMessageReaderError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SlackMessageReaderError);
    }
  }
}

/**
 * Error codes for SlackMessageReaderService
 */
export enum SlackMessageReaderErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  SEARCH_FAILED = 'SEARCH_FAILED',
  CACHE_ERROR = 'CACHE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Rate limiting configuration
 */
export interface SlackRateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxMessagesPerRequest: number;
  cacheExpirationMinutes: number;
}

/**
 * Audit log entry for message reading operations
 */
export interface SlackMessageAuditLog {
  requestId: string;
  channelId: string;
  messageCount: number;
  processingTimeMs: number;
  timestamp: Date;
  service: string;
  userId?: string;
  operation: string;
  success: boolean;
  error?: string;
}

/**
 * Cache entry for message history
 */
export interface SlackMessageCacheEntry {
  key: string;
  messages: SlackMessage[];
  timestamp: Date;
  expiresAt: Date;
  channelId: string;
  options: SlackMessageHistoryOptions;
}

/**
 * Service health status
 */
export interface SlackMessageReaderHealth {
  healthy: boolean;
  details: {
    state: string;
    initialized: boolean;
    destroyed: boolean;
    configured: boolean;
    hasClient: boolean;
    dependencies: {
      cacheService: boolean;
      databaseService: boolean;
    };
    rateLimits: {
      minute: {
        count: number;
        resetTime: number;
      };
      hour: {
        count: number;
        resetTime: number;
      };
      config: SlackRateLimitConfig;
    };
    timestamp: string;
  };
}

/**
 * Type guards
 */
export const isSlackMessage = (obj: any): obj is SlackMessage => {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.channelId === 'string' && 
    typeof obj.userId === 'string' &&
    typeof obj.text === 'string' &&
    obj.timestamp instanceof Date;
};

export const isSlackMessageReaderError = (error: any): error is SlackMessageReaderError => {
  return error instanceof SlackMessageReaderError;
};

export const isSlackChannelInfo = (obj: any): obj is SlackChannelInfo => {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' && 
    typeof obj.type === 'string';
};

/**
 * Utility types
 */
export type SlackMessageType = 'message' | 'bot_message' | 'system_message';
export type SlackChannelType = 'im' | 'private' | 'public';
export type SlackMessageSubtype = 'bot_message' | 'me_message' | 'thread_broadcast' | 'file_share' | 'file_comment' | 'file_mention';

/**
 * Message statistics
 */
export interface SlackMessageStats {
  totalMessages: number;
  messagesByUser: Record<string, number>;
  messagesByChannel: Record<string, number>;
  messagesByDay: Record<string, number>;
  averageMessagesPerDay: number;
  mostActiveUser: string;
  mostActiveChannel: string;
  lastMessageDate?: Date;
  firstMessageDate?: Date;
}

/**
 * Message analysis result
 */
export interface SlackMessageAnalysis {
  messageCount: number;
  uniqueUsers: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  activityPattern: {
    hourly: Record<number, number>;
    daily: Record<string, number>;
  };
}
