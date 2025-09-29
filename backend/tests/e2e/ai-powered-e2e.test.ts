/**
 * AI-Powered End-to-End Testing
 * Complete implementation of AI-generated scenarios with AI-powered evaluation
 */

import { MasterAgentExecutor, ExecutionTrace } from './framework/master-agent-executor';
import { ApiMockManager } from './framework/api-mock-manager';
import { AITestScenarioGenerator, TestScenario } from './ai/scenario-generator';
import { AIResponseEvaluator, ResponseEvaluation } from './ai/response-evaluator';
import { serviceManager } from '../../src/services/service-manager';
import { GenericAIService } from '../../src/services/generic-ai.service';
import logger from '../../src/utils/logger';

describe('AI-Powered End-to-End Testing System', () => {
  let executor: MasterAgentExecutor;
  let mockManager: typeof ApiMockManager;
  let scenarioGenerator: AITestScenarioGenerator;
  let responseEvaluator: AIResponseEvaluator;
  let aiService: GenericAIService;

  beforeAll(async () => {
    // Verify E2E testing environment
    expect(process.env.E2E_TESTING).toBe('true');

    // Initialize components
    executor = new MasterAgentExecutor();
    mockManager = ApiMockManager;

    // Get AI service for scenario generation and evaluation
    aiService = serviceManager.getService<GenericAIService>('genericAIService')!;
    expect(aiService).toBeDefined();

    // Initialize AI-powered components
    scenarioGenerator = new AITestScenarioGenerator(aiService);
    responseEvaluator = new AIResponseEvaluator(aiService);

    logger.info('AI-Powered E2E Testing System initialized', {
      operation: 'ai_e2e_system_init'
    });
  });

  beforeEach(() => {
    // Set up mock context for each test
    mockManager.setMockContext({
      testScenarioId: expect.getState().currentTestName,
      userId: 'ai_test_user_123',
      userEmail: 'ai_test@example.com',
      currentTime: new Date('2025-01-15T10:00:00Z'),
      slackUserId: 'U123AITEST',
      slackTeamId: 'T123AITEST',
      slackChannelId: 'C123AITEST'
    });
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  describe('Complete AI-Powered Workflow', () => {
    test('should generate scenarios, execute workflows, and evaluate results using AI', async () => {
      // Step 1: Generate test scenarios using AI
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 5,
        categories: ['email', 'calendar', 'slack'],
        complexityLevels: ['simple', 'medium'],
        includeEdgeCases: true
      });

      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios.length).toBeLessThanOrEqual(5);

      const evaluations: ResponseEvaluation[] = [];

      // Step 2: Execute each scenario and evaluate with AI
      for (const scenario of scenarios) {
        logger.info('Executing AI-generated scenario', {
          operation: 'ai_scenario_execution',
          scenarioId: scenario.id,
          category: scenario.category,
          complexity: scenario.complexity,
          userInput: scenario.userInput.substring(0, 100)
        });

        // Execute the scenario through MasterAgent
        const trace: ExecutionTrace = await executor.executeWithTracing(
          scenario.userInput,
          `ai_session_${scenario.id}`,
          'ai_test_user_123',
          undefined,
          scenario.id
        );

        // Step 3: Evaluate the execution using AI
        const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);
        evaluations.push(evaluation);

        // Log evaluation results
        logger.info('AI evaluation completed for scenario', {
          operation: 'ai_scenario_evaluation',
          scenarioId: scenario.id,
          overallScore: evaluation.overallScore,
          passed: evaluation.finalVerdict.passed,
          confidence: evaluation.finalVerdict.confidence
        });
      }

      // Step 4: Analyze overall results
      const totalScenarios = evaluations.length;
      const passedScenarios = evaluations.filter(e => e.finalVerdict.passed).length;
      const averageScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0) / totalScenarios;

      // Generate comprehensive evaluation report
      const report = responseEvaluator.generateEvaluationReport(evaluations);

      console.log('\n' + '='.repeat(80));
      console.log('🤖 AI-POWERED E2E TESTING RESULTS');
      console.log('='.repeat(80));
      console.log(report);
      console.log('='.repeat(80));

      // Assert overall system performance
      expect(totalScenarios).toBeGreaterThan(0);
      expect(averageScore).toBeGreaterThan(40); // Minimum acceptable score
      expect(passedScenarios / totalScenarios).toBeGreaterThan(0.3); // At least 30% should pass

      // Detailed assertions on evaluations
      evaluations.forEach(evaluation => {
        expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
        expect(evaluation.overallScore).toBeLessThanOrEqual(100);
        expect(evaluation.detailedScores.responseQuality).toBeGreaterThanOrEqual(0);
        expect(evaluation.detailedScores.toolCompleteness).toBeGreaterThanOrEqual(0);
        expect(evaluation.detailedScores.workflowEfficiency).toBeGreaterThanOrEqual(0);
        expect(evaluation.detailedScores.errorHandling).toBeGreaterThanOrEqual(0);
        expect(evaluation.findings.strengths).toBeInstanceOf(Array);
        expect(evaluation.findings.weaknesses).toBeInstanceOf(Array);
        expect(evaluation.findings.missingTools).toBeInstanceOf(Array);
        expect(evaluation.findings.unexpectedTools).toBeInstanceOf(Array);
        expect(evaluation.findings.recommendations).toBeInstanceOf(Array);
        expect(evaluation.finalVerdict.confidence).toBeGreaterThanOrEqual(0);
        expect(evaluation.finalVerdict.confidence).toBeLessThanOrEqual(100);
      });

      // Log summary for CI/CD
      logger.info('AI-Powered E2E Testing Summary', {
        operation: 'ai_e2e_testing_complete',
        totalScenarios,
        passedScenarios,
        passRate: (passedScenarios / totalScenarios * 100).toFixed(1) + '%',
        averageScore: averageScore.toFixed(1),
        categories: [...new Set(scenarios.map(s => s.category))],
        complexityLevels: [...new Set(scenarios.map(s => s.complexity))]
      });
    }, 120000); // 2 minute timeout for complete AI workflow

    test('should evaluate response appropriateness for email scenarios', async () => {
      // Generate email-focused scenarios
      const emailScenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['email'],
        complexityLevels: ['simple', 'medium']
      });

      expect(emailScenarios.length).toBeGreaterThan(0);

      for (const scenario of emailScenarios) {
        const trace = await executor.executeWithTracing(
          scenario.userInput,
          `email_test_${Date.now()}`,
          'test_user_email',
          undefined,
          scenario.id
        );

        const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

        // Key assertions for email scenarios
        expect(evaluation.responseAppropriate).toBeDefined();
        expect(evaluation.expectedToolsUsed).toBeDefined();

        // If execution was successful, response should be appropriate
        if (trace.success) {
          expect(evaluation.overallScore).toBeGreaterThan(50);
        }

        // Log specific findings
        console.log(`\n📧 Email Scenario Evaluation:`);
        console.log(`  Input: "${scenario.userInput.substring(0, 60)}..."`);
        console.log(`  Score: ${evaluation.overallScore}/100`);
        console.log(`  Appropriate: ${evaluation.responseAppropriate}`);
        console.log(`  Tools Used: ${evaluation.expectedToolsUsed}`);
        console.log(`  Verdict: ${evaluation.finalVerdict.passed ? '✅ PASS' : '❌ FAIL'}`);

        if (evaluation.findings.recommendations.length > 0) {
          console.log(`  Recommendations:`);
          evaluation.findings.recommendations.forEach(rec => {
            console.log(`    - ${rec}`);
          });
        }
      }
    }, 90000);

    test('should evaluate tool completeness for multi-domain scenarios', async () => {
      // Generate complex multi-domain scenarios
      const multiDomainScenarios = await scenarioGenerator.generateScenarios({
        count: 2,
        categories: ['multi-domain'],
        complexityLevels: ['complex']
      });

      expect(multiDomainScenarios.length).toBeGreaterThan(0);

      for (const scenario of multiDomainScenarios) {
        const trace = await executor.executeWithTracing(
          scenario.userInput,
          `multi_domain_${Date.now()}`,
          'test_user_multi',
          undefined,
          scenario.id
        );

        const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

        // Multi-domain scenarios should test tool completeness
        expect(evaluation.detailedScores.toolCompleteness).toBeDefined();
        expect(evaluation.findings.missingTools).toBeInstanceOf(Array);
        expect(evaluation.findings.unexpectedTools).toBeInstanceOf(Array);

        console.log(`\n🔄 Multi-Domain Scenario Evaluation:`);
        console.log(`  Input: "${scenario.userInput.substring(0, 60)}..."`);
        console.log(`  Expected APIs: ${scenario.expectedApiCalls.join(', ')}`);
        console.log(`  Actual API Calls: ${trace.apiCalls.length}`);
        console.log(`  Tool Completeness: ${evaluation.detailedScores.toolCompleteness}/100`);

        if (evaluation.findings.missingTools.length > 0) {
          console.log(`  Missing Tools: ${evaluation.findings.missingTools.join(', ')}`);
        }

        if (evaluation.findings.unexpectedTools.length > 0) {
          console.log(`  Unexpected Tools: ${evaluation.findings.unexpectedTools.join(', ')}`);
        }
      }
    }, 90000);

    test('should handle edge cases with appropriate evaluation', async () => {
      // Generate edge case scenarios
      const edgeCaseScenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['multi-domain'],
        complexityLevels: ['complex'],
        includeEdgeCases: true
      });

      // Filter to only edge cases (they should be in the results)
      const actualEdgeCases = edgeCaseScenarios.filter(s =>
        s.description.toLowerCase().includes('edge') ||
        s.userInput.length < 20 ||
        s.expectedApiCalls.length === 0
      );

      if (actualEdgeCases.length === 0) {
        console.log('No edge cases generated, skipping edge case evaluation');
        return;
      }

      for (const scenario of actualEdgeCases) {
        const trace = await executor.executeWithTracing(
          scenario.userInput,
          `edge_case_${Date.now()}`,
          'test_user_edge',
          undefined,
          scenario.id
        );

        const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);

        // Edge cases should be evaluated with different criteria
        expect(evaluation.detailedScores.errorHandling).toBeDefined();

        console.log(`\n⚠️ Edge Case Evaluation:`);
        console.log(`  Input: "${scenario.userInput}"`);
        console.log(`  Description: ${scenario.description}`);
        console.log(`  Error Handling: ${evaluation.detailedScores.errorHandling}/100`);
        console.log(`  Final Verdict: ${evaluation.finalVerdict.reason}`);

        // Edge cases may fail execution but should handle errors gracefully
        if (!trace.success) {
          expect(evaluation.detailedScores.errorHandling).toBeGreaterThan(30);
        }
      }
    }, 90000);
  });

  describe('AI System Performance Metrics', () => {
    test('should track and report AI evaluation performance', async () => {
      const startTime = Date.now();

      // Generate a small set of scenarios for performance testing
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['email', 'calendar'],
        complexityLevels: ['simple']
      });

      const scenarioGenerationTime = Date.now() - startTime;

      // Execute and evaluate each scenario
      const evaluationTimes: number[] = [];
      for (const scenario of scenarios) {
        const executionStart = Date.now();

        const trace = await executor.executeWithTracing(
          scenario.userInput,
          `perf_test_${Date.now()}`,
          'test_user_perf'
        );

        const evaluationStart = Date.now();
        const evaluation = await responseEvaluator.evaluateExecution(scenario, trace);
        const evaluationTime = Date.now() - evaluationStart;

        evaluationTimes.push(evaluationTime);

        const totalTime = Date.now() - executionStart;

        logger.info('AI E2E Performance Metrics', {
          operation: 'ai_e2e_performance',
          scenarioId: scenario.id,
          executionTime: totalTime,
          evaluationTime,
          score: evaluation.overallScore
        });
      }

      const totalTime = Date.now() - startTime;
      const avgEvaluationTime = evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length;

      // Performance assertions
      expect(scenarioGenerationTime).toBeLessThan(30000); // < 30 seconds
      expect(avgEvaluationTime).toBeLessThan(15000); // < 15 seconds per evaluation
      expect(totalTime).toBeLessThan(120000); // < 2 minutes total

      console.log('\n📊 AI E2E Performance Report:');
      console.log(`  Scenario Generation: ${scenarioGenerationTime}ms`);
      console.log(`  Average Evaluation: ${avgEvaluationTime.toFixed(0)}ms`);
      console.log(`  Total Test Time: ${totalTime}ms`);
    }, 150000);
  });
});