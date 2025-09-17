import { ToolCall, ToolResult, ToolExecutionContext } from '../tools';
import { AIAgent } from '../../framework/ai-agent';
import { z } from 'zod';

/**
 * Standard response interface for all agents with Zod validation
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

// ✅ Zod schemas for Agent types
export const StandardAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  error: z.string().optional(),
  metadata: z.object({
    agent: z.string(),
    operation: z.string().optional(),
    timestamp: z.string(),
    errorType: z.string().optional(),
    additionalData: z.record(z.any()).optional()
  }).optional()
});

export const ToolMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string())
  }),
  requiresConfirmation: z.boolean(),
  isCritical: z.boolean(),
  agentClass: z.any().optional() // Constructor function
});

export const AgentCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  operations: z.array(z.string()),
  requiresAuth: z.boolean(),
  requiresConfirmation: z.boolean(),
  isCritical: z.boolean(),
  examples: z.array(z.string()).optional()
});

// Type inference from schemas
export type ToolMetadata = z.infer<typeof ToolMetadataSchema>;
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;