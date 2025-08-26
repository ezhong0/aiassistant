/**
 * Comprehensive TypeScript interfaces for Assistant API requests and responses
 */

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

export interface SessionDeleteResponse extends BaseApiResponse {
  data: {
    sessionId: string;
    deletedAt: string;
    conversationCount: number;
    toolExecutionCount: number;
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
// Union Types for API Responses
// ============================================================================

export type AssistantApiResponse = 
  | TextCommandResponse
  | ConfirmationRequiredResponse
  | ConfirmActionResponse
  | SessionDataResponse
  | SessionDeleteResponse
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