import { serviceManager } from './service-manager';
import { TokenStorageService } from './token-storage.service';
import { TokenManager } from './token-manager';
import { ToolExecutorService } from './tool-executor.service';
import { AuthService } from './auth.service';
import { ContactService } from './contact.service';
import { GmailService } from './gmail.service';
import { CalendarService } from './calendar.service';
import { OpenAIService } from './openai.service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { SlackMessageReaderService } from './slack-message-reader.service';
import { AIServiceCircuitBreaker } from './ai-circuit-breaker.service';
import { AIClassificationService } from './ai-classification.service';
import { ConfigService } from '../config/config.service';
import { AIConfigService } from '../config/ai-config';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';
import logger from '../utils/logger';

/**
 * Register and initialize all core application services
 */
export const initializeAllCoreServices = async (): Promise<void> => {
  // Check if core services are already registered (not just any services)
  if (serviceManager.getService('tokenStorageService')) {
    logger.debug('Core services already registered');
    return;
  }

  try {
    logger.debug('Registering core services...');

    // Register core services with dependencies
    await registerCoreServices();

    // Initialize all services in dependency order
    await serviceManager.initializeAllServices();

    // Connect circuit breaker to OpenAI service after initialization
    await setupCircuitBreakerConnections();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize core services:', error);
    throw error;
  }
}

/**
 * Register core services with their dependencies
 */
const registerCoreServices = async (): Promise<void> => {
  try {
    // 0. ConfigService - No dependencies, highest priority (configuration)
    const configService = new ConfigService();
    serviceManager.registerService('configService', configService, {
      priority: 1,
      autoStart: true
    });

    // 1. AIConfigService - No dependencies, high priority (AI configuration)
    const aiConfigService = new AIConfigService();
    serviceManager.registerService('aiConfigService', aiConfigService, {
      priority: 2,
      autoStart: true
    });

    // 2. DatabaseService - No dependencies, high priority
    // In development, we'll handle database failures gracefully in TokenStorageService
    const databaseService = new DatabaseService();
    serviceManager.registerService('databaseService', databaseService, {
      priority: 5,
      autoStart: true
    });

    // 3. CacheService - No dependencies, high priority (optional)
    // Only register if Redis is available or explicitly enabled
    if (process.env.DISABLE_REDIS !== 'true') {
      // Check for Railway Redis environment variables
      const hasRedisConfig = !!(
        process.env.REDIS_URL || 
        process.env.REDISCLOUD_URL || 
        process.env.REDIS_PRIVATE_URL ||
        process.env.REDIS_PUBLIC_URL ||
        process.env.RAILWAY_REDIS_URL
      );
      
      if (hasRedisConfig || ENVIRONMENT.nodeEnv === 'development') {
        const cacheService = new CacheService();
        serviceManager.registerService('cacheService', cacheService, {
          priority: 6,
          autoStart: true
        });
        // CacheService registered
      } else {
        logger.warn('CacheService skipped - no Redis configuration found');
      }
    } else {
      logger.info('CacheService disabled via DISABLE_REDIS environment variable');
    }

    // 4. TokenStorageService - Depends on databaseService (replaces SessionService)
    const tokenStorageService = new TokenStorageService();
    serviceManager.registerService('tokenStorageService', tokenStorageService, {
      dependencies: ['databaseService'],
      priority: 10,
      autoStart: true
    });

    // 5. AuthService - No external dependencies
    const authService = new AuthService();
    serviceManager.registerService('authService', authService, {
      priority: 15,
      autoStart: true
    });

    // 6. TokenManager - Depends on tokenStorageService and authService
    const tokenManager = new TokenManager();
    serviceManager.registerService('tokenManager', tokenManager, {
      dependencies: ['tokenStorageService', 'authService'],
      priority: 17,
      autoStart: true
    });

    // 7. ToolExecutorService - Now depends on tokenStorageService instead of sessionService
    // Note: confirmationService depends on toolExecutorService, so we can't add it as a dependency here
    const toolExecutorService = new ToolExecutorService();
    serviceManager.registerService('toolExecutorService', toolExecutorService, {
      dependencies: ['tokenStorageService'],
      priority: 25,
      autoStart: true
    });

    // 10. ContactService - Depends on authService
    const contactService = new ContactService();
    serviceManager.registerService('contactService', contactService, {
      dependencies: ['authService'],
      priority: 30,
      autoStart: true
    });

    // 11. GmailService - Depends on authService
    const gmailService = new GmailService();
    serviceManager.registerService('gmailService', gmailService, {
      dependencies: ['authService'],
      priority: 35,
      autoStart: true
    });

    // 12. CalendarService - Depends on authService
    const calendarService = new CalendarService();
    serviceManager.registerService('calendarService', calendarService, {
      dependencies: ['authService'],
      priority: 40,
      autoStart: true
    });

    // 8. OpenAIService - Critical AI service, high priority
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
    serviceManager.registerService('openaiService', openaiService, {
      priority: 15, // High priority - critical for AI-first architecture
      autoStart: true
    });

    // 9. AIServiceCircuitBreaker - Depends on OpenAI service
    const aiCircuitBreaker = new AIServiceCircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 3,
      timeout: 30000
    });
    serviceManager.registerService('aiCircuitBreakerService', aiCircuitBreaker, {
      dependencies: ['openaiService'],
      priority: 16, // Just after OpenAI service
      autoStart: true
    });


    // 10. AIClassificationService - Depends on OpenAI service
    const aiClassificationService = new AIClassificationService();
    serviceManager.registerService('aiClassificationService', aiClassificationService, {
      dependencies: ['openaiService'],
      priority: 17, // Just after circuit breaker
      autoStart: true
    });

    // 11. SlackMessageReaderService - Dedicated service for reading Slack message history
    // Only register if Slack is configured
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackMessageReaderService = new SlackMessageReaderService(
        ENVIRONMENT.slack.botToken
      );
      serviceManager.registerService('slackMessageReaderService', slackMessageReaderService, {
        dependencies: ['cacheService'], // Optional dependency
        priority: 65,
        autoStart: true
      });
    } else {
      logger.debug('SlackMessageReaderService skipped - Slack not configured');
    }

    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application

    logger.debug('Core services registered', {
      serviceCount: serviceManager.getServiceCount()
    });

  } catch (error) {
    logger.error('Failed to register core services:', error);
    throw error;
  }
}

/**
 * Setup circuit breaker connections after service initialization
 */
const setupCircuitBreakerConnections = async (): Promise<void> => {
  try {
    const circuitBreaker = serviceManager.getService('aiCircuitBreakerService') as AIServiceCircuitBreaker;
    const openaiService = serviceManager.getService('openaiService') as OpenAIService;

    if (circuitBreaker && openaiService) {
      circuitBreaker.setOpenAIService(openaiService);
      logger.debug('Circuit breaker connected to OpenAI service');
    } else {
      logger.warn('Failed to connect circuit breaker to OpenAI service', {
        hasCircuitBreaker: !!circuitBreaker,
        hasOpenAIService: !!openaiService
      });
    }
  } catch (error) {
    logger.error('Failed to setup circuit breaker connections:', error);
    throw error;
  }
}