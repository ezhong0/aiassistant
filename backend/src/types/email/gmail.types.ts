/**
 * Gmail Message Types with Zod validation
 */

import { z } from 'zod';

// ✅ Zod schemas for Gmail types
export const EmailAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  data: z.string().optional() // Base64 encoded data when downloading
});

export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  date: z.string(),
  body: z.string(),
  snippet: z.string(),
  labelIds: z.array(z.string()),
  attachments: z.array(EmailAttachmentSchema),
  isUnread: z.boolean(),
  historyId: z.string(),
  internalDate: z.string(),
  sizeEstimate: z.number()
});

export const GmailThreadSchema = z.object({
  id: z.string(),
  historyId: z.string(),
  messages: z.array(GmailMessageSchema),
  snippet: z.string().optional()
});

export const SendEmailRequestSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string(),
  body: z.string(),
  replyTo: z.string().optional(),
  attachments: z.array(EmailAttachmentSchema).optional(),
  htmlBody: z.string().optional(),
  threadId: z.string().optional()
});

export const ReplyEmailRequestSchema = z.object({
  messageId: z.string(),
  threadId: z.string(),
  to: z.string().optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  body: z.string(),
  attachments: z.array(EmailAttachmentSchema).optional()
});

export const SearchEmailsRequestSchema = z.object({
  query: z.string().optional(),
  maxResults: z.number().optional(),
  pageToken: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  includeSpamTrash: z.boolean().optional()
});

export const EmailOperationResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  threadId: z.string().optional(),
  error: z.string().optional(),
  operation: z.string(),
  timestamp: z.string()
});

export const SendEmailResponseSchema = z.object({
  success: z.boolean(),
  message: GmailMessageSchema.optional(),
  error: z.string().optional()
});

export const GetEmailsResponseSchema = z.object({
  success: z.boolean(),
  messages: z.array(GmailMessageSchema).optional(),
  nextPageToken: z.string().optional(),
  error: z.string().optional()
});

export const GetThreadResponseSchema = z.object({
  success: z.boolean(),
  thread: GmailThreadSchema.optional(),
  error: z.string().optional()
});

// Type inference from schemas
export type EmailAttachment = z.infer<typeof EmailAttachmentSchema>;
export type GmailMessage = z.infer<typeof GmailMessageSchema>;
export type GmailThread = z.infer<typeof GmailThreadSchema>;
export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;
export type ReplyEmailRequest = z.infer<typeof ReplyEmailRequestSchema>;
export type SearchEmailsRequest = z.infer<typeof SearchEmailsRequestSchema>;
export type EmailOperationResult = z.infer<typeof EmailOperationResultSchema>;
export type SendEmailResponse = z.infer<typeof SendEmailResponseSchema>;
export type GetEmailsResponse = z.infer<typeof GetEmailsResponseSchema>;
export type GetThreadResponse = z.infer<typeof GetThreadResponseSchema>;

/**
 * Additional interfaces that don't need Zod validation yet
 */

export interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: {
    email: string;
    name?: string | undefined;
  };
  to: Array<{
    email: string;
    name?: string | undefined;
  }>;
  cc?: Array<{
    email: string;
    name?: string | undefined;
  }> | undefined;
  date: Date;
  body: {
    text?: string | undefined;
    html?: string | undefined;
  };
  attachments: EmailAttachment[];
  isUnread: boolean;
  labels: string[];
  importance?: 'high' | 'normal' | 'low' | undefined;
}

export interface EmailContact {
  email: string;
  name?: string | undefined;
}

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

export interface GmailApiOptions {
  format?: 'minimal' | 'full' | 'raw' | 'metadata';
  includeSpamTrash?: boolean;
  maxResults?: number;
  pageToken?: string;
  q?: string; // Search query
}

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

export interface EmailParsingOptions {
  extractPlainText?: boolean;
  extractHtml?: boolean;
  parseAttachments?: boolean;
  maxBodyLength?: number;
}

export interface EmailMetadata {
  messageId: string;
  threadId: string;
  references?: string[] | undefined;
  inReplyTo?: string | undefined;
  importance?: 'high' | 'normal' | 'low' | undefined;
  autoReplied?: boolean | undefined;
  listUnsubscribe?: string | undefined;
  deliveredTo?: string | undefined;
  returnPath?: string | undefined;
}

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

// Type Guards
export const isGmailMessage = (obj: any): obj is GmailMessage => {
  return obj && typeof obj.id === 'string' && typeof obj.threadId === 'string';
}

export const isGmailThread = (obj: any): obj is GmailThread => {
  return obj && typeof obj.id === 'string' && Array.isArray(obj.messages);
}

export const isEmailAttachment = (obj: any): obj is EmailAttachment => {
  return obj && typeof obj.id === 'string' && typeof obj.filename === 'string';
}

export const isGmailServiceError = (error: any): error is GmailServiceError => {
  return error instanceof GmailServiceError;
}

// Utility Types
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