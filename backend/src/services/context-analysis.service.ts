import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { WorkflowCacheService, WorkflowState } from './workflow-cache.service';
import { getService } from './service-manager';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

/**
 * Context analysis result for workflow interruption handling
 */
export interface ContextAnalysis {
  userIntent: string;
  intentType: 'continuation' | 'interruption' | 'clarification' | 'correction' | 'new_request' | 'workflow_control';
  confidence: number;
  workflowImpact: WorkflowImpact;
  suggestedAction: SuggestedAction;
  contextualResponse: string;
  extractedEntities: string[];
  urgency: 'low' | 'medium' | 'high' | 'immediate';
}

/**
 * Workflow impact analysis
 */
export interface WorkflowImpact {
  type: 'none' | 'pause' | 'modify' | 'abort' | 'branch' | 'priority_change';
  severity: 'minimal' | 'moderate' | 'significant' | 'critical';
  affectedSteps: number[];
  reasoning: string;
  preserveState: boolean;
}

/**
 * Suggested action for context handling
 */
export interface SuggestedAction {
  action: 'continue' | 'pause_and_address' | 'abort_and_restart' | 'branch_workflow' | 'seek_clarification' | 'merge_requests';
  reasoning: string;
  parameters: {
    pauseMessage?: string;
    clarificationQuestions?: string[];
    newWorkflowPlan?: any[];
    branchingStrategy?: string;
    mergeStrategy?: string;
  };
  estimatedTime: number; // seconds
  successProbability: number; // 0-1
}

/**
 * Workflow interruption types
 */
export type InterruptionType =
  | 'user_correction'
  | 'user_clarification'
  | 'new_priority_request'
  | 'workflow_cancellation'
  | 'context_change'
  | 'external_event'
  | 'system_notification';

/**
 * Context change detection
 */
export interface ContextChangeDetection {
  hasChanged: boolean;
  changeType: 'user_input' | 'environmental' | 'temporal' | 'data_update' | 'system_state';
  significance: 'trivial' | 'minor' | 'major' | 'critical';
  description: string;
  impact: string;
}

/**
 * ContextAnalysisService - Intelligent conversation flow and interruption handling
 *
 * Provides sophisticated context analysis to handle user interruptions, workflow
 * modifications, and conversational flow management with high intelligence.
 */
export class ContextAnalysisService extends BaseService {
  private openaiService: OpenAIService | null = null;
  private workflowCacheService: WorkflowCacheService | null = null;

  // Context analysis parameters
  private readonly INTERRUPTION_DETECTION_THRESHOLD = 0.7;
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.8;
  private readonly CONTEXT_MEMORY_WINDOW = 10; // messages

  constructor() {
    super('contextAnalysisService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      this.openaiService = getService<OpenAIService>('openaiService') || null;
      this.workflowCacheService = getService<WorkflowCacheService>('workflowCacheService') || null;

      if (!this.openaiService) {
        throw new Error('OpenAIService is required but not available');
      }

      if (!this.workflowCacheService) {
        throw new Error('WorkflowCacheService is required but not available');
      }

      EnhancedLogger.debug('ContextAnalysisService initialized', {
        correlationId: `context-analysis-init-${Date.now()}`,
        operation: 'context_analysis_init',
        metadata: {
          service: 'contextAnalysisService',
          hasOpenAIService: !!this.openaiService,
          hasWorkflowCacheService: !!this.workflowCacheService,
          interruptionThreshold: this.INTERRUPTION_DETECTION_THRESHOLD
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to initialize ContextAnalysisService', error as Error, {
        correlationId: `context-analysis-init-error-${Date.now()}`,
        operation: 'context_analysis_init_error',
        metadata: { service: 'contextAnalysisService' }
      });
      throw error;
    }
  }

  /**
   * Analyze user input in the context of an active workflow
   */
  async analyzeUserIntent(
    userInput: string,
    sessionId: string,
    conversationHistory?: Array<{ role: string; content: string; timestamp: Date }>
  ): Promise<ContextAnalysis> {
    const correlationId = `analyze-user-intent-${sessionId}`;
    const logContext: LogContext = {
      correlationId,
      operation: 'analyze_user_intent',
      metadata: { sessionId, inputLength: userInput.length }
    };

    try {
      EnhancedLogger.debug('Analyzing user intent with context', logContext);

      if (!this.openaiService || !this.workflowCacheService) {
        throw new Error('Required services not available');
      }

      // Get active workflows for context
      const activeWorkflows = await this.workflowCacheService.getActiveWorkflows(sessionId);
      const currentWorkflow = activeWorkflows.length > 0 ? activeWorkflows[0] : null;

      // Prepare conversation context
      const recentHistory = conversationHistory?.slice(-this.CONTEXT_MEMORY_WINDOW) || [];

      const analysisPrompt = this.createIntentAnalysisPrompt(
        userInput,
        currentWorkflow || null,
        recentHistory
      );

      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are an expert conversation analyst. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 2000 }
      );

      const rawAnalysis = JSON.parse(response);
      const analysis = this.validateAndEnhanceAnalysis(rawAnalysis, currentWorkflow || null);

      EnhancedLogger.debug('User intent analysis completed', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          intentType: analysis.intentType,
          confidence: analysis.confidence,
          workflowImpact: analysis.workflowImpact.type,
          urgency: analysis.urgency
        }
      });

      return analysis;
    } catch (error) {
      EnhancedLogger.error('Failed to analyze user intent', error as Error, logContext);

      // Return fallback analysis
      return this.createFallbackAnalysis(userInput);
    }
  }

  /**
   * Handle workflow interruption intelligently
   */
  async handleInterruption(
    userInput: string,
    sessionId: string,
    interruptionType: InterruptionType,
    workflowId?: string
  ): Promise<ContextAnalysis> {
    const correlationId = `handle-interruption-${sessionId}`;
    const logContext: LogContext = {
      correlationId,
      operation: 'handle_interruption',
      metadata: { sessionId, interruptionType, workflowId }
    };

    try {
      EnhancedLogger.debug('Handling workflow interruption', logContext);

      if (!this.workflowCacheService || !this.openaiService) {
        throw new Error('Required services not available');
      }

      let workflow: WorkflowState | null = null;
      if (workflowId) {
        workflow = await this.workflowCacheService.getWorkflow(workflowId) || null;
      } else {
        const activeWorkflows = await this.workflowCacheService.getActiveWorkflows(sessionId);
        workflow = activeWorkflows.length > 0 ? activeWorkflows[0] || null : null;
      }

      const interruptionPrompt = this.createInterruptionAnalysisPrompt(
        userInput,
        interruptionType,
        workflow || null
      );

      const response = await this.openaiService.generateText(
        interruptionPrompt,
        'You are an expert interruption handler. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1500 }
      );

      const rawAnalysis = JSON.parse(response);
      const analysis = this.validateAndEnhanceAnalysis(rawAnalysis, workflow);

      // Apply any immediate workflow changes if needed
      if (workflow && analysis.workflowImpact.type !== 'none') {
        await this.applyWorkflowImpact(workflow, analysis.workflowImpact);
      }

      EnhancedLogger.debug('Interruption handled successfully', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          suggestedAction: analysis.suggestedAction.action,
          workflowImpact: analysis.workflowImpact.type
        }
      });

      return analysis;
    } catch (error) {
      EnhancedLogger.error('Failed to handle interruption', error as Error, logContext);
      return this.createFallbackAnalysis(userInput, 'interruption');
    }
  }

  /**
   * Detect context changes in the conversation
   */
  async detectContextChange(
    newInput: string,
    previousContext: string,
    workflow?: WorkflowState
  ): Promise<ContextChangeDetection> {
    try {
      if (!this.openaiService) {
        return {
          hasChanged: false,
          changeType: 'user_input',
          significance: 'trivial',
          description: 'Unable to analyze context change',
          impact: 'No impact detected'
        };
      }

      const changeDetectionPrompt = `
You are an expert context change detector. Compare the new user input with the previous context.

PREVIOUS CONTEXT: "${previousContext}"
NEW INPUT: "${newInput}"
ACTIVE WORKFLOW: ${workflow ? workflow.context.originalRequest : 'None'}

ANALYSIS TASK:
Detect if there's a significant context change that would affect the conversation flow.

RESPONSE FORMAT (JSON only):
{
  "hasChanged": true/false,
  "changeType": "user_input|environmental|temporal|data_update|system_state",
  "significance": "trivial|minor|major|critical",
  "description": "Brief description of the context change",
  "impact": "How this change affects the current workflow or conversation"
}

GUIDELINES:
- Trivial: Minor rewording, same intent
- Minor: Slight topic shift, manageable
- Major: Significant direction change, needs attention
- Critical: Complete context switch, requires immediate action
`;

      const response = await this.openaiService.generateText(
        changeDetectionPrompt,
        'You are a context change detector. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 500 }
      );

      const result = JSON.parse(response);
      return {
        hasChanged: result.hasChanged || false,
        changeType: result.changeType || 'user_input',
        significance: result.significance || 'trivial',
        description: result.description || 'Context analysis completed',
        impact: result.impact || 'No significant impact'
      };
    } catch (error) {
      EnhancedLogger.error('Failed to detect context change', error as Error, {
        correlationId: `context-change-error-${Date.now()}`,
        operation: 'detect_context_change'
      });

      return {
        hasChanged: false,
        changeType: 'user_input',
        significance: 'trivial',
        description: 'Error in context analysis',
        impact: 'Unable to determine impact'
      };
    }
  }

  /**
   * Generate contextual response based on analysis
   */
  async generateContextualResponse(
    userInput: string,
    analysis: ContextAnalysis,
    workflow?: WorkflowState
  ): Promise<string> {
    try {
      if (!this.openaiService) {
        return this.createFallbackResponse(analysis);
      }

      const responsePrompt = `
You are an AI assistant generating a contextual response based on analysis results.

USER INPUT: "${userInput}"
INTENT TYPE: ${analysis.intentType}
WORKFLOW IMPACT: ${analysis.workflowImpact.type}
SUGGESTED ACTION: ${analysis.suggestedAction.action}
URGENCY: ${analysis.urgency}

CURRENT WORKFLOW: ${workflow ? workflow.context.originalRequest : 'None active'}

RESPONSE TASK:
Generate a natural, helpful response that:
1. Acknowledges the user's input appropriately
2. Explains what you understand about their intent
3. Describes what action you'll take
4. Sets clear expectations for next steps

GUIDELINES:
- Be conversational and helpful
- Show understanding of the context
- Be clear about workflow changes if any
- Maintain professional but friendly tone
- Keep response concise but informative
`;

      const response = await this.openaiService.generateText(
        responsePrompt,
        'Generate helpful contextual responses.',
        { temperature: 0.7, maxTokens: 300 }
      );

      return response.trim();
    } catch (error) {
      EnhancedLogger.error('Failed to generate contextual response', error as Error, {
        correlationId: `contextual-response-error-${Date.now()}`,
        operation: 'generate_contextual_response'
      });

      return this.createFallbackResponse(analysis);
    }
  }

  /**
   * Create intent analysis prompt for LLM
   */
  private createIntentAnalysisPrompt(
    userInput: string,
    workflow: WorkflowState | null,
    history: Array<{ role: string; content: string; timestamp: Date }>
  ): string {
    return `
You are an expert conversation analyst specializing in workflow interruption detection and intent analysis.

USER INPUT: "${userInput}"

ACTIVE WORKFLOW: ${workflow ? `
- Request: "${workflow.context.originalRequest}"
- Progress: ${workflow.currentStep}/${workflow.totalSteps}
- Status: ${workflow.status}
- Current Step: ${workflow.pendingStep?.description || 'None'}
` : 'None active'}

CONVERSATION HISTORY:
${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

ANALYSIS TASK:
Analyze the user's intent and determine how it relates to any active workflow.

RESPONSE FORMAT (JSON only):
{
  "userIntent": "Clear description of what the user wants",
  "intentType": "continuation|interruption|clarification|correction|new_request|workflow_control",
  "confidence": 0.95,
  "workflowImpact": {
    "type": "none|pause|modify|abort|branch|priority_change",
    "severity": "minimal|moderate|significant|critical",
    "affectedSteps": [2, 3],
    "reasoning": "Why this impacts the workflow",
    "preserveState": true
  },
  "suggestedAction": {
    "action": "continue|pause_and_address|abort_and_restart|branch_workflow|seek_clarification|merge_requests",
    "reasoning": "Why this action is recommended",
    "parameters": {
      "pauseMessage": "Appropriate message for pausing current workflow",
      "clarificationQuestions": ["Relevant clarifying questions"]
    },
    "estimatedTime": 30,
    "successProbability": 0.9
  },
  "contextualResponse": "Natural response acknowledging user intent",
  "extractedEntities": ["relevant", "entities", "from", "request"],
  "urgency": "low|medium|high|immediate"
}

INTENT TYPE DEFINITIONS:
- continuation: User wants to continue/proceed with current workflow
- interruption: User wants to change direction or add new request
- clarification: User is asking for explanation or details
- correction: User is correcting previous information
- new_request: User has a completely new request
- workflow_control: User wants to pause/stop/modify current workflow

GUIDELINES:
- High confidence for clear intent patterns
- Consider conversation flow and context
- Prioritize user experience and workflow efficiency
- Be conservative with critical workflow changes
- Focus on preserving user intent and progress
`;
  }

  /**
   * Create interruption analysis prompt
   */
  private createInterruptionAnalysisPrompt(
    userInput: string,
    interruptionType: InterruptionType,
    workflow: WorkflowState | null
  ): string {
    return `
You are an expert interruption handler for AI workflow systems.

USER INPUT: "${userInput}"
INTERRUPTION TYPE: ${interruptionType}

CURRENT WORKFLOW: ${workflow ? `
- Request: "${workflow.context.originalRequest}"
- Progress: ${workflow.currentStep}/${workflow.totalSteps}
- Status: ${workflow.status}
` : 'None active'}

ANALYSIS TASK:
Determine the best way to handle this interruption while preserving user experience.

RESPONSE FORMAT (JSON only):
{
  "userIntent": "What the user wants to accomplish",
  "intentType": "interruption",
  "confidence": 0.9,
  "workflowImpact": {
    "type": "pause|modify|abort|branch",
    "severity": "moderate",
    "affectedSteps": [],
    "reasoning": "Explanation of impact",
    "preserveState": true
  },
  "suggestedAction": {
    "action": "pause_and_address|abort_and_restart|branch_workflow",
    "reasoning": "Why this approach is best",
    "parameters": {},
    "estimatedTime": 45,
    "successProbability": 0.85
  },
  "contextualResponse": "Natural response to the user",
  "extractedEntities": [],
  "urgency": "medium"
}

GUIDELINES:
- Prioritize user satisfaction over workflow completion
- Preserve workflow state when possible
- Be responsive to user urgency
- Provide clear communication about next steps
`;
  }

  /**
   * Validate and enhance analysis results
   */
  private validateAndEnhanceAnalysis(
    rawAnalysis: any,
    workflow: WorkflowState | null
  ): ContextAnalysis {
    return {
      userIntent: rawAnalysis.userIntent || 'User intent unclear',
      intentType: this.validateIntentType(rawAnalysis.intentType),
      confidence: Math.max(0, Math.min(1, rawAnalysis.confidence || 0.5)),
      workflowImpact: {
        type: this.validateWorkflowImpactType(rawAnalysis.workflowImpact?.type),
        severity: this.validateSeverity(rawAnalysis.workflowImpact?.severity),
        affectedSteps: Array.isArray(rawAnalysis.workflowImpact?.affectedSteps) ?
          rawAnalysis.workflowImpact.affectedSteps : [],
        reasoning: rawAnalysis.workflowImpact?.reasoning || 'No specific impact identified',
        preserveState: rawAnalysis.workflowImpact?.preserveState !== false
      },
      suggestedAction: {
        action: this.validateSuggestedAction(rawAnalysis.suggestedAction?.action),
        reasoning: rawAnalysis.suggestedAction?.reasoning || 'Default action recommendation',
        parameters: rawAnalysis.suggestedAction?.parameters || {},
        estimatedTime: Math.max(0, rawAnalysis.suggestedAction?.estimatedTime || 30),
        successProbability: Math.max(0, Math.min(1, rawAnalysis.suggestedAction?.successProbability || 0.8))
      },
      contextualResponse: rawAnalysis.contextualResponse || 'I understand your request.',
      extractedEntities: Array.isArray(rawAnalysis.extractedEntities) ? rawAnalysis.extractedEntities : [],
      urgency: this.validateUrgency(rawAnalysis.urgency)
    };
  }

  /**
   * Apply workflow impact changes
   */
  private async applyWorkflowImpact(
    workflow: WorkflowState,
    impact: WorkflowImpact
  ): Promise<void> {
    if (!this.workflowCacheService) return;

    try {
      switch (impact.type) {
        case 'pause':
          await this.workflowCacheService.updateWorkflow(workflow.workflowId, {
            status: 'paused',
            lastActivity: new Date()
          });
          break;

        case 'abort':
          await this.workflowCacheService.cancelWorkflow(workflow.workflowId);
          break;

        case 'modify':
          // Mark affected steps for modification
          impact.affectedSteps.forEach(stepNumber => {
            const step = workflow.plan.find(s => s.stepNumber === stepNumber);
            if (step) {
              step.status = 'pending'; // Reset to pending for modification
            }
          });
          await this.workflowCacheService.updateWorkflow(workflow.workflowId, workflow);
          break;
      }
    } catch (error) {
      EnhancedLogger.error('Failed to apply workflow impact', error as Error, {
        correlationId: `apply-impact-error-${Date.now()}`,
        operation: 'apply_workflow_impact',
        metadata: { workflowId: workflow.workflowId, impactType: impact.type }
      });
    }
  }

  /**
   * Create fallback analysis when LLM fails
   */
  private createFallbackAnalysis(userInput: string, type: string = 'general'): ContextAnalysis {
    return {
      userIntent: `User provided input: ${userInput.substring(0, 100)}`,
      intentType: type === 'interruption' ? 'interruption' : 'new_request',
      confidence: 0.3,
      workflowImpact: {
        type: 'none',
        severity: 'minimal',
        affectedSteps: [],
        reasoning: 'Fallback analysis - no specific impact detected',
        preserveState: true
      },
      suggestedAction: {
        action: 'continue',
        reasoning: 'Default action due to analysis failure',
        parameters: {},
        estimatedTime: 10,
        successProbability: 0.5
      },
      contextualResponse: 'I understand you have a request. Let me help you with that.',
      extractedEntities: [],
      urgency: 'medium'
    };
  }

  /**
   * Create fallback response
   */
  private createFallbackResponse(analysis: ContextAnalysis): string {
    switch (analysis.intentType) {
      case 'interruption':
        return 'I understand you want to change direction. Let me help you with that.';
      case 'clarification':
        return 'Let me clarify that for you.';
      case 'correction':
        return 'Thank you for the correction. I\'ll update accordingly.';
      case 'new_request':
        return 'I see you have a new request. I\'ll help you with that.';
      default:
        return 'I understand. Let me assist you with that.';
    }
  }

  // Validation helper methods
  private validateIntentType(type: any): ContextAnalysis['intentType'] {
    const validTypes = ['continuation', 'interruption', 'clarification', 'correction', 'new_request', 'workflow_control'];
    return validTypes.includes(type) ? type : 'new_request';
  }

  private validateWorkflowImpactType(type: any): WorkflowImpact['type'] {
    const validTypes = ['none', 'pause', 'modify', 'abort', 'branch', 'priority_change'];
    return validTypes.includes(type) ? type : 'none';
  }

  private validateSeverity(severity: any): WorkflowImpact['severity'] {
    const validSeverities = ['minimal', 'moderate', 'significant', 'critical'];
    return validSeverities.includes(severity) ? severity : 'minimal';
  }

  private validateSuggestedAction(action: any): SuggestedAction['action'] {
    const validActions = ['continue', 'pause_and_address', 'abort_and_restart', 'branch_workflow', 'seek_clarification', 'merge_requests'];
    return validActions.includes(action) ? action : 'continue';
  }

  private validateUrgency(urgency: any): ContextAnalysis['urgency'] {
    const validUrgencies = ['low', 'medium', 'high', 'immediate'];
    return validUrgencies.includes(urgency) ? urgency : 'medium';
  }

  /**
   * Cleanup resources
   */
  protected async onDestroy(): Promise<void> {
    EnhancedLogger.debug('ContextAnalysisService destroyed', {
      correlationId: `context-analysis-destroy-${Date.now()}`,
      operation: 'context_analysis_destroy',
      metadata: { service: 'contextAnalysisService' }
    });
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.openaiService && !!this.workflowCacheService,
      details: {
        service: 'contextAnalysisService',
        hasOpenAIService: !!this.openaiService,
        hasWorkflowCacheService: !!this.workflowCacheService,
        interruptionThreshold: this.INTERRUPTION_DETECTION_THRESHOLD,
        confidenceThreshold: this.HIGH_CONFIDENCE_THRESHOLD
      }
    };
  }
}