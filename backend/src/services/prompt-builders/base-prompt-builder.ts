import { GenericAIService, AIPrompt, AIResponse, StructuredSchema, BaseAIResponse } from '../generic-ai.service';

/**
 * Base class for all prompt builders
 * Provides a consistent interface for building AI prompts and executing them
 * All responses must include an updated context
 */
export abstract class BasePromptBuilder<TContext = string, TResult extends BaseAIResponse = BaseAIResponse> {
  // Master Agent Context Format - aligned with design document
  protected readonly CONTEXT_FORMAT = `
Context Structure (update as workflow progresses):
GOAL: [Primary user intent and desired outcome]
ENTITIES: [People, companies, meetings, emails referenced]
CONSTRAINTS: [Time limits, approval requirements, risk factors]
DATA: [Information gathered from domain agents]
PROGRESS: [Actions completed, decisions made]
BLOCKERS: [Current issues preventing progress]
NEXT: [Immediate next action in workflow]

Free-form Notes: [Additional context, reasoning, edge cases]`;

  constructor(protected aiService: GenericAIService) {}

  /**
   * Build the AI prompt from the given context
   */
  abstract buildPrompt(context: TContext): AIPrompt<TContext>;

  /**
   * Get the structured schema for this prompt type
   * Must include 'context' as a required string field
   */
  abstract getSchema(): StructuredSchema;

  /**
   * Execute the prompt with the given context
   */
  async execute(context: TContext): Promise<AIResponse<TResult>> {
    const prompt = this.buildPrompt(context);
    const schema = this.getSchema();
    return this.aiService.executePrompt<TResult>(prompt, schema);
  }

  /**
   * Execute with custom options
   */
  async executeWithOptions(
    context: TContext, 
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<AIResponse<TResult>> {
    const prompt = this.buildPrompt(context);
    const schema = this.getSchema();
    
    // Override options
    const enhancedPrompt: AIPrompt<TContext> = {
      ...prompt,
      options: {
        ...prompt.options,
        ...options
      }
    };
    
    return this.aiService.executePrompt<TResult>(enhancedPrompt, schema);
  }

  /**
   * Validate the context before building the prompt
   */
  protected validateContext(context: TContext): void {
    // Override in subclasses for specific validation
  }

  /**
   * Get a description of what this prompt builder does
   */
  abstract getDescription(): string;

  /**
   * Get the updated context from the response
   */
  getContext(response: AIResponse<TResult>): string {
    return response.context;
  }

  /**
   * Validate that the response includes a context
   */
  protected validateResponse(response: AIResponse<TResult>): void {
    if (!response.context || response.context.trim().length === 0) {
      throw new Error('Response must include an updated context');
    }
  }
}
