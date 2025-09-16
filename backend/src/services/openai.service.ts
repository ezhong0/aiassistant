import OpenAI from 'openai';
import { ToolCall, ToolExecutionContext } from '../types/tools';
import { aiConfigService } from '../config/ai-config';
import { BaseService } from './base-service';
import logger from '../utils/logger';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

export interface FunctionCallResponse {
  toolCalls: ToolCall[];
  message: string;
}

export class OpenAIService extends BaseService {
  private client: OpenAI;
  private model: string;
  private apiKey: string;
  private activeRequests: number = 0;
  private readonly maxConcurrentRequests: number = 3;

  constructor(config: OpenAIConfig) {
    super('OpenAIService');
    
    this.apiKey = config.apiKey;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    
    // Use AI configuration for default model
    try {
      const aiOpenAIConfig = aiConfigService.getOpenAIConfig('routing');
      this.model = config.model || aiOpenAIConfig.model;
      this.logInfo(`OpenAI service initialized with model: ${this.model} (from AI config)`);
    } catch (error) {
      this.model = config.model || 'gpt-4o-mini';
      this.logWarn(`Using fallback model: ${this.model} (AI config not available)`);
    }
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // OpenAI client is already initialized in constructor
    this.logInfo('OpenAI service initialized successfully');
  }

  /**
   * Override isReady to include API key validation
   */
  public isReady(): boolean {
    const baseReady = super.isReady();
    const hasValidApiKey = this.hasValidApiKey();
    
    if (baseReady && !hasValidApiKey) {
      this.logWarn('OpenAI service base ready but API key is invalid');
    }
    
    return baseReady && hasValidApiKey;
  }

  /**
   * Check if the API key is valid (not dummy or empty)
   */
  private hasValidApiKey(): boolean {
    return !!(this.apiKey && 
             this.apiKey.length > 10 && 
             this.apiKey !== 'dummy-key' &&
             this.apiKey.startsWith('sk-'));
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('OpenAI service destroyed');
  }

  /**
   * Generate tool calls from user input using the master agent prompt
   */
  async generateToolCalls(
    userInput: string, 
    systemPrompt: string, 
    sessionId: string
  ): Promise<FunctionCallResponse> {
    this.assertReady();
    
    // Check concurrent request limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      throw new Error(`Too many concurrent OpenAI requests (${this.activeRequests}/${this.maxConcurrentRequests}). Please try again in a moment.`);
    }
    
    this.activeRequests++;
    
    try {
      this.logDebug('Generating tool calls', { 
        userInputLength: userInput.length,
        systemPromptLength: systemPrompt.length,
        sessionId 
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        tools: await this.getToolDefinitions(),
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 500 // Reduced to prevent memory issues
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      const toolCalls: ToolCall[] = [];
      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const parameters = JSON.parse((toolCall as any).function?.arguments || '{}');
            toolCalls.push({
              name: (toolCall as any).function?.name || 'unknown',
              parameters
            });
          } catch (error) {
            this.logWarn('Failed to parse tool call parameters', { 
              toolName: (toolCall as any).function?.name || 'unknown',
              arguments: (toolCall as any).function?.arguments || '',
              error 
            });
          }
        }
      }

      // Memory monitoring
      const responseSize = JSON.stringify(response).length;
      if (responseSize > 50000) { // 50KB warning threshold
        this.logWarn('Large OpenAI response detected', { 
          responseSizeBytes: responseSize,
          sessionId 
        });
      }

      this.logInfo('Tool calls generated successfully', { 
        toolCallCount: toolCalls.length,
        toolNames: toolCalls.map(tc => tc.name),
        responseSizeBytes: responseSize,
        sessionId 
      });

      return {
        toolCalls,
        message: assistantMessage.content || 'I\'ll help you with that.'
      };
    } catch (error) {
      this.handleError(error, 'generateToolCalls');
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Generate a simple text response
   */
  async generateText(
    userInput: string, 
    systemPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    this.assertReady();
    
    // Check concurrent request limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      throw new Error(`Too many concurrent OpenAI requests (${this.activeRequests}/${this.maxConcurrentRequests}). Please try again in a moment.`);
    }
    
    this.activeRequests++;
    
    try {
      this.logDebug('Generating text response', { 
        userInputLength: userInput.length,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 500
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: Math.min(options.maxTokens || 500, 800) // Hard limit to prevent memory issues
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Memory monitoring
      const responseSize = JSON.stringify(response).length;
      if (responseSize > 50000) { // 50KB warning threshold
        this.logWarn('Large OpenAI text response detected', { 
          responseSizeBytes: responseSize,
          contentLength: content.length
        });
      }

      this.logDebug('Text response generated successfully', { 
        responseLength: content.length,
        responseSizeBytes: responseSize
      });

      return content;
    } catch (error) {
      this.handleError(error, 'generateText');
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Generate structured data using function calling
   */
  async generateStructuredData<T>(
    userInput: string,
    systemPrompt: string,
    schema: any,
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<T> {
    this.assertReady();
    
    // Check concurrent request limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      throw new Error(`Too many concurrent OpenAI requests (${this.activeRequests}/${this.maxConcurrentRequests}). Please try again in a moment.`);
    }
    
    this.activeRequests++;
    
    try {
      this.logDebug('Generating structured data', { 
        userInputLength: userInput.length,
        schemaType: typeof schema,
        temperature: options.temperature || 0.1
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_data',
            description: 'Extract structured data from user input',
            parameters: schema
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_data' } },
        temperature: options.temperature || 0.1,
        max_tokens: Math.min(options.maxTokens || 1000, 800) // Hard limit to prevent memory issues
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('No tool call in OpenAI response');
      }

      const extractedData = JSON.parse((toolCall as any).function?.arguments || '{}');
      
      this.logDebug('Structured data generated successfully', { 
        dataKeys: Object.keys(extractedData)
      });

      return extractedData as T;
    } catch (error) {
      this.handleError(error, 'generateStructuredData');
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Get tool definitions for OpenAI function calling
   * Uses enhanced agent schemas from AgentFactory
   */
  private async getToolDefinitions(): Promise<any[]> {
    try {
      // Import AgentFactory dynamically to avoid circular imports
      const { AgentFactory } = await import('../framework/agent-factory');

      // Use enhanced OpenAI functions from AgentFactory
      const enhancedFunctions = await AgentFactory.generateEnhancedOpenAIFunctions();
      
      // Convert to OpenAI tool format
      const tools = enhancedFunctions.map((func: any) => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters
        }
      }));
      
      this.logDebug('Generated enhanced tool definitions', {
        toolCount: tools.length,
        toolNames: tools.map((t: any) => t.function.name)
      });
      
      return tools;
    } catch (error) {
      this.logError('Failed to get enhanced tool definitions from AgentFactory', error);
      
      // Return empty array if AgentFactory is not available
      // This ensures the system fails gracefully rather than using outdated hardcoded definitions
      this.logWarn('No tool definitions available - AgentFactory not initialized');
      return [];
    }
  }

  /**
   * Update the model being used
   */
  updateModel(newModel: string): void {
    this.assertReady();
    
    this.model = newModel;
    this.logInfo('OpenAI model updated', { newModel });
  }

  /**
   * Get current model configuration
   */
  getModelConfig(): { model: string; availableModels: string[] } {
    return {
      model: this.model,
      availableModels: ['gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
    };
  }

  /**
   * Create a chat completion (for backward compatibility)
   */
  async createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    maxTokens?: number
  ): Promise<{ content: string }> {
    this.assertReady();
    
    try {
      this.logDebug('Creating chat completion', { 
        messageCount: messages.length,
        maxTokens: maxTokens || 500
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        temperature: 0.7,
        max_tokens: Math.min(maxTokens || 500, 800) // Hard limit to prevent memory issues
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      this.logDebug('Chat completion created successfully', { 
        responseLength: content.length 
      });

      return { content };
    } catch (error) {
      this.handleError(error, 'createChatCompletion');
    }
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: any, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logError(`OpenAI ${operation} failed`, error, { operation });
    throw new Error(`OpenAI ${operation} failed: ${errorMessage}`);
  }

  /**
   * Get service configuration
   */
  getConfig(): OpenAIConfig {
    return {
      apiKey: '***', // Don't expose API key
      model: this.model
    };
  }

  /**
   * Test OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    this.assertReady();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      this.logError('OpenAI connection test failed', error);
      return false;
    }
  }
}