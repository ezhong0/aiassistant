/**
 * Component Tests for AI Response Evaluator
 * Tests the response evaluation functionality in isolation
 */

import { AIResponseEvaluator, ResponseEvaluation } from '../ai/response-evaluator';
import { ExecutionTrace } from '../framework/master-agent-executor';
import { TestScenario } from '../ai/scenario-generator';
import { GenericAIService } from '../../../src/services/generic-ai.service';
import { serviceManager } from '../../../src/services/service-manager';

describe('AI Response Evaluator Component Tests', () => {
  let responseEvaluator: AIResponseEvaluator;
  let aiService: GenericAIService;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.E2E_TESTING = 'true';
    
    // Initialize test services with mocks
    const { initializeTestServices } = await import('../../../src/services/test-service-initialization');
    await initializeTestServices();
    
    aiService = serviceManager.getService<GenericAIService>('genericAIService')!;
    expect(aiService).toBeDefined();
  });

  beforeEach(() => {
    responseEvaluator = new AIResponseEvaluator(aiService);
  });

  describe('Evaluation Structure', () => {
    test('should generate evaluation with correct structure', async () => {
      const scenario: TestScenario = {
        id: 'test_scenario_1',
        userInput: 'Send an email to john@example.com about the meeting',
        expectedActions: ['compose_email', 'send_email'],
        expectedApiCalls: ['gmail_send'],
        complexity: 'simple',
        category: 'email',
        description: 'Simple email sending scenario'
      };

      const trace: ExecutionTrace = {
        testScenarioId: 'test_trace_1',
        userInput: scenario.userInput,
        sessionId: 'test_session',
        startTime: new Date(),
        success: true,
        apiCalls: [
          {
            timestamp: new Date(),
            clientName: 'GoogleAPIClient',
            endpoint: '/gmail/v1/users/me/messages/send',
            method: 'POST',
            request: {},
            response: { success: true },
            duration: 500,
            success: true
          }
        ],
        performance: {
          totalApiCalls: 1,
          totalApiDuration: 500,
          averageApiCallDuration: 500,
          totalIterations: 1,
          averageIterationDuration: 1000
        },
        stages: {},
        agentExecutions: []
      };

      const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

      expect(evaluation).toBeDefined();
      expect(evaluation.scenarioId).toBe(scenario.id);
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.overallScore).toBeLessThanOrEqual(100);
      expect(typeof evaluation.responseAppropriate).toBe('boolean');
      expect(typeof evaluation.expectedToolsUsed).toBe('boolean');
      expect(evaluation.detailedScores).toBeDefined();
      expect(evaluation.detailedScores.responseQuality).toBeGreaterThanOrEqual(0);
      expect(evaluation.detailedScores.responseQuality).toBeLessThanOrEqual(100);
      expect(evaluation.detailedScores.toolCompleteness).toBeGreaterThanOrEqual(0);
      expect(evaluation.detailedScores.toolCompleteness).toBeLessThanOrEqual(100);
      expect(evaluation.detailedScores.workflowEfficiency).toBeGreaterThanOrEqual(0);
      expect(evaluation.detailedScores.workflowEfficiency).toBeLessThanOrEqual(100);
      expect(evaluation.detailedScores.errorHandling).toBeGreaterThanOrEqual(0);
      expect(evaluation.detailedScores.errorHandling).toBeLessThanOrEqual(100);
      expect(evaluation.findings).toBeDefined();
      expect(evaluation.findings.strengths).toBeInstanceOf(Array);
      expect(evaluation.findings.weaknesses).toBeInstanceOf(Array);
      expect(evaluation.findings.missingTools).toBeInstanceOf(Array);
      expect(evaluation.findings.unexpectedTools).toBeInstanceOf(Array);
      expect(evaluation.findings.recommendations).toBeInstanceOf(Array);
      expect(evaluation.intermediateResponseScores).toBeInstanceOf(Array);
      expect(evaluation.finalVerdict).toBeDefined();
      expect(typeof evaluation.finalVerdict.passed).toBe('boolean');
      expect(evaluation.finalVerdict.reason).toBeDefined();
      expect(evaluation.finalVerdict.confidence).toBeGreaterThanOrEqual(0);
      expect(evaluation.finalVerdict.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('Successful Execution Evaluation', () => {
    test('should evaluate successful execution positively', async () => {
      const scenario: TestScenario = {
        id: 'test_success_1',
        userInput: 'Send an email to john@example.com about the meeting',
        expectedActions: ['compose_email', 'send_email'],
        expectedApiCalls: ['gmail_send'],
        complexity: 'simple',
        category: 'email',
        description: 'Simple email sending scenario'
      };

      const trace: ExecutionTrace = {
        testScenarioId: 'test_success_trace',
        userInput: scenario.userInput,
        sessionId: 'test_session',
        startTime: new Date(),
        success: true,
        finalResult: {
          message: 'Email sent successfully to john@example.com',
          success: true,
          metadata: { processingTime: 1000 }
        },
        apiCalls: [
          {
            timestamp: new Date(),
            clientName: 'GoogleAPIClient',
            endpoint: '/gmail/v1/users/me/messages/send',
            method: 'POST',
            request: {},
            response: { success: true },
            duration: 500,
            success: true
          }
        ],
        performance: {
          totalApiCalls: 1,
          totalApiDuration: 500,
          averageApiCallDuration: 500,
          totalIterations: 1,
          averageIterationDuration: 1000
        },
        stages: {},
        agentExecutions: []
      };

      const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

      expect(evaluation.overallScore).toBeGreaterThan(50);
      expect(evaluation.responseAppropriate).toBe(true);
      expect(evaluation.expectedToolsUsed).toBe(true);
      expect(evaluation.finalVerdict.passed).toBe(true);
      expect(evaluation.finalVerdict.confidence).toBeGreaterThan(70);
    });
  });

  describe('Failed Execution Evaluation', () => {
    test('should evaluate failed execution appropriately', async () => {
      const scenario: TestScenario = {
        id: 'test_failure_1',
        userInput: 'Send an email to john@example.com about the meeting',
        expectedActions: ['compose_email', 'send_email'],
        expectedApiCalls: ['gmail_send'],
        complexity: 'simple',
        category: 'email',
        description: 'Simple email sending scenario'
      };

      const trace: ExecutionTrace = {
        testScenarioId: 'test_failure_trace',
        userInput: scenario.userInput,
        sessionId: 'test_session',
        startTime: new Date(),
        success: false,
        error: 'Failed to send email: Invalid recipient',
        finalResult: {
          message: 'I encountered an error while sending the email',
          success: false,
          metadata: { processingTime: 500 }
        },
        apiCalls: [],
        performance: {
          totalApiCalls: 0,
          totalApiDuration: 0,
          averageApiCallDuration: 0,
          totalIterations: 1,
          averageIterationDuration: 500
        },
        stages: {},
        agentExecutions: []
      };

      const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

      expect(evaluation.overallScore).toBeLessThan(70);
      expect(evaluation.responseAppropriate).toBe(false);
      expect(evaluation.expectedToolsUsed).toBe(false);
      expect(evaluation.finalVerdict.passed).toBe(false);
      expect(evaluation.finalVerdict.confidence).toBeLessThan(80);
    });
  });

  describe('Edge Case Evaluation', () => {
    test('should handle edge cases appropriately', async () => {
      const scenario: TestScenario = {
        id: 'test_edge_1',
        userInput: 'Do something with the thing',
        expectedActions: ['request_clarification'],
        expectedApiCalls: [],
        complexity: 'complex',
        category: 'multi-domain',
        description: 'Extremely vague request requiring clarification'
      };

      const trace: ExecutionTrace = {
        testScenarioId: 'test_edge_trace',
        userInput: scenario.userInput,
        sessionId: 'test_session',
        startTime: new Date(),
        success: true,
        finalResult: {
          message: 'I need more information to help you. Could you please clarify what you would like me to do?',
          success: true,
          metadata: { processingTime: 800 }
        },
        apiCalls: [],
        performance: {
          totalApiCalls: 0,
          totalApiDuration: 0,
          averageApiCallDuration: 0,
          totalIterations: 1,
          averageIterationDuration: 800
        },
        stages: {},
        agentExecutions: []
      };

      const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

      expect(evaluation).toBeDefined();
      expect(evaluation.scenarioId).toBe(scenario.id);
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.overallScore).toBeLessThanOrEqual(100);
      expect(evaluation.finalVerdict).toBeDefined();
    });
  });

  describe('Fallback Evaluation', () => {
    test('should provide fallback evaluation when AI evaluation fails', async () => {
      // Create a mock AI service that always fails
      const mockAiService = {
        executePrompt: async () => {
          throw new Error('AI service unavailable');
        }
      } as any;

      const fallbackEvaluator = new AIResponseEvaluator(mockAiService);

      const scenario: TestScenario = {
        id: 'test_fallback_1',
        userInput: 'Send an email to john@example.com',
        expectedActions: ['send_email'],
        expectedApiCalls: ['gmail_send'],
        complexity: 'simple',
        category: 'email',
        description: 'Simple email scenario'
      };

      const trace: ExecutionTrace = {
        testScenarioId: 'test_fallback_trace',
        userInput: scenario.userInput,
        sessionId: 'test_session',
        startTime: new Date(),
        success: true,
        apiCalls: [
          {
            timestamp: new Date(),
            clientName: 'GoogleAPIClient',
            endpoint: '/gmail/v1/users/me/messages/send',
            method: 'POST',
            request: {},
            response: { success: true },
            duration: 500,
            success: true
          }
        ],
        performance: {
          totalApiCalls: 1,
          totalApiDuration: 500,
          averageApiCallDuration: 500,
          totalIterations: 1,
          averageIterationDuration: 1000
        },
        stages: {},
        agentExecutions: []
      };

      const evaluation = await fallbackEvaluator.evaluateExecution(scenario, trace);

      expect(evaluation).toBeDefined();
      expect(evaluation.scenarioId).toBe(scenario.id);
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.overallScore).toBeLessThanOrEqual(100);
      expect(evaluation.finalVerdict).toBeDefined();
      expect(evaluation.finalVerdict.reason).toContain('Fallback evaluation');
    });
  });

  describe('Evaluation Report Generation', () => {
    test('should generate comprehensive evaluation report', async () => {
      const evaluations: ResponseEvaluation[] = [
        {
          scenarioId: 'email_simple_1',
          overallScore: 85,
          responseAppropriate: true,
          expectedToolsUsed: true,
          detailedScores: {
            responseQuality: 90,
            toolCompleteness: 80,
            workflowEfficiency: 85,
            errorHandling: 85
          },
          findings: {
            strengths: ['Good response quality', 'Appropriate tool usage'],
            weaknesses: ['Could be more efficient'],
            missingTools: [],
            unexpectedTools: [],
            recommendations: ['Optimize workflow efficiency']
          },
          intermediateResponseScores: [],
          finalVerdict: {
            passed: true,
            reason: 'Test passed with good overall score',
            confidence: 90
          }
        },
        {
          scenarioId: 'calendar_medium_1',
          overallScore: 60,
          responseAppropriate: false,
          expectedToolsUsed: false,
          detailedScores: {
            responseQuality: 50,
            toolCompleteness: 40,
            workflowEfficiency: 70,
            errorHandling: 80
          },
          findings: {
            strengths: ['Good error handling'],
            weaknesses: ['Poor response quality', 'Missing expected tools'],
            missingTools: ['calendar_create'],
            unexpectedTools: [],
            recommendations: ['Improve response quality', 'Use expected tools']
          },
          intermediateResponseScores: [],
          finalVerdict: {
            passed: false,
            reason: 'Test failed due to poor response quality and missing tools',
            confidence: 75
          }
        }
      ];

      const report = responseEvaluator.generateEvaluationReport(evaluations);

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('AI-Powered E2E Testing Evaluation Report');
      expect(report).toContain('Overall Results');
      expect(report).toContain('Total Scenarios: 2');
      expect(report).toContain('Passed: 1');
      expect(report).toContain('Average Score: 72.5');
      expect(report).toContain('Category Breakdown');
      expect(report).toContain('Top Issues Found');
    });

    test('should handle empty evaluations list', async () => {
      const report = responseEvaluator.generateEvaluationReport([]);

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('Total Scenarios: 0');
    });
  });

  describe('Performance', () => {
    test('should evaluate within reasonable time', async () => {
      const scenario: TestScenario = {
        id: 'test_performance_1',
        userInput: 'Send an email to john@example.com about the meeting',
        expectedActions: ['compose_email', 'send_email'],
        expectedApiCalls: ['gmail_send'],
        complexity: 'simple',
        category: 'email',
        description: 'Simple email sending scenario'
      };

      const trace: ExecutionTrace = {
        testScenarioId: 'test_performance_trace',
        userInput: scenario.userInput,
        sessionId: 'test_session',
        startTime: new Date(),
        success: true,
        apiCalls: [
          {
            timestamp: new Date(),
            clientName: 'GoogleAPIClient',
            endpoint: '/gmail/v1/users/me/messages/send',
            method: 'POST',
            request: {},
            response: { success: true },
            duration: 500,
            success: true
          }
        ],
        performance: {
          totalApiCalls: 1,
          totalApiDuration: 500,
          averageApiCallDuration: 500,
          totalIterations: 1,
          averageIterationDuration: 1000
        },
        stages: {},
        agentExecutions: []
      };

      const startTime = Date.now();
      const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);
      const duration = Date.now() - startTime;

      expect(evaluation).toBeDefined();
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});
