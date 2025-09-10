import logger from '../utils/logger';
import { AgentFactory } from '../framework/agent-factory';
import { ToolExecutionContext, ToolCall, ToolResult } from '../types/tools';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';

/**
 * Multi-Agent Workflow Execution Service
 * Handles orchestration of multiple agents for complex operations
 */
export class MultiAgentWorkflowService {
  private openaiService: OpenAIService | null = null;

  constructor() {
    this.openaiService = getService<OpenAIService>('openaiService') || null;
  }

  /**
   * Execute a multi-agent workflow with AI planning
   */
  async executeWorkflow(
    userInput: string,
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<{
    success: boolean;
    results: ToolResult[];
    message: string;
    workflow: {
      steps: Array<{
        agent: string;
        parameters: any;
        result?: ToolResult;
        success: boolean;
      }>;
      totalExecutionTime: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting multi-agent workflow execution', {
        userInput: userInput.substring(0, 100),
        sessionId: context.sessionId
      });

      // Generate workflow plan using AI
      const workflowPlan = await this.generateWorkflowPlan(userInput, context);
      
      if (!workflowPlan.success || !workflowPlan.plan) {
        throw new Error(workflowPlan.error || 'Failed to generate workflow plan');
      }

      // Execute workflow steps
      const executionResults = await this.executeWorkflowSteps(
        workflowPlan.plan.steps,
        context,
        accessToken
      );

      const totalExecutionTime = Date.now() - startTime;

      logger.info('Multi-agent workflow completed', {
        sessionId: context.sessionId,
        stepsExecuted: executionResults.length,
        totalExecutionTime,
        successCount: executionResults.filter(r => r.success).length
      });

      return {
        success: true,
        results: executionResults,
        message: `Workflow completed successfully with ${executionResults.length} steps`,
        workflow: {
          steps: workflowPlan.plan.steps.map((step, index) => ({
            agent: step.tool,
            parameters: step.parameters,
            result: executionResults[index],
            success: executionResults[index]?.success || false
          })),
          totalExecutionTime
        }
      };

    } catch (error) {
      logger.error('Multi-agent workflow execution failed:', error);
      
      return {
        success: false,
        results: [],
        message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        workflow: {
          steps: [],
          totalExecutionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Generate workflow plan using AI
   */
  private async generateWorkflowPlan(
    userInput: string,
    context: ToolExecutionContext
  ): Promise<{
    success: boolean;
    plan?: {
      steps: Array<{
        tool: string;
        parameters: any;
        description: string;
      }>;
    };
    error?: string;
  }> {
    if (!this.openaiService) {
      return {
        success: false,
        error: 'OpenAI service not available for workflow planning'
      };
    }

    try {
      const agentMetadata = AgentFactory.getAgentDiscoveryMetadata();
      const availableAgents = Object.keys(agentMetadata).filter(
        agent => agentMetadata[agent].enabled
      );

      const planningPrompt = `You are an AI workflow planner for a multi-agent system. 
Generate a step-by-step plan to fulfill this user request: "${userInput}"

Available agents and their capabilities:
${Object.entries(agentMetadata)
  .filter(([name, _]) => availableAgents.includes(name))
  .map(([name, meta]) => `
${name}:
- Capabilities: ${meta.capabilities?.join(', ') || 'None'}
- Limitations: ${meta.limitations?.join(', ') || 'None'}
`).join('\n')}

Rules:
1. For email operations with person names (not email addresses), include contactAgent first
2. For calendar operations with attendee names, include contactAgent first  
3. Always end with Think tool to verify completion
4. Consider agent limitations and dependencies
5. Keep steps minimal but complete

Respond with a JSON array of steps, each with:
- tool: agent name
- parameters: object with required parameters
- description: what this step accomplishes

Example:
[
  {
    "tool": "contactAgent",
    "parameters": {"query": "Find John Smith"},
    "description": "Look up contact information for John Smith"
  },
  {
    "tool": "emailAgent", 
    "parameters": {"query": "Send email to John about meeting", "contacts": "{{contactAgent.result}}"},
    "description": "Send email to John using contact information"
  },
  {
    "tool": "Think",
    "parameters": {"query": "Verify email was sent successfully"},
    "description": "Verify the email operation completed correctly"
  }
]`;

      const messages = [
        { role: 'system' as const, content: 'You are an expert workflow planner for multi-agent systems. Always respond with valid JSON.' },
        { role: 'user' as const, content: planningPrompt }
      ];

      const response = await this.openaiService.createChatCompletion(messages);
      
      try {
        // Parse the JSON response
        let jsonContent = response.content.trim();
        
        // Remove markdown code blocks if present
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        
        // Try to find JSON array in the response
        const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
        
        const steps = JSON.parse(jsonContent);
        
        return {
          success: true,
          plan: { steps }
        };
        
      } catch (parseError) {
        logger.error('Failed to parse workflow planning response', { 
          error: parseError, 
          response: response.content.substring(0, 500)
        });
        
        return {
          success: false,
          error: 'Failed to parse AI workflow plan'
        };
      }

    } catch (error) {
      logger.error('Workflow planning failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Workflow planning failed'
      };
    }
  }

  /**
   * Execute workflow steps sequentially
   */
  private async executeWorkflowSteps(
    steps: Array<{
      tool: string;
      parameters: any;
      description: string;
    }>,
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (!step) {
        logger.error(`Workflow step ${i + 1} is undefined, skipping`);
        continue;
      }
      
      try {
        logger.info(`Executing workflow step ${i + 1}/${steps.length}`, {
          tool: step.tool,
          description: step.description,
          sessionId: context.sessionId
        });

        // Enhance parameters with previous results
        const enhancedParameters = this.enhanceParametersWithPreviousResults(
          step.parameters,
          results
        );

        // Execute the agent
        const result = await AgentFactory.executeAgent(
          step.tool,
          enhancedParameters,
          context,
          accessToken
        );

        results.push(result);

        // If step failed and it's critical, stop execution
        if (!result.success && this.isCriticalStep(step.tool)) {
          logger.error(`Critical step failed, stopping workflow`, {
            step: step.tool,
            error: result.error,
            sessionId: context.sessionId
          });
          break;
        }

        // Add delay between steps to avoid rate limiting
        if (i < steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        logger.error(`Workflow step ${i + 1} failed:`, error);
        
        const errorResult: ToolResult = {
          toolName: step.tool,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : 'Step execution failed',
          executionTime: 0
        };
        
        results.push(errorResult);
        
        // Stop execution if critical step fails
        if (this.isCriticalStep(step.tool)) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Enhance parameters with results from previous steps
   */
  private enhanceParametersWithPreviousResults(
    parameters: any,
    previousResults: ToolResult[]
  ): any {
    const enhanced = { ...parameters };
    
    // Replace placeholder references with actual results
    for (const [key, value] of Object.entries(enhanced)) {
      if (typeof value === 'string' && value.includes('{{')) {
        // Replace {{agentName.result}} with actual result
        const match = value.match(/\{\{(\w+)\.result\}\}/);
        if (match) {
          const agentName = match[1];
          const agentResult = previousResults.find(r => r.toolName === agentName);
          
          if (agentResult && agentResult.success) {
            enhanced[key] = agentResult.result;
          }
        }
      }
    }
    
    return enhanced;
  }

  /**
   * Check if a step is critical (workflow should stop if it fails)
   */
  private isCriticalStep(toolName: string): boolean {
    // Contact lookup is critical for email/calendar operations
    if (toolName === 'contactAgent') {
      return true;
    }
    
    // Think tool is not critical
    if (toolName === 'Think') {
      return false;
    }
    
    // Other tools are moderately critical
    return false;
  }

  /**
   * Get workflow execution statistics
   */
  getWorkflowStats(): {
    totalWorkflows: number;
    successfulWorkflows: number;
    averageStepsPerWorkflow: number;
    mostUsedAgents: Array<{ agent: string; count: number }>;
  } {
    // This would be implemented with actual tracking in a real system
    return {
      totalWorkflows: 0,
      successfulWorkflows: 0,
      averageStepsPerWorkflow: 0,
      mostUsedAgents: []
    };
  }
}

/**
 * Export singleton instance
 */
export const multiAgentWorkflowService = new MultiAgentWorkflowService();
