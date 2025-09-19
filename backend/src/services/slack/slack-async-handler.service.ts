import { BaseService } from '../base-service';
import { SlackContext, SlackEventType } from '../../types/slack/slack.types';
import { AsyncRequestClassifierService, ClassificationContext } from '../async-request-classifier.service';
import { JobQueueService } from '../job-queue.service';
import { ResponsePersonalityService, ResponseContext } from '../response-personality.service';
import { serviceManager } from '../service-manager';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AsyncSlackResponse {
  shouldProcessAsync: boolean;
  immediateResponse?: {
    text: string;
    response_type?: 'in_channel' | 'ephemeral';
  };
  jobId?: string;
  estimatedCompletion?: Date;
}

/**
 * Handles async processing integration for Slack messages
 * Provides smart classification and immediate cute responses
 */
export class SlackAsyncHandlerService extends BaseService {
  private asyncClassifierService: AsyncRequestClassifierService | null = null;
  private jobQueueService: JobQueueService | null = null;
  private personalityService: ResponsePersonalityService | null = null;

  constructor() {
    super('SlackAsyncHandlerService');
  }

  protected async onInitialize(): Promise<void> {
    this.asyncClassifierService = serviceManager.getService<AsyncRequestClassifierService>('asyncRequestClassifierService') || null;
    this.jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService') || null;
    this.personalityService = serviceManager.getService<ResponsePersonalityService>('responsePersonalityService') || null;

    if (!this.asyncClassifierService) {
      throw new Error('AsyncRequestClassifierService is required for SlackAsyncHandlerService');
    }

    if (!this.jobQueueService) {
      this.logWarn('JobQueueService not available - async processing will fall back to sync');
    }

    this.logInfo('SlackAsyncHandlerService initialized successfully', {
      hasAsyncClassifier: !!this.asyncClassifierService,
      hasJobQueue: !!this.jobQueueService,
      hasPersonality: !!this.personalityService
    });
  }

  protected async onDestroy(): Promise<void> {
    this.asyncClassifierService = null;
    this.jobQueueService = null;
    this.personalityService = null;
  }

  /**
   * Analyze and handle a Slack message for potential async processing
   */
  async handleSlackMessage(
    message: string,
    context: SlackContext,
    eventType: SlackEventType
  ): Promise<AsyncSlackResponse> {
    try {
      // Build classification context
      const classificationContext: ClassificationContext = {
        userInput: message,
        requestType: 'slack_message',
        systemLoad: await this.getSystemLoad() as any
      };

      // Try quick classification first
      let classification = this.asyncClassifierService!.quickClassify(message);

      // If no quick match, use LLM classification
      if (!classification) {
        classification = await this.asyncClassifierService!.classifyRequest(classificationContext);
      }

      // If should process sync, return early
      if (!classification.shouldProcessAsync) {
        return {
          shouldProcessAsync: false
        };
      }

      // Generate immediate cute response
      const immediateResponse = await this.generateImmediateResponse(message, classification);

      // If no job queue available, return sync recommendation
      if (!this.jobQueueService) {
        return {
          shouldProcessAsync: false,
          immediateResponse: {
            text: immediateResponse + ' (Processing synchronously due to system limitations)',
            response_type: 'in_channel'
          }
        };
      }

      // Queue the job for background processing
      const jobId = uuidv4();
      await this.jobQueueService.addJob(
        classification.suggestedJobType,
        {
          message,
          context,
          eventType,
          slackChannelId: context.channelId,
          slackUserId: context.userId,
          classification,
          timestamp: Date.now()
        },
        {
          priority: this.getJobPriority(classification.complexity),
          maxRetries: 3,
          userId: context.userId
        }
      );

      // Calculate estimated completion
      const estimatedMs = this.getEstimatedDuration(classification.estimatedDuration);
      const estimatedCompletion = new Date(Date.now() + estimatedMs);

      this.logInfo('Slack message queued for async processing', {
        jobId,
        message: message.substring(0, 100),
        classification: classification.suggestedJobType,
        estimatedDuration: classification.estimatedDuration,
        userId: context.userId
      });

      return {
        shouldProcessAsync: true,
        immediateResponse: {
          text: immediateResponse,
          response_type: 'in_channel'
        },
        jobId,
        estimatedCompletion
      };

    } catch (error) {
      this.logError('Error handling async Slack message', error, {
        message: message.substring(0, 100),
        userId: context.userId
      });

      // Safe fallback
      return {
        shouldProcessAsync: false,
        immediateResponse: {
          text: '🔄 Processing your request...',
          response_type: 'in_channel'
        }
      };
    }
  }

  /**
   * Generate a cute immediate response using personality service
   */
  private async generateImmediateResponse(message: string, classification: any): Promise<string> {
    try {
      if (!this.personalityService) {
        return this.getFallbackImmediateResponse(classification);
      }

      const responseContext: ResponseContext = {
        action: 'processing_async_request',
        success: true,
        details: {
          itemType: classification.suggestedJobType,
          count: 1
        }
      };

      const personalizedResponse = await this.personalityService.generateResponse(responseContext);

      // Add processing indicator
      const processingHints = [
        'I\'m working on this for you!',
        'Give me a moment to think about this!',
        'Processing your request now!',
        'Working on it!'
      ];

      const hint = processingHints[Math.floor(Math.random() * processingHints.length)];

      return `${personalizedResponse} ${hint}`;

    } catch (error) {
      this.logError('Failed to generate personalized immediate response', error);
      return this.getFallbackImmediateResponse(classification);
    }
  }

  /**
   * Get fallback immediate response
   */
  private getFallbackImmediateResponse(classification: any): string {
    const responses = {
      'short': '🔄 Just a sec! Working on this for you!',
      'medium': '⏳ This might take a moment - I\'m analyzing everything thoroughly!',
      'long': '🤔 This is a complex request! I\'m processing it carefully and will get back to you soon!'
    };

    return responses[classification.estimatedDuration as keyof typeof responses] || responses.medium;
  }

  /**
   * Get job priority based on complexity
   */
  private getJobPriority(complexity: string): number {
    switch (complexity) {
      case 'complex': return 1;
      case 'moderate': return 2;
      case 'simple': return 3;
      default: return 2;
    }
  }

  /**
   * Get job timeout based on estimated duration
   */
  private getJobTimeout(duration: string): number {
    switch (duration) {
      case 'long': return 60000;  // 1 minute
      case 'medium': return 30000; // 30 seconds
      case 'short': return 15000;  // 15 seconds
      default: return 30000;
    }
  }

  /**
   * Get estimated duration in milliseconds
   */
  private getEstimatedDuration(duration: string): number {
    switch (duration) {
      case 'long': return 15000;   // 15 seconds
      case 'medium': return 8000;  // 8 seconds
      case 'short': return 3000;   // 3 seconds
      default: return 8000;
    }
  }

  /**
   * Get current system load for classification context
   */
  private async getSystemLoad(): Promise<Partial<ClassificationContext['systemLoad']>> {
    try {
      if (!this.jobQueueService) return {};

      const stats = await this.jobQueueService.getQueueStats();
      return {
        currentQueueLength: stats.totalJobs || 0,
        avgProcessingTime: stats.avgProcessingTime || 1000
      };
    } catch (error) {
      this.logError('Failed to get system load', error);
      return {};
    }
  }

  /**
   * Check if a message should use async processing
   */
  shouldUseAsyncProcessing(message: string, context: SlackContext): boolean {
    // Quick heuristics for obvious sync cases
    const syncPatterns = [
      /^(hi|hello|hey|thanks|yes|no|ok)\s*$/i,
      /^(status|ping|help)\s*$/i
    ];

    for (const pattern of syncPatterns) {
      if (pattern.test(message.trim())) {
        return false;
      }
    }

    // Always use classification for anything else
    return true;
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const healthy = this.isReady() && !!this.asyncClassifierService;
    return {
      healthy,
      details: {
        asyncClassifier: !!this.asyncClassifierService,
        jobQueue: !!this.jobQueueService,
        personality: !!this.personalityService,
        timestamp: new Date().toISOString()
      }
    };
  }
}