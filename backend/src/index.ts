import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
// Calculate path relative to the backend directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import { configService } from './config/config.service';
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
    
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
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

// Slack routes - pass global interfaces for event handling
app.use('/slack', createSlackRoutes(serviceManager, () => globalInterfaces));

// Slack interface integration (runs in background, completely optional)
const setupSlackInterface = async () => {
  try {
    console.log('🔗 Setting up Slack interface...');
    globalInterfaces = await initializeInterfaces(serviceManager);
    if (globalInterfaces.slackInterface) {
      await startInterfaces(globalInterfaces);
      console.log('✅ Slack interface initialized successfully');
    } else {
      console.log('⚠️ Slack interface not available, continuing without it');
    }
  } catch (error) {
    console.error('❌ Slack interface setup failed:', error);
    console.log('⚠️ Continuing without Slack interface');
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
    
    // Set up Slack interface in background (non-blocking)
    setupSlackInterface().catch(error => {
      console.error('❌ Background Slack setup failed:', error);
    });

    // Start the server
    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📊 Health check: http://localhost:${port}/healthz`);
    });

    // Enhanced error handling
    server.on('error', (err: NodeJS.ErrnoException) => {
      console.error('❌ Server error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error('❌ Port already in use');
        process.exit(1);
      } else {
        console.error('❌ Unknown server error');
        process.exit(1);
      }
    });
    
    // Add logging for server events
    server.on('listening', () => {
      console.log('👂 Server is listening for connections');
    });

    // Add keep-alive for Railway
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`🛑 Received ${signal}, starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error during server close:', err);
          process.exit(1);
        } else {
          console.log('✅ Server closed gracefully');
          process.exit(0);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        console.log('⏰ Force exit after 30 seconds');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle unhandled errors to prevent crashes
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection:', reason);
      // Don't exit on unhandled rejection in production
    });
    
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    console.log('✅ All event handlers registered');

  } catch (error) {
    
    process.exit(1);
  }
}

// Start the application
startServer().catch((error) => {
  
  process.exit(1);
});
