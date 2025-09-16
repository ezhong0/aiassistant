/**
 * Slack Interface Types - Focused Type Definitions
 * Exports all focused Slack interface type definitions
 */

// Event handling types
export * from './slack-event-definitions';

// OAuth handling types
export * from './slack-oauth-types';

// Confirmation handling types
export * from './slack-confirmation-types';

// Message formatting types
export * from './slack-message-formatting-types';

// Context extraction types
export * from './slack-context-extraction-types';

// Re-export core Slack types for convenience
export type {
  SlackContext,
  SlackEventType,
  SlackAgentRequest,
  SlackAgentResponse,
  SlackEvent,
  SlackSayFunction,
  SlackMessage,
  SlackBlock,
  SlackRespondFunction,
  SlackHandlers,
  SlackSlashCommandPayload
} from '../slack/slack.types';
