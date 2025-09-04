import { serviceManager } from './service-manager';
import { TokenStorageService } from './token-storage.service';
import { TokenManager } from './token-manager';
import { ToolExecutorService } from './tool-executor.service';
import { AuthService } from './auth.service';
import { ContactService } from './contact.service';
import { GmailService } from './gmail.service';
import { CalendarService } from './calendar.service';
import { OpenAIService } from './openai.service';
import { SlackFormatterService } from './slack-formatter.service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
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
    logger.info('Registering and initializing core services...');

    // Register core services with dependencies
    await registerCoreServices();

    // Initialize all services in dependency order
    await serviceManager.initializeAllServices();

    logger.info('All core services registered and initialized successfully');
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
        logger.info('CacheService registered', { hasRedisConfig, nodeEnv: ENVIRONMENT.nodeEnv });
      } else {
        logger.warn('CacheService skipped - no Redis configuration found for production environment');
        logger.info('Available Redis environment variables for Railway:', 
          Object.keys(process.env).filter(key => key.toLowerCase().includes('redis')));
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
    const toolExecutorService = new ToolExecutorService();
    serviceManager.registerService('toolExecutorService', toolExecutorService, {
      dependencies: ['tokenStorageService'],
      priority: 25,
      autoStart: true
    });

    // 8. ContactService - Depends on authService
    const contactService = new ContactService();
    serviceManager.registerService('contactService', contactService, {
      dependencies: ['authService'],
      priority: 30,
      autoStart: true
    });

    // 9. GmailService - Depends on authService
    const gmailService = new GmailService();
    serviceManager.registerService('gmailService', gmailService, {
      dependencies: ['authService'],
      priority: 35,
      autoStart: true
    });

    // 10. CalendarService - Depends on authService
    const calendarService = new CalendarService();
    serviceManager.registerService('calendarService', calendarService, {
      dependencies: ['authService'],
      priority: 40,
      autoStart: true
    });

    // 11. OpenAIService - No external dependencies
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
    serviceManager.registerService('openaiService', openaiService, {
      priority: 45,
      autoStart: true
    });

    // 12. SlackFormatterService - No external dependencies
    const slackFormatterService = new SlackFormatterService();
    serviceManager.registerService('slackFormatterService', slackFormatterService, {
      priority: 50,
      autoStart: true
    });

    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application
    // Note: SessionService removed - using simplified token storage instead

    logger.info('Core services registered successfully', {
      serviceCount: serviceManager.getServiceCount(),
      serviceNames: serviceManager.getRegisteredServices()
    });

  } catch (error) {
    logger.error('Failed to register core services:', error);
    throw error;
  }
}