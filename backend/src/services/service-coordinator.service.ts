import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import { ToolExecutorService } from './tool-executor.service';
import { TokenManager } from './token-manager';
import { AgentFactory } from '../framework/agent-factory';
import { ToolCall, ToolResult } from '../types/tools';
import { SlackContext } from '../types/slack/slack.types';

/**
 * Service coordination interfaces
 */
export interface ServiceCoordinationContext {
  sessionId: string;
  userId?: string;
  slackContext?: SlackContext;
  accessToken?: string;
  requiredServices: string[];
}

export interface ServiceExecutionPlan {
  services: ServiceExecutionStep[];
  totalSteps: number;
  estimatedDuration: number;
  dependencies: Record<string, string[]>;
}

export interface ServiceExecutionStep {
  serviceName: string;
  operation: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  timeout: number;
}

export interface ServiceExecutionResult {
  results: ToolResult[];
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  errors: Array<{
    serviceName: string;
    error: string;
    step: number;
  }>;
}

/**
 * Service responsible for coordinating multiple services and managing execution flow
 *
 * Single Responsibility: Service Integration & Coordination
 * - Coordinates tool execution across multiple services
 * - Manages service dependencies and execution order
 * - Handles service lifecycle and error recovery
 * - Provides unified interface for service operations
 */
export class ServiceCoordinator extends BaseService {
  private toolExecutorService: ToolExecutorService | null = null;
  private tokenManager: TokenManager | null = null;
  private agentFactory: AgentFactory | null = null;

  constructor() {
    super('ServiceCoordinator');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.toolExecutorService = serviceManager.getService<ToolExecutorService>('toolExecutorService') || null;
    this.tokenManager = serviceManager.getService<TokenManager>('tokenManager') || null;
    this.agentFactory = serviceManager.getService('agentFactory') || null;

    if (!this.toolExecutorService) {
      throw new Error('ToolExecutorService not available for service coordination');
    }

    this.logInfo('ServiceCoordinator initialized successfully');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ServiceCoordinator destroyed');
  }

  /**
   * Coordinate execution of multiple services
   *
   * @param toolCalls - Tool calls to execute
   * @param context - Coordination context
   * @returns Promise resolving to execution results
   */
  async coordinateServices(
    toolCalls: ToolCall[],
    context: ServiceCoordinationContext
  ): Promise<ServiceExecutionResult> {
    this.assertReady();

    const executionStartTime = Date.now();

    this.logDebug('Starting service coordination', {
      toolCallCount: toolCalls.length,
      sessionId: context.sessionId,
      requiredServices: context.requiredServices
    });

    try {
      // Create execution plan
      const executionPlan = await this.createExecutionPlan(toolCalls, context);

      // Execute services according to plan
      const results = await this.executeServicePlan(executionPlan, context);

      const totalExecutionTime = Date.now() - executionStartTime;

      const executionResult: ServiceExecutionResult = {
        results: results.results,
        successCount: results.results.filter(r => r.success).length,
        failureCount: results.results.filter(r => !r.success).length,
        totalExecutionTime,
        errors: results.errors
      };

      this.logInfo('Service coordination completed', {
        successCount: executionResult.successCount,
        failureCount: executionResult.failureCount,
        totalExecutionTime,
        sessionId: context.sessionId
      });

      return executionResult;
    } catch (error) {
      this.logError('Service coordination failed', { error, context });

      return {
        results: [],
        successCount: 0,
        failureCount: toolCalls.length,
        totalExecutionTime: Date.now() - executionStartTime,
        errors: [{
          serviceName: 'ServiceCoordinator',
          error: error instanceof Error ? error.message : 'Unknown error',
          step: 0
        }]
      };
    }
  }

  /**
   * Execute a single tool call with proper service coordination
   *
   * @param toolCall - Tool call to execute
   * @param context - Coordination context
   * @returns Promise resolving to tool result
   */
  async executeSingleService(
    toolCall: ToolCall,
    context: ServiceCoordinationContext
  ): Promise<ToolResult> {
    this.assertReady();

    if (!this.toolExecutorService) {
      throw new Error('Tool executor service not available');
    }

    this.logDebug('Executing single service', {
      toolName: toolCall.name,
      sessionId: context.sessionId
    });

    try {
      // Prepare execution context
      const executionContext = await this.prepareExecutionContext(toolCall, context);

      // Execute the tool call
      const result = await this.toolExecutorService.executeTool(toolCall, executionContext);

      this.logDebug('Single service execution completed', {
        toolName: toolCall.name,
        success: result.success,
        sessionId: context.sessionId
      });

      return result;
    } catch (error) {
      this.logError('Single service execution failed', { error, toolCall, context });

      return {
        toolName: toolCall.name,
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  }

  /**
   * Check service availability and health
   *
   * @param serviceNames - Names of services to check
   * @returns Promise resolving to service health status
   */
  async checkServiceHealth(serviceNames: string[]): Promise<Record<string, boolean>> {
    this.assertReady();

    const healthStatus: Record<string, boolean> = {};

    this.logDebug('Checking service health', { serviceNames });

    for (const serviceName of serviceNames) {
      try {
        const service = serviceManager.getService(serviceName);
        healthStatus[serviceName] = !!(service && (service as any).isReady?.());
      } catch (error) {
        this.logWarn('Service health check failed', { serviceName, error });
        healthStatus[serviceName] = false;
      }
    }

    this.logDebug('Service health check completed', { healthStatus });

    return healthStatus;
  }

  /**
   * Get access tokens for authenticated services
   *
   * @param context - Coordination context
   * @returns Promise resolving to access tokens
   */
  async getAccessTokens(context: ServiceCoordinationContext): Promise<Record<string, string>> {
    this.assertReady();

    const tokens: Record<string, string> = {};

    if (!this.tokenManager || !context.userId) {
      this.logDebug('No token manager or user ID, skipping token retrieval');
      return tokens;
    }

    try {
      const { teamId, actualUserId } = this.parseUserId(context.userId);

      if (!teamId || !actualUserId) {
        this.logWarn('Invalid user ID format for token retrieval', { userId: context.userId });
        return tokens;
      }

      // Get tokens for Gmail operations
      if (context.requiredServices.includes('gmailService')) {
        const gmailToken = await this.tokenManager.getValidTokensForGmail(teamId, actualUserId);
        if (gmailToken) {
          tokens.gmail = gmailToken;
        }
      }

      // Get tokens for Calendar operations
      if (context.requiredServices.includes('calendarService')) {
        const calendarToken = await this.tokenManager.getValidTokensForCalendar(teamId, actualUserId);
        if (calendarToken) {
          tokens.calendar = calendarToken;
        }
      }

      // Get general tokens for other operations
      const generalToken = await this.tokenManager.getValidTokens(teamId, actualUserId);
      if (generalToken) {
        tokens.general = generalToken;
      }

      this.logDebug('Retrieved access tokens', {
        tokenCount: Object.keys(tokens).length,
        services: Object.keys(tokens)
      });

    } catch (error) {
      this.logError('Failed to retrieve access tokens', { error, context });
    }

    return tokens;
  }

  /**
   * Private helper methods
   */

  private async createExecutionPlan(
    toolCalls: ToolCall[],
    context: ServiceCoordinationContext
  ): Promise<ServiceExecutionPlan> {
    const steps: ServiceExecutionStep[] = [];
    const dependencies: Record<string, string[]> = {};

    for (const toolCall of toolCalls) {
      const serviceName = this.determineServiceForToolCall(toolCall);
      const stepDependencies = this.determineDependencies(toolCall, context);

      const step: ServiceExecutionStep = {
        serviceName,
        operation: toolCall.name,
        parameters: toolCall.parameters,
        dependencies: stepDependencies,
        timeout: this.determineTimeout(toolCall)
      };

      steps.push(step);
      dependencies[toolCall.name] = stepDependencies;
    }

    const estimatedDuration = steps.reduce((total, step) => total + step.timeout, 0);

    return {
      services: steps,
      totalSteps: steps.length,
      estimatedDuration,
      dependencies
    };
  }

  private async executeServicePlan(
    plan: ServiceExecutionPlan,
    context: ServiceCoordinationContext
  ): Promise<{ results: ToolResult[]; errors: Array<{ serviceName: string; error: string; step: number }> }> {
    const results: ToolResult[] = [];
    const errors: Array<{ serviceName: string; error: string; step: number }> = [];

    // Get access tokens once for all operations
    const accessTokens = await this.getAccessTokens(context);

    for (let i = 0; i < plan.services.length; i++) {
      const step = plan.services[i];
      if (!step) {
        continue;
      }

      try {
        this.logDebug('Executing service step', {
          stepNumber: i + 1,
          serviceName: step.serviceName,
          operation: step.operation
        });

        // Create tool call for this step
        const toolCall: ToolCall = {
          name: step.operation,
          parameters: step.parameters
        };

        // Prepare execution context with tokens
        const executionContext = {
          sessionId: context.sessionId,
          userId: context.userId,
          slackContext: context.slackContext,
          accessToken: this.selectAccessToken(accessTokens, step.serviceName)
        };

        // Execute the step
        const result = await this.executeSingleService(toolCall, {
          ...context,
          ...executionContext
        });

        results.push(result);

        if (!result.success) {
          errors.push({
            serviceName: step.serviceName,
            error: result.error || 'Unknown error',
            step: i + 1
          });
        }

      } catch (error) {
        this.logError('Service step execution failed', { error, step: i + 1, serviceName: step.serviceName });

        results.push({
          toolName: step.operation,
          success: false,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0
        });

        errors.push({
          serviceName: step.serviceName,
          error: error instanceof Error ? error.message : 'Unknown error',
          step: i + 1
        });
      }
    }

    return { results, errors };
  }

  private async prepareExecutionContext(
    toolCall: ToolCall,
    context: ServiceCoordinationContext
  ): Promise<any> {
    // Get access tokens if needed
    const tokens = await this.getAccessTokens(context);
    const serviceName = this.determineServiceForToolCall(toolCall);
    const accessToken = this.selectAccessToken(tokens, serviceName);

    return {
      sessionId: context.sessionId,
      userId: context.userId,
      slackContext: context.slackContext,
      accessToken
    };
  }

  private determineServiceForToolCall(toolCall: ToolCall): string {
    const toolName = toolCall.name.toLowerCase();

    if (toolName.includes('email') || toolName.includes('gmail')) {
      return 'gmailService';
    }

    if (toolName.includes('calendar')) {
      return 'calendarService';
    }

    if (toolName.includes('contact')) {
      return 'contactService';
    }

    if (toolName.includes('slack')) {
      return 'slackService';
    }

    return 'toolExecutorService'; // Default
  }

  private determineDependencies(toolCall: ToolCall, context: ServiceCoordinationContext): string[] {
    const dependencies: string[] = [];

    // All authenticated operations depend on token manager
    if (this.needsAuthentication(toolCall.name)) {
      dependencies.push('tokenManager');
    }

    // Email operations may need contact resolution
    if (toolCall.name.includes('email') && toolCall.parameters.to) {
      dependencies.push('contactService');
    }

    return dependencies;
  }

  private determineTimeout(toolCall: ToolCall): number {
    const toolName = toolCall.name.toLowerCase();

    // Different operations have different expected timeouts
    if (toolName.includes('search') || toolName.includes('get')) {
      return 10000; // 10 seconds for read operations
    }

    if (toolName.includes('send') || toolName.includes('create')) {
      return 30000; // 30 seconds for write operations
    }

    return 15000; // Default 15 seconds
  }

  private needsAuthentication(toolName: string): boolean {
    const authOps = [
      'send_email',
      'get_emails',
      'create_calendar_event',
      'get_calendar_events',
      'get_contacts'
    ];
    return authOps.some(op => toolName.includes(op));
  }

  private selectAccessToken(tokens: Record<string, string>, serviceName: string): string | undefined {
    switch (serviceName) {
      case 'gmailService':
        return tokens.gmail || tokens.general;
      case 'calendarService':
        return tokens.calendar || tokens.general;
      default:
        return tokens.general;
    }
  }

  private parseUserId(userId?: string): { teamId: string | null; actualUserId: string | null } {
    if (!userId || typeof userId !== 'string') {
      return { teamId: null, actualUserId: null };
    }

    // Handle Slack-style user ID format (teamId:userId)
    if (userId.includes(':')) {
      const [teamId, actualUserId] = userId.split(':', 2);
      return { teamId: teamId || null, actualUserId: actualUserId || null };
    }

    // Handle plain user ID (assume no team)
    return { teamId: null, actualUserId: userId };
  }
}