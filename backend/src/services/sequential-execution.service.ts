import { BaseService } from './base-service';
import { ToolExecutorService } from './tool-executor.service';
import { WorkflowCacheService, WorkflowState, WorkflowStep } from './workflow-cache.service';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';
import { ToolCall, ToolResult } from '../types/tools';

/**
 * Step execution result interface
 */
export interface StepResult {
  stepNumber: number;
  success: boolean;
  result?: any;
  error?: string;
  needsConfirmation: boolean;
  naturalLanguageResponse: string;
  executionTime: number;
  suggestions?: string[];
}

/**
 * Workflow execution result interface
 */
export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  results: StepResult[];
  finalResponse: string;
  executionTime: number;
}

/**
 * Plan modification interface
 */
export interface PlanModification {
  type: 'add_step' | 'remove_step' | 'modify_step' | 'reorder_steps' | 'skip_step';
  reasoning: string;
  changes: {
    stepNumber?: number;
    newSteps?: WorkflowStep[];
    stepsToRemove?: number[];
    newOrder?: number[];
    modifications?: Partial<WorkflowStep>;
  };
}

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  action: 'retry' | 'skip' | 'modify' | 'abort';
  reasoning: string;
  modifications?: Partial<WorkflowStep>;
  retryDelay?: number;
}

/**
 * SequentialExecutionService - Core step-by-step execution engine with reevaluation
 *
 * Provides the "Cursor-like" intelligence for executing workflow plans sequentially,
 * with continuous reevaluation and dynamic plan modification based on results.
 */
export class SequentialExecutionService extends BaseService {
  private toolExecutorService: ToolExecutorService | null = null;
  private workflowCacheService: WorkflowCacheService | null = null;
  private openaiService: OpenAIService | null = null;

  constructor() {
    super('sequentialExecutionService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      this.toolExecutorService = getService<ToolExecutorService>('toolExecutorService') || null;
      this.workflowCacheService = getService<WorkflowCacheService>('workflowCacheService') || null;
      this.openaiService = getService<OpenAIService>('openaiService') || null;

      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService is required but not available');
      }

      if (!this.workflowCacheService) {
        throw new Error('WorkflowCacheService is required but not available');
      }

      if (!this.openaiService) {
        throw new Error('OpenAIService is required but not available');
      }

      EnhancedLogger.debug('SequentialExecutionService initialized', {
        correlationId: `sequential-execution-init-${Date.now()}`,
        operation: 'sequential_execution_init',
        metadata: {
          service: 'sequentialExecutionService',
          hasToolExecutorService: !!this.toolExecutorService,
          hasWorkflowCacheService: !!this.workflowCacheService,
          hasOpenAIService: !!this.openaiService
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to initialize SequentialExecutionService', error as Error, {
        correlationId: `sequential-execution-init-error-${Date.now()}`,
        operation: 'sequential_execution_init_error',
        metadata: { service: 'sequentialExecutionService' }
      });
      throw error;
    }
  }

  /**
   * Execute a single workflow step with reevaluation
   */
  async executeStep(workflowId: string, stepNumber: number): Promise<StepResult> {
    console.log(`⚡ STEP EXECUTION: Starting step ${stepNumber} execution...`);
    console.log('📊 Workflow ID:', workflowId);
    console.log('📊 Step Number:', stepNumber);
    
    const correlationId = `execute-step-${workflowId}-${stepNumber}`;
    const logContext: LogContext = {
      correlationId,
      operation: 'execute_step',
      metadata: { workflowId, stepNumber }
    };

    try {
      EnhancedLogger.debug('Executing workflow step', logContext);

      if (!this.workflowCacheService || !this.toolExecutorService || !this.openaiService) {
        throw new Error('Required services not available');
      }

      // Get workflow state
      console.log('🔍 STEP EXECUTION: Retrieving workflow state...');
      const workflow = await this.workflowCacheService.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      console.log('📋 STEP EXECUTION: Workflow state retrieved');

      // Get the step to execute
      const step = workflow.plan.find(s => s.stepNumber === stepNumber);
      if (!step) {
        throw new Error(`Step ${stepNumber} not found in workflow ${workflowId}`);
      }

      const startTime = Date.now();

      // Convert workflow step to tool call
      const toolCall: ToolCall = {
        name: step.toolCall.name,
        parameters: step.toolCall.parameters
      };

      // Execute the tool call
      const executionContext = {
        sessionId: workflow.sessionId,
        timestamp: new Date(),
        userId: workflow.userId,
        metadata: { workflowId, stepNumber }
      };

      console.log('🔧 STEP EXECUTION: Executing tool call...');
      console.log('📊 Tool Call:', JSON.stringify(toolCall, null, 2));
      const toolResult = await this.toolExecutorService.executeTools(
        [toolCall],
        executionContext,
        undefined, // No access token needed for internal workflow execution
        { preview: false } // Execute for real, not preview
      );
      console.log('✅ STEP EXECUTION: Tool execution completed');
      console.log('📊 Tool Result:', JSON.stringify(toolResult, null, 2));

      const executionTime = Date.now() - startTime;

      // Analyze the result and determine if plan needs modification
      console.log('🔄 REASSESSMENT: Starting plan reevaluation...');
      const planModification = await this.reevaluatePlan(workflow, step, toolResult);
      console.log('📊 REASSESSMENT: Plan modification result:', JSON.stringify(planModification, null, 2));

      // Generate natural language response
      console.log('💬 COMMUNICATION: Generating natural language response...');
      const naturalResponse = await this.generateNaturalLanguageResponse(
        step,
        toolResult,
        planModification
      );
      console.log('✅ COMMUNICATION: Natural language response generated');
      console.log('📊 Response:', naturalResponse);

      // Create step result
      const firstResult = toolResult.length > 0 ? toolResult[0] : null;
      const stepResult: StepResult = {
        stepNumber,
        success: firstResult?.success || false,
        result: firstResult?.result || null,
        error: firstResult?.error,
        needsConfirmation: false, // Tool results don't have needsConfirmation property
        naturalLanguageResponse: naturalResponse,
        executionTime,
        suggestions: planModification ? [planModification.reasoning] : undefined
      };

      // Update step status in workflow
      step.status = stepResult.success ? 'executed' : 'failed';
      step.result = stepResult.result;

      // Apply plan modifications if needed
      if (planModification && stepResult.success) {
        await this.applyPlanModification(workflow, planModification);
      }

      // Update workflow state
      workflow.completedSteps.push(step);
      workflow.currentStep = stepNumber + 1;
      workflow.pendingStep = workflow.plan.find(s => s.stepNumber === workflow.currentStep) || null;
      workflow.lastActivity = new Date();

      await this.workflowCacheService.updateWorkflow(workflowId, workflow);

      EnhancedLogger.debug('Workflow step executed successfully', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          success: stepResult.success,
          executionTime,
          needsConfirmation: stepResult.needsConfirmation,
          hasPlanModification: !!planModification
        }
      });

      return stepResult;
    } catch (error) {
      EnhancedLogger.error('Failed to execute workflow step', error as Error, logContext);

      // Return error result
      return {
        stepNumber,
        success: false,
        error: (error as Error).message,
        needsConfirmation: false,
        naturalLanguageResponse: `Step ${stepNumber} failed: ${(error as Error).message}`,
        executionTime: 0
      };
    }
  }

  /**
   * Execute an entire workflow sequentially
   */
  async executeWorkflow(workflowId: string): Promise<WorkflowResult> {
    console.log('⚡ EXECUTION: Starting workflow execution...');
    console.log('📊 Workflow ID:', workflowId);
    
    const correlationId = `execute-workflow-${workflowId}`;
    const logContext: LogContext = {
      correlationId,
      operation: 'execute_workflow',
      metadata: { workflowId }
    };

    try {
      EnhancedLogger.debug('Executing complete workflow', logContext);

      if (!this.workflowCacheService) {
        throw new Error('WorkflowCacheService not available');
      }

      console.log('🔍 EXECUTION: Retrieving workflow from cache...');
      const workflow = await this.workflowCacheService.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      console.log('📋 EXECUTION: Workflow retrieved:', JSON.stringify(workflow, null, 2));

      const startTime = Date.now();
      const results: StepResult[] = [];

      // Execute steps sequentially
      for (let stepNumber = 1; stepNumber <= workflow.totalSteps; stepNumber++) {
        const stepResult = await this.executeStep(workflowId, stepNumber);
        results.push(stepResult);

        // If step failed and can't be recovered, stop execution
        if (!stepResult.success) {
          const recoveryAction = await this.handleStepFailure(workflowId, stepNumber, new Error(stepResult.error || 'Step failed'));

          if (recoveryAction.action === 'abort') {
            break;
          } else if (recoveryAction.action === 'skip') {
            await this.skipFailedStep(workflowId, stepNumber);
            continue;
          }
        }
      }

      const executionTime = Date.now() - startTime;

      // Generate final response
      const finalResponse = await this.generateFinalResponse(workflow, results);

      // Mark workflow as completed
      await this.workflowCacheService.completeWorkflow(workflowId);

      const workflowResult: WorkflowResult = {
        workflowId,
        success: results.every(r => r.success),
        completedSteps: results.filter(r => r.success).length,
        totalSteps: workflow.totalSteps,
        results,
        finalResponse,
        executionTime
      };

      EnhancedLogger.debug('Workflow execution completed', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          success: workflowResult.success,
          completedSteps: workflowResult.completedSteps,
          totalSteps: workflowResult.totalSteps,
          executionTime
        }
      });

      return workflowResult;
    } catch (error) {
      EnhancedLogger.error('Failed to execute workflow', error as Error, logContext);
      throw error;
    }
  }

  /**
   * Reevaluate plan based on step results - the "Cursor-like" intelligence
   */
  async reevaluatePlan(workflow: WorkflowState, executedStep: WorkflowStep, toolResult: ToolResult[]): Promise<PlanModification | null> {
    try {
      if (!this.openaiService) {
        return null;
      }

      const analysisPrompt = `
You are an AI workflow analyzer with "Cursor-like" intelligence. Analyze the results of a workflow step and determine if the plan needs modification.

WORKFLOW CONTEXT:
- Original Request: "${workflow.context.originalRequest}"
- Current Step: ${executedStep.stepNumber}/${workflow.totalSteps}
- Step Description: "${executedStep.description}"
- Step Tool: ${executedStep.toolCall.name}

EXECUTED STEP RESULT:
${JSON.stringify(toolResult, null, 2)}

REMAINING STEPS:
${workflow.plan.slice(executedStep.stepNumber).map(step =>
  `${step.stepNumber}. ${step.description} (${step.toolCall.name})`
).join('\n')}

ANALYSIS TASK:
Based on the step result, determine if the workflow plan needs modification. Consider:
1. Did the step find what we were looking for?
2. Do we need additional steps based on the results?
3. Should we skip or modify upcoming steps?
4. Can we optimize the remaining execution?

RESPONSE FORMAT (JSON only):
{
  "needsModification": true/false,
  "modification": {
    "type": "add_step|remove_step|modify_step|skip_step|none",
    "reasoning": "Brief explanation of why this modification is needed",
    "changes": {
      "stepNumber": 3,
      "newSteps": [
        {
          "stepId": "step_new",
          "stepNumber": 3,
          "description": "New step description",
          "toolCall": {
            "name": "agentName",
            "parameters": {}
          },
          "status": "pending",
          "retryCount": 0,
          "maxRetries": 3
        }
      ]
    }
  }
}

GUIDELINES:
- If email search found results: Skip additional search steps
- If email search failed: Add step to search older emails or different keywords
- If contact resolution found contacts: Update upcoming steps with resolved emails
- If availability check shows conflicts: Add step to suggest alternative times
- Always provide clear reasoning for modifications
`;

      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are a workflow plan analyzer. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1000 }
      );

      const analysis = JSON.parse(response);

      if (analysis.needsModification && analysis.modification) {
        return analysis.modification as PlanModification;
      }

      return null;
    } catch (error) {
      EnhancedLogger.error('Failed to reevaluate plan', error as Error, {
        correlationId: `plan-reevaluation-error-${Date.now()}`,
        operation: 'plan_reevaluation_error',
        metadata: { workflowId: workflow.workflowId, stepNumber: executedStep.stepNumber }
      });
      return null;
    }
  }

  /**
   * Apply plan modification to workflow
   */
  private async applyPlanModification(workflow: WorkflowState, modification: PlanModification): Promise<void> {
    try {
      if (!this.workflowCacheService) {
        throw new Error('WorkflowCacheService not available');
      }

      switch (modification.type) {
        case 'add_step':
          if (modification.changes.newSteps) {
            await this.addStepsToPlan(workflow, modification.changes.newSteps);
          }
          break;

        case 'remove_step':
          if (modification.changes.stepsToRemove) {
            await this.removeStepsFromPlan(workflow, modification.changes.stepsToRemove);
          }
          break;

        case 'skip_step':
          if (modification.changes.stepNumber) {
            await this.skipFailedStep(workflow.workflowId, modification.changes.stepNumber);
          }
          break;

        case 'reorder_steps':
          if (modification.changes.newOrder) {
            await this.reorderSteps(workflow, modification.changes.newOrder);
          }
          break;
      }

      EnhancedLogger.debug('Plan modification applied', {
        correlationId: `plan-modification-${Date.now()}`,
        operation: 'plan_modification',
        metadata: {
          workflowId: workflow.workflowId,
          modificationType: modification.type,
          reasoning: modification.reasoning
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to apply plan modification', error as Error, {
        correlationId: `plan-modification-error-${Date.now()}`,
        operation: 'plan_modification_error',
        metadata: { workflowId: workflow.workflowId }
      });
      throw error;
    }
  }

  /**
   * Add steps to plan
   */
  async addStepsToPlan(workflow: WorkflowState, newSteps: WorkflowStep[]): Promise<void> {
    if (!this.workflowCacheService) {
      throw new Error('WorkflowCacheService not available');
    }

    // Add new steps at the current position
    const insertIndex = workflow.currentStep;
    newSteps.forEach((step, index) => {
      step.stepNumber = insertIndex + index + 1;
      workflow.plan.splice(insertIndex + index, 0, step);
    });

    // Renumber subsequent steps
    for (let i = insertIndex + newSteps.length; i < workflow.plan.length; i++) {
      const step = workflow.plan[i];
      if (step) {
        step.stepNumber = i + 1;
      }
    }

    workflow.totalSteps = workflow.plan.length;
    await this.workflowCacheService.updateWorkflow(workflow.workflowId, workflow);
  }

  /**
   * Remove steps from plan
   */
  async removeStepsFromPlan(workflow: WorkflowState, stepsToRemove: number[]): Promise<void> {
    if (!this.workflowCacheService) {
      throw new Error('WorkflowCacheService not available');
    }

    // Remove steps and renumber
    workflow.plan = workflow.plan.filter(step => !stepsToRemove.includes(step.stepNumber));
    workflow.plan.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    workflow.totalSteps = workflow.plan.length;
    await this.workflowCacheService.updateWorkflow(workflow.workflowId, workflow);
  }

  /**
   * Reorder workflow steps
   */
  async reorderSteps(workflow: WorkflowState, newOrder: number[]): Promise<void> {
    if (!this.workflowCacheService) {
      throw new Error('WorkflowCacheService not available');
    }

    const reorderedPlan = newOrder.map(stepNumber =>
      workflow.plan.find(step => step.stepNumber === stepNumber)
    ).filter(Boolean) as WorkflowStep[];

    // Renumber steps
    reorderedPlan.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    workflow.plan = reorderedPlan;
    workflow.totalSteps = reorderedPlan.length;
    await this.workflowCacheService.updateWorkflow(workflow.workflowId, workflow);
  }

  /**
   * Handle step failure with intelligent recovery
   */
  async handleStepFailure(workflowId: string, stepNumber: number, error: Error): Promise<RecoveryAction> {
    try {
      if (!this.openaiService || !this.workflowCacheService) {
        return { action: 'abort', reasoning: 'Required services not available' };
      }

      const workflow = await this.workflowCacheService.getWorkflow(workflowId);
      if (!workflow) {
        return { action: 'abort', reasoning: 'Workflow not found' };
      }

      const failedStep = workflow.plan.find(s => s.stepNumber === stepNumber);
      if (!failedStep) {
        return { action: 'abort', reasoning: 'Failed step not found' };
      }

      const recoveryPrompt = `
You are an AI workflow recovery expert. Analyze a failed workflow step and determine the best recovery strategy.

WORKFLOW CONTEXT:
- Original Request: "${workflow.context.originalRequest}"
- Failed Step: ${stepNumber}/${workflow.totalSteps}
- Step Description: "${failedStep.description}"
- Error: "${error.message}"
- Retry Count: ${failedStep.retryCount}/${failedStep.maxRetries}

RECOVERY OPTIONS:
1. retry - Try the same step again (if retries available)
2. skip - Skip this step and continue with the next
3. modify - Modify the step parameters and retry
4. abort - Stop the workflow entirely

RESPONSE FORMAT (JSON only):
{
  "action": "retry|skip|modify|abort",
  "reasoning": "Brief explanation of why this action is best",
  "modifications": {
    "parameters": {},
    "description": "modified description"
  },
  "retryDelay": 1000
}

GUIDELINES:
- If retries available and error is temporary: retry
- If step is optional or workflow can continue: skip
- If step needs different parameters: modify
- If error is fatal or step is critical: abort
`;

      const response = await this.openaiService.generateText(
        recoveryPrompt,
        'You are a workflow recovery expert. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 500 }
      );

      return JSON.parse(response) as RecoveryAction;
    } catch (error) {
      EnhancedLogger.error('Failed to determine recovery action', error as Error, {
        correlationId: `recovery-error-${Date.now()}`,
        operation: 'recovery_error',
        metadata: { workflowId, stepNumber }
      });
      return { action: 'abort', reasoning: 'Recovery analysis failed' };
    }
  }

  /**
   * Skip failed step and continue
   */
  async skipFailedStep(workflowId: string, stepNumber: number): Promise<void> {
    if (!this.workflowCacheService) {
      throw new Error('WorkflowCacheService not available');
    }

    const workflow = await this.workflowCacheService.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const stepToSkip = workflow.plan.find(s => s.stepNumber === stepNumber);
    if (stepToSkip) {
      stepToSkip.status = 'skipped';
      const updatedWorkflow = {
        ...workflow,
        currentStep: stepNumber + 1,
        pendingStep: workflow.plan.find(s => s.stepNumber === stepNumber + 1) || null
      };
      await this.workflowCacheService.updateWorkflow(workflowId, updatedWorkflow);
    }
  }

  /**
   * Generate natural language response for step execution
   */
  private async generateNaturalLanguageResponse(
    step: WorkflowStep,
    toolResult: ToolResult[],
    planModification?: PlanModification | null
  ): Promise<string> {
    try {
      if (!this.openaiService) {
        return `Step ${step.stepNumber} completed: ${step.description}`;
      }

      const prompt = `
Generate a natural language response for a workflow step execution.

STEP: ${step.stepNumber}. ${step.description}
TOOL: ${step.toolCall.name}
RESULT: ${JSON.stringify(toolResult, null, 2)}
PLAN_MODIFICATION: ${planModification ? planModification.reasoning : 'None'}

Generate a conversational response that:
1. Explains what was accomplished
2. Mentions any modifications to the plan
3. Sets expectations for next steps
4. Is helpful and informative

Keep it concise and user-friendly.
`;

      const response = await this.openaiService.generateText(
        prompt,
        'Generate natural language responses for workflow steps',
        { temperature: 0.7, maxTokens: 200 }
      );

      return response.trim();
    } catch (error) {
      return `Step ${step.stepNumber} completed: ${step.description}`;
    }
  }

  /**
   * Generate final workflow response
   */
  private async generateFinalResponse(workflow: WorkflowState, results: StepResult[]): Promise<string> {
    try {
      if (!this.openaiService) {
        return 'Workflow completed successfully.';
      }

      const successfulSteps = results.filter(r => r.success);
      const failedSteps = results.filter(r => !r.success);

      const prompt = `
Generate a final response for a completed workflow.

ORIGINAL REQUEST: "${workflow.context.originalRequest}"
TOTAL STEPS: ${workflow.totalSteps}
SUCCESSFUL STEPS: ${successfulSteps.length}
FAILED STEPS: ${failedSteps.length}

STEP RESULTS:
${results.map(r => `${r.stepNumber}. ${r.success ? '✅' : '❌'} ${r.naturalLanguageResponse}`).join('\n')}

Generate a comprehensive but concise final response that:
1. Summarizes what was accomplished
2. Highlights key findings or results
3. Mentions any failures and their impact
4. Provides actionable next steps if needed

Be helpful and professional.
`;

      const response = await this.openaiService.generateText(
        prompt,
        'Generate final workflow responses',
        { temperature: 0.7, maxTokens: 500 }
      );

      return response.trim();
    } catch (error) {
      return workflow.totalSteps === results.filter(r => r.success).length
        ? 'Workflow completed successfully.'
        : 'Workflow completed with some issues.';
    }
  }

  /**
   * Cleanup resources
   */
  protected async onDestroy(): Promise<void> {
    EnhancedLogger.debug('SequentialExecutionService destroyed', {
      correlationId: `sequential-execution-destroy-${Date.now()}`,
      operation: 'sequential_execution_destroy',
      metadata: { service: 'sequentialExecutionService' }
    });
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.toolExecutorService && !!this.workflowCacheService && !!this.openaiService,
      details: {
        service: 'sequentialExecutionService',
        hasToolExecutorService: !!this.toolExecutorService,
        hasWorkflowCacheService: !!this.workflowCacheService,
        hasOpenAIService: !!this.openaiService
      }
    };
  }
}