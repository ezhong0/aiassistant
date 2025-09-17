/**
 * Core tool execution types with Zod validation
 * 
 * This module provides type-safe definitions for tool calls, results, and execution contexts.
 * All types are backed by Zod schemas for runtime validation and type inference.
 * 
 * @example
 * ```typescript
 * // Create a validated tool call
 * const toolCall = validateToolCall({
 *   name: 'send_email',
 *   parameters: { to: 'user@example.com', subject: 'Hello' }
 * });
 * 
 * // Execute with validated context
 * const context = validateToolExecutionContext({
 *   sessionId: 'abc123',
 *   userId: 'user456',
 *   timestamp: new Date()
 * });
 * ```
 */

import { z } from 'zod';
import { SlackContext } from './slack/slack.types';

// ✅ Core Zod schemas for type safety and validation
export const ToolCallSchema = z.object({
  name: z.string(),
  parameters: z.record(z.any()),
});

export const ToolResultSchema = z.object({
  toolName: z.string(),
  result: z.any(),
  success: z.boolean(),
  error: z.string().optional(),
  executionTime: z.number(),
});

export const ToolExecutionContextSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  timestamp: z.date(),
  previousResults: z.array(z.lazy(() => ToolResultSchema)).optional(),
  slackContext: z.any().optional(), // Will be refined with SlackContextSchema
  metadata: z.record(z.any()).optional(),
});

// ✅ Export inferred types
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ToolExecutionContext = z.infer<typeof ToolExecutionContextSchema>;

// ✅ Validation helpers for runtime type safety
/**
 * Validates and parses unknown data as a ToolCall
 * 
 * @param data - The data to validate
 * @returns Validated ToolCall object
 * @throws {ZodError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const toolCall = validateToolCall({ name: 'send_email', parameters: {} });
 *   console.log(toolCall.name); // 'send_email'
 * } catch (error) {
 *   console.error('Invalid tool call:', error);
 * }
 * ```
 */
export function validateToolCall(data: unknown): ToolCall {
  return ToolCallSchema.parse(data);
}

/**
 * Validates and parses unknown data as a ToolResult
 * 
 * @param data - The data to validate
 * @returns Validated ToolResult object
 * @throws {ZodError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const result = validateToolResult({
 *     toolName: 'send_email',
 *     result: { success: true },
 *     success: true,
 *     executionTime: 150
 *   });
 *   console.log(result.toolName); // 'send_email'
 * } catch (error) {
 *   console.error('Invalid tool result:', error);
 * }
 * ```
 */
export function validateToolResult(data: unknown): ToolResult {
  return ToolResultSchema.parse(data);
}

/**
 * Validates and parses unknown data as a ToolExecutionContext
 * 
 * @param data - The data to validate
 * @returns Validated ToolExecutionContext object
 * @throws {ZodError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const context = validateToolExecutionContext({
 *     sessionId: 'abc123',
 *     userId: 'user456',
 *     timestamp: new Date()
 *   });
 *   console.log(context.sessionId); // 'abc123'
 * } catch (error) {
 *   console.error('Invalid execution context:', error);
 * }
 * ```
 */
export function validateToolExecutionContext(data: unknown): ToolExecutionContext {
  return ToolExecutionContextSchema.parse(data);
}

// ✅ Safe parsing helpers that don't throw
/**
 * Safely parses unknown data as a ToolCall without throwing
 * 
 * @param data - The data to parse
 * @returns Success result with validated data or failure result with error
 * 
 * @example
 * ```typescript
 * const result = safeParseToolCall({ name: 'send_email', parameters: {} });
 * if (result.success) {
 *   console.log('Valid tool call:', result.data.name);
 * } else {
 *   console.error('Validation failed:', result.error.errors);
 * }
 * ```
 */
export function safeParseToolCall(data: unknown): { success: true; data: ToolCall } | { success: false; error: z.ZodError } {
  const result = ToolCallSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Safely parses unknown data as a ToolResult without throwing
 * 
 * @param data - The data to parse
 * @returns Success result with validated data or failure result with error
 * 
 * @example
 * ```typescript
 * const result = safeParseToolResult({
 *   toolName: 'send_email',
 *   result: { success: true },
 *   success: true,
 *   executionTime: 150
 * });
 * if (result.success) {
 *   console.log('Valid tool result:', result.data.toolName);
 * } else {
 *   console.error('Validation failed:', result.error.errors);
 * }
 * ```
 */
export function safeParseToolResult(data: unknown): { success: true; data: ToolResult } | { success: false; error: z.ZodError } {
  const result = ToolResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export interface Tool {
  name: string;
  description: string;
  execute(parameters: any, context: ToolExecutionContext): Promise<ToolResult>;
}

// ✅ Agent response schema
export const AgentResponseSchema = z.object({
  message: z.string(),
  data: z.any().optional(),
  success: z.boolean(),
  error: z.string().optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;


// ✅ Conversation entry schema
export const ConversationEntrySchema = z.object({
  timestamp: z.date(),
  type: z.string(),
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolResults: z.array(ToolResultSchema).optional(),
});

export type ConversationEntry = z.infer<typeof ConversationEntrySchema>;

// ✅ Session context schema
export const SessionContextSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  createdAt: z.date(),
  lastActivity: z.date(),
  conversationHistory: z.array(ConversationEntrySchema),
  toolCalls: z.array(ToolCallSchema),
  toolResults: z.array(ToolResultSchema),
  pendingActions: z.array(z.any()).optional(),
  conversationContext: z.any().optional(),
  expiresAt: z.date(),
  oauthTokens: z.object({
    google: z.object({
      access_token: z.string(),
      refresh_token: z.string().optional(),
      expires_in: z.number().optional(),
      token_type: z.string().optional(),
      scope: z.string().optional(),
      expiry_date: z.number().optional(),
    }).optional(),
    slack: z.object({
      access_token: z.string().optional(),
      team_id: z.string().optional(),
      user_id: z.string().optional(),
    }).optional(),
  }).optional(),
  conversations: z.record(z.record(z.object({
    lastActivity: z.date(),
    messageCount: z.number(),
    context: z.any().optional(),
  }))).optional(),
});

export type SessionContext = z.infer<typeof SessionContextSchema>;

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
  query: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string[];
  description?: string;
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