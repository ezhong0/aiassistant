import express, { Request, Response } from 'express';
import { serviceManager } from '../services/service-manager';
import { JobQueueService } from '../services/job-queue.service';
import { AsyncRequestClassifierService, ClassificationContext } from '../services/async-request-classifier.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { apiRateLimit } from '../middleware/rate-limiting.middleware';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface AsyncRequestBody {
  userInput: string;
  requestType?: string;
  context?: {
    userId?: string;
    channelId?: string;
    platform?: 'slack' | 'api' | 'web';
    metadata?: Record<string, any>;
  };
  forceAsync?: boolean; // Override classification
  callback?: {
    webhook?: string;
    platform?: 'slack';
    channelId?: string;
    userId?: string;
  };
}

interface AsyncRequestResponse {
  success: boolean;
  jobId: string;
  classification: {
    shouldProcessAsync: boolean;
    estimatedDuration: string;
    complexity: string;
    reasoning: string;
  };
  estimatedCompletion?: Date;
  statusUrl: string;
  resultUrl: string;
  error?: string;
}

/**
 * Submit a request for async processing
 */
router.post('/submit', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const body: AsyncRequestBody = req.body;

    // Validate required fields
    if (!body.userInput || typeof body.userInput !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userInput is required and must be a string'
      });
    }

    // Get services
    const classifierService = serviceManager.getService<AsyncRequestClassifierService>('asyncRequestClassifierService');
    const jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService');

    if (!classifierService) {
      return res.status(503).json({
        success: false,
        error: 'Request classification service is not available'
      });
    }

    if (!jobQueueService) {
      return res.status(503).json({
        success: false,
        error: 'Job queue service is not available'
      });
    }

    // Build classification context
    const systemContext = await classifierService.getSystemContext();
    const classificationContext: ClassificationContext = {
      userInput: body.userInput,
      requestType: body.requestType,
      systemLoad: systemContext as any
    };

    // Classify the request (unless forced)
    let classification;
    if (body.forceAsync) {
      classification = {
        shouldProcessAsync: true,
        estimatedDuration: 'medium' as const,
        complexity: 'moderate' as const,
        reasoning: 'Forced async processing by user request',
        suggestedJobType: 'ai_request' as const
      };
    } else {
      // Try quick classification first
      classification = classifierService.quickClassify(body.userInput);

      // If no quick match, use LLM classification
      if (!classification) {
        classification = await classifierService.classifyRequest(classificationContext);
      }
    }

    // If classified as sync, return immediate processing recommendation
    if (!classification.shouldProcessAsync && !body.forceAsync) {
      return res.json({
        success: true,
        classification,
        recommendation: 'PROCESS_SYNC',
        message: 'Request should be processed synchronously for best user experience'
      });
    }

    // Generate job ID and prepare job data
    const jobId = uuidv4();
    const jobData = {
      userInput: body.userInput,
      requestType: body.requestType,
      context: body.context,
      callback: body.callback,
      classification,
      submittedAt: new Date().toISOString(),
      submittedBy: (req as any).user?.id || 'unknown'
    };

    // Queue the job
    await jobQueueService.addJob(
      classification.suggestedJobType,
      jobData,
      {
        priority: classification.complexity === 'complex' ? 1 :
                  classification.complexity === 'moderate' ? 2 : 3,
        maxRetries: 3,
        userId: (req as any).user?.id || 'unknown'
      }
    );

    // Calculate estimated completion
    const estimatedMs = classification.estimatedDuration === 'long' ? 15000 :
                        classification.estimatedDuration === 'medium' ? 8000 : 3000;
    const estimatedCompletion = new Date(Date.now() + estimatedMs);

    // Prepare response
    const response: AsyncRequestResponse = {
      success: true,
      jobId,
      classification: {
        shouldProcessAsync: classification.shouldProcessAsync,
        estimatedDuration: classification.estimatedDuration,
        complexity: classification.complexity,
        reasoning: classification.reasoning
      },
      estimatedCompletion,
      statusUrl: `/api/jobs/status/${jobId}`,
      resultUrl: `/api/jobs/result/${jobId}`
    };

    logger.info('Async request submitted', {
      jobId,
      userInput: body.userInput.substring(0, 100),
      classification: classification.suggestedJobType,
      estimatedDuration: classification.estimatedDuration
    });

    return res.status(202).json(response); // 202 Accepted

  } catch (error) {
    logger.error('Error submitting async request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get classification for a request without submitting it
 */
router.post('/classify', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { userInput, requestType } = req.body;

    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userInput is required and must be a string'
      });
    }

    const classifierService = serviceManager.getService<AsyncRequestClassifierService>('asyncRequestClassifierService');
    if (!classifierService) {
      return res.status(503).json({
        success: false,
        error: 'Request classification service is not available'
      });
    }

    // Try quick classification first
    let classification = classifierService.quickClassify(userInput);

    // If no quick match, use LLM classification
    if (!classification) {
      const systemContext = await classifierService.getSystemContext();
      const classificationContext: ClassificationContext = {
        userInput,
        requestType,
        systemLoad: systemContext as any
      };

      classification = await classifierService.classifyRequest(classificationContext);
    }

    return res.json({
      success: true,
      classification,
      recommendation: classification.shouldProcessAsync ? 'PROCESS_ASYNC' : 'PROCESS_SYNC'
    });

  } catch (error) {
    logger.error('Error classifying request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get async request statistics
 */
router.get('/stats', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService');
    const classifierService = serviceManager.getService<AsyncRequestClassifierService>('asyncRequestClassifierService');

    if (!jobQueueService) {
      return res.status(503).json({
        success: false,
        error: 'Job queue service is not available'
      });
    }

    const queueStats = await jobQueueService.getQueueStats();
    const classifierHealth = classifierService?.getHealth();

    return res.json({
      success: true,
      stats: {
        queue: queueStats,
        classifier: classifierHealth,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting async request stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Health check for async request system
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService');
    const classifierService = serviceManager.getService<AsyncRequestClassifierService>('asyncRequestClassifierService');

    const health = {
      healthy: true,
      services: {
        jobQueue: jobQueueService?.getHealth() || { healthy: false },
        classifier: classifierService?.getHealth() || { healthy: false }
      },
      timestamp: new Date().toISOString()
    };

    // Overall health is healthy if both services are healthy
    health.healthy = health.services.jobQueue.healthy && health.services.classifier.healthy;

    const statusCode = health.healthy ? 200 : 503;
    return res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Error checking async request health:', error);
    return res.status(500).json({
      healthy: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;