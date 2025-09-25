import logger from '../utils/logger';
import { AppError } from '../utils/app-error';
import { serviceManager } from '../services/service-manager';

// Extracted services
import { IntentAnalysisService, AnalysisContext, IntentAnalysis } from '../services/intent-analysis.service';
import { ContextManager, GatheredContext } from '../services/context-manager.service';
import { ToolCallGenerator, ToolCallGenerationContext } from '../services/tool-call-generator.service';
import { ResponseFormatter, FormattingContext, FormattedResponse } from '../services/response-formatter.service';
import { ServiceCoordinator, ServiceCoordinationContext } from '../services/service-coordinator.service';
import { DraftManager, Draft } from '../services/draft-manager.service';

// Types
import { SlackContext } from '../types/slack/slack.types';
import { ToolCall, ToolResult } from '../types/tools';

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
  toolCall?: ToolCall;
  toolResults?: ToolResult[];
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
 * - Manages the flow between intent analysis, context gathering, tool generation, and response formatting
 * - Handles draft management and confirmation flows
 * - Provides a clean, simple interface for processing user requests
 */
export class MasterAgent {
  private intentAnalysisService: IntentAnalysisService | null = null;
  private contextManager: ContextManager | null = null;
  private toolCallGenerator: ToolCallGenerator | null = null;
  private responseFormatter: ResponseFormatter | null = null;
  private serviceCoordinator: ServiceCoordinator | null = null;
  private draftManager: DraftManager | null = null;

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
      this.toolCallGenerator = serviceManager.getService<ToolCallGenerator>('toolCallGenerator') || null;
      this.responseFormatter = serviceManager.getService<ResponseFormatter>('responseFormatter') || null;
      this.serviceCoordinator = serviceManager.getService<ServiceCoordinator>('serviceCoordinator') || null;
      this.draftManager = serviceManager.getService<DraftManager>('draftManager') || null;

      // Validate critical services
      if (!this.intentAnalysisService) {
        throw new Error('IntentAnalysisService not available');
      }
      if (!this.contextManager) {
        throw new Error('ContextManager not available');
      }
      if (!this.toolCallGenerator) {
        throw new Error('ToolCallGenerator not available');
      }
      if (!this.responseFormatter) {
        throw new Error('ResponseFormatter not available');
      }
      if (!this.serviceCoordinator) {
        throw new Error('ServiceCoordinator not available');
      }

      this.isInitialized = true;

      logger.info('MasterAgent initialized successfully with decomposed services', {
        operation: 'master_agent_init',
        services: [
          'intentAnalysisService',
          'contextManager',
          'toolCallGenerator',
          'responseFormatter',
          'serviceCoordinator',
          'draftManager'
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
        return await this.handleToolExecution(
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
      const toolResults = await this.executeDraft(draft, context);

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

  private async handleToolExecution(
    intent: IntentAnalysis,
    gatheredContext: GatheredContext,
    formattingContext: FormattingContext,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ProcessingResult> {
    try {
      // Step 1: Generate tool calls
      const toolCallContext: ToolCallGenerationContext = {
        intent,
        gatheredContext,
        sessionId,
        userId,
        slackContext
      };

      const toolCalls = await this.toolCallGenerator!.generateToolCalls(toolCallContext);

      if (toolCalls.length === 0) {
        return this.createSuccessResult(
          "I understand what you're asking, but I'm not sure how to help with that right now. Could you try rephrasing your request?",
          formattingContext
        );
      }

      // Step 2: Validate and enhance tool calls
      const validationResult = await this.toolCallGenerator!.validateAndEnhanceToolCalls(
        toolCalls,
        toolCallContext
      );

      if (!validationResult.isValid) {
        return this.createErrorResult(
          `Tool validation failed: ${validationResult.errors.join(', ')}`,
          formattingContext
        );
      }

      // Step 3: Execute tool calls
      return await this.executeToolCallsDirectly(
        validationResult.enhancedToolCalls,
        formattingContext,
        sessionId,
        userId,
        slackContext
      );

    } catch (error) {
      logger.error('Failed to handle tool execution', { error, intent, sessionId });
      return this.createErrorResult('Failed to execute tools', formattingContext);
    }
  }

  private async handleUnknownIntent(context: FormattingContext): Promise<ProcessingResult> {
    return this.createSuccessResult(
      "I'm not sure I understand what you're asking. Could you please rephrase your request or be more specific?",
      context
    );
  }

  private async executeToolCallsDirectly(
    toolCalls: ToolCall[],
    formattingContext: FormattingContext,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext
  ): Promise<ProcessingResult> {
    // Step 1: Resolve dependencies
    const requiredServices = await this.resolveServiceDependencies(toolCalls);

    // Step 2: Coordinate service execution
    const coordinationContext: ServiceCoordinationContext = {
      sessionId,
      userId,
      slackContext,
      requiredServices
    };

    const executionResult = await this.serviceCoordinator!.coordinateServices(
      toolCalls,
      coordinationContext
    );

    // Step 3: Format response
    const formattedResponse = await this.responseFormatter!.formatSuccessResponse(
      executionResult.results,
      formattingContext
    );

    return this.convertResponseToProcessingResult(formattedResponse);
  }

  private async resolveServiceDependencies(toolCalls: ToolCall[]): Promise<string[]> {
    const services = new Set<string>();

    for (const toolCall of toolCalls) {
      const toolName = toolCall.name.toLowerCase();

      if (toolName.includes('email') || toolName.includes('gmail')) {
        services.add('gmailService');
        services.add('tokenManager');
      }

      if (toolName.includes('calendar')) {
        services.add('calendarService');
        services.add('tokenManager');
      }

      if (toolName.includes('contact')) {
        services.add('contactService');
        services.add('tokenManager');
      }

      if (toolName.includes('slack')) {
        services.add('slackService');
      }
    }

    return Array.from(services);
  }

  private async executeDraft(draft: Draft, context: FormattingContext): Promise<ToolResult[]> {
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
    } catch (error) {
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
    } catch (error) {
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
      toolResults: response.toolResults,
      success: response.success,
      executionMetadata: response.executionMetadata
    };
  }
}