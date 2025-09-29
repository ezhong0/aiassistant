/**
 * OpenAI API Mock Responses
 * Realistic mock responses for OpenAI API (Chat Completions, Embeddings)
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  [key: string]: any;
}

export class OpenAiApiMocks {

  /**
   * Mock chat completion responses
   */
  async chatCompletion(requestData: any, context: MockContext): Promise<APIResponse<any>> {
    const { messages, functions, function_call } = requestData;
    const lastMessage = messages[messages.length - 1];

    // Generate appropriate response based on the request type
    let responseContent: any;
    let finishReason = 'stop';

    if (functions && function_call) {
      // Function calling response
      responseContent = null;
      finishReason = 'function_call';

      const mockFunctionResponse = this.generateMockFunctionCall(
        functions[0],
        lastMessage.content,
        context
      );

      return {
        success: true,
        data: {
          id: `chatcmpl-mock-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: requestData.model || 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              function_call: mockFunctionResponse
            },
            finish_reason: finishReason
          }],
          usage: {
            prompt_tokens: this.estimateTokens(JSON.stringify(messages)),
            completion_tokens: this.estimateTokens(JSON.stringify(mockFunctionResponse)),
            total_tokens: this.estimateTokens(JSON.stringify(messages)) + this.estimateTokens(JSON.stringify(mockFunctionResponse))
          }
        },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: '/chat/completions',
        metadata: {
          requestId: `openai-chat-${Date.now()}`,
          timestamp: new Date().toISOString(),
          duration: 1500,
          cached: false
        }
      };
    } else {
      // Regular text response
      responseContent = this.generateMockTextResponse(lastMessage.content, context);
    }

    return {
      success: true,
      data: {
        id: `chatcmpl-mock-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestData.model || 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: finishReason
        }],
        usage: {
          prompt_tokens: this.estimateTokens(JSON.stringify(messages)),
          completion_tokens: this.estimateTokens(responseContent),
          total_tokens: this.estimateTokens(JSON.stringify(messages)) + this.estimateTokens(responseContent)
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/chat/completions',
      metadata: {
        requestId: `openai-chat-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 1200,
        cached: false
      }
    };
  }

  /**
   * Mock embeddings generation
   */
  async generateEmbeddings(requestData: any, context: MockContext): Promise<APIResponse<any>> {
    const { input, model } = requestData;
    const inputArray = Array.isArray(input) ? input : [input];

    const mockEmbeddings = inputArray.map((text: string, index: number) => ({
      object: 'embedding',
      embedding: this.generateMockEmbedding(text),
      index
    }));

    return {
      success: true,
      data: {
        object: 'list',
        data: mockEmbeddings,
        model: model || 'text-embedding-ada-002',
        usage: {
          prompt_tokens: inputArray.reduce((sum: number, text: string) => sum + this.estimateTokens(text), 0),
          total_tokens: inputArray.reduce((sum: number, text: string) => sum + this.estimateTokens(text), 0)
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/embeddings',
      metadata: {
        requestId: `openai-embeddings-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 300,
        cached: false
      }
    };
  }

  /**
   * Generate mock function call response based on function definition
   */
  private generateMockFunctionCall(functionDef: any, userPrompt: string, context: MockContext): any {
    const functionName = functionDef.name;

    // Generate contextually appropriate responses based on function name
    switch (functionName) {
      case 'structured_response':
        return {
          name: functionName,
          arguments: JSON.stringify(this.generateStructuredResponse(functionDef.parameters, userPrompt, context))
        };

      case 'situation_analysis':
        return {
          name: functionName,
          arguments: JSON.stringify({
            context: this.generateSituationAnalysis(userPrompt, context),
            userIntent: this.extractUserIntent(userPrompt),
            requiredActions: this.identifyRequiredActions(userPrompt),
            confidence: 0.95
          })
        };

      case 'workflow_planning':
        return {
          name: functionName,
          arguments: JSON.stringify({
            context: this.generateWorkflowPlan(userPrompt, context),
            steps: this.generateWorkflowSteps(userPrompt),
            estimatedTime: '2-3 minutes',
            complexity: 'medium'
          })
        };

      case 'environment_check':
        return {
          name: functionName,
          arguments: JSON.stringify({
            context: this.generateEnvironmentCheck(userPrompt, context),
            availableTools: ['email', 'calendar', 'contacts', 'slack'],
            requiredPermissions: ['google_oauth', 'slack_oauth'],
            systemStatus: 'ready'
          })
        };

      case 'action_execution':
        return {
          name: functionName,
          arguments: JSON.stringify({
            context: this.generateActionExecution(userPrompt, context),
            executedActions: this.generateExecutedActions(userPrompt),
            results: this.generateActionResults(userPrompt),
            nextSteps: this.generateNextSteps(userPrompt)
          })
        };

      case 'final_response':
        return {
          name: functionName,
          arguments: JSON.stringify({
            response: this.generateFinalResponse(userPrompt, context),
            summary: this.generateSummary(userPrompt),
            confidence: 0.92
          })
        };

      default:
        return {
          name: functionName,
          arguments: JSON.stringify({
            message: `Mock response for function: ${functionName}`,
            input: userPrompt,
            timestamp: new Date().toISOString()
          })
        };
    }
  }

  /**
   * Generate mock text response based on user input
   */
  private generateMockTextResponse(userPrompt: string, context: MockContext): string {
    const lowerPrompt = userPrompt.toLowerCase();

    if (lowerPrompt.includes('email') || lowerPrompt.includes('send') || lowerPrompt.includes('message')) {
      return "I'll help you with your email request. I can send emails, search your inbox, or manage your email communications.";
    }

    if (lowerPrompt.includes('calendar') || lowerPrompt.includes('meeting') || lowerPrompt.includes('schedule')) {
      return "I can help you manage your calendar. I'll check your availability and schedule the meeting as requested.";
    }

    if (lowerPrompt.includes('contact') || lowerPrompt.includes('phone') || lowerPrompt.includes('address')) {
      return "I'll help you with your contacts. I can search for people, add new contacts, or update existing contact information.";
    }

    if (lowerPrompt.includes('slack') || lowerPrompt.includes('team') || lowerPrompt.includes('channel')) {
      return "I can help you with Slack communications. I'll send messages, check conversations, or manage your team communications.";
    }

    return "I understand your request and I'm ready to help. Let me process this and take the appropriate actions.";
  }

  /**
   * Generate structured response based on schema
   */
  private generateStructuredResponse(schema: any, userPrompt: string, context: MockContext): any {
    const response: any = {};

    if (schema.properties) {
      Object.keys(schema.properties).forEach(key => {
        const property = schema.properties[key];

        switch (property.type) {
          case 'string':
            if (key === 'context') {
              response[key] = this.generateContextString(userPrompt, context);
            } else {
              response[key] = `Mock ${key} value for: ${userPrompt.substring(0, 50)}...`;
            }
            break;
          case 'number':
            response[key] = Math.random() * 10;
            break;
          case 'boolean':
            response[key] = Math.random() > 0.5;
            break;
          case 'array':
            response[key] = ['mock_item_1', 'mock_item_2'];
            break;
          case 'object':
            response[key] = { mockField: 'mockValue' };
            break;
          default:
            response[key] = `Mock ${key}`;
        }
      });
    }

    return response;
  }

  /**
   * Helper methods for generating specific response types
   */
  private generateSituationAnalysis(userPrompt: string, context: MockContext): string {
    return `REQUEST: ${userPrompt}\nTOOLS: email, calendar, contacts, slack\nPARAMS: user=${context.userId || 'test_user'}\nSTATUS: Planning\nRESULT: [Empty for now]\nNOTES: Low risk operation, straightforward request`;
  }

  private generateWorkflowPlan(userPrompt: string, context: MockContext): string {
    return `REQUEST: ${userPrompt}\nTOOLS: gmail_search, calendar_create, slack_post\nPARAMS: Specific parameters based on request\nSTATUS: Executing\nRESULT: Ready to execute planned actions\nNOTES: Multi-step workflow planned`;
  }

  private generateEnvironmentCheck(userPrompt: string, context: MockContext): string {
    return `REQUEST: ${userPrompt}\nTOOLS: All systems operational\nPARAMS: Authentication verified\nSTATUS: Ready\nRESULT: Environment ready for execution\nNOTES: All required services available`;
  }

  private generateActionExecution(userPrompt: string, context: MockContext): string {
    return `REQUEST: ${userPrompt}\nTOOLS: Executed successfully\nPARAMS: All parameters processed\nSTATUS: Complete\nRESULT: Actions completed successfully\nNOTES: All operations successful`;
  }

  private generateFinalResponse(userPrompt: string, context: MockContext): string {
    return `I've successfully processed your request: "${userPrompt}". The task has been completed and all necessary actions have been taken.`;
  }

  private generateContextString(userPrompt: string, context: MockContext): string {
    return `REQUEST: ${userPrompt}\nUSER: ${context.userId || 'test_user'}\nTIME: ${context.currentTime || new Date()}\nSTATUS: Processing\nRESULT: Mock context generated\nNOTES: E2E testing context`;
  }

  private extractUserIntent(userPrompt: string): string {
    const lowerPrompt = userPrompt.toLowerCase();
    if (lowerPrompt.includes('schedule') || lowerPrompt.includes('meeting')) return 'schedule_meeting';
    if (lowerPrompt.includes('send') || lowerPrompt.includes('email')) return 'send_email';
    if (lowerPrompt.includes('search') || lowerPrompt.includes('find')) return 'search_content';
    return 'general_assistance';
  }

  private identifyRequiredActions(userPrompt: string): string[] {
    const actions = [];
    const lowerPrompt = userPrompt.toLowerCase();

    if (lowerPrompt.includes('email')) actions.push('gmail_operation');
    if (lowerPrompt.includes('calendar') || lowerPrompt.includes('schedule')) actions.push('calendar_operation');
    if (lowerPrompt.includes('contact')) actions.push('contacts_operation');
    if (lowerPrompt.includes('slack')) actions.push('slack_operation');

    return actions.length > 0 ? actions : ['general_assistance'];
  }

  private generateWorkflowSteps(userPrompt: string): string[] {
    return [
      'Analyze user request',
      'Identify required tools',
      'Execute primary action',
      'Verify completion',
      'Generate response'
    ];
  }

  private generateExecutedActions(userPrompt: string): string[] {
    return ['Mock action 1 executed', 'Mock action 2 completed'];
  }

  private generateActionResults(userPrompt: string): any {
    return {
      status: 'success',
      message: 'All actions completed successfully',
      data: { mockResult: true }
    };
  }

  private generateNextSteps(userPrompt: string): string[] {
    return ['Provide response to user', 'Log completion status'];
  }

  private generateSummary(userPrompt: string): string {
    return `Successfully processed request: ${userPrompt.substring(0, 50)}...`;
  }

  /**
   * Generate mock embedding vector
   */
  private generateMockEmbedding(text: string): number[] {
    // Generate a 1536-dimensional embedding (OpenAI text-embedding-ada-002 size)
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      // Generate values that somewhat correlate with text content
      const seed = text.charCodeAt(i % text.length) + i;
      embedding.push((Math.sin(seed) + Math.cos(seed * 0.7)) * 0.5);
    }
    return embedding;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough approximation: 1 token ≈ 4 characters
  }

  /**
   * Default response for unhandled endpoints
   */
  async getDefaultResponse(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return {
      success: true,
      data: {
        message: 'Mock response for OpenAI API',
        endpoint: request.endpoint,
        method: request.method,
        timestamp: new Date().toISOString()
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: request.endpoint,
      metadata: {
        requestId: `openai-default-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 500,
        cached: false
      }
    };
  }
}