/**
 * Master Agent Executor with Execution Tracing
 * Wraps MasterAgent to capture complete workflow execution
 */

import { MasterAgent, ProcessingResult } from '../../../src/agents/master.agent';
import { SlackContext } from '../../../src/types/slack/slack.types';
import logger from '../../../src/utils/logger';
import { AppContainer } from '../../../src/di';
import { DetailedExecutionLogger } from './detailed-execution-logger';

interface ExecutionStage {
  stage: string;
  input: string;
  output: any;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

interface WorkflowIteration {
  iteration: number;
  input: string;
  output: string;
  duration: number;
  apiCalls: ApiCallRecord[];
  agentExecutions: AgentExecutionRecord[];
}

interface ApiCallRecord {
  timestamp: Date;
  clientName: string;
  endpoint: string;
  method: string;
  request: any;
  response: any;
  duration: number;
  success: boolean;
}

interface AgentExecutionRecord {
  timestamp: Date;
  agentType: string;
  input: string;
  output: any;
  duration: number;
  success: boolean;
  metadata?: any;
}

export interface ExecutionTrace {
  testScenarioId: string;
  userInput: string;
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  success: boolean;
  finalResult?: ProcessingResult;
  error?: string;
  detailedLogFile?: string;

  stages: {
    messageHistory?: ExecutionStage;
    situationAnalysis?: ExecutionStage;
    workflowPlanning?: ExecutionStage;
    workflowExecution?: {
      stage: string;
      iterations: WorkflowIteration[];
      totalIterations: number;
      finalContext: string;
      duration: number;
    };
    finalResponse?: ExecutionStage;
  };

  apiCalls: ApiCallRecord[];
  agentExecutions: AgentExecutionRecord[];
  performance: {
    totalApiCalls: number;
    totalApiDuration: number;
    averageApiCallDuration: number;
    totalIterations: number;
    averageIterationDuration: number;
  };
}

/**
 * Master Agent Executor with comprehensive tracing
 */
export class MasterAgentExecutor {
  private masterAgent: MasterAgent;
  private currentTrace: ExecutionTrace | null = null;
  private servicesInitialized: boolean = false;
  private detailedLogger: DetailedExecutionLogger;
  private container?: AppContainer;

  constructor(container?: AppContainer) {
    if (!container) {
      throw new Error('AppContainer is required for MasterAgentExecutor');
    }
    
    this.container = container;
    
    // Resolve dependencies from container
    const aiService = container.resolve('genericAIService');
    const contextManager = container.resolve('contextManager');
    const tokenManager = container.resolve('tokenManager');

    // Resolve MasterAgent from DI container (already configured with all dependencies)
    this.masterAgent = container.resolve('masterAgent');
    this.detailedLogger = new DetailedExecutionLogger();
  }

  /**
   * Initialize all required services for E2E testing
   */
  private async initializeServices(): Promise<void> {
    if (this.servicesInitialized) {
      return;
    }

    try {
      logger.info('Initializing services for E2E testing', {
        operation: 'e2e_service_initialization',
        usingDIContainer: !!this.container
      });

      // Services are already initialized in the DI container if provided
      // No need to reinitialize
      if (this.container) {
        logger.info('Using DI container for E2E services', {
          operation: 'e2e_service_initialization'
        });
      }

      this.servicesInitialized = true;

      logger.info('E2E services initialized successfully', {
        operation: 'e2e_service_initialization'
      });
    } catch (error) {
      logger.error('Failed to initialize E2E services', error as Error, {
        operation: 'e2e_service_initialization'
      });
      throw error;
    }
  }

  /**
   * Execute user input with complete tracing
   */
  async executeWithTracing(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext,
    testScenarioId?: string
  ): Promise<ExecutionTrace> {
    const traceId = testScenarioId || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Start detailed logging
    this.detailedLogger.startExecution(traceId, testScenarioId || 'unknown', userInput);

    // Initialize execution trace
    this.currentTrace = {
      testScenarioId: traceId,
      userInput,
      sessionId,
      userId,
      startTime: new Date(),
      success: false,
      stages: {},
      apiCalls: [],
      agentExecutions: [],
      performance: {
        totalApiCalls: 0,
        totalApiDuration: 0,
        averageApiCallDuration: 0,
        totalIterations: 0,
        averageIterationDuration: 0
      }
    };

    logger.info('Starting E2E test execution with tracing', {
      operation: 'e2e_execution_start',
      testScenarioId: traceId,
      userInput: userInput?.substring(0, 100) || 'N/A',
      sessionId,
      userId
    });

    try {
      // Initialize services first
      await this.initializeServices();

      // Initialize master agent
      await this.masterAgent.initialize();

      // Create enhanced SlackContext with progress tracking
      const enhancedSlackContext = slackContext ? {
        ...slackContext,
        updateProgress: this.createProgressTracker(slackContext.updateProgress)
      } : undefined;

      // Execute with the original MasterAgent
      const startTime = Date.now();
      const result = await this.masterAgent.processUserInput(
        userInput,
        sessionId,
        userId,
        enhancedSlackContext
      );

      const endTime = new Date();
      const totalDuration = endTime.getTime() - this.currentTrace.startTime.getTime();

      // Finalize trace
      this.currentTrace.endTime = endTime;
      this.currentTrace.totalDuration = totalDuration;
      this.currentTrace.success = result.success;
      this.currentTrace.finalResult = result;

      // Log final response
      this.detailedLogger.logFinalResponse(result.message, {
        success: result.success,
        metadata: result.metadata
      });

      // Capture API calls from mock manager
      await this.captureApiCalls();

      // Calculate performance metrics
      this.calculatePerformanceMetrics();

      // Complete detailed logging
      const logFile = await this.detailedLogger.completeExecution(result.success);
      this.currentTrace.detailedLogFile = logFile;

      logger.info('E2E test execution completed', {
        operation: 'e2e_execution_complete',
        testScenarioId: traceId,
        success: result.success,
        totalDuration,
        totalApiCalls: this.currentTrace.apiCalls.length,
        totalIterations: this.currentTrace.performance.totalIterations
      });

      return this.currentTrace;

    } catch (error) {
      const endTime = new Date();
      const totalDuration = endTime.getTime() - this.currentTrace.startTime.getTime();

      this.currentTrace.endTime = endTime;
      this.currentTrace.totalDuration = totalDuration;
      this.currentTrace.success = false;
      this.currentTrace.error = error instanceof Error ? error.message : 'Unknown error';

      // Capture API calls even on failure
      await this.captureApiCalls();

      logger.error('E2E test execution failed', error as Error, {
        operation: 'e2e_execution_error',
        testScenarioId: traceId,
        totalDuration
      });

      return this.currentTrace;
    }
  }

  /**
   * Create progress tracker that captures stage information
   */
  private createProgressTracker(originalUpdateProgress?: (step: string) => Promise<void>) {
    return async (step: string) => {
      if (!this.currentTrace) return;

      // Parse the step to identify what stage we're in
      const stageInfo = this.parseProgressStep(step);

      if (stageInfo) {
        logger.info('E2E execution stage progress', {
          operation: 'e2e_stage_progress',
          testScenarioId: this.currentTrace.testScenarioId,
          stage: stageInfo.stage,
          step
        });
      }

      // Call original progress updater if provided
      if (originalUpdateProgress) {
        await originalUpdateProgress(step);
      }
    };
  }

  /**
   * Parse progress step to identify execution stage
   */
  private parseProgressStep(step: string): { stage: string; details: string } | null {
    const lowerStep = step.toLowerCase();

    if (lowerStep.includes('building message history')) {
      return { stage: 'messageHistory', details: step };
    }
    if (lowerStep.includes('analyzing and planning')) {
      return { stage: 'situationAnalysis', details: step };
    }
    if (lowerStep.includes('executing workflow')) {
      return { stage: 'workflowExecution', details: step };
    }
    if (lowerStep.includes('generating response')) {
      return { stage: 'finalResponse', details: step };
    }

    return null;
  }

  /**
   * Get API calls from mock manager and add to trace
   */
  private async captureApiCalls(): Promise<void> {
    if (!this.currentTrace) return;

    try {
      const { ApiMockManager } = await import('./api-mock-manager');
      const mockManager = ApiMockManager.getInstance();
      const apiCallRecords = mockManager.getApiCallRecords();

      logger.info('Capturing API calls for trace', {
        operation: 'capture_api_calls',
        totalRecords: apiCallRecords.length,
        traceStartTime: this.currentTrace.startTime.toISOString()
      });

      // Add new API calls to trace
      const newCalls = apiCallRecords.filter(call =>
        call.timestamp >= this.currentTrace!.startTime
      );

      logger.info('Filtered API calls for trace', {
        operation: 'filter_api_calls',
        newCallsCount: newCalls.length,
        totalRecords: apiCallRecords.length
      });

      this.currentTrace.apiCalls.push(...newCalls.map(call => ({
        timestamp: call.timestamp,
        clientName: call.clientName,
        endpoint: call.request.endpoint,
        method: call.request.method,
        request: call.request,
        response: call.response,
        duration: call.duration,
        success: call.response.statusCode >= 200 && call.response.statusCode < 300
      })));

      // Log each API call to detailed logger
      for (const call of newCalls) {
        const success = call.response.statusCode >= 200 && call.response.statusCode < 300;
        this.detailedLogger.logAPICall(
          call.clientName,
          call.request.endpoint,
          call.request.method,
          call.request,
          { duration: call.duration, success }
        );
        
        this.detailedLogger.logAPIResponse(
          call.clientName,
          call.request.endpoint,
          call.response,
          { duration: call.duration, success }
        );
      }

      logger.info('API calls captured successfully', {
        operation: 'api_calls_captured',
        totalApiCalls: this.currentTrace.apiCalls.length
      });

    } catch (error) {
      logger.warn('Failed to capture API calls', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate performance metrics from captured data
   */
  private calculatePerformanceMetrics(): void {
    if (!this.currentTrace) return;

    const apiCalls = this.currentTrace.apiCalls;
    const totalApiCalls = apiCalls.length;
    const totalApiDuration = apiCalls.reduce((sum, call) => sum + call.duration, 0);
    const averageApiCallDuration = totalApiCalls > 0 ? totalApiDuration / totalApiCalls : 0;

    // Estimate iterations from API calls or stages
    const totalIterations = Math.max(1, Math.ceil(totalApiCalls / 3)); // Rough estimate
    const averageIterationDuration = this.currentTrace.totalDuration ?
      this.currentTrace.totalDuration / totalIterations : 0;

    this.currentTrace.performance = {
      totalApiCalls,
      totalApiDuration,
      averageApiCallDuration,
      totalIterations,
      averageIterationDuration
    };

    logger.info('Performance metrics calculated', {
      operation: 'calculate_performance_metrics',
      totalApiCalls,
      totalApiDuration,
      averageApiCallDuration,
      totalIterations,
      averageIterationDuration
    });
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(trace: ExecutionTrace): any {
    return {
      testScenarioId: trace.testScenarioId,
      success: trace.success,
      duration: trace.totalDuration,
      stages: Object.keys(trace.stages).length,
      apiCalls: trace.apiCalls.length,
      apiCallBreakdown: this.getApiCallBreakdown(trace),
      performance: trace.performance,
      error: trace.error
    };
  }

  /**
   * Get API call breakdown by client and endpoint
   */
  private getApiCallBreakdown(trace: ExecutionTrace): any {
    const breakdown: any = {
      byClient: {},
      byEndpoint: {},
      byStatus: { success: 0, error: 0 }
    };

    trace.apiCalls.forEach(call => {
      // By client
      breakdown.byClient[call.clientName] = (breakdown.byClient[call.clientName] || 0) + 1;

      // By endpoint
      breakdown.byEndpoint[call.endpoint] = (breakdown.byEndpoint[call.endpoint] || 0) + 1;

      // By status
      if (call.success) {
        breakdown.byStatus.success++;
      } else {
        breakdown.byStatus.error++;
      }
    });

    return breakdown;
  }

  /**
   * Export trace data for analysis
   */
  exportTraceData(trace: ExecutionTrace): any {
    return {
      metadata: {
        testScenarioId: trace.testScenarioId,
        userInput: trace.userInput,
        sessionId: trace.sessionId,
        userId: trace.userId,
        timestamp: trace.startTime.toISOString(),
        duration: trace.totalDuration,
        success: trace.success
      },
      execution: {
        stages: trace.stages,
        finalResult: trace.finalResult,
        error: trace.error
      },
      apiCalls: trace.apiCalls.map(call => ({
        timestamp: call.timestamp.toISOString(),
        client: call.clientName,
        endpoint: call.endpoint,
        method: call.method,
        duration: call.duration,
        success: call.success
      })),
      performance: trace.performance,
      summary: this.getExecutionSummary(trace)
    };
  }

  /**
   * Cleanup after execution
   */
  async cleanup(): Promise<void> {
    this.currentTrace = null;

    // Clear API call records from mock manager
    try {
      const { ApiMockManager } = await import('./api-mock-manager');
      const mockManager = ApiMockManager.getInstance();
      mockManager.clearCallRecords();
    } catch (error) {
      logger.warn('Failed to cleanup mock manager', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}