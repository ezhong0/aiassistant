/**
 * Gmail Message Types
 */

export interface GmailMessage {
  id: string;
  threadId: string;
  messageId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  body: string;
  snippet: string;
  labelIds: string[];
  attachments: EmailAttachment[];
  isUnread: boolean;
  historyId: string;
  internalDate: string;
  sizeEstimate: number;
}

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
  snippet?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // Base64 encoded data when downloading
}

/**
 * Request Types
 */

export interface SendEmailRequest {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface ReplyEmailRequest {
  messageId: string;
  threadId: string;
  to?: string;
  cc?: string | string[];
  body: string;
  attachments?: EmailAttachment[];
}

export interface SearchEmailsRequest {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

/**
 * Response Types
 */

export interface SendEmailResponse {
  success: boolean;
  message?: GmailMessage;
  error?: string;
}

export interface GetEmailsResponse {
  success: boolean;
  messages?: GmailMessage[];
  nextPageToken?: string;
  error?: string;
}

export interface GetThreadResponse {
  success: boolean;
  thread?: GmailThread;
  error?: string;
}

/**
 * Parsed Email Types for easier processing
 */

export interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: {
    email: string;
    name?: string;
  };
  to: Array<{
    email: string;
    name?: string;
  }>;
  cc?: Array<{
    email: string;
    name?: string;
  }>;
  date: Date;
  body: {
    text?: string;
    html?: string;
  };
  attachments: EmailAttachment[];
  isUnread: boolean;
  labels: string[];
  importance?: 'high' | 'normal' | 'low';
}

export interface EmailContact {
  email: string;
  name?: string;
}

/**
 * Gmail Labels and Filters
 */

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility: 'show' | 'hide';
  labelListVisibility: 'labelShow' | 'labelHide';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailFilter {
  id?: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
    negatedQuery?: string;
    hasAttachment?: boolean;
    excludeChats?: boolean;
    size?: number;
    sizeComparison?: 'larger' | 'smaller';
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    forward?: string;
    markAsRead?: boolean;
    markAsImportant?: boolean;
    markAsSpam?: boolean;
    delete?: boolean;
  };
}

/**
 * Gmail API Options
 */

export interface GmailApiOptions {
  format?: 'minimal' | 'full' | 'raw' | 'metadata';
  includeSpamTrash?: boolean;
  maxResults?: number;
  pageToken?: string;
  q?: string; // Search query
}

/**
 * Email Templates
 */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[]; // Variables that can be replaced in the template
  category?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateVariable {
  name: string;
  value: string;
  description?: string;
}

/**
 * Draft Management
 */

export interface EmailDraft {
  id?: string;
  message: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    body: string;
    attachments?: EmailAttachment[];
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Email Analytics
 */

export interface EmailAnalytics {
  totalSent: number;
  totalReceived: number;
  totalUnread: number;
  responseRate: number;
  averageResponseTime: number; // in hours
  topSenders: Array<{
    email: string;
    name?: string;
    count: number;
  }>;
  topRecipients: Array<{
    email: string;
    name?: string;
    count: number;
  }>;
  emailsByDay: Array<{
    date: string;
    sent: number;
    received: number;
  }>;
}

/**
 * Error Types
 */

export class GmailServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'GmailServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GmailServiceError);
    }
  }
}

export enum GmailErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  SEND_FAILED = 'SEND_FAILED',
  REPLY_FAILED = 'REPLY_FAILED',
  FETCH_FAILED = 'FETCH_FAILED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

/**
 * Email Parsing Utilities
 */

export interface EmailParsingOptions {
  extractPlainText?: boolean;
  extractHtml?: boolean;
  parseAttachments?: boolean;
  maxBodyLength?: number;
}

export interface EmailMetadata {
  messageId: string;
  threadId: string;
  references?: string[];
  inReplyTo?: string;
  importance?: 'high' | 'normal' | 'low';
  autoReplied?: boolean;
  listUnsubscribe?: string;
  deliveredTo?: string;
  returnPath?: string;
}

/**
 * Thread Management
 */

export interface ThreadSummary {
  id: string;
  subject: string;
  participants: EmailContact[];
  messageCount: number;
  unreadCount: number;
  lastMessageDate: Date;
  labels: string[];
  snippet: string;
  hasAttachments: boolean;
}

export interface ThreadUpdateRequest {
  threadId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
  markAsRead?: boolean;
  markAsImportant?: boolean;
}

/**
 * Batch Operations
 */

export interface BatchEmailOperation {
  messageIds: string[];
  operation: 'markAsRead' | 'markAsUnread' | 'delete' | 'addLabel' | 'removeLabel' | 'archive';
  labelIds?: string[];
}

export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{
    messageId: string;
    error: string;
  }>;
}

/**
 * Search and Filtering
 */

export interface AdvancedSearchOptions {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isImportant?: boolean;
  inFolder?: string;
  hasLabel?: string;
  dateAfter?: Date;
  dateBefore?: Date;
  sizeGreaterThan?: number;
  sizeLessThan?: number;
  excludeSpam?: boolean;
  excludeTrash?: boolean;
}

export interface EmailSearchResult {
  messages: GmailMessage[];
  totalCount: number;
  hasMore: boolean;
  nextPageToken?: string;
  searchQuery: string;
  executionTime: number;
}

/**
 * Type Guards
 */

export function isGmailMessage(obj: any): obj is GmailMessage {
  return obj && typeof obj.id === 'string' && typeof obj.threadId === 'string';
}

export function isGmailThread(obj: any): obj is GmailThread {
  return obj && typeof obj.id === 'string' && Array.isArray(obj.messages);
}

export function isEmailAttachment(obj: any): obj is EmailAttachment {
  return obj && typeof obj.id === 'string' && typeof obj.filename === 'string';
}

export function isGmailServiceError(error: any): error is GmailServiceError {
  return error instanceof GmailServiceError;
}

/**
 * Utility Types
 */

export type EmailDirection = 'sent' | 'received';
export type EmailPriority = 'high' | 'normal' | 'low';
export type EmailStatus = 'draft' | 'sent' | 'failed' | 'scheduled';
export type AttachmentType = 'image' | 'document' | 'video' | 'audio' | 'other';

export interface EmailStats {
  totalEmails: number;
  unreadEmails: number;
  sentEmails: number;
  receivedEmails: number;
  totalThreads: number;
  averageEmailsPerDay: number;
  lastEmailDate?: Date;
}