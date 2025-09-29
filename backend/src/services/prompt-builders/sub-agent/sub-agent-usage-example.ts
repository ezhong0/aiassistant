/**
 * Example usage of the 3-phase sub-agent prompt builders
 * This demonstrates how to use the sub-agent prompt system
 */

import { GenericAIService } from '../../generic-ai.service';
import { IntentAssessmentPromptBuilder, ToolCall } from './intent-assessment-prompt-builder';
import { PlanReviewPromptBuilder } from './plan-review-prompt-builder';
import { ResponseFormattingPromptBuilder } from './response-formatting-prompt-builder';

/**
 * Example: Email Sub-Agent using 3-phase prompt builders
 */
export class EmailSubAgentExample {
  private intentAssessmentBuilder: IntentAssessmentPromptBuilder;
  private planReviewBuilder: PlanReviewPromptBuilder;
  private responseFormattingBuilder: ResponseFormattingPromptBuilder;

  constructor(private aiService: GenericAIService) {
    // Initialize the 3 prompt builders for email domain
    this.intentAssessmentBuilder = new IntentAssessmentPromptBuilder(aiService, 'email');
    this.planReviewBuilder = new PlanReviewPromptBuilder(aiService, 'email');
    this.responseFormattingBuilder = new ResponseFormattingPromptBuilder(aiService, 'email');
  }

  /**
   * Execute the 3-phase sub-agent workflow
   */
  async execute(request: string): Promise<any> {
    // Phase 1: Intent Assessment
    const initialContext = `Request: ${request}
Available tools: gmail_send_email, gmail_get_delivery_status
Status: planning
Notes: Starting intent assessment`;

    const intentResult = await this.intentAssessmentBuilder.execute(initialContext);
    console.log('Phase 1 - Intent Assessment:', intentResult.parsed);

    // Execute tool calls from intent assessment
    const toolCalls: ToolCall[] = intentResult.parsed.toolCalls;
    const executionResults = [];
    
    for (const toolCall of toolCalls) {
      // Execute the actual tool call (this would be done by the sub-agent implementation)
      const result = await this.executeToolCall(toolCall);
      executionResults.push(result);
      
      // Phase 2: Plan Review after each tool execution
      const reviewContext = `${intentResult.parsed.context}
Tool executed: ${toolCall.tool}
Result: ${JSON.stringify(result)}
Status: executing`;
      
      const reviewResult = await this.planReviewBuilder.execute(reviewContext);
      console.log('Phase 2 - Plan Review:', reviewResult.parsed);
      
      // Update context with the new steps
      // The sub-agent implementation would decide whether to continue based on the updated steps
    }

    // Phase 3: Response Formatting
    const finalContext = `${intentResult.parsed.context}
Tool results: ${JSON.stringify(executionResults)}
Status: complete`;
    
    const formattingResult = await this.responseFormattingBuilder.execute(finalContext);
    console.log('Phase 3 - Response Formatting:', formattingResult.parsed);

    return formattingResult.parsed.response;
  }

  /**
   * Execute a single tool call (placeholder implementation)
   */
  private async executeToolCall(toolCall: ToolCall): Promise<any> {
    // This would be implemented by the actual sub-agent
    // For now, return a mock result
    return {
      success: true,
      result: `Mock result for ${toolCall.tool}`,
      executionTime: 100
    };
  }
}

/**
 * Example: Calendar Sub-Agent using 3-phase prompt builders
 */
export class CalendarSubAgentExample {
  private intentAssessmentBuilder: IntentAssessmentPromptBuilder;
  private planReviewBuilder: PlanReviewPromptBuilder;
  private responseFormattingBuilder: ResponseFormattingPromptBuilder;

  constructor(private aiService: GenericAIService) {
    // Initialize the 3 prompt builders for calendar domain
    this.intentAssessmentBuilder = new IntentAssessmentPromptBuilder(aiService, 'calendar');
    this.planReviewBuilder = new PlanReviewPromptBuilder(aiService, 'calendar');
    this.responseFormattingBuilder = new ResponseFormattingPromptBuilder(aiService, 'calendar');
  }

  /**
   * Execute the 3-phase sub-agent workflow
   */
  async execute(request: string): Promise<any> {
    // Phase 1: Intent Assessment
    const initialContext = `Request: ${request}
Available tools: calendar_create_event, calendar_check_availability
Status: planning
Notes: Starting intent assessment`;

    const intentResult = await this.intentAssessmentBuilder.execute(initialContext);
    
    // Execute tool calls and review plan after each execution
    const toolCalls: ToolCall[] = intentResult.parsed.toolCalls;
    const executionResults = [];
    
    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall);
      executionResults.push(result);
      
      // Phase 2: Plan Review after each tool execution
      const reviewContext = `${intentResult.parsed.context}
Tool executed: ${toolCall.tool}
Result: ${JSON.stringify(result)}
Status: executing`;
      
      const reviewResult = await this.planReviewBuilder.execute(reviewContext);
      
      // Update context with the new steps
      // The sub-agent implementation would decide whether to continue based on the updated steps
    }

    // Phase 3: Response Formatting
    const finalContext = `${intentResult.parsed.context}
Tool results: ${JSON.stringify(executionResults)}
Status: complete`;
    
    const formattingResult = await this.responseFormattingBuilder.execute(finalContext);
    
    return formattingResult.parsed.response;
  }

  /**
   * Execute a single tool call (placeholder implementation)
   */
  private async executeToolCall(toolCall: ToolCall): Promise<any> {
    return {
      success: true,
      result: `Mock result for ${toolCall.tool}`,
      executionTime: 100
    };
  }
}

/**
 * Factory for creating sub-agent instances
 */
export class SubAgentFactory {
  constructor(private aiService: GenericAIService) {}

  createEmailSubAgent(): EmailSubAgentExample {
    return new EmailSubAgentExample(this.aiService);
  }

  createCalendarSubAgent(): CalendarSubAgentExample {
    return new CalendarSubAgentExample(this.aiService);
  }

  // Add other sub-agents as needed
  createContactSubAgent(): any {
    // Implementation for contact sub-agent
    return null;
  }

  createSlackSubAgent(): any {
    // Implementation for slack sub-agent
    return null;
  }
}

/**
 * Usage example:
 * 
 * const aiService = new GenericAIService();
 * const factory = new SubAgentFactory(aiService);
 * 
 * const emailAgent = factory.createEmailSubAgent();
 * const result = await emailAgent.execute("Send project update to john@company.com and sarah@client.com");
 * 
 * console.log('Final result:', result);
 */
