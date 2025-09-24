/**
 * Agent Capability Interfaces
 *
 * These interfaces define optional capabilities that agents can implement.
 * Agents only implement what they need, avoiding the heavy contract of
 * requiring all methods.
 *
 * Benefits:
 * - Composition over inheritance
 * - Agents implement only needed capabilities
 * - Easy to add new capability types
 * - Better separation of concerns
 */

import { AgentResult } from '../types/agents/agent-result';
import { AgentExecution } from './agent-execution';
import { AgentExecutionContext, AgentCapabilities } from '../types/agents/natural-language.types';

// ========== Core Agent Info ==========

/**
 * Metadata about an agent
 */
export interface AgentInfo {
  /** Unique agent identifier */
  name: string;

  /** Semantic version (e.g., "2.0.0") */
  version: string;

  /** Human-readable description */
  description: string;

  /** List of capability identifiers this agent implements */
  capabilities: string[];

  /** Operations this agent can perform */
  operations: string[];

  /** Required services that must be available */
  requiredServices: string[];

  /** Optional services that enhance functionality */
  optionalServices?: string[];

  /** External dependencies */
  dependencies?: string[];
}

// ========== Natural Language Capability ==========

/**
 * Capability for agents that process natural language requests
 *
 * Agents implementing this can:
 * - Understand natural language input
 * - Analyze user intent
 * - Generate natural language responses
 */
export interface NaturalLanguageCapability {
  /**
   * Process a natural language request
   *
   * @param request - User's natural language input
   * @param execution - Execution context (no threading needed!)
   * @returns Natural language response with reasoning
   */
  processNaturalLanguage(
    request: string,
    execution: AgentExecution
  ): Promise<AgentResult<NaturalLanguageResult>>;

  /**
   * Analyze user intent from natural language
   *
   * @param request - User's natural language input
   * @returns Analyzed intent with confidence
   */
  analyzeIntent(request: string): Promise<AgentIntent>;

  /**
   * Check if this agent can handle a specific request
   *
   * @param request - User's natural language input
   * @returns Confidence score 0-1
   */
  canHandle(request: string): Promise<number>;
}

/**
 * Result of natural language processing
 */
export interface NaturalLanguageResult {
  /** Human-readable response */
  response: string;

  /** Agent's reasoning */
  reasoning: string;

  /** Structured data */
  data?: any;

  /** Follow-up suggestions */
  suggestions?: string[];

  /** Warnings or important notes */
  warnings?: string[];
}

/**
 * Analyzed user intent
 */
export interface AgentIntent {
  /** Identified operation */
  operation: string;

  /** Extracted parameters */
  parameters: Record<string, any>;

  /** Confidence in the analysis (0-1) */
  confidence: number;

  /** AI's reasoning */
  reasoning: string;
}

// ========== Autonomous Capability ==========

/**
 * Capability for agents that can plan and execute autonomously
 *
 * Agents implementing this can:
 * - Create multi-step execution plans
 * - Execute plans with automatic retry/fallback
 * - Adapt strategy based on results
 */
export interface AutonomousCapability {
  /**
   * Create an execution plan for achieving a goal
   *
   * @param intent - What the agent should accomplish
   * @param execution - Execution context
   * @returns Multi-step execution plan
   */
  planExecution(
    intent: AgentIntent,
    execution: AgentExecution
  ): Promise<AgentResult<ExecutionPlan>>;

  /**
   * Execute a plan with automatic fallbacks and retry logic
   *
   * @param plan - The execution plan to follow
   * @param execution - Execution context
   * @returns Execution results
   */
  executeWithFallbacks(
    plan: ExecutionPlan,
    execution: AgentExecution
  ): Promise<AgentResult<any>>;

  /**
   * Assess if the agent can handle an intent
   *
   * @param intent - The intent to assess
   * @returns Capability score 0-1
   */
  assessCapability(intent: AgentIntent): Promise<number>;
}

/**
 * Multi-step execution plan
 */
export interface ExecutionPlan {
  /** Unique plan identifier */
  id: string;

  /** Original intent/goal */
  goal: string;

  /** Ordered list of steps */
  steps: ExecutionStep[];

  /** Total estimated duration (ms) */
  estimatedDuration?: number;

  /** Whether plan requires user confirmation */
  requiresConfirmation: boolean;

  /** Confidence in plan success (0-1) */
  confidence: number;

  /** Fallback strategy if plan fails */
  fallbackStrategy?: 'retry' | 'simplify' | 'abort';
}

/**
 * Single execution step
 */
export interface ExecutionStep {
  /** Step identifier */
  id: string;

  /** Step description */
  description: string;

  /** Operation to perform */
  operation: string;

  /** Operation parameters */
  parameters: Record<string, any>;

  /** Dependencies on other steps */
  dependencies?: string[];

  /** Whether step requires confirmation */
  requiresConfirmation?: boolean;
}

// ========== Interactive Capability ==========

/**
 * Capability for agents that provide interactive features
 *
 * Agents implementing this can:
 * - Generate contextual suggestions
 * - Provide previews of actions
 * - Offer alternative approaches
 */
export interface InteractiveCapability {
  /**
   * Generate suggestions based on results
   *
   * @param results - Results from previous operations
   * @param intent - Original user intent
   * @returns Array of actionable suggestions
   */
  generateSuggestions(results: any, intent: AgentIntent): string[];

  /**
   * Generate a preview of an action before execution
   *
   * @param operation - Operation to preview
   * @param parameters - Operation parameters
   * @returns Preview of what will happen
   */
  generatePreview?(
    operation: string,
    parameters: Record<string, any>
  ): Promise<AgentResult<ActionPreview>>;
}

/**
 * Preview of an action
 */
export interface ActionPreview {
  /** What will happen */
  description: string;

  /** Expected outcome */
  expectedOutcome: string;

  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';

  /** What will be created/modified/deleted */
  changes?: {
    creates?: string[];
    modifies?: string[];
    deletes?: string[];
  };
}

// ========== Confirmation Capability ==========

/**
 * Capability for agents that require user confirmation
 *
 * Agents implementing this can:
 * - Identify operations needing confirmation
 * - Generate confirmation prompts
 * - Assess operation risk
 */
export interface ConfirmationCapability {
  /**
   * Check if an operation requires confirmation
   *
   * @param operation - Operation name
   * @param parameters - Operation parameters
   * @returns Whether confirmation is required
   */
  needsConfirmation(operation: string, parameters?: Record<string, any>): boolean;

  /**
   * Generate a confirmation prompt for an operation
   *
   * @param operation - Operation name
   * @param parameters - Operation parameters
   * @returns Human-readable confirmation prompt
   */
  getConfirmationPrompt(operation: string, parameters: Record<string, any>): string;

  /**
   * Assess the risk level of an operation
   *
   * @param operation - Operation name
   * @param parameters - Operation parameters
   * @returns Risk assessment
   */
  assessRisk?(operation: string, parameters: Record<string, any>): RiskAssessment;
}

/**
 * Risk assessment for an operation
 */
export interface RiskAssessment {
  /** Risk level */
  level: 'low' | 'medium' | 'high' | 'critical';

  /** Risk factors identified */
  factors: string[];

  /** Recommended safeguards */
  safeguards?: string[];

  /** Whether operation is reversible */
  reversible: boolean;
}

// ========== Draft Capability ==========

/**
 * Capability for agents that work with drafts
 *
 * Agents implementing this can:
 * - Create drafts for review
 * - Execute approved drafts
 * - Manage draft lifecycle
 */
export interface DraftCapability {
  /**
   * Create a draft for an operation
   *
   * @param operation - Operation to draft
   * @param parameters - Operation parameters
   * @param execution - Execution context
   * @returns Draft information
   */
  createDraft(
    operation: string,
    parameters: Record<string, any>,
    execution: AgentExecution
  ): Promise<AgentResult<DraftInfo>>;

  /**
   * Execute an approved draft
   *
   * @param draftId - ID of the draft to execute
   * @param execution - Execution context
   * @returns Execution result
   */
  executeDraft(draftId: string, execution: AgentExecution): Promise<AgentResult<any>>;
}

/**
 * Draft information
 */
export interface DraftInfo {
  /** Unique draft identifier */
  draftId: string;

  /** Type of draft */
  type: string;

  /** What the draft will do */
  description: string;

  /** Preview data */
  preview: any;

  /** When draft expires */
  expiresAt?: Date;

  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';
}

// ========== Service Integration Capability ==========

/**
 * Capability for agents that integrate with external services
 *
 * Agents implementing this can:
 * - Validate service availability
 * - Handle service errors gracefully
 * - Manage service-specific auth
 */
export interface ServiceIntegrationCapability {
  /**
   * Validate that required services are available
   *
   * @returns Validation result with missing services
   */
  validateServices(): Promise<AgentResult<ServiceValidation>>;

  /**
   * Get health status of integrated services
   *
   * @returns Health status of each service
   */
  getServiceHealth?(): Promise<Record<string, ServiceHealth>>;
}

/**
 * Service validation result
 */
export interface ServiceValidation {
  /** All required services available */
  allAvailable: boolean;

  /** List of available services */
  available: string[];

  /** List of missing services */
  missing: string[];

  /** Service-specific issues */
  issues?: Record<string, string>;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  /** Service name */
  name: string;

  /** Is service healthy */
  healthy: boolean;

  /** Response time (ms) */
  responseTime?: number;

  /** Last error if any */
  lastError?: string;

  /** Last checked timestamp */
  lastChecked: Date;
}

// ========== Capability Type Guards ==========

/**
 * Check if agent implements natural language capability
 */
export function hasNaturalLanguageCapability(
  agent: any
): agent is NaturalLanguageCapability {
  return (
    typeof agent.processNaturalLanguage === 'function' &&
    typeof agent.analyzeIntent === 'function'
  );
}

/**
 * Check if agent implements autonomous capability
 */
export function hasAutonomousCapability(agent: any): agent is AutonomousCapability {
  return (
    typeof agent.planExecution === 'function' &&
    typeof agent.executeWithFallbacks === 'function'
  );
}

/**
 * Check if agent implements interactive capability
 */
export function hasInteractiveCapability(agent: any): agent is InteractiveCapability {
  return typeof agent.generateSuggestions === 'function';
}

/**
 * Check if agent implements confirmation capability
 */
export function hasConfirmationCapability(
  agent: any
): agent is ConfirmationCapability {
  return (
    typeof agent.needsConfirmation === 'function' &&
    typeof agent.getConfirmationPrompt === 'function'
  );
}

/**
 * Check if agent implements draft capability
 */
export function hasDraftCapability(agent: any): agent is DraftCapability {
  return (
    typeof agent.createDraft === 'function' && typeof agent.executeDraft === 'function'
  );
}