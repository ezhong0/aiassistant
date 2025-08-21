import OpenAI from 'openai';
import logger from '../utils/logger';
import { ToolCall } from '../types/tools';
import { aiConfigService } from '../config/ai-config';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FunctionCallResponse {
  toolCalls: ToolCall[];
  message: string;
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    
    // Use AI configuration for default model
    try {
      const aiOpenAIConfig = aiConfigService.getOpenAIConfig('routing');
      this.model = config.model || aiOpenAIConfig.model;
      logger.info(`OpenAI service initialized with model: ${this.model} (from AI config)`);
    } catch (error) {
      this.model = config.model || 'gpt-4o-mini';
      logger.warn(`Using fallback model: ${this.model} (AI config not available)`);
    }
  }

  /**
   * Generate tool calls from user input using the master agent prompt
   */
  async generateToolCalls(
    userInput: string,
    systemPrompt: string,
    sessionId: string
  ): Promise<FunctionCallResponse> {
    try {
      logger.info(`OpenAI generating tool calls for session: ${sessionId}`);

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userInput
        }
      ];

      // Define the available tools/functions
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'Think',
            description: 'Use this to think deeply or if you get stuck',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The thought process or analysis to perform'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'emailAgent',
            description: 'Use this tool to take action in email',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The email action to perform'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'calendarAgent',
            description: 'Use this tool to take action in calendar',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The calendar action to perform'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'contactAgent',
            description: 'Use this tool to get, update, or add contacts',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The contact action to perform'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'contentCreator',
            description: 'Use this tool to create blog posts',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The content creation request'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'Tavily',
            description: 'Use this tool to search the web',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The web search query'
                }
              },
              required: ['query']
            }
          }
        }
      ];

      // Get AI configuration for routing
      const routingConfig = aiConfigService.getOpenAIConfig('routing');
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        tools: tools,
        tool_choice: 'auto',
        temperature: routingConfig.temperature,
        max_tokens: routingConfig.max_tokens,
      }, {
        timeout: routingConfig.timeout,
      });

      const choice = response.choices[0];
      
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      let toolCalls: ToolCall[] = [];
      let message = '';

      // Check if the assistant made tool calls
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        toolCalls = choice.message.tool_calls.map(toolCall => {
          const func = (toolCall as any).function;
          return {
            name: func.name,
            parameters: JSON.parse(func.arguments)
          };
        });

        message = `I'm processing your request using the following tools: ${toolCalls.map(tc => tc.name).join(', ')}`;
      } else {
        // If no tool calls, use the assistant's message
        message = choice.message.content || 'I need more information to help you.';
      }

      // Ensure Think tool is always called (as per the rules)
      const hasThinkTool = toolCalls.some(tc => tc.name === 'Think');
      if (!hasThinkTool) {
        toolCalls.push({
          name: 'Think',
          parameters: {
            query: `Verify that the correct steps were taken for the user request: "${userInput}"`
          }
        });
      }

      logger.info(`OpenAI generated ${toolCalls.length} tool calls:`, toolCalls.map(tc => tc.name));

      return {
        toolCalls,
        message
      };

    } catch (error) {
      logger.error('Error in OpenAI service:', error);
      
      // Fallback to rule-based routing on OpenAI failure
      return {
        toolCalls: [
          {
            name: 'Think',
            parameters: {
              query: `OpenAI service failed, falling back to rule-based routing for: "${userInput}"`
            }
          }
        ],
        message: 'I encountered an issue with my AI processing, but I can still help you.'
      };
    }
  }

  /**
   * Simple completion for basic text generation (if needed)
   */
  async generateText(
    prompt: string,
    maxTokens?: number
  ): Promise<string> {
    try {
      // Get AI configuration for content generation
      const contentConfig = aiConfigService.getOpenAIConfig('content');
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens || contentConfig.max_tokens,
        temperature: contentConfig.temperature,
      }, {
        timeout: contentConfig.timeout,
      });

      return response.choices[0]?.message?.content || '';
      
    } catch (error) {
      logger.error('Error in OpenAI text generation:', error);
      throw error;
    }
  }

  /**
   * Create a chat completion with messages array
   */
  async createChatCompletion(
    messages: ChatMessage[],
    maxTokens?: number
  ): Promise<{ content: string }> {
    try {
      // Get AI configuration for analysis
      const analysisConfig = aiConfigService.getOpenAIConfig('analysis');
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: maxTokens || analysisConfig.max_tokens,
        temperature: analysisConfig.temperature,
      }, {
        timeout: analysisConfig.timeout,
      });

      return {
        content: response.choices[0]?.message?.content || ''
      };
      
    } catch (error) {
      logger.error('Error in OpenAI chat completion:', error);
      throw error;
    }
  }

  /**
   * Health check for the OpenAI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Get AI configuration for general use
      const generalConfig = aiConfigService.getOpenAIConfig('general');
      
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }, {
        timeout: generalConfig.timeout,
      });
      return true;
    } catch (error) {
      logger.error('OpenAI health check failed:', error);
      return false;
    }
  }
}