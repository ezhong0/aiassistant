/**
 * Batch Thread Read Strategy
 *
 * Reads and analyzes email threads in parallel batches using LLM.
 * Each thread is analyzed independently with bounded context.
 *
 * Use cases:
 * - Extract waiting indicators from threads
 * - Identify questions/requests in threads
 * - Analyze urgency signals
 * - Understand response timelines
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult, BatchThreadParams, BatchThreadResult, ThreadSummary } from '../execution.types';
import { IEmailDomainService } from '../../../services/domain/interfaces/email-domain.interface';
import { IAIDomainService, StructuredSchema } from '../../../services/domain/interfaces/ai-domain.interface';

export class BatchThreadReadStrategy extends BaseStrategy {
  readonly type = 'batch_thread_read';

  constructor(
    private emailService: IEmailDomainService,
    private aiService: IAIDomainService
  ) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const batchParams = params as unknown as BatchThreadParams;
    const nodeId = (params as any).node_id || 'batch_thread_read';

    try {
      this.log('Executing batch thread read', {
        threadCount: batchParams.thread_ids.length,
        batchSize: batchParams.batch_size,
        extractFields: batchParams.extract_fields
      });

      // Process threads in batches
      const batches = this.chunkArray(batchParams.thread_ids, batchParams.batch_size);
      const allThreadSummaries: ThreadSummary[] = [];
      let totalTokens = 0;
      let totalLlmCalls = 0;

      for (const batch of batches) {
        this.log(`Processing batch of ${batch.length} threads`);

        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(threadId => this.analyzeThread(userId, threadId, batchParams.extract_fields))
        );

        allThreadSummaries.push(...batchResults);
        totalTokens += batchResults.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
        totalLlmCalls += batchResults.length;
      }

      const result: BatchThreadResult = {
        count: allThreadSummaries.length,
        threads: allThreadSummaries,
        metadata: {
          tokens_used: totalTokens,
          llm_calls: totalLlmCalls
        }
      };

      return this.createSuccessResult(nodeId, result, totalTokens);
    } catch (error: any) {
      this.log('Error executing batch thread read', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Analyze a single thread using LLM
   */
  private async analyzeThread(
    userId: string,
    threadId: string,
    extractFields: string[]
  ): Promise<ThreadSummary> {
    try {
      // Get thread content
      const thread = await this.emailService.getEmailThread(threadId);

      // Build thread content for analysis
      const threadContent = this.formatThreadForAnalysis(thread, userId);

      // Build extraction schema based on requested fields
      const schema = this.buildExtractionSchema(extractFields);

      // Create analysis prompt
      const prompt = this.buildThreadAnalysisPrompt(threadContent, extractFields);

      // Call LLM with bounded context
      const extracted = await this.aiService.generateStructuredData({
        prompt,
        schema,
        systemPrompt: 'You are an expert email analyst. Extract requested information accurately from email threads.',
        temperature: 0.1,
        maxTokens: 500 // Bounded output
      });

      // Estimate token usage (rough approximation)
      const tokensUsed = Math.ceil(prompt.length / 4) + 500;

      return {
        thread_id: threadId,
        ...extracted,
        tokens_used: tokensUsed
      } as ThreadSummary;
    } catch (error: any) {
      this.log('Error analyzing thread', { threadId, error: error.message });

      // Return error summary
      return {
        thread_id: threadId,
        context: `Error analyzing thread: ${error.message}`,
        tokens_used: 0
      };
    }
  }

  /**
   * Format thread for LLM analysis
   */
  private formatThreadForAnalysis(thread: any, userId: string): string {
    const messages = thread.messages || [];

    // Get user's email addresses from the thread
    const userEmails = this.extractUserEmails(messages, userId);

    let formatted = `Email Thread (${messages.length} messages)\n\n`;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isFromUser = userEmails.some(email =>
        msg.from.toLowerCase().includes(email.toLowerCase())
      );

      formatted += `--- Message ${i + 1} of ${messages.length} ---\n`;
      formatted += `From: ${msg.from}${isFromUser ? ' [USER]' : ''}\n`;
      formatted += `To: ${msg.to.join(', ')}\n`;
      formatted += `Date: ${msg.date.toISOString()}\n`;
      formatted += `Subject: ${msg.subject}\n\n`;

      // Use body text or snippet, truncate if too long
      const body = msg.body?.text || msg.snippet || '';
      const truncatedBody = body.length > 1000 ? body.substring(0, 1000) + '...[truncated]' : body;
      formatted += `${truncatedBody}\n\n`;
    }

    return formatted;
  }

  /**
   * Extract user's email addresses from messages
   */
  private extractUserEmails(messages: any[], userId: string): string[] {
    const userEmails = new Set<string>();

    // Look through messages to identify user's email
    for (const msg of messages) {
      // Check if message is from user (simple heuristic)
      if (msg.from && !msg.from.includes('@gmail.com')) {
        // More sophisticated logic could be added here
      }
    }

    return Array.from(userEmails);
  }

  /**
   * Build extraction schema based on requested fields
   */
  private buildExtractionSchema(extractFields: string[]): StructuredSchema {
    const properties: Record<string, StructuredSchema> = {};

    for (const field of extractFields) {
      switch (field) {
        case 'last_sender':
          properties.last_sender = {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              timestamp: { type: 'string' },
              user_is_recipient: { type: 'boolean' }
            },
            required: ['name', 'email', 'timestamp', 'user_is_recipient']
          };
          break;

        case 'question_or_request':
          properties.question_or_request = {
            type: 'object',
            properties: {
              present: { type: 'boolean' },
              type: { type: 'string', enum: ['question', 'approval', 'action_request', 'none'] },
              specific_ask: { type: 'string' }
            },
            required: ['present', 'type']
          };
          break;

        case 'waiting_indicators':
          properties.waiting_indicators = {
            type: 'object',
            properties: {
              present: { type: 'boolean' },
              phrases_found: { type: 'array', items: { type: 'string' } },
              follow_up_count: { type: 'number' }
            },
            required: ['present', 'phrases_found', 'follow_up_count']
          };
          break;

        case 'response_timeline':
          properties.response_timeline = {
            type: 'object',
            properties: {
              user_last_responded_date: { type: 'string' },
              days_since_user_responded: { type: 'number' },
              days_sender_waiting: { type: 'number' }
            }
          };
          break;

        case 'urgency_signals':
          properties.urgency_signals = {
            type: 'object',
            properties: {
              level: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
              evidence: { type: 'array', items: { type: 'string' } },
              deadline_mentioned: { type: 'string' }
            },
            required: ['level', 'evidence']
          };
          break;

        case 'context':
          properties.context = {
            type: 'string',
            description: 'Brief summary of what this thread is about (1-2 sentences)',
            maxLength: 500
          };
          break;
      }
    }

    // Always include context
    if (!properties.context) {
      properties.context = {
        type: 'string',
        description: 'Brief summary of what this thread is about (1-2 sentences)',
        maxLength: 500
      };
    }

    return {
      type: 'object',
      properties,
      required: ['context'],
      additionalProperties: false
    };
  }

  /**
   * Build prompt for thread analysis
   */
  private buildThreadAnalysisPrompt(threadContent: string, extractFields: string[]): string {
    let prompt = `Analyze the following email thread and extract the requested information.\n\n`;

    prompt += `THREAD CONTENT:\n${threadContent}\n\n`;

    prompt += `EXTRACTION INSTRUCTIONS:\n`;

    if (extractFields.includes('last_sender')) {
      prompt += `- last_sender: Identify who sent the most recent message. Determine if the user is the recipient.\n`;
    }
    if (extractFields.includes('question_or_request')) {
      prompt += `- question_or_request: Identify if there's an outstanding question or request directed at the user. Specify what type and what's being asked.\n`;
    }
    if (extractFields.includes('waiting_indicators')) {
      prompt += `- waiting_indicators: Look for phrases indicating someone is waiting for a response (e.g., "following up", "checking in", "any update", "waiting to hear").\n`;
    }
    if (extractFields.includes('response_timeline')) {
      prompt += `- response_timeline: Determine when the user last responded and how long the sender has been waiting.\n`;
    }
    if (extractFields.includes('urgency_signals')) {
      prompt += `- urgency_signals: Identify urgency indicators (e.g., "urgent", "ASAP", "deadline", time pressure, multiple follow-ups).\n`;
    }

    prompt += `- context: Provide a brief 1-2 sentence summary of what this thread is about.\n\n`;

    prompt += `Extract the information accurately based on the thread content. Use null for missing information.`;

    return prompt;
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
