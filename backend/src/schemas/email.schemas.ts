/**
 * Email and Gmail validation schemas
 */

import { z } from 'zod';
import { EmailSchema, EmailArraySchema, OptionalStringSchema, OptionalNumberSchema } from './common.schemas';

// Email contact schema
export const EmailContactSchema = z.object({
  email: EmailSchema,
  name: OptionalStringSchema,
});

// Email attachment schema
export const EmailAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  data: OptionalStringSchema, // Base64 encoded data
});

// Email body schema
export const EmailBodySchema = z.object({
  text: OptionalStringSchema,
  html: OptionalStringSchema,
});

// Send email request schema
export const SendEmailRequestSchema = z.object({
  to: z.union([EmailSchema, EmailArraySchema]),
  cc: z.union([EmailSchema, EmailArraySchema]).optional(),
  bcc: z.union([EmailSchema, EmailArraySchema]).optional(),
  subject: z.string().min(1),
  body: z.string(),
  replyTo: OptionalStringSchema,
  attachments: z.array(EmailAttachmentSchema).optional(),
});

// Search email request schema
export const SearchEmailRequestSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(100).optional(),
  includeSpamTrash: z.boolean().optional(),
  labelIds: z.array(z.string()).optional(),
});

// Gmail message schema
export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  cc: OptionalStringSchema,
  bcc: OptionalStringSchema,
  date: z.string(),
  body: z.string(),
  snippet: z.string(),
  labelIds: z.array(z.string()),
  attachments: z.array(EmailAttachmentSchema),
  isUnread: z.boolean(),
  historyId: z.string(),
  internalDate: z.string(),
  sizeEstimate: z.number(),
});

// Gmail thread schema
export const GmailThreadSchema = z.object({
  id: z.string(),
  historyId: z.string(),
  messages: z.array(GmailMessageSchema),
  snippet: OptionalStringSchema,
});

// Email draft schema
export const EmailDraftSchema = z.object({
  id: z.string(),
  subject: z.string(),
  to: z.array(EmailContactSchema),
  cc: z.array(EmailContactSchema).optional(),
  bcc: z.array(EmailContactSchema).optional(),
  body: EmailBodySchema,
  attachments: z.array(EmailAttachmentSchema).optional(),
  created: z.date(),
  modified: z.date(),
});

// Email metadata schema
export const EmailMetadataSchema = z.object({
  messageId: z.string(),
  threadId: z.string(),
  references: z.array(z.string()).optional(),
  inReplyTo: OptionalStringSchema,
  importance: z.enum(['high', 'normal', 'low']),
  autoReplied: z.boolean(),
  listUnsubscribe: OptionalStringSchema,
  deliveredTo: OptionalStringSchema,
  returnPath: OptionalStringSchema,
});

// Parsed email schema
export const ParsedEmailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: EmailContactSchema,
  to: z.array(EmailContactSchema),
  cc: z.array(EmailContactSchema).optional(),
  date: z.date(),
  body: EmailBodySchema,
  attachments: z.array(EmailAttachmentSchema),
  isUnread: z.boolean(),
  labels: z.array(z.string()),
  importance: z.enum(['high', 'normal', 'low']),
});
