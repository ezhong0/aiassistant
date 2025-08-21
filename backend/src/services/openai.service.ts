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

  constructor(config: OpenAIConfig) {
    super('OpenAIService');
    
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
        tools: this.getToolDefinitions(),
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 1000
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      const toolCalls: ToolCall[] = [];
      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function) {
            try {
              const parameters = JSON.parse(toolCall.function.arguments);
              toolCalls.push({
                name: toolCall.function.name,
                parameters
              });
            } catch (error) {
              this.logWarn('Failed to parse tool call parameters', { 
                toolName: toolCall.function.name,
                arguments: toolCall.function.arguments,
                error 
              });
            }
          }
        }
      }

      this.logInfo('Tool calls generated successfully', { 
        toolCallCount: toolCalls.length,
        toolNames: toolCalls.map(tc => tc.name),
        sessionId 
      });

      return {
        toolCalls,
        message: assistantMessage.content || 'I\'ll help you with that.'
      };
    } catch (error) {
      this.handleError(error, 'generateToolCalls');
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
        max_tokens: options.maxTokens || 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      this.logDebug('Text response generated successfully', { 
        responseLength: content.length 
      });

      return content;
    } catch (error) {
      this.handleError(error, 'generateText');
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
        max_tokens: options.maxTokens || 1000
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error('No structured data in OpenAI response');
      }

      const data = JSON.parse(toolCall.function.arguments);
      
      this.logDebug('Structured data generated successfully', { 
        dataKeys: Object.keys(data) 
      });

      return data as T;
    } catch (error) {
      this.handleError(error, 'generateStructuredData');
    }
  }

  /**
   * Get tool definitions for OpenAI function calling
   */
  private getToolDefinitions(): any[] {
    try {
      // This would typically come from AgentFactory or a tool registry
      // For now, return a basic set of tools
      return [
        {
          type: 'function',
          function: {
            name: 'emailAgent',
            description: 'Send emails using Gmail API',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body content' }
              },
              required: ['to', 'subject', 'body']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'contactAgent',
            description: 'Search and manage contacts',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query for contacts' },
                operation: { type: 'string', enum: ['search', 'create', 'update'], description: 'Operation to perform' }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'Think',
            description: 'Analyze and verify tool usage decisions',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Analysis query or verification request' }
              },
              required: ['query']
            }
          }
        }
      ];
    } catch (error) {
      this.logWarn('Failed to get tool definitions', { error });
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
   * Test OpenAI API connectivity
   */
  async testConnection(): Promise<boolean> {
    this.assertReady();
    
    try {
      this.logDebug('Testing OpenAI API connection');
      
      const response = await this.client.models.list();
      const isConnected = response.data && response.data.length > 0;
      
      this.logInfo('OpenAI API connection test completed', { 
        connected: isConnected,
        availableModels: response.data?.length || 0 
      });
      
      return isConnected;
    } catch (error) {
      this.logError('OpenAI API connection test failed', error);
      return false;
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    try {
      const healthy = this.isReady() && !!this.client;
      const details = {
        client: !!this.client,
        model: this.model,
        apiKeyConfigured: !!this.client.auth.apiKey
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Export the class for registration with ServiceManager
export { OpenAIService };