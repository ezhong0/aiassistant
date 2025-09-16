/**
 * Slack Event Definitions
 * Focused type definitions for Slack event handling
 */

import { SlackEvent, SlackEventType, SlackSlashCommandPayload } from '../types/slack.types';

/**
 * Slack event processing result
 */
export interface SlackEventProcessingResult {
  success: boolean;
  eventId: string;
  eventType: SlackEventType;
  userId: string;
  channelId: string;
  teamId: string;
  processedAt: number;
  error?: string;
}

/**
 * Slack event validation result
 */
export interface SlackEventValidationResult {
  isValid: boolean;
  event?: SlackEvent;
  error?: string;
  eventId?: string;
}

/**
 * Slack event deduplication data
 */
export interface SlackEventDeduplicationData {
  eventId: string;
  timestamp: number;
  ttl: number;
}

/**
 * Slack event handler configuration
 */
export interface SlackEventHandlerConfig {
  enableDeduplication: boolean;
  deduplicationTTL: number; // in milliseconds
  enableBotMessageFiltering: boolean;
  enableDMOnlyMode: boolean;
}

/**
 * Slack event context creation data
 */
export interface SlackEventContextData {
  userId: string;
  channelId: string;
  teamId: string;
  threadTs?: string;
  isDirectMessage: boolean;
  eventType: SlackEventType;
  timestamp: string;
}

/**
 * Slack event processing metadata
 */
export interface SlackEventMetadata {
  eventId: string;
  processingStartTime: number;
  processingEndTime?: number;
  processingDuration?: number;
  retryCount: number;
  maxRetries: number;
}
