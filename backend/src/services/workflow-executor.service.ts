/**
 * WorkflowExecutor - Decomposed workflow execution with focused responsibilities
 *
 * Breaks down the monolithic executeWorkflow method into focused, testable methods
 * following Single Responsibility Principle.
 */

import { BuilderGuard, createBuilderContext } from '../utils/builder-guard';
import { ErrorFactory } from '../errors';
import { AgentFactory } from '../framework/agent-factory';
import { TokenManager } from './token-manager';
import { TokenServiceType } from '../types/workflow/token-service.types';
import logger from '../utils/logger';
import {
  EnvironmentCheckPromptBuilder,
  ActionExecutionPromptBuilder,
  ProgressAssessmentPromptBuilder
} from './prompt-builders/main-agent';
// import { DomainServiceResolver } from './domain';

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  sessionId: string;
  userId?: string;
  iteration: number;
  currentContext: string;
  correlationId?: string;
}

/**
 * Environment check result
 */
export interface EnvironmentCheckResult {
  needsUserInput: boolean;
  requiredInfo?: string;
  updatedContext: string;
  canContinue: boolean;
}

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  hasAgentAction: boolean;
  agentName?: string;
  agentRequest?: string;
  agentResult?: any;
  agentError?: Error;
  updatedContext: string;
}

/**
 * Progress assessment result
 */
export interface ProgressAssessmentResult {
  isComplete: boolean;
  newSteps: string[];
  updatedContext: string;
  shouldContinue: boolean;
}

/**
 * Workflow iteration result
 */
export interface WorkflowIterationResult {
  shouldContinue: boolean;
  shouldExitForUserInput: boolean;
  shouldExitComplete: boolean;
  updatedContext: string;
  iteration: number;
}

/**
 * WorkflowExecutor - Handles workflow execution with decomposed methods
 */
export class WorkflowExecutor {
  constructor(
    private environmentCheckBuilder: EnvironmentCheckPromptBuilder,
    private actionExecutionBuilder: ActionExecutionPromptBuilder,
    private progressAssessmentBuilder: ProgressAssessmentPromptBuilder,
    private tokenManager?: TokenManager,
    private maxIterations: number = 10
  ) {}

  /**
   * Execute complete workflow
   */
  async execute(
    initialContext: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    logger.info('Starting workflow execution', { sessionId, userId });

    let currentContext = initialContext;
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      const iterationResult = await this.executeIteration({
        sessionId,
        userId,
        iteration,
        currentContext,
        correlationId: `workflow-${sessionId}-${iteration}`
      });

      currentContext = iterationResult.updatedContext;

      if (iterationResult.shouldExitForUserInput) {
        logger.info('Workflow paused for user input', {
          sessionId,
          iteration,
          reason: 'user_input_required'
        });
        break;
      }

      if (iterationResult.shouldExitComplete) {
        logger.info('Workflow completed successfully', {
          sessionId,
          iteration,
          totalIterations: iteration
        });
        break;
      }

      if (!iterationResult.shouldContinue) {
        logger.warn('Workflow stopped due to unspecified condition', {
          sessionId,
          iteration
        });
        break;
      }
    }

    if (iteration >= this.maxIterations) {
      throw ErrorFactory.workflow.iterationLimit(iteration, this.maxIterations, sessionId);
    }

    return currentContext;
  }

  /**
   * Execute a single workflow iteration
   */
  private async executeIteration(context: WorkflowExecutionContext): Promise<WorkflowIterationResult> {
    logger.debug('Executing workflow iteration', {
      sessionId: context.sessionId,
      iteration: context.iteration
    });

    // Step 1: Environment & Readiness Check
    const environmentResult = await this.checkEnvironmentReadiness(context);

    if (environmentResult.needsUserInput) {
      return {
        shouldContinue: false,
        shouldExitForUserInput: true,
        shouldExitComplete: false,
        updatedContext: environmentResult.updatedContext,
        iteration: context.iteration
      };
    }

    if (!environmentResult.canContinue) {
      return {
        shouldContinue: false,
        shouldExitForUserInput: false,
        shouldExitComplete: false,
        updatedContext: environmentResult.updatedContext,
        iteration: context.iteration
      };
    }

    // Step 2: Action Execution
    const actionResult = await this.executeActions({
      ...context,
      currentContext: environmentResult.updatedContext
    });

    // Step 3: Progress Assessment
    const progressResult = await this.assessProgress({
      ...context,
      currentContext: actionResult.updatedContext
    });

    return {
      shouldContinue: progressResult.shouldContinue,
      shouldExitForUserInput: false,
      shouldExitComplete: progressResult.isComplete,
      updatedContext: progressResult.updatedContext,
      iteration: context.iteration
    };
  }

  /**
   * Check environment readiness for workflow execution
   */
  private async checkEnvironmentReadiness(context: WorkflowExecutionContext): Promise<EnvironmentCheckResult> {
    logger.debug('Checking environment readiness', {
      sessionId: context.sessionId,
      iteration: context.iteration
    });

    try {
      const builderContext = createBuilderContext(
        context.sessionId,
        context.userId,
        'environment_check',
        { iteration: context.iteration }
      );

      const environmentResult = await BuilderGuard.safeExecute(
        this.environmentCheckBuilder,
        'environment',
        context.currentContext,
        builderContext
      );

      const needsUserInput = environmentResult.parsed.needsUserInput || false;
      const requiredInfo = environmentResult.parsed.requiredInfo;
      const updatedContext = environmentResult.parsed.context;

      if (needsUserInput) {
        logger.info('User input required', {
          sessionId: context.sessionId,
          iteration: context.iteration,
          requiredInfo
        });
      }

      return {
        needsUserInput,
        requiredInfo,
        updatedContext,
        canContinue: !needsUserInput
      };

    } catch (error) {
      logger.error('Environment check failed', error as Error, {
        sessionId: context.sessionId,
        iteration: context.iteration
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.workflow.executionFailed(
        `Environment check failed: ${errorMessage}`,
        context.sessionId,
        context.iteration
      );
    }
  }

  /**
   * Execute workflow actions including agent delegation
   */
  private async executeActions(context: WorkflowExecutionContext): Promise<ActionExecutionResult> {
    logger.debug('Executing workflow actions', {
      sessionId: context.sessionId,
      iteration: context.iteration
    });

    try {
      const builderContext = createBuilderContext(
        context.sessionId,
        context.userId,
        'action_execution',
        { iteration: context.iteration }
      );

      const actionResult = await BuilderGuard.safeExecute(
        this.actionExecutionBuilder,
        'action',
        context.currentContext,
        builderContext
      );

      let updatedContext = actionResult.parsed.context;
      const agentName = actionResult.parsed.agent;
      const agentRequest = actionResult.parsed.request;

      // Execute agent action if specified
      if (agentName && agentRequest) {
        const agentExecutionResult = await this.executeAgentAction(
          agentName,
          agentRequest,
          context
        );

        // Update context with agent execution results
        updatedContext = this.updateContextWithAgentResult(
          updatedContext,
          agentName,
          agentRequest,
          agentExecutionResult.result,
          agentExecutionResult.error
        );

        return {
          hasAgentAction: true,
          agentName,
          agentRequest,
          agentResult: agentExecutionResult.result,
          agentError: agentExecutionResult.error,
          updatedContext
        };
      }

      return {
        hasAgentAction: false,
        updatedContext
      };

    } catch (error) {
      logger.error('Action execution failed', error as Error, {
        sessionId: context.sessionId,
        iteration: context.iteration
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.workflow.executionFailed(
        `Action execution failed: ${errorMessage}`,
        context.sessionId,
        context.iteration
      );
    }
  }

  /**
   * Execute agent action with proper token management
   */
  private async executeAgentAction(
    agentName: string,
    request: string,
    context: WorkflowExecutionContext
  ): Promise<{ result?: any; error?: Error }> {
    try {
      // Get access token if available
      let accessToken: string | undefined;

      if (context.userId && this.tokenManager) {
        try {
          const serviceType = this.getServiceTypeForAgent(agentName);
          if (serviceType) {
            // const tokenContext: TokenContext = {
            //   userId: context.userId,
            //   sessionId: context.sessionId,
            //   service: serviceType,
            //   correlationId: context.correlationId
            // };

            // Parse userId to get teamId and userId for TokenManager
            const { teamId, userId: parsedUserId } = this.parseUserId(context.userId);
            
            // Get token based on service type
            if (serviceType === TokenServiceType.GOOGLE) {
              accessToken = await this.tokenManager.getValidTokens(teamId, parsedUserId) || undefined;
            }
          }
        } catch (tokenError) {
          logger.warn('Failed to retrieve access token for agent execution', {
            agentName,
            sessionId: context.sessionId,
            error: tokenError instanceof Error ? tokenError.message : String(tokenError)
          });
        }
      }

      const result = await AgentFactory.executeAgentWithNaturalLanguage(
        this.mapAgentName(agentName),
        request,
        {
          sessionId: context.sessionId,
          userId: context.userId,
          accessToken,
          correlationId: context.correlationId || `agent-${Date.now()}`
        }
      );

      return { result };

    } catch (error) {
      logger.error('Agent execution failed', error as Error, {
        agentName,
        request: request.substring(0, 100),
        sessionId: context.sessionId,
        iteration: context.iteration
      });

      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Assess workflow progress and determine next steps
   */
  private async assessProgress(context: WorkflowExecutionContext): Promise<ProgressAssessmentResult> {
    logger.debug('Assessing workflow progress', {
      sessionId: context.sessionId,
      iteration: context.iteration
    });

    try {
      const builderContext = createBuilderContext(
        context.sessionId,
        context.userId,
        'progress_assessment',
        { iteration: context.iteration }
      );

      const progressResult = await BuilderGuard.safeExecute(
        this.progressAssessmentBuilder,
        'progress',
        context.currentContext,
        builderContext
      );

      const newSteps = progressResult.parsed.newSteps || [];
      const isComplete = newSteps.length === 0;
      const updatedContext = progressResult.parsed.context;

      return {
        isComplete,
        newSteps,
        updatedContext,
        shouldContinue: !isComplete
      };

    } catch (error) {
      logger.error('Progress assessment failed', error as Error, {
        sessionId: context.sessionId,
        iteration: context.iteration
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.workflow.executionFailed(
        `Progress assessment failed: ${errorMessage}`,
        context.sessionId,
        context.iteration
      );
    }
  }

  /**
   * Update context with agent execution results
   */
  private updateContextWithAgentResult(
    currentContext: string,
    agentName: string,
    request: string,
    result?: any,
    error?: Error
  ): string {
    if (error) {
      return `${currentContext}\n\nAgent Execution Error:\nAgent: ${agentName}\nRequest: ${request}\nError: ${error.message}`;
    } else {
      return `${currentContext}\n\nAgent Execution Result:\nAgent: ${agentName}\nRequest: ${request}\nResult: ${JSON.stringify(result, null, 2)}`;
    }
  }

  /**
   * Parse userId into teamId and userId components
   * Supports both "teamId:userId" format and plain userId
   */
  private parseUserId(userId: string): { teamId: string; userId: string } {
    if (userId.includes(':')) {
      const [teamId, actualUserId] = userId.split(':', 2);
      return { teamId: teamId || '', userId: actualUserId || '' };
    }

    // For non-Slack contexts, we might need a default team or different approach
    // For now, assume the userId is the teamId (single-tenant approach)
    return { teamId: userId, userId: userId };
  }

  /**
   * Determine service type for agent
   */
  private getServiceTypeForAgent(agentName: string): TokenServiceType | null {
    // Map short names to full names first
    const fullAgentName = this.mapAgentName(agentName);
    
    switch (fullAgentName.toLowerCase()) {
      case 'emailagent':
      case 'calendaragent':
      case 'contactagent':
        return TokenServiceType.GOOGLE;
      case 'slackagent':
        return TokenServiceType.SLACK;
      default:
        return null;
    }
  }

  /**
   * Map short agent names to full agent names
   */
  private mapAgentName(shortName: string): string {
    const mapping: Record<string, string> = {
      'calendar': 'calendarAgent',
      'email': 'emailAgent', 
      'contact': 'contactAgent',
      'slack': 'slackAgent'
    };
    return mapping[shortName] || shortName;
  }
}