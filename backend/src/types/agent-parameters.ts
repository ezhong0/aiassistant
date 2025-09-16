/**
 * Type definitions for agent parameters
 */

/**
 * Base interface for all tool parameters
 */
export interface BaseToolParameters {
  [key: string]: unknown;
}

/**
 * Think tool parameters
 */
export interface ThinkParameters extends BaseToolParameters {
  query: string;
  context?: string;
  analysisType?: 'verification' | 'planning' | 'analysis';
}

/**
 * Email tool parameters
 */
export interface EmailParameters extends BaseToolParameters {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  query?: string;
  operation?: 'send' | 'read' | 'search' | 'draft';
  accessToken?: string;
}

/**
 * Contact tool parameters
 */
export interface ContactParameters extends BaseToolParameters {
  query?: string;
  name?: string;
  email?: string;
  operation?: 'search' | 'create' | 'update';
  accessToken?: string;
}

/**
 * Calendar tool parameters
 */
export interface CalendarParameters extends BaseToolParameters {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string | string[];
  location?: string;
  query?: string;
  operation?: 'create' | 'read' | 'update' | 'delete' | 'search';
  accessToken?: string;
}

/**
 * Tool execution results
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime?: number;
  metadata?: Record<string, unknown>;
  // Agent-specific properties
  needsReauth?: boolean;
  analysis?: string;
  reasoning?: string;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Agent execution summary
 */
export interface AgentExecutionSummary {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalExecutionTime: number;
  errors: string[];
  warnings: string[];
}

/**
 * Tool parameter type union
 */
export type ToolParameters =
  | ThinkParameters
  | EmailParameters
  | ContactParameters
  | CalendarParameters
  | BaseToolParameters;

/**
 * Type guard for Think parameters
 */
export function isThinkParameters(params: unknown): params is ThinkParameters {
  return (
    typeof params === 'object' &&
    params !== null &&
    typeof (params as any).query === 'string'
  );
}

/**
 * Type guard for Email parameters
 */
export function isEmailParameters(params: unknown): params is EmailParameters {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;

  return (
    (p.to === undefined || typeof p.to === 'string' || Array.isArray(p.to)) &&
    (p.subject === undefined || typeof p.subject === 'string') &&
    (p.body === undefined || typeof p.body === 'string') &&
    (p.query === undefined || typeof p.query === 'string') &&
    (p.operation === undefined || ['send', 'read', 'search', 'draft'].includes(p.operation))
  );
}

/**
 * Type guard for Contact parameters
 */
export function isContactParameters(params: unknown): params is ContactParameters {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;

  return (
    (p.query === undefined || typeof p.query === 'string') &&
    (p.name === undefined || typeof p.name === 'string') &&
    (p.email === undefined || typeof p.email === 'string') &&
    (p.operation === undefined || ['search', 'create', 'update'].includes(p.operation))
  );
}

/**
 * Type guard for Calendar parameters
 */
export function isCalendarParameters(params: unknown): params is CalendarParameters {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as any;

  return (
    (p.title === undefined || typeof p.title === 'string') &&
    (p.description === undefined || typeof p.description === 'string') &&
    (p.startTime === undefined || typeof p.startTime === 'string') &&
    (p.endTime === undefined || typeof p.endTime === 'string') &&
    (p.attendees === undefined || typeof p.attendees === 'string' || Array.isArray(p.attendees)) &&
    (p.location === undefined || typeof p.location === 'string') &&
    (p.query === undefined || typeof p.query === 'string') &&
    (p.operation === undefined || ['create', 'read', 'update', 'delete', 'search'].includes(p.operation))
  );
}

/**
 * Validate and cast tool parameters based on context
 */
export function validateToolParameters(
  params: unknown,
  toolName: string
): ToolParameters {
  if (!params || typeof params !== 'object') {
    throw new Error(`Invalid parameters for tool ${toolName}: must be an object`);
  }

  switch (toolName.toLowerCase()) {
    case 'think':
      if (!isThinkParameters(params)) {
        throw new Error(`Invalid Think parameters: missing required 'query' field`);
      }
      return params;

    case 'email':
    case 'emailagent':
    case 'send_email':
      if (!isEmailParameters(params)) {
        throw new Error(`Invalid Email parameters: invalid structure`);
      }
      return params;

    case 'contact':
    case 'contactagent':
    case 'search_contacts':
      if (!isContactParameters(params)) {
        throw new Error(`Invalid Contact parameters: invalid structure`);
      }
      return params;

    case 'calendar':
    case 'calendaragent':
    case 'manage_calendar':
      if (!isCalendarParameters(params)) {
        throw new Error(`Invalid Calendar parameters: invalid structure`);
      }
      return params;

    default:
      // For unknown tools, return as BaseToolParameters
      return params as BaseToolParameters;
  }
}