/**
 * API validation schemas
 */

import { z } from 'zod';

// Tool execution schemas
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.string(),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

// ToolExecutionResultSchema removed - use ToolResultSchema from tool-execution.ts

// Agent parameter schemas
export const AgentParameterSchema = z.object({
  operation: z.string(),
  parameters: z.record(z.any()),
  context: z.record(z.any()),
});

// Master agent schemas
export const MasterAgentRequestSchema = z.object({
  message: z.string(),
  context: z.record(z.any()),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

export const MasterAgentResponseSchema = z.object({
  message: z.string(),
  toolCalls: z.array(ToolCallSchema),
  needsThinking: z.boolean(),
  proposal: z.object({
    action: z.string(),
    parameters: z.record(z.any()),
    reasoning: z.string(),
  }).optional(),
  contextGathered: z.object({
    sources: z.array(z.string()),
    summary: z.string(),
  }).optional(),
});

// Proposal response schema
export const ProposalResponseSchema = z.object({
  action: z.string(),
  parameters: z.record(z.any()),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
});

// Context gathering result schema
export const ContextGatheringResultSchema = z.object({
  sources: z.array(z.string()),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  data: z.record(z.any()),
});

// Tool routing schemas
export const ToolRoutingDecisionSchema = z.object({
  selectedAgent: z.string(),
  toolCall: ToolCallSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  requiresConfirmation: z.boolean(),
  confirmationMessage: z.string().optional(),
  parameters: z.any(),
});

// API request/response schemas
export const APIRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  query: z.record(z.string()).optional(),
});

export const APIResponseSchema = z.object({
  statusCode: z.number(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
});

// Health check schema
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string(),
  services: z.record(z.object({
    status: z.enum(['up', 'down', 'degraded']),
    responseTime: z.number().optional(),
    lastCheck: z.string(),
  })),
  version: z.string(),
  uptime: z.number(),
});

// Audit event schema
export const AuditEventSchema = z.object({
  event: z.string(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  teamId: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

// Cache operation schema
export const CacheOperationSchema = z.object({
  operation: z.enum(['get', 'set', 'delete', 'clear']),
  key: z.string(),
  value: z.any().optional(),
  ttl: z.number().optional(),
  success: z.boolean(),
  executionTime: z.number(),
});

// Response validation schemas
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.any().optional(),
  metadata: z.object({
    timestamp: z.string(),
    requestId: z.string().optional(),
    sessionId: z.string().optional(),
    userId: z.string().optional(),
    executionTime: z.number().optional(),
    version: z.string().optional(),
  }).optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
  metadata: z.object({
    timestamp: z.string(),
    requestId: z.string().optional(),
    sessionId: z.string().optional(),
    userId: z.string().optional(),
    executionTime: z.number().optional(),
    version: z.string().optional(),
  }).optional(),
});

export const ProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      picture: z.string().optional(),
    }),
    metadata: z.object({
      lastAccess: z.string(),
      tokenValid: z.boolean(),
    }),
  }),
});

export const AdminUsersResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    users: z.array(z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      role: z.string(),
      lastLogin: z.string(),
    })),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
});
