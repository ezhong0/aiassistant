/**
 * Agent-specific parameter types for individual agent implementations
 */

import { BaseToolParameters } from './agent-parameters';

// ===============================
// Email Agent Specific Types
// ===============================

export interface SendEmailActionParams extends BaseToolParameters {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface SearchEmailActionParams extends BaseToolParameters {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  maxResults?: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface EmailSummaryParams extends BaseToolParameters {
  emails: Array<{
    id: string;
    subject: string;
    from: string;
    date: string;
    snippet?: string;
    isUnread?: boolean;
  }>;
  maxEmails?: number;
}

// ===============================
// Calendar Agent Specific Types
// ===============================

export interface CreateEventActionParams extends BaseToolParameters {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: string | string[];
  location?: string;
  timezone?: string;
  conferenceData?: {
    createRequest?: {
      requestId?: string;
      conferenceSolutionKey?: {
        type: 'hangoutsMeet' | 'addOn';
      };
    };
  };
}

export interface CalendarEventResult {
  success: boolean;
  event?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    location?: string | null;
    attendees?: string[];
    conflicts?: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
    }>;
  };
  error?: string;
  [key: string]: unknown; // Index signature for ToolExecutionResult compatibility
}

export interface ListEventsActionParams extends BaseToolParameters {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
  singleEvents?: boolean;
  showDeleted?: boolean;
}

export interface UpdateEventActionParams extends BaseToolParameters {
  eventId: string;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  attendees?: string | string[];
}

// ===============================
// Contact Agent Specific Types
// ===============================

export interface ContactSearchParams extends BaseToolParameters {
  query: string;
  maxResults?: number;
  includeDeleted?: boolean;
  sortOrder?: 'FIRST_NAME_ASCENDING' | 'LAST_NAME_ASCENDING';
}

export interface ContactResult {
  id?: string;
  name: string;
  emails: string[];
  phoneNumbers?: string[];
  organizations?: string[];
  photoUrl?: string;
}

export interface ContactSearchResult {
  success: boolean;
  contacts: ContactResult[];
  totalResults: number;
  error?: string;
  [key: string]: unknown; // Index signature for ToolExecutionResult compatibility
}

// ===============================
// Slack Agent Specific Types
// ===============================

export interface SlackReadMessagesParams extends BaseToolParameters {
  channelId: string;
  limit?: number;
  oldest?: string;
  latest?: string;
  inclusive?: boolean;
}

export interface SlackMessageSummary {
  id: string;
  text: string;
  user: string;
  timestamp: Date;
  threadTs?: string;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

export interface SlackReadResult {
  success: boolean;
  messages: SlackMessageSummary[];
  hasMore: boolean;
  error?: string;
}

// ===============================
// Think Agent Specific Types
// ===============================

export interface ThinkAnalysisParams extends BaseToolParameters {
  query: string;
  context?: string;
  analysisType?: 'verification' | 'planning' | 'analysis' | 'reasoning';
  includeToolAnalysis?: boolean;
}

export interface ThinkAnalysisResult {
  success: boolean;
  analysis: string;
  reasoning?: string;
  suggestions?: string[];
  toolAnalysis?: Array<{
    tool: string;
    relevance: number;
    reasoning: string;
    recommendation?: string;
  }>;
  confidence?: number;
  error?: string;
  [key: string]: unknown; // Index signature for ToolExecutionResult compatibility
}

// ===============================
// Common Agent Result Types
// ===============================

export interface AgentExecutionSummary {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalExecutionTime: number;
  errors: string[];
  warnings: string[];
}

export interface AgentToolResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

// ===============================
// Type Guards
// ===============================

export function isSendEmailActionParams(params: unknown): params is SendEmailActionParams {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;
  return (
    (p.to === undefined || typeof p.to === 'string' || Array.isArray(p.to)) &&
    (p.subject === undefined || typeof p.subject === 'string') &&
    (p.body === undefined || typeof p.body === 'string')
  );
}

export function isSearchEmailActionParams(params: unknown): params is SearchEmailActionParams {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;
  return (
    (p.query === undefined || typeof p.query === 'string') &&
    (p.maxResults === undefined || typeof p.maxResults === 'number')
  );
}

export function isCreateEventActionParams(params: unknown): params is CreateEventActionParams {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;
  return (
    typeof p.title === 'string' &&
    typeof p.startTime === 'string' &&
    typeof p.endTime === 'string'
  );
}

export function isContactSearchParams(params: unknown): params is ContactSearchParams {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;
  return typeof p.query === 'string';
}

export function isThinkAnalysisParams(params: unknown): params is ThinkAnalysisParams {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;
  return typeof p.query === 'string';
}