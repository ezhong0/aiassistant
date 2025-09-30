import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
// Calculate path relative to the backend directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import { initializeAgentFactory, AgentFactory } from './framework/agent-factory';
import { createAppContainer, registerAllServices, initializeAllServices, shutdownAllServices, validateContainer, type AppContainer } from './di';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import { 
  corsMiddleware, 
  securityHeaders, 
  compressionMiddleware,
  apiSecurityHeaders,
  requestSizeLimiter,
  requestTimeout,
  sanitizeRequest
} from './middleware/security.middleware';
import { createAuthRoutes } from './routes/auth';
import { createProtectedRoutes } from './routes/protected.routes';
import { createSlackRoutes } from './routes/slack.routes';
import { createApiRateLimit } from './middleware/rate-limiting.middleware';
// import { serviceManager } from './services/service-manager'; // REMOVED - Using DI container now
import { initializeInterfaces, startInterfaces, InterfaceManager } from './types/slack';
import { setupSwagger } from './docs/swagger';
import { unifiedConfig } from './config/unified-config';

// Global DI container and interfaces store
let appContainer: AppContainer | null = null;
let globalInterfaces: InterfaceManager | null = null;

// Error boundary logging for unhandled errors
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Promise Rejection', reason as Error, {
    correlationId: 'unhandled-rejection',
    operation: 'unhandled_promise_rejection',
    metadata: {
      promise: promise.toString(),
      reason: reason instanceof Error ? reason.message : String(reason)
    }
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error, {
    correlationId: 'uncaught-exception',
    operation: 'uncaught_exception',
    metadata: {
      stack: error.stack
    }
  });
  // Don't exit immediately, let the error handler deal with it
});

// Initialize services and AgentFactory with DI container
const initializeApplication = async (): Promise<void> => {
  try {
    // Validate configuration (includes production env guardrails)
    const configHealth = unifiedConfig.getHealth();
    if (!configHealth.healthy) {
      logger.error('Configuration validation failed', new Error('Configuration validation failed'), {
        correlationId: 'startup',
        operation: 'environment_validation',
        metadata: { configIssues: configHealth.details.issues }
      });
      throw new Error('Configuration validation failed');
    }

    // Create and configure DI container
    logger.info('Creating DI container', {
      correlationId: 'startup',
      operation: 'di_container_creation'
    });
    appContainer = createAppContainer();
    registerAllServices(appContainer);
    
    // Validate container in development mode (catches dependency issues early)
    if (unifiedConfig.nodeEnv === 'development') {
      logger.info('Validating DI container', {
        correlationId: 'startup',
        operation: 'container_validation'
      });
      validateContainer(appContainer);
    }
    
    // Initialize utility factories with container
    const { initializeSentryMiddleware } = await import('./middleware/sentry.middleware');
    const { CryptoUtil } = await import('./utils/crypto.util');
    
    initializeSentryMiddleware(appContainer);
    CryptoUtil.initializeFromContainer(appContainer);

    // Initialize all services via DI container
    logger.info('Initializing all services', {
      correlationId: 'startup',
      operation: 'service_initialization'
    });
    await initializeAllServices(appContainer);

    // Initialize AgentFactory after services (pass container)
    await initializeAgentFactory(appContainer);
    
    logger.info('Application initialized successfully with DI container', {
      correlationId: 'startup',
      operation: 'app_initialization_complete'
    });
  } catch (error) {
    logger.error('Application initialization failed', error as Error, {
      correlationId: 'startup',
      operation: 'app_initialization'
    });
    throw error; // Don't continue with broken services in production
  }
}

/**
 * Setup application routes with DI container
 */
function setupRoutes(app: express.Application, container: AppContainer): void {
  logger.info('Setting up application routes', {
    correlationId: 'startup',
    operation: 'route_setup'
  });
  
  // Create rate limiting middleware from DI container
  const rateLimitStore = container.resolve('rateLimitStore');
  const apiRateLimit = createApiRateLimit(rateLimitStore);
  
  // Apply rate limiting to all API routes
  app.use(apiRateLimit);
  
  // API Routes - pass container for dependency resolution
  app.use('/auth', createAuthRoutes(container));
  app.use('/protected', createProtectedRoutes(container));
  
  // Slack routes - pass DI container for service access
  app.use('/slack', createSlackRoutes(container, () => globalInterfaces));
  
  logger.info('Application routes configured', {
    correlationId: 'startup',
    operation: 'route_setup_complete'
  });
}

const app = express();
// Get port from unified configuration
const port = unifiedConfig.port;

// CRITICAL: Health endpoints MUST be registered first before any middleware
// This ensures Railway health checks work immediately when container starts
const getHealthStatus = () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  pid: process.pid,
  ready: true
});

const getDetailedHealthStatus = async () => {
  const basicHealth = getHealthStatus();
  
  // Only include detailed service health in development or when explicitly requested
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DETAILED_HEALTH === 'true') {
    try {
      // Get service health from DI container
      const serviceHealth: Record<string, any> = {};
      if (appContainer) {
        const cradle = appContainer.cradle;
        for (const [name, service] of Object.entries(cradle)) {
          if (service && typeof service.getHealth === 'function') {
            try {
              serviceHealth[name] = service.getHealth();
            } catch (err) {
              serviceHealth[name] = { healthy: false, error: 'Failed to get health' };
            }
          }
        }
      }
      
      const agentHealth = AgentFactory.getAllAgentHealth();
      
      return {
        ...basicHealth,
        services: serviceHealth,
        agents: agentHealth,
        detailed: true
      };
    } catch (error) {
      return {
        ...basicHealth,
        services: { error: 'Failed to get service health' },
        agents: { error: 'Failed to get agent health' },
        detailed: false
      };
    }
  }
  
  return basicHealth;
};

app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json(getHealthStatus());
});

app.get('/health', async (req: Request, res: Response) => {
  const healthStatus = await getDetailedHealthStatus();
  res.status(200).json(healthStatus);
});

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

// Rate limiting will be applied after container is ready (see setupRoutes)
// We'll create it from the DI container to ensure proper dependency injection


// API Documentation
setupSwagger(app);

// Note: API routes will be registered after bootstrap in setupRoutes()

// Slack interface integration (runs in background, completely optional)
const setupSlackInterface = async () => {
  try {
    logger.info('Setting up Slack interface', {
      correlationId: 'startup',
      operation: 'slack_interface_setup'
    });
    globalInterfaces = await initializeInterfaces(appContainer!);
    if (globalInterfaces.slackInterface) {
      await startInterfaces(globalInterfaces);
      logger.info('Slack interface initialized successfully', {
        correlationId: 'startup',
        operation: 'slack_interface_init_success'
      });
    } else {
      logger.warn('Slack interface not available, continuing without it', {
        correlationId: 'startup',
        operation: 'slack_interface_unavailable'
      });
    }
  } catch (error) {
    logger.error('Slack interface setup failed', error as Error, {
      correlationId: 'startup',
      operation: 'slack_interface_setup_error'
    });
    logger.warn('Continuing without Slack interface', {
      correlationId: 'startup',
      operation: 'slack_interface_fallback'
    });
  }
};



// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Assistant App API',
    version: '1.0.0',
    environment: unifiedConfig.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server and initialize services
const startServer = async (): Promise<void> => {
  try {
    // CRITICAL FIX: Start server FIRST so health checks can connect immediately
    const server = app.listen(port, () => {
      logger.info('Server started successfully', {
        correlationId: 'startup',
        operation: 'server_start',
        metadata: {
          port,
          environment: unifiedConfig.nodeEnv,
          healthCheck: `http://localhost:${port}/healthz`
        }
      });

      // Initialize services AFTER server is listening (background, non-blocking)
      initializeApplication().then(() => {
        logger.info('Application services initialized successfully', {
          correlationId: 'startup',
          operation: 'services_initialized'
        });
        
        // Setup routes after DI container is ready
        if (appContainer) {
          setupRoutes(app, appContainer);
        }

        // Set up Slack interface after services are ready
        setupSlackInterface().catch(error => {
          logger.error('Background Slack setup failed', error as Error, {
            correlationId: 'startup',
            operation: 'background_slack_setup_error'
          });
        });
      }).catch(error => {
        logger.error('Service initialization failed', error as Error, {
          correlationId: 'startup',
          operation: 'service_init_error'
        });
        // Don't exit - server can still handle health checks
      });
    });

    // Enhanced error handling
    server.on('error', (err: NodeJS.ErrnoException) => {
      logger.error('Server error occurred', err, {
        correlationId: 'startup',
        operation: 'server_error',
        metadata: { errorCode: err.code }
      });
      if (err.code === 'EADDRINUSE') {
        logger.error('Port already in use', err, {
          correlationId: 'startup',
          operation: 'port_conflict',
          metadata: { port }
        });
        process.exit(1);
      } else {
        logger.error('Unknown server error', err, {
          correlationId: 'startup',
          operation: 'server_unknown_error'
        });
        process.exit(1);
      }
    });
    
    // Add logging for server events
    server.on('listening', () => {
      logger.info('Server is listening for connections', {
        correlationId: 'startup',
        operation: 'server_listening'
      });
    });

    // Add keep-alive for Railway
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info('Received shutdown signal, starting graceful shutdown', {
        correlationId: 'shutdown',
        operation: 'graceful_shutdown_start',
        metadata: { signal }
      });
      
      // Shutdown all services
      if (appContainer) {
        try {
          await shutdownAllServices(appContainer);
          logger.info('All services shut down successfully', {
            correlationId: 'shutdown',
            operation: 'services_shutdown_complete'
          });
        } catch (error) {
          logger.error('Error shutting down services', error as Error, {
            correlationId: 'shutdown',
            operation: 'services_shutdown_error'
          });
        }
      }
      
      server.close((err) => {
        if (err) {
          logger.error('Error during server close', err, {
            correlationId: 'shutdown',
            operation: 'server_close_error'
          });
          process.exit(1);
        } else {
          logger.info('Server closed gracefully', {
            correlationId: 'shutdown',
            operation: 'server_close_success'
          });
          process.exit(0);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.warn('Force exit after 30 seconds', {
          correlationId: 'shutdown',
          operation: 'force_exit_timeout'
        });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle unhandled errors to prevent crashes
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection detected', reason as Error, {
        correlationId: 'error',
        operation: 'unhandled_rejection'
      });
      // Don't exit on unhandled rejection in production
    });
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception detected', error, {
        correlationId: 'error',
        operation: 'uncaught_exception'
      });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    logger.info('All event handlers registered successfully', {
      correlationId: 'startup',
      operation: 'event_handlers_registered'
    });

  } catch (error) {
    
    process.exit(1);
  }
}

// Start the application
startServer().catch((error) => {
  
  process.exit(1);
});
