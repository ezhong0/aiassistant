import { BaseService } from '../base-service';
import logger from '../../utils/logger';

/**
 * Mock OpenAI Service for development and testing
 *
 * Provides deterministic responses for AI operations without
 * making actual API calls to OpenAI. Useful for:
 * - Development environments without API keys
 * - Testing with predictable responses
 * - Rate limit testing and cost control
 */
export class OpenAIMockService extends BaseService {
  private responseTemplates: Map<string, any>;
  private callCount = 0;
  private latencySimulation = 200; // ms

  constructor() {
    super('openaiService');
    this.responseTemplates = new Map();
    this.initializeResponseTemplates();
  }

  protected async onInitialize(): Promise<void> {
    logger.info('OpenAI mock service initialized with response templates', {
      templateCount: this.responseTemplates.size,
      simulatedLatency: this.latencySimulation
    });
  }

  protected async onDestroy(): Promise<void> {
    this.responseTemplates.clear();
    logger.info('OpenAI mock service destroyed');
  }

  async createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    maxTokens?: number,
    options?: any
  ): Promise<{ content: string; usage?: any }> {
    this.callCount++;

    // Simulate API latency
    await this.simulateLatency();

    const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
    const systemPrompt = messages.find(msg => msg.role === 'system')?.content || '';

    logger.debug('Mock OpenAI chat completion', {
      messageCount: messages.length,
      userMessage: userMessage.substring(0, 100),
      maxTokens,
      callCount: this.callCount
    });

    // Generate response based on message content patterns
    const response = this.generateMockResponse(userMessage, systemPrompt, options);

    return {
      content: response,
      usage: {
        prompt_tokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
        completion_tokens: this.estimateTokens(response),
        total_tokens: this.estimateTokens(messages.map(m => m.content).join(' ') + response)
      }
    };
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: any
  ): Promise<string> {
    this.callCount++;

    // Simulate API latency
    await this.simulateLatency();

    logger.debug('Mock OpenAI text generation', {
      promptLength: prompt.length,
      hasSystemPrompt: !!systemPrompt,
      callCount: this.callCount
    });

    return this.generateMockResponse(prompt, systemPrompt, options);
  }

  private initializeResponseTemplates(): void {
    // Confirmation responses
    this.responseTemplates.set('confirmation_yes', [
      'confirm',
      'yes',
      'proceed',
      'go ahead'
    ]);

    this.responseTemplates.set('confirmation_no', [
      'reject',
      'no',
      'cancel',
      'abort'
    ]);

    // Tool routing responses
    this.responseTemplates.set('email_routing', {
      agent: 'emailAgent',
      confidence: 0.85,
      reasoning: 'User wants to perform email-related operation based on keywords like send, email, message'
    });

    this.responseTemplates.set('calendar_routing', {
      agent: 'calendarAgent',
      confidence: 0.90,
      reasoning: 'User wants to manage calendar events based on keywords like schedule, meeting, appointment'
    });

    this.responseTemplates.set('contact_routing', {
      agent: 'contactAgent',
      confidence: 0.75,
      reasoning: 'User wants to manage contacts based on keywords like contact, person, phone'
    });

    // Dynamic messages
    this.responseTemplates.set('confirmation_messages', [
      'I need your confirmation before proceeding with this action.',
      'Would you like me to go ahead with this operation?',
      'Please confirm if you want me to proceed.',
      'Should I continue with this request?'
    ]);

    this.responseTemplates.set('completion_messages', [
      'Task completed successfully!',
      'Operation finished as requested.',
      'I\'ve completed your request.',
      'Done! Your task has been processed.'
    ]);

    this.responseTemplates.set('error_messages', [
      'I encountered an issue while processing your request.',
      'Something went wrong with that operation.',
      'I wasn\'t able to complete that task.',
      'There was a problem with your request.'
    ]);
  }

  private generateMockResponse(userMessage: string, systemPrompt?: string, options?: any): string {
    const lowerMessage = userMessage.toLowerCase();

    // Confirmation classification
    if (systemPrompt?.includes('confirmation classifier') || lowerMessage.includes('classify')) {
      if (this.containsConfirmationWords(lowerMessage)) {
        return this.getRandomTemplate('confirmation_yes');
      } else if (this.containsRejectionWords(lowerMessage)) {
        return this.getRandomTemplate('confirmation_no');
      } else {
        return 'unknown';
      }
    }

    // Tool routing
    if (systemPrompt?.includes('tool routing') || systemPrompt?.includes('select agent')) {
      if (this.containsEmailKeywords(lowerMessage)) {
        const template = this.responseTemplates.get('email_routing');
        return JSON.stringify(template);
      } else if (this.containsCalendarKeywords(lowerMessage)) {
        const template = this.responseTemplates.get('calendar_routing');
        return JSON.stringify(template);
      } else if (this.containsContactKeywords(lowerMessage)) {
        const template = this.responseTemplates.get('contact_routing');
        return JSON.stringify(template);
      }
    }

    // Confirmation message generation
    if (systemPrompt?.includes('confirmation message') || lowerMessage.includes('confirm')) {
      return this.getRandomTemplate('confirmation_messages');
    }

    // Completion message generation
    if (systemPrompt?.includes('completion') || systemPrompt?.includes('accomplished')) {
      return this.getRandomTemplate('completion_messages');
    }

    // Error handling
    if (lowerMessage.includes('error') || lowerMessage.includes('failed')) {
      return this.getRandomTemplate('error_messages');
    }

    // General conversation
    if (systemPrompt?.includes('conversational') || !systemPrompt) {
      return this.generateConversationalResponse(lowerMessage);
    }

    // Default response
    return 'I understand your request and will help you with that.';
  }

  private containsConfirmationWords(message: string): boolean {
    const confirmWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'proceed', 'go ahead', 'confirm', 'continue'];
    return confirmWords.some(word => message.includes(word));
  }

  private containsRejectionWords(message: string): boolean {
    const rejectWords = ['no', 'nope', 'cancel', 'abort', 'stop', 'reject', 'deny', 'refuse'];
    return rejectWords.some(word => message.includes(word));
  }

  private containsEmailKeywords(message: string): boolean {
    const emailWords = ['email', 'send', 'message', 'mail', 'compose', 'reply', 'forward'];
    return emailWords.some(word => message.includes(word));
  }

  private containsCalendarKeywords(message: string): boolean {
    const calendarWords = ['calendar', 'schedule', 'meeting', 'appointment', 'event', 'book', 'reserve'];
    return calendarWords.some(word => message.includes(word));
  }

  private containsContactKeywords(message: string): boolean {
    const contactWords = ['contact', 'person', 'phone', 'address', 'people', 'find', 'search'];
    return contactWords.some(word => message.includes(word));
  }

  private getRandomTemplate(templateKey: string): string {
    const template = this.responseTemplates.get(templateKey);
    if (Array.isArray(template)) {
      const index = Math.floor(Math.random() * template.length);
      return template[index];
    }
    return template?.toString() || 'I can help you with that.';
  }

  private generateConversationalResponse(message: string): string {
    // Simple rule-based conversational responses
    if (message.includes('hello') || message.includes('hi')) {
      return 'Hello! How can I assist you today?';
    }

    if (message.includes('help')) {
      return 'I\'m here to help! I can assist with emails, calendar events, and contacts.';
    }

    if (message.includes('thank')) {
      return 'You\'re welcome! Is there anything else I can help you with?';
    }

    if (message.includes('goodbye') || message.includes('bye')) {
      return 'Goodbye! Feel free to reach out if you need assistance later.';
    }

    // Default conversational response
    const responses = [
      'I understand what you\'re asking for.',
      'Let me help you with that.',
      'I can assist you with this request.',
      'That sounds like something I can help with.',
      'I\'ll take care of that for you.'
    ];

    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex] || 'I can help you with that.';
  }

  private estimateTokens(text: string): number {
    // Rough token estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private async simulateLatency(): Promise<void> {
    // Add some random variation to latency (±50ms)
    const variation = Math.random() * 100 - 50;
    const actualLatency = Math.max(50, this.latencySimulation + variation);

    await new Promise(resolve => setTimeout(resolve, actualLatency));
  }

  // Configuration methods
  setLatencySimulation(ms: number): void {
    this.latencySimulation = Math.max(0, ms);
    logger.debug(`OpenAI mock latency set to ${this.latencySimulation}ms`);
  }

  addResponseTemplate(key: string, template: any): void {
    this.responseTemplates.set(key, template);
    logger.debug(`Added response template: ${key}`);
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
    logger.debug('OpenAI mock call count reset');
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: true,
      details: {
        type: 'mock',
        templates: this.responseTemplates.size,
        callCount: this.callCount,
        latencySimulation: this.latencySimulation
      }
    };
  }

  // Simulate API errors for testing
  async simulateError(errorType: 'rate_limit' | 'timeout' | 'auth' | 'quota'): Promise<void> {
    const errorMessages = {
      rate_limit: 'Rate limit exceeded. Please try again later.',
      timeout: 'Request timeout. The API request took too long.',
      auth: 'Authentication failed. Invalid API key.',
      quota: 'Quota exceeded. You have exceeded your API usage limit.'
    };

    const error = new Error(errorMessages[errorType]);
    (error as any).type = errorType;

    throw error;
  }
}