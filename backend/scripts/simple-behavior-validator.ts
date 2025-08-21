/**
 * Simple AI Behavior Validator - Jest-free version
 * For memory-efficient testing without Jest overhead
 */

import { MasterAgent } from '../src/agents/master.agent';

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

/**
 * Simple AI Behavior Validator - Jest-free
 */
export class SimpleBehaviorValidator {
  private masterAgent: MasterAgent;
  private conversationContext: Map<string, any> = new Map();

  constructor() {
    this.masterAgent = new MasterAgent();
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
}
