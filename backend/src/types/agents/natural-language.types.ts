/**
 * Natural Language Agent Communication Types
 *
 * These interfaces define the standard contracts for pure natural language
 * communication between MasterAgent and domain expert agents.
 */

/**
 * Context for agent execution with natural language processing
 */
export interface AgentExecutionContext {
  /** Unique session identifier */
  sessionId: string;
  /** Optional user identifier */
  userId?: string;
  /** Access token for authenticated operations */
  accessToken?: string;
  /** Slack context for Slack-originated requests */
  slackContext?: any;
  /** Correlation ID for request tracing */
  correlationId: string;
  /** Timestamp of the request */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent's analysis of a natural language request
 */
export interface AgentIntent {
  /** The operation the agent determined to execute (e.g., 'create_event', 'list_emails') */
  operation: string;
  /** Extracted parameters for the operation */
  parameters: Record<string, any>;
  /** Confidence level in the analysis (0.0 to 1.0) */
  confidence: number;
  /** AI's reasoning for the tool selection */
  reasoning: string;
  /** Tools the agent plans to use */
  toolsUsed: string[];
  /** Optional: Alternative operations considered */
  alternatives?: Array<{
    operation: string;
    confidence: number;
    reasoning: string;
  }>;
}

/**
 * Response from natural language processing
 */
export interface NaturalLanguageResponse {
  /** Human-readable response to the user */
  response: string;
  /** Agent's reasoning for its actions */
  reasoning: string;
  /** Structured metadata for MasterAgent coordination */
  metadata: Record<string, any>;
  /** Optional: Suggested follow-up actions */
  suggestions?: string[];
  /** Optional: Warnings or important notes */
  warnings?: string[];
  /** Optional: Draft information if a draft was created */
  draft?: {
    /** Draft ID for tracking */
    draftId: string;
    /** Type of draft created */
    type: 'email' | 'calendar' | 'contact' | 'slack' | 'other';
    /** Description of what the draft will do */
    description: string;
    /** Preview data for user display */
    previewData: Record<string, any>;
    /** Whether this requires user confirmation */
    requiresConfirmation: boolean;
    /** Risk level of the operation */
    riskLevel: 'low' | 'medium' | 'high';
  };
  /** Optional: Result of draft execution if a draft was executed */
  executedDraft?: {
    /** ID of the executed draft */
    draftId: string;
    /** Success status of execution */
    success: boolean;
    /** Result details */
    result: any;
    /** Error message if execution failed */
    error?: string;
  };
}

/**
 * Agent capability description for MasterAgent
 */
export interface AgentCapabilities {
  /** Agent name identifier */
  name: string;
  /** Human-readable description of the agent */
  description: string;
  /** List of capabilities this agent provides */
  capabilities: string[];
  /** List of limitations or constraints */
  limitations: string[];
  /** Example requests this agent can handle */
  examples: string[];
  /** Supported domains or categories */
  domains?: string[];
  /** Required permissions or authentication */
  requirements?: string[];
}

/**
 * Agent selection criteria for MasterAgent
 */
export interface AgentSelectionCriteria {
  /** The user's natural language request */
  userRequest: string;
  /** Available agents and their capabilities */
  availableAgents: Record<string, AgentCapabilities>;
  /** Context from previous interactions */
  context?: {
    previousAgent?: string;
    conversationHistory?: string[];
    sessionData?: Record<string, any>;
  };
}

/**
 * Result of agent selection process
 */
export interface AgentSelectionResult {
  /** Selected agent name */
  selectedAgent: string;
  /** Confidence in the selection (0.0 to 1.0) */
  confidence: number;
  /** Reasoning for the selection */
  reasoning: string;
  /** Alternative agents considered */
  alternatives?: Array<{
    agent: string;
    confidence: number;
    reasoning: string;
  }>;
}

/**
 * Natural language execution result for MasterAgent
 */
export interface NaturalLanguageExecutionResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Natural language response from the agent */
  response?: string;
  /** Agent's reasoning */
  reasoning?: string;
  /** Execution metadata */
  metadata?: Record<string, any>;
  /** Error message if execution failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Base interface for natural language capable agents
 */
export interface INaturalLanguageAgent {
  /**
   * Process a natural language request and return a natural language response
   */
  processNaturalLanguageRequest(
    request: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse>;

  /**
   * Get the agent's capability description for MasterAgent
   */
  getCapabilityDescription(): AgentCapabilities;

  /**
   * Check if the agent can handle a specific type of request
   */
  canHandle(request: string): Promise<boolean>;
}