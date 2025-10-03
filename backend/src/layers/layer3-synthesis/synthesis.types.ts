/**
 * Layer 3: Synthesis Types
 *
 * Defines the types for synthesis input and output
 */

import { ExecutionGraph } from '../layer1-decomposition/execution-graph.types';
import { ExecutionResults } from '../layer2-execution/execution.types';

/**
 * Input to Layer 3 synthesis
 */
export interface SynthesisInput {
  original_query: string;
  execution_graph: ExecutionGraph;
  execution_results: ExecutionResults;
  user_preferences: UserPreferences;
  resource_usage: ResourceUsage;
}

export interface UserPreferences {
  tone?: 'professional' | 'casual' | 'concise';
  format_preference?: 'bullets' | 'prose' | 'mixed';
  verbosity?: 'brief' | 'detailed';
}

export interface ResourceUsage {
  total_tokens: number;
  total_llm_calls: number;
  total_time_seconds: number;
  total_cost_usd: number;
  nodes_executed: number;
  nodes_failed: number;
}

/**
 * Output from Layer 3 synthesis
 */
export interface SynthesisResult {
  message: string;
  metadata: SynthesisMetadata;
}

export interface SynthesisMetadata {
  tokens_used: number;
  findings_count: number;
  synthesis_time_ms?: number;
}

/**
 * Formatted findings for synthesis prompt
 */
export interface StructuredFindings {
  information_gathered: Array<{
    node_id: string;
    node_description?: string;
    summary: string;
    key_findings?: unknown[];
    item_count?: number;
  }>;
}
