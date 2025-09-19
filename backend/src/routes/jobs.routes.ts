import express, { Request, Response } from 'express';
import { serviceManager } from '../services/service-manager';
import { JobQueueService } from '../services/job-queue.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { apiRateLimit } from '../middleware/rate-limiting.middleware';
import { EnhancedLogger, LogContext, createLogContext } from '../utils/enhanced-logger';

const router = express.Router();

/**
 * Get job status by ID
 */
router.get('/status/:jobId', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService');
    if (!jobQueueService) {
      return res.status(503).json({
        success: false,
        error: 'Job queue service is not available'
      });
    }

    const jobStatus = await jobQueueService.getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.json({
      success: true,
      job: jobStatus
    });

  } catch (error) {
    const logContext = createLogContext(req, { operation: 'job_status' });
    EnhancedLogger.error('Error getting job status', error as Error, logContext);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get job result by ID
 */
router.get('/result/:jobId', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService');
    if (!jobQueueService) {
      return res.status(503).json({
        success: false,
        error: 'Job queue service is not available'
      });
    }

    const jobResult = await jobQueueService.getJobResult(jobId);

    if (!jobResult) {
      return res.status(404).json({
        success: false,
        error: 'Job result not found'
      });
    }

    return res.json({
      success: true,
      result: jobResult
    });

  } catch (error) {
    const logContext = createLogContext(req, { operation: 'job_result' });
    EnhancedLogger.error('Error getting job result', error as Error, logContext);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get queue statistics (admin only)
 */
router.get('/stats', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const jobQueueService = serviceManager.getService<JobQueueService>('jobQueueService');
    if (!jobQueueService) {
      return res.status(503).json({
        success: false,
        error: 'Job queue service is not available'
      });
    }

    const stats = await jobQueueService.getQueueStats();

    return res.json({
      success: true,
      stats
    });

  } catch (error) {
    const logContext = createLogContext(req, { operation: 'queue_stats' });
    EnhancedLogger.error('Error getting queue stats', error as Error, logContext);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;