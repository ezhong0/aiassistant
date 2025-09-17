import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { SlackContext, SlackAgentRequest, SlackAgentResponse } from '../../types/slack/slack.types';
import { ToolResult } from '../../types/tools';
import {
  SlackConfirmationRequest,
  SlackConfirmationResponse,
  SlackConfirmationDetectionResult,
  SlackConfirmationProposal,
  SlackConfirmationPendingAction,
  SlackConfirmationHandlerConfig,
  SlackConfirmationMessageData
} from '../../types/slack/slack-confirmation-types';
import { AIClassificationService } from '../ai-classification.service';
import { ToolExecutorService } from '../tool-executor.service';
import logger from '../../utils/logger';

/**
 * SlackConfirmationHandler - Focused service for Slack confirmation handling
 * Manages confirmation detection, proposal parsing, and confirmation processing
 */
export class SlackConfirmationHandler extends BaseService {
  private config: SlackConfirmationHandlerConfig;
  private aiClassificationService: AIClassificationService | null = null;
  private toolExecutorService: ToolExecutorService | null = null;
  private pendingActions = new Map<string, SlackConfirmationPendingAction>();

  constructor(config: SlackConfirmationHandlerConfig) {
    super('SlackConfirmationHandler');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackConfirmationHandler...');

      // Initialize service dependencies
      await this.initializeDependencies();

      // Start cleanup interval for expired confirmations
      this.startCleanupInterval();

      this.logInfo('SlackConfirmationHandler initialized successfully', {
        enableAIClassification: this.config.enableAIClassification,
        confirmationTimeout: this.config.confirmationTimeout,
        maxPendingConfirmations: this.config.maxPendingConfirmations,
        enableProposalParsing: this.config.enableProposalParsing,
        hasAIClassification: !!this.aiClassificationService,
        hasToolExecutor: !!this.toolExecutorService
      });
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.pendingActions.clear();
      this.aiClassificationService = null;
      this.toolExecutorService = null;
      this.logInfo('SlackConfirmationHandler destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackConfirmationHandler destruction', error);
    }
  }

  /**
   * Detect if message is a confirmation response
   */
  async detectConfirmation(message: string): Promise<SlackConfirmationDetectionResult> {
    try {
      if (!this.aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI confirmation detection is required for this operation.');
      }

      const classification = await this.aiClassificationService.classifyConfirmationResponse(message);
      
      return {
        isConfirmation: classification === 'confirm',
        isRejection: classification === 'reject',
        confidence: 0.8, // AI classification confidence
        reasoning: `AI classified as: ${classification}`,
        classification: classification as 'confirm' | 'reject' | 'unclear' | 'none'
      };
    } catch (error) {
      this.logError('Error detecting confirmation with AI', error);
      throw new Error('AI confirmation detection failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Process confirmation response
   */
  async processConfirmationResponse(request: SlackConfirmationRequest): Promise<SlackAgentResponse | null> {
    try {
      const confirmationId = this.generateConfirmationId(request);
      const pendingAction = this.pendingActions.get(confirmationId);

      if (!pendingAction) {
        this.logWarn('No pending confirmation found', { confirmationId });
        return null;
      }

      // Detect confirmation intent
      const detectionResult = await this.detectConfirmation(request.message);
      
      if (detectionResult.isConfirmation) {
        return await this.handleConfirmation(pendingAction);
      } else if (detectionResult.isRejection) {
        return await this.handleRejection(pendingAction);
      } else {
        return await this.handleUnclearResponse(pendingAction, detectionResult);
      }
    } catch (error) {
      this.logError('Error processing confirmation response', error);
      return null;
    }
  }

  /**
   * Create confirmation response from proposal data
   */
  async createConfirmationResponse(data: SlackConfirmationMessageData): Promise<SlackAgentResponse> {
    try {
      const confirmationId = this.generateConfirmationId({
        sessionId: data.sessionId,
        userId: 'unknown', // Will be set by caller
        channelId: data.channelId,
        teamId: 'unknown', // Will be set by caller
        message: '',
        originalToolResults: data.previewResults,
        userMessage: data.userMessage
      });

      // Store pending action
      const pendingAction: SlackConfirmationPendingAction = {
        sessionId: data.sessionId,
        userId: 'unknown', // Will be updated by caller
        channelId: data.channelId,
        teamId: 'unknown', // Will be updated by caller
        toolResults: data.previewResults,
        userMessage: data.userMessage,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.confirmationTimeout,
        confirmationId
      };

      this.pendingActions.set(confirmationId, pendingAction);

      // Create confirmation message
      const confirmationText = this.formatConfirmationMessage(data);

      return {
        success: true,
        response: {
          text: confirmationText,
          blocks: undefined
        }
      };
    } catch (error) {
      this.logError('Error creating confirmation response', error);
      return {
        success: false,
        response: {
          text: 'Error creating confirmation request',
          blocks: undefined
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse proposal from text
   */
  async parseProposal(proposalText: string, sessionId: string): Promise<SlackConfirmationProposal | null> {
    try {
      if (!this.config.enableProposalParsing) {
        return null;
      }

      // Extract action details from proposal text
      const actionType = await this.extractActionType(proposalText);
      const confidence = this.calculateConfidence(proposalText);
      const requiresConfirmation = this.determineConfirmationRequirement(actionType, confidence);

      return {
        text: proposalText,
        actionType,
        confidence,
        requiresConfirmation,
        originalToolCalls: [], // Will be populated by caller
        sessionId,
        userId: 'unknown', // Will be set by caller
        channelId: 'unknown', // Will be set by caller
        teamId: 'unknown' // Will be set by caller
      };
    } catch (error) {
      this.logError('Error parsing proposal', error);
      return null;
    }
  }

  /**
   * Handle confirmation (user said yes)
   */
  private async handleConfirmation(pendingAction: SlackConfirmationPendingAction): Promise<SlackAgentResponse> {
    try {
      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService not available');
      }

      // Execute the pending tools
      const executionResults = await this.toolExecutorService.executeTools(
        pendingAction.toolResults.map(result => ({ 
          name: result.toolName, 
          parameters: result.result 
        })),
        {
          sessionId: pendingAction.sessionId,
          userId: pendingAction.userId,
          timestamp: new Date(),
          metadata: {
            teamId: pendingAction.teamId,
            channelId: pendingAction.channelId
          }
        }
      );

      // Remove from pending actions
      this.pendingActions.delete(pendingAction.confirmationId);

      return {
        success: true,
        response: {
          text: '✅ Action confirmed and executed successfully!',
          blocks: undefined
        },
        executionMetadata: {
          processingTime: 0,
          toolResults: executionResults.map(result => ({
            toolName: result.toolName,
            success: result.success,
            executionTime: result.executionTime,
            error: result.error,
            result: result.result
          }))
        }
      };
    } catch (error) {
      this.logError('Error handling confirmation', error);
      return {
        success: false,
        response: {
          text: '❌ Error executing confirmed action',
          blocks: undefined
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle rejection (user said no)
   */
  private async handleRejection(pendingAction: SlackConfirmationPendingAction): Promise<SlackAgentResponse> {
    // Remove from pending actions
    this.pendingActions.delete(pendingAction.confirmationId);

    return {
      success: true,
      response: {
        text: '❌ Action cancelled as requested.',
        blocks: undefined
      }
    };
  }

  /**
   * Handle unclear response
   */
  private async handleUnclearResponse(
    pendingAction: SlackConfirmationPendingAction, 
    detectionResult: SlackConfirmationDetectionResult
  ): Promise<SlackAgentResponse> {
    return {
      success: true,
      response: {
        text: `I'm not sure if you want to proceed. Please respond with "yes" to confirm or "no" to cancel.`,
        blocks: undefined
      }
    };
  }

  /**
   * Format confirmation message
   */
  private formatConfirmationMessage(data: SlackConfirmationMessageData): string {
    const actionDescription = this.getActionDescription(data.actionType);

    let message = `🔍 Preview: ${actionDescription}\n\n`;

    // Show detailed preview of what will happen
    if (data.previewResults.length > 0) {
      data.previewResults.forEach((result, index) => {
        message += this.formatDetailedPreview(result);
        message += '\n';
      });
    }

    message += `\nConfirm: Reply "yes" to proceed or "no" to cancel.`;

    return message;
  }

  /**
   * Format detailed preview showing exactly what will happen
   */
  private formatDetailedPreview(toolResult: ToolResult): string {
    const preview = toolResult.result?.preview;
    if (!preview || !preview.previewData) {
      return `• ${this.formatToolResult(toolResult)}`;
    }

    const actionType = preview.actionType;
    const data = preview.previewData;

    switch (actionType) {
      case 'email':
      case 'email_send':
        return this.formatEmailPreview(data);
      case 'calendar':
      case 'calendar_create':
        return this.formatCalendarPreview(data);
      default:
        return `• ${preview.title || this.formatToolResult(toolResult)}`;
    }
  }

  /**
   * Format email preview showing recipients, subject, content
   */
  private formatEmailPreview(data: any): string {
    let preview = `📧 Email Details:\n`;
    if (data.recipients) {
      preview += `  To: ${Array.isArray(data.recipients) ? data.recipients.join(', ') : data.recipients}\n`;
    }
    if (data.subject) {
      preview += `  Subject: ${data.subject}\n`;
    }
    if (data.body) {
      const bodyPreview = data.body.length > 100 ? data.body.substring(0, 100) + '...' : data.body;
      preview += `  Message: ${bodyPreview}\n`;
    }
    return preview;
  }

  /**
   * Format calendar preview showing event details
   */
  private formatCalendarPreview(data: any): string {
    let preview = `📅 Calendar Event:\n`;
    if (data.title || data.summary) {
      preview += `  Title: ${data.title || data.summary}\n`;
    }
    if (data.startTime || data.start) {
      preview += `  Start: ${data.startTime || data.start}\n`;
    }
    if (data.endTime || data.end) {
      preview += `  End: ${data.endTime || data.end}\n`;
    }
    if (data.attendees && data.attendees.length > 0) {
      preview += `  Attendees: ${data.attendees.join(', ')}\n`;
    }
    if (data.location) {
      preview += `  Location: ${data.location}\n`;
    }
    return preview;
  }

  /**
   * Format tool result for display
   */
  private formatToolResult(toolResult: ToolResult): string {
    const toolName = this.getToolDisplayName(toolResult.toolName);
    const status = toolResult.success ? '✅' : '❌';
    return `${status} ${toolName}`;
  }

  /**
   * Get tool display name
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      'send_email': 'Send Email',
      'create_calendar_event': 'Create Calendar Event',
      'search_contacts': 'Search Contacts',
      'read_slack_messages': 'Read Slack Messages'
    };
    return displayNames[toolName] || toolName;
  }

  /**
   * Get action description
   */
  private getActionDescription(actionType: string): string {
    const descriptions: Record<string, string> = {
      'email_send': 'Send Email',
      'calendar_create': 'Create Calendar Event',
      'contact_search': 'Search Contacts',
      'slack_read': 'Read Slack Messages'
    };
    return descriptions[actionType] || 'Perform Action';
  }

  /**
   * Extract action type from proposal text using AI
   */
  private async extractActionType(proposalText: string): Promise<string> {
    try {
      if (!this.aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI action type extraction is required for this operation.');
      }

      // Get OpenAI service through service manager
      const serviceManager = ServiceManager.getInstance();
      const openaiService = serviceManager.getService('openaiService') as any;
      if (!openaiService) {
        throw new Error('OpenAI service is not available');
      }
      
      const response = await openaiService.generateText(
        `Extract the action type from this proposal text: "${proposalText}"
        
        Return exactly one of: email_send, calendar_create, contact_search, slack_read, unknown
        
        Examples:
        - "Send email to John" → email_send
        - "Create calendar event" → calendar_create
        - "Search for contact" → contact_search
        - "Read Slack messages" → slack_read
        - "Unknown action" → unknown`,
        'Extract action type from proposal text',
        { temperature: 0, maxTokens: 20 }
      );

      const result = response?.trim();
      const validActions = ['email_send', 'calendar_create', 'contact_search', 'slack_read', 'unknown'];
      
      if (result && validActions.includes(result)) {
        return result;
      }
      
      return 'unknown';
    } catch (error) {
      this.logError('Failed to extract action type with AI', error);
      return 'unknown';
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(proposalText: string): number {
    // Simple confidence calculation based on text clarity
    const clearIndicators = ['send email', 'create event', 'search contact'];
    const hasClearIndicator = clearIndicators.some(indicator => 
      proposalText.toLowerCase().includes(indicator)
    );
    return hasClearIndicator ? 0.8 : 0.5;
  }

  /**
   * Determine if confirmation is required
   */
  private determineConfirmationRequirement(actionType: string, confidence: number): boolean {
    // Require confirmation for high-risk actions or low confidence
    const highRiskActions = ['email_send', 'calendar_create'];
    return highRiskActions.includes(actionType) || confidence < 0.7;
  }

  /**
   * Generate confirmation ID
   */
  private generateConfirmationId(request: SlackConfirmationRequest): string {
    return `${request.sessionId}-${Date.now()}`;
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    try {
      const serviceManager = ServiceManager.getInstance();
      this.aiClassificationService = serviceManager.getService('aiClassificationService') as AIClassificationService;
      this.toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    } catch (error) {
      this.logWarn('Some dependencies not available during initialization', error);
    }
  }

  /**
   * Start cleanup interval for expired confirmations
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredConfirmations();
    }, 60000); // Clean up every minute
  }

  /**
   * Cleanup expired confirmations
   */
  private cleanupExpiredConfirmations(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [confirmationId, action] of this.pendingActions.entries()) {
      if (now > action.expiresAt) {
        this.pendingActions.delete(confirmationId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logDebug(`Cleaned up ${cleanedCount} expired confirmations`);
    }
  }

  /**
   * Get confirmation handler statistics
   */
  getConfirmationStats(): {
    pendingConfirmationsCount: number;
    config: SlackConfirmationHandlerConfig;
    hasAIClassification: boolean;
    hasToolExecutor: boolean;
  } {
    return {
      pendingConfirmationsCount: this.pendingActions.size,
      config: this.config,
      hasAIClassification: !!this.aiClassificationService,
      hasToolExecutor: !!this.toolExecutorService
    };
  }
}
