import { BaseService } from './base-service';
import { serviceManager } from "./service-manager";
import { OpenAIService } from './openai.service';
import { ToolResult } from '../types/tools';
import { Draft } from './draft-manager.service';
import { AppError } from '../utils/app-error';

/**
 * Response formatting interfaces
 */
export interface FormattedResponse {
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
  toolResults?: ToolResult[];
  success: boolean;
  executionMetadata?: {
    processingTime?: number;
    workflowId?: string;
    totalSteps?: number;
    workflowAction?: string;
  };
}

export interface ErrorResponse {
  message: string;
  success: false;
  error: {
    type: string;
    message: string;
    context?: Record<string, unknown>;
  };
  suggestions?: string[];
}

export interface FormattingContext {
  sessionId: string;
  userId?: string;
  userInput: string;
  processingStartTime: number;
  workflowId?: string;
  totalSteps?: number;
  workflowAction?: string;
}

export interface WorkflowFormattingContext extends FormattingContext {
  workflowContext: any; // StringWorkflowContext
  stepResults: string[];
  completedSteps: string[];
  globalContext: string[];
  originalRequest: string;
}

/**
 * Service responsible for formatting responses and handling errors
 *
 * Single Responsibility: Response Formatting & Error Handling
 * - Formats successful operation responses
 * - Handles error formatting with user-friendly messages
 * - Generates natural language responses from tool results
 * - Manages draft content presentation
 */
export class ResponseFormatter extends BaseService {
  private openaiService: OpenAIService | null = null;

  constructor() {
    super('ResponseFormatter');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.openaiService = serviceManager.getService<OpenAIService>('openaiService') || null;

    if (!this.openaiService) {
      this.logWarn('OpenAI service not available for response generation');
    }

    this.logInfo('ResponseFormatter initialized successfully');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ResponseFormatter destroyed');
  }

  /**
   * Format a successful response with tool results
   *
   * @param toolResults - Results from tool execution
   * @param context - Formatting context
   * @returns Promise resolving to formatted response
   */
  async formatSuccessResponse(
    toolResults: ToolResult[],
    context: FormattingContext
  ): Promise<FormattedResponse> {
    this.assertReady();

    try {
      this.logDebug('Formatting success response', {
        toolResultCount: toolResults.length,
        sessionId: context.sessionId
      });

      // Generate natural language response from tool results
      const message = await this.generateNaturalLanguageResponse(
        toolResults,
        context.userInput,
        context
      );

      // Calculate processing time
      const processingTime = Date.now() - context.processingStartTime;

      // Extract draft information if present
      const draftInfo = this.extractDraftInfo(toolResults);

      const response: FormattedResponse = {
        message,
        needsConfirmation: false, // Will be set by caller if needed
        success: true,
        toolResults,
        executionMetadata: {
          processingTime,
          workflowId: context.workflowId,
          totalSteps: context.totalSteps,
          workflowAction: context.workflowAction
        }
      };

      // Add draft information if present
      if (draftInfo) {
        response.draftId = draftInfo.draftId;
        response.draftContents = draftInfo.contents;
        response.needsConfirmation = true;
      }

      this.logInfo('Success response formatted', {
        messageLength: message.length,
        hasDraft: !!draftInfo,
        processingTime,
        sessionId: context.sessionId
      });

      return response;
    } catch (error) {
      this.logError('Failed to format success response', { error, context });

      // Return fallback response
      return {
        message: 'Operation completed successfully.',
        needsConfirmation: false,
        success: true,
        toolResults,
        executionMetadata: {
          processingTime: Date.now() - context.processingStartTime
        }
      };
    }
  }

  /**
   * Format a workflow response with LLM-based formatting
   *
   * @param context - Workflow formatting context
   * @returns Promise resolving to formatted response
   */
  async formatWorkflowResponse(
    context: WorkflowFormattingContext
  ): Promise<FormattedResponse> {
    this.assertReady();

    try {
      this.logDebug('Formatting workflow response', {
        stepCount: context.stepResults.length,
        sessionId: context.sessionId
      });

      // Generate natural language response from workflow results
      const message = await this.generateWorkflowResponse(context);

      // Calculate processing time
      const processingTime = Date.now() - context.processingStartTime;

      const response: FormattedResponse = {
        message,
        needsConfirmation: false,
        success: true,
        executionMetadata: {
          processingTime,
          workflowId: context.workflowId,
          totalSteps: context.stepResults.length,
          workflowAction: context.workflowAction
        }
      };

      this.logInfo('Workflow response formatted', {
        messageLength: message.length,
        processingTime,
        sessionId: context.sessionId
      });

      return response;

    } catch (error) {
      this.logError('Failed to format workflow response', { error, context });

      // Return fallback response
      return {
        message: 'Workflow completed successfully.',
        needsConfirmation: false,
        success: true,
        executionMetadata: {
          processingTime: Date.now() - context.processingStartTime
        }
      };
    }
  }

  /**
   * Format an error response with user-friendly messaging
   *
   * @param error - Error to format
   * @param context - Formatting context
   * @returns Promise resolving to formatted error response
   */
  async formatErrorResponse(
    error: Error | AppError,
    context: FormattingContext
  ): Promise<ErrorResponse> {
    this.assertReady();

    try {
      this.logDebug('Formatting error response', {
        errorType: error.constructor.name,
        sessionId: context.sessionId
      });

      // Generate user-friendly error message
      const userFriendlyMessage = await this.generateUserFriendlyErrorMessage(
        error,
        context.userInput
      );

      // Generate helpful suggestions
      const suggestions = await this.generateErrorSuggestions(error, context);

      const errorResponse: ErrorResponse = {
        message: userFriendlyMessage,
        success: false,
        error: {
          type: error.constructor.name,
          message: error.message,
          context: error instanceof AppError ? error.metadata : undefined
        },
        suggestions
      };

      this.logInfo('Error response formatted', {
        errorType: error.constructor.name,
        suggestionsCount: suggestions.length,
        sessionId: context.sessionId
      });

      return errorResponse;
    } catch (formattingError) {
      this.logError('Failed to format error response', {
        formattingError,
        originalError: error,
        context
      });

      // Return basic fallback error response
      return {
        message: 'I encountered an unexpected error while processing your request. Please try again or contact support if the issue persists.',
        success: false,
        error: {
          type: 'UnknownError',
          message: error.message
        }
      };
    }
  }

  /**
   * Format a draft confirmation response
   *
   * @param draft - Draft to format
   * @param context - Formatting context
   * @returns Promise resolving to formatted response
   */
  async formatDraftResponse(
    draft: Draft,
    context: FormattingContext
  ): Promise<FormattedResponse> {
    this.assertReady();

    try {
      this.logDebug('Formatting draft response', {
        draftType: draft.type,
        draftId: draft.id,
        sessionId: context.sessionId
      });

      // Generate natural language description of the draft
      const draftDescription = await this.generateDraftDescription(draft);

      const response: FormattedResponse = {
        message: draftDescription,
        needsConfirmation: true,
        draftId: draft.id,
        draftContents: {
          action: draft.type,
          recipient: this.extractRecipient(draft),
          subject: this.extractSubject(draft),
          body: this.extractBody(draft),
          previewData: draft.parameters
        },
        success: true,
        executionMetadata: {
          processingTime: Date.now() - context.processingStartTime,
          workflowId: context.workflowId,
          totalSteps: context.totalSteps,
          workflowAction: context.workflowAction
        }
      };

      this.logInfo('Draft response formatted', {
        draftType: draft.type,
        messageLength: draftDescription.length,
        sessionId: context.sessionId
      });

      return response;
    } catch (error) {
      this.logError('Failed to format draft response', { error, draft, context });

      // Return fallback draft response
      return {
        message: `I've prepared a ${draft.type} for your review. Please confirm if you'd like to proceed.`,
        needsConfirmation: true,
        draftId: draft.id,
        success: true,
        executionMetadata: {
          processingTime: Date.now() - context.processingStartTime
        }
      };
    }
  }

  /**
   * Private helper methods
   */

  private async generateNaturalLanguageResponse(
    toolResults: ToolResult[],
    userInput: string,
    context: FormattingContext
  ): Promise<string> {
    if (!this.openaiService) {
      return this.generateFallbackResponse(toolResults);
    }

    try {
      const prompt = this.buildResponseGenerationPrompt(toolResults, userInput, context);

      const response = await this.openaiService.generateText(
        toolResults.map(r => r.toolName).join(', '),
        prompt,
        {
          temperature: 0.7,
          maxTokens: 300
        }
      );

      // Clean up the response
      return response.trim().replace(/^(Assistant|AI):\s*/i, '');
    } catch (error) {
      this.logWarn('Failed to generate natural language response, using fallback', { error });
      return this.generateFallbackResponse(toolResults);
    }
  }

  private async generateUserFriendlyErrorMessage(
    error: Error | AppError,
    userInput: string
  ): Promise<string> {
    if (!this.openaiService) {
      return this.generateFallbackErrorMessage(error);
    }

    try {
      const prompt = `Create a helpful, user-friendly error message for this situation:

User asked: "${userInput}"
Error occurred: ${error.message}
Error type: ${error.constructor.name}

Generate a clear, helpful response that:
1. Acknowledges the user's request
2. Explains what went wrong in simple terms
3. Avoids technical jargon
4. Maintains a helpful, professional tone

Response:`;

      const response = await this.openaiService.generateText(
        userInput,
        prompt,
        {
          temperature: 0.5,
          maxTokens: 200
        }
      );

      return response.trim();
    } catch (genError) {
      this.logWarn('Failed to generate user-friendly error message', { genError });
      return this.generateFallbackErrorMessage(error);
    }
  }

  private async generateErrorSuggestions(
    error: Error | AppError,
    context: FormattingContext
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Generate context-aware suggestions based on error type
    if (error.message.includes('authentication') || error.message.includes('token')) {
      suggestions.push('Try reconnecting your account');
      suggestions.push('Check if your permissions are up to date');
    }

    if (error.message.includes('network') || error.message.includes('connection')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try again in a few moments');
    }

    if (error.message.includes('not found') || error.message.includes('missing')) {
      suggestions.push('Verify the information is correct');
      suggestions.push('Try being more specific in your request');
    }

    // Default suggestions if none above apply
    if (suggestions.length === 0) {
      suggestions.push('Try rephrasing your request');
      suggestions.push('Check if all required information is provided');
    }

    return suggestions;
  }

  private async generateDraftDescription(draft: Draft): Promise<string> {
    if (!this.openaiService) {
      return this.generateFallbackDraftDescription(draft);
    }

    try {
      const prompt = `Generate a clear, concise description of this draft action for user confirmation:

Draft Type: ${draft.type}
Parameters: ${JSON.stringify(draft.parameters, null, 2)}
Risk Level: ${draft.riskLevel}

Create a natural language description that:
1. Clearly states what action will be taken
2. Includes key details (recipient, subject, etc.)
3. Asks for confirmation appropriately
4. Is concise but complete

Description:`;

      const response = await this.openaiService.generateText(
        `${draft.type} draft`,
        prompt,
        {
          temperature: 0.3,
          maxTokens: 150
        }
      );

      return response.trim();
    } catch (error) {
      this.logWarn('Failed to generate draft description', { error });
      return this.generateFallbackDraftDescription(draft);
    }
  }

  private buildResponseGenerationPrompt(
    toolResults: ToolResult[],
    userInput: string,
    context: FormattingContext
  ): string {
    const resultsContext = toolResults.map(result =>
      `Tool: ${result.toolName}, Success: ${result.success}, Result: ${JSON.stringify(result.result)}`
    ).join('\n');

    return `Generate a natural, helpful response based on these tool execution results:

User Request: "${userInput}"

Tool Results:
${resultsContext}

Create a response that:
1. Acknowledges what was accomplished
2. Summarizes key information from the results
3. Is conversational and natural
4. Avoids technical details about tool execution
5. Is concise but informative

Response:`;
  }

  private generateFallbackResponse(toolResults: ToolResult[]): string {
    const successfulTools = toolResults.filter(r => r.success).length;
    const totalTools = toolResults.length;

    if (successfulTools === totalTools) {
      return `Successfully completed your request using ${totalTools} operation${totalTools > 1 ? 's' : ''}.`;
    } else if (successfulTools > 0) {
      return `Completed ${successfulTools} of ${totalTools} operations successfully.`;
    } else {
      return 'I encountered some issues while processing your request.';
    }
  }

  private generateFallbackErrorMessage(error: Error | AppError): string {
    const errorType = error.constructor.name;

    switch (errorType) {
      case 'AuthenticationError':
        return 'I need you to reconnect your account to continue.';
      case 'ValidationError':
        return 'Some of the information provided seems to be invalid.';
      case 'NetworkError':
        return 'I\'m having trouble connecting right now. Please try again.';
      case 'PermissionError':
        return 'I don\'t have the necessary permissions to complete this action.';
      default:
        return 'I encountered an unexpected error. Please try again or contact support.';
    }
  }

  private generateFallbackDraftDescription(draft: Draft): string {
    const action = draft.type.replace('_', ' ');
    const recipient = this.extractRecipient(draft);
    const subject = this.extractSubject(draft);

    let description = `I've prepared a ${action}`;

    if (recipient) {
      description += ` to ${recipient}`;
    }

    if (subject) {
      description += ` with the subject "${subject}"`;
    }

    description += '. Would you like me to proceed?';

    return description;
  }

  private extractDraftInfo(toolResults: ToolResult[]): { draftId: string; contents: any } | null {
    for (const result of toolResults) {
      if (result.result && typeof result.result === 'object') {
        const resultObj = result.result as Record<string, unknown>;
        if (resultObj.draftId) {
          return {
            draftId: resultObj.draftId as string,
            contents: resultObj
          };
        }
      }
    }
    return null;
  }

  private extractRecipient(draft: Draft): string | undefined {
    const params = draft.parameters as Record<string, unknown>;
    return params.to as string || params.recipient as string;
  }

  private extractSubject(draft: Draft): string | undefined {
    const params = draft.parameters as Record<string, unknown>;
    return params.subject as string;
  }

  private extractBody(draft: Draft): string | undefined {
    const params = draft.parameters as Record<string, unknown>;
    return params.body as string || params.content as string;
  }

  /**
   * Generate natural language response from workflow results
   */
  private async generateWorkflowResponse(context: WorkflowFormattingContext): Promise<string> {
    if (!this.openaiService) {
      return context.stepResults.join('\n\n');
    }

    const prompt = `You are formatting the final response for a user's request that was processed through a multi-step workflow.

ORIGINAL USER REQUEST: "${context.originalRequest}"

WORKFLOW STEPS COMPLETED:
${context.completedSteps.map((step, i) => 
  `${i + 1}. ${step}\n   Result: ${context.stepResults[i]?.substring(0, 200) || 'N/A'}`
).join('\n\n')}

GLOBAL CONTEXT GATHERED:
${context.globalContext.length > 0 ? context.globalContext.join('\n') : 'No additional context'}

INSTRUCTIONS:
1. Create a coherent, professional response that addresses the user's original request
2. Synthesize the step results into a natural, helpful response
3. Include relevant information from the global context
4. Be concise but comprehensive
5. Use a friendly, helpful tone
6. Focus on what was accomplished and any important findings

Return a well-formatted response that the user will find helpful and informative.`;

    try {
      const response = await this.openaiService.generateText(
        context.originalRequest,
        prompt,
        {
          temperature: 0.7,
          maxTokens: 800
        }
      );

      return response.trim();
    } catch (error) {
      this.logError('Failed to generate workflow response', { error });
      return context.stepResults.join('\n\n');
    }
  }
}