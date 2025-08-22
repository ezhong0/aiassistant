import { ToolCall, ToolResult, ToolExecutionContext } from './tools';
import { BaseAgent } from '../framework/base-agent';

/**
 * Legacy IAgent interface has been removed.
 * All agents now extend the modern BaseAgent framework.
 * 
 * @deprecated Use BaseAgent from '../framework/base-agent' instead
 */



/**
 * Standard response interface for all agents
 */
export interface StandardAgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  metadata?: {
    agent: string;
    operation?: string;
    timestamp: string;
    errorType?: string;
    [key: string]: any;
  };
}

/**
 * Tool metadata for registry
 */
export interface ToolMetadata {
  /** Tool name (matches agent name) */
  name: string;
  
  /** Description for OpenAI function definitions */
  description: string;
  
  /** OpenAI function parameters schema */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  
  /** Keywords for rule-based routing */
  keywords: string[];
  
  /** Whether this tool needs confirmation */
  requiresConfirmation: boolean;
  
  /** Whether this tool is critical */
  isCritical: boolean;
  
  /** Agent class constructor (for BaseAgent framework) */
  agentClass?: new () => BaseAgent<any, any>;
}

