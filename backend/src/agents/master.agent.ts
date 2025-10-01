import logger from '../utils/logger';
import { GenericAIService } from '../services/generic-ai.service';
import { ContextManager } from '../services/context-manager.service';
// AgentFactory import removed - using new BaseSubAgent architecture
// Prompt builders are now created via factory - no direct imports needed

// Utilities and error handling
import { BuilderGuard, createBuilderContext, PromptBuilderMap } from '../utils/builder-guard';
import { ErrorFactory } from '../errors';

import { TokenManager } from '../services/token-manager';
import { WorkflowExecutor } from '../services/workflow-executor.service';
// Token types no longer needed - using TokenManager directly

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
 * Master Agent following the redesigned architecture
 *
 * 1. Understanding & Planning
 * 2. Execution Loop (Max 10 Iterations)
 * 3. Final Output Generation
 */
export class MasterAgent {
  private aiService: GenericAIService;
  private contextManager: ContextManager;
  private tokenManager: TokenManager;
  private workflowExecutor: WorkflowExecutor;
  private isInitialized = false;

  // Prompt builders - single object instead of individual properties
  private builders: PromptBuilderMap;

  constructor(
    aiService: GenericAIService,
    contextManager: ContextManager,
    tokenManager: TokenManager,
    workflowExecutor: WorkflowExecutor,
    builders: PromptBuilderMap,
  ) {
    this.aiService = aiService;
    this.contextManager = contextManager;
    this.tokenManager = tokenManager;
    this.workflowExecutor = workflowExecutor;
    this.builders = builders;
    this.isInitialized = true; // Already initialized when created via DI
  }

  /**
   * Initialize the new Master Agent
   * @deprecated No longer needed - initialization happens in constructor via DI
   */
  async initialize(): Promise<void> {
    // No-op: Everything is initialized in the constructor when created via DI
    if (this.isInitialized) {
      return;
    }

    // Validate injected dependencies
    if (!this.aiService) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'GenericAIService not provided to MasterAgent');
    }

    if (!this.contextManager) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'ContextManager not provided to MasterAgent');
    }

    if (!this.tokenManager) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'TokenManager not provided to MasterAgent');
    }

    if (!this.workflowExecutor) {
      throw ErrorFactory.workflow.executionFailed('WorkflowExecutor not provided to MasterAgent');
    }

    if (!this.builders) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'Builders not provided to MasterAgent');
    }

    BuilderGuard.validateAllBuilders(this.builders);

    this.isInitialized = true;

    logger.info('MasterAgent initialized successfully', {
      operation: 'master_agent_init',
    });
  }

  /**
   * Process user input with the new architecture
   */
  async processUserInput(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext,
  ): Promise<ProcessingResult> {
    await this.ensureInitialized();

    const processingStartTime = Date.now();

    logger.info('Processing user input with Master Agent', {
      userInputLength: userInput?.length || 0,
      sessionId,
      userId,
      hasSlackContext: !!slackContext,
      operation: 'process_user_input',
    });

    try {
      // Update progress for stage 1
      if (slackContext?.updateProgress) {
        await slackContext.updateProgress('Building message history...');
      }
      
      // Gather conversation history and build message history
      const messageHistory = await this.buildMessageHistory(userInput, sessionId, slackContext);

      // Update progress for stage 2
      if (slackContext?.updateProgress) {
        await slackContext.updateProgress('Analyzing and planning...');
      }
      
      // Understanding & Planning
      const workflowContext = await this.analyzeAndPlan(messageHistory, sessionId, userId);

      // Update progress for stage 3
      if (slackContext?.updateProgress) {
        await slackContext.updateProgress('Executing workflow...');
      }
      
      // Execution Loop (Max 10 Iterations)
      const executionResult = await this.executeWorkflow(workflowContext, sessionId, userId);

      // Update progress for stage 4
      if (slackContext?.updateProgress) {
        await slackContext.updateProgress('Generating response...');
      }
      
      // Final Output Generation
      const finalResult = await this.generateFinalResponse(executionResult, processingStartTime);

      return finalResult;

    } catch (error) {
      logger.error('Failed to process user input', error as Error, {
        userInput: `${userInput.substring(0, 100)  }...`,
        sessionId,
        userId,
        operation: 'process_user_input_error',
      });

      return this.createErrorResult('I encountered an error while processing your request. Please try again.', processingStartTime);

    }
  }

  /**
   * Build message history from user input and conversation context
   */
  private async buildMessageHistory(
    userInput: string,
    sessionId: string,
    slackContext?: SlackContext,
  ): Promise<string> {
    logger.info('Building message history', { sessionId });

    // Start with user input
    let messageHistory = userInput;
    
    // Add conversation history if available
    if (slackContext && this.contextManager) {
      try {
        const gatheredContext = await this.contextManager.gatherContext(sessionId, slackContext);
        
        // Add recent messages to context
        if (gatheredContext.conversation.recentMessages.length > 0) {
          const historyText = gatheredContext.conversation.recentMessages
            .map(msg => `${msg.user}: ${msg.text}`)
            .join('\n');
          messageHistory = `Previous conversation:\n${historyText}\n\nCurrent request: ${userInput}`;
        }
      } catch (error) {
        logger.warn('Failed to gather conversation context', { error, sessionId });
        // Continue with just user input if context gathering fails
      }
    }

    return messageHistory;
  }

  /**
   * Analyze the situation and create a workflow plan
   */
  private async analyzeAndPlan(
    messageHistory: string,
    sessionId: string,
    userId?: string,
  ): Promise<string> {
    logger.info('Analyzing situation and creating plan', { sessionId, userId });

    const context = createBuilderContext(sessionId, userId, 'analyze_and_plan');

    // Situation Analysis
    const situationResult = await BuilderGuard.safeExecute(
      this.builders?.situation,
      'situation',
      messageHistory,
      context,
    );
    let workflowContext = situationResult.parsed.context;

    // Workflow Planning
    const planningResult = await BuilderGuard.safeExecute(
      this.builders?.planning,
      'planning',
      workflowContext,
      context,
    );
    workflowContext = planningResult.parsed.context;

    return workflowContext;
  }

  /**
   * Execute the workflow with iterative steps (now using WorkflowExecutor)
   */
  private async executeWorkflow(
    workflowContext: string,
    sessionId: string,
    userId?: string,
  ): Promise<string> {
    if (!this.workflowExecutor) {
      throw ErrorFactory.domain.serviceUnavailable('WorkflowExecutor', {
        component: 'master-agent',
        operation: 'execute_workflow',
        sessionId,
        userId,
      });
    }

    logger.info('Executing workflow with WorkflowExecutor', { sessionId, userId });

    try {
      return await this.workflowExecutor.execute(workflowContext, sessionId, userId);
    } catch (error) {
      logger.error('Workflow execution failed', error as Error, {
        sessionId,
        userId,
        operation: 'execute_workflow',
      });
      throw error;
    }
  }

  /**
   * Generate the final response from the completed workflow
   */
  private async generateFinalResponse(
    workflowContext: string,
    processingStartTime: number,
  ): Promise<ProcessingResult> {
    logger.info('Generating final response');

    const context = createBuilderContext(undefined, undefined, 'generate_final_response');

    const finalResult = await BuilderGuard.safeExecute(
      this.builders?.final,
      'final',
      workflowContext,
      context,
    );
    const response = finalResult.parsed.response;

    return {
      message: response,
      success: true,
      metadata: {
        processingTime: Date.now() - processingStartTime,
      },
    };
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.isInitialized = false;
    logger.info('MasterAgent cleanup completed', { operation: 'master_agent_cleanup' });
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
        processingTime: Date.now() - processingStartTime,
      },
    };
  }

}