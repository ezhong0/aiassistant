import logger from '../utils/logger';
import { AppError, ErrorFactory, ERROR_CATEGORIES } from '../utils/app-error';
import { OpenAIService } from '../services/openai.service';
import { LogContext } from '../utils/log-context';
import { PromptUtils } from '../utils/prompt-utils';
// Agents are now stateless
import { ToolCall, ToolResult, MasterAgentConfig, ToolExecutionContext, ToolCallSchema, ToolResultSchema } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { OpenAIFunctionSchema } from '../framework/agent-factory';
import { getService } from '../services/service-manager';
import { SlackContext, SlackContextSchema } from '../types/slack/slack.types';
import { SlackMessage } from '../types/slack/slack-message-reader.types';
import { APP_CONSTANTS } from '../config/constants';
import { ContextGatheringResult, ContextDetectionResult } from './slack.agent';
import { z } from 'zod';
// Import WorkflowOrchestrator for extracted workflow functionality
import { WorkflowOrchestrator, SimpleWorkflowState, SimpleWorkflowStep } from '../framework/workflow-orchestrator';
import { DraftManager, Draft, WriteOperation } from '../services/draft-manager.service';
import { StringPlanningService, StringWorkflowContext, StringStepPlan, StringStepResult } from '../services/string-planning.service';
import { ToolExecutorService } from '../services/tool-executor.service';

/**
 * Result interface for processing
 */
export interface ProcessingResult {
  message: string;           // Natural language response WITH draft contents
  needsConfirmation: boolean;
  draftId?: string;         // ID for tracking draft
  draftContents?: {         // Structured draft data for UI display
    action: string;
    recipient?: string;
    subject?: string;
    body?: string;
    previewData: any;
  };
  toolCall?: ToolCall;      // The tool call that was drafted
  toolResults?: ToolResult[]; // For direct execution
  success: boolean;
  executionMetadata?: {
    processingTime?: number;
    workflowId?: string;
    totalSteps?: number;
    workflowAction?: string;
  };
}

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
  slackContext?: {
    channel: string;
    userId: string;
    teamId: string;
    threadTs?: string;
    recentMessages?: Array<{
      text: string;
      user: string;
      timestamp: string;
    }>;
  };
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
 * // response.message contains human-readable response
 * // response.toolCalls contains generated tool calls
 * ```
 */
export class MasterAgent {
  private useOpenAI: boolean = false;
  private lastMemoryCheck: number = Date.now();

  // Extracted component for workflow management
  private workflowOrchestrator: WorkflowOrchestrator;


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
    // Initialize extracted workflow component
    this.workflowOrchestrator = new WorkflowOrchestrator();


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
   * Get agent capabilities summary for AI planning using AgentFactory
   */
  public async getAgentCapabilities(): Promise<Record<string, AgentCapability>> {
    const enabledAgentNames = AgentFactory.getEnabledAgentNames();
    const capabilities: Record<string, AgentCapability> = {};

    for (const agentName of enabledAgentNames) {
      const agent = AgentFactory.getAgent(agentName);
      if (agent) {
        const agentClass = agent.constructor as any;
        capabilities[agentName] = {
          capabilities: typeof agentClass.getCapabilities === 'function'
            ? agentClass.getCapabilities()
            : [`${agentName} operations`],
          limitations: typeof agentClass.getLimitations === 'function'
            ? agentClass.getLimitations()
            : ['Standard agent limitations'],
          schema: typeof agentClass.getOpenAIFunctionSchema === 'function'
            ? agentClass.getOpenAIFunctionSchema()
            : {
                name: agentName,
                description: `${agentName} agent`,
                parameters: { type: 'object' as const, properties: {}, required: [] }
              }
        };
      }
    }

    return capabilities;
  }

  /**
   * Get SlackAgent from AgentFactory for context gathering
   */
  private getSlackAgent(): any | null {
    try {
      const agent = AgentFactory.getAgent('slackAgent');
      if (agent) {
        return agent;
      }
      return null;
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
  private getContactAgent(): any | null {
    return AgentFactory.getAgent('contactAgent');
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
   * // response.message contains human-readable response
   * // response.toolCalls contains generated tool calls
   * // response.proposal contains confirmation proposal if needed
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
      await this.checkMemoryUsage();
      
      // Check for active workflow first using WorkflowOrchestrator
      const activeWorkflows = this.workflowOrchestrator.getSessionWorkflows(sessionId)
        .filter((w: SimpleWorkflowState) => w.status === 'active');

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

      // Start new string-based step-by-step execution
      const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
      return await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId, slackContext);
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
  async processUserInputWithDrafts(
    userInput: string,
    sessionId: string,
    userId?: string,
    options?: {
      accessToken?: string;
      context?: any;
    }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const correlationId = `master-unified-${sessionId}-${Date.now()}`;
    const logContext: LogContext = {
      correlationId,
      userId,
      sessionId,
      operation: 'processUserInputWithDrafts',
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
        conversationHistory: await this.getRecentConversation(sessionId),
        slackContext: options?.context?.slackContext ? {
          channel: options.context.slackContext.channel,
          userId: options.context.slackContext.userId,
          teamId: options.context.slackContext.teamId,
          threadTs: options.context.slackContext.threadTs,
          recentMessages: await this.getRecentSlackMessages(options.context.slackContext)
        } : undefined
      };

      // 4. Single AI call that determines everything
      const intentAnalysis = await this.comprehensiveIntentAnalysis(analysisContext);

      // 5. Route all requests through string-based step execution
      const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
      const result = await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId, options?.context?.slackContext);

      // Convert MasterAgentResponse to ProcessingResult
      const draftInfo = this.extractDraftInfoFromToolResults(result.toolResults || []);

      return {
        message: result.message,
        needsConfirmation: draftInfo?.requiresConfirmation || false,
        draftId: draftInfo?.draftId,
        draftContents: draftInfo ? {
          action: draftInfo.description,
          previewData: draftInfo.previewData
        } : undefined,
        success: true,
        toolResults: result.toolResults,
        executionMetadata: result.executionMetadata
      };

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
      const errorMessage = await this.createUserFriendlyErrorText(error as Error, userInput);
      return {
        message: errorMessage,
        needsConfirmation: false,
        success: false
      };
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

${context.slackContext ? `
SLACK CONTEXT:
- Channel: ${context.slackContext.channel}
- User: ${context.slackContext.userId}
- Team: ${context.slackContext.teamId}
- Thread: ${context.slackContext.threadTs || 'Not in thread'}
- Recent messages: ${context.slackContext.recentMessages?.length || 0} messages available
` : 'No Slack context available.'}

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
      logger.debug('🔍 INTENT ANALYSIS - SENDING TO AI', {
        correlationId: logContext.correlationId,
        userInput: context.userInput,
        promptLength: prompt.length,
        operation: 'intent_analysis_ai_request'
      });

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
          readOperations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                operation: { type: 'string' },
                parameters: { type: 'object' }
              }
            }
          }
        }
      });

      logger.debug('🎯 INTENT ANALYSIS - AI RESPONSE RECEIVED', {
        correlationId: logContext.correlationId,
        response: JSON.stringify(response),
        responseType: typeof response,
        hasIntentType: !!(response as any)?.intentType,
        operation: 'intent_analysis_ai_response'
      });

      const intentAnalysis = response as IntentAnalysis;
      
      // Log intent analysis using natural language logger
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');
      naturalLanguageLogger.logIntentAnalysis(intentAnalysis, context.userInput, {
        correlationId: logContext.correlationId || `intent-${Date.now()}`,
        sessionId: context.sessionId,
        operation: 'comprehensiveIntentAnalysis'
      });

      return intentAnalysis;

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
   * Execute step-by-step workflow based on intent analysis
   * This replaces routeBasedOnIntent with planner-first execution
   */


  /**
   * Generate natural language response that includes draft contents
   */
  private async generateResponseWithDraftContents(draft: Draft): Promise<string> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        // Fallback to simple template
        return `🔍 Ready to ${draft.previewData.description}. Reply "yes" to confirm or describe any changes.`;
      }

      const prompt = `Generate a natural language response that shows the user exactly what will be executed.

Draft operation: ${draft.operation}
Draft type: ${draft.type}
Draft details: ${JSON.stringify(draft.previewData, null, 2)}
Parameters: ${JSON.stringify(draft.parameters, null, 2)}

Requirements:
- Show the user exactly what will happen
- Include specific details (recipients, subject, content, times, etc.)
- Ask for confirmation naturally
- Be friendly and clear
- Format the content nicely for readability

Example for email:
"I'll send this email to John:

To: john@example.com
Subject: Meeting Update

Hi John,

I wanted to update you on our meeting scheduled for tomorrow...

Would you like me to send this email?"

Example for calendar:
"I'll create this calendar event:

Event: Team Meeting
Date: Tomorrow, March 15th at 2:00 PM
Duration: 1 hour
Attendees: john@example.com, sarah@example.com
Location: Conference Room A

Would you like me to create this event?"

Generate the response for this ${draft.type} operation:`;

      const response = await openaiService.generateText(
        prompt,
        'You are an AI assistant that clearly shows users what actions will be taken.',
        { temperature: 0.3, maxTokens: 500 }
      );

      return response.trim();

    } catch (error) {
      logger.error('Failed to generate response with draft contents', {
        error: (error as Error).message,
        draftId: draft.id,
        draftType: draft.type
      });
      
      // Fallback to simple template
      return `🔍 Ready to ${draft.previewData.description}. Reply "yes" to confirm or describe any changes.`;
    }
  }

  /**
   * Execute read operations immediately (no confirmation needed)
   */
  private async executeReadOperations(
    readOperations: ToolCall[],
    sessionId: string,
    userId: string,
    options?: {
      accessToken?: string;
      context?: any;
    }
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
        const result = await toolExecutorService.executeTool(toolCall, context, options?.accessToken);
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
   * Get recent Slack messages for context gathering
   */
  private async getRecentSlackMessages(slackContext: any): Promise<Array<{
    text: string;
    user: string;
    timestamp: string;
  }>> {
    try {
      // For now, return empty array - this could be enhanced to fetch actual Slack message history
      // This would require Slack API integration to get conversation history
      return [];
    } catch (error) {
      logger.warn('Failed to get recent Slack messages', {
        correlationId: `slack-messages-${Date.now()}`,
        operation: 'get_recent_slack_messages',
        metadata: { error: (error as Error).message }
      });
      return [];
    }
  }

  /**
   * Get recent conversation history for context
   */
  private async getRecentConversation(sessionId: string): Promise<string[]> {
    // For now, return empty array - conversation history not implemented
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

        // Call ContactAgent V2 with natural language
        const contactResult = await contactAgent.processNaturalLanguageRequest(
          `Find contact information for ${recipient}`,
          {
            sessionId: `contact-resolution-${Date.now()}`,
            userId: 'system',
            correlationId: 'contact-resolution',
            timestamp: new Date()
          }
        );

        if (contactResult.metadata?.contacts) {
          const contacts = contactResult.metadata.contacts || [];
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

        // Call ContactAgent V2 with natural language
        const contactResult = await contactAgent.processNaturalLanguageRequest(
          `Find contact information for ${recipient}`,
          {
            sessionId: `contact-resolution-${Date.now()}`,
            userId: 'system',
            correlationId: 'contact-resolution',
            timestamp: new Date()
          }
        );

        if (contactResult.metadata?.contacts) {
          const contacts = contactResult.metadata.contacts || [];
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
   * Monitor memory usage and trigger cleanup if needed
   */
  private async checkMemoryUsage(): Promise<void> {
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
      
      // Trigger cleanup on workflow orchestrator
      this.workflowOrchestrator.cleanupOldWorkflows();

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

    // Preserve calendar events for display - only limit to first 10 events
    if (truncated.events && Array.isArray(truncated.events)) {
      truncated.events = truncated.events.slice(0, 10).map((event: any) => {
        if (event && typeof event === 'object') {
          // Keep essential calendar event fields for display
          return {
            id: event.id,
            summary: event.summary,
            description: event.description?.length > 200
              ? event.description.substring(0, 200) + '...'
              : event.description,
            start: event.start,
            end: event.end,
            location: event.location,
            attendees: event.attendees?.slice(0, 5) // Limit attendees
          };
        }
        return event;
      });
    }

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
   * Workflow management methods using WorkflowOrchestrator
   */
  private createWorkflow(workflow: SimpleWorkflowState): void {
    this.workflowOrchestrator.createWorkflow(workflow);
  }

  private updateWorkflow(workflowId: string, updates: Partial<SimpleWorkflowState>): void {
    this.workflowOrchestrator.updateWorkflow(workflowId, updates);
  }

  private cancelWorkflow(workflowId: string): void {
    this.workflowOrchestrator.cancelWorkflow(workflowId);
  }







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
   * Execute string-based step-by-step workflow loop
   * Simplified version using natural language planning and pure string communication
   */
  private async executeStringBasedStepLoop(
    originalRequest: string,
    workflowId: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    logger.info('Starting string-based step loop', {
      workflowId,
      sessionId,
      userId,
      originalRequest: originalRequest.substring(0, 100),
      operation: 'string_step_loop_start'
    });

    const stringPlanningService = getService<StringPlanningService>('stringPlanningService');
    if (!stringPlanningService) {
      throw ErrorFactory.serviceUnavailable('StringPlanningService', {
        correlationId: `string-loop-${Date.now()}`,
        operation: 'string_planning'
      });
    }

    const MAX_STEPS = 10;
    const STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total
    const startTime = Date.now();

    const context: StringWorkflowContext = {
      originalRequest,
      currentStep: 1,
      maxSteps: MAX_STEPS,
      completedSteps: [],
      stepResults: [],
      userContext: { sessionId, userId, slackContext }
    };

    let allStepResults: string[] = [];

    // Execute step loop
    while (context.currentStep <= MAX_STEPS) {
      // Check timeout
      if (Date.now() - startTime > STEP_TIMEOUT_MS) {
        logger.warn('String-based workflow timeout', {
          workflowId,
          sessionId,
          currentStep: context.currentStep,
          operation: 'string_workflow_timeout'
        });
        break;
      }

      try {
        // Plan next step
        logger.info('Planning string-based step', {
          workflowId,
          sessionId,
          stepNumber: context.currentStep,
          operation: 'string_step_planning'
        });

        const plan = await stringPlanningService.planNextStep(context);

        // 🎯 LOG THE PLAN
        logger.info('📋 STRING-BASED PLAN CREATED', {
          workflowId,
          sessionId,
          stepNumber: context.currentStep,
          stepDescription: plan.nextStep,
          reasoning: plan.reasoning,
          isComplete: plan.isComplete,
          operation: 'string_plan_created'
        });

        if (plan.isComplete) {
          logger.info('String workflow marked complete', {
            workflowId,
            sessionId,
            completedSteps: context.completedSteps.length,
            operation: 'string_workflow_complete'
          });
          break;
        }

        // Execute the step
        logger.info('🔧 EXECUTING STRING-BASED STEP', {
          workflowId,
          sessionId,
          stepNumber: context.currentStep,
          stepDescription: plan.nextStep,
          operation: 'string_step_execution'
        });

        const stepResult = await this.executeStringStep(plan.nextStep, sessionId, userId, slackContext);

        // Analyze the result
        const analysis = await stringPlanningService.analyzeStepResult(plan.nextStep, stepResult, context);

        // Update context
        context.completedSteps.push(plan.nextStep);
        context.stepResults.push(analysis.summary);
        allStepResults.push(stepResult);

        logger.info('String step completed', {
          workflowId,
          sessionId,
          stepNumber: context.currentStep,
          stepSummary: analysis.summary.substring(0, 100),
          shouldContinue: analysis.shouldContinue,
          operation: 'string_step_complete'
        });

        // Check if we should continue
        if (!analysis.shouldContinue) {
          logger.info('String workflow stopping - no more steps needed', {
            workflowId,
            sessionId,
            completedSteps: context.completedSteps.length,
            operation: 'string_workflow_stop'
          });
          break;
        }

        context.currentStep++;

      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('String step execution failed', error as Error, {
          workflowId,
          sessionId,
          stepNumber: context.currentStep,
          isAuthError: errorMessage.startsWith('AUTH_ERROR:'),
          operation: 'string_step_error'
        });

        // If auth error, stop immediately
        if (errorMessage.startsWith('AUTH_ERROR:')) {
          logger.info('Auth error detected - stopping workflow immediately', {
            workflowId,
            sessionId,
            operation: 'auth_error_stop'
          });
          allStepResults.push(errorMessage.replace('AUTH_ERROR: ', ''));
          break;
        }

        // Add error as step result and continue
        allStepResults.push(`Step failed: ${errorMessage}`);
        context.currentStep++;
      }
    }

    // Generate final response
    const finalResponse = await this.generateStringBasedResponse(originalRequest, context.completedSteps, allStepResults, sessionId);

    logger.info('String-based workflow completed', {
      workflowId,
      sessionId,
      totalSteps: context.completedSteps.length,
      finalResponseLength: finalResponse.length,
      operation: 'string_workflow_complete'
    });

    return {
      message: finalResponse,
      executionMetadata: {
        processingTime: Date.now() - startTime,
        completedSteps: context.completedSteps.length
      }
    };
  }

  /**
   * Execute a single string-based step by delegating to appropriate subagent
   */
  private async executeStringStep(
    stepDescription: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<string> {
    try {
      // Determine which agent should handle this step
      const agentName = await this.determineAgentForStringStep(stepDescription);

      // 🎯 LOG AGENT SELECTION
      logger.info('🤖 DELEGATING TO AGENT', {
        stepDescription: stepDescription,
        selectedAgent: agentName,
        sessionId,
        operation: 'string_step_delegation'
      });

      // Get the agent
      const agent = await AgentFactory.getAgent(agentName);
      if (!agent) {
        throw new Error(`Agent '${agentName}' not available`);
      }

      // Check if agent supports natural language processing
      const supportsNL = await AgentFactory.supportsNaturalLanguage(agentName);
      if (!supportsNL) {
        throw new Error(`Agent '${agentName}' does not support natural language processing`);
      }

      // 💬 LOG NATURAL LANGUAGE COMMUNICATION
      logger.info('💬 SENDING NATURAL LANGUAGE TO SUBAGENT', {
        agentName,
        naturalLanguageRequest: stepDescription,
        sessionId,
        operation: 'natural_language_request'
      });

      // Get access token for the agent
      const accessToken = await this.getAccessTokenForAgent(agentName, userId, slackContext);

      logger.info('Token retrieval for agent', {
        agentName,
        userId,
        hasToken: !!accessToken,
        tokenType: typeof accessToken,
        operation: 'token_retrieval'
      });

      // Execute with natural language
      const result = await AgentFactory.executeAgentWithNaturalLanguage(
        agentName,
        stepDescription, // This is the rich, detailed natural language instruction
        {
          sessionId,
          userId,
          accessToken: accessToken || undefined, // Convert null to undefined for type compatibility
          slackContext,
          correlationId: `string-step-${Date.now()}`
        }
      );

      // 📨 LOG AGENT RESPONSE
      const responseTruncated = (result.response?.length || 0) > 200;
      logger.info('📨 RECEIVED RESPONSE FROM SUBAGENT', {
        agentName,
        success: result.success,
        response: result.response?.substring(0, 200),
        responseTruncated,
        responseLength: result.response?.length || 0,
        isAuthError: result.metadata?.isAuthError,
        errorType: result.metadata?.errorType,
        sessionId,
        operation: 'natural_language_response'
      });

      if (!result.success) {
        throw new Error(result.error || 'Agent execution failed');
      }

      // If this was an auth error, throw to stop workflow
      if (result.metadata?.isAuthError) {
        throw new Error(`AUTH_ERROR: ${result.response || 'Authentication required'}`);
      }

      return result.response || 'Step completed successfully';

    } catch (error) {
      logger.error('String step execution failed', error as Error, {
        stepDescription: stepDescription.substring(0, 100),
        sessionId,
        operation: 'string_step_execution_error'
      });

      return `Failed to execute step: ${(error as Error).message}`;
    }
  }

  /**
   * Determine which agent should handle a string-based step
   * Now supports skip/replan for elegant handling of uncertain situations
   */
  private async determineAgentForStringStep(stepDescription: string): Promise<string> {
    // Agent selection result with CoT reasoning
    interface AgentSelectionReasoning {
      coreTask: string;
      requirements: string[];
      capabilityMatch: string;
      confidenceAnalysis: string;
    }

    interface AgentSelectionResult {
      reasoning: AgentSelectionReasoning;
      action: 'execute' | 'skip' | 'replan';
      agent?: string;
      confidence: number;
      replanning?: {
        issue: string;
        suggestion: string;
      };
    }
    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      throw new Error('OpenAI service unavailable. Agent selection requires AI-powered analysis.');
    }

    try {
      // Get dynamic agent capabilities
      const agentCapabilities = await this.getAgentCapabilitiesForSelection();

      const prompt = `Task: "${stepDescription}"

Available agents with capabilities:
${PromptUtils.formatAgentCapabilities(agentCapabilities)}

THINK STEP-BY-STEP (Chain-of-Thought):

Step 1 - Identify Core Task:
[What is the primary goal of this task? Be specific]

Step 2 - List Requirements:
[What capabilities, data, or actions are needed to complete this task?]

Step 3 - Match Capabilities:
[Compare requirements to agent capabilities listed above]
[Which agent(s) have the needed capabilities?]
[Explain the match quality]
[CRITICAL: Check if task involves system issues like auth, permissions, or infrastructure]

Step 4 - Evaluate Confidence:
[How well does the best match fit? Score 0-1]
[Any concerns, edge cases, or ambiguities?]
[CRITICAL: If task is asking user to fix system/auth issues, NO AGENT can do this - SKIP immediately]
[If confidence < 0.7, should we SKIP or REPLAN?]

Step 5 - Make Decision:
[EXECUTE: Good agent match (confidence >= 0.7) AND task is actionable by an agent]
[SKIP: No agent can handle this (e.g., user needs to reconnect account, check settings, fix permissions)]
[SKIP: Step is optional/redundant/already handled by error]
[REPLAN: Step needs better phrasing but IS actionable]

THEN return JSON:
{
  "reasoning": {
    "coreTask": "The primary goal is...",
    "requirements": ["capability1", "capability2"],
    "capabilityMatch": "Agent X has Y which handles Z because...",
    "confidenceAnalysis": "High confidence (0.9) because... OR Low confidence (0.5) because..."
  },
  "action": "execute" | "skip" | "replan",
  "agent": "agentName or null",
  "confidence": 0.9,
  "replanning": {
    "issue": "No agent handles X",
    "suggestion": "Rephrase as: ..."
  }
}`;

      const response = await openaiService.generateText(
        prompt,
        'Determine appropriate agent for step with Chain-of-Thought reasoning',
        { temperature: 0.2, maxTokens: 400 } // Increased for CoT
      );

      const selection: AgentSelectionResult = JSON.parse(response);

      // Handle skip
      if (selection.action === 'skip') {
        logger.info('Skipping step - no suitable agent', {
          step: stepDescription,
          reasoning: selection.reasoning,
          confidence: selection.confidence
        });
        throw new Error(`SKIP: ${selection.reasoning.coreTask}. ${selection.reasoning.confidenceAnalysis}`);
      }

      // Handle replan
      if (selection.action === 'replan') {
        logger.info('Step needs replanning', {
          step: stepDescription,
          issue: selection.replanning?.issue,
          suggestion: selection.replanning?.suggestion
        });
        throw new Error(`REPLAN: ${selection.replanning?.issue}. Suggestion: ${selection.replanning?.suggestion}`);
      }

      // Validate agent for execute
      if (!selection.agent) {
        throw new Error('Agent selection returned execute but no agent specified');
      }

      if (selection.confidence < 0.7) {
        throw new Error(`Low confidence (${selection.confidence}) for agent selection. ${selection.reasoning}`);
      }

      const availableAgents = AgentFactory.getEnabledAgentNames();
      if (!availableAgents.includes(selection.agent)) {
        throw new Error(`Invalid agent selected: ${selection.agent}. Available: ${availableAgents.join(', ')}`);
      }

      logger.info('Agent selected for step with CoT reasoning', {
        step: stepDescription,
        agent: selection.agent,
        confidence: selection.confidence,
        reasoning: selection.reasoning,
        coreTask: selection.reasoning.coreTask,
        capabilityMatch: selection.reasoning.capabilityMatch
      });

      return selection.agent;

    } catch (error) {
      logger.error('Agent determination failed', error as Error);
      // Preserve SKIP and REPLAN errors
      if (error instanceof Error && (error.message.startsWith('SKIP:') || error.message.startsWith('REPLAN:'))) {
        throw error;
      }
      throw new Error(`Failed to determine appropriate agent for step: ${stepDescription}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for selection prompts
   */
  private async getAgentCapabilitiesForSelection() {
    const agentNames = AgentFactory.getEnabledAgentNames();
    const capabilities = [];

    for (const name of agentNames) {
      try {
        const agent = AgentFactory.getAgent(name);
        if (agent && typeof agent.getCapabilityDescription === 'function') {
          const caps = agent.getCapabilityDescription();
          capabilities.push({
            name,
            description: caps.description,
            capabilities: caps.capabilities,
            limitations: caps.limitations
          });
        }
      } catch (error) {
        logger.debug(`Could not get capabilities for ${name}`, { error });
      }
    }

    return capabilities;
  }

  /**
   * Generate final natural language response from string-based execution
   */
  private async generateStringBasedResponse(
    originalRequest: string,
    completedSteps: string[],
    stepResults: string[],
    sessionId: string
  ): Promise<string> {
    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      // Simple fallback
      if (stepResults.length === 0) {
        return "I wasn't able to complete your request.";
      }
      return stepResults[stepResults.length - 1] || "Request completed"; // Return last result
    }

    try {
      // Use consistent temporal context
      const temporalContext = PromptUtils.getTemporalContext({
        sessionId,
        correlationId: `response-gen-${Date.now()}`,
        timestamp: new Date()
      });

      const prompt = `${temporalContext}

User requested: "${originalRequest}"

I completed these steps:
${completedSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

With these results:
${stepResults.map((result, i) => `${i + 1}. ${result.substring(0, 300)}`).join('\n')}

Generate a clean, natural response to the user that:
1. Directly answers their question with the relevant information
2. Presents calendar events in a clean, readable format (if applicable)
3. Uses relative time references (e.g., "in two days") based on current date/time above
4. Removes any technical details, metadata, or URLs unless specifically useful
5. Is concise and conversational

DO NOT include:
- Raw JSON data
- Event IDs or technical identifiers
- Full URLs (unless they're view links for events)
- Duplicate information`;

      const response = await openaiService.generateText(
        prompt,
        'Generate final response for string-based workflow',
        { temperature: 0.7, maxTokens: 500 }
      );

      return response.trim();

    } catch (error) {
      logger.error('String response generation failed', error as Error, {
        sessionId,
        operation: 'string_response_generation_error'
      });

      // Return the most relevant result
      return stepResults.length > 0 ? (stepResults[stepResults.length - 1] || "I completed your request.") : "I completed your request.";
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

      // Check for draft information in tool results
      const draftInfo = this.extractDraftInfoFromToolResults(toolResults);
      const executedDraftInfo = this.extractExecutedDraftInfoFromToolResults(toolResults);

      const toolResultsSummary = toolResults.map(tr => ({
        toolName: tr.toolName,
        success: tr.success,
        result: this.truncateToolResultForLLM(tr.result),
        error: tr.error,
        draft: tr.result?.draft,
        executedDraft: tr.result?.executedDraft
      }));

      let prompt = `User asked: "${userInput}"

Here's the data from your tools:
${JSON.stringify(toolResultsSummary, null, 2)}`;

      if (draftInfo) {
        prompt += `

DRAFT CREATED:
A ${draftInfo.type} draft was created: ${draftInfo.description}
Draft ID: ${draftInfo.draftId}
Risk Level: ${draftInfo.riskLevel}
Requires Confirmation: ${draftInfo.requiresConfirmation}

Include this draft information in your response and let the user know they can confirm or modify it.`;
      }

      if (executedDraftInfo) {
        prompt += `

DRAFT EXECUTED:
Draft ${executedDraftInfo.draftId} was ${executedDraftInfo.success ? 'successfully executed' : 'failed to execute'}
${executedDraftInfo.error ? `Error: ${executedDraftInfo.error}` : ''}

Include this execution result in your response.`;
      }

      prompt += `

Respond naturally and conversationally. If the data contains calendar events, list them in a clear, readable format with dates, times, and titles. If it contains emails, summarize the important ones. If drafts were created or executed, mention that clearly. Skip technical details like URLs, IDs, and metadata. Don't use markdown formatting - just plain text that's easy to read and informative.`;

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

  /**
   * Extract draft information from tool results
   */
  private extractDraftInfoFromToolResults(toolResults: ToolResult[]): any | null {
    for (const result of toolResults) {
      if (result.result?.draft) {
        return result.result.draft;
      }
    }
    return null;
  }

  /**
   * Extract executed draft information from tool results
   */
  private extractExecutedDraftInfoFromToolResults(toolResults: ToolResult[]): any | null {
    for (const result of toolResults) {
      if (result.result?.executedDraft) {
        return result.result.executedDraft;
      }
    }
    return null;
  }

  // This eliminates dual execution paths and ensures consistent behavior


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
      const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
      return await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId);
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
        const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
        return await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId);
      } else {
        await this.abortWorkflow(activeWorkflow.workflowId);
        const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
        return await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId);
      }
    } catch (error) {
      const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
      return await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId);
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
      this.workflowOrchestrator.cancelWorkflow(activeWorkflow.workflowId);
      const workflowId = this.workflowOrchestrator.generateWorkflowId(sessionId);
      return await this.executeStringBasedStepLoop(userInput, workflowId, sessionId, userId, slackContext);
    } catch (error) {
      logger.error('Failed to continue step-by-step workflow', error as Error, logContext);
      return this.createErrorResponse(error as Error);
    }
  }


  // LEGACY METHOD REMOVED - Replaced by executeStringBasedStepLoop

  /**
   * Get access token for a specific agent
   */
  private async getAccessTokenForAgent(agentName: string, userId?: string, slackContext?: any): Promise<string | null> {
    try {
      if (!userId) {
        return null;
      }

      // Import and use the token manager service
      const { TokenManager } = await import('../services/token-manager');
      const tokenManager = getService('tokenManager') as InstanceType<typeof TokenManager>;
      if (!tokenManager) {
        logger.warn('TokenManager service not available', {
          agentName,
          userId,
          operation: 'get_access_token_for_agent'
        });
        return null;
      }

      // Use Slack context if available, otherwise parse userId
      let teamId: string | null = null;
      let actualUserId: string | null = null;

      if (slackContext?.teamId && slackContext?.userId) {
        // Use Slack context directly
        teamId = slackContext.teamId;
        actualUserId = slackContext.userId;
        logger.debug('Using Slack context for token retrieval', {
          agentName,
          teamId,
          actualUserId,
          operation: 'get_access_token_for_agent'
        });
      } else {
        // Parse userId with robust handling for different formats
        const parsed = this.parseUserId(userId);
        teamId = parsed.teamId;
        actualUserId = parsed.actualUserId;
      }

      if (!teamId || !actualUserId) {
        logger.warn('Invalid userId format for token retrieval', {
          userId,
          agentName,
          parsedTeamId: teamId,
          parsedUserId: actualUserId,
          hasSlackContext: !!slackContext,
          operation: 'get_access_token_for_agent'
        });
        return null;
      }

      // For calendar agent, get calendar tokens
      if (agentName === 'calendarAgent') {
        const accessToken = await tokenManager.getValidTokensForCalendar(teamId, actualUserId);
        return accessToken;
      }

      // For email agent, get email tokens
      if (agentName === 'emailAgent') {
        const accessToken = await tokenManager.getValidTokensForGmail(teamId, actualUserId);
        logger.debug('Retrieved Gmail access token', {
          agentName,
          teamId,
          actualUserId,
          hasToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
          operation: 'get_gmail_token'
        });
        return accessToken;
      }

      // For other agents, try to get general tokens
      const accessToken = await tokenManager.getValidTokensForCalendar(teamId, actualUserId);
      return accessToken;

    } catch (error) {
      logger.warn('Failed to get access token for agent', {
        agentName,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'get_access_token_for_agent'
      });
      return null;
    }
  }

  /**
   * Parse userId string to extract teamId and actualUserId
   * Handles various userId formats from different sources (Slack, direct API calls, etc.)
   */
  private parseUserId(userId?: string): { teamId: string | null; actualUserId: string | null } {
    if (!userId) {
      return { teamId: null, actualUserId: null };
    }

    try {
      // Handle Slack team format: "T12345678|U87654321" or "T12345678:U87654321"
      if (userId.includes('|') || userId.includes(':')) {
        const separator = userId.includes('|') ? '|' : ':';
        const [teamId, actualUserId] = userId.split(separator);

        if (teamId && actualUserId && teamId.startsWith('T') && actualUserId.startsWith('U')) {
          return { teamId: teamId.trim(), actualUserId: actualUserId.trim() };
        }
      }

      // Handle direct Slack user ID format: "U87654321" (assume default team or extract from context)
      if (userId.startsWith('U') && userId.length >= 9) {
        // For direct user IDs, we might need to get team from context or use a default
        // This is a fallback - ideally we should have team context
        return { teamId: null, actualUserId: userId.trim() };
      }

      // Handle team ID format: "T12345678" (user requesting for the team)
      if (userId.startsWith('T') && userId.length >= 9) {
        return { teamId: userId.trim(), actualUserId: null };
      }

      // Handle JSON string format: '{"teamId":"T12345678","userId":"U87654321"}'
      if (userId.startsWith('{') && userId.includes('teamId')) {
        const parsed = JSON.parse(userId);
        return {
          teamId: parsed.teamId || null,
          actualUserId: parsed.userId || parsed.actualUserId || null
        };
      }

      // Handle email format or other custom formats - extract meaningful parts
      if (userId.includes('@')) {
        // For email formats, we can't extract Slack team/user IDs
        return { teamId: null, actualUserId: userId.trim() };
      }

      // Fallback: treat as direct user ID
      return { teamId: null, actualUserId: userId.trim() };

    } catch (error) {
      logger.warn('Failed to parse userId', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'parse_user_id'
      });
      return { teamId: null, actualUserId: null };
    }
  }

  public cleanup(): void {
    // Cleanup is now handled by the extracted components
    logger.debug('MasterAgent cleanup completed', {
      correlationId: 'cleanup',
      operation: 'agent_cleanup',
      metadata: { service: 'MasterAgent' }
    });
  }
}