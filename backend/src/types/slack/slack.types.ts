import { SlackEventMiddlewareArgs } from '@slack/bolt';
import { WebClient } from '@slack/web-api';

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

/**
 * Slack event types we handle
 */
export type SlackEventType = 'app_mention' | 'message' | 'slash_command' | 'interactive_component';

/**
 * Slack message event
 */
export interface SlackMessageEvent {
  type: 'message';
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  channel_type?: string;
}

/**
 * Slack app mention event
 */
export interface SlackAppMentionEvent {
  type: 'app_mention';
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

/**
 * Slack slash command payload
 */
export interface SlackSlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

/**
 * Slack interactive component payload
 */
export interface SlackInteractivePayload {
  type: string;
  user: {
    id: string;
    name: string;
  };
  channel: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    domain: string;
  };
  actions: Array<{
    action_id: string;
    value?: string;
    type: string;
  }>;
  trigger_id: string;
  response_url: string;
  message?: any;
}

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
 * Slack event union type
 */
export type SlackEvent = SlackMessageEvent | SlackAppMentionEvent | SlackSlashCommandPayload | SlackInteractivePayload;

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
