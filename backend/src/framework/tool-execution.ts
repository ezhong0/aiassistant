/**
 * Clean Tool Execution System
 * 
 * This module provides the core interfaces for tool execution in the new system.
 * All tool definitions and validation are handled by the ToolRegistry.
 */

import { z } from 'zod';


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
  result?: Record<string, unknown>;
  success: boolean;
  error?: string;
  executionTime: number;
}

/**
 * Zod schemas for validation
 */

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

export function validateToolCall(data: unknown): ToolCall {
  return ToolCallSchema.parse(data);
}

export function validateToolResult(data: unknown): ToolResult {
  return ToolResultSchema.parse(data);
}

/**
 * Safe parsing functions
 */

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
