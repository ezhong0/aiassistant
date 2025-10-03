/**
 * Orchestrator Types
 *
 * Types for the main orchestrator that coordinates all 3 layers
 */

import { ConversationMessage } from './layer1-decomposition/execution-graph.types';

/**
 * Input to orchestrator (same as current MasterAgent)
 */
export interface OrchestratorInput {
  userInput: string;
  userId: string;
  conversationHistory: ConversationMessage[];
  previousState?: OrchestratorState;
}

/**
 * State maintained by orchestrator (for multi-turn interactions)
 */
export interface OrchestratorState {
  executionGraph?: unknown;
  executionResults?: unknown;
  awaiting_confirmation?: boolean;
  last_query?: string;
}

/**
 * Output from orchestrator (same as current MasterAgent ProcessingResult)
 */
export interface OrchestratorResult {
  message: string;
  success: boolean;
  masterState?: OrchestratorState;
  subAgentStates?: unknown;
  metadata?: OrchestratorMetadata;
}

export interface OrchestratorMetadata {
  processingTime?: number;
  workflowId?: string;
  totalSteps?: number;
  workflowAction?: string;
  tokensUsed?: number;
  layers?: {
    layer1_tokens: number;
    layer1_time_ms: number;
    layer2_tokens: number;
    layer2_time_ms: number;
    layer2_stages: number;
    layer3_tokens: number;
    layer3_time_ms: number;
  };
}
