import logger from '../utils/logger';
import { serviceManager } from '../services/service-manager';

// Extracted services
import { IntentAnalysisService, AnalysisContext, IntentAnalysis } from '../services/intent-analysis.service';
import { ContextManager, GatheredContext } from '../services/context-manager.service';
import { StringPlanningService, StringWorkflowContext, StringStepPlan } from '../services/string-planning.service';
import { ResponseFormatter, FormattingContext, FormattedResponse } from '../services/response-formatter.service';
import { DraftManager, Draft } from '../services/draft-manager.service';
import { PlanReevaluationService } from '../services/plan-reevaluation.service';
import { AgentFactory } from '../framework/agent-factory';

// Types
import { SlackContext } from '../types/slack/slack.types';

/**
 * Simplified processing result interface
 */
export interface ProcessingResult {
  message: string;
  needsConfirmation: boolean;
  draftId?: string;
  draftContents?: {
    action: string;
    recipient?: string;
    subject?: string;
    body?: string;
    previewData: unknown;
  };
  success: boolean;
  executionMetadata?: {
    processingTime?: number;
    workflowId?: string;
    totalSteps?: number;
    workflowAction?: string;
  };
}

/**
 * Refactored MasterAgent with Single Responsibility Principle compliance
 *
 * Single Responsibility: Request Orchestration
 * - Orchestrates the processing pipeline using extracted services
 * - Manages the flow between intent analysis, context gathering, planning, and response formatting
 * - Handles draft management and confirmation flows
 * - Provides a clean, simple interface for processing user requests
 */
export class MasterAgent {
  private intentAnalysisService: IntentAnalysisService | null = null;
  private contextManager: ContextManager | null = null;
  private stringPlanningService: StringPlanningService | null = null;
  private responseFormatter: ResponseFormatter | null = null;
  private draftManager: DraftManager | null = null;
  private planReevaluationService: PlanReevaluationService | null = null;

  private isInitialized = false;

  /**
   * Initialize MasterAgent and get service dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get all required services
      this.intentAnalysisService = serviceManager.getService<IntentAnalysisService>('intentAnalysisService') || null;
      this.contextManager = serviceManager.getService<ContextManager>('contextManager') || null;
      this.stringPlanningService = serviceManager.getService<StringPlanningService>('stringPlanningService') || null;
      this.responseFormatter = serviceManager.getService<ResponseFormatter>('responseFormatter') || null;
      this.draftManager = serviceManager.getService<DraftManager>('draftManager') || null;
      this.planReevaluationService = serviceManager.getService<PlanReevaluationService>('planReevaluationService') || null;

      // Validate critical services
      if (!this.intentAnalysisService) {
        throw new Error('IntentAnalysisService not available');
      }
      if (!this.contextManager) {
        throw new Error('ContextManager not available');
      }
      if (!this.stringPlanningService) {
        throw new Error('StringPlanningService not available');
      }
      if (!this.responseFormatter) {
        throw new Error('ResponseFormatter not available');
      }
      if (!this.planReevaluationService) {
        throw new Error('PlanReevaluationService not available');
      }

      this.isInitialized = true;

      logger.info('MasterAgent initialized successfully with decomposed services', {
        operation: 'master_agent_init',
        services: [
          'intentAnalysisService',
          'contextManager',
          'stringPlanningService',
          'responseFormatter',
          'draftManager',
          'planReevaluationService'
        ]
      });

    } catch (error) {
      logger.error('MasterAgent initialization failed', error as Error, {
        operation: 'master_agent_init_error'
      });
      throw error;
    }
  }

  /**
   * Process user input with full orchestration pipeline
   */
  async processUserInput(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ProcessingResult> {
    await this.ensureInitialized();

    const processingStartTime = Date.now();

    logger.info('Processing user input with refactored MasterAgent', {
      userInputLength: userInput.length,
      sessionId,
      userId,
      hasSlackContext: !!slackContext,
      operation: 'process_user_input'
    });

    try {
      // Step 1: Gather context
      const gatheredContext = await this.contextManager!.gatherContext(sessionId, slackContext);

      // Update conversation history
      await this.contextManager!.updateConversationHistory(sessionId, userInput, 'user');

      // Step 2: Analyze intent
      const analysisContext: AnalysisContext = {
        userInput,
        sessionId,
        hasPendingDrafts: await this.hasPendingDrafts(sessionId),
        existingDrafts: await this.getExistingDrafts(sessionId),
        conversationHistory: gatheredContext.analysis.relevantHistory,
        slackContext: slackContext ? {
          channel: slackContext.channelId || 'unknown',
          userId: slackContext.userId || 'unknown',
          teamId: slackContext.teamId || 'unknown',
          threadTs: slackContext.threadTs,
          recentMessages: gatheredContext.conversation.recentMessages
        } : undefined
      };

      const intent = await this.intentAnalysisService!.analyzeIntent(analysisContext);

      // Step 3: Handle different intent types
      const result = await this.handleIntentBasedFlow(
        intent,
        gatheredContext,
        userInput,
        sessionId,
        userId,
        slackContext,
        processingStartTime
      );

      // Update conversation history with response
      await this.contextManager!.updateConversationHistory(sessionId, result.message, 'assistant');

      return result;

    } catch (error) {
      logger.error('Failed to process user input', error as Error, {
        userInput: userInput.substring(0, 100) + '...',
        sessionId,
        userId,
        operation: 'process_user_input_error'
      });

      // Generate error response
      return await this.handleProcessingError(error, userInput, sessionId, processingStartTime);
    }
  }

  /**
   * Alias method for backward compatibility
   */
  async processUserInputWithDrafts(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ProcessingResult> {
    return this.processUserInput(userInput, sessionId, userId, slackContext);
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

  private async handleIntentBasedFlow(
    intent: IntentAnalysis,
    gatheredContext: GatheredContext,
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext,
    processingStartTime: number = Date.now()
  ): Promise<ProcessingResult> {
    const formattingContext: FormattingContext = {
      sessionId,
      userId,
      userInput,
      processingStartTime
    };

    switch (intent.intentType) {
      case 'confirmation_positive':
        return await this.handleConfirmationPositive(sessionId, formattingContext);

      case 'confirmation_negative':
        return await this.handleConfirmationNegative(sessionId, formattingContext);

      case 'draft_modification':
        return await this.handleDraftModification(intent, formattingContext);

      case 'new_write_operation':
      case 'read_operation':
      case 'new_request':
        return await this.handleNaturalLanguageWorkflow(
          intent,
          gatheredContext,
          formattingContext,
          sessionId,
          userId,
          slackContext
        );

      default:
        return await this.handleUnknownIntent(formattingContext);
    }
  }

  private async handleConfirmationPositive(
    sessionId: string,
    context: FormattingContext
  ): Promise<ProcessingResult> {
    if (!this.draftManager) {
      return this.createErrorResult('Draft manager not available', context);
    }

    try {
      const pendingDrafts = await this.draftManager.getSessionDrafts(sessionId);

      if (pendingDrafts.length === 0) {
        return this.createSuccessResult(
          "I don't see any pending actions to confirm. What would you like me to help you with?",
          context
        );
      }

      // Execute the most recent draft
      const draft = pendingDrafts[0];
      if (!draft) {
        return this.createErrorResult('No draft found to execute', context);
      }
      const toolResults = await this.executeDraft(draft);

      const formattedResponse = await this.responseFormatter!.formatSuccessResponse(
        toolResults,
        context
      );

      return this.convertResponseToProcessingResult(formattedResponse);

    } catch (error) {
      logger.error('Failed to handle confirmation positive', { error, sessionId });
      return this.createErrorResult('Failed to execute confirmation', context);
    }
  }

  private async handleConfirmationNegative(
    sessionId: string,
    context: FormattingContext
  ): Promise<ProcessingResult> {
    if (!this.draftManager) {
      return this.createErrorResult('Draft manager not available', context);
    }

    try {
      const pendingDrafts = await this.draftManager.getSessionDrafts(sessionId);

      if (pendingDrafts.length === 0) {
        return this.createSuccessResult(
          "I don't see any pending actions to cancel. What would you like me to help you with?",
          context
        );
      }

      // Cancel the most recent draft
      const draft = pendingDrafts[0];
      if (!draft) {
        return this.createErrorResult('No draft found to cancel', context);
      }
      await this.draftManager.removeDraft(draft.id);

      return this.createSuccessResult(
        "Got it, I've cancelled that action. What else can I help you with?",
        context
      );

    } catch (error) {
      logger.error('Failed to handle confirmation negative', { error, sessionId });
      return this.createErrorResult('Failed to cancel action', context);
    }
  }

  private async handleDraftModification(
    intent: IntentAnalysis,
    context: FormattingContext
  ): Promise<ProcessingResult> {
    if (!this.draftManager || !intent.targetDraftId || !intent.modifications) {
      return this.createErrorResult('Cannot modify draft: missing information', context);
    }

    try {
      const updatedDraft = await this.draftManager.updateDraft(
        intent.targetDraftId,
        intent.modifications.newValues
      );

      const formattedResponse = await this.responseFormatter!.formatDraftResponse(
        updatedDraft,
        context
      );

      return this.convertResponseToProcessingResult(formattedResponse);

    } catch (error) {
      logger.error('Failed to handle draft modification', { error, intent });
      return this.createErrorResult('Failed to modify draft', context);
    }
  }

  private async handleNaturalLanguageWorkflow(
    intent: IntentAnalysis,
    gatheredContext: GatheredContext,
    formattingContext: FormattingContext,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ProcessingResult> {
    try {
      // Step 1: Create workflow context with global textbox
      const workflowContext: StringWorkflowContext = {
        originalRequest: formattingContext.userInput,
        intentDescription: intent.intentDescription,
        intentType: intent.intentType,
        currentStep: 1,
        maxSteps: 10,
        completedSteps: [],
        stepResults: [],
        globalContext: [],  // Global "textbox" for any service
        userContext: {
          sessionId,
          userId,
          slackContext
        }
      };

      // Step 2: Create comprehensive plan upfront
      const comprehensivePlan = await this.stringPlanningService!.createComprehensivePlan(workflowContext);
      workflowContext.comprehensivePlan = comprehensivePlan;
      workflowContext.currentPlanStep = 1;

      if (comprehensivePlan.length === 0) {
        return this.createSuccessResult(
          "I understand what you're asking, but I'm not sure how to help with that right now. Could you try rephrasing your request?",
          formattingContext
        );
      }

      // Step 3: Execute plan step by step with reevaluation
      return await this.executeComprehensiveWorkflow(
        workflowContext,
        formattingContext
      );

    } catch (error) {
      logger.error('Failed to handle natural language workflow', { error, intent, sessionId });
      return this.createErrorResult('Failed to execute workflow', formattingContext);
    }
  }

  private async handleUnknownIntent(context: FormattingContext): Promise<ProcessingResult> {
    return this.createSuccessResult(
      "I'm not sure I understand what you're asking. Could you please rephrase your request or be more specific?",
      context
    );
  }

  private async executeComprehensiveWorkflow(
    workflowContext: StringWorkflowContext,
    formattingContext: FormattingContext
  ): Promise<ProcessingResult> {
    const maxSteps = 10;

    try {
      while (workflowContext.currentPlanStep! <= workflowContext.comprehensivePlan!.length && 
             workflowContext.currentStep <= maxSteps) {
        
        // Get next step from comprehensive plan
        const step = await this.stringPlanningService!.getNextStepFromPlan(workflowContext);
        
        if (step === 'complete') {
          break;
        }

        logger.info('Executing comprehensive workflow step', {
          stepNumber: workflowContext.currentPlanStep,
          totalSteps: workflowContext.comprehensivePlan!.length,
          stepDescription: step,
          sessionId: workflowContext.userContext?.sessionId
        });

        // Execute current step using AgentFactory
        const stepResult = await this.executeStepWithAgent(
          step,
          {
            sessionId: workflowContext.userContext?.sessionId || '',
            userId: workflowContext.userContext?.userId,
            slackContext: workflowContext.userContext?.slackContext,
            timestamp: new Date()
          }
        );

        // Update workflow context with step information
        workflowContext.completedSteps.push(step);
        workflowContext.stepResults.push(stepResult.result || 'Step completed');
        workflowContext.currentStepDescription = step;
        workflowContext.currentStep++;
        workflowContext.currentPlanStep!++;

        // Reevaluate plan based on step result
        const reevaluation = await this.planReevaluationService!.reevaluatePlan(
          workflowContext, 
          stepResult.result
        );

        if (reevaluation.earlyTermination) {
          logger.info('Workflow terminated early', {
            reason: reevaluation.reasoning,
            sessionId: workflowContext.userContext?.sessionId
          });
          break;
        }

        if (reevaluation.modifiedPlan) {
          logger.info('Plan modified during execution', {
            originalSteps: workflowContext.comprehensivePlan!.length,
            newSteps: reevaluation.modifiedPlan.length,
            reason: reevaluation.reasoning,
            sessionId: workflowContext.userContext?.sessionId
          });
          workflowContext.comprehensivePlan = reevaluation.modifiedPlan;
        }
      }

      // Format final response
      const finalResponse = workflowContext.stepResults.join('\n\n');
      return this.createSuccessResult(finalResponse, formattingContext);

    } catch (error) {
      logger.error('Comprehensive workflow execution failed', { error, workflowContext });
      return this.createErrorResult('Workflow execution failed', formattingContext);
    }
  }


  private async executeStepWithAgent(
    stepDescription: string,
    context: {
      sessionId: string;
      userId?: string;
      slackContext?: any;
      timestamp: Date;
    }
  ): Promise<{ success: boolean; result: string; error?: string }> {
    try {
      // Use AgentFactory to find the best agent for this step
      const agentResult = await AgentFactory.findBestAgentForRequest(stepDescription);
      
      if (!agentResult.agentName) {
        return {
          success: false,
          result: 'No suitable agent found for this step',
          error: 'Agent not found'
        };
      }

      // Execute the step using the natural language agent
      const executionResult = await AgentFactory.executeAgentWithNaturalLanguage(
        agentResult.agentName,
        stepDescription,
        context
      );

      return {
        success: executionResult.success,
        result: executionResult.response || 'Step completed',
        error: executionResult.error
      };

    } catch (error) {
      logger.error('Failed to execute step with agent', { error, stepDescription });
      return {
        success: false,
        result: 'Step execution failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeDraft(draft: Draft): Promise<any[]> {
    if (!this.draftManager) {
      throw new Error('Draft manager not available');
    }

    const result = await this.draftManager.executeDraft(draft.id);
    return [result];
  }

  private async hasPendingDrafts(sessionId: string): Promise<boolean> {
    if (!this.draftManager) {
      return false;
    }

    try {
      const drafts = await this.draftManager.getSessionDrafts(sessionId);
      return drafts.length > 0;
    } catch {
      return false;
    }
  }

  private async getExistingDrafts(sessionId: string): Promise<any[]> {
    if (!this.draftManager) {
      return [];
    }

    try {
      const drafts = await this.draftManager.getSessionDrafts(sessionId);
      return drafts.map((draft: Draft) => ({
        id: draft.id,
        type: draft.type,
        description: draft.previewData.description || `${draft.type} operation`,
        parameters: draft.parameters,
        createdAt: draft.createdAt,
        riskLevel: draft.riskLevel
      }));
    } catch {
      return [];
    }
  }

  private async handleProcessingError(
    error: unknown,
    userInput: string,
    sessionId: string,
    processingStartTime: number
  ): Promise<ProcessingResult> {
    return {
      message: 'I encountered an error while processing your request. Please try again.',
      needsConfirmation: false,
      success: false,
      executionMetadata: {
        processingTime: Date.now() - processingStartTime
      }
    };
  }

  private createSuccessResult(message: string, context: FormattingContext): ProcessingResult {
    return {
      message,
      needsConfirmation: false,
      success: true,
      executionMetadata: {
        processingTime: Date.now() - context.processingStartTime
      }
    };
  }

  private createErrorResult(message: string, context: FormattingContext): ProcessingResult {
    return {
      message,
      needsConfirmation: false,
      success: false,
      executionMetadata: {
        processingTime: Date.now() - context.processingStartTime
      }
    };
  }

  private convertResponseToProcessingResult(response: FormattedResponse): ProcessingResult {
    return {
      message: response.message,
      needsConfirmation: response.needsConfirmation,
      draftId: response.draftId,
      draftContents: response.draftContents,
      success: response.success,
      executionMetadata: response.executionMetadata
    };
  }
}