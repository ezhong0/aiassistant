/**
 * Slack Message Formatting Types and Definitions
 * Focused type definitions for Slack message formatting
 */

import { SlackMessage, SlackBlock } from '../types/slack.types';
import { ToolResult } from '../types/tools';

/**
 * Slack message formatting options
 */
export interface SlackMessageFormattingOptions {
  maxLength: number;
  enableTruncation: boolean;
  enableMarkdown: boolean;
  enableEmojis: boolean;
  enableThreading: boolean;
  includeTimestamps: boolean;
}

/**
 * Slack message formatting result
 */
export interface SlackMessageFormattingResult {
  success: boolean;
  formattedMessage?: SlackMessage;
  blocks?: SlackBlock[];
  error?: string;
  truncated?: boolean;
  originalLength?: number;
  formattedLength?: number;
}

/**
 * Slack tool result formatting data
 */
export interface SlackToolResultFormattingData {
  toolResult: ToolResult;
  toolDisplayName: string;
  maxLength: number;
  includeMetadata: boolean;
}

/**
 * Slack help message data
 */
export interface SlackHelpMessageData {
  messageType: 'quick_help' | 'full_help' | 'slash_command_help' | 'welcome' | 'email_welcome';
  userId: string;
  channelId: string;
  isFirstTimeUser: boolean;
  hasOAuth: boolean;
}

/**
 * Slack message sending options
 */
export interface SlackMessageSendingOptions {
  channelId: string;
  message: SlackMessage;
  threadTs?: string;
  enableTypingIndicator: boolean;
  enableFallback: boolean;
  retryCount: number;
  maxRetries: number;
}

/**
 * Slack message sending result
 */
export interface SlackMessageSendingResult {
  success: boolean;
  messageTs?: string;
  error?: string;
  retryCount: number;
  sentAt: number;
}

/**
 * Slack message update options
 */
export interface SlackMessageUpdateOptions {
  channelId: string;
  messageTs: string;
  newMessage: SlackMessage;
  threadTs?: string;
}

/**
 * Slack message update result
 */
export interface SlackMessageUpdateResult {
  success: boolean;
  updatedAt: number;
  error?: string;
}

/**
 * Slack typing indicator options
 */
export interface SlackTypingIndicatorOptions {
  channelId: string;
  duration: number; // in milliseconds
  threadTs?: string;
}

/**
 * Slack message truncation options
 */
export interface SlackMessageTruncationOptions {
  maxLength: number;
  truncationSuffix: string;
  preserveFormatting: boolean;
  truncateAtWordBoundary: boolean;
}
