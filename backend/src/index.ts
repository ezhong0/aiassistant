import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
// Calculate path relative to the backend directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import configService from './config/config.service';
import logger from './utils/logger';
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
app.use('/assistant', assistantRoutes);

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
  } else {
    logger.error('Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Enhanced error handling
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception - shutting down:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection:', {
    reason,
    promise
  });
  // Don't exit on unhandled promise rejection in production
  if (configService.isDevelopment) {
    process.exit(1);
  }
});

logger.info('Server setup complete', {
  environment: configService.nodeEnv,
  configuration: 'loaded',
  security: 'enabled',
  rateLimit: 'enabled'
});
