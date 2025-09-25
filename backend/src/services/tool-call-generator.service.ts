import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
// import { AgentFactory } from '../framework/agent-factory'; // Removed to avoid circular dependency
import { ContactService } from './contact.service';
import { ToolCall, ToolResult } from '../types/tools';
import { SlackContext } from '../types/slack/slack.types';
import { GatheredContext } from './context-manager.service';
import { IntentAnalysis } from './intent-analysis.service';

/**
 * Tool call generation interfaces
 */
export interface ToolCallGenerationContext {
  intent: IntentAnalysis;
  gatheredContext: GatheredContext;
  sessionId: string;
  userId?: string;
  slackContext?: SlackContext;
  accessToken?: string;
}

export interface ToolCallValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  enhancedToolCalls: ToolCall[];
}

export interface ToolCallEnhancement {
  originalToolCall: ToolCall;
  enhancedToolCall: ToolCall;
  enhancements: string[];
}

/**
 * Service responsible for generating and validating tool calls
 *
 * Single Responsibility: Tool Call Generation & Validation
 * - Generates tool calls based on intent and context
 * - Validates tool call parameters and requirements
 * - Enhances tool calls with additional context
 * - Resolves contact names and dependencies
 */
export class ToolCallGenerator extends BaseService {
  private contactService: ContactService | null = null;

  constructor() {
    super('ToolCallGenerator');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.contactService = serviceManager.getService<ContactService>('contactService') || null;

    this.logInfo('ToolCallGenerator initialized successfully');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ToolCallGenerator destroyed');
  }

  /**
   * Generate tool calls based on intent and context
   *
   * @param context - Tool call generation context
   * @returns Promise resolving to generated tool calls
   */
  async generateToolCalls(context: ToolCallGenerationContext): Promise<ToolCall[]> {
    this.assertReady();

    this.logDebug('Generating tool calls', {
      intentType: context.intent.intentType,
      sessionId: context.sessionId,
      hasSlackContext: !!context.slackContext
    });

    try {
      let toolCalls: ToolCall[] = [];

      switch (context.intent.intentType) {
        case 'new_write_operation':
          toolCalls = await this.generateWriteOperationToolCalls(context);
          break;

        case 'read_operation':
          toolCalls = this.generateReadOperationToolCalls(context);
          break;

        case 'confirmation_positive':
        case 'confirmation_negative':
          // These don't generate new tool calls, they execute existing ones
          toolCalls = [];
          break;

        case 'draft_modification':
          toolCalls = await this.generateDraftModificationToolCalls(context);
          break;

        default:
          toolCalls = await this.generateGeneralToolCalls(context);
      }

      this.logInfo('Generated tool calls', {
        intentType: context.intent.intentType,
        toolCallCount: toolCalls.length,
        sessionId: context.sessionId
      });

      return toolCalls;
    } catch (error) {
      this.logError('Failed to generate tool calls', { error, context });
      return [];
    }
  }

  /**
   * Validate and enhance tool calls
   *
   * @param toolCalls - Tool calls to validate and enhance
   * @param context - Generation context
   * @returns Promise resolving to validation result
   */
  async validateAndEnhanceToolCalls(
    toolCalls: ToolCall[],
    context: ToolCallGenerationContext
  ): Promise<ToolCallValidationResult> {
    this.assertReady();

    const errors: string[] = [];
    const warnings: string[] = [];
    const enhancedToolCalls: ToolCall[] = [];

    this.logDebug('Validating and enhancing tool calls', {
      toolCallCount: toolCalls.length,
      sessionId: context.sessionId
    });

    for (const toolCall of toolCalls) {
      try {
        // Basic validation
        const validationErrors = this.validateBasicToolCall(toolCall);
        errors.push(...validationErrors);

        // Enhance with context
        const enhanced = await this.enhanceToolCallWithContext(toolCall, context);
        enhancedToolCalls.push(enhanced.enhancedToolCall);

        // Log enhancements
        if (enhanced.enhancements.length > 0) {
          this.logDebug('Enhanced tool call', {
            toolName: toolCall.name,
            enhancements: enhanced.enhancements
          });
        }

      } catch (error) {
        this.logError('Failed to validate/enhance tool call', { error, toolCall });
        errors.push(`Failed to process tool call ${toolCall.name}: ${error}`);
        // Add original tool call as fallback
        enhancedToolCalls.push(toolCall);
      }
    }

    const result: ToolCallValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      enhancedToolCalls
    };

    this.logInfo('Tool call validation completed', {
      toolCallCount: toolCalls.length,
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      sessionId: context.sessionId
    });

    return result;
  }

  /**
   * Enhance a single tool call with additional context
   *
   * @param toolCall - Tool call to enhance
   * @param context - Generation context
   * @returns Promise resolving to enhancement result
   */
  async enhanceToolCallWithContext(
    toolCall: ToolCall,
    context: ToolCallGenerationContext
  ): Promise<ToolCallEnhancement> {
    const enhancements: string[] = [];
    const enhancedParameters = { ...toolCall.parameters };

    try {
      // Add session context
      if (context.sessionId && !enhancedParameters.sessionId) {
        enhancedParameters.sessionId = context.sessionId;
        enhancements.push('added sessionId');
      }

      // Add user context
      if (context.userId && !enhancedParameters.userId) {
        enhancedParameters.userId = context.userId;
        enhancements.push('added userId');
      }

      // Add Slack context for Slack-aware operations
      if (context.slackContext && this.isSlackAwareOperation(toolCall.name)) {
        if (!enhancedParameters.slackContext) {
          enhancedParameters.slackContext = context.slackContext;
          enhancements.push('added slackContext');
        }
      }

      // Add access token for authenticated operations
      if (context.accessToken && this.needsAuthentication(toolCall.name)) {
        if (!enhancedParameters.accessToken) {
          enhancedParameters.accessToken = context.accessToken;
          enhancements.push('added accessToken');
        }
      }

      // Resolve contact names for email operations
      if (this.isEmailOperation(toolCall.name) && enhancedParameters.to) {
        const resolvedRecipients = await this.resolveContactNames(
          Array.isArray(enhancedParameters.to) ? enhancedParameters.to : [enhancedParameters.to],
          context
        );
        if (resolvedRecipients.length > 0) {
          enhancedParameters.to = resolvedRecipients;
          enhancements.push('resolved contact names');
        }
      }

      // Add context from conversation for content generation
      if (this.needsContextualContent(toolCall.name) && context.gatheredContext.analysis.relevantHistory.length > 0) {
        if (!enhancedParameters.conversationContext) {
          enhancedParameters.conversationContext = context.gatheredContext.analysis.relevantHistory.slice(-3);
          enhancements.push('added conversation context');
        }
      }

      const enhancedToolCall: ToolCall = {
        ...toolCall,
        parameters: enhancedParameters
      };

      return {
        originalToolCall: toolCall,
        enhancedToolCall,
        enhancements
      };
    } catch (error) {
      this.logError('Failed to enhance tool call', { error, toolCall });
      return {
        originalToolCall: toolCall,
        enhancedToolCall: toolCall, // Return original on error
        enhancements: []
      };
    }
  }

  /**
   * Private helper methods
   */

  private async generateWriteOperationToolCalls(context: ToolCallGenerationContext): Promise<ToolCall[]> {
    const toolCalls: ToolCall[] = [];

    if (context.intent.newOperation?.type === 'email') {
      toolCalls.push({
        name: 'send_email',
        parameters: {
          operation: 'send',
          ...context.intent.newOperation.parameters
        }
      });
    }

    if (context.intent.newOperation?.type === 'calendar') {
      toolCalls.push({
        name: 'create_calendar_event',
        parameters: {
          operation: 'create',
          ...context.intent.newOperation.parameters
        }
      });
    }

    return toolCalls;
  }

  private generateReadOperationToolCalls(context: ToolCallGenerationContext): ToolCall[] {
    if (context.intent.readOperations) {
      return context.intent.readOperations.map(op => ({
        name: op.name,
        parameters: op.parameters
      }));
    }

    return [];
  }

  private async generateDraftModificationToolCalls(context: ToolCallGenerationContext): Promise<ToolCall[]> {
    const toolCalls: ToolCall[] = [];

    if (context.intent.targetDraftId && context.intent.modifications) {
      toolCalls.push({
        name: 'modify_draft',
        parameters: {
          draftId: context.intent.targetDraftId,
          modifications: context.intent.modifications
        }
      });
    }

    return toolCalls;
  }

  private async generateGeneralToolCalls(context: ToolCallGenerationContext): Promise<ToolCall[]> {
    // For general requests, we might need to analyze further
    // This could involve more sophisticated intent parsing
    return [];
  }

  private validateBasicToolCall(toolCall: ToolCall): string[] {
    const errors: string[] = [];

    if (!toolCall.name) {
      errors.push('Tool call missing name');
    }


    if (!toolCall.parameters || typeof toolCall.parameters !== 'object') {
      errors.push('Tool call missing or invalid parameters');
    }

    // Validate specific tool requirements
    if (toolCall.name === 'send_email') {
      if (!toolCall.parameters.to) {
        errors.push('Email tool call missing "to" parameter');
      }
      if (!toolCall.parameters.subject && !toolCall.parameters.body) {
        errors.push('Email tool call missing subject or body');
      }
    }

    return errors;
  }

  private isSlackAwareOperation(toolName: string): boolean {
    const slackAwareOps = [
      'send_slack_message',
      'update_slack_status',
      'slack_notification'
    ];
    return slackAwareOps.includes(toolName);
  }

  private needsAuthentication(toolName: string): boolean {
    const authOps = [
      'send_email',
      'get_emails',
      'create_calendar_event',
      'get_calendar_events',
      'get_contacts'
    ];
    return authOps.includes(toolName);
  }

  private isEmailOperation(toolName: string): boolean {
    const emailOps = [
      'send_email',
      'reply_to_email',
      'forward_email'
    ];
    return emailOps.includes(toolName);
  }

  private needsContextualContent(toolName: string): boolean {
    const contextualOps = [
      'send_email',
      'create_calendar_event',
      'draft_response'
    ];
    return contextualOps.includes(toolName);
  }

  private async resolveContactNames(
    recipients: string[],
    context: ToolCallGenerationContext
  ): Promise<string[]> {
    if (!this.contactService) {
      this.logWarn('Contact service not available for name resolution');
      return recipients;
    }

    const resolved: string[] = [];

    for (const recipient of recipients) {
      try {
        // If it's already an email, keep it
        if (recipient.includes('@')) {
          resolved.push(recipient);
          continue;
        }

        // Try to resolve as contact name
        if (context.accessToken) {
          // This would call contact service to resolve names
          // For now, just return the original
          resolved.push(recipient);
        } else {
          resolved.push(recipient);
        }
      } catch (error) {
        this.logWarn('Failed to resolve contact name', { recipient, error });
        resolved.push(recipient); // Keep original on error
      }
    }

    return resolved;
  }
}