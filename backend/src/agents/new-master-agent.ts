import logger from '../utils/logger';
import { serviceManager } from '../services/service-manager';
import { GenericAIService } from '../services/generic-ai.service';
import { ContextManager } from '../services/context-manager.service';
import { AgentFactory } from '../framework/agent-factory';
import { 
  SituationAnalysisPromptBuilder,
  WorkflowPlanningPromptBuilder,
  EnvironmentCheckPromptBuilder,
  ActionExecutionPromptBuilder,
  ProgressAssessmentPromptBuilder,
  FinalResponsePromptBuilder
} from '../services/prompt-builders/prompts';

// Types
import { SlackContext } from '../types/slack/slack.types';

/**
 * Processing result interface for the new Master Agent
 */
export interface ProcessingResult {
  message: string;
  success: boolean;
  metadata?: {
    processingTime?: number;
    workflowId?: string;
    totalSteps?: number;
    workflowAction?: string;
  };
}

/**
 * New Master Agent following the redesigned architecture
 * 
 * Phase 1: Comprehensive Understanding & Planning
 * Phase 2: Execution Loop (Max 10 Iterations)
 * Phase 3: Final Output Generation
 */
export class NewMasterAgent {
  private aiService: GenericAIService | null = null;
  private contextManager: ContextManager | null = null;
  private isInitialized = false;

  // Prompt builders
  private situationAnalysisBuilder: SituationAnalysisPromptBuilder | null = null;
  private workflowPlanningBuilder: WorkflowPlanningPromptBuilder | null = null;
  private environmentCheckBuilder: EnvironmentCheckPromptBuilder | null = null;
  private actionExecutionBuilder: ActionExecutionPromptBuilder | null = null;
  private progressAssessmentBuilder: ProgressAssessmentPromptBuilder | null = null;
  private finalResponseBuilder: FinalResponsePromptBuilder | null = null;

  /**
   * Initialize the new Master Agent
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get AI service
      this.aiService = serviceManager.getService<GenericAIService>('genericAIService') || null;
      
      if (!this.aiService) {
        throw new Error('GenericAIService not available for NewMasterAgent');
      }

      // Get context manager
      this.contextManager = serviceManager.getService<ContextManager>('contextManager') || null;
      
      if (!this.contextManager) {
        throw new Error('ContextManager not available for NewMasterAgent');
      }

      // Initialize prompt builders
      this.situationAnalysisBuilder = new SituationAnalysisPromptBuilder(this.aiService);
      this.workflowPlanningBuilder = new WorkflowPlanningPromptBuilder(this.aiService);
      this.environmentCheckBuilder = new EnvironmentCheckPromptBuilder(this.aiService);
      this.actionExecutionBuilder = new ActionExecutionPromptBuilder(this.aiService);
      this.progressAssessmentBuilder = new ProgressAssessmentPromptBuilder(this.aiService);
      this.finalResponseBuilder = new FinalResponsePromptBuilder(this.aiService);

      this.isInitialized = true;

      logger.info('NewMasterAgent initialized successfully', {
        operation: 'new_master_agent_init'
      });

    } catch (error) {
      logger.error('NewMasterAgent initialization failed', error as Error, {
        operation: 'new_master_agent_init_error'
      });
      throw error;
    }
  }

  /**
   * Process user input with the new architecture
   */
  async processUserInput(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ProcessingResult> {
    await this.ensureInitialized();

    const processingStartTime = Date.now();

    logger.info('Processing user input with new Master Agent', {
      userInputLength: userInput.length,
      sessionId,
      userId,
      hasSlackContext: !!slackContext,
      operation: 'process_user_input'
    });

    try {
      // Gather conversation history and build message history
      const messageHistory = await this.gatherConversationHistory(userInput, sessionId, slackContext);
      
      // Phase 1: Comprehensive Understanding & Planning
      const context = await this.phase1UnderstandingAndPlanning(messageHistory, sessionId, userId);
      
      // Phase 2: Execution Loop (Max 10 Iterations)
      const executionResult = await this.phase2ExecutionLoop(context, sessionId, userId);
      
      // Phase 3: Final Output Generation
      const finalResult = await this.phase3FinalOutput(executionResult, processingStartTime);

      return finalResult;

    } catch (error) {
      logger.error('Failed to process user input', error as Error, {
        userInput: userInput.substring(0, 100) + '...',
        sessionId,
        userId,
        operation: 'process_user_input_error'
      });

      return this.createErrorResult('I encountered an error while processing your request. Please try again.', processingStartTime);
    }
  }

  /**
   * Gather conversation history and build enriched context
   */
  private async gatherConversationHistory(
    userInput: string,
    sessionId: string,
    slackContext?: SlackContext
  ): Promise<string> {
    logger.info('Gathering conversation history', { sessionId });

    // Start with user input
    let enrichedContext = userInput;
    
    // Add conversation history if available
    if (slackContext && this.contextManager) {
      try {
        const gatheredContext = await this.contextManager.gatherContext(sessionId, slackContext);
        
        // Add recent messages to context
        if (gatheredContext.conversation.recentMessages.length > 0) {
          const historyText = gatheredContext.conversation.recentMessages
            .map(msg => `${msg.user}: ${msg.text}`)
            .join('\n');
          enrichedContext = `Previous conversation:\n${historyText}\n\nCurrent request: ${userInput}`;
        }
      } catch (error) {
        logger.warn('Failed to gather conversation context', { error, sessionId });
        // Continue with just user input if context gathering fails
      }
    }

    return enrichedContext;
  }

  /**
   * Phase 1: Comprehensive Understanding & Planning
   */
  private async phase1UnderstandingAndPlanning(
    messageHistory: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    logger.info('Phase 1: Understanding & Planning', { sessionId, userId });
    
    // Step 1: Situation Analysis
    const situationResult = await this.situationAnalysisBuilder!.execute(messageHistory);
    let context = situationResult.parsed.context;

    // Step 2: Workflow Planning
    const planningResult = await this.workflowPlanningBuilder!.execute(context);
    context = planningResult.parsed.context;

    return context;
  }

  /**
   * Phase 2: Execution Loop (Max 10 Iterations)
   */
  private async phase2ExecutionLoop(
    context: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    logger.info('Phase 2: Execution Loop', { sessionId, userId });

    const maxIterations = 10;
    let currentContext = context;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Environment & Readiness Check
      const environmentResult = await this.environmentCheckBuilder!.execute(currentContext);
      currentContext = environmentResult.parsed.context;

      // Check if user input is needed
      if (environmentResult.parsed.needsUserInput) {
        logger.info('User input needed, exiting execution loop', { 
          sessionId, 
          iteration,
          requiredInfo: environmentResult.parsed.requiredInfo 
        });
        break;
      }

      // Action Execution
      const actionResult = await this.actionExecutionBuilder!.execute(currentContext);
      currentContext = actionResult.parsed.context;

      // Execute the action if agent and request are provided
      if (actionResult.parsed.agent && actionResult.parsed.request) {
        try {
          const agentResult = await this.executeAgentAction(
            actionResult.parsed.agent,
            actionResult.parsed.request,
            sessionId,
            userId
          );
          
          // Update context with agent execution results
          currentContext = `${currentContext}\n\nAgent Execution Result:\nAgent: ${actionResult.parsed.agent}\nRequest: ${actionResult.parsed.request}\nResult: ${JSON.stringify(agentResult, null, 2)}`;
        } catch (error) {
          logger.error('Agent execution failed', error as Error, { 
            sessionId, 
            agent: actionResult.parsed.agent,
            request: actionResult.parsed.request
          });
          
          // Update context with error information
          currentContext = `${currentContext}\n\nAgent Execution Error:\nAgent: ${actionResult.parsed.agent}\nRequest: ${actionResult.parsed.request}\nError: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      // Progress Assessment
      const progressResult = await this.progressAssessmentBuilder!.execute(currentContext);
      currentContext = progressResult.parsed.context;

      // Check if workflow is complete
      if (progressResult.parsed.newSteps && progressResult.parsed.newSteps.length === 0) {
        logger.info('Workflow complete, exiting execution loop', { sessionId, iteration });
        break;
      }
    }

    if (iteration >= maxIterations) {
      logger.warn('Execution loop reached maximum iterations', { sessionId, iteration });
    }

    return currentContext;
  }

  /**
   * Phase 3: Final Output Generation
   */
  private async phase3FinalOutput(
    context: string,
    processingStartTime: number
  ): Promise<ProcessingResult> {
    logger.info('Phase 3: Final Output Generation');

    const finalResult = await this.finalResponseBuilder!.execute(context);
    const finalContext = finalResult.parsed.context;
    const response = finalResult.parsed.response;

    return {
      message: response,
      success: true,
      metadata: {
        processingTime: Date.now() - processingStartTime
      }
    };
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.isInitialized = false;
    logger.info('NewMasterAgent cleanup completed', { operation: 'new_master_agent_cleanup' });
  }

  /**
   * Private helper methods
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private createErrorResult(message: string, processingStartTime: number): ProcessingResult {
    return {
      message,
      success: false,
      metadata: {
        processingTime: Date.now() - processingStartTime
      }
    };
  }

  /**
   * Execute an agent action using the AgentFactory
   */
  private async executeAgentAction(
    agentName: string,
    request: string,
    sessionId: string,
    userId?: string
  ): Promise<any> {
    try {
      // Get access token if available (for OAuth agents)
      let accessToken: string | undefined;
      if (userId) {
        // TODO: Get access token from token manager
        // For now, we'll proceed without it
      }

      const result = await AgentFactory.executeAgentWithNaturalLanguage(
        agentName,
        request,
        {
          sessionId,
          userId,
          accessToken,
          correlationId: `new-master-agent-${Date.now()}`
        }
      );

      return result;
    } catch (error) {
      logger.error('Failed to execute agent action', error as Error, {
        agentName,
        request: request.substring(0, 100),
        sessionId,
        userId
      });
      throw error;
    }
  }
}
