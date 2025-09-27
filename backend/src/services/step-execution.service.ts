import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';
import { StringWorkflowContext } from './string-planning.service';
import { AgentFactory } from '../framework/agent-factory';
import { PromptUtils } from '../utils/prompt-utils';

/**
 * Context for executing a single step
 */
export interface StepExecutionContext {
  sessionId: string;
  userId?: string;
  slackContext?: any;
  timestamp: Date;
}

/**
 * Result of agent selection and command generation
 */
export interface AgentSelectionResult {
  agentName: string;
  optimizedCommand: string;
  confidence: number;
  reasoning: string;
  skipReason?: string;
}

/**
 * StepExecutionService - Executes single workflow steps with context-aware agent selection
 *
 * Single Responsibility: Single Step Execution
 * - Selects the best agent for a specific step
 * - Generates optimized, context-aware commands for subagents
 * - Executes the step through the selected agent
 * - Handles skip logic and error cases
 */
export class StepExecutionService extends BaseService {
  private openaiService: OpenAIService | null = null;

  constructor() {
    super('StepExecutionService');
  }

  protected async onInitialize(): Promise<void> {
    this.openaiService = getService('openaiService') as OpenAIService;
    if (!this.openaiService) {
      throw new Error('OpenAI service required for step execution');
    }
  }

  protected async onDestroy(): Promise<void> {
    this.openaiService = null;
  }

  /**
   * Execute a single workflow step
   */
  async executeSingleStep(
    stepDescription: string,
    workflowContext: StringWorkflowContext,
    executionContext: StepExecutionContext
  ): Promise<{ success: boolean; result: string; error?: string; agentResponse?: any }> {
    const correlationId = `step-execution-${Date.now()}`;

    try {
      logger.warn('Executing single workflow step', {
        correlationId,
        stepDescription: stepDescription.substring(0, 100),
        currentStep: workflowContext.currentPlanStep,
        totalSteps: workflowContext.comprehensivePlan?.length,
        sessionId: executionContext.sessionId,
        operation: 'single_step_execution'
      });

      // 1. Select agent and generate optimized command
      const agentSelection = await this.selectAgentAndGenerateCommand(stepDescription, workflowContext);
      
      if (agentSelection.skipReason) {
        logger.warn('Step skipped', {
          correlationId,
          skipReason: agentSelection.skipReason,
          sessionId: executionContext.sessionId,
          operation: 'step_skipped'
        });

        return {
          success: true,
          result: `Skipped: ${agentSelection.skipReason}`,
          error: undefined
        };
      }

      logger.debug('Agent selected for step', {
        correlationId,
        selectedAgent: agentSelection.agentName,
        confidence: agentSelection.confidence,
        optimizedCommand: agentSelection.optimizedCommand.substring(0, 100),
        operation: 'agent_selected'
      });

      // 2. Get access token for the user (required for OAuth agents like calendar/email)
      let accessToken: string | undefined;
      if (executionContext.userId && executionContext.slackContext?.teamId) {
        try {
          const tokenManager = getService('tokenManager') as any;
          if (tokenManager) {
            const tokens = await tokenManager.getValidTokens(executionContext.slackContext.teamId, executionContext.userId);
            accessToken = tokens;

            logger.debug('Retrieved access token for agent execution', {
              correlationId,
              teamId: executionContext.slackContext.teamId,
              userId: executionContext.userId,
              hasAccessToken: !!accessToken,
              tokenLength: accessToken?.length,
              operation: 'access_token_retrieved'
            });
          }
        } catch (tokenError) {
          logger.warn('Failed to retrieve access token for agent execution', {
            correlationId,
            teamId: executionContext.slackContext?.teamId,
            userId: executionContext.userId,
            error: (tokenError as Error).message,
            operation: 'access_token_retrieval_failed'
          });
        }
      }

      // 3. Execute with selected agent (including access token)
      const executionResult = await AgentFactory.executeAgentWithNaturalLanguage(
        agentSelection.agentName,
        agentSelection.optimizedCommand,
        {
          ...executionContext,
          accessToken
        }
      );

      logger.warn('Step execution completed', {
        correlationId,
        success: executionResult.success,
        hasResponse: !!executionResult.response,
        hasError: !!executionResult.error,
        sessionId: executionContext.sessionId,
        operation: 'step_execution_completed'
      });

      return {
        success: executionResult.success,
        result: executionResult.response || 'Step completed',
        error: executionResult.error,
        agentResponse: executionResult  // Pass full agent response
      };

    } catch (error) {
      logger.error('Step execution failed', error as Error, {
        correlationId,
        stepDescription: stepDescription.substring(0, 100),
        sessionId: executionContext.sessionId,
        operation: 'step_execution_error'
      });
      
      return {
        success: false,
        result: 'Step execution failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Select best agent and generate context-aware command
   */
  private async selectAgentAndGenerateCommand(
    stepDescription: string,
    workflowContext: StringWorkflowContext
  ): Promise<AgentSelectionResult> {
    const correlationId = `agent-selection-${Date.now()}`;
    
    try {
      // Get available agents
      const agentCapabilities = AgentFactory.getAgentCapabilities();
      const nlAgents = AgentFactory.getNaturalLanguageAgents();
      
      if (nlAgents.length === 0) {
        throw new Error('No natural language agents available');
      }

      // Build agent descriptions
      const agentDescriptions = nlAgents.map(agentName => {
        const caps = agentCapabilities[agentName];
        if (!caps) return '';
        
        return `${caps.name}: ${caps.description || 'No description available'}
Capabilities: ${caps.capabilities?.join(', ') || 'No capabilities listed'}
Examples: ${caps.examples?.join(', ') || 'No examples provided'}
Domains: ${caps.domains?.join(', ') || 'No domains specified'}`;
      }).filter(desc => desc.length > 0);

      const prompt = this.createAgentSelectionPrompt(stepDescription, workflowContext, agentDescriptions);

      logger.debug('🔍 AGENT SELECTION - SENDING TO AI', {
        correlationId,
        promptLength: prompt.length,
        prompt: prompt.substring(0, 500) + '...',
        operation: 'agent_selection_ai_request'
      });

      const response = await this.openaiService!.generateStructuredData(
        workflowContext.originalRequest,
        prompt,
        {
          type: 'object',
          properties: {
            reasoning: { type: 'string' },
            selectedAgent: { type: 'string' },
            optimizedCommand: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            skipReason: { type: 'string' }
          },
          required: ['reasoning', 'selectedAgent', 'optimizedCommand', 'confidence']
        },
        {
          temperature: 0.3,
          maxTokens: 600
        }
      );

      const result = this.validateAgentSelectionResponse(response);
      
      logger.warn('Agent selected and command generated', {
        correlationId,
        selectedAgent: result.agentName,
        confidence: result.confidence,
        hasOptimizedCommand: !!result.optimizedCommand,
        hasSkipReason: !!result.skipReason,
        operation: 'agent_selection_completed'
      });

      return result;

    } catch (error) {
      logger.error('Agent selection failed', error as Error, {
        correlationId,
        operation: 'agent_selection_error'
      });
      throw error;
    }
  }

  /**
   * Create prompt for agent selection and command generation
   */
  private createAgentSelectionPrompt(
    stepDescription: string,
    workflowContext: StringWorkflowContext,
    agentDescriptions: string[]
  ): string {
    const temporalContext = workflowContext.agentContext
      ? PromptUtils.getTemporalContext(workflowContext.agentContext)
      : `Current date/time: ${new Date().toLocaleString('en-US')}`;

    return `${temporalContext}

AGENT SELECTION & COMMAND GENERATION:

User Intent: "${workflowContext.intentDescription || workflowContext.originalRequest}"
Original Request: "${workflowContext.originalRequest}"

CURRENT STEP TO EXECUTE: "${stepDescription}"

WORKFLOW CONTEXT:
- Current Step: ${workflowContext.currentPlanStep}/${workflowContext.comprehensivePlan?.length || 'N/A'}
- Completed Steps: ${workflowContext.completedSteps.length}
- Previous Results: ${workflowContext.stepResults.map(r => r.substring(0, 100)).join('; ')}

GLOBAL CONTEXT (any service can add useful information here):
${workflowContext.globalContext.length > 0 ? workflowContext.globalContext.join('\n') : 'No global context yet'}

AVAILABLE AGENTS:
${agentDescriptions.join('\n\n')}

ANALYSIS INSTRUCTIONS:
1. Analyze the current step in context of the overall workflow
2. Consider the global context and previous results
3. Select the most appropriate agent for this specific step
4. Generate an optimized, specific command for that agent
5. Consider if this step should be skipped and why

Return JSON:
{
  "reasoning": "Step-by-step analysis of agent selection and command optimization",
  "selectedAgent": "agent_name",
  "optimizedCommand": "Specific, optimized command for the selected agent",
  "confidence": 0.95,
  "skipReason": "Optional: reason to skip this step"
}

Guidelines:
- Use the global context to inform your decision
- Generate commands that are specific and actionable
- Consider the workflow's progress when selecting agents
- Only suggest skipping if truly unnecessary
- The optimizedCommand should be natural language that the selected agent can understand and execute`;
  }

  /**
   * Validate agent selection response
   */
  private validateAgentSelectionResponse(response: any): AgentSelectionResult {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid AI response format for agent selection');
    }

    if (typeof response.reasoning !== 'string' || 
        typeof response.selectedAgent !== 'string' || 
        typeof response.optimizedCommand !== 'string' ||
        typeof response.confidence !== 'number') {
      throw new Error('AI response missing required fields for agent selection');
    }

    return {
      agentName: response.selectedAgent,
      optimizedCommand: response.optimizedCommand,
      confidence: Math.max(0, Math.min(1, response.confidence)),
      reasoning: response.reasoning,
      skipReason: response.skipReason || undefined
    };
  }
}
