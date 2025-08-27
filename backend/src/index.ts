import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
// Calculate path relative to the backend directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import configService from './config/config.service';
import logger from './utils/logger';
import { initializeAgentFactory } from './config/agent-factory-init';
import { initializeServices } from './services/service-manager';
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
import { apiRateLimit } from './middleware/rate-limiting.middleware';
import authRoutes from './routes/auth.routes';
import protectedRoutes from './routes/protected.routes';
import assistantRoutes from './routes/assistant.routes';
import healthRoutes from './routes/health';
// import { createSlackRoutes } from './routes/slack.routes';
import { serviceManager } from './services/service-manager';
// import { SlackService } from './services/slack.service';

// Initialize services and AgentFactory
const initializeApplication = async (): Promise<void> => {
  try {
    // Initialize services first
    logger.info('Initializing application services...');
    await initializeServices();
    logger.info('Application services initialized successfully');

    // Initialize AgentFactory after services
    logger.info('Initializing AgentFactory...');
    initializeAgentFactory();
    logger.info('AgentFactory initialized successfully');

    logger.info('Application initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    // Continue anyway - the app can still function with basic routing
  }
}

const app = express();
const port = configService.port;

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

// Rate limiting (apply to all routes)
app.use(apiRateLimit);

// Health check (before other routes)
app.use('/health', healthRoutes);

// API Routes
app.use('/auth', authRoutes);
app.use('/protected', protectedRoutes);
app.use('/api/assistant', assistantRoutes);

// Slack routes (temporarily disabled)
// app.use('/slack', createSlackRoutes(serviceManager));

// Slack Bolt event handler integration (temporarily disabled)
// const setupSlackEventHandler = () => {
//   const slackService = serviceManager.getService<SlackService>('slackService');
//   if (slackService) {
//     const receiver = slackService.getReceiver();
//     if (receiver) {
//       // Use the receiver's router for Slack events
//       app.use(receiver.router);
//       logger.info('Slack event handler integrated successfully');
//     }
//   }
// };

// Set up Slack event handler after services are initialized
// setTimeout(setupSlackEventHandler, 1000);

// Simple test endpoint for debugging
app.get('/test', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

    // Start the server
    const server = app.listen(port, () => {
      logger.info('Server started successfully', {
        port,
        environment: configService.nodeEnv,
        nodeVersion: process.version,
        pid: process.pid,
        timestamp: new Date().toISOString()
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

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
