/**
 * Autonomous Agent Architecture
 *
 * This interface defines the contract for autonomous agents that can:
 * 1. Receive natural language intents instead of rigid parameters
 * 2. Formulate their own execution plans using domain expertise
 * 3. Execute with fallback strategies and error recovery
 * 4. Provide intelligent natural language responses with reasoning
 */

export interface AgentExecutionPlan {
  /** Primary strategy to attempt */
  primaryStrategy: {
    method: string;
    parameters: Record<string, any>;
    reasoning: string;
  };

  /** Fallback strategies if primary fails */
  fallbackStrategies: Array<{
    method: string;
    parameters: Record<string, any>;
    reasoning: string;
    triggerCondition: string; // When to use this fallback
  }>;

  /** Expected outcome description */
  expectedOutcome: string;

  /** Confidence in plan success (0-1) */
  confidence: number;
}

export interface AgentResponse {
  /** Structured data for system consumption */
  data: any;

  /** Natural language response for user */
  naturalResponse: string;

  /** Agent's reasoning process */
  reasoning: string;

  /** Suggested next actions */
  suggestions?: string[];

  /** Execution success status */
  success: boolean;

  /** Confidence in result accuracy (0-1) */
  confidence: number;

  /** Whether follow-up is needed */
  needsFollowup: boolean;

  /** Error details if applicable */
  error?: {
    type: string;
    message: string;
    recoverable: boolean;
    suggestedRecovery?: string;
  };

  /** Execution metadata */
  metadata: {
    strategiesAttempted: string[];
    executionTime: number;
    apiCallsUsed: number;
  };
}

export interface AgentContext {
  /** User identifier */
  userId?: string;

  /** Current workflow context */
  workflowContext?: any;

  /** Previous conversation history */
  conversationHistory?: Array<{
    intent: string;
    response: AgentResponse;
    timestamp: Date;
  }>;

  /** User preferences and patterns */
  userPreferences?: Record<string, any>;

  /** Domain-specific context */
  domainContext?: Record<string, any>;
}

export interface AutonomousAgent {
  /** Agent identifier */
  readonly agentName: string;

  /** Agent capabilities description */
  readonly capabilities: string[];

  /** Agent domain expertise areas */
  readonly expertise: string[];

  /**
   * Process a natural language intent autonomously
   * @param intent - Natural language description of what user wants
   * @param context - Contextual information for execution
   * @returns Promise of autonomous agent response
   */
  processIntent(intent: string, context?: AgentContext): Promise<AgentResponse>;

  /**
   * Analyze intent and create execution plan
   * @param intent - Natural language intent
   * @param context - Execution context
   * @returns Promise of execution plan
   */
  planExecution(intent: string, context?: AgentContext): Promise<AgentExecutionPlan>;

  /**
   * Execute plan with fallback strategies
   * @param plan - Execution plan to follow
   * @param context - Execution context
   * @returns Promise of execution results
   */
  executeWithFallbacks(plan: AgentExecutionPlan, context?: AgentContext): Promise<any>;

  /**
   * Formulate natural language response from results
   * @param results - Execution results
   * @param originalIntent - Original user intent
   * @param plan - Execution plan that was followed
   * @returns Promise of natural language response
   */
  formulateResponse(results: any, originalIntent: string, plan: AgentExecutionPlan): Promise<string>;

  /**
   * Generate intelligent suggestions based on results
   * @param results - Execution results
   * @param intent - Original intent
   * @returns Array of suggested next actions
   */
  generateSuggestions(results: any, intent: string): string[];

  /**
   * Assess confidence in ability to handle intent
   * @param intent - Natural language intent
   * @returns Confidence score (0-1)
   */
  assessCapability(intent: string): Promise<number>;
}

/**
 * Intent Analysis Result
 * Used by agents to understand what the user wants
 */
export interface IntentAnalysis {
  /** Core action user wants to perform */
  primaryAction: string;

  /** Target entities (emails, events, contacts, etc.) */
  targetEntities: string[];

  /** Extracted parameters and constraints */
  parameters: Record<string, any>;

  /** Inferred user context and motivation */
  userContext: {
    urgency: 'low' | 'medium' | 'high' | 'immediate';
    complexity: 'simple' | 'moderate' | 'complex';
    scope: 'specific' | 'broad' | 'exploratory';
  };

  /** Ambiguities that might need clarification */
  ambiguities: string[];

  /** Confidence in intent understanding (0-1) */
  confidence: number;
}

/**
 * Execution Strategy
 * Defines how an agent will attempt to fulfill an intent
 */
export interface ExecutionStrategy {
  /** Strategy identifier */
  name: string;

  /** Method to execute */
  method: string;

  /** Parameters for execution */
  parameters: Record<string, any>;

  /** Why this strategy was chosen */
  reasoning: string;

  /** Expected success probability (0-1) */
  successProbability: number;

  /** Estimated execution time */
  estimatedTime: number;

  /** Dependencies required */
  dependencies: string[];
}