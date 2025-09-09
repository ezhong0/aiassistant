import { ToolCall, ToolResult, ToolExecutionContext } from './tools';
import { AIAgent } from '../framework/ai-agent';

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
 * Tool metadata used by AgentFactory
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
  
  /** Agent class constructor (for AIAgent framework) */
  agentClass?: new () => AIAgent<any, any>;
}

