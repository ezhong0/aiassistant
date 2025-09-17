import { SlackContext } from './slack/slack.types';

export interface ToolCall {
  name: string;
  parameters: any;
}

export interface ToolResult {
  toolName: string;
  result: any;
  success: boolean;
  error?: string | undefined;
  executionTime: number;
}

export interface ToolExecutionContext {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  previousResults?: ToolResult[];
  slackContext?: SlackContext; // 🆕 NEW: Slack context for agent operations
  metadata?: {
    teamId?: string;
    userId?: string;
    [key: string]: any;
  };
}

export interface Tool {
  name: string;
  description: string;
  execute(parameters: any, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface AgentResponse {
  message: string;
  data?: any;
  success: boolean;
  error?: string;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  createdAt: Date;
  lastActivity: Date;
  conversationHistory: ConversationEntry[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  pendingActions?: any[];
  conversationContext?: any;
  expiresAt: Date;
  // OAuth token storage for Slack users
  oauthTokens?: {
    google?: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
      expiry_date?: number;
    };
    slack?: {
      access_token?: string;
      team_id?: string;
      user_id?: string;
    };
  };
  // Conversation context for Slack users
  conversations?: {
    [channelId: string]: {
      [threadTs: string]: {
        lastActivity: Date;
        messageCount: number;
        context?: any;
      }
    }
  };
}

export interface ConversationEntry {
  timestamp: Date;
  type: string;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

// Specific agent parameter types
export interface EmailAgentParams {
  query?: string;
  operation?: string;
  contactEmail?: string;
  recipientName?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  messageId?: string;
  emailId?: string;
  maxResults?: number;
}

export interface CalendarAgentParams {
  query?: string;
  operation?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  timeMin?: string;
  timeMax?: string;
  attendees?: string[];
  description?: string;
  accessToken?: string;
  enableConflictDetection?: boolean;
}

export interface ContactAgentParams {
  query?: string;
  operation?: string;
  name?: string;
  email?: string;
  phone?: string;
  accessToken?: string;
}

export interface ThinkParams {
  query?: string;
  context?: string;
  previousActions?: ToolCall[];
}

export interface SlackAgentParams {
  query: string;
  channelId?: string | undefined;
  threadTs?: string | undefined;
  limit?: number | undefined;
  includeReactions?: boolean | undefined;
  includeAttachments?: boolean | undefined;
}

// Tool execution pipeline types
export interface ToolPipeline {
  sessionId: string;
  tools: ToolCall[];
  currentIndex: number;
  results: ToolResult[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface MasterAgentConfig {
  openaiApiKey: string;
  model?: string;
  sessionTimeoutMinutes?: number;
  enableFallbackRouting?: boolean;
}

// Error types
export class ToolExecutionError extends Error {
  constructor(
    public toolName: string,
    public originalError: Error,
    public parameters?: any
  ) {
    super(`Tool ${toolName} execution failed: ${originalError.message}`);
    this.name = 'ToolExecutionError';
  }
}

export class SessionExpiredError extends Error {
  constructor(public sessionId: string) {
    super(`Session ${sessionId} has expired`);
    this.name = 'SessionExpiredError';
  }
}

// Agent configuration types
export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
  timeout?: number;
  retryCount?: number;
  dependencies?: string[];
}

export const TOOL_NAMES = {
  THINK: 'Think',
  EMAIL_AGENT: 'emailAgent',
  CALENDAR_AGENT: 'calendarAgent',
  CONTACT_AGENT: 'contactAgent',
  SLACK_AGENT: 'slackAgent'
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];