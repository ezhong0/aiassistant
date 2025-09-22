import logger from '../utils/logger';
import { AppError, ErrorFactory, ERROR_CATEGORIES } from '../utils/app-error';
import { OpenAIService } from '../services/openai.service';
import { LogContext } from '../utils/log-context';
// Agents are now stateless
import { ToolCall, ToolResult, MasterAgentConfig, ToolExecutionContext, ToolCallSchema, ToolResultSchema } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { getService } from '../services/service-manager';
import { SlackContext, SlackContextSchema } from '../types/slack/slack.types';
import { SlackMessage } from '../types/slack/slack-message-reader.types';
import { APP_CONSTANTS } from '../config/constants';
import { OpenAIFunctionSchema } from '../framework/agent-factory';
import { SlackAgent, ContextGatheringResult, ContextDetectionResult } from './slack.agent';
import { z } from 'zod';
import { ContactAgent } from './contact.agent';
// Removed WorkflowCacheService - using simple in-memory state management
interface SimpleWorkflowState {
  workflowId: string;
  sessionId: string;
  status: 'active' | 'completed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  context: any;
  createdAt: Date;
  lastActivity: Date;
}

interface SimpleWorkflowStep {
  stepId: string;
  stepNumber: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
}
import { DraftManager, Draft, WriteOperation } from '../services/draft-manager.service';
import { NextStepPlanningService, WorkflowContext, NextStepPlan, StepResult as NextStepResult } from '../services/next-step-planning.service';
// Removed OperationDetectionService - agents handle their own operation detection
import { ToolExecutorService } from '../services/tool-executor.service';

/**
 * Agent capabilities interface for internal use
 */
interface AgentCapability {
  /** List of capabilities this agent provides */
  capabilities: string[];
  /** List of limitations or constraints */
  limitations: string[];
  /** OpenAI function schema for this agent */
  schema: OpenAIFunctionSchema;
}

// ✅ MasterAgent response schema with Zod validation
export const MasterAgentResponseSchema = z.object({
  message: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolResults: z.array(ToolResultSchema).optional(),
  needsThinking: z.boolean().optional(),
  proposal: z.object({
    text: z.string(),
    actionType: z.string(),
    confidence: z.number(),
    requiresConfirmation: z.boolean(),
    originalToolCalls: z.array(ToolCallSchema),
  }).optional(),
  contextGathered: z.unknown().optional(), // Will be refined with ContextGatheringResultSchema
  executionMetadata: z.object({
    processingTime: z.number().optional(),
    totalExecutionTime: z.number().optional(),
    toolsExecuted: z.number().optional(),
    successfulTools: z.number().optional(),
    slackContext: SlackContextSchema.optional(), // Now properly typed
    completedSteps: z.number().optional(),
    totalSteps: z.number().optional(),
    stepNumber: z.number().optional(),
    needsConfirmation: z.boolean().optional(),
    pauseReason: z.string().optional(),
    originalWorkflowId: z.string().optional(),
    sessionId: z.string().optional(),
    toolResults: z.array(z.object({
      toolName: z.string(),
      success: z.boolean(),
      executionTime: z.number(),
      error: z.string().optional(),
      result: z.record(z.unknown()).optional(), // Better than z.any()
    })).optional(),
    confirmationFlows: z.array(z.record(z.unknown())).optional(), // Better than z.any()
    masterAgentResponse: z.string().optional(),
    error: z.string().optional(),
    errorType: z.string().optional(),
    errorContext: z.record(z.unknown()).optional(), // Better than z.any()
    // Workflow-related metadata
    workflowId: z.string().optional(),
    workflowAction: z.string().optional(),
    currentStep: z.number().optional(),
    // Autonomous agent metadata
    autonomousAgent: z.string().optional(),
    reasoning: z.string().optional(),
    suggestions: z.array(z.string()).optional(),
    needsFollowup: z.boolean().optional(),
    strategiesAttempted: z.array(z.string()).optional(),
    executionTime: z.number().optional(),
  }).optional(),
  suggestions: z.array(z.string()).optional(),
  workflowResults: z.array(z.unknown()).optional()
});

export type MasterAgentResponse = z.infer<typeof MasterAgentResponseSchema>;

// ✅ Workflow-related interfaces
export interface WorkflowResponse {
  workflowId: string;
  message: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  needsConfirmation: boolean;
  nextStep?: SimpleWorkflowStep;
}

export interface StepResult {
  stepNumber: number;
  success: boolean;
  result?: any;
  error?: string;
  needsConfirmation: boolean;
  naturalLanguageResponse: string;
}

// ✅ Proposal response schema
export const ProposalResponseSchema = z.object({
  text: z.string(),
  actionType: z.string(),
  confidence: z.number(),
  requiresConfirmation: z.boolean(),
  originalToolCalls: z.array(ToolCallSchema),
});

export type ProposalResponse = z.infer<typeof ProposalResponseSchema>;

// ✅ Intent Analysis interfaces for unified confirmation system
export interface IntentAnalysis {
  intentType: 'confirmation_positive' | 'confirmation_negative' | 'draft_modification' | 'new_request' | 'new_write_operation' | 'read_operation';
  confidence: number;
  reasoning: string;
  targetDraftId?: string;
  modifications?: {
    fieldsToUpdate: string[];
    newValues: Record<string, any>;
  };
  newOperation?: WriteOperation;
  readOperations?: ToolCall[];
}

export interface AnalysisContext {
  userInput: string;
  sessionId: string;
  hasPendingDrafts: boolean;
  existingDrafts: {
    id: string;
    type: string;
    description: string;
    parameters: any;
    createdAt: Date;
    riskLevel: string;
  }[];
  conversationHistory?: string[];
}

// ✅ Validation helpers for MasterAgent responses
export function validateMasterAgentResponse(data: unknown): MasterAgentResponse {
  return MasterAgentResponseSchema.parse(data);
}

export function validateProposalResponse(data: unknown): ProposalResponse {
  return ProposalResponseSchema.parse(data);
}

// ✅ Safe parsing helpers that don't throw
export function safeParseMasterAgentResponse(data: unknown): { success: true; data: MasterAgentResponse } | { success: false; error: z.ZodError } {
  const result = MasterAgentResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * MasterAgent - Central orchestrator for AI-powered multi-agent system
 * 
 * The MasterAgent serves as the primary interface between users and the specialized
 * agent ecosystem. It handles user input processing, intent parsing, dependency
 * resolution, and tool call validation. The agent uses AI-powered planning to
 * coordinate multiple specialized agents and execute complex workflows.
 * 
 * Key Features:
 * - AI-powered intent analysis and tool call generation
 * - Context gathering from Slack conversations
 * - Proposal generation for confirmation workflows
 * - Comprehensive error handling and logging
 * - Memory usage monitoring and optimization
 * 
 * @example
 * ```typescript
 * const masterAgent = new MasterAgent();
 * 
 * const response = await masterAgent.processUserInput(
 *   "Send an email to John about the meeting",
 *   "session123",
 *   "user456"
 * );
 * 
 * console.log(response.message); // Human-readable response
 * console.log(response.toolCalls); // Generated tool calls
 * ```
 */
export class MasterAgent {
  private useOpenAI: boolean = false;
  private systemPrompt: string;
  private agentSchemas: Map<string, OpenAIFunctionSchema> = new Map();
  private lastMemoryCheck: number = Date.now();

  // Simple in-memory workflow state management (replaces WorkflowCacheService)
  private workflows: Map<string, SimpleWorkflowState> = new Map();
  private sessionWorkflows: Map<string, string[]> = new Map(); // sessionId -> workflowIds[]


  /**
   * Initialize MasterAgent with optional configuration
   * 
   * @param config - Optional configuration including OpenAI API key and other settings
   * 
   * @example
   * ```typescript
   * // Basic initialization
   * const masterAgent = new MasterAgent();
   * 
   * // With OpenAI configuration
   * const masterAgent = new MasterAgent({
   *   openaiApiKey: process.env.OPENAI_API_KEY
   * });
   * ```
   */
  constructor(config?: MasterAgentConfig) {
    // Agents are now stateless - no session management needed
    
    // AgentFactory should already be initialized by the main application
    // No need to initialize it again here

    // Generate dynamic system prompt from AgentFactory
    this.systemPrompt = this.generateSystemPrompt();
    
    // Initialize agent schemas for OpenAI function calling
    this.initializeAgentSchemas().catch(error => {
      logger.error('Agent schema initialization failed', {
        error: error.message,
        stack: error.stack,
        correlationId: 'init',
        operation: 'agent_schema_init',
        metadata: { service: 'MasterAgent' }
      });
    });

    
    if (config?.openaiApiKey) {
      // Use shared OpenAI service from service registry instead of creating a new instance
      this.useOpenAI = true;
      logger.debug('MasterAgent initialized with OpenAI integration', {
        correlationId: 'init',
        operation: 'agent_init',
        metadata: { hasOpenAI: true, hasContextGathering: true }
      });
    } else {
      logger.debug('MasterAgent initialized with rule-based routing only', {
        correlationId: 'init',
        operation: 'agent_init',
        metadata: { hasOpenAI: false, hasContextGathering: false }
      });
    }
  }


  /**
   * Initialize OpenAI function schemas for all agents
   */
  private async initializeAgentSchemas(): Promise<void> {
    try {
      // Import agent classes dynamically to avoid circular imports
      const { EmailAgent } = await import('./email.agent');
      const { ContactAgent } = await import('./contact.agent');
      const { CalendarAgent } = await import('./calendar.agent');
      
      // Register agent schemas
      this.agentSchemas.set('emailAgent', EmailAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('contactAgent', ContactAgent.getOpenAIFunctionSchema() as any);
      this.agentSchemas.set('calendarAgent', CalendarAgent.getOpenAIFunctionSchema());
      
      logger.debug('Agent schemas initialized for OpenAI function calling', {
        correlationId: 'init',
        operation: 'agent_schema_init',
        metadata: { 
          schemaCount: this.agentSchemas.size,
          schemaNames: Array.from(this.agentSchemas.keys())
        }
      });
    } catch (error) {
      logger.error('Agent schema initialization failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        correlationId: 'init',
        operation: 'agent_schema_init',
        metadata: { service: 'MasterAgent' }
      });
      // Clear schemas on error to prevent memory leaks from partial initialization
      this.agentSchemas.clear();
    }
  }

  /**
   * Get all agent schemas for OpenAI function calling
   */
  public getAgentSchemas(): OpenAIFunctionSchema[] {
    return Array.from(this.agentSchemas.values());
  }

  /**
   * Get agent capabilities summary for AI planning
   */
  public async getAgentCapabilities(): Promise<Record<string, AgentCapability>> {
    try {
      const { EmailAgent } = await import('./email.agent');
      const { ContactAgent } = await import('./contact.agent');
      const { CalendarAgent } = await import('./calendar.agent');
      
      return {
        emailAgent: {
          capabilities: EmailAgent.getCapabilities(),
          limitations: EmailAgent.getLimitations(),
          schema: EmailAgent.getOpenAIFunctionSchema()
        },
        contactAgent: {
          capabilities: ContactAgent.getCapabilities(),
          limitations: ContactAgent.getLimitations(),
          schema: ContactAgent.getOpenAIFunctionSchema() as any
        },
        calendarAgent: {
          capabilities: CalendarAgent.getCapabilities(),
          limitations: CalendarAgent.getLimitations(),
          schema: CalendarAgent.getOpenAIFunctionSchema()
        }
      };
    } catch (error) {
      logger.error('Failed to get agent capabilities', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        correlationId: 'init',
        operation: 'agent_capabilities',
        metadata: { service: 'MasterAgent' }
      });
      return {};
    }
  }

  /**
   * Get SlackAgent from AgentFactory for context gathering
   */
  private getSlackAgent(): SlackAgent | null {
    try {
      return AgentFactory.getAgent('slackAgent') as SlackAgent;
    } catch (error) {
      logger.warn('SlackAgent not available from AgentFactory', {
        correlationId: 'init',
        operation: 'agent_resolution',
        metadata: { requestedAgent: 'SlackAgent' }
      });
      return null;
    }
  }

  /**
   * Get ContactAgent for contact operations
   * 
   * @returns ContactAgent instance or null if not available
   */
  private getContactAgent(): ContactAgent | null {
    return AgentFactory.getAgent('contactAgent') as ContactAgent | null;
  }



  /**
   * Get OpenAI service from the registry
   */
  public getOpenAIService(): OpenAIService | null {
    if (!this.useOpenAI) return null;
    
    const openaiService = getService<OpenAIService>('openaiService');
    if (!openaiService) {
      logger.warn('OpenAI service not available from service registry', {
        correlationId: 'init',
        operation: 'service_resolution',
        metadata: { requestedService: 'OpenAIService' }
      });
      return null;
    }
    return openaiService;
  }

  // Agents are now stateless - no session service needed

  /**
   * Process user input using AI-powered analysis with context detection and proposal generation
   * 
   * This is the main entry point for processing user requests. It performs a multi-step
   * analysis including context detection, intent parsing, dependency resolution, and
   * tool call generation. The method coordinates with specialized services to provide
   * intelligent responses and action proposals.
   * 
   * Processing Steps:
   * 1. Context Detection - Determines if Slack context is needed
   * 2. Context Gathering - Retrieves relevant conversation history
   * 3. Intent Analysis - Parses user intent and resolves dependencies
   * 4. Tool Generation - Creates appropriate tool calls using AI
   * 5. Proposal Creation - Generates confirmation proposals if needed
   * 
   * @param userInput - Natural language user request to process
   * @param sessionId - Unique session identifier for tracking and logging
   * @param userId - Optional user identifier for personalization
   * @param slackContext - Optional Slack context for enhanced processing
   * @returns Promise resolving to MasterAgentResponse with tool calls and metadata
   * 
   * @example
   * ```typescript
   * // Basic usage
   * const response = await masterAgent.processUserInput(
   *   "Send email to john@example.com about project update",
   *   "session-123"
   * );
   * 
   * // With Slack context for enhanced processing
   * const response = await masterAgent.processUserInput(
   *   "Send that email we discussed",
   *   "session-123",
   *   "user-456",
   *   slackContext
   * );
   * 
   * console.log(response.message); // Human-readable response
   * console.log(response.toolCalls); // Generated tool calls
   * console.log(response.proposal); // Confirmation proposal if needed
   * ```
   * 
   * @throws {Error} When OpenAI service is not available
   * @throws {Error} When context detection or gathering fails
   * @throws {Error} When intent analysis or tool generation fails
   */
  async processUserInput(
    userInput: string, 
    sessionId: string, 
    userId?: string,
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    const startTime = Date.now();
    const correlationId = `master-${sessionId}-${Date.now()}`;
    const logContext: LogContext = {
      correlationId,
      userId,
      sessionId,
      operation: 'processUserInput',
      metadata: { inputLength: userInput.length }
    };

    try {
      logger.info('Request started', logContext);
      
      // Check memory usage periodically
      this.checkMemoryUsage();
      
      // Check for active workflow first using simple state management
      const activeWorkflows = this.getActiveWorkflows(sessionId);

      if (activeWorkflows.length > 0) {
        // Handle workflow interruption/continuation with step-by-step
        const activeWorkflow = activeWorkflows[0];
        if (activeWorkflow) {
          return await this.continueStepByStepWorkflow(userInput, activeWorkflow, sessionId, userId, slackContext);
        }
      }

      // AI-first execution - no fallback routing
      const openaiService = this.getOpenAIService();
      if (!this.useOpenAI || !openaiService) {
        throw ErrorFactory.serviceUnavailable('OpenAI', {
          correlationId: logContext.correlationId,
          userId: logContext.userId,
          operation: 'ai_service_check',
          metadata: { message: 'AI service is required but not available. Please check OpenAI configuration.' }
        });
      }

      // Start new step-by-step execution
      return await this.executeStepByStep(userInput, sessionId, userId, slackContext);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Operation failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        ...logContext,
        duration,
        metadata: { userInput: userInput.substring(0, 100) }
      });
      
      // Provide user-friendly error message
      const errorMessage = await this.createUserFriendlyErrorMessage(error as Error, userInput);
      
      return {
        message: errorMessage,
        executionMetadata: {
          processingTime: duration,
          error: (error as Error).message,
          errorType: (error as Error).constructor.name
        }
      };
    }
  }

  /**
   * NEW UNIFIED INTENT ANALYSIS - Handles all confirmation logic in single method
   *
   * This method replaces the complex multi-service confirmation system with a single
   * AI-powered analysis that handles:
   * - Draft checking and confirmation detection
   * - Write operation detection during planning
   * - Draft modification requests
   * - New request handling with draft cleanup
   *
   * Returns plain text optimized for Slack instead of complex response objects.
   */
  async processUserInputUnified(
    userInput: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    const startTime = Date.now();
    const correlationId = `master-unified-${sessionId}-${Date.now()}`;
    const logContext: LogContext = {
      correlationId,
      userId,
      sessionId,
      operation: 'processUserInputUnified',
      metadata: { inputLength: userInput.length }
    };

    try {
      logger.info('Starting unified intent analysis', logContext);

      // 1. Get DraftManager service
      const draftManager = this.getDraftManager();
      if (!draftManager) {
        throw ErrorFactory.serviceUnavailable('DraftManager', {
          correlationId: logContext.correlationId,
          userId: logContext.userId,
          operation: 'draft_manager_check'
        });
      }

      // 2. Check for existing drafts first
      const existingDrafts = await draftManager.getSessionDrafts(sessionId);

      // 3. Build comprehensive context for AI analysis
      const analysisContext: AnalysisContext = {
        userInput,
        sessionId,
        hasPendingDrafts: existingDrafts.length > 0,
        existingDrafts: existingDrafts.map(draft => ({
          id: draft.id,
          type: draft.type,
          description: draft.previewData.description,
          parameters: draft.parameters,
          createdAt: draft.createdAt,
          riskLevel: draft.riskLevel
        })),
        conversationHistory: await this.getRecentConversation(sessionId)
      };

      // 4. Single AI call that determines everything
      const intentAnalysis = await this.comprehensiveIntentAnalysis(analysisContext);

      // 5. Route based on AI analysis
      return await this.routeBasedOnIntent(intentAnalysis, sessionId, userId || 'unknown');

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Unified intent analysis failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        ...logContext,
        duration,
        metadata: { userInput: userInput.substring(0, 100) }
      });

      // Return user-friendly error message
      return await this.createUserFriendlyErrorText(error as Error, userInput);
    }
  }

  /**
   * Comprehensive AI analysis that handles all confirmation scenarios
   */
  private async comprehensiveIntentAnalysis(context: AnalysisContext): Promise<IntentAnalysis> {
    const logContext: LogContext = {
      correlationId: `intent-analysis-${Date.now()}`,
      sessionId: context.sessionId,
      operation: 'comprehensiveIntentAnalysis'
    };

    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      throw ErrorFactory.serviceUnavailable('OpenAI', {
        correlationId: logContext.correlationId,
        operation: 'intent_analysis',
        metadata: { message: 'OpenAI service not available for intent analysis' }
      });
    }

    const prompt = `Analyze user intent comprehensively and return structured JSON:

User message: "${context.userInput}"

${context.hasPendingDrafts ? `
EXISTING PENDING DRAFTS:
${context.existingDrafts.map(d => `
- ${d.type} operation: ${d.description}
- Draft ID: ${d.id}
- Created: ${d.createdAt}
- Risk: ${d.riskLevel}
- Parameters: ${JSON.stringify(d.parameters, null, 2)}
`).join('\n')}

Recent conversation:
${context.conversationHistory?.slice(-3).join('\n') || 'None'}
` : 'No existing drafts.'}

Determine the user's intent:

IF DRAFTS EXIST:
1. Is this a CONFIRMATION (positive: "yes", "send it", "looks good" / negative: "no", "cancel", "stop")?
2. Is this a MODIFICATION ("change subject to...", "add John", "make it shorter")?
3. Is this a NEW REQUEST (completely different topic, ignoring current drafts)?

IF NO DRAFTS:
4. What does the user want to accomplish?
5. Does it involve WRITE OPERATIONS (email, calendar, contacts, etc.)?

For WRITE OPERATIONS, analyze:
- Operation type and parameters needed
- Risk level (low/medium/high)
- Why confirmation is needed
- Preview description

Return JSON with this structure:
{
  "intentType": "confirmation_positive|confirmation_negative|draft_modification|new_request|new_write_operation|read_operation",
  "confidence": 0.9,
  "reasoning": "Clear explanation of why this classification was chosen",
  "targetDraftId": "draft-id-if-applicable",
  "modifications": {
    "fieldsToUpdate": ["field1", "field2"],
    "newValues": {"field1": "new-value"}
  },
  "newOperation": {
    "type": "email|calendar|contact|slack|other",
    "operation": "send_email",
    "parameters": {...},
    "toolCall": {...},
    "confirmationReason": "Why confirmation is needed",
    "riskLevel": "low|medium|high",
    "previewDescription": "Send email to john@example.com"
  },
  "readOperations": [...]
}`;

    try {
      const response = await openaiService.generateStructuredData(
        context.userInput,
        prompt,
        {
        type: 'object',
        properties: {
          intentType: {
            type: 'string',
            enum: ['confirmation_positive', 'confirmation_negative', 'draft_modification', 'new_request', 'new_write_operation', 'read_operation']
          },
          confidence: { type: 'number' },
          reasoning: { type: 'string' },
          targetDraftId: { type: 'string' },
          modifications: {
            type: 'object',
            properties: {
              fieldsToUpdate: { type: 'array', items: { type: 'string' } },
              newValues: { type: 'object' }
            }
          },
          newOperation: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              operation: { type: 'string' },
              parameters: { type: 'object' },
              toolCall: { type: 'object' },
              confirmationReason: { type: 'string' },
              riskLevel: { type: 'string' },
              previewDescription: { type: 'string' }
            }
          },
          readOperations: { type: 'array' }
        }
      });

      return response as IntentAnalysis;

    } catch (error) {
      logger.error('Failed to parse intent analysis', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      throw ErrorFactory.serviceError('OpenAI', 'Failed to analyze user intent', {
        correlationId: logContext.correlationId,
        operation: 'intent_analysis',
        originalError: error
      });
    }
  }

  /**
   * Route to appropriate action based on unified analysis
   */
  private async routeBasedOnIntent(
    analysis: IntentAnalysis,
    sessionId: string,
    userId: string
  ): Promise<string> {
    const draftManager = this.getDraftManager();
    if (!draftManager) {
      return "❌ System temporarily unavailable. Please try again in a moment.";
    }

    if (!analysis || !analysis.intentType) {
      return "❌ I couldn't understand your request. Could you please rephrase it?";
    }

    switch (analysis.intentType) {
      case 'confirmation_positive':
        if (!analysis.targetDraftId) {
          return "❌ I couldn't find the draft to confirm. Please try your request again.";
        }

        try {
          const result = await draftManager.executeDraft(analysis.targetDraftId);
          return result.success
            ? "✅ Action completed successfully!"
            : `❌ Failed to complete action: ${result.error || 'Unknown error'}`;
        } catch (error) {
          return `❌ Failed to execute action: ${(error as Error).message}`;
        }

      case 'confirmation_negative':
        await draftManager.clearSessionDrafts(sessionId);
        return `❌ Action cancelled. ${analysis.reasoning}`;

      case 'draft_modification':
        if (!analysis.targetDraftId || !analysis.modifications) {
          return "❌ I couldn't understand what changes you want to make. Could you be more specific?";
        }

        try {
          const updatedDraft = await draftManager.updateDraft(
            analysis.targetDraftId,
            {
              parameters: analysis.modifications.newValues,
              previewData: {
                description: `Modified: ${analysis.modifications.fieldsToUpdate.join(', ')}`,
                details: analysis.modifications.newValues
              }
            }
          );
          return `🔍 Updated: ${updatedDraft.previewData.description}. Reply "yes" to confirm.`;
        } catch (error) {
          return `❌ Failed to update draft: ${(error as Error).message}`;
        }

      case 'new_request':
        // Clear existing drafts and process new request
        await draftManager.clearSessionDrafts(sessionId);

        if (!analysis.newOperation) {
          return "❌ I couldn't understand what you want me to do. Could you be more specific?";
        }

        try {
          const draft = await draftManager.createDraft(sessionId, analysis.newOperation);
          return `🔍 Ready to ${draft.previewData.description}. Reply "yes" to confirm or describe any changes.`;
        } catch (error) {
          return `❌ Failed to create draft: ${(error as Error).message}`;
        }

      case 'new_write_operation':
        if (!analysis.newOperation) {
          return "❌ I couldn't understand what you want me to do. Could you be more specific?";
        }

        try {
          const draft = await draftManager.createDraft(sessionId, analysis.newOperation);
          return `🔍 Ready to ${draft.previewData.description}. Reply "yes" to confirm or describe any changes.`;
        } catch (error) {
          return `❌ Failed to create draft: ${(error as Error).message}`;
        }

      case 'read_operation':
        if (!analysis.readOperations || analysis.readOperations.length === 0) {
          return "❌ I couldn't determine what information you're looking for.";
        }

        try {
          // Execute read operations immediately (no confirmation needed)
          const results = await this.executeReadOperations(analysis.readOperations, sessionId, userId);
          return this.formatReadResults(results);
        } catch (error) {
          return `❌ Failed to retrieve information: ${(error as Error).message}`;
        }

      default:
        return "❌ I couldn't understand your request. Could you try rephrasing it?";
    }
  }

  /**
   * Execute read operations immediately (no confirmation needed)
   */
  private async executeReadOperations(
    readOperations: ToolCall[],
    sessionId: string,
    userId: string
  ): Promise<ToolResult[]> {
    const logContext: LogContext = {
      correlationId: `read-ops-${Date.now()}`,
      sessionId,
      operation: 'executeReadOperations'
    };

    const toolExecutorService = this.getToolExecutorService();
    if (!toolExecutorService) {
      throw ErrorFactory.serviceUnavailable('ToolExecutorService', {
        correlationId: logContext.correlationId,
        operation: 'tool_executor_check'
      });
    }

    const results: ToolResult[] = [];
    const context: ToolExecutionContext = {
      sessionId,
      userId,
      timestamp: new Date(),
      metadata: { operationType: 'read', confirmationStatus: 'not_required' }
    };

    for (const toolCall of readOperations) {
      try {
        const result = await toolExecutorService.executeTool(toolCall, context);
        results.push(result);
      } catch (error) {
        results.push({
          toolName: toolCall.name,
          success: false,
          error: (error as Error).message,
          result: null,
          executionTime: 0
        });
      }
    }

    return results;
  }

  /**
   * Format read operation results for display
   */
  private formatReadResults(results: ToolResult[]): string {
    if (results.length === 0) {
      return "📋 No results found.";
    }

    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let response = "📋 Here's what I found:\n\n";

    // Format successful results
    successfulResults.forEach((result, index) => {
      if (result.result) {
        // Simple formatting - could be enhanced based on data type
        if (typeof result.result === 'string') {
          response += `${result.result}\n\n`;
        } else {
          response += `${JSON.stringify(result.result, null, 2)}\n\n`;
        }
      }
    });

    // Add error summary if any failed
    if (failedResults.length > 0) {
      response += `\n⚠️ ${failedResults.length} operation(s) failed.`;
    }

    return response.trim();
  }

  /**
   * Get recent conversation history for context
   */
  private async getRecentConversation(sessionId: string): Promise<string[]> {
    // TODO: Implement conversation history retrieval
    // For now, return empty array
    return [];
  }

  /**
   * Create user-friendly error text for unified system
   */
  private async createUserFriendlyErrorText(error: Error, userInput: string): Promise<string> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        return '❌ I encountered an unexpected error. Please try again or contact support.';
      }

      const prompt = `Create a brief, user-friendly error message for this situation:

Error: ${error.message}
User request: ${userInput}

Return a single line response starting with ❌ that explains what went wrong in simple terms and suggests what to do next.`;

      const response = await openaiService.generateText(userInput, prompt);

      return response.trim() || '❌ Something went wrong. Please try again.';

    } catch {
      return '❌ I encountered an error. Please try your request again.';
    }
  }

  /**
   * Get DraftManager service
   */
  private getDraftManager(): DraftManager | null {
    return getService('draftManager') as DraftManager;
  }

  /**
   * Get ToolExecutorService
   */
  private getToolExecutorService(): ToolExecutorService | null {
    return getService('toolExecutorService') as ToolExecutorService;
  }

  /**
   * Create user-friendly error messages for MasterAgent failures using LLM intelligence
   */
  private async createUserFriendlyErrorMessage(error: Error, userInput: string): Promise<string> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        return 'I encountered an unexpected error while processing your request. Please try again or contact support if the issue continues.';
      }

      const errorAnalysisPrompt = `
You are an expert error message translator. Convert technical error messages into user-friendly responses.

ORIGINAL ERROR: "${error.message}"
USER REQUEST: "${userInput}"

TASK: Create a helpful, non-technical error message that:
1. Explains what went wrong in simple terms
2. Suggests what the user can do about it
3. Is empathetic and professional
4. Avoids technical jargon

RESPONSE FORMAT: Return only the user-friendly error message, no JSON or additional formatting.

GUIDELINES:
- For authentication errors: Suggest checking credentials/settings
- For timeout errors: Suggest simpler requests or trying again
- For rate limit errors: Suggest waiting and trying again
- For API errors: Suggest checking configuration
- For unknown errors: Provide general troubleshooting advice
`;

      const response = await openaiService.generateText(
        errorAnalysisPrompt,
        'You are an error message translator. Return only the user-friendly message.',
        { temperature: 0.3, maxTokens: 200 }
      );

      return response.trim();
    } catch (llmError) {
      // Fallback to a generic message if LLM fails
    return 'I encountered an unexpected error while processing your request. Please try again or contact support if the issue continues.';
    }
  }

  /**
   * Validate and enhance tool calls using agent capabilities
   */
  private async validateAndEnhanceToolCalls(
    toolCalls: ToolCall[], 
    userInput: string, 
    intentAnalysis: {resolvedContacts: Array<{name: string, email: string}>, intent: string},
    logContext: LogContext
  ): Promise<ToolCall[]> {
    const enhancedToolCalls: ToolCall[] = [];
    
    for (const toolCall of toolCalls) {
      // Check if agent exists and is enabled using tool name mapping
      const agent = AgentFactory.getAgentByToolName(toolCall.name);
      if (!agent) {
        logger.warn('Tool call for disabled/missing agent', {
          correlationId: logContext.correlationId,
          operation: 'tool_validation',
          metadata: { toolName: toolCall.name }
        });
        continue;
      }

      // Enhance tool call with agent-specific parameters and resolved contacts
      const enhancedCall = await this.enhanceToolCallWithAgentContext(toolCall, userInput, intentAnalysis, logContext);
      enhancedToolCalls.push(enhancedCall);
    }

    return enhancedToolCalls;
  }

  /**
   * Enhance tool call with agent-specific context and parameters
   */
  private async enhanceToolCallWithAgentContext(
    toolCall: ToolCall, 
    userInput: string, 
    intentAnalysis: {resolvedContacts: Array<{name: string, email: string}>, intent: string},
    logContext: LogContext
  ): Promise<ToolCall> {
    const toolName = toolCall.name;
    
    // Map tool names to agent names for capability lookup
    const toolToAgentMap: Record<string, string> = {
      'emailAgent': 'emailAgent',
      'contactAgent': 'contactAgent', 
      'calendarAgent': 'calendarAgent',
      'Think': 'Think',
      'slackAgent': 'slackAgent'
    };

    const agentName = toolToAgentMap[toolName];
    const agentCapabilities = agentName ? (await this.getAgentCapabilities())[agentName] : null;
    
    if (!agentCapabilities) {
      return toolCall;
    }

    // Add agent-specific enhancements based on capabilities
    const enhancedParameters = { ...toolCall.parameters };

    // Fix email parameter mapping: Handle both recipientName and recipients properly

    if (toolName === "manage_emails" || toolName === "send_email") {
      // Handle recipientName -> recipients conversion
      if (enhancedParameters.recipientName && !enhancedParameters.recipients) {
        enhancedParameters.recipients = [enhancedParameters.recipientName];
        delete enhancedParameters.recipientName;
      }
      // Ensure recipients is always an array
      if (enhancedParameters.recipients && !Array.isArray(enhancedParameters.recipients)) {
        enhancedParameters.recipients = [enhancedParameters.recipients];
      }

      // Check if we need to resolve contact names to email addresses
      const needsContactResolution = this.needsContactResolution(enhancedParameters.recipients);
      if (needsContactResolution) {
        
        try {
          // Use pre-resolved contacts from intent analysis if available
          const resolvedRecipients = await this.resolveContactNamesWithIntent(
            enhancedParameters.recipients, 
            intentAnalysis.resolvedContacts
          );
          enhancedParameters.recipients = resolvedRecipients;
          
        } catch (error) {
          logger.error('Contact resolution failed', {
            error: (error as Error).message,
            stack: (error as Error).stack,
            correlationId: logContext.correlationId,
            operation: 'contact_resolution',
            metadata: { toolName, recipients: enhancedParameters.recipients }
          });
          // Keep original recipients and let EmailAgent handle the error
        }
      }
    }

    // For calendar operations, add conflict detection
    if (toolName === 'manage_calendar') {
      enhancedParameters.enableConflictDetection = true;
    }

    return {
      name: toolCall.name,
      parameters: enhancedParameters
    };
  }

  /**
   * Check if recipients need contact resolution (contain person names instead of email addresses)
   */
  private needsContactResolution(recipients: string[]): boolean {
    if (!recipients || recipients.length === 0) {
      return false;
    }

    // Check if any recipient looks like a person name instead of an email address
    return recipients.some(recipient => {
      // Simple heuristic: if it doesn't contain @ and doesn't look like an email, it's probably a name
      return !recipient.includes('@') && !recipient.includes('.') && recipient.length > 0;
    });
  }

  /**
   * Resolve contact names to email addresses using ContactAgent
   */
  private async resolveContactNames(recipients: string[]): Promise<string[]> {
    const resolvedRecipients: string[] = [];
    
    for (const recipient of recipients) {
      // If it's already an email address, keep it as is
      if (recipient.includes('@')) {
        resolvedRecipients.push(recipient);
        continue;
      }

      try {
        // Call ContactAgent to resolve the contact name
        const contactAgent = this.getContactAgent();
        if (!contactAgent) {
          logger.warn('ContactAgent not available for contact resolution', {
            correlationId: 'contact-resolution',
            operation: 'contact_resolution',
            metadata: { recipient }
          });
          resolvedRecipients.push(recipient); // Keep original, let EmailAgent handle the error
          continue;
        }

        // Create a mock context for the contact resolution
        const mockContext: ToolExecutionContext = {
          sessionId: `contact-resolution-${Date.now()}`,
          userId: 'system',
          timestamp: new Date()
        };

        // Call ContactAgent to search for the contact
        const contactResult = await contactAgent.execute({
          query: `Find contact information for ${recipient}`,
          operation: 'search',
          name: recipient,
          accessToken: 'system-token' // Use system token for contact resolution
        }, mockContext);

        if (contactResult.success && contactResult.result) {
          const contacts = (contactResult.result as any).contacts || [];
          if (contacts.length > 0) {
            // Use the first contact's email address
            const email = contacts[0].email || contacts[0].emailAddress;
            if (email) {
              resolvedRecipients.push(email);
              continue;
            }
          }
        }

        // If resolution failed, keep the original recipient
        resolvedRecipients.push(recipient);

      } catch (error) {
        // Keep original recipient on error
        resolvedRecipients.push(recipient);
      }
    }

    return resolvedRecipients;
  }

  /**
   * Resolve contact names using pre-resolved contacts from intent analysis
   */
  private async resolveContactNamesWithIntent(
    recipients: string[], 
    resolvedContacts: Array<{name: string, email: string}>
  ): Promise<string[]> {
    const resolvedRecipients: string[] = [];
    
    for (const recipient of recipients) {
      // If it's already an email address, keep it as is
      if (recipient.includes('@')) {
        resolvedRecipients.push(recipient);
        continue;
      }

      // Look for this recipient in the pre-resolved contacts
      const resolvedContact = resolvedContacts.find(contact => 
        contact.name.toLowerCase() === recipient.toLowerCase()
      );

      if (resolvedContact && resolvedContact.email) {
        resolvedRecipients.push(resolvedContact.email);
        continue;
      }

      // If not found in pre-resolved contacts, try to resolve using ContactAgent
      try {
        const contactAgent = this.getContactAgent();
        if (!contactAgent) {
          resolvedRecipients.push(recipient); // Keep original, let EmailAgent handle the error
          continue;
        }

        // Create a mock context for the contact resolution
        const mockContext: ToolExecutionContext = {
          sessionId: `contact-resolution-${Date.now()}`,
          userId: 'system',
          timestamp: new Date()
        };

        // Call ContactAgent to search for the contact
        const contactResult = await contactAgent.execute({
          query: `Find contact information for ${recipient}`,
          operation: 'search',
          name: recipient,
          accessToken: 'system-token' // Use system token for contact resolution
        }, mockContext);

        if (contactResult.success && contactResult.result) {
          const contacts = (contactResult.result as any).contacts || [];
          if (contacts.length > 0) {
            // Use the first contact's email address
            const email = contacts[0].email || contacts[0].emailAddress;
            if (email) {
              resolvedRecipients.push(email);
              continue;
            }
          }
        }

        // If resolution failed, keep the original recipient
        resolvedRecipients.push(recipient);

      } catch (error) {
        // Keep original recipient on error
        resolvedRecipients.push(recipient);
      }
    }

    return resolvedRecipients;
  }

  /**
   * Parse user intent and resolve dependencies (like contact names)
   */
  private async parseIntentAndResolveDependencies(
    userInput: string, 
    contextGathered: ContextGatheringResult | undefined,
    logContext: LogContext
  ): Promise<{resolvedContacts: Array<{name: string, email: string}>, intent: string}> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        throw ErrorFactory.serviceUnavailable('OpenAI', {
          correlationId: logContext.correlationId,
          userId: logContext.userId,
          operation: 'intent_parsing',
          metadata: { message: 'OpenAI service is required for intent parsing' }
        });
      }

      // Extract contact names that need resolution
      const contactExtractionResponse = await openaiService.generateText(
        `Extract person names and email addresses from: "${userInput}"
        
        Return JSON: {"needed": boolean, "names": ["name1", "name2"], "emails": ["email1@example.com"]}
        
        Examples:
        - "Send email to John" → {"needed": true, "names": ["John"]}
        - "Email john@example.com" → {"needed": true, "names": [], "emails": ["john@example.com"]}
        - "Schedule meeting with Sarah" → {"needed": true, "names": ["Sarah"]}
        - "What's on my calendar?" → {"needed": false, "names": []}`,
        'Extract contact names from user requests. Always return valid JSON.',
        { temperature: 0, maxTokens: 100 }
      );

      const contactExtraction = this.extractJsonFromResponse(contactExtractionResponse);
      const resolvedContacts: Array<{name: string, email: string}> = [];
      
      // Add email addresses directly (no resolution needed)
      if (contactExtraction.emails && contactExtraction.emails.length > 0) {
        for (const email of contactExtraction.emails) {
          resolvedContacts.push({
            name: email,
            email: email
          });
        }
      }

      // Store contact names for resolution during tool execution
      // Note: We don't resolve here because we don't have access token yet
      // Resolution will happen in enhanceToolCallWithAgentContext when we have proper context
      if (contactExtraction.needed && contactExtraction.names.length > 0) {

        for (const name of contactExtraction.names) {
          resolvedContacts.push({
            name: name,
            email: '' // Will be resolved during tool execution with proper access token
          });
        }
      }

      return {
        resolvedContacts,
        intent: userInput
      };
    } catch (error) {
      logger.error('Failed to parse intent and resolve dependencies', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        correlationId: logContext.correlationId,
        operation: 'intent_parsing',
        metadata: { userInput: userInput.substring(0, 100) }
      });
      return {
        resolvedContacts: [],
        intent: userInput
      };
    }
  }

  /**
   * Extract JSON from OpenAI response, handling markdown code blocks
   */
  private extractJsonFromResponse(response: string): any {
    try {
      // First, try to parse directly
      return JSON.parse(response);
    } catch (error) {
      // If direct parsing fails, try to extract from markdown code blocks
      try {
        // Look for JSON in markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1]);
        }
        
        // Look for JSON without code blocks
        const jsonMatch2 = response.match(/\{[\s\S]*\}/);
        if (jsonMatch2 && jsonMatch2[0]) {
          return JSON.parse(jsonMatch2[0]);
        }
        
        // If all else fails, return default structure
        logger.warn('Failed to parse JSON from OpenAI response', {
          correlationId: 'json-parsing',
          operation: 'json_extraction',
          metadata: { 
            responseLength: response.length,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
        return {
          needed: false,
          names: [],
          emails: []
        };
      } catch (extractError) {
        logger.error('Failed to extract JSON from response', {
          error: (extractError as Error).message,
          stack: (extractError as Error).stack,
          correlationId: 'json-parsing',
          operation: 'json_extraction',
          metadata: { 
            responseLength: response.length,
            extractError: extractError instanceof Error ? extractError.message : 'Unknown error'
          }
        });
        
        return {
          needed: false,
          names: [],
          emails: []
        };
      }
    }
  }

  /**
   * Generate enhanced system prompt with agent capabilities and context
   */
  private async generateEnhancedSystemPrompt(contextGathered?: ContextGatheringResult, intentAnalysis?: any): Promise<string> {
    const basePrompt = this.generateSystemPrompt();
    const agentCapabilities = await this.getAgentCapabilities();
    
    const capabilitiesSection = `
## Agent Capabilities and Limitations

### Email Agent (emailAgent)
**Capabilities:**
${agentCapabilities.emailAgent?.capabilities.map((cap: string) => `- ${cap}`).join('\n') || 'No capabilities available'}

**Limitations:**
${agentCapabilities.emailAgent?.limitations.map((lim: string) => `- ${lim}`).join('\n') || 'No limitations available'}

### Contact Agent (contactAgent)
**Capabilities:**
${agentCapabilities.contactAgent?.capabilities.map((cap: string) => `- ${cap}`).join('\n') || 'No capabilities available'}

**Limitations:**
${agentCapabilities.contactAgent?.limitations.map((lim: string) => `- ${lim}`).join('\n') || 'No limitations available'}

### Calendar Agent (calendarAgent)
**Capabilities:**
${agentCapabilities.calendarAgent?.capabilities.map((cap: string) => `- ${cap}`).join('\n') || 'No capabilities available'}

**Limitations:**
${agentCapabilities.calendarAgent?.limitations.map((lim: string) => `- ${lim}`).join('\n') || 'No limitations available'}

## Multi-Agent Orchestration Rules

### Email Operations
- **DIRECT EMAIL ADDRESSES**: When user provides email addresses (contains @domain.com), call emailAgent DIRECTLY
  - Example: "send email to john@company.com" → generate ONLY emailAgent call
  - NO contact resolution needed
- **PERSON NAMES**: When user provides person names (no @ symbol), use TWO-STEP process:
  1. First: contactAgent with search operation for the person's name
  2. Second: emailAgent with the resolved email address from step 1
  - Example: "send email to John Smith" → generate contactAgent call, then emailAgent call

### Calendar Operations
- **EMAIL ATTENDEES**: When attendees are email addresses, call calendarAgent DIRECTLY
- **NAME ATTENDEES**: When attendees are person names, use TWO-STEP process:
  1. First: contactAgent with search operation for attendee names
  2. Second: calendarAgent with resolved email addresses from step 1

### General Rules
- **SMART DETECTION**: Analyze the input to distinguish between email addresses and person names
- **NO UNNECESSARY STEPS**: Don't call contactAgent when email addresses are already provided
- **CONFIRMATION REQUIRED**: Both email and calendar operations should require user confirmation
- Always call Think tool at the end to verify correct orchestration

## Tool Call Generation Rules
- **"send email to john@company.com"** → Generate emailAgent call ONLY (no contactAgent)
- **"send email to John Smith"** → Generate contactAgent call first, then emailAgent call
- **"schedule meeting with john@company.com"** → Generate calendarAgent call ONLY (no contactAgent)
- **"schedule meeting with John Smith"** → Generate contactAgent call first, then calendarAgent call

## Email Address Detection
- Pattern: contains @ symbol and domain (e.g., user@domain.com)
- If detected: Skip contact resolution, go directly to emailAgent
- If NOT detected: Use contact resolution workflow`;

    let contextSection = '';
    if (contextGathered && contextGathered.relevantContext) {
      contextSection = `

## Current Context
Based on recent Slack messages, here's relevant context for this request:

${contextGathered.relevantContext}

Use this context to better understand the user's intent and provide more accurate responses.`;
    }

    return `${basePrompt}\n\n${capabilitiesSection}${contextSection}`;
  }



  /**
   * Generate AI-driven system prompt with dynamic agent capabilities
   */
  private generateSystemPrompt(): string {
    const basePrompt = `# AI Personal Assistant
You're a smart personal assistant that helps users by coordinating different tools and agents.

Be helpful, professional, and take intelligent action rather than asking for clarification when possible.

## Agent Orchestration Rules
- **CRITICAL: ALWAYS CALL TOOLS FOR USER REQUESTS** - Never respond without calling appropriate tools
- **EMAIL REQUESTS**: When user says "send email", "email", or mentions email addresses (@ symbol), ALWAYS call emailAgent tool
- **CONTACT REQUESTS**: When user says "find contact", "search contact", or mentions person names (no @), call contactAgent tool  
- **CALENDAR REQUESTS**: When user says "schedule", "meeting", "calendar", or mentions dates/times, call calendarAgent tool
- **SLACK REQUESTS**: When user asks about messages, conversations, or Slack context, call slackAgent tool
- **ALWAYS END WITH THINK**: After calling any tool, ALWAYS call Think tool to verify correct orchestration
- **CONFIRMATION REQUIRED**: All email and calendar operations require user confirmation before execution
- **DISTINGUISH EMAIL vs NAME**: Analyze input to detect email addresses vs person names automatically

## Context Gathering Strategy
- **For ambiguous requests**: FIRST call Slack agent to read recent conversation history
- **For follow-up questions**: Use previous message context to infer what user likely wants
- **For email requests**: If unclear, show recent emails, unread emails, or broader email list rather than asking
- **For calendar requests**: If unclear, show today's/upcoming events rather than asking for specifics
- **Default to helpful action**: When in doubt, provide useful information rather than requesting clarification

## Examples of Tool Usage
- User mentions email addresses (@ symbol) → Call emailAgent tool
- User mentions person names (no @ symbol) → Call contactAgent tool
- User mentions dates/times/scheduling → Call calendarAgent tool
- User asks about messages/conversations → Call slackAgent tool
- After ANY tool call → ALWAYS call Think tool

## Current Context
- Current date/time: ${new Date().toISOString()}
- Today is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current time: ${new Date().toLocaleTimeString('en-US', { hour12: true, timeZoneName: 'short' })}
- Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Session-based processing for user context

## Time and Date Guidelines
- When users ask about "today", "tomorrow", "this week", etc., use the current date/time above as reference
- For calendar operations, always specify explicit dates and times, not relative terms
- Default to user's local timezone unless specified otherwise
- When listing calendar events, ALWAYS show them in strict chronological order from earliest to latest with clear time labels
- IMPORTANT: Sort all calendar events by start time before displaying to ensure proper chronological ordering

## Response Guidelines
- Be specific and actionable
- Use clear formatting for multiple items
- When things fail, explain what happened and suggest next steps

## Error Handling
- Give simple, clear explanations when things go wrong
- Always suggest what to try next`;

    // Get dynamic tool information from AgentFactory
    const toolsSection = AgentFactory.generateSystemPrompts();
    
    return `${basePrompt}\n\n${toolsSection}`;
  }


  /**
   * Get the system prompt for external use (e.g., when integrating with OpenAI)
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    const now = Date.now();
    // Check memory every 30 seconds
    if (now - this.lastMemoryCheck < 30000) {
      return;
    }

    this.lastMemoryCheck = now;
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    logger.debug('Memory usage check', {
      correlationId: 'memory-check',
      operation: 'memory_monitoring',
      metadata: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      }
    });

    // If heap usage exceeds threshold, trigger garbage collection and cleanup
    if (heapUsedMB > APP_CONSTANTS.MEMORY_WARNING_THRESHOLD_MB) {
      logger.warn('High memory usage detected, triggering cleanup', {
        correlationId: 'memory-check',
        operation: 'memory_cleanup',
        metadata: {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`
        }
      });
      
      // Clear agent schemas to free memory
      if (this.agentSchemas.size > 0) {
        const schemasSize = this.agentSchemas.size;
        this.agentSchemas.clear();
        // Reinitialize immediately to maintain functionality
        this.initializeAgentSchemas().catch(error => {
          logger.error('Failed to reinitialize agent schemas', error, {
            correlationId: 'memory-cleanup',
            operation: 'schema_reinit',
            metadata: { previousSize: schemasSize }
          });
        });
        logger.debug('Agent schemas cleared and reinitialized', {
          correlationId: 'memory-cleanup',
          operation: 'schema_reinit',
          metadata: { previousSize: schemasSize }
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.debug('Forced garbage collection completed', {
          correlationId: 'memory-cleanup',
          operation: 'garbage_collection'
        });
      }
    }
  }

  /**
   * Process tool results through LLM to generate natural language responses
   */
  async processToolResultsWithLLM(
    userInput: string, 
    toolResults: ToolResult[], 
    sessionId: string,
    logContext: LogContext
  ): Promise<string> {
    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      throw ErrorFactory.serviceUnavailable('OpenAI', {
        correlationId: logContext.correlationId,
        userId: logContext.userId,
        operation: 'ai_processing',
        metadata: { message: 'AI natural language processing is required for this operation' }
      });
    }

    try {
      const toolResultsSummary = toolResults.map(tr => ({
        toolName: tr.toolName,
        success: tr.success,
        result: this.truncateToolResultForLLM(tr.result),
        error: tr.error
      }));

      logger.debug('Processing tool results with LLM', {
        correlationId: logContext.correlationId,
        operation: 'tool_result_processing',
        metadata: {
          userInput: userInput.substring(0, 100),
          toolResultsCount: toolResults.length,
          sessionId
        }
      });

      const prompt = `User asked: "${userInput}"

Here's the data from your tools:
${JSON.stringify(toolResultsSummary, null, 2)}

Respond naturally and conversationally. Skip technical details like URLs, IDs, and metadata. Don't use markdown formatting - just plain text that's easy to read.`;

      const response = await openaiService.generateText(
        prompt,
        'Generate natural language responses from tool execution results',
        { temperature: 0.7, maxTokens: 1000 }
      );

      return response.trim();
    } catch (error) {
      logger.error('Error processing tool results with LLM', error as Error, {
        correlationId: logContext.correlationId,
        operation: 'tool_result_processing',
        metadata: { userInput: userInput.substring(0, 100) }
      });
      
      // Check if it's a context length error
      if (error instanceof Error && error.message.includes('maximum context length')) {
        logger.warn('Context length exceeded - AI processing failed', {
          correlationId: logContext.correlationId,
          operation: 'tool_result_processing',
          metadata: { errorType: 'context_length_exceeded' }
        });
        throw ErrorFactory.serviceError('OpenAI', 'AI service encountered a context length limit', {
        correlationId: logContext.correlationId,
        userId: logContext.userId,
        operation: 'ai_context_limit',
        metadata: { message: 'Please try with a simpler request or break it into smaller parts' }
      });
      }
      
      throw ErrorFactory.serviceError('OpenAI', 'AI natural language processing failed', {
        correlationId: logContext.correlationId,
        userId: logContext.userId,
        operation: 'ai_processing_error',
        metadata: { message: 'Please check your OpenAI configuration' }
      });
    }
  }

  /**
   * Truncate tool results to prevent context length issues
   */
  private truncateToolResultForLLM(result: any): any {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Create a copy to avoid modifying the original
    const truncated = { ...result };

    // Truncate email content specifically
    if (truncated.emails && Array.isArray(truncated.emails)) {
      truncated.emails = truncated.emails.map((email: any) => {
        if (email && typeof email === 'object') {
          const truncatedEmail = { ...email };
          
          // Truncate email body content
          if (truncatedEmail.body) {
            if (truncatedEmail.body.text && truncatedEmail.body.text.length > 500) {
              truncatedEmail.body.text = truncatedEmail.body.text.substring(0, 500) + '...';
            }
            if (truncatedEmail.body.html && truncatedEmail.body.html.length > 500) {
              truncatedEmail.body.html = truncatedEmail.body.html.substring(0, 500) + '...';
            }
          }
          
          // Truncate snippet
          if (truncatedEmail.snippet && truncatedEmail.snippet.length > 200) {
            truncatedEmail.snippet = truncatedEmail.snippet.substring(0, 200) + '...';
          }
          
          return truncatedEmail;
        }
        return email;
      });
    }

    // Truncate other large text fields
    if (truncated.message && truncated.message.length > 1000) {
      truncated.message = truncated.message.substring(0, 1000) + '...';
    }

    return truncated;
  }


  /**
   * Get WorkflowCacheService instance
   */
  /**
   * Simple workflow management methods (replacing WorkflowCacheService)
   */
  private createWorkflow(workflow: SimpleWorkflowState): void {
    this.workflows.set(workflow.workflowId, workflow);

    // Add to session's active workflows
    const sessionWorkflows = this.sessionWorkflows.get(workflow.sessionId) || [];
    sessionWorkflows.push(workflow.workflowId);
    this.sessionWorkflows.set(workflow.sessionId, sessionWorkflows);
  }

  private getActiveWorkflows(sessionId: string): SimpleWorkflowState[] {
    const workflowIds = this.sessionWorkflows.get(sessionId) || [];
    return workflowIds
      .map(id => this.workflows.get(id))
      .filter((w): w is SimpleWorkflowState => w !== undefined && w.status === 'active');
  }

  private updateWorkflow(workflowId: string, updates: Partial<SimpleWorkflowState>): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      Object.assign(workflow, updates, { lastActivity: new Date() });
      this.workflows.set(workflowId, workflow);
    }
  }

  private cancelWorkflow(workflowId: string): void {
    this.updateWorkflow(workflowId, { status: 'cancelled' });
  }

  // Removed getIntentAnalysisService - using only NextStepPlanningService for all planning






  /**
   * Internal tool call execution for workflow steps - now uses real ToolExecutorService
   */
  private async executeToolCallInternal(
    toolCall: ToolCall,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ToolResult> {
    logger.info('Tool execution started', {
      toolName: toolCall.name,
      parameters: toolCall.parameters,
      sessionId,
      userId,
      operation: 'tool_execution_start'
    });

    try {
      // Use real ToolExecutorService instead of mock implementation
      const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
      if (!toolExecutorService) {
        throw ErrorFactory.serviceUnavailable('ToolExecutorService', {
          correlationId: `tool-exec-${Date.now()}`,
          operation: 'tool_executor_execution'
        });
      }

      // Create execution context
      const context: ToolExecutionContext = {
        sessionId,
        userId: userId || 'unknown',
        timestamp: new Date(),
        slackContext
      };

      // Execute real tool call
      const result = await toolExecutorService.executeTool(toolCall, context);

      logger.info('Tool execution successful', {
        toolName: toolCall.name,
        result: result,
        sessionId,
        userId,
        operation: 'tool_execution_success'
      });

      return result;
    } catch (error) {
      logger.error('Tool execution failed', {
        toolName: toolCall.name,
        error: (error as Error).message,
        stack: (error as Error).stack,
        sessionId,
        userId,
        operation: 'tool_execution_error'
      });

      return {
        success: false,
        toolName: toolCall.name,
        executionTime: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Internal natural language response generation for workflow steps
   */
  private async generateNaturalLanguageResponseInternal(
    userInput: string,
    toolResults: ToolResult[],
    sessionId: string
  ): Promise<string> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        return 'Step executed successfully.';
      }

      const toolResultsSummary = toolResults.map(tr => ({
        toolName: tr.toolName,
        success: tr.success,
        result: this.truncateToolResultForLLM(tr.result),
        error: tr.error
      }));

      const prompt = `User asked: "${userInput}"

Here's the data from your tools:
${JSON.stringify(toolResultsSummary, null, 2)}

Respond naturally and conversationally. Skip technical details like URLs, IDs, and metadata. Don't use markdown formatting - just plain text that's easy to read.`;

      const response = await openaiService.generateText(
        prompt,
        'Generate natural language responses from tool execution results',
        { temperature: 0.7, maxTokens: 1000 }
      );

      return response.trim();
    } catch (error) {
      logger.error('Error processing tool results with LLM', error as Error, {
        correlationId: `workflow-response-${Date.now()}`,
        operation: 'workflow_response_generation',
        metadata: { userInput: userInput.substring(0, 100) }
      });
      
      return 'Step executed successfully.';
    }
  }
  // Removed executeWorkflowWithSequentialExecution - using only Master Agent step-by-step execution
  // This eliminates dual execution paths and ensures consistent behavior

  // Removed unused context analysis methods - consolidated into simplified step-by-step execution
  // - continueWorkflowWithContext
  // - pauseAndAddressInterruption
  // - branchWorkflow
  // - seekClarification

  /**
   * Abort workflow
   */
  private async abortWorkflow(workflowId: string): Promise<void> {
    try {
      this.cancelWorkflow(workflowId);

      logger.debug('Workflow aborted', {
        correlationId: `abort-workflow-${workflowId}`,
        operation: 'abort_workflow',
        metadata: { workflowId }
      });
    } catch (error) {
      logger.error('Error aborting workflow', error as Error, {
        correlationId: `abort-workflow-error-${workflowId}`,
        operation: 'abort_workflow_error',
        metadata: { workflowId }
      });
    }
  }

  /**
   * Fallback interruption handling
   */
  private async handleWorkflowInterruptionFallback(
    userInput: string,
    sessionId: string,
    activeWorkflow: SimpleWorkflowState,
    userId?: string
  ): Promise<MasterAgentResponse> {
    // Original interruption logic as fallback
    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      return await this.executeStepByStep(userInput, sessionId, userId);
    }

    const analysisPrompt = `
You are analyzing whether a user's new input relates to an ongoing workflow.

CURRENT WORKFLOW:
- Workflow ID: ${activeWorkflow.workflowId}
- Original Request: "${activeWorkflow.context.originalRequest}"
- Current Step: ${activeWorkflow.currentStep}/${activeWorkflow.totalSteps}

NEW USER INPUT: "${userInput}"

Return JSON: { "relatesToWorkflow": true/false, "action": "continue|new" }
`;

    try {
      const analysisResponse = await openaiService.generateText(
        analysisPrompt,
        'Return only valid JSON.',
        { temperature: 0.1, maxTokens: 200 }
      );

      const analysis = JSON.parse(analysisResponse);

      if (analysis.relatesToWorkflow) {
        return await this.executeStepByStep(userInput, sessionId, userId);
      } else {
        await this.abortWorkflow(activeWorkflow.workflowId);
        return await this.executeStepByStep(userInput, sessionId, userId);
      }
    } catch (error) {
      return await this.executeStepByStep(userInput, sessionId, userId);
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: Error): MasterAgentResponse {
    return {
      message: `I encountered an error: ${error.message}. Let me try to help you in a different way.`,
      executionMetadata: {
        error: error.message,
        errorType: error.constructor.name,
        workflowAction: 'error'
      }
    };
  }

  /**
   * Continue existing step-by-step workflow with new user input
   */
  async continueStepByStepWorkflow(
    userInput: string,
    activeWorkflow: SimpleWorkflowState,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    const correlationId = `continue-step-by-step-${sessionId}-${Date.now()}`;
    const logContext: LogContext = {
      correlationId,
      userId,
      sessionId,
      operation: 'continueStepByStepWorkflow',
      metadata: {
        inputLength: userInput.length,
        workflowId: activeWorkflow.workflowId,
        currentStep: activeWorkflow.currentStep
      }
    };

    try {
      logger.info('Continuing step-by-step workflow with new input', logContext);

      // Simplified workflow interruption handling - treat any new input as starting a new workflow
      this.updateWorkflow(activeWorkflow.workflowId, {
        status: 'cancelled',
        lastActivity: new Date()
      });
      return await this.executeStepByStep(userInput, sessionId, userId, slackContext);
    } catch (error) {
      logger.error('Failed to continue step-by-step workflow', error as Error, logContext);
      return this.createErrorResponse(error as Error);
    }
  }

  /**
   * Execute workflow using step-by-step planning instead of upfront planning
   */
  async executeStepByStep(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    logger.info('Starting step-by-step execution', {
      userInput,
      sessionId,
      userId,
      hasSlackContext: !!slackContext,
      operation: 'step_by_step_execution_start'
    });
    
    const startTime = Date.now();
    const correlationId = `step-by-step-${sessionId}-${Date.now()}`;
    const logContext: LogContext = {
      correlationId,
      userId,
      sessionId,
      operation: 'executeStepByStep',
      metadata: { inputLength: userInput.length }
    };

    try {
      logger.info('Starting step-by-step execution', logContext);

      // Initialize workflow context
      const workflowContext: WorkflowContext = {
        originalRequest: userInput,
        currentStep: 1,
        maxSteps: 10,
        completedSteps: [],
        gatheredData: {},
        userContext: { slackContext, userId, sessionId }
      };

      // Create workflow state for tracking
      const workflowId = `stepbystep-${sessionId}-${Date.now()}`;
      const workflowState: SimpleWorkflowState = {
        workflowId,
        sessionId,
        status: 'active',
        currentStep: 0,
        totalSteps: 0, // Will be updated dynamically
        context: {
          originalRequest: userInput,
          userIntent: userInput, // Same as original request for now
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date()
      };

      // Save initial workflow state
      this.createWorkflow(workflowState);

      // Execute step-by-step loop
      const result = await this.executeStepByStepLoop(workflowContext, workflowId, sessionId, userId, slackContext);

      const endTime = Date.now();
      logger.info('Step-by-step execution completed', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          processingTime: endTime - startTime,
          totalSteps: workflowContext.completedSteps.length,
          success: true
        }
      });

      return result;
    } catch (error) {
      logger.error('Step-by-step execution failed', error as Error, logContext);
      return this.createErrorResponse(error as Error);
    }
  }

  /**
   * Execute the step-by-step workflow loop
   */
  private async executeStepByStepLoop(
    workflowContext: WorkflowContext,
    workflowId: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    logger.info('Starting step-by-step loop', {
      workflowId,
      currentStep: workflowContext.currentStep,
      maxSteps: workflowContext.maxSteps,
      sessionId,
      userId,
      operation: 'step_by_step_loop_start'
    });
    
    const nextStepPlanningService = getService<NextStepPlanningService>('nextStepPlanningService');
    if (!nextStepPlanningService) {
      throw ErrorFactory.serviceUnavailable('NextStepPlanningService', {
        correlationId: `step-loop-${Date.now()}`,
        operation: 'step_planning'
      });
    }

    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];
    let finalMessage = '';

    while (workflowContext.currentStep <= workflowContext.maxSteps) {
      logger.debug('Planning step', {
        stepNumber: workflowContext.currentStep,
        workflowId,
        sessionId,
        userId,
        operation: 'step_planning'
      });
      // Plan next step
      const nextStep = await nextStepPlanningService.planNextStep(workflowContext);

      // If no more steps, we're done
      if (!nextStep) {
        logger.info('Workflow complete - no more steps', {
          workflowId,
          sessionId,
          userId,
          operation: 'workflow_complete'
        });
        finalMessage = `Task completed successfully! I have processed your request: "${workflowContext.originalRequest}"`;
        break;
      }

      logger.info('Executing step', {
        stepNumber: nextStep.stepNumber,
        description: nextStep.description,
        agent: nextStep.agent,
        workflowId,
        sessionId,
        userId,
        operation: 'step_execution'
      });
      logger.debug('Step details', {
        stepOperation: nextStep.operation,
        parameters: nextStep.parameters,
        stepNumber: nextStep.stepNumber,
        workflowId,
        sessionId,
        userId,
        operation: 'step_details'
      });

      logger.debug('Executing step', {
        correlationId: `step-${workflowContext.currentStep}`,
        operation: 'step_execution',
        metadata: {
          stepNumber: nextStep.stepNumber,
          agent: nextStep.agent,
          operation: nextStep.operation,
          description: nextStep.description
        }
      });

      try {
        // Execute the step
        const toolCall: ToolCall = {
          name: nextStep.agent,
          parameters: {
            operation: nextStep.operation,
            ...nextStep.parameters
          }
        };

        logger.debug('Executing tool call', {
          toolCall: toolCall,
          stepNumber: nextStep.stepNumber,
          workflowId,
          sessionId,
          userId,
          operation: 'tool_call_execution'
        });
        const toolResult = await this.executeToolCallInternal(toolCall, sessionId, userId, slackContext);
        logger.debug('Tool execution completed', {
          toolResult: toolResult,
          stepNumber: nextStep.stepNumber,
          workflowId,
          sessionId,
          userId,
          operation: 'tool_execution_completed'
        });

        // Create step result
        const stepResult: NextStepResult = {
          stepNumber: nextStep.stepNumber,
          agent: nextStep.agent,
          operation: nextStep.operation,
          parameters: nextStep.parameters,
          result: toolResult.result,
          success: toolResult.success,
          error: toolResult.error,
          executedAt: new Date()
        };

        // Analyze step result
        const stepAnalysis = await nextStepPlanningService.analyzeStepResult(stepResult, workflowContext);

        // Update workflow context
        workflowContext.completedSteps.push(stepResult);
        workflowContext.currentStep++;

        // Merge any updated context
        if (stepAnalysis.updatedContext) {
          workflowContext.gatheredData = {
            ...workflowContext.gatheredData,
            ...stepAnalysis.updatedContext.gatheredData
          };
        }

        toolCalls.push(toolCall);
        toolResults.push(toolResult);

        // Check if task is complete
        if (stepAnalysis.isComplete) {
          finalMessage = `Task completed! ${stepAnalysis.analysis}`;
          break;
        }

        // Check if user input is needed
        if (stepAnalysis.needsUserInput) {
          finalMessage = `I need more information from you. ${stepAnalysis.analysis}`;
          break;
        }

        // Check if we should continue
        if (!stepAnalysis.shouldContinue) {
          finalMessage = `Workflow paused. ${stepAnalysis.analysis}`;
          break;
        }

      } catch (stepError) {
        // Handle step execution error
        // Simple error handling without operation detection service
        const error = stepError as Error;
        finalMessage = `Step execution failed: ${error.message}. Please try rephrasing your request.`;

        throw ErrorFactory.businessRuleViolation('step_execution_failed', {
          correlationId: `step-exec-failed-${Date.now()}`,
          operation: 'step_execution',
          metadata: {
            errorMessage: error.message,
            agent: nextStep.agent,
            operation: nextStep.operation
          }
        });
        break;
      }
    }

    // Generate final natural language response
    if (!finalMessage) {
      finalMessage = `I've completed ${workflowContext.completedSteps.length} steps for your request, but reached the maximum step limit.`;
    }

    const naturalResponse = await this.generateNaturalLanguageResponseInternal(
      finalMessage,
      toolResults,
      sessionId
    );

    return {
      message: naturalResponse,
      toolCalls,
      toolResults,
      executionMetadata: {
        processingTime: 0, // Will be calculated by caller
        workflowId,
        totalSteps: workflowContext.completedSteps.length,
        workflowAction: 'step_by_step_completed'
      }
    };
  }


  public cleanup(): void {
    this.agentSchemas.clear();
    logger.debug('MasterAgent cleanup completed', {
      correlationId: 'cleanup',
      operation: 'agent_cleanup',
      metadata: { service: 'MasterAgent' }
    });
  }
}