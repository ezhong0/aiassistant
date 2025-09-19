import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { AIConfigService } from '../config/ai-config';
import { serviceManager } from './service-manager';

export interface RequestClassification {
  shouldProcessAsync: boolean;
  estimatedDuration: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'moderate' | 'complex';
  reasoning: string;
  suggestedJobType: 'ai_request' | 'send_email' | 'calendar_event' | 'confirmation_response';
}

export interface ClassificationContext {
  userInput: string;
  requestType?: string;
  userHistory?: {
    recentRequests: number;
    avgResponseTime: number;
  };
  systemLoad?: {
    currentQueueLength: number;
    avgProcessingTime: number;
  };
}

/**
 * LLM-powered service to classify requests for async processing
 * Determines which requests should be handled asynchronously vs synchronously
 */
export class AsyncRequestClassifierService extends BaseService {
  private openAIService: OpenAIService | null = null;
  private aiConfigService: AIConfigService | null = null;

  constructor() {
    super('AsyncRequestClassifierService');
  }

  protected async onInitialize(): Promise<void> {
    this.openAIService = serviceManager.getService<OpenAIService>('openaiService') || null;
    this.aiConfigService = serviceManager.getService<AIConfigService>('aiConfigService') || null;

    if (!this.openAIService) {
      throw new Error('OpenAIService is required for AsyncRequestClassifierService');
    }

    if (!this.aiConfigService) {
      throw new Error('AIConfigService is required for AsyncRequestClassifierService');
    }

    this.logInfo('AsyncRequestClassifierService initialized successfully');
  }

  protected async onDestroy(): Promise<void> {
    this.openAIService = null;
    this.aiConfigService = null;
  }

  /**
   * Classify a user request to determine if it should be processed asynchronously
   */
  async classifyRequest(context: ClassificationContext): Promise<RequestClassification> {
    try {
      const prompt = this.buildClassificationPrompt(context);

      // Use fast, cheap model for classification
      const config = this.aiConfigService!.getOpenAIConfig('analysis');

      const response = await this.openAIService!.createChatCompletion([
        {
          role: 'system',
          content: 'You are an expert at classifying user requests for async processing. Always respond with valid JSON only.'
        },
        { role: 'user', content: prompt }
      ], config.max_tokens);

      const classification = this.parseClassificationResponse(response.content);

      this.logDebug('Request classified', {
        userInput: context.userInput.substring(0, 100),
        shouldProcessAsync: classification.shouldProcessAsync,
        estimatedDuration: classification.estimatedDuration,
        complexity: classification.complexity
      });

      return classification;

    } catch (error) {
      this.logError('Failed to classify request', error, { userInput: context.userInput });

      // Safe fallback - process synchronously by default
      return {
        shouldProcessAsync: false,
        estimatedDuration: 'short',
        complexity: 'simple',
        reasoning: 'Classification failed, defaulting to synchronous processing',
        suggestedJobType: 'ai_request'
      };
    }
  }

  /**
   * Build the classification prompt with context
   */
  private buildClassificationPrompt(context: ClassificationContext): string {
    const { userInput, requestType, userHistory, systemLoad } = context;

    return `Analyze this user request and determine if it should be processed asynchronously:

REQUEST: "${userInput}"
${requestType ? `TYPE: ${requestType}` : ''}

CONTEXT:
${userHistory ? `- User recent requests: ${userHistory.recentRequests}, avg response time: ${userHistory.avgResponseTime}ms` : ''}
${systemLoad ? `- System queue length: ${systemLoad.currentQueueLength}, avg processing: ${systemLoad.avgProcessingTime}ms` : ''}

ASYNC PROCESSING CRITERIA:
- Operations taking >5 seconds (email searches, complex AI analysis)
- Multi-step workflows (email + calendar coordination)
- Large data processing (analyzing many emails/events)
- Content generation tasks (writing emails, documents)
- Complex calendar operations (finding meeting times for multiple people)

SYNC PROCESSING CRITERIA:
- Simple queries (single email lookup, basic calendar check)
- Quick responses (greetings, status checks)
- Real-time interactions (confirmations, simple Q&A)
- Operations under 3 seconds

Return JSON with this exact structure:
{
  "shouldProcessAsync": boolean,
  "estimatedDuration": "short" | "medium" | "long",
  "complexity": "simple" | "moderate" | "complex",
  "reasoning": "brief explanation",
  "suggestedJobType": "ai_request" | "send_email" | "calendar_event" | "confirmation_response"
}

DURATION MAPPING:
- short: <3 seconds
- medium: 3-10 seconds
- long: >10 seconds

JOB TYPE MAPPING:
- ai_request: General AI processing, analysis, content generation
- send_email: Email composition and sending
- calendar_event: Calendar operations, scheduling
- confirmation_response: User confirmations, simple responses`;
  }

  /**
   * Parse and validate the LLM classification response
   */
  private parseClassificationResponse(content: string | null): RequestClassification {
    if (!content) {
      throw new Error('Empty classification response');
    }

    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const required = ['shouldProcessAsync', 'estimatedDuration', 'complexity', 'reasoning', 'suggestedJobType'];
      for (const field of required) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate enum values
      const validDurations = ['short', 'medium', 'long'];
      const validComplexities = ['simple', 'moderate', 'complex'];
      const validJobTypes = ['ai_request', 'send_email', 'calendar_event', 'confirmation_response'];

      if (!validDurations.includes(parsed.estimatedDuration)) {
        throw new Error(`Invalid estimatedDuration: ${parsed.estimatedDuration}`);
      }

      if (!validComplexities.includes(parsed.complexity)) {
        throw new Error(`Invalid complexity: ${parsed.complexity}`);
      }

      if (!validJobTypes.includes(parsed.suggestedJobType)) {
        throw new Error(`Invalid suggestedJobType: ${parsed.suggestedJobType}`);
      }

      return parsed as RequestClassification;

    } catch (error) {
      this.logError('Failed to parse classification response', error, { content });
      throw new Error(`Invalid classification response: ${error}`);
    }
  }

  /**
   * Get system context for classification
   */
  async getSystemContext(): Promise<Partial<ClassificationContext['systemLoad']>> {
    try {
      // Get current job queue stats if available
      const jobQueueService = serviceManager.getService('jobQueueService') as any;
      if (jobQueueService && typeof jobQueueService.getQueueStats === 'function') {
        const stats = await jobQueueService.getQueueStats();
        return {
          currentQueueLength: stats.totalJobs || 0,
          avgProcessingTime: stats.avgProcessingTime || 1000
        };
      }

      return {};
    } catch (error) {
      this.logError('Failed to get system context', error);
      return {};
    }
  }

  /**
   * Quick classification for common patterns (no LLM call needed)
   */
  quickClassify(userInput: string): RequestClassification | null {
    const input = userInput.toLowerCase().trim();

    // Quick sync patterns
    const syncPatterns = [
      /^(hi|hello|hey|thanks|thank you)\b/,
      /^(yes|no|ok|okay|sure)\b/,
      /^(help|status|ping)\b/,
      /\b(quick|simple|fast)\b/
    ];

    // Quick async patterns
    const asyncPatterns = [
      /\b(search|find|analyze|generate|create|write|compose)\b.*\b(email|calendar|meeting|document)\b/,
      /\b(all|many|multiple|several)\b.*\b(email|event|meeting)\b/,
      /\b(complex|detailed|comprehensive|thorough)\b/,
      /\b(schedule|coordinate|organize)\b.*\b(meeting|event)\b/
    ];

    for (const pattern of syncPatterns) {
      if (pattern.test(input)) {
        return {
          shouldProcessAsync: false,
          estimatedDuration: 'short',
          complexity: 'simple',
          reasoning: 'Quick pattern match - simple sync response',
          suggestedJobType: 'confirmation_response'
        };
      }
    }

    for (const pattern of asyncPatterns) {
      if (pattern.test(input)) {
        return {
          shouldProcessAsync: true,
          estimatedDuration: 'medium',
          complexity: 'moderate',
          reasoning: 'Quick pattern match - likely complex operation',
          suggestedJobType: 'ai_request'
        };
      }
    }

    return null; // Needs LLM classification
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const healthy = this.isReady() && !!this.openAIService && !!this.aiConfigService;
    return {
      healthy,
      details: {
        openAIService: !!this.openAIService,
        aiConfigService: !!this.aiConfigService,
        timestamp: new Date().toISOString()
      }
    };
  }
}