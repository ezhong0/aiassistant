/**
 * AI Behavior Validation Framework
 * 
 * Core framework for testing AI behavior rather than code coverage.
 * Focuses on intelligence validation, workflow orchestration, and decision quality.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { MasterAgent } from '../../../src/agents/master.agent';
import { TestHelper } from '../../test-helper';

export interface IntentExpectation {
  userInput: string;
  expectedIntent: string;
  expectedAgents: string[];
  expectedParameters?: Record<string, any>;
  confidence?: 'high' | 'medium' | 'low';
  context?: string;
}

export interface WorkflowExpectation {
  name: string;
  scenario: string;
  steps: Array<{
    userInput: string;
    expectedAgents: string[];
    expectedOrder?: boolean;
    context?: Record<string, any>;
  }>;
  finalState?: Record<string, any>;
}

export interface ConversationTurn {
  userInput: string;
  expectedResponse: {
    agents: string[];
    contextRetained?: string[];
    newContext?: Record<string, any>;
  };
}

export interface ErrorScenario {
  name: string;
  failingComponent: string;
  userInput: string;
  expectedFallback: string[];
  expectedRecovery: boolean;
  gracefulDegradation: boolean;
}

export interface DecisionQualityMetric {
  scenario: string;
  userInput: string;
  expectedDecision: string;
  alternativeDecisions: string[];
  qualityFactors: string[];
}

/**
 * Core AI Behavior Validator
 */
export class AIBehaviorValidator {
  private masterAgent: MasterAgent;
  private conversationContext: Map<string, any> = new Map();

  constructor() {
    this.masterAgent = new MasterAgent({
      openaiApiKey: process.env.OPENAI_API_KEY || 'test-openai-key'
    });
  }

  /**
   * Initialize services for this validator
   */
  static async initializeServices(): Promise<void> {
    await TestHelper.initializeServices();
  }

  /**
   * Cleanup services for this validator
   */
  static async cleanupServices(): Promise<void> {
    await TestHelper.cleanupServices();
  }

  /**
   * Cleanup resources to prevent memory leaks
   */
  cleanup() {
    this.conversationContext.clear();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Validate that the AI correctly interprets user intent
   */
  async validateIntent(expectation: IntentExpectation): Promise<{
    success: boolean;
    actualAgents: string[];
    intentAccuracy: number;
    details: string;
  }> {
    const sessionId = `intent-test-${Date.now()}`;
    
    try {
      const response = await this.masterAgent.processUserInput(
        expectation.userInput, 
        sessionId
      );

      const actualAgents = response.toolCalls?.map(call => call.name) || [];
      
      // Calculate intent accuracy
      const expectedSet = new Set(expectation.expectedAgents);
      const actualSet = new Set(actualAgents);
      const intersection = new Set([...expectedSet].filter(x => actualSet.has(x)));
      const union = new Set([...expectedSet, ...actualAgents]);
      const intentAccuracy = intersection.size / union.size;

      const success = expectation.expectedAgents.every(agent => 
        actualAgents.includes(agent)
      );

      return {
        success,
        actualAgents,
        intentAccuracy,
        details: `Expected: [${expectation.expectedAgents.join(', ')}], Got: [${actualAgents.join(', ')}]`
      };
    } catch (error) {
      return {
        success: false,
        actualAgents: [],
        intentAccuracy: 0,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate multi-agent workflow orchestration
   */
  async validateWorkflow(workflow: WorkflowExpectation): Promise<{
    success: boolean;
    stepResults: Array<{
      step: number;
      success: boolean;
      agents: string[];
      details: string;
    }>;
    workflowCoherence: number;
  }> {
    const sessionId = `workflow-test-${Date.now()}`;
    const stepResults = [];
    let overallSuccess = true;
    let coherenceScore = 0;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (!step) continue;
      
      try {
        const response = await this.masterAgent.processUserInput(
          step.userInput,
          sessionId
        );

        const actualAgents = response.toolCalls?.map(call => call.name) || [];
        const stepSuccess = step.expectedAgents.every(agent => 
          actualAgents.includes(agent)
        );

        if (stepSuccess) {
          coherenceScore += 1;
        }

        stepResults.push({
          step: i + 1,
          success: stepSuccess,
          agents: actualAgents,
          details: `Expected: [${step.expectedAgents.join(', ')}], Got: [${actualAgents.join(', ')}]`
        });

        if (!stepSuccess) {
          overallSuccess = false;
        }

      } catch (error) {
        stepResults.push({
          step: i + 1,
          success: false,
          agents: [],
          details: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        overallSuccess = false;
      }
    }

    return {
      success: overallSuccess,
      stepResults,
      workflowCoherence: coherenceScore / workflow.steps.length
    };
  }

  /**
   * Validate conversation context continuity
   */
  async validateContextContinuity(
    sessionId: string,
    turns: ConversationTurn[]
  ): Promise<{
    success: boolean;
    contextRetention: number;
    turnResults: Array<{
      turn: number;
      success: boolean;
      contextScore: number;
      details: string;
    }>;
  }> {
    const turnResults = [];
    let totalContextScore = 0;
    let overallSuccess = true;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (!turn) continue;
      
      try {
        const response = await this.masterAgent.processUserInput(
          turn.userInput,
          sessionId
        );

        const actualAgents = response.toolCalls?.map(call => call.name) || [];
        const agentsMatch = turn.expectedResponse.agents.every(agent => 
          actualAgents.includes(agent)
        );

        // Context scoring (simplified - could be more sophisticated)
        let contextScore = agentsMatch ? 1.0 : 0.5;
        
        turnResults.push({
          turn: i + 1,
          success: agentsMatch,
          contextScore,
          details: `Expected agents: [${turn.expectedResponse.agents.join(', ')}], Got: [${actualAgents.join(', ')}]`
        });

        totalContextScore += contextScore;
        
        if (!agentsMatch) {
          overallSuccess = false;
        }

      } catch (error) {
        turnResults.push({
          turn: i + 1,
          success: false,
          contextScore: 0,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        overallSuccess = false;
      }
    }

    return {
      success: overallSuccess,
      contextRetention: totalContextScore / turns.length,
      turnResults
    };
  }

  /**
   * Validate error recovery and fallback behavior
   */
  async validateErrorRecovery(scenario: ErrorScenario): Promise<{
    success: boolean;
    fallbackTriggered: boolean;
    gracefulDegradation: boolean;
    details: string;
  }> {
    const sessionId = `error-test-${Date.now()}`;
    
    try {
      // TODO: Implement component failure simulation
      // For now, test with normal flow and check if fallback agents are available
      
      const response = await this.masterAgent.processUserInput(
        scenario.userInput,
        sessionId
      );

      const actualAgents = response.toolCalls?.map(call => call.name) || [];
      
      // Check if any fallback agents were used
      const fallbackTriggered = scenario.expectedFallback.some(fallback => 
        actualAgents.includes(fallback)
      );

      // For graceful degradation, we check if the system responded at all
      const gracefulDegradation = actualAgents.length > 0 && response.message.length > 0;

      return {
        success: fallbackTriggered || gracefulDegradation,
        fallbackTriggered,
        gracefulDegradation,
        details: `Agents used: [${actualAgents.join(', ')}], Message: "${response.message.substring(0, 100)}..."`
      };

    } catch (error) {
      return {
        success: false,
        fallbackTriggered: false,
        gracefulDegradation: false,
        details: `System failed ungracefully: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate decision quality and consistency
   */
  async validateDecisionQuality(metrics: DecisionQualityMetric[]): Promise<{
    overallQuality: number;
    consistency: number;
    decisions: Array<{
      scenario: string;
      decision: string;
      quality: number;
      rationale: string;
    }>;
  }> {
    const decisions = [];
    let totalQuality = 0;
    
    for (const metric of metrics) {
      const sessionId = `decision-test-${Date.now()}`;
      
      try {
        const response = await this.masterAgent.processUserInput(
          metric.userInput,
          sessionId
        );

        const actualAgents = response.toolCalls?.map(call => call.name) || [];
        const primaryAgent = actualAgents[0];
        
        // Quality scoring based on expected vs actual decision
        let quality = 0;
        if (primaryAgent === metric.expectedDecision) {
          quality = 1.0; // Perfect match
        } else if (primaryAgent && metric.alternativeDecisions.includes(primaryAgent)) {
          quality = 0.7; // Acceptable alternative
        } else {
          quality = 0.3; // Suboptimal but potentially valid
        }

        decisions.push({
          scenario: metric.scenario,
          decision: primaryAgent || 'none',
          quality,
          rationale: `Expected: ${metric.expectedDecision}, Got: ${primaryAgent}, Factors: [${metric.qualityFactors.join(', ')}]`
        });

        totalQuality += quality;

      } catch (error) {
        decisions.push({
          scenario: metric.scenario,
          decision: 'error',
          quality: 0,
          rationale: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    // Calculate consistency (how similar decisions are for similar scenarios)
    const consistency = this.calculateConsistency(decisions);

    return {
      overallQuality: totalQuality / metrics.length,
      consistency,
      decisions
    };
  }

  /**
   * Calculate decision consistency score
   */
  private calculateConsistency(decisions: Array<{scenario: string; decision: string; quality: number}>): number {
    if (decisions.length < 2) return 1.0;

    // Group similar scenarios and check if decisions are consistent
    const qualityVariance = decisions.reduce((sum, decision) => sum + Math.pow(decision.quality - 0.7, 2), 0) / decisions.length;
    return Math.max(0, 1 - qualityVariance);
  }

  /**
   * Generate comprehensive behavior report
   */
  generateBehaviorReport(results: {
    intentResults?: any[];
    workflowResults?: any[];
    contextResults?: any[];
    errorResults?: any[];
    decisionResults?: any;
  }): string {
    let report = "🧠 AI Behavior Validation Report\n";
    report += "=".repeat(50) + "\n\n";

    if (results.intentResults) {
      report += "📍 Intent Recognition:\n";
      const avgAccuracy = results.intentResults.reduce((sum, r) => sum + r.intentAccuracy, 0) / results.intentResults.length;
      report += `  Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%\n\n`;
    }

    if (results.workflowResults) {
      report += "🔄 Workflow Orchestration:\n";
      const avgCoherence = results.workflowResults.reduce((sum, r) => sum + r.workflowCoherence, 0) / results.workflowResults.length;
      report += `  Average Coherence: ${(avgCoherence * 100).toFixed(1)}%\n\n`;
    }

    if (results.contextResults) {
      report += "💭 Context Continuity:\n";
      const avgRetention = results.contextResults.reduce((sum, r) => sum + r.contextRetention, 0) / results.contextResults.length;
      report += `  Average Retention: ${(avgRetention * 100).toFixed(1)}%\n\n`;
    }

    if (results.decisionResults) {
      report += "🎯 Decision Quality:\n";
      report += `  Overall Quality: ${(results.decisionResults.overallQuality * 100).toFixed(1)}%\n`;
      report += `  Consistency: ${(results.decisionResults.consistency * 100).toFixed(1)}%\n\n`;
    }

    return report;
  }
}

/**
 * Helper function to create behavior test suites
 */
export function describeBehavior(
  suiteName: string,
  tests: () => void
): void {
  describe(`🧠 AI Behavior: ${suiteName}`, tests);
}

/**
 * Helper function for intent recognition tests
 */
export function itShouldUnderstand(
  description: string,
  expectation: IntentExpectation,
  validator: AIBehaviorValidator
): void {
  it(`should understand: ${description}`, async () => {
    const result = await validator.validateIntent(expectation);
    
    expect(result.success).toBe(true);
    expect(result.intentAccuracy).toBeGreaterThan(0.7); // 70% accuracy threshold
    
    if (!result.success) {
      console.log(`❌ Intent validation failed: ${result.details}`);
      console.log(`🎯 Accuracy: ${(result.intentAccuracy * 100).toFixed(1)}%`);
    }
  });
}

/**
 * Helper function for workflow validation tests
 */
export function itShouldOrchestrate(
  description: string,
  workflow: WorkflowExpectation,
  validator: AIBehaviorValidator
): void {
  it(`should orchestrate: ${description}`, async () => {
    const result = await validator.validateWorkflow(workflow);
    
    expect(result.success).toBe(true);
    expect(result.workflowCoherence).toBeGreaterThan(0.8); // 80% coherence threshold
    
    if (!result.success) {
      console.log(`❌ Workflow validation failed`);
      result.stepResults.forEach(step => {
        if (!step.success) {
          console.log(`  Step ${step.step}: ${step.details}`);
        }
      });
    }
  });
}