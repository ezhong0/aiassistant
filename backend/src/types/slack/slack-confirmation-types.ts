/**
 * Slack Confirmation Types and Definitions
 * Focused type definitions for Slack confirmation handling
 */

import { ToolResult } from '../tools';

/**
 * Slack confirmation request data
 */
export interface SlackConfirmationRequest {
  sessionId: string;
  userId: string;
  channelId: string;
  teamId: string;
  message: string;
  originalToolResults: ToolResult[];
  userMessage: string;
}

/**
 * Slack confirmation response data
 */
export interface SlackConfirmationResponse {
  sessionId: string;
  userId: string;
  channelId: string;
  teamId: string;
  message: string;
  isConfirmation: boolean;
  isRejection: boolean;
  confidence: number;
  reasoning?: string;
}

/**
 * Slack confirmation detection result
 */
export interface SlackConfirmationDetectionResult {
  isConfirmation: boolean;
  isRejection: boolean;
  confidence: number;
  reasoning: string;
  classification: 'confirm' | 'reject' | 'unclear' | 'none';
}

/**
 * Slack confirmation proposal data
 */
export interface SlackConfirmationProposal {
  text: string;
  actionType: string;
  confidence: number;
  requiresConfirmation: boolean;
  originalToolCalls: any[];
  sessionId: string;
  userId: string;
  channelId: string;
  teamId: string;
}

/**
 * Slack confirmation pending action data
 */
export interface SlackConfirmationPendingAction {
  sessionId: string;
  userId: string;
  channelId: string;
  teamId: string;
  toolResults: ToolResult[];
  userMessage: string;
  createdAt: number;
  expiresAt: number;
  confirmationId: string;
}

/**
 * Slack confirmation handler configuration
 */
export interface SlackConfirmationHandlerConfig {
  confirmationTimeout: number; // in milliseconds
  maxPendingConfirmations: number;
  enableProposalParsing: boolean;
  enableAIClassification: boolean;
}

/**
 * Slack confirmation message formatting data
 */
export interface SlackConfirmationMessageData {
  previewResults: ToolResult[];
  sessionId: string;
  userMessage: string;
  channelId: string;
  requiresConfirmation: boolean;
  actionType: string;
  confidence: number;
}
