/**
 * Component Tests for Master Agent Executor
 * Tests the execution tracing functionality in isolation
 */

import { MasterAgentExecutor, ExecutionTrace } from '../framework/master-agent-executor';
import { ApiMockManager } from '../framework/api-mock-manager';

describe('Master Agent Executor Component Tests', () => {
  let executor: MasterAgentExecutor;
  let mockManager: ApiMockManager;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.E2E_TESTING = 'true';
  });

  beforeEach(() => {
    executor = new MasterAgentExecutor();
    mockManager = ApiMockManager.getInstance();
    mockManager.clearCallRecords();
    
    // Set up test context
    mockManager.setMockContext({
      testScenarioId: 'test_master_agent_executor',
      userId: 'test_user_123',
      userEmail: 'test@example.com',
      currentTime: new Date('2025-01-15T10:00:00Z'),
      slackUserId: 'U123TEST',
      slackTeamId: 'T123TEST',
      slackChannelId: 'C123TEST'
    });
  });

  afterEach(async () => {
    await executor.cleanup();
    mockManager.clearCallRecords();
  });

  describe('Execution Tracing', () => {
    test('should create execution trace with correct structure', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_123';
      const userId = 'test_user_123';
      const testScenarioId = 'test_trace_structure';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        testScenarioId
      );

      // Verify trace structure
      expect(trace).toBeDefined();
      expect(trace.testScenarioId).toBe(testScenarioId);
      expect(trace.userInput).toBe(userInput);
      expect(trace.sessionId).toBe(sessionId);
      expect(trace.userId).toBe(userId);
      expect(trace.startTime).toBeInstanceOf(Date);
      expect(trace.endTime).toBeInstanceOf(Date);
      expect(trace.totalDuration).toBeGreaterThan(0);
      expect(trace.success).toBeDefined();
      expect(trace.apiCalls).toBeInstanceOf(Array);
      expect(trace.performance).toBeDefined();
      expect(trace.performance.totalApiCalls).toBeGreaterThanOrEqual(0);
      expect(trace.performance.totalApiDuration).toBeGreaterThanOrEqual(0);
      expect(trace.performance.averageApiCallDuration).toBeGreaterThanOrEqual(0);
      expect(trace.performance.totalIterations).toBeGreaterThanOrEqual(0);
      expect(trace.performance.averageIterationDuration).toBeGreaterThanOrEqual(0);
    });

    test('should handle execution errors gracefully', async () => {
      const userInput = ''; // Empty input should cause an error
      const sessionId = 'test_session_error';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_error_handling'
      );

      // Should still create a trace even on error
      expect(trace).toBeDefined();
      expect(trace.testScenarioId).toBe('test_error_handling');
      expect(trace.userInput).toBe(userInput);
      expect(trace.startTime).toBeInstanceOf(Date);
      expect(trace.endTime).toBeInstanceOf(Date);
      expect(trace.totalDuration).toBeGreaterThan(0);
      expect(trace.success).toBe(false);
    });

    test('should generate detailed log file', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_log_file';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_log_file'
      );

      // Should have generated a detailed log file
      expect(trace.detailedLogFile).toBeDefined();
      expect(trace.detailedLogFile).toContain('.md');
      expect(trace.detailedLogFile).toContain('test_log_file');
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate performance metrics correctly', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_performance';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_performance'
      );

      // Verify performance metrics
      expect(trace.performance.totalApiCalls).toBe(trace.apiCalls.length);
      expect(trace.performance.totalApiDuration).toBeGreaterThanOrEqual(0);
      expect(trace.performance.averageApiCallDuration).toBeGreaterThanOrEqual(0);
      expect(trace.performance.totalIterations).toBeGreaterThanOrEqual(1);
      expect(trace.performance.averageIterationDuration).toBeGreaterThanOrEqual(0);

      // If there are API calls, verify calculations
      if (trace.apiCalls.length > 0) {
        const expectedTotalDuration = trace.apiCalls.reduce((sum, call) => sum + call.duration, 0);
        expect(trace.performance.totalApiDuration).toBe(expectedTotalDuration);
        
        const expectedAverageDuration = expectedTotalDuration / trace.apiCalls.length;
        expect(trace.performance.averageApiCallDuration).toBeCloseTo(expectedAverageDuration, 2);
      }
    });

    test('should handle zero API calls gracefully', async () => {
      const userInput = 'Hello'; // Simple input that might not trigger API calls
      const sessionId = 'test_session_zero_api';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_zero_api'
      );

      // Should handle zero API calls without errors
      expect(trace.performance.totalApiCalls).toBe(0);
      expect(trace.performance.totalApiDuration).toBe(0);
      expect(trace.performance.averageApiCallDuration).toBe(0);
      expect(trace.performance.totalIterations).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Execution Summary', () => {
    test('should generate execution summary', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_summary';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_summary'
      );

      const summary = executor.getExecutionSummary(trace);

      expect(summary).toBeDefined();
      expect(summary.testScenarioId).toBe('test_summary');
      expect(summary.success).toBe(trace.success);
      expect(summary.duration).toBe(trace.totalDuration);
      expect(summary.stages).toBeGreaterThanOrEqual(0);
      expect(summary.apiCalls).toBe(trace.apiCalls.length);
      expect(summary.apiCallBreakdown).toBeDefined();
      expect(summary.performance).toBeDefined();
      expect(summary.error).toBe(trace.error);
    });

    test('should provide API call breakdown', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_breakdown';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_breakdown'
      );

      const summary = executor.getExecutionSummary(trace);
      const breakdown = summary.apiCallBreakdown;

      expect(breakdown).toBeDefined();
      expect(breakdown.byClient).toBeDefined();
      expect(breakdown.byEndpoint).toBeDefined();
      expect(breakdown.byStatus).toBeDefined();
      expect(breakdown.byStatus.success).toBeGreaterThanOrEqual(0);
      expect(breakdown.byStatus.error).toBeGreaterThanOrEqual(0);

      // Verify breakdown totals match actual calls
      const totalBreakdownCalls = breakdown.byStatus.success + breakdown.byStatus.error;
      expect(totalBreakdownCalls).toBe(trace.apiCalls.length);
    });
  });

  describe('Trace Data Export', () => {
    test('should export trace data for analysis', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_export';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_export'
      );

      const exportedData = executor.exportTraceData(trace);

      expect(exportedData).toBeDefined();
      expect(exportedData.metadata).toBeDefined();
      expect(exportedData.execution).toBeDefined();
      expect(exportedData.apiCalls).toBeDefined();
      expect(exportedData.performance).toBeDefined();
      expect(exportedData.summary).toBeDefined();

      // Verify metadata
      expect(exportedData.metadata.testScenarioId).toBe('test_export');
      expect(exportedData.metadata.userInput).toBe(userInput);
      expect(exportedData.metadata.sessionId).toBe(sessionId);
      expect(exportedData.metadata.userId).toBe(userId);
      expect(exportedData.metadata.timestamp).toBe(trace.startTime.toISOString());
      expect(exportedData.metadata.duration).toBe(trace.totalDuration);
      expect(exportedData.metadata.success).toBe(trace.success);

      // Verify API calls export
      expect(exportedData.apiCalls).toHaveLength(trace.apiCalls.length);
      exportedData.apiCalls.forEach((call: any, index: number) => {
        expect(call.timestamp).toBe(trace.apiCalls[index].timestamp.toISOString());
        expect(call.client).toBe(trace.apiCalls[index].clientName);
        expect(call.endpoint).toBe(trace.apiCalls[index].endpoint);
        expect(call.method).toBe(trace.apiCalls[index].method);
        expect(call.duration).toBe(trace.apiCalls[index].duration);
        expect(call.success).toBe(trace.apiCalls[index].success);
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly after execution', async () => {
      const userInput = 'Send an email to john@example.com about the meeting';
      const sessionId = 'test_session_cleanup';
      const userId = 'test_user_123';

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_cleanup'
      );

      expect(trace).toBeDefined();

      // Cleanup should not throw errors
      await expect(executor.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Slack Context Integration', () => {
    test('should handle Slack context properly', async () => {
      const userInput = 'Send a message to the team channel';
      const sessionId = 'test_session_slack';
      const userId = 'test_user_123';
      const slackContext = {
        userId: 'U123TEST',
        channelId: 'C123TEST',
        teamId: 'T123TEST',
        isDirectMessage: false,
        updateProgress: async (step: string) => {
          // Mock progress updater
        }
      };

      const trace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        slackContext,
        'test_slack_context'
      );

      expect(trace).toBeDefined();
      expect(trace.success).toBeDefined();
      expect(trace.apiCalls).toBeInstanceOf(Array);
    });
  });
});