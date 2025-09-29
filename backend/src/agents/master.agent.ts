import logger from '../utils/logger';
import { serviceManager } from '../services/service-manager';
import { GenericAIService } from '../services/generic-ai.service';
import { ContextManager } from '../services/context-manager.service';
// AgentFactory import removed - using new BaseSubAgent architecture
// Prompt builders are now created via factory - no direct imports needed

// Utilities and error handling
import { BuilderGuard, createBuilderContext, PromptBuilderMap } from '../utils/builder-guard';
import { PromptBuilderFactory } from '../utils/prompt-builder-factory';
import { UnifiedErrorFactory, ErrorContextBuilder } from '../types/workflow/unified-errors';

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
  private aiService: GenericAIService | null = null;
  private contextManager: ContextManager | null = null;
  private tokenManager: TokenManager | null = null;
  private workflowExecutor: WorkflowExecutor | null = null;
  private isInitialized = false;

  // Prompt builders - single object instead of individual properties
  private builders: PromptBuilderMap | null = null;

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

      // Get token manager
      this.tokenManager = serviceManager.getService<TokenManager>('tokenManager') || null;
      
      if (!this.tokenManager) {
        throw new Error('TokenManager not available for MasterAgent');
      }

      // Initialize all prompt builders using factory
      this.builders = PromptBuilderFactory.createAllBuilders(this.aiService);

      // Validate all builders are properly initialized
      BuilderGuard.validateAllBuilders(this.builders);

      // Initialize workflow executor with required builders
      this.workflowExecutor = new WorkflowExecutor(
        this.builders.environment,
        this.builders.action,
        this.builders.progress,
        this.tokenManager,
        10 // maxIterations
      );

      this.isInitialized = true;

      const initStatus = BuilderGuard.getInitializationStatus(this.builders);

      logger.info('MasterAgent initialized successfully', {
        operation: 'master_agent_init',
        buildersInitialized: initStatus.initializedCount,
        totalBuilders: initStatus.totalCount
      });

    } catch (error) {
      logger.error('MasterAgent initialization failed', error as Error, {
        operation: 'master_agent_init_error'
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

    logger.info('Processing user input with Master Agent', {
      userInputLength: userInput.length,
      sessionId,
      userId,
      hasSlackContext: !!slackContext,
      operation: 'process_user_input'
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
        userInput: userInput.substring(0, 100) + '...',
        sessionId,
        userId,
        operation: 'process_user_input_error'
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
    slackContext?: SlackContext
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
    userId?: string
  ): Promise<string> {
    logger.info('Analyzing situation and creating plan', { sessionId, userId });

    const context = createBuilderContext(sessionId, userId, 'analyze_and_plan');

    // Situation Analysis
    const situationResult = await BuilderGuard.safeExecute(
      this.builders?.situation,
      'situation',
      messageHistory,
      context
    );
    let workflowContext = situationResult.parsed.context;

    // Workflow Planning
    const planningResult = await BuilderGuard.safeExecute(
      this.builders?.planning,
      'planning',
      workflowContext,
      context
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
    userId?: string
  ): Promise<string> {
    if (!this.workflowExecutor) {
      const errorContext = ErrorContextBuilder.create()
        .component('master-agent')
        .operation('execute_workflow')
        .sessionId(sessionId)
        .userId(userId)
        .build();

      throw UnifiedErrorFactory.serviceUnavailable('WorkflowExecutor', errorContext);
    }

    logger.info('Executing workflow with WorkflowExecutor', { sessionId, userId });

    try {
      return await this.workflowExecutor.execute(workflowContext, sessionId, userId);
    } catch (error) {
      logger.error('Workflow execution failed', error as Error, {
        sessionId,
        userId,
        operation: 'execute_workflow'
      });
      throw error;
    }
  }

  /**
   * Generate the final response from the completed workflow
   */
  private async generateFinalResponse(
    workflowContext: string,
    processingStartTime: number
  ): Promise<ProcessingResult> {
    logger.info('Generating final response');

    const context = createBuilderContext(undefined, undefined, 'generate_final_response');

    const finalResult = await BuilderGuard.safeExecute(
      this.builders?.final,
      'final',
      workflowContext,
      context
    );
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
        processingTime: Date.now() - processingStartTime
      }
    };
  }

}