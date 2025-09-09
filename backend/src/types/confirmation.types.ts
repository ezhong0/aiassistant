/**
 * Enhanced confirmation system types for the AI Assistant
 * Builds on existing ActionPreview and PreviewGenerationResult from api.types.ts
 */

import { ActionPreview, PreviewGenerationResult } from './api.types';
import { ToolCall, ToolResult } from './tools';

// ============================================================================
// Confirmation Flow Management Types
// ============================================================================

export interface ConfirmationFlow {
  confirmationId: string;
  sessionId: string;
  userId?: string;
  actionPreview: ActionPreview;
  originalToolCall: ToolCall;
  status: ConfirmationStatus;
  createdAt: Date;
  expiresAt: Date;
  confirmedAt?: Date;
  executedAt?: Date;
  executionResult?: ToolResult;
  slackContext?: {
    teamId: string;
    channelId: string;
    userId: string;
    threadTs?: string;
    messageTs?: string;
    isDirectMessage: boolean;
  };
}

export enum ConfirmationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed', 
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  EXECUTED = 'executed',
  FAILED = 'failed'
}

export interface ConfirmationRequest {
  sessionId: string;
  userId?: string;
  toolCall: ToolCall;
  context: ConfirmationContext;
  expirationMinutes?: number; // Default: 30 minutes
}

export interface ConfirmationContext {
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  slackContext?: {
    teamId: string;
    channelId: string;
    userId: string;
    threadTs?: string;
    isDirectMessage: boolean;
  };
  userPreferences?: {
    autoConfirm?: boolean;
    confirmationTimeout?: number;
    riskTolerance?: 'low' | 'medium' | 'high';
  };
}

export interface ConfirmationResponse {
  confirmationId: string;
  confirmed: boolean;
  respondedAt: Date;
  userContext?: {
    slackUserId?: string;
    responseChannel?: string;
    responseThreadTs?: string;
  };
}

// ============================================================================
// Confirmation Service Interface
// ============================================================================

export interface IConfirmationService {
  /**
   * Create a new confirmation flow
   */
  createConfirmation(request: ConfirmationRequest): Promise<ConfirmationFlow>;

  /**
   * Get confirmation by ID
   */
  getConfirmation(confirmationId: string): Promise<ConfirmationFlow | null>;

  /**
   * Respond to a confirmation (confirm/reject)
   */
  respondToConfirmation(
    confirmationId: string, 
    response: ConfirmationResponse
  ): Promise<ConfirmationFlow>;

  /**
   * Execute a confirmed action
   */
  executeConfirmedAction(confirmationId: string): Promise<ToolResult>;

  /**
   * Clean up expired confirmations
   */
  cleanupExpiredConfirmations(): Promise<number>;

  /**
   * Get pending confirmations for a session
   */
  getPendingConfirmations(sessionId: string): Promise<ConfirmationFlow[]>;

  /**
   * Get confirmation statistics
   */
  getConfirmationStats(sessionId?: string): Promise<ConfirmationStats>;
}

export interface ConfirmationStats {
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
  expired: number;
  executed: number;
  failed: number;
  averageResponseTime?: number; // in seconds
  confirmationRate?: number; // percentage confirmed vs total
}

// ============================================================================
// Response Formatter Types
// ============================================================================

export interface SlackConfirmationMessage {
  text: string;
  blocks: Array<{
    type: string;
    [key: string]: any;
  }>;
  attachments?: Array<{
    color: string;
    blocks: Array<{
      type: string;
      [key: string]: any;
    }>;
  }>;
}

export interface SlackMessageFormatOptions {
  includeRiskAssessment?: boolean;
  includeExecutionTime?: boolean;
  showDetailedPreview?: boolean;
  useCompactFormat?: boolean;
  customActions?: Array<{
    name: string;
    text: string;
    type: 'button';
    value: string;
    style?: 'default' | 'primary' | 'danger';
  }>;
}

// ============================================================================
// Database Schema Types
// ============================================================================

export interface ConfirmationRecord {
  id: string;
  session_id: string;
  user_id?: string;
  action_preview: ActionPreview; // JSON column
  original_tool_call: ToolCall; // JSON column
  status: ConfirmationStatus;
  created_at: Date;
  expires_at: Date;
  confirmed_at?: Date;
  executed_at?: Date;
  execution_result?: ToolResult; // JSON column
  slack_context?: {
    team_id: string;
    channel_id: string;
    user_id: string;
    thread_ts?: string;
    message_ts?: string;
    is_direct_message: boolean;
  }; // JSON column
  response_context?: {
    slack_user_id?: string;
    response_channel?: string;
    response_thread_ts?: string;
  }; // JSON column
}

// ============================================================================
// Error Types
// ============================================================================

export class ConfirmationError extends Error {
  constructor(
    public code: ConfirmationErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ConfirmationError';
  }
}

export enum ConfirmationErrorCode {
  CONFIRMATION_NOT_FOUND = 'CONFIRMATION_NOT_FOUND',
  CONFIRMATION_EXPIRED = 'CONFIRMATION_EXPIRED',
  CONFIRMATION_ALREADY_RESPONDED = 'CONFIRMATION_ALREADY_RESPONDED',
  CONFIRMATION_EXECUTION_FAILED = 'CONFIRMATION_EXECUTION_FAILED',
  INVALID_CONFIRMATION_REQUEST = 'INVALID_CONFIRMATION_REQUEST',
  PREVIEW_GENERATION_FAILED = 'PREVIEW_GENERATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

// ============================================================================
// Integration Types
// ============================================================================

export interface ConfirmationFlowResult {
  success: boolean;
  confirmationFlow?: ConfirmationFlow;
  slackMessage?: SlackConfirmationMessage;
  error?: ConfirmationError;
  requiresManualFormat?: boolean; // Fallback when auto-formatting fails
  executionTime?: number;
}

export interface ExecutionResult {
  success: boolean;
  toolResult?: ToolResult;
  confirmationFlow: ConfirmationFlow;
  error?: ConfirmationError;
}

// ============================================================================
// Agent Integration Types
// ============================================================================

export interface ConfirmationCapableAgent {
  /**
   * Generate preview for an action (already implemented in EmailAgent)
   */
  generatePreview?(params: any, context: any): Promise<PreviewGenerationResult>;

  /**
   * Check if this agent's actions need confirmation
   */
  needsConfirmation?(params: any): boolean;

  /**
   * Execute action in confirmation mode (if different from normal execution)
   */
  executeWithConfirmation?(params: any, context: any, confirmationId: string): Promise<any>;
}