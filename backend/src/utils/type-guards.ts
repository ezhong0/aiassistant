/**
 * Type guards for runtime validation
 * Provides safe type checking at runtime to prevent type errors
 */

import { z } from 'zod';
import { ErrorFactory } from '../errors/error-factory';
import {
  SlackContext,
  SlackMessage,
  SlackBlock,
  SlackElement,
  SlackEvent,
  SlackMessageEvent,
  SlackAppMentionEvent,
  SlackSlashCommandPayload,
  SlackInteractiveComponentPayload,
} from '../types/slack/slack.types';
import { ToolCall, ToolResult, ToolCallSchema, ToolResultSchema } from '../framework/tool-execution';
// OpenAI function schema type
interface OpenAIFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * Check if value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is a valid array
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for SlackContext
 */
export function isSlackContext(value: unknown): value is SlackContext {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.channelId) &&
    isNonEmptyString(value.teamId) &&
    typeof value.isDirectMessage === 'boolean' &&
    (value.threadTs === undefined || typeof value.threadTs === 'string') &&
    (value.userName === undefined || typeof value.userName === 'string') &&
    (value.userEmail === undefined || typeof value.userEmail === 'string')
  );
}

/**
 * Type guard for SlackMessage
 */
export function isSlackMessage(value: unknown): value is SlackMessage {
  if (!isObject(value)) return false;

  return (
    (value.text === undefined || typeof value.text === 'string') &&
    (value.blocks === undefined || isArray(value.blocks)) &&
    (value.attachments === undefined || isArray(value.attachments)) &&
    (value.thread_ts === undefined || typeof value.thread_ts === 'string') &&
    (value.replace_original === undefined || typeof value.replace_original === 'boolean') &&
    (value.response_type === undefined ||
      value.response_type === 'in_channel' ||
      value.response_type === 'ephemeral')
  );
}

/**
 * Type guard for SlackBlock
 */
export function isSlackBlock(value: unknown): value is SlackBlock {
  if (!isObject(value)) return false;

  const validTypes = ['section', 'divider', 'header', 'actions', 'context', 'image'];

  return (
    typeof value.type === 'string' &&
    validTypes.includes(value.type) &&
    (value.text === undefined || isObject(value.text)) &&
    (value.fields === undefined || isArray(value.fields)) &&
    (value.elements === undefined || isArray(value.elements)) &&
    (value.accessory === undefined || isObject(value.accessory)) &&
    (value.block_id === undefined || typeof value.block_id === 'string')
  );
}

/**
 * Type guard for SlackElement
 */
export function isSlackElement(value: unknown): value is SlackElement {
  if (!isObject(value)) return false;

  const validTypes = [
    'button', 'static_select', 'multi_static_select',
    'datepicker', 'timepicker', 'image', 'plain_text_input',
  ];

  return (
    typeof value.type === 'string' &&
    validTypes.includes(value.type) &&
    (value.text === undefined || isObject(value.text)) &&
    (value.action_id === undefined || typeof value.action_id === 'string') &&
    (value.value === undefined || typeof value.value === 'string') &&
    (value.url === undefined || typeof value.url === 'string') &&
    (value.style === undefined ||
      value.style === 'primary' ||
      value.style === 'danger') &&
    (value.confirm === undefined || isObject(value.confirm))
  );
}

/**
 * Type guard for SlackMessageEvent
 */
export function isSlackMessageEvent(value: unknown): value is SlackMessageEvent {
  if (!isObject(value)) return false;

  return (
    value.type === 'message' &&
    isNonEmptyString(value.channel) &&
    isNonEmptyString(value.user) &&
    isNonEmptyString(value.text) &&
    isNonEmptyString(value.ts) &&
    (value.thread_ts === undefined || typeof value.thread_ts === 'string') &&
    (value.channel_type === undefined || typeof value.channel_type === 'string')
  );
}

/**
 * Type guard for SlackAppMentionEvent
 */
export function isSlackAppMentionEvent(value: unknown): value is SlackAppMentionEvent {
  if (!isObject(value)) return false;

  return (
    value.type === 'app_mention' &&
    isNonEmptyString(value.channel) &&
    isNonEmptyString(value.user) &&
    isNonEmptyString(value.text) &&
    isNonEmptyString(value.ts) &&
    (value.thread_ts === undefined || typeof value.thread_ts === 'string')
  );
}

/**
 * Type guard for SlackSlashCommandPayload
 */
export function isSlackSlashCommandPayload(value: unknown): value is SlackSlashCommandPayload {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.token) &&
    isNonEmptyString(value.team_id) &&
    isNonEmptyString(value.team_domain) &&
    isNonEmptyString(value.channel_id) &&
    isNonEmptyString(value.channel_name) &&
    isNonEmptyString(value.user_id) &&
    isNonEmptyString(value.user_name) &&
    isNonEmptyString(value.command) &&
    typeof value.text === 'string' &&
    isNonEmptyString(value.response_url) &&
    isNonEmptyString(value.trigger_id)
  );
}

/**
 * Type guard for SlackInteractiveComponentPayload
 */
export function isSlackInteractivePayload(value: unknown): value is SlackInteractiveComponentPayload {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.type) &&
    isObject(value.user) &&
    isNonEmptyString((value.user as Record<string, unknown>).id as string) &&
    isNonEmptyString((value.user as Record<string, unknown>).name as string) &&
    isObject(value.channel) &&
    isNonEmptyString((value.channel as Record<string, unknown>).id as string) &&
    isNonEmptyString((value.channel as Record<string, unknown>).name as string) &&
    isObject(value.team) &&
    isNonEmptyString((value.team as Record<string, unknown>).id as string) &&
    isNonEmptyString((value.team as Record<string, unknown>).domain as string) &&
    isArray(value.actions) &&
    isNonEmptyString(value.trigger_id) &&
    isNonEmptyString(value.response_url)
  );
}

/**
 * Type guard for SlackEvent union type
 */
export function isSlackEvent(value: unknown): value is SlackEvent {
  return (
    isSlackMessageEvent(value) ||
    isSlackAppMentionEvent(value) ||
    isSlackSlashCommandPayload(value) ||
    isSlackInteractivePayload(value)
  );
}

/**
 * Type guard for ToolCall
 */
export function isToolCall(value: unknown): value is ToolCall {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.name) &&
    isObject(value.parameters)
  );
}

/**
 * Type guard for ToolResult
 */
export function isToolResult(value: unknown): value is ToolResult {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.toolName) &&
    typeof value.success === 'boolean' &&
    value.result !== undefined &&
    (value.error === undefined || typeof value.error === 'string') &&
    (value.executionTime === undefined || typeof value.executionTime === 'number')
  );
}

// ✅ Enhanced Zod-based type guards for better validation
/**
 * Zod-based type guard for ToolCall with comprehensive validation
 */
export function isValidToolCall(value: unknown): value is ToolCall {
  return ToolCallSchema.safeParse(value).success;
}

/**
 * Zod-based type guard for ToolResult with comprehensive validation
 */
export function isValidToolResult(value: unknown): value is ToolResult {
  return ToolResultSchema.safeParse(value).success;
}

/**
 * Zod-based validation for ToolCall with detailed error information
 */
export function validateToolCallWithZod(value: unknown): { success: true; data: ToolCall } | { success: false; error: z.ZodError } {
  const result = ToolCallSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data as ToolCall };
  }
  return { success: false, error: result.error };
}

/**
 * Zod-based validation for ToolResult with detailed error information
 */
export function validateToolResultWithZod(value: unknown): { success: true; data: ToolResult } | { success: false; error: z.ZodError } {
  const result = ToolResultSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data as ToolResult };
  }
  return { success: false, error: result.error };
}

/**
 * Type guard for OpenAIFunctionSchema
 */
export function isOpenAIFunctionSchema(value: unknown): value is OpenAIFunctionSchema {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    isObject(value.parameters) &&
    value.parameters.type === 'object' &&
    isObject(value.parameters.properties) &&
    (value.parameters.required === undefined ||
      (isArray(value.parameters.required) &&
       (value.parameters.required as unknown[]).every(item => typeof item === 'string')))
  );
}

/**
 * Validate and cast unknown value to SlackContext
 * Throws error if validation fails
 */
export function validateSlackContext(value: unknown): SlackContext {
  if (!isSlackContext(value)) {
    throw ErrorFactory.api.badRequest('Invalid SlackContext: missing required fields or invalid types');
  }
  return value;
}

/**
 * Validate and cast unknown value to SlackMessage
 * Throws error if validation fails
 */
export function validateSlackMessage(value: unknown): SlackMessage {
  if (!isSlackMessage(value)) {
    throw ErrorFactory.api.badRequest('Invalid SlackMessage: invalid structure or types');
  }
  return value;
}

/**
 * Validate and cast unknown value to SlackEvent
 * Throws error if validation fails
 */
export function validateSlackEvent(value: unknown): SlackEvent {
  if (!isSlackEvent(value)) {
    throw ErrorFactory.api.badRequest('Invalid SlackEvent: unknown event type or invalid structure');
  }
  return value;
}

/**
 * Validate and cast unknown value to ToolCall
 * Throws error if validation fails
 */
export function validateToolCall(value: unknown): ToolCall {
  if (!isToolCall(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolCall: missing name or parameters');
  }
  return value;
}

/**
 * Validate and cast unknown value to ToolResult
 * Throws error if validation fails
 */
export function validateToolResult(value: unknown): ToolResult {
  if (!isToolResult(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolResult: missing required fields');
  }
  return value;
}

/**
 * Validate array of ToolCall objects
 */
export function validateToolCalls(value: unknown): ToolCall[] {
  if (!isArray(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolCalls: must be an array');
  }

  return value.map((item, index) => {
    try {
      return validateToolCall(item);
    } catch (error) {
      throw ErrorFactory.api.badRequest(`Invalid ToolCall at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Validate array of ToolResult objects
 */
export function validateToolResults(value: unknown): ToolResult[] {
  if (!isArray(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolResults: must be an array');
  }

  return value.map((item, index) => {
    try {
      return validateToolResult(item);
    } catch (error) {
      throw ErrorFactory.api.badRequest(`Invalid ToolResult at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Safe type assertion with fallback
 */
export function safeTypeAssertion<T>(
  value: unknown,
  validator: (value: unknown) => value is T,
  fallback: T,
): T {
  return validator(value) ? value : fallback;
}

/**
 * Safe property access with type checking
 */
export function safeGetProperty<T>(
  obj: unknown,
  property: string,
  validator: (value: unknown) => value is T,
): T | undefined {
  if (!isObject(obj)) return undefined;
  const value = (obj as Record<string, unknown>)[property];
  return validator(value) ? value : undefined;
}

// ✅ Additional Zod-based validation utilities
/**
 * Validate multiple values against a Zod schema
 */
export function validateMultipleWithZod<T>(
  values: unknown[],
  schema: z.ZodSchema<T>,
): { success: true; data: T[] } | { success: false; errors: z.ZodError[] } {
  const results: T[] = [];
  const errors: z.ZodError[] = [];

  for (const value of values) {
    const result = schema.safeParse(value);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length === 0) {
    return { success: true, data: results };
  }
  return { success: false, errors };
}

/**
 * Validate object properties against Zod schemas
 */
export function validateObjectProperties<T extends Record<string, unknown>>(
  obj: unknown,
  schemas: { [K in keyof T]: z.ZodSchema<T[K]> },
): { success: true; data: T } | { success: false; errors: Record<string, z.ZodError> } {
  if (!isObject(obj)) {
    return { success: false, errors: { root: new z.ZodError([{ code: 'invalid_type', expected: 'object', received: typeof obj, path: [], message: `Expected object, received ${typeof obj}` }]) } };
  }

  const errors: Record<string, z.ZodError> = {};
  const result = {} as T;

  for (const [key, schema] of Object.entries(schemas)) {
    const value = (obj as Record<string, unknown>)[key];
    const validation = schema.safeParse(value);
    
    if (validation.success) {
      result[key as keyof T] = validation.data;
    } else {
      errors[key] = validation.error;
    }
  }

  if (Object.keys(errors).length === 0) {
    return { success: true, data: result };
  }
  return { success: false, errors };
}

/**
 * Create a type guard from a Zod schema
 */
export function createTypeGuard<T>(schema: z.ZodSchema<T>): (value: unknown) => value is T {
  return (value: unknown): value is T => schema.safeParse(value).success;
}

/**
 * Validate with fallback value
 */
export function validateWithFallback<T>(
  value: unknown,
  schema: z.ZodSchema<T>,
  fallback: T,
): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}