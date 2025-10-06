/**
 * Layer 1: Query Decomposition Types
 *
 * Defines the execution graph structure that Layer 1 produces
 * and Layer 2 consumes.
 */

/**
 * Input to Layer 1 decomposition
 */
export interface DecompositionInput {
  user_query: string;
  conversation_history: ConversationMessage[];
  user_context: UserContext;
  current_timestamp: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number | string;
}

export interface UserContext {
  email_accounts?: Array<{
    id: string;
    email: string;
    primary?: boolean;
  }>;
  calendars?: Array<{
    id: string;
    name: string;
    primary?: boolean;
  }>;
  timezone?: string;
}

/**
 * Complete execution graph output from Layer 1
 */
export interface ExecutionGraph {
  query_classification: QueryClassification;
  information_needs: InformationNode[];
  synthesis_instructions: SynthesisInstructions;
  resource_estimate: ResourceEstimate;
}

export interface QueryClassification {
  type: 'direct' | 'filtered_search' | 'investigative' | 'cross_domain' | 'write_command';
  complexity: 'simple' | 'moderate' | 'complex';
  domains: Array<'email' | 'calendar'>;
  reasoning: string;
}

/**
 * A node in the execution DAG
 */
export interface InformationNode {
  id: string;
  description: string;
  type: InformationNodeType;
  strategy: NodeStrategy;
  depends_on: string[];
  parallel_group: number;
  expected_cost: ExpectedCost;
  importance?: NodeImportance; // Optional: defaults to IMPORTANT for backward compatibility
}

export type InformationNodeType =
  | 'metadata_filter'
  | 'keyword_search'
  | 'urgency_detector'
  | 'sender_classifier'
  | 'action_detector'
  | 'batch_thread_read'
  | 'cross_reference'
  | 'semantic_analysis';

/**
 * Node importance level for execution mode handling
 *
 * - critical: Must succeed or entire query fails (fail-fast)
 * - important: Should succeed, graceful degradation possible
 * - optional: Nice to have, silent failure acceptable
 */
export enum NodeImportance {
  CRITICAL = 'critical',
  IMPORTANT = 'important',
  OPTIONAL = 'optional'
}

export interface NodeStrategy {
  method: string;
  params: Record<string, unknown>;
}

export interface ExpectedCost {
  tokens: number;
  llm_calls: number;
  time_seconds: number;
}

export interface SynthesisInstructions {
  task: string;
  ranking_criteria: string;
  presentation_format: string;
  user_preferences: string;
}

export interface ResourceEstimate {
  total_items_accessed: number;
  total_llm_calls: number;
  estimated_tokens: number;
  estimated_time_seconds: number;
  estimated_cost_usd: number;
  user_should_confirm: boolean;
}
