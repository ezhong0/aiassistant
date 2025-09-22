import { SlackEventMiddlewareArgs } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { z } from 'zod';

/**
 * Slack-specific context for agent interactions
 */
export interface SlackContext {
  userId: string;
  channelId: string;
  teamId: string;
  threadTs?: string | undefined;
  isDirectMessage: boolean;
  userName?: string | undefined;
  userEmail?: string | undefined;
}

// ✅ Zod schemas for Slack types
export const SlackContextSchema = z.object({
  userId: z.string(),
  channelId: z.string(),
  teamId: z.string(),
  threadTs: z.string().optional(),
  isDirectMessage: z.boolean(),
  userName: z.string().optional(),
  userEmail: z.string().email().optional()
});

export const SlackEventTypeSchema = z.enum(['app_mention', 'message', 'slash_command', 'interactive_component']);

export const SlackMessageEventSchema = z.object({
  type: z.literal('message'),
  channel: z.string(),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  thread_ts: z.string().optional(),
  channel_type: z.string().optional()
});

export const SlackAppMentionEventSchema = z.object({
  type: z.literal('app_mention'),
  channel: z.string(),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  thread_ts: z.string().optional()
});

export const SlackSlashCommandPayloadSchema = z.object({
  token: z.string(),
  team_id: z.string(),
  team_domain: z.string(),
  channel_id: z.string(),
  channel_name: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  command: z.string(),
  text: z.string(),
  response_url: z.string(),
  trigger_id: z.string()
});

export const SlackInteractiveComponentPayloadSchema = z.object({
  type: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string()
  }),
  api_app_id: z.string(),
  token: z.string(),
  container: z.object({
    type: z.string(),
    message_ts: z.string(),
    channel_id: z.string(),
    is_ephemeral: z.boolean()
  }),
  trigger_id: z.string(),
  team: z.object({
    id: z.string(),
    domain: z.string()
  }),
  enterprise: z.any().optional(),
  is_enterprise_install: z.boolean(),
  channel: z.object({
    id: z.string(),
    name: z.string()
  }),
  response_url: z.string(),
  actions: z.array(z.object({
    action_id: z.string(),
    block_id: z.string(),
    text: z.object({
      type: z.string(),
      text: z.string(),
      emoji: z.boolean().optional()
    }),
    value: z.string(),
    type: z.string(),
    action_ts: z.string()
  }))
});

// Union type for all Slack events
export const SlackEventSchema = z.union([
  SlackMessageEventSchema,
  SlackAppMentionEventSchema,
  SlackSlashCommandPayloadSchema,
  SlackInteractiveComponentPayloadSchema
]);

// Type inference from schemas
export type SlackEventType = z.infer<typeof SlackEventTypeSchema>;
export type SlackMessageEvent = z.infer<typeof SlackMessageEventSchema>;
export type SlackAppMentionEvent = z.infer<typeof SlackAppMentionEventSchema>;
export type SlackSlashCommandPayload = z.infer<typeof SlackSlashCommandPayloadSchema>;
export type SlackInteractiveComponentPayload = z.infer<typeof SlackInteractiveComponentPayloadSchema>;
export type SlackEvent = z.infer<typeof SlackEventSchema>;

/**
 * Slack Block Kit elements - flexible interface for various block types
 */
export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'actions' | 'context' | 'image' | string;
  text?: {
    type: 'mrkdwn' | 'plain_text' | string;
    text: string | any;
  } | string; // Allow string for simple text
  fields?: Array<{
    type: 'mrkdwn' | 'plain_text';
    text: string;
  }>;
  elements?: Array<SlackElement | {
    type: string;
    text?: {
      type: 'mrkdwn' | 'plain_text' | string;
      text: string;
      emoji?: boolean;
    } | string;
    value?: string;
    action_id?: string;
    style?: string;
    [key: string]: any; // Allow additional properties
  }>;
  accessory?: SlackElement;
  block_id?: string;
  [key: string]: any; // Allow additional properties for extensibility
}

/**
 * Slack Block Kit elements - flexible interface
 */
export interface SlackElement {
  type: 'button' | 'static_select' | 'multi_static_select' | 'datepicker' | 'timepicker' | 'image' | 'plain_text_input' | string;
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
  } | string; // Allow string for simple text
  action_id?: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger' | string;
  confirm?: {
    title: { type: 'plain_text'; text: string };
    text: { type: 'mrkdwn' | 'plain_text'; text: string };
    confirm: { type: 'plain_text'; text: string };
    deny: { type: 'plain_text'; text: string };
  };
  [key: string]: any; // Allow additional properties
}

/**
 * Slack Say function interface
 */
export interface SlackSayFunction {
  (message: string | SlackMessage): Promise<void>;
}

/**
 * Slack message payload
 */
export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: any[];
  thread_ts?: string;
  replace_original?: boolean;
  response_type?: 'in_channel' | 'ephemeral';
}

/**
 * Slack respond function interface
 */
export interface SlackRespondFunction {
  (message: string | SlackMessage): Promise<void>;
}

/**
 * Slack client interface (subset of WebClient)
 */
export interface SlackClientInterface {
  chat: {
    postMessage: (options: any) => Promise<any>;
    update: (options: any) => Promise<any>;
    delete: (options: any) => Promise<any>;
  };
  users: {
    info: (options: { user: string }) => Promise<any>;
  };
  oauth: {
    v2: {
      access: (options: any) => Promise<any>;
    };
  };
}

/**
 * Slack handlers interface
 */
export interface SlackHandlers {
  commandInfo?: {
    triggerId?: string;
    responseUrl?: string;
  };
}

/**
 * Formatted Slack response
 */
export interface SlackResponse {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: any[];
  response_type?: 'in_channel' | 'ephemeral';
  replace_original?: boolean;
  success?: boolean;
  message?: string;
  error?: string;
  requiresOAuth?: boolean;
  oauthUrl?: string;
  data?: any;
}

/**
 * Slack workspace configuration
 */
export interface SlackWorkspace {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  installed: boolean;
  installedBy: string;
  installedAt: Date;
  scopes: string[];
}

/**
 * Slack user mapping to our system
 */
export interface SlackUser {
  slackUserId: string;
  slackUserName: string;
  slackEmail?: string;
  teamId: string;
  googleUserId?: string; // Link to our Google-authenticated user
  isActive: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}

/**
 * Slack conversation state
 */
export interface SlackConversationState {
  userId: string;
  channelId: string;
  threadTs?: string;
  context: any; // Agent conversation context
  lastMessageTs: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Slack agent request payload
 */
export interface SlackAgentRequest {
  message: string;
  context: SlackContext;
  eventType: SlackEventType;
  metadata: {
    timestamp: string;
    eventId?: string;
    triggerId?: string;
    responseUrl?: string;
  };
}

/**
 * Slack agent response
 */
export interface SlackAgentResponse {
  success: boolean;
  response: SlackResponse;
  error?: string;
  shouldRespond?: boolean;
  followUpActions?: Array<{
    type: 'schedule_message' | 'update_message' | 'send_dm';
    payload: any;
    delayMs?: number;
  }>;
  executionMetadata?: {
    processingTime: number;
    toolResults: Array<{
      toolName: string;
      success: boolean;
      executionTime: number;
      error?: string;
      result?: any;
    }>;
    confirmationFlows?: Array<any>;
    masterAgentResponse?: string;
    error?: string;
    errorType?: string;
    errorContext?: any;
  };
}

/**
 * Slack service configuration
 */
export interface SlackServiceConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  port?: number;
  development?: boolean;
}

/**
 * Slack middleware context extensions
 */
export interface SlackMiddlewareArgs {
  client: WebClient;
  context: SlackContext;
  logger: any;
}

export type SlackEventHandler<T = SlackEventMiddlewareArgs> = (args: T) => Promise<void>;