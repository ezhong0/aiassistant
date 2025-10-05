/**
 * Comprehensive TypeScript interfaces for Assistant API requests and responses
 */

import { z } from 'zod';

// ============================================================================
// Base API Types
// ============================================================================

export interface BaseApiResponse {
  success: boolean;
  type: 'response' | 'action_completed' | 'partial_success' | 'error' | 
        'confirmation_required' | 'auth_required' | 'session_data';
  message: string;
  data?: unknown;
  error?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string[];
  timestamp?: string;
}

export interface PaginationRequest {
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
  sortBy?: string;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// Standardized API Response Types with Zod Validation
// ============================================================================

// ✅ Core API response schemas with Zod validation
export const ResponseMetadataSchema = z.object({
  timestamp: z.string(),
  requestId: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  executionTime: z.number().optional(),
  version: z.string().optional(),
}).catchall(z.unknown()); // Allow additional metadata fields

export const StandardAPIResponseSchema = z.object({
  success: z.boolean(),
  type: z.enum(['response', 'action_completed', 'confirmation_required', 'error', 'session_data', 'partial_success']),
  message: z.string(),
  data: z.unknown().optional(), // Better than z.any() - requires type checking
  error: z.string().optional(),
  metadata: ResponseMetadataSchema,
});

export const ErrorDetailsSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(), // Better than z.any()
  stack: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
});

export const PaginationMetadataSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// ✅ Export inferred types
export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;
export type StandardAPIResponse<T = unknown> = z.infer<typeof StandardAPIResponseSchema> & {
  data?: T;
};
export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;

// ✅ Validation helpers
export function validateStandardAPIResponse(data: unknown): StandardAPIResponse {
  return StandardAPIResponseSchema.parse(data);
}

export function validateResponseMetadata(data: unknown): ResponseMetadata {
  return ResponseMetadataSchema.parse(data);
}

export function safeParseStandardAPIResponse(data: unknown): { success: true; data: StandardAPIResponse } | { success: false; error: z.ZodError } {
  const result = StandardAPIResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============================================================================
// Text Command Endpoint Types
// ============================================================================

export interface ConversationHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface PendingAction {
  actionId: string;
  type: string;
  parameters: Record<string, unknown>;
  awaitingConfirmation?: boolean;
}

export interface UserPreferences {
  language?: string;
  timezone?: string;
  verbosity?: 'minimal' | 'normal' | 'detailed';
}

export interface TextCommandContext {
  conversationHistory?: ConversationHistoryEntry[];
  pendingActions?: PendingAction[];
  userPreferences?: UserPreferences;
}

export interface TextCommandRequest {
  command: string;
  sessionId?: string;
  context?: TextCommandContext;
}

export interface ToolExecutionStats {
  total: number;
  successful: number;
  failed: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
}

export interface ToolCallInfo {
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResultInfo {
  toolName: string;
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

export interface ConversationContext {
  conversationHistory: ConversationHistoryEntry[];
  lastActivity: string;
}

export interface TextCommandResponseData {
  response?: string;
  toolCalls: ToolCallInfo[];
  toolResults: ToolResultInfo[];
  sessionId: string;
  conversationContext: ConversationContext;
  executionStats?: ToolExecutionStats;
  results?: Array<{
    tool: string;
    message?: string;
    data?: unknown;
    executionTime?: number;
  }>;
  errors?: Array<{
    tool: string;
    error: string;
    executionTime?: number;
  }>;
}

export interface TextCommandResponse extends BaseApiResponse {
  data: TextCommandResponseData;
}

// ============================================================================
// Action Confirmation Types
// ============================================================================

export interface ConfirmationRequiredData {
  pendingAction: PendingAction;
  confirmationPrompt: string;
  sessionId: string;
  conversationContext: ConversationContext;
}

export interface ConfirmationRequiredResponse extends BaseApiResponse {
  type: 'confirmation_required';
  data: ConfirmationRequiredData;
}

export interface ConfirmActionRequest {
  actionId: string;
  confirmed: boolean;
  sessionId?: string;
  parameters?: Record<string, unknown>;
}

export interface ConfirmActionResponseData {
  actionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: unknown;
  sessionId?: string;
}

export interface ConfirmActionResponse extends BaseApiResponse {
  data: ConfirmActionResponseData;
}

// ============================================================================
// Session Management Types
// ============================================================================

export interface SessionInfo {
  sessionId: string;
  userId?: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  isActive: boolean;
}

export interface FormattedConversationEntry {
  timestamp: string;
  userInput: string;
  agentResponse: string;
  toolsUsed: string[];
  success: boolean;
}

export interface FormattedToolResult {
  toolName: string;
  success: boolean;
  timestamp: string;
  executionTime?: number;
  error?: string;
}

export interface SessionStatistics {
  sessionId: string;
  userId?: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  conversationCount: number;
  toolExecutionCount: number;
  toolUsage: Record<string, number>;
  minutesActive: number;
}

export interface SessionDataResponse extends BaseApiResponse {
  type: 'session_data';
  data: {
    session: SessionInfo;
    conversationHistory: FormattedConversationEntry[];
    recentToolResults: FormattedToolResult[];
    statistics: SessionStatistics;
  };
}


// ============================================================================
// Email Agent Types
// ============================================================================

export interface EmailSendRequest {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface EmailSearchRequest {
  q: string;
  maxResults?: number;
}

export interface EmailOperationResponse extends BaseApiResponse {
  data?: {
    messageId?: string;
    threadId?: string;
    emails?: unknown[];
    searchQuery?: string;
    resultCount?: number;
  };
  executionTime?: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckMemory {
  used: number;
  total: number;
  rss: number;
  external: number;
}

export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck?: string;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  memory: HealthCheckMemory;
  services: {
    database?: ServiceStatus;
    masterAgent: ServiceStatus;
    toolExecutor: ServiceStatus;
    emailAgent: ServiceStatus;
    sessionService: ServiceStatus;
  };
  rateLimiting: {
    totalEntries: number;
    memoryUsage: number;
  };
  nodeVersion: string;
  pid: number;
}

// ============================================================================
// Authentication Required Types
// ============================================================================

export interface AuthRequiredResponse extends BaseApiResponse {
  type: 'auth_required';
  error: 'GOOGLE_AUTH_REQUIRED';
  data: {
    requiredScopes: string[];
    redirectUrl: string;
  };
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ValidationErrorResponse extends BaseApiResponse {
  success: false;
  error: 'VALIDATION_ERROR';
  data: {
    details: string[];
  };
}

export interface RateLimitErrorResponse extends BaseApiResponse {
  success: false;
  error: 'RATE_LIMITED';
  data: {
    retryAfter: number;
    windowMs: number;
    maxRequests: number;
  };
}

export interface SessionErrorResponse extends BaseApiResponse {
  success: false;
  type: 'error';
  error: 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SESSION_ACCESS_DENIED' | 
         'SESSION_RETRIEVAL_ERROR' | 'SESSION_DELETION_ERROR' | 'SESSION_DELETION_FAILED';
}

export interface InternalErrorResponse extends BaseApiResponse {
  success: false;
  type: 'error';
  error: 'INTERNAL_ERROR';
  data: {
    sessionId?: string;
    timestamp: string;
  };
}

// ============================================================================
// Request Parameter Types
// ============================================================================

export interface SessionIdParams {
  id: string;
}

export interface ApiRequestHeaders {
  'Authorization'?: string;
  'Content-Type'?: string;
  'User-Agent'?: string;
  'X-Forwarded-For'?: string;
}

// ============================================================================
// Action Preview Types
// ============================================================================

export interface ActionRiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  warnings?: string[] | undefined;
}

export interface EmailPreviewData extends Record<string, unknown> {
  recipients: {
    to: string[];
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
  };
  subject: string;
  contentSummary: string;
  attachmentCount?: number | undefined;
  totalAttachmentSize?: number | undefined;
  sendTimeEstimate?: string | undefined;
  externalDomains?: string[] | undefined;
  recipientCount: number;
}

export interface CalendarPreviewData extends Record<string, unknown> {
  title: string;
  startTime: string;
  endTime: string;
  duration: string;
  attendees?: string[] | undefined;
  conflicts?: Array<{
    conflictType: 'time_overlap' | 'busy_attendee' | 'resource_conflict';
    details: string;
    severity: 'low' | 'medium' | 'high';
  }> | undefined;
  location?: string | undefined;
  timeZone?: string | undefined;
  attendeeCount?: number | undefined;
}

export interface ActionPreview {
  actionId: string;
  actionType: 'email' | 'calendar' | 'contact';
  title: string;
  description: string;
  riskAssessment: ActionRiskAssessment;
  estimatedExecutionTime?: string;
  reversible: boolean;
  requiresConfirmation: boolean;
  awaitingConfirmation: boolean;
  previewData: EmailPreviewData | CalendarPreviewData | Record<string, unknown>;
  originalQuery: string;
  parameters: Record<string, unknown>;
}

export interface PreviewGenerationResult {
  success: boolean;
  error?: string;
  fallbackMessage?: string;
  authRequired?: boolean;
  authReason?: string;
  preview?: ActionPreview;
}

// ============================================================================
// Enhanced Confirmation Types
// ============================================================================

export interface EnhancedConfirmationData extends ConfirmationRequiredData {
  toolResults: ToolResultInfo[];
}

export interface EnhancedConfirmationResponse extends BaseApiResponse {
  type: 'confirmation_required';
  data: EnhancedConfirmationData;
}

// ============================================================================
// Union Types for API Responses
// ============================================================================

export type AssistantApiResponse = 
  | TextCommandResponse
  | ConfirmationRequiredResponse
  | EnhancedConfirmationResponse
  | ConfirmActionResponse
  | SessionDataResponse
  
  | EmailOperationResponse
  | AuthRequiredResponse
  | ValidationErrorResponse
  | RateLimitErrorResponse
  | SessionErrorResponse
  | InternalErrorResponse;

// ============================================================================
// Request Body Types
// ============================================================================

export type AssistantApiRequestBody = 
  | TextCommandRequest
  | ConfirmActionRequest
  | EmailSendRequest
  | EmailSearchRequest;

// ============================================================================
// Utility Types
// ============================================================================

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requiresAuth: boolean;
  rateLimit?: string;
  requestType?: string;
  responseType: string;
}

export interface ApiDocumentation {
  title: string;
  version: string;
  baseUrl: string;
  description: string;
  endpoints: ApiEndpoint[];
  authentication: {
    type: string;
    description: string;
  };
  errorCodes: Array<{
    code: string;
    description: string;
    httpStatus: number;
  }>;
}

// ============================================================================
// Specialized Response Types for Different Operations
// ============================================================================

/** Authentication response */
export interface AuthenticationResponse extends StandardAPIResponse {
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
    tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };
    jwt: string;
  };
}

/** Assistant operation response */
export interface AssistantResponse extends StandardAPIResponse {
  data?: {
    sessionId: string;
    toolResults?: unknown[];
    pendingActions?: unknown[];
    conversationContext?: unknown;
    executionStats?: {
      successful: number;
      failed: number;
      total: number;
    };
  };
}

/** Session data response */
export interface SessionResponse extends StandardAPIResponse {
  data?: {
    session: {
      sessionId: string;
      userId: string;
      createdAt: string;
      lastActivity: string;
      expiresAt: string;
      isActive: boolean;
    };
    conversationHistory: unknown[];
    recentToolResults: unknown[];
    statistics: unknown;
  };
}

/** Email operation response */
export interface EmailResponse extends StandardAPIResponse {
  data?: {
    emailId?: string;
    threadId?: string;
    emails?: unknown[];
    count?: number;
    draft?: unknown;
  };
}

/** Contact search response */
export interface ContactResponse extends StandardAPIResponse {
  data?: {
    contacts: unknown[];
    totalCount: number;
    pagination?: PaginationMetadata;
  };
}

/** Health check response */
export interface HealthResponse extends StandardAPIResponse {
  data?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'operational' | 'degraded' | 'down'>;
    uptime: number;
    version: string;
  };
}

// ============================================================================
// Response Builder Utilities
// ============================================================================

export class ResponseBuilder {
  /**
   * Create a successful response
   */
  static success<T>(
    message: string,
    data?: T,
    type: StandardAPIResponse['type'] = 'response',
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type,
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    errorCode: string,
    statusCode: number = 500,
    details?: unknown,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse {
    return {
      success: false,
      type: 'error',
      message,
      error: errorCode,
      data: details ? { error: details } : undefined,
      metadata: {
        timestamp: new Date().toISOString(),
        statusCode,
        ...metadata
      }
    };
  }

  /**
   * Create a confirmation required response
   */
  static confirmationRequired<T>(
    message: string,
    data: T,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type: 'confirmation_required',
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create an action completed response
   */
  static actionCompleted<T>(
    message: string,
    data?: T,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type: 'action_completed',
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create a partial success response
   */
  static partialSuccess<T>(
    message: string,
    data?: T,
    metadata: Partial<ResponseMetadata> = {}
  ): StandardAPIResponse<T> {
    return {
      success: true,
      type: 'partial_success',
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Add standard metadata to response
   */
  static withMetadata<T>(
    response: StandardAPIResponse<T>,
    additionalMetadata: Partial<ResponseMetadata>
  ): StandardAPIResponse<T> {
    return {
      ...response,
      metadata: {
        ...response.metadata,
        ...additionalMetadata
      }
    };
  }

  /**
   * Add execution timing to response
   */
  static withTiming<T>(
    response: StandardAPIResponse<T>,
    startTime: number
  ): StandardAPIResponse<T> {
    const executionTime = Date.now() - startTime;
    return this.withMetadata(response, { executionTime });
  }

  /**
   * Add pagination to response
   */
  static withPagination<T>(
    response: StandardAPIResponse<T>,
    pagination: PaginationMetadata
  ): StandardAPIResponse<T> {
    return this.withMetadata(response, { pagination });
  }
}

// ============================================================================
// Common HTTP Status Codes and Error Codes
// ============================================================================

/**
 * Common HTTP status codes for responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * Common error codes
 */
export const ERROR_CODES = {
  // Authentication errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // Operation errors
  OPERATION_FAILED: 'OPERATION_FAILED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// ============================================================================
// Express Request Extensions
// ============================================================================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
      startTime?: number;
      requestId?: string;
    }
  }
}