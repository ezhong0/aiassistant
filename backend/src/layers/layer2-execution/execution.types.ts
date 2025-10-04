/**
 * Layer 2: Execution Types
 *
 * Defines the types for strategy execution and results
 */

import { InformationNode } from '../layer1-decomposition/execution-graph.types';

export type InformationNodeType =
  | 'metadata_filter'
  | 'keyword_search'
  | 'batch_thread_read'
  | 'cross_reference'
  | 'semantic_analysis';

// Re-export for convenience
export type { InformationNode };

/**
 * Result from executing a single node
 */
export interface NodeResult {
  success: boolean;
  node_id: string;
  data?: NodeResultData;
  error?: string;
  tokens_used: number;
}

export interface NodeResultData {
  // Generic container for strategy-specific results
  summary?: string;
  items?: unknown[];
  count?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Complete results from Layer 2 execution
 */
export interface ExecutionResults {
  nodeResults: Map<string, NodeResult>;
}

/**
 * Base interface for all strategy executors
 */
export interface StrategyExecutor {
  readonly type: string;
  execute(params: Record<string, unknown>, userId: string): Promise<NodeResult>;
}

/**
 * Strategy-specific result types
 */

export interface MetadataFilterResult extends NodeResultData {
  count: number;
  items: Array<{
    id: string;
    from?: string;
    subject?: string;
    date?: string;
    snippet?: string;
  }>;
  metadata: {
    tokens_used: number;
    llm_calls: number;
  };
}

export interface BatchThreadResult extends NodeResultData {
  count: number;
  threads: ThreadSummary[];
  metadata: {
    tokens_used: number;
    llm_calls: number;
  };
}

export interface ThreadSummary {
  thread_id: string;
  last_sender?: {
    name: string;
    email: string;
    timestamp: string;
    user_is_recipient: boolean;
  };
  question_or_request?: {
    present: boolean;
    type: 'question' | 'approval' | 'action_request' | 'none';
    specific_ask: string | null;
  };
  waiting_indicators?: {
    present: boolean;
    phrases_found: string[];
    follow_up_count: number;
  };
  response_timeline?: {
    user_last_responded_date: string | null;
    days_since_user_responded: number | null;
    days_sender_waiting: number | null;
  };
  urgency_signals?: {
    level: 'high' | 'medium' | 'low' | 'none';
    evidence: string[];
    deadline_mentioned: string | null;
  };
  context: string;
  tokens_used?: number;
}

export interface CrossReferenceResult extends NodeResultData {
  operation_summary: {
    total_input_items: number;
    items_after_filtering: number;
    operation_type: string;
    top_n_selected: number;
  };
  ranked_results: Array<{
    item_id: string;
    rank: number;
    score: number | string;
    included_sources: string[];
    ranking_reason: string;
  }>;
  excluded_items?: {
    count: number;
    reason: string;
  };
  metadata: {
    tokens_used: number;
    llm_calls: number;
  };
}

export interface SemanticAnalysisResult extends NodeResultData {
  analysis_summary: {
    total_items_analyzed: number;
    items_with_questions: number;
    items_with_requests: number;
    items_informational_only: number;
  };
  item_results: Array<{
    item_id: string;
    intent_classification: 'question' | 'request' | 'statement' | 'mixed';
    directed_at_user: boolean;
    urgency_level: 'high' | 'medium' | 'low';
    key_phrases: string[];
    reasoning: string;
  }>;
  metadata: {
    tokens_used: number;
    llm_calls: number;
  };
}

/**
 * Strategy parameter types
 */

export interface MetadataFilterParams {
  filters: string[];
  max_results: number;
  time_range: string;
  domain: 'email' | 'calendar';
}

export interface KeywordSearchParams {
  patterns: string[];
  max_results: number;
  time_range: string;
  domain: 'email' | 'calendar';
}

export interface BatchThreadParams {
  thread_ids: string[];
  extract_fields: string[];
  batch_size: number;
}

export interface CrossReferenceParams {
  sources: string[]; // Node IDs to combine
  operation: 'intersection' | 'union' | 'custom';
  rank_by: string;
  take_top: number;
}

export interface SemanticAnalysisParams {
  items: Array<{
    item_id: string;
    snippet: string;
    metadata?: Record<string, unknown>;
  }>;
  analysis_task: string;
  batch_size: number;
}
