import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import { CacheService } from './cache.service';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface Job {
  id: string;
  type: 'ai_request' | 'send_email' | 'calendar_event' | 'confirmation_response';
  data: any;
  timestamp: number;
  priority: number;
  retryCount: number;
  maxRetries: number;
  userId?: string;
  sessionId?: string;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  result?: any;
  error?: string;
  completedAt: number;
  processingTime: number;
}

export class JobQueueService extends BaseService {
  private cacheService: CacheService | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly PROCESSING_INTERVAL = 1000; // Process jobs every 1 second
  private readonly JOB_TIMEOUT = 30000; // 30 seconds max per job

  constructor() {
    super('JobQueueService');
  }

  protected async onInitialize(): Promise<void> {
    // Get cache service (Redis) for job storage
    this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;

    if (!this.cacheService) {
      throw new Error('CacheService is required for JobQueueService');
    }

    // Start job processing
    this.startJobProcessing();

    this.logInfo('JobQueueService initialized successfully', {
      processingInterval: this.PROCESSING_INTERVAL,
      jobTimeout: this.JOB_TIMEOUT
    });
  }

  protected async onDestroy(): Promise<void> {
    // Stop job processing
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.logInfo('JobQueueService destroyed');
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    type: Job['type'],
    data: any,
    options: {
      priority?: number;
      maxRetries?: number;
      userId?: string;
      sessionId?: string;
    } = {}
  ): Promise<string> {
    const job: Job = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      priority: options.priority ?? this.getJobPriority(type),
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      userId: options.userId,
      sessionId: options.sessionId
    };

    try {
      // Add to appropriate priority queue
      const queueName = `jobs:${type}:${job.priority}`;
      await this.cacheService!.lpush(queueName, JSON.stringify(job));

      // Store job details for status tracking
      await this.cacheService!.setex(
        `job:${job.id}`,
        300, // 5 minutes TTL
        JSON.stringify({
          ...job,
          status: 'queued',
          queuedAt: Date.now()
        })
      );

      this.logInfo('Job added to queue', {
        jobId: job.id,
        type: job.type,
        priority: job.priority,
        queueName,
        userId: job.userId,
        sessionId: job.sessionId
      });

      return job.id;
    } catch (error) {
      this.logError('Failed to add job to queue', error, {
        jobType: type,
        jobData: data
      });
      throw error;
    }
  }

  /**
   * Get job priority based on type
   */
  private getJobPriority(type: Job['type']): number {
    const priorities = {
      'confirmation_response': 1, // Highest priority
      'ai_request': 2,
      'send_email': 3,
      'calendar_event': 4
    };
    return priorities[type] || 5;
  }

  /**
   * Start the job processing loop
   */
  private startJobProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextJob();
      }
    }, this.PROCESSING_INTERVAL);

    this.logInfo('Job processing started');
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      // Try to get jobs in priority order
      const queueNames = [
        'jobs:confirmation_response:1',
        'jobs:ai_request:2',
        'jobs:send_email:3',
        'jobs:calendar_event:4'
      ];

      let job: Job | null = null;
      let queueName: string | null = null;

      // Check each queue in priority order
      for (const queue of queueNames) {
        const jobData = await this.cacheService!.brpop(queue, 0.1); // 100ms timeout
        if (jobData) {
          try {
            job = JSON.parse(jobData);
            queueName = queue;
            break;
          } catch (parseError) {
            this.logError('Failed to parse job data', parseError, { queue, jobData });
          }
        }
      }

      if (job) {
        await this.handleJob(job, queueName!);
      }
    } catch (error) {
      this.logError('Error in job processing loop', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle a specific job
   */
  private async handleJob(job: Job, queueName: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Update job status
      await this.updateJobStatus(job.id, 'processing', {
        startedAt: startTime,
        queueName
      });

      this.logInfo('Processing job', {
        jobId: job.id,
        type: job.type,
        attempt: job.retryCount + 1,
        maxRetries: job.maxRetries
      });

      let result: any;

      // Process based on job type
      switch (job.type) {
        case 'ai_request':
          result = await this.handleAIRequest(job);
          break;
        case 'send_email':
          result = await this.handleEmailRequest(job);
          break;
        case 'calendar_event':
          result = await this.handleCalendarRequest(job);
          break;
        case 'confirmation_response':
          result = await this.handleConfirmationResponse(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      const completedAt = Date.now();
      const processingTime = completedAt - startTime;

      // Store successful result
      const jobResult: JobResult = {
        jobId: job.id,
        success: true,
        result,
        completedAt,
        processingTime
      };

      await this.storeJobResult(jobResult);
      await this.updateJobStatus(job.id, 'completed', { completedAt, processingTime });

      this.logInfo('Job completed successfully', {
        jobId: job.id,
        type: job.type,
        processingTime,
        userId: job.userId
      });

      // Notify completion if possible
      await this.notifyJobCompletion(job, jobResult);

    } catch (error) {
      await this.handleJobError(job, error, queueName);
    }
  }

  /**
   * Handle AI request jobs
   */
  private async handleAIRequest(job: Job): Promise<any> {
    const { message, context, eventType } = job.data;

    // Use SlackMessageProcessor for actual processing
    const slackMessageProcessor = serviceManager.getService('slackMessageProcessor');

    if (!slackMessageProcessor) {
      throw new Error('SlackMessageProcessor not available for AI request');
    }

    // Process through the existing pipeline
    const result = await (slackMessageProcessor as any).processMessage(message, context, eventType);

    return result;
  }

  /**
   * Handle email sending jobs
   */
  private async handleEmailRequest(job: Job): Promise<any> {
    // For now, return a placeholder - will be implemented when email jobs are added
    this.logInfo('Email job processing not yet implemented', { jobId: job.id });
    return { success: true, message: 'Email job processed (placeholder)' };
  }

  /**
   * Handle calendar event jobs
   */
  private async handleCalendarRequest(job: Job): Promise<any> {
    // For now, return a placeholder - will be implemented when calendar jobs are added
    this.logInfo('Calendar job processing not yet implemented', { jobId: job.id });
    return { success: true, message: 'Calendar job processed (placeholder)' };
  }

  /**
   * Handle confirmation response jobs
   */
  private async handleConfirmationResponse(job: Job): Promise<any> {
    const slackMessageProcessor = serviceManager.getService('slackMessageProcessor');

    if (!slackMessageProcessor) {
      throw new Error('SlackMessageProcessor not available');
    }

    // Use the existing confirmation processing
    const result = await (slackMessageProcessor as any).processMessage(
      job.data.message,
      job.data.context,
      job.data.eventType
    );
    return result;
  }

  /**
   * Handle job errors and retry logic
   */
  private async handleJobError(job: Job, error: any, queueName: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    this.logError('Job failed', error, {
      jobId: job.id,
      type: job.type,
      attempt: job.retryCount + 1,
      maxRetries: job.maxRetries
    });

    job.retryCount += 1;

    if (job.retryCount <= job.maxRetries) {
      // Retry the job with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, job.retryCount), 30000); // Max 30s delay

      setTimeout(async () => {
        await this.cacheService!.lpush(queueName, JSON.stringify(job));
        this.logInfo('Job requeued for retry', {
          jobId: job.id,
          attempt: job.retryCount,
          delay
        });
      }, delay);

      await this.updateJobStatus(job.id, 'retrying', {
        error: errorMessage,
        retryCount: job.retryCount,
        nextRetryAt: Date.now() + delay
      });
    } else {
      // Job failed permanently
      const jobResult: JobResult = {
        jobId: job.id,
        success: false,
        error: errorMessage,
        completedAt: Date.now(),
        processingTime: Date.now() - job.timestamp
      };

      await this.storeJobResult(jobResult);
      await this.updateJobStatus(job.id, 'failed', {
        error: errorMessage,
        failedAt: Date.now()
      });

      await this.notifyJobCompletion(job, jobResult);
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string, additionalData: any = {}): Promise<void> {
    try {
      const existing = await this.cacheService!.get<string>(`job:${jobId}`);
      if (existing) {
        const jobData = JSON.parse(existing);
        jobData.status = status;
        jobData.updatedAt = Date.now();
        // Safely serialize additionalData to avoid JSON.stringify errors
        const safeAdditionalData = this.sanitizeForJSON(additionalData);
        Object.assign(jobData, safeAdditionalData);

        await this.cacheService!.setex(`job:${jobId}`, 300, JSON.stringify(jobData));
      }
    } catch (error) {
      this.logError('Failed to update job status', error, { jobId, status });
    }
  }

  /**
   * Sanitize data for JSON serialization to avoid "[object Object]" errors
   */
  private sanitizeForJSON(data: any): any {
    try {
      // Test if the data can be safely stringified
      JSON.stringify(data);
      return data;
    } catch (error) {
      // If serialization fails, create a safe version
      if (data === null || data === undefined) return data;

      if (typeof data === 'object') {
        if (Array.isArray(data)) {
          return data.map(item => this.sanitizeForJSON(item));
        }

        const safe: any = {};
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            try {
              // Test if this specific property can be serialized
              JSON.stringify(data[key]);
              safe[key] = data[key];
            } catch {
              // If property can't be serialized, convert to string or skip
              if (typeof data[key] === 'function') {
                safe[key] = '[Function]';
              } else if (data[key] instanceof Error) {
                safe[key] = data[key].message;
              } else {
                safe[key] = String(data[key]);
              }
            }
          }
        }
        return safe;
      }

      // For primitives that somehow failed, convert to string
      return String(data);
    }
  }

  /**
   * Store job result for retrieval
   */
  private async storeJobResult(result: JobResult): Promise<void> {
    try {
      await this.cacheService!.setex(
        `result:${result.jobId}`,
        600, // 10 minutes TTL
        JSON.stringify(result)
      );
    } catch (error) {
      this.logError('Failed to store job result', error, { jobId: result.jobId });
    }
  }

  /**
   * Notify job completion (placeholder for WebSocket integration)
   */
  private async notifyJobCompletion(job: Job, result: JobResult): Promise<void> {
    // TODO: Integrate with WebSocket service when available
    // For now, we can use Slack notifications for immediate benefit

    if (job.userId && job.sessionId) {
      this.logInfo('Job completion notification', {
        jobId: job.id,
        userId: job.userId,
        sessionId: job.sessionId,
        success: result.success,
        processingTime: result.processingTime
      });

      // If this is a Slack-related job, we could send a Slack message
      if (job.data.context?.channel && job.data.context?.ts) {
        try {
          // For now, just log that we would send a notification
          // TODO: Implement Slack notification when WebSocket service is available
          this.logInfo('Would send Slack notification', {
            jobId: job.id,
            channel: job.data.context.channel,
            success: result.success
          });
        } catch (error) {
          this.logError('Failed to send Slack completion notification', error);
        }
      }
    }
  }

  /**
   * Format completion message for Slack
   */
  private formatCompletionMessage(job: Job, result: JobResult): string {
    if (!result.success) {
      return `🥺💔 Oops! Something went wrong with your request: ${result.error}. But don't worry, I'm still here to help! 💕`;
    }

    switch (job.type) {
      case 'ai_request':
        return result.result?.message || '🌟💖 Yay! Your request is all done and I\'m so happy I could help! ✨';
      case 'send_email':
        return '📧💕 Woohoo! Your email was sent successfully! I hope it brightens someone\'s day! ✨💖';
      case 'calendar_event':
        return '📅💖 Amazing! Your calendar event is all set! Your schedule is looking great! 🌟✨';
      default:
        return '🎉💕 Yay! Your request is complete and I\'m just so excited that I could help! ✨💖';
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const jobData = await this.cacheService!.get<string>(`job:${jobId}`);
      return jobData ? JSON.parse(jobData) : null;
    } catch (error) {
      this.logError('Failed to get job status', error, { jobId });
      return null;
    }
  }

  /**
   * Get job result
   */
  async getJobResult(jobId: string): Promise<JobResult | null> {
    try {
      const resultData = await this.cacheService!.get<string>(`result:${jobId}`);
      return resultData ? JSON.parse(resultData) : null;
    } catch (error) {
      this.logError('Failed to get job result', error, { jobId });
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    try {
      const stats: any = {
        queues: {},
        totalPending: 0,
        processing: this.isProcessing
      };

      const queueNames = [
        'jobs:confirmation_response:1',
        'jobs:ai_request:2',
        'jobs:send_email:3',
        'jobs:calendar_event:4'
      ];

      for (const queue of queueNames) {
        const length = await this.cacheService!.llen(queue);
        stats.queues[queue] = length;
        stats.totalPending += length;
      }

      return stats;
    } catch (error) {
      this.logError('Failed to get queue stats', error);
      return { error: 'Failed to get stats' };
    }
  }
}