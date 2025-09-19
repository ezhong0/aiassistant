import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
// Calculate path relative to the backend directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import { configService } from './config/config.service';
import logger from './utils/logger';
import { initializeAgentFactory } from './config/agent-factory-init';
import { initializeAllCoreServices } from './services/service-initialization';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { 
  corsMiddleware, 
  securityHeaders, 
  compressionMiddleware,
  apiSecurityHeaders,
  requestSizeLimiter,
  requestTimeout,
  sanitizeRequest
} from './middleware/security.middleware';
import authRoutes from './routes/auth.routes';
import protectedRoutes from './routes/protected.routes';
import assistantRoutes from './routes/assistant.routes';
import healthRoutes from './routes/health';
import enhancedHealthRoutes from './routes/enhanced-health.routes';
import jobRoutes from './routes/jobs.routes';
import asyncRequestRoutes from './routes/async-requests.routes';
import { createSlackRoutes } from './routes/slack.routes';
import { apiRateLimit } from './middleware/rate-limiting.middleware';
import { serviceManager } from './services/service-manager';
import { initializeInterfaces, startInterfaces, InterfaceManager } from './types/slack';

// Global interfaces store
let globalInterfaces: InterfaceManager | null = null;

// Initialize services and AgentFactory
const initializeApplication = async (): Promise<void> => {
  try {
    // Initialize all core services with enhanced dependency management
    await initializeAllCoreServices();

    // Initialize AgentFactory after services
    initializeAgentFactory();

    logger.info('Application initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error; // Don't continue with broken services in production
  }
}

const app = express();
// Railway provides PORT environment variable, use it or fallback to configService
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : configService.port;

// Trust proxy (for proper IP detection behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware (order matters)
app.use(requestTimeout(30000)); // 30 second timeout
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(compressionMiddleware);
app.use(apiSecurityHeaders);
app.use(requestSizeLimiter);

// Parse JSON with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request processing middleware
app.use(sanitizeRequest);
app.use(requestLogger);

// Log all incoming requests
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: JSON.stringify(req.query),
    body: JSON.stringify(req.body),
    headers: JSON.stringify(req.headers),
    timestamp: new Date().toISOString()
  });
  next();
});

// Rate limiting (apply to all routes)
app.use(apiRateLimit);

// Health check routes (before other routes)
app.use('/health', healthRoutes);
app.use('/health', enhancedHealthRoutes);

// API Routes
app.use('/auth', authRoutes);
app.use('/protected', protectedRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/async', asyncRequestRoutes);

// Slack routes - pass global interfaces for event handling
app.use('/slack', createSlackRoutes(serviceManager, () => globalInterfaces));

// Slack interface integration
const setupSlackInterface = async () => {
  try {
    globalInterfaces = await initializeInterfaces(serviceManager);
    if (globalInterfaces.slackInterface) {
      // Only initialize the SlackInterface service without mounting Bolt routes
      // The manual /slack/events endpoint handles all Slack events directly
      await startInterfaces(globalInterfaces);
      logger.debug('Slack interface initialized (manual routing)');
    } else {
      logger.info('Slack interface not available');
    }
  } catch (error) {
    logger.error('Error setting up Slack interface:', error);
  }
};

// Simple test endpoint for debugging
app.get('/test', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Railway health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  };
  res.status(200).json(healthStatus);
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Assistant App API',
    version: '1.0.0',
    environment: configService.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server and initialize services
const startServer = async (): Promise<void> => {
  try {
    // Initialize application services
    await initializeApplication();
    
    // Set up Slack interface after services are initialized
    await setupSlackInterface();

    // Start the server
    const server = app.listen(port, () => {
      logger.info('Server started successfully', {
        port,
        environment: configService.nodeEnv
      });
    });

    // Enhanced error handling
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Please check if another instance is running.`);
        process.exit(1);
      } else {
        logger.error('Server error:', err);
        process.exit(1);
      }
    });

    // Add keep-alive for Railway
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown:', err);
          process.exit(1);
        } else {
          logger.info('HTTP server closed');
          process.exit(0);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle unhandled errors to prevent crashes
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit on unhandled rejection in production
    });
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer().catch((error) => {
  logger.error('Fatal error during application startup:', error);
  process.exit(1);
});
