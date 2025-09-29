/**
 * AI-Powered Response Evaluator
 * Analyzes execution traces to determine response quality and completeness
 */

import { GenericAIService } from '../../../src/services/generic-ai.service';
import { ExecutionTrace } from '../framework/master-agent-executor';
import { TestScenario } from './scenario-generator';
import logger from '../../../src/utils/logger';

export interface ResponseEvaluation {
  scenarioId: string;
  overallScore: number; // 0-100
  responseAppropriate: boolean;
  expectedToolsUsed: boolean;
  detailedScores: {
    responseQuality: number; // 0-100
    toolCompleteness: number; // 0-100
    workflowEfficiency: number; // 0-100
    errorHandling: number; // 0-100
  };
  findings: {
    strengths: string[];
    weaknesses: string[];
    missingTools: string[];
    unexpectedTools: string[];
    recommendations: string[];
  };
  intermediateResponseScores: {
    stage: string;
    score: number;
    feedback: string;
  }[];
  finalVerdict: {
    passed: boolean;
    reason: string;
    confidence: number; // 0-100
  };
}

/**
 * AI-powered response evaluator
 */
export class AIResponseEvaluator {
  private aiService: GenericAIService;

  constructor(aiService: GenericAIService) {
    this.aiService = aiService;
  }

  /**
   * Evaluate a complete execution trace against expected scenario
   */
  async evaluateExecution(
    scenario: TestScenario,
    trace: ExecutionTrace
  ): Promise<ResponseEvaluation> {
    logger.info('Starting AI-powered execution evaluation', {
      operation: 'ai_response_evaluation',
      scenarioId: scenario.id,
      traceSuccess: trace.success,
      totalApiCalls: trace.apiCalls.length
    });

    try {
      // Main evaluation using AI
      const evaluation = await this.performAIEvaluation(scenario, trace);

      // Add intermediate response scores
      evaluation.intermediateResponseScores = await this.evaluateIntermediateResponses(trace);

      // Final verdict determination
      evaluation.finalVerdict = this.determineFinalVerdict(evaluation, scenario, trace);

      logger.info('AI evaluation completed', {
        operation: 'ai_response_evaluation_complete',
        scenarioId: scenario.id,
        overallScore: evaluation.overallScore || 0,
        passed: evaluation.finalVerdict?.passed || false
      });

      return evaluation;

    } catch (error) {
      logger.error('AI evaluation failed', error as Error, {
        scenarioId: scenario.id,
        traceId: trace.testScenarioId
      });

      // Return fallback evaluation
      return this.getFallbackEvaluation(scenario, trace);
    }
  }

  /**
   * Perform comprehensive AI evaluation
   */
  private async performAIEvaluation(
    scenario: TestScenario,
    trace: ExecutionTrace
  ): Promise<ResponseEvaluation> {
    const evaluationPrompt = this.buildEvaluationPrompt(scenario, trace);

    const response = await this.aiService.executePrompt({
      systemPrompt: 'You are an expert AI system evaluator. Analyze AI assistant executions and provide comprehensive evaluations.',
      userPrompt: evaluationPrompt
    }, {
      type: 'object',
      properties: {
        overallScore: { type: 'number', minimum: 0, maximum: 100 },
        responseAppropriate: { type: 'boolean' },
        expectedToolsUsed: { type: 'boolean' },
        detailedScores: {
          type: 'object',
          properties: {
            responseQuality: { type: 'number', minimum: 0, maximum: 100 },
            toolCompleteness: { type: 'number', minimum: 0, maximum: 100 },
            workflowEfficiency: { type: 'number', minimum: 0, maximum: 100 },
            errorHandling: { type: 'number', minimum: 0, maximum: 100 }
          },
          required: ['responseQuality', 'toolCompleteness', 'workflowEfficiency', 'errorHandling']
        },
        findings: {
          type: 'object',
          properties: {
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            missingTools: { type: 'array', items: { type: 'string' } },
            unexpectedTools: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          },
          required: ['strengths', 'weaknesses', 'missingTools', 'unexpectedTools', 'recommendations']
        }
      },
      required: ['overallScore', 'responseAppropriate', 'expectedToolsUsed', 'detailedScores', 'findings']
    });

    // Handle case where AI service returns undefined or invalid response
    if (!response || !response.parsed) {
      logger.warn('AI service returned invalid response for evaluation, using fallback', {
        response: response ? JSON.stringify(response).substring(0, 200) : 'undefined'
      });
      return this.getFallbackEvaluation(scenario, trace);
    }

    // Safely extract parsed response with fallbacks
    const parsed = response.parsed;
    
    // Additional validation for parsed response structure
    if (!parsed || typeof parsed !== 'object') {
      logger.warn('Parsed response is invalid, using fallback', {
        parsed: parsed ? JSON.stringify(parsed).substring(0, 200) : 'undefined'
      });
      return this.getFallbackEvaluation(scenario, trace);
    }
    
    return {
      scenarioId: scenario.id,
      overallScore: parsed.overallScore || 0,
      responseAppropriate: parsed.responseAppropriate || false,
      expectedToolsUsed: parsed.expectedToolsUsed || false,
      detailedScores: parsed.detailedScores || {
        responseQuality: 0,
        toolCompleteness: 0,
        workflowEfficiency: 0,
        errorHandling: 0
      },
      findings: parsed.findings || {
        strengths: [],
        weaknesses: [],
        missingTools: [],
        unexpectedTools: [],
        recommendations: []
      },
      intermediateResponseScores: [], // Will be filled separately
      finalVerdict: { // Will be determined separately
        passed: false,
        reason: '',
        confidence: 0
      }
    };
  }

  /**
   * Build comprehensive evaluation prompt
   */
  private buildEvaluationPrompt(scenario: TestScenario, trace: ExecutionTrace): string {
    const apiCallsSummary = trace.apiCalls.map(call =>
      `${call.clientName}: ${call.endpoint} (${call.method})`
    ).join(', ');

    const expectedApiCallsStr = scenario.expectedApiCalls?.join(', ') || 'N/A';
    const expectedActionsStr = scenario.expectedActions?.join(', ') || 'N/A';

    return `
You are an expert AI system evaluator. Analyze this AI assistant execution and provide a comprehensive evaluation.

## Original User Request
"${scenario.userInput}"

## Expected Behavior
- Expected Actions: ${expectedActionsStr}
- Expected API Calls: ${expectedApiCallsStr}
- Complexity: ${scenario.complexity}
- Category: ${scenario.category}

## Actual Execution Results
- Success: ${trace.success}
- Total Duration: ${trace.totalDuration}ms
- Total API Calls: ${trace.apiCalls.length}
- Actual API Calls Made: ${apiCallsSummary}
- Final Response: ${trace.finalResult?.message || 'No response'}
- Error (if any): ${trace.error || 'None'}

## Performance Metrics
- Total Iterations: ${trace.performance.totalIterations}
- Average API Duration: ${trace.performance.averageApiCallDuration}ms
- Total API Calls: ${trace.performance.totalApiCalls}

## Key Evaluation Questions

1. **Response Appropriateness**: Does the final response appropriately address the user's request?
2. **Tool Completeness**: Were all expected tools/API calls used? Any important ones missing?
3. **Workflow Efficiency**: Was the execution efficient? Any unnecessary steps or calls?
4. **Error Handling**: If there were errors, were they handled appropriately?

## Evaluation Criteria

**Response Quality (0-100)**:
- Relevance to user request
- Completeness of answer
- Clarity and helpfulness
- Appropriate tone and context

**Tool Completeness (0-100)**:
- All expected API calls made
- No critical tools missing
- Appropriate tool selection
- Tools used in logical order

**Workflow Efficiency (0-100)**:
- Minimal unnecessary API calls
- Reasonable execution time
- Logical step progression
- No redundant operations

**Error Handling (0-100)**:
- Graceful failure handling
- Appropriate error responses
- Recovery attempts when possible
- Clear error communication

## Output Requirements

Provide:
- overallScore: Overall score 0-100
- responseAppropriate: Boolean - is the response suitable for the request?
- expectedToolsUsed: Boolean - were the expected tools used?
- detailedScores: Object with the four scores above
- findings: Object with strengths, weaknesses, missingTools, unexpectedTools, recommendations arrays

Be objective and thorough in your analysis.
    `;
  }

  /**
   * Evaluate intermediate AI responses in the workflow
   */
  private async evaluateIntermediateResponses(trace: ExecutionTrace): Promise<{
    stage: string;
    score: number;
    feedback: string;
  }[]> {
    // This would analyze each stage's AI responses
    // For now, return a simplified version based on execution success
    const scores = [];

    if (trace.stages?.situationAnalysis) {
      scores.push({
        stage: 'situationAnalysis',
        score: trace.success ? 85 : 50,
        feedback: trace.success ? 'Successfully analyzed situation' : 'Situation analysis had issues'
      });
    }

    if (trace.stages?.workflowPlanning) {
      scores.push({
        stage: 'workflowPlanning',
        score: trace.success ? 80 : 45,
        feedback: trace.success ? 'Workflow planning executed' : 'Workflow planning encountered problems'
      });
    }

    if (trace.stages?.workflowExecution) {
      scores.push({
        stage: 'workflowExecution',
        score: trace.success ? 90 : 40,
        feedback: trace.success ? 'Workflow executed successfully' : 'Workflow execution failed'
      });
    }

    return scores;
  }

  /**
   * Determine final verdict based on all evaluation factors
   */
  private determineFinalVerdict(
    evaluation: ResponseEvaluation,
    scenario: TestScenario,
    trace: ExecutionTrace
  ): { passed: boolean; reason: string; confidence: number } {
    const { overallScore, responseAppropriate, expectedToolsUsed, detailedScores } = evaluation;

    // Determine if test passes based on multiple criteria
    const passThreshold = 70;
    const minToolScore = 60;
    const minResponseScore = 65;

    let passed = true;
    let reasons: string[] = [];
    let confidence = 95;

    // Check overall score
    if (overallScore < passThreshold) {
      passed = false;
      reasons.push(`Overall score ${overallScore} below threshold ${passThreshold}`);
    }

    // Check response appropriateness
    if (!responseAppropriate) {
      passed = false;
      reasons.push('Response not appropriate for user request');
    }

    // Check tool completeness for non-edge cases
    if (!scenario.description?.includes('edge case') && !expectedToolsUsed) {
      passed = false;
      reasons.push('Expected tools not used');
    }

    // Check detailed scores
    if (detailedScores?.responseQuality && detailedScores.responseQuality < minResponseScore) {
      passed = false;
      reasons.push(`Response quality ${detailedScores.responseQuality} below minimum ${minResponseScore}`);
    }

    if (detailedScores?.toolCompleteness && detailedScores.toolCompleteness < minToolScore) {
      passed = false;
      reasons.push(`Tool completeness ${detailedScores.toolCompleteness} below minimum ${minToolScore}`);
    }

    // Adjust confidence based on various factors
    if (trace.apiCalls.length === 0 && (scenario.expectedApiCalls?.length || 0) > 0) {
      confidence -= 30;
    }

    if (!trace.success) {
      confidence -= 20;
    }

    if ((evaluation.findings?.weaknesses?.length || 0) > (evaluation.findings?.strengths?.length || 0)) {
      confidence -= 15;
    }

    const reason = passed
      ? `Test passed with overall score ${overallScore}`
      : `Test failed: ${reasons.join('; ')}`;

    return {
      passed,
      reason,
      confidence: Math.max(0, Math.min(100, confidence))
    };
  }

  /**
   * Fallback evaluation when AI evaluation fails
   */
  private getFallbackEvaluation(
    scenario: TestScenario,
    trace: ExecutionTrace
  ): ResponseEvaluation {
    const basicScore = trace.success ? 60 : 30;
    const hasApiCalls = trace.apiCalls.length > 0;
    const hasExpectedApiCalls = (scenario.expectedApiCalls?.length || 0) > 0;

    return {
      scenarioId: scenario.id,
      overallScore: basicScore,
      responseAppropriate: trace.success,
      expectedToolsUsed: hasApiCalls && hasExpectedApiCalls,
      detailedScores: {
        responseQuality: basicScore,
        toolCompleteness: hasApiCalls ? 70 : 40,
        workflowEfficiency: trace.success ? 65 : 35,
        errorHandling: trace.error ? 40 : 80
      },
      findings: {
        strengths: trace.success ? ['Execution completed'] : [],
        weaknesses: trace.error ? ['Execution failed'] : [],
        missingTools: hasExpectedApiCalls && !hasApiCalls ? (scenario.expectedApiCalls || []) : [],
        unexpectedTools: [],
        recommendations: ['AI evaluation failed, manual review recommended']
      },
      intermediateResponseScores: [{
        stage: 'fallback',
        score: basicScore,
        feedback: 'Fallback evaluation due to AI evaluation failure'
      }],
      finalVerdict: {
        passed: trace.success && hasApiCalls,
        reason: 'Fallback evaluation based on execution success and API calls',
        confidence: 50
      }
    };
  }

  /**
   * Generate evaluation report
   */
  generateEvaluationReport(evaluations: ResponseEvaluation[]): string {
    const totalScenarios = evaluations.length;
    const passedScenarios = evaluations.filter(e => e.finalVerdict?.passed).length;
    const averageScore = evaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) / totalScenarios;

    const categoryBreakdown = evaluations.reduce((acc, evaluation) => {
      const category = evaluation.scenarioId.split('_')[0];
      if (!acc[category]) acc[category] = { total: 0, passed: 0 };
      acc[category].total++;
      if (evaluation.finalVerdict?.passed) acc[category].passed++;
      return acc;
    }, {} as Record<string, { total: number; passed: number }>);

    let report = `# AI-Powered E2E Testing Evaluation Report\n\n`;
    report += `## Overall Results\n`;
    report += `- **Total Scenarios**: ${totalScenarios}\n`;
    report += `- **Passed**: ${passedScenarios} (${(passedScenarios/totalScenarios*100).toFixed(1)}%)\n`;
    report += `- **Average Score**: ${averageScore.toFixed(1)}/100\n\n`;

    report += `## Category Breakdown\n`;
    Object.entries(categoryBreakdown).forEach(([category, stats]) => {
      const passRate = (stats.passed / stats.total * 100).toFixed(1);
      report += `- **${category}**: ${stats.passed}/${stats.total} (${passRate}%)\n`;
    });

    report += `\n## Top Issues Found\n`;
    const allWeaknesses = evaluations.flatMap(e => e.findings?.weaknesses || []);
    const weaknessCount = allWeaknesses.reduce((acc, weakness) => {
      acc[weakness] = (acc[weakness] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(weaknessCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([weakness, count]) => {
        report += `- ${weakness} (${count} scenarios)\n`;
      });

    return report;
  }
}