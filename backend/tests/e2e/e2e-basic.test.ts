/**
 * Basic E2E Tests
 * Validates the AI-powered end-to-end testing system
 */

import { MasterAgentExecutor, ExecutionTrace } from './framework/master-agent-executor';
import { ApiMockManager } from './framework/api-mock-manager';

describe('AI-Powered E2E Testing System', () => {
  let executor: MasterAgentExecutor;
  let mockManager: ApiMockManager;

  beforeAll(async () => {
    // Verify E2E testing environment
    expect(process.env.E2E_TESTING).toBe('true');

    // Initialize components
    executor = new MasterAgentExecutor();
    mockManager = ApiMockManager.getInstance();
  });

  beforeEach(() => {
    // Set up mock context for each test
    mockManager.setMockContext({
      testScenarioId: expect.getState().currentTestName,
      userId: 'test_user_123',
      userEmail: 'test@example.com',
      currentTime: new Date('2025-01-15T10:00:00Z'),
      slackUserId: 'U123TEST',
      slackTeamId: 'T123TEST',
      slackChannelId: 'C123TEST'
    });
  });

  afterEach(async () => {
    // Cleanup after each test
    await executor.cleanup();
  });

  describe('Basic Workflow Execution', () => {
    test('should execute simple email request with API mocking', async () => {
      // Arrange
      const userInput = 'Send an email to john@example.com saying "Meeting confirmed for tomorrow at 2pm"';
      const sessionId = 'test_session_email';
      const userId = 'test_user_123';

      // Act
      const trace: ExecutionTrace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined, // No Slack context for this test
        'test_simple_email'
      );

      // Assert - Execution Success
      expect(trace.success).toBe(true);
      expect(trace.finalResult).toBeDefined();
      expect(trace.finalResult?.success).toBe(true);
      expect(trace.error).toBeUndefined();

      // Assert - API Calls Made
      expect(trace.apiCalls.length).toBeGreaterThan(0);

      // Should have made OpenAI calls for processing
      const openAiCalls = trace.apiCalls.filter(call => call.clientName === 'OpenAIClient');
      expect(openAiCalls.length).toBeGreaterThan(0);

      // Should have made Gmail API calls for sending email
      const gmailCalls = trace.apiCalls.filter(call =>
        call.clientName === 'GoogleAPIClient' &&
        call.endpoint.includes('/gmail/')
      );
      expect(gmailCalls.length).toBeGreaterThan(0);

      // Assert - Performance Metrics
      expect(trace.totalDuration).toBeLessThan(30000); // Should complete in < 30 seconds
      expect(trace.performance.totalApiCalls).toBeGreaterThan(0);
      expect(trace.performance.averageApiCallDuration).toBeLessThan(5000); // < 5 seconds per call

      // Assert - Response Quality
      expect(trace.finalResult?.message).toBeDefined();
      expect(trace.finalResult?.message.length).toBeGreaterThan(10); // Non-trivial response

      console.log('✅ Email Test Summary:', executor.getExecutionSummary(trace));
    }, 30000);

    test('should execute calendar scheduling request', async () => {
      // Arrange
      const userInput = 'Schedule a meeting with Sarah tomorrow at 3pm for project review';
      const sessionId = 'test_session_calendar';
      const userId = 'test_user_123';

      // Act
      const trace: ExecutionTrace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        undefined,
        'test_calendar_scheduling'
      );

      // Assert - Execution Success
      expect(trace.success).toBe(true);
      expect(trace.finalResult?.success).toBe(true);

      // Assert - Calendar API Calls
      const calendarCalls = trace.apiCalls.filter(call =>
        call.clientName === 'GoogleAPIClient' &&
        call.endpoint.includes('/calendar/')
      );
      expect(calendarCalls.length).toBeGreaterThan(0);

      // Assert - AI Processing Calls
      const aiCalls = trace.apiCalls.filter(call => call.clientName === 'OpenAIClient');
      expect(aiCalls.length).toBeGreaterThan(0);

      // Assert - Performance
      expect(trace.totalDuration).toBeLessThan(25000);
      expect(trace.performance.totalIterations).toBeLessThanOrEqual(10); // Within iteration limit

      console.log('✅ Calendar Test Summary:', executor.getExecutionSummary(trace));
    }, 30000);

    test('should execute Slack messaging with context', async () => {
      // Arrange
      const userInput = 'Send a message to the team channel about tomorrow\'s standup being moved to 10am';
      const sessionId = 'test_session_slack';
      const userId = 'test_user_123';
      const slackContext = {
        userId: 'U123TEST',
        channelId: 'C123TEST',
        teamId: 'T123TEST',
        isDirectMessage: false
      };

      // Act
      const trace: ExecutionTrace = await executor.executeWithTracing(
        userInput,
        sessionId,
        userId,
        slackContext,
        'test_slack_messaging'
      );

      // Assert - Execution Success
      expect(trace.success).toBe(true);
      expect(trace.finalResult?.success).toBe(true);

      // Assert - Slack API Calls
      const slackCalls = trace.apiCalls.filter(call => call.clientName === 'SlackAPIClient');
      expect(slackCalls.length).toBeGreaterThan(0);

      // Should include message posting
      const postMessageCalls = slackCalls.filter(call =>
        call.endpoint === '/chat.postMessage'
      );
      expect(postMessageCalls.length).toBeGreaterThan(0);

      // Assert - Performance
      expect(trace.totalDuration).toBeLessThan(20000);

      console.log('✅ Slack Test Summary:', executor.getExecutionSummary(trace));
    }, 30000);
  });

  describe('API Mocking Validation', () => {
    test('should intercept and mock all API calls', async () => {
      // Arrange
      const userInput = 'Find my emails about project proposal and create a calendar event to discuss them';
      const sessionId = 'test_session_multi_api';

      // Act
      const trace: ExecutionTrace = await executor.executeWithTracing(
        userInput,
        sessionId,
        'test_user_123',
        undefined,
        'test_api_mocking'
      );

      // Assert - Multiple API Types Called
      const apiClientTypes = new Set(trace.apiCalls.map(call => call.clientName));

      expect(apiClientTypes.has('OpenAIClient')).toBe(true); // AI processing
      expect(apiClientTypes.has('GoogleAPIClient')).toBe(true); // Gmail + Calendar

      // Assert - All Calls Were Mocked
      trace.apiCalls.forEach(call => {
        expect(call.response).toBeDefined();
        expect(call.response.metadata.requestId).toContain('mock');
        expect(call.duration).toBeGreaterThan(0);
        expect(call.duration).toBeLessThan(10000); // Mocked calls should be fast
      });

      // Assert - Realistic Response Times
      const googleCalls = trace.apiCalls.filter(call => call.clientName === 'GoogleAPIClient');
      const slackCalls = trace.apiCalls.filter(call => call.clientName === 'SlackAPIClient');
      const openAiCalls = trace.apiCalls.filter(call => call.clientName === 'OpenAIClient');

      // Google API calls should be 100-500ms
      googleCalls.forEach(call => {
        expect(call.duration).toBeGreaterThan(50);
        expect(call.duration).toBeLessThan(1000);
      });

      // OpenAI calls should be longer (1-3 seconds)
      openAiCalls.forEach(call => {
        expect(call.duration).toBeGreaterThan(500);
        expect(call.duration).toBeLessThan(5000);
      });

      console.log('✅ API Mocking Validation:', {
        totalCalls: trace.apiCalls.length,
        clientTypes: Array.from(apiClientTypes),
        avgDuration: trace.performance.averageApiCallDuration
      });
    }, 30000);
  });

  describe('Performance Benchmarking', () => {
    test('should meet performance benchmarks', async () => {
      // Arrange
      const userInput = 'Send a quick email to the team about the meeting';
      const sessionId = 'test_session_performance';

      // Act
      const trace: ExecutionTrace = await executor.executeWithTracing(
        userInput,
        sessionId,
        'test_user_123',
        undefined,
        'test_performance'
      );

      // Assert - Performance Benchmarks (from design document)

      // Total processing time should be < 15 seconds (acceptable threshold)
      expect(trace.totalDuration).toBeLessThan(15000);

      // Should not exceed 10 iterations (system limit)
      expect(trace.performance.totalIterations).toBeLessThanOrEqual(10);

      // Average API call duration should be reasonable
      expect(trace.performance.averageApiCallDuration).toBeLessThan(3000);

      // Should have made reasonable number of API calls (not excessive)
      expect(trace.performance.totalApiCalls).toBeLessThan(20);

      // API calls should be efficient (total API time < total processing time)
      expect(trace.performance.totalApiDuration).toBeLessThan(trace.totalDuration!);

      console.log('✅ Performance Metrics:', {
        totalDuration: trace.totalDuration,
        iterations: trace.performance.totalIterations,
        apiCalls: trace.performance.totalApiCalls,
        avgApiDuration: trace.performance.averageApiCallDuration
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      // Arrange - Intentionally vague/problematic input
      const userInput = 'Do something with stuff';
      const sessionId = 'test_session_error';

      // Act
      const trace: ExecutionTrace = await executor.executeWithTracing(
        userInput,
        sessionId,
        'test_user_123',
        undefined,
        'test_error_handling'
      );

      // Assert - Should complete even with vague input
      expect(trace.totalDuration).toBeDefined();
      expect(trace.apiCalls.length).toBeGreaterThan(0); // Should still make some API calls

      // Should have a response (even if it's asking for clarification)
      expect(trace.finalResult?.message).toBeDefined();

      console.log('✅ Error Handling Test:', {
        success: trace.success,
        hasResponse: !!trace.finalResult?.message,
        apiCalls: trace.apiCalls.length
      });
    }, 30000);
  });
});

// Helper function to validate execution trace structure
function validateExecutionTrace(trace: ExecutionTrace): void {
  expect(trace.testScenarioId).toBeDefined();
  expect(trace.userInput).toBeDefined();
  expect(trace.sessionId).toBeDefined();
  expect(trace.startTime).toBeInstanceOf(Date);
  expect(trace.success).toBeDefined();
  expect(trace.apiCalls).toBeInstanceOf(Array);
  expect(trace.performance).toBeDefined();
  expect(trace.performance.totalApiCalls).toBeGreaterThanOrEqual(0);
}