/**
 * Type guards for runtime validation
 * Provides safe type checking at runtime to prevent type errors
 */

import {
  SlackContext,
  SlackMessage,
  SlackBlock,
  SlackElement,
  SlackEvent,
  SlackMessageEvent,
  SlackAppMentionEvent,
  SlackSlashCommandPayload,
  SlackInteractivePayload
} from '../types/slack/slack.types';
import { ToolCall, ToolResult } from '../types/tools';
import { OpenAIFunctionSchema } from '../framework/agent-factory';

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
    'datepicker', 'timepicker', 'image', 'plain_text_input'
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
 * Type guard for SlackInteractivePayload
 */
export function isSlackInteractivePayload(value: unknown): value is SlackInteractivePayload {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.type) &&
    isObject(value.user) &&
    isNonEmptyString((value.user as any).id) &&
    isNonEmptyString((value.user as any).name) &&
    isObject(value.channel) &&
    isNonEmptyString((value.channel as any).id) &&
    isNonEmptyString((value.channel as any).name) &&
    isObject(value.team) &&
    isNonEmptyString((value.team as any).id) &&
    isNonEmptyString((value.team as any).domain) &&
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
    throw new Error('Invalid SlackContext: missing required fields or invalid types');
  }
  return value;
}

/**
 * Validate and cast unknown value to SlackMessage
 * Throws error if validation fails
 */
export function validateSlackMessage(value: unknown): SlackMessage {
  if (!isSlackMessage(value)) {
    throw new Error('Invalid SlackMessage: invalid structure or types');
  }
  return value;
}

/**
 * Validate and cast unknown value to SlackEvent
 * Throws error if validation fails
 */
export function validateSlackEvent(value: unknown): SlackEvent {
  if (!isSlackEvent(value)) {
    throw new Error('Invalid SlackEvent: unknown event type or invalid structure');
  }
  return value;
}

/**
 * Validate and cast unknown value to ToolCall
 * Throws error if validation fails
 */
export function validateToolCall(value: unknown): ToolCall {
  if (!isToolCall(value)) {
    throw new Error('Invalid ToolCall: missing name or parameters');
  }
  return value;
}

/**
 * Validate and cast unknown value to ToolResult
 * Throws error if validation fails
 */
export function validateToolResult(value: unknown): ToolResult {
  if (!isToolResult(value)) {
    throw new Error('Invalid ToolResult: missing required fields');
  }
  return value;
}

/**
 * Validate array of ToolCall objects
 */
export function validateToolCalls(value: unknown): ToolCall[] {
  if (!isArray(value)) {
    throw new Error('Invalid ToolCalls: must be an array');
  }

  return value.map((item, index) => {
    try {
      return validateToolCall(item);
    } catch (error) {
      throw new Error(`Invalid ToolCall at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Validate array of ToolResult objects
 */
export function validateToolResults(value: unknown): ToolResult[] {
  if (!isArray(value)) {
    throw new Error('Invalid ToolResults: must be an array');
  }

  return value.map((item, index) => {
    try {
      return validateToolResult(item);
    } catch (error) {
      throw new Error(`Invalid ToolResult at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Safe type assertion with fallback
 */
export function safeTypeAssertion<T>(
  value: unknown,
  validator: (value: unknown) => value is T,
  fallback: T
): T {
  return validator(value) ? value : fallback;
}

/**
 * Safe property access with type checking
 */
export function safeGetProperty<T>(
  obj: unknown,
  property: string,
  validator: (value: unknown) => value is T
): T | undefined {
  if (!isObject(obj)) return undefined;
  const value = (obj as Record<string, unknown>)[property];
  return validator(value) ? value : undefined;
}