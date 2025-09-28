/**
 * Example usage of the 3-phase sub-agent prompt builders
 * This demonstrates how to use the sub-agent prompt system
 */

import { GenericAIService } from '../../generic-ai.service';
import { 
  IntentAssessmentPromptBuilder,
  ToolExecutionPromptBuilder,
  ResponseFormattingPromptBuilder,
  SubAgentContext
} from './index';

/**
 * Example: Email Sub-Agent using 3-phase prompt builders
 */
export class EmailSubAgentExample {
  private intentAssessmentBuilder: IntentAssessmentPromptBuilder;
  private toolExecutionBuilder: ToolExecutionPromptBuilder;
  private responseFormattingBuilder: ResponseFormattingPromptBuilder;

  constructor(private aiService: GenericAIService) {
    // Initialize the 3 prompt builders for email domain
    this.intentAssessmentBuilder = new IntentAssessmentPromptBuilder(aiService, 'email');
    this.toolExecutionBuilder = new ToolExecutionPromptBuilder(aiService, 'email');
    this.responseFormattingBuilder = new ResponseFormattingPromptBuilder(aiService, 'email');
  }

  /**
   * Execute the 3-phase sub-agent workflow
   */
  async execute(request: string): Promise<any> {
    // Phase 1: Intent Assessment
    const initialContext: SubAgentContext = {
      request,
      tools: [], // Will be populated by intent assessment
      params: {},
      status: 'planning',
      result: {},
      notes: 'Starting intent assessment'
    };

    const intentResult = await this.intentAssessmentBuilder.execute(initialContext);
    console.log('Phase 1 - Intent Assessment:', intentResult.parsed);

    // Phase 2: Tool Execution
    const executionContext: SubAgentContext = JSON.parse(intentResult.parsed.context);
    executionContext.status = 'executing';
    
    const executionResult = await this.toolExecutionBuilder.execute(executionContext);
    console.log('Phase 2 - Tool Execution:', executionResult.parsed);

    // Phase 3: Response Formatting
    const formattingContext: SubAgentContext = JSON.parse(executionResult.parsed.context);
    formattingContext.status = 'complete';
    
    const formattingResult = await this.responseFormattingBuilder.execute(formattingContext);
    console.log('Phase 3 - Response Formatting:', formattingResult.parsed);

    return formattingResult.parsed.response;
  }
}

/**
 * Example: Calendar Sub-Agent using 3-phase prompt builders
 */
export class CalendarSubAgentExample {
  private intentAssessmentBuilder: IntentAssessmentPromptBuilder;
  private toolExecutionBuilder: ToolExecutionPromptBuilder;
  private responseFormattingBuilder: ResponseFormattingPromptBuilder;

  constructor(private aiService: GenericAIService) {
    // Initialize the 3 prompt builders for calendar domain
    this.intentAssessmentBuilder = new IntentAssessmentPromptBuilder(aiService, 'calendar');
    this.toolExecutionBuilder = new ToolExecutionPromptBuilder(aiService, 'calendar');
    this.responseFormattingBuilder = new ResponseFormattingPromptBuilder(aiService, 'calendar');
  }

  /**
   * Execute the 3-phase sub-agent workflow
   */
  async execute(request: string): Promise<any> {
    // Phase 1: Intent Assessment
    const initialContext: SubAgentContext = {
      request,
      tools: [],
      params: {},
      status: 'planning',
      result: {},
      notes: 'Starting intent assessment'
    };

    const intentResult = await this.intentAssessmentBuilder.execute(initialContext);
    const executionContext: SubAgentContext = JSON.parse(intentResult.parsed.context);
    executionContext.status = 'executing';
    
    // Phase 2: Tool Execution
    const executionResult = await this.toolExecutionBuilder.execute(executionContext);
    const formattingContext: SubAgentContext = JSON.parse(executionResult.parsed.context);
    formattingContext.status = 'complete';
    
    // Phase 3: Response Formatting
    const formattingResult = await this.responseFormattingBuilder.execute(formattingContext);
    
    return formattingResult.parsed.response;
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
