/**
 * Clean Tool Execution System
 * 
 * This module provides the core interfaces for tool execution in the new system.
 * All tool definitions and validation are handled by the ToolRegistry.
 */

import { z } from 'zod';
import { SlackContext, SlackContextSchema } from '../types/slack/slack.types';

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  timestamp: Date;
  correlationId?: string;
  slackContext?: SlackContext;
}

/**
 * Tool call interface
 */
export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

/**
 * Tool result interface
 */
export interface ToolResult {
  toolName: string;
  result?: any;
  success: boolean;
  error?: string;
  executionTime: number;
}

/**
 * Zod schemas for validation
 */
export const ToolExecutionContextSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  timestamp: z.date(),
  correlationId: z.string().optional(),
  slackContext: SlackContextSchema.optional(),
});

export const ToolCallSchema = z.object({
  name: z.string(),
  parameters: z.record(z.any()),
});

export const ToolResultSchema = z.object({
  toolName: z.string(),
  result: z.any().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  executionTime: z.number(),
});

/**
 * Validation functions
 */
export function validateToolExecutionContext(data: unknown): ToolExecutionContext {
  return ToolExecutionContextSchema.parse(data);
}

export function validateToolCall(data: unknown): ToolCall {
  return ToolCallSchema.parse(data);
}

export function validateToolResult(data: unknown): ToolResult {
  return ToolResultSchema.parse(data);
}

/**
 * Safe parsing functions
 */
export function safeParseToolExecutionContext(data: unknown): { success: true; data: ToolExecutionContext } | { success: false; error: z.ZodError } {
  const result = ToolExecutionContextSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeParseToolCall(data: unknown): { success: true; data: ToolCall } | { success: false; error: z.ZodError } {
  const result = ToolCallSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeParseToolResult(data: unknown): { success: true; data: ToolResult } | { success: false; error: z.ZodError } {
  const result = ToolResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
