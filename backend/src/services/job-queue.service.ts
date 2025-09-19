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

  // In-memory fallback for when Redis is unavailable
  private useMemoryFallback = false;
  private memoryQueues: Map<string, Job[]> = new Map();
  private memoryJobs: Map<string, any> = new Map();
  private memoryResults: Map<string, JobResult> = new Map();

  constructor() {
    super('JobQueueService');
  }

  protected async onInitialize(): Promise<void> {
    // Get cache service (Redis) for job storage
    this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;

    // Check if we should use in-memory fallback
    if (!this.cacheService || !await this.checkCacheServiceAvailability()) {
      this.useMemoryFallback = true;
      this.logWarn('Redis unavailable, using in-memory job queue fallback', {
        hasCacheService: !!this.cacheService,
        fallbackMode: true
      });
    }

    // Start job processing
    this.startJobProcessing();

    this.logInfo('JobQueueService initialized successfully', {
      processingInterval: this.PROCESSING_INTERVAL,
      jobTimeout: this.JOB_TIMEOUT,
      useMemoryFallback: this.useMemoryFallback
    });
  }

  /**
   * Check if cache service is actually available
   */
  private async checkCacheServiceAvailability(): Promise<boolean> {
    if (!this.cacheService) return false;

    try {
      // Try a simple operation to test connectivity
      await this.cacheService.set('health-check', 'ok', 1);
      await this.cacheService.del('health-check');
      return true;
    } catch (error) {
      this.logWarn('Cache service connectivity test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
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
      if (this.useMemoryFallback) {
        return await this.addJobToMemory(job);
      }

      // Add to appropriate priority queue (sanitize job data)
      const queueName = `jobs:${type}:${job.priority}`;
      const safeJob = this.sanitizeForJSON(job);
      await this.cacheService!.lpush(queueName, JSON.stringify(safeJob));

      // Store job details for status tracking (sanitize data for JSON)
      const safeJobData = this.sanitizeForJSON({
        ...job,
        status: 'queued',
        queuedAt: Date.now()
      });

      await this.cacheService!.setex(
        `job:${job.id}`,
        300, // 5 minutes TTL
        JSON.stringify(safeJobData)
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
      let job: Job | null = null;
      let queueName: string | null = null;

      if (this.useMemoryFallback) {
        // Use memory fallback
        const jobData = this.getNextJobFromMemory();
        if (jobData) {
          job = jobData.job;
          queueName = jobData.queueName;
        }
      } else {
        // Use Redis queues
        const queueNames = [
          'jobs:confirmation_response:1',
          'jobs:ai_request:2',
          'jobs:send_email:3',
          'jobs:calendar_event:4'
        ];

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

    // IMPORTANT: Use internal sync processing to avoid infinite loop
    // Jobs are already queued for async processing, so we should process them synchronously
    // to avoid creating new async jobs
    const result = await (slackMessageProcessor as any).processMessageInternal(message, context, eventType);

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
      if (this.useMemoryFallback) {
        this.updateJobStatusInMemory(jobId, status, additionalData);
        return;
      }

      const existing = await this.cacheService!.get<any>(`job:${jobId}`);
      if (existing) {
        let jobData: any;

        // The cache service already parses JSON, so existing is already an object
        if (typeof existing === 'object' && existing !== null) {
          jobData = existing;
        } else {
          // If existing is not an object (shouldn't happen with current cache implementation), 
          // try to parse it as JSON string
          try {
            jobData = typeof existing === 'string' ? JSON.parse(existing) : existing;
          } catch (parseError) {
            // If existing data is corrupted, create a new job object
            this.logWarn('Corrupted job data found, creating new job object', {
              jobId,
              existing: this.safeStringify(existing),
              parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
            });

            jobData = {
              id: jobId,
              status: 'unknown',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
          }
        }

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
   * Safely convert any value to a string for logging purposes
   */
  private safeStringify(data: any): string {
    try {
      if (typeof data === 'string') {
        return data.length > 100 ? data.substring(0, 100) + '...' : data;
      }
      if (data === null || data === undefined) {
        return String(data);
      }
      const str = JSON.stringify(data);
      return str.length > 100 ? str.substring(0, 100) + '...' : str;
    } catch (error) {
      return `[Unstringifiable object: ${typeof data}]`;
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
      if (this.useMemoryFallback) {
        this.storeJobResultInMemory(result);
        return;
      }

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
   * Notify job completion and send Slack response
   */
  private async notifyJobCompletion(job: Job, result: JobResult): Promise<void> {
    if (job.userId && job.sessionId) {
      this.logInfo('Job completion notification', {
        jobId: job.id,
        userId: job.userId,
        sessionId: job.sessionId,
        success: result.success,
        processingTime: result.processingTime
      });

      // If this is a Slack-related job, send the result back to Slack
      if (job.data.slackChannelId && job.data.slackUserId) {
        try {
          await this.sendSlackCompletionNotification(job, result);
        } catch (error) {
          this.logError('Failed to send Slack completion notification', error);
        }
      }
    }
  }

  /**
   * Send job completion result back to Slack
   */
  private async sendSlackCompletionNotification(job: Job, result: JobResult): Promise<void> {
    try {
      const slackInterface = serviceManager.getService('slackInterface');
      if (!slackInterface) {
        this.logWarn('SlackInterface not available for completion notification');
        return;
      }

      // Extract Slack context from job data
      const channelId = job.data.slackChannelId;
      const userId = job.data.slackUserId;
      const context = job.data.context; // Full SlackContext for thread_ts

      if (!channelId || !userId) {
        this.logWarn('Missing Slack context for completion notification', {
          jobId: job.id,
          hasChannelId: !!channelId,
          hasUserId: !!userId
        });
        return;
      }

      // Format the response message
      let responseText: string;
      if (result.success && result.result) {
        // Extract the formatted message from the result
        if (result.result.message) {
          responseText = result.result.message;
        } else if (result.result.text) {
          responseText = result.result.text;
        } else {
          responseText = '✅ Your request has been completed successfully!';
        }
      } else {
        responseText = '❌ Sorry, I encountered an issue processing your request. Please try again.';
      }

      // Send the response back to Slack
      await (slackInterface as any).sendSlackMessage(channelId, {
        text: responseText,
        thread_ts: context?.ts // Reply in thread if available
      });

      this.logInfo('Slack completion notification sent', {
        jobId: job.id,
        channelId,
        userId,
        success: result.success,
        messageLength: responseText.length
      });

    } catch (error) {
      this.logError('Error sending Slack completion notification', error, {
        jobId: job.id,
        hasContext: !!job.data.context
      });
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
      if (this.useMemoryFallback) {
        return this.memoryJobs.get(jobId) || null;
      }

      const jobData = await this.cacheService!.get<any>(`job:${jobId}`);
      return jobData; // Cache service already parses JSON
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
      if (this.useMemoryFallback) {
        return this.memoryResults.get(jobId) || null;
      }

      const resultData = await this.cacheService!.get<JobResult>(`result:${jobId}`);
      return resultData; // Cache service already parses JSON
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
        processing: this.isProcessing,
        useMemoryFallback: this.useMemoryFallback
      };

      const queueNames = [
        'jobs:confirmation_response:1',
        'jobs:ai_request:2',
        'jobs:send_email:3',
        'jobs:calendar_event:4'
      ];

      if (this.useMemoryFallback) {
        for (const queue of queueNames) {
          const length = this.memoryQueues.get(queue)?.length || 0;
          stats.queues[queue] = length;
          stats.totalPending += length;
        }
      } else {
        for (const queue of queueNames) {
          const length = await this.cacheService!.llen(queue);
          stats.queues[queue] = length;
          stats.totalPending += length;
        }
      }

      return stats;
    } catch (error) {
      this.logError('Failed to get queue stats', error);
      return { error: 'Failed to get stats' };
    }
  }

  // ===============================
  // MEMORY FALLBACK METHODS
  // ===============================

  /**
   * Add job to in-memory queue
   */
  private async addJobToMemory(job: Job): Promise<string> {
    const queueName = `jobs:${job.type}:${job.priority}`;

    if (!this.memoryQueues.has(queueName)) {
      this.memoryQueues.set(queueName, []);
    }

    this.memoryQueues.get(queueName)!.push(job);

    // Store job status
    this.memoryJobs.set(job.id, {
      ...job,
      status: 'queued',
      queuedAt: Date.now()
    });

    this.logInfo('Job added to memory queue', {
      jobId: job.id,
      type: job.type,
      priority: job.priority,
      queueName,
      userId: job.userId,
      sessionId: job.sessionId,
      memoryMode: true
    });

    return job.id;
  }

  /**
   * Get next job from memory queues
   */
  private getNextJobFromMemory(): { job: Job; queueName: string } | null {
    const queueNames = [
      'jobs:confirmation_response:1',
      'jobs:ai_request:2',
      'jobs:send_email:3',
      'jobs:calendar_event:4'
    ];

    for (const queueName of queueNames) {
      const queue = this.memoryQueues.get(queueName);
      if (queue && queue.length > 0) {
        const job = queue.shift()!;
        return { job, queueName };
      }
    }

    return null;
  }

  /**
   * Update job status in memory
   */
  private updateJobStatusInMemory(jobId: string, status: string, additionalData: any = {}): void {
    const existing = this.memoryJobs.get(jobId);
    if (existing) {
      this.memoryJobs.set(jobId, {
        ...existing,
        status,
        updatedAt: Date.now(),
        ...additionalData
      });
    }
  }

  /**
   * Store job result in memory
   */
  private storeJobResultInMemory(result: JobResult): void {
    this.memoryResults.set(result.jobId, result);
  }
}