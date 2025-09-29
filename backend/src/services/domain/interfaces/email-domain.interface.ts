/**
 * Email Domain Service Interface
 * Focused interface for email-related operations
 */

import { IOAuthEnabledDomainService } from './base-domain.interface';

/**
 * Email attachment definition
 */
export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

/**
 * Email attachment metadata (for received emails)
 */
export interface EmailAttachmentMetadata {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

/**
 * Parameters for sending an email
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/**
 * Result of sending an email
 */
export interface EmailSendResult {
  messageId: string;
  threadId: string;
}

/**
 * Parameters for searching emails
 */
export interface EmailSearchParams {
  query: string;
  maxResults?: number;
  includeSpamTrash?: boolean;
}

/**
 * Email search result item
 */
export interface EmailSearchResultItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  snippet: string;
  labels: string[];
  isUnread: boolean;
  hasAttachments: boolean;
}

/**
 * Email body content
 */
export interface EmailBody {
  text?: string;
  html?: string;
}

/**
 * Full email details
 */
export interface EmailDetails {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: Date;
  body: EmailBody;
  snippet: string;
  labels: string[];
  attachments?: EmailAttachmentMetadata[];
}

/**
 * Email reply parameters
 */
export interface EmailReplyParams {
  messageId: string;
  replyBody: string;
  attachments?: EmailAttachment[];
}

/**
 * Email thread message
 */
export interface EmailThreadMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  snippet: string;
  body: EmailBody;
  labels: string[];
  attachments?: EmailAttachmentMetadata[];
}

/**
 * Email thread details
 */
export interface EmailThread {
  id: string;
  messages: EmailThreadMessage[];
}

/**
 * Email draft parameters
 */
export interface EmailDraftParams {
  to?: string;
  subject?: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
}

/**
 * Email draft details
 */
export interface EmailDraft {
  id: string;
  message: EmailDetails;
}

/**
 * Email label details
 */
export interface EmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  color?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

/**
 * Email Domain Service Interface
 * Handles all email-related operations with automatic OAuth management
 */
export interface IEmailDomainService extends IOAuthEnabledDomainService {
  // ===== Email Operations =====

  /**
   * Send an email
   */
  sendEmail(userId: string, params: SendEmailParams): Promise<EmailSendResult>;

  /**
   * Search emails
   */
  searchEmails(userId: string, params: EmailSearchParams): Promise<EmailSearchResultItem[]>;

  /**
   * Get email details by ID
   */
  getEmail(messageId: string): Promise<EmailDetails>;

  /**
   * Reply to an email
   */
  replyToEmail(params: EmailReplyParams): Promise<EmailSendResult>;

  /**
   * Get email thread
   */
  getEmailThread(threadId: string): Promise<EmailThread>;

  /**
   * Forward an email
   */
  forwardEmail(params: {
    messageId: string;
    to: string;
    forwardBody: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailSendResult>;

  // ===== Draft Operations =====

  /**
   * Create email draft
   */
  createDraft(userId: string, params: EmailDraftParams): Promise<EmailDraft>;

  /**
   * Update email draft
   */
  updateDraft(draftId: string, params: EmailDraftParams): Promise<EmailDraft>;

  /**
   * Get email draft
   */
  getDraft(draftId: string): Promise<EmailDraft>;

  /**
   * Delete email draft
   */
  deleteDraft(draftId: string): Promise<void>;

  /**
   * Send email draft
   */
  sendDraft(draftId: string): Promise<EmailSendResult>;

  /**
   * List email drafts
   */
  listDrafts(userId: string): Promise<EmailDraft[]>;

  // ===== Label Operations =====

  /**
   * Get email labels
   */
  getLabels(userId: string): Promise<EmailLabel[]>;

  /**
   * Create email label
   */
  createLabel(userId: string, name: string, color?: string): Promise<EmailLabel>;

  /**
   * Update email label
   */
  updateLabel(labelId: string, name: string, color?: string): Promise<EmailLabel>;

  /**
   * Delete email label
   */
  deleteLabel(labelId: string): Promise<void>;

  /**
   * Add labels to email
   */
  addLabelsToEmail(messageId: string, labelIds: string[]): Promise<void>;

  /**
   * Remove labels from email
   */
  removeLabelsFromEmail(messageId: string, labelIds: string[]): Promise<void>;

  // ===== Attachment Operations =====

  /**
   * Get attachment content
   */
  getAttachment(messageId: string, attachmentId: string): Promise<{
    filename: string;
    mimeType: string;
    content: string;
  }>;

  /**
   * Upload attachment for draft
   */
  uploadAttachment(draftId: string, attachment: EmailAttachment): Promise<void>;

  // ===== Utility Operations =====

  /**
   * Mark email as read
   */
  markAsRead(messageId: string): Promise<void>;

  /**
   * Mark email as unread
   */
  markAsUnread(messageId: string): Promise<void>;

  /**
   * Archive email
   */
  archiveEmail(messageId: string): Promise<void>;

  /**
   * Delete email
   */
  deleteEmail(messageId: string): Promise<void>;

  /**
   * Get user's email signature
   */
  getSignature(userId: string): Promise<string>;

  /**
   * Update user's email signature
   */
  updateSignature(userId: string, signature: string): Promise<void>;
}