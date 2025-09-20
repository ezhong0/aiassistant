import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { WorkflowCacheService, WorkflowState, WorkflowStep } from './workflow-cache.service';
import { getService } from './service-manager';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

/**
 * Plan modification types for workflow adaptation
 */
export type PlanModificationType =
  | 'add_step'
  | 'remove_step'
  | 'modify_step'
  | 'reorder_steps'
  | 'skip_step'
  | 'replace_plan'
  | 'merge_steps'
  | 'split_step';

/**
 * Plan modification interface for dynamic workflow adaptation
 */
export interface PlanModification {
  type: PlanModificationType;
  reasoning: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  changes: {
    stepNumber?: number;
    newSteps?: WorkflowStep[];
    stepsToRemove?: number[];
    newOrder?: number[];
    modifications?: Partial<WorkflowStep>;
    replacementPlan?: WorkflowStep[];
    mergePairs?: Array<{ step1: number; step2: number }>;
    splitDetails?: {
      originalStep: number;
      newSteps: WorkflowStep[];
    };
  };
  estimatedImpact: {
    timeChange: number; // in seconds
    successProbability: number; // 0-1
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * Plan analysis context for LLM decision making
 */
export interface PlanAnalysisContext {
  originalRequest: string;
  currentStep: number;
  totalSteps: number;
  stepResults: Array<{
    stepNumber: number;
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
  }>;
  remainingSteps: WorkflowStep[];
  userFeedback?: string;
  contextualInfo?: Record<string, any>;
}

/**
 * PlanModificationService - Advanced dynamic plan adaptation with LLM intelligence
 *
 * Provides sophisticated plan modification capabilities using AI to analyze
 * workflow execution results and determine optimal plan adaptations.
 */
export class PlanModificationService extends BaseService {
  private openaiService: OpenAIService | null = null;
  private workflowCacheService: WorkflowCacheService | null = null;

  constructor() {
    super('planModificationService');
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

      EnhancedLogger.debug('PlanModificationService initialized', {
        correlationId: `plan-modification-init-${Date.now()}`,
        operation: 'plan_modification_init',
        metadata: {
          service: 'planModificationService',
          hasOpenAIService: !!this.openaiService,
          hasWorkflowCacheService: !!this.workflowCacheService
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to initialize PlanModificationService', error as Error, {
        correlationId: `plan-modification-init-error-${Date.now()}`,
        operation: 'plan_modification_init_error',
        metadata: { service: 'planModificationService' }
      });
      throw error;
    }
  }

  /**
   * Analyze workflow execution and suggest plan modifications
   */
  async analyzePlan(
    workflowId: string,
    context: PlanAnalysisContext
  ): Promise<PlanModification[]> {
    const correlationId = `analyze-plan-${workflowId}`;
    const logContext: LogContext = {
      correlationId,
      operation: 'analyze_plan',
      metadata: { workflowId, currentStep: context.currentStep }
    };

    try {
      EnhancedLogger.debug('Analyzing plan for modifications', logContext);

      if (!this.openaiService) {
        throw new Error('OpenAIService not available');
      }

      const analysisPrompt = this.createAnalysisPrompt(context);

      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are an AI workflow optimizer. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 2000 }
      );

      const analysisResult = JSON.parse(response);
      const modifications = this.validateAndEnhanceModifications(analysisResult.modifications || []);

      EnhancedLogger.debug('Plan analysis completed', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          modificationsCount: modifications.length,
          highPriorityMods: modifications.filter(m => m.priority === 'high' || m.priority === 'critical').length
        }
      });

      return modifications;
    } catch (error) {
      EnhancedLogger.error('Failed to analyze plan', error as Error, logContext);
      return [];
    }
  }

  /**
   * Apply plan modification to workflow
   */
  async applyModification(
    workflowId: string,
    modification: PlanModification
  ): Promise<boolean> {
    const correlationId = `apply-modification-${workflowId}`;
    const logContext: LogContext = {
      correlationId,
      operation: 'apply_modification',
      metadata: { workflowId, modificationType: modification.type }
    };

    try {
      EnhancedLogger.debug('Applying plan modification', logContext);

      if (!this.workflowCacheService) {
        throw new Error('WorkflowCacheService not available');
      }

      const workflow = await this.workflowCacheService.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const success = await this.executeModification(workflow, modification);

      if (success) {
        await this.workflowCacheService.updateWorkflow(workflowId, workflow);

        EnhancedLogger.debug('Plan modification applied successfully', {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            reasoning: modification.reasoning,
            confidence: modification.confidence
          }
        });
      }

      return success;
    } catch (error) {
      EnhancedLogger.error('Failed to apply plan modification', error as Error, logContext);
      return false;
    }
  }

  /**
   * Get modification recommendations based on step failure
   */
  async getFailureRecoveryModifications(
    workflowId: string,
    failedStepNumber: number,
    error: Error,
    retryCount: number
  ): Promise<PlanModification[]> {
    try {
      if (!this.openaiService || !this.workflowCacheService) {
        return [];
      }

      const workflow = await this.workflowCacheService.getWorkflow(workflowId);
      if (!workflow) {
        return [];
      }

      const failedStep = workflow.plan.find(s => s.stepNumber === failedStepNumber);
      if (!failedStep) {
        return [];
      }

      const recoveryPrompt = `
You are an AI workflow recovery expert. Analyze a failed workflow step and suggest recovery modifications.

WORKFLOW CONTEXT:
- Original Request: "${workflow.context.originalRequest}"
- Failed Step: ${failedStepNumber}/${workflow.totalSteps}
- Step Description: "${failedStep.description}"
- Tool: ${failedStep.toolCall.name}
- Error: "${error.message}"
- Retry Count: ${retryCount}/${failedStep.maxRetries}

RECOVERY ANALYSIS:
Generate 1-3 recovery modifications prioritized by success probability.

RESPONSE FORMAT (JSON only):
{
  "modifications": [
    {
      "type": "add_step|modify_step|skip_step|replace_plan",
      "reasoning": "Why this modification will help recover",
      "confidence": 0.85,
      "priority": "high",
      "changes": {
        "newSteps": [...]
      },
      "estimatedImpact": {
        "timeChange": 30,
        "successProbability": 0.8,
        "riskLevel": "low"
      }
    }
  ]
}

GUIDELINES:
- If retry count is low: suggest parameter modifications
- If tool is failing: suggest alternative approaches
- If step is optional: suggest skipping with explanation
- If critical failure: suggest plan replacement
- Always prioritize workflow continuation over perfection
`;

      const response = await this.openaiService.generateText(
        recoveryPrompt,
        'You are a workflow recovery expert. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1000 }
      );

      const result = JSON.parse(response);
      return this.validateAndEnhanceModifications(result.modifications || []);
    } catch (error) {
      EnhancedLogger.error('Failed to get failure recovery modifications', error as Error, {
        correlationId: `failure-recovery-${workflowId}`,
        operation: 'failure_recovery_modifications',
        metadata: { workflowId, failedStepNumber }
      });
      return [];
    }
  }

  /**
   * Optimize plan for efficiency and success probability
   */
  async optimizePlan(workflowId: string): Promise<PlanModification[]> {
    try {
      if (!this.workflowCacheService || !this.openaiService) {
        return [];
      }

      const workflow = await this.workflowCacheService.getWorkflow(workflowId);
      if (!workflow) {
        return [];
      }

      const optimizationPrompt = `
You are an AI workflow optimizer. Analyze this workflow plan and suggest optimizations.

WORKFLOW:
- Request: "${workflow.context.originalRequest}"
- Total Steps: ${workflow.totalSteps}
- Current Step: ${workflow.currentStep}

PLAN:
${workflow.plan.map(step =>
  `${step.stepNumber}. ${step.description} (${step.toolCall.name})`
).join('\n')}

OPTIMIZATION GOALS:
1. Reduce total execution time
2. Increase success probability
3. Eliminate redundant steps
4. Improve step order efficiency
5. Merge compatible operations

RESPONSE FORMAT (JSON only):
{
  "modifications": [
    {
      "type": "merge_steps|reorder_steps|remove_step|modify_step",
      "reasoning": "Optimization benefit explanation",
      "confidence": 0.9,
      "priority": "medium",
      "changes": {},
      "estimatedImpact": {
        "timeChange": -45,
        "successProbability": 0.95,
        "riskLevel": "low"
      }
    }
  ]
}

GUIDELINES:
- Only suggest safe optimizations
- Preserve workflow correctness
- Focus on measurable improvements
- Consider step dependencies
`;

      const response = await this.openaiService.generateText(
        optimizationPrompt,
        'You are a workflow optimizer. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1500 }
      );

      const result = JSON.parse(response);
      return this.validateAndEnhanceModifications(result.modifications || []);
    } catch (error) {
      EnhancedLogger.error('Failed to optimize plan', error as Error, {
        correlationId: `optimize-plan-${workflowId}`,
        operation: 'optimize_plan',
        metadata: { workflowId }
      });
      return [];
    }
  }

  /**
   * Create analysis prompt for LLM
   */
  private createAnalysisPrompt(context: PlanAnalysisContext): string {
    return `
You are an AI workflow analyst with advanced pattern recognition. Analyze this workflow execution and suggest improvements.

WORKFLOW CONTEXT:
- Original Request: "${context.originalRequest}"
- Current Progress: ${context.currentStep}/${context.totalSteps}
- User Feedback: ${context.userFeedback || 'None'}

EXECUTION RESULTS:
${context.stepResults.map(result =>
  `Step ${result.stepNumber}: ${result.success ? '✅' : '❌'} (${result.executionTime}ms)${result.error ? ` - ${result.error}` : ''}`
).join('\n')}

REMAINING STEPS:
${context.remainingSteps.map(step =>
  `${step.stepNumber}. ${step.description} (${step.toolCall.name})`
).join('\n')}

CONTEXTUAL INFO:
${JSON.stringify(context.contextualInfo || {}, null, 2)}

ANALYSIS TASK:
Based on the execution results and remaining steps, suggest 0-3 plan modifications to:
1. Improve success probability
2. Reduce execution time
3. Handle discovered issues
4. Optimize based on actual results

RESPONSE FORMAT (JSON only):
{
  "modifications": [
    {
      "type": "add_step|remove_step|modify_step|reorder_steps|skip_step|replace_plan",
      "reasoning": "Clear explanation of why this modification improves the workflow",
      "confidence": 0.85,
      "priority": "low|medium|high|critical",
      "changes": {
        "stepNumber": 3,
        "newSteps": [
          {
            "stepId": "step_new",
            "stepNumber": 3,
            "description": "Enhanced step description",
            "toolCall": {
              "name": "agentName",
              "parameters": {}
            },
            "status": "pending",
            "retryCount": 0,
            "maxRetries": 3
          }
        ]
      },
      "estimatedImpact": {
        "timeChange": -30,
        "successProbability": 0.9,
        "riskLevel": "low"
      }
    }
  ]
}

GUIDELINES:
- Only suggest modifications with clear benefits
- Preserve workflow integrity and user intent
- Consider cumulative effects of multiple modifications
- Prioritize user experience and success over optimization
- Be conservative with high-risk modifications
`;
  }

  /**
   * Execute specific modification type
   */
  private async executeModification(
    workflow: WorkflowState,
    modification: PlanModification
  ): Promise<boolean> {
    try {
      switch (modification.type) {
        case 'add_step':
          return await this.addSteps(workflow, modification);

        case 'remove_step':
          return await this.removeSteps(workflow, modification);

        case 'modify_step':
          return await this.modifyStep(workflow, modification);

        case 'reorder_steps':
          return await this.reorderSteps(workflow, modification);

        case 'skip_step':
          return await this.skipStep(workflow, modification);

        case 'replace_plan':
          return await this.replacePlan(workflow, modification);

        case 'merge_steps':
          return await this.mergeSteps(workflow, modification);

        case 'split_step':
          return await this.splitStep(workflow, modification);

        default:
          EnhancedLogger.warn('Unknown modification type', {
            correlationId: `unknown-modification-${Date.now()}`,
            operation: 'execute_modification',
            metadata: { type: modification.type }
          });
          return false;
      }
    } catch (error) {
      EnhancedLogger.error('Failed to execute modification', error as Error, {
        correlationId: `execute-modification-error-${Date.now()}`,
        operation: 'execute_modification_error',
        metadata: { type: modification.type }
      });
      return false;
    }
  }

  /**
   * Add new steps to workflow plan
   */
  private async addSteps(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.newSteps) return false;

    const insertIndex = modification.changes.stepNumber || workflow.currentStep;
    modification.changes.newSteps.forEach((step, index) => {
      step.stepNumber = insertIndex + index + 1;
      workflow.plan.splice(insertIndex + index, 0, step);
    });

    // Renumber subsequent steps
    for (let i = insertIndex + modification.changes.newSteps.length; i < workflow.plan.length; i++) {
      const step = workflow.plan[i];
      if (step) {
        step.stepNumber = i + 1;
      }
    }

    workflow.totalSteps = workflow.plan.length;
    return true;
  }

  /**
   * Remove steps from workflow plan
   */
  private async removeSteps(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.stepsToRemove) return false;

    workflow.plan = workflow.plan.filter(step =>
      !modification.changes.stepsToRemove!.includes(step.stepNumber)
    );

    // Renumber remaining steps
    workflow.plan.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    workflow.totalSteps = workflow.plan.length;
    return true;
  }

  /**
   * Modify existing step
   */
  private async modifyStep(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.stepNumber || !modification.changes.modifications) return false;

    const step = workflow.plan.find(s => s.stepNumber === modification.changes.stepNumber);
    if (!step) return false;

    Object.assign(step, modification.changes.modifications);
    return true;
  }

  /**
   * Reorder workflow steps
   */
  private async reorderSteps(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.newOrder) return false;

    const reorderedPlan = modification.changes.newOrder.map(stepNumber =>
      workflow.plan.find(step => step.stepNumber === stepNumber)
    ).filter(Boolean) as WorkflowStep[];

    reorderedPlan.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    workflow.plan = reorderedPlan;
    workflow.totalSteps = reorderedPlan.length;
    return true;
  }

  /**
   * Skip workflow step
   */
  private async skipStep(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.stepNumber) return false;

    const step = workflow.plan.find(s => s.stepNumber === modification.changes.stepNumber);
    if (!step) return false;

    step.status = 'skipped';
    return true;
  }

  /**
   * Replace entire plan
   */
  private async replacePlan(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.replacementPlan) return false;

    workflow.plan = modification.changes.replacementPlan.map((step, index) => ({
      ...step,
      stepNumber: index + 1
    }));

    workflow.totalSteps = workflow.plan.length;
    return true;
  }

  /**
   * Merge compatible steps
   */
  private async mergeSteps(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.mergePairs) return false;

    // Implementation for merging steps - simplified for now
    // This would need more sophisticated logic to merge tool calls and parameters
    return true;
  }

  /**
   * Split complex step into multiple steps
   */
  private async splitStep(workflow: WorkflowState, modification: PlanModification): Promise<boolean> {
    if (!modification.changes.splitDetails) return false;

    const { originalStep, newSteps } = modification.changes.splitDetails;
    const stepIndex = workflow.plan.findIndex(s => s.stepNumber === originalStep);

    if (stepIndex === -1) return false;

    // Remove original step and insert new steps
    workflow.plan.splice(stepIndex, 1, ...newSteps);

    // Renumber all steps
    workflow.plan.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    workflow.totalSteps = workflow.plan.length;
    return true;
  }

  /**
   * Validate and enhance modifications
   */
  private validateAndEnhanceModifications(modifications: any[]): PlanModification[] {
    return modifications.map((mod: any) => ({
      type: mod.type || 'modify_step',
      reasoning: mod.reasoning || 'Plan modification',
      confidence: Math.max(0, Math.min(1, mod.confidence || 0.5)),
      priority: ['low', 'medium', 'high', 'critical'].includes(mod.priority) ? mod.priority : 'medium',
      changes: mod.changes || {},
      estimatedImpact: {
        timeChange: mod.estimatedImpact?.timeChange || 0,
        successProbability: Math.max(0, Math.min(1, mod.estimatedImpact?.successProbability || 0.5)),
        riskLevel: ['low', 'medium', 'high'].includes(mod.estimatedImpact?.riskLevel) ?
          mod.estimatedImpact.riskLevel : 'medium'
      }
    }));
  }

  /**
   * Cleanup resources
   */
  protected async onDestroy(): Promise<void> {
    EnhancedLogger.debug('PlanModificationService destroyed', {
      correlationId: `plan-modification-destroy-${Date.now()}`,
      operation: 'plan_modification_destroy',
      metadata: { service: 'planModificationService' }
    });
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.openaiService && !!this.workflowCacheService,
      details: {
        service: 'planModificationService',
        hasOpenAIService: !!this.openaiService,
        hasWorkflowCacheService: !!this.workflowCacheService
      }
    };
  }
}