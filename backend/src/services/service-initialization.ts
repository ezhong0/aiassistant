import { serviceManager } from './service-manager';
import { TokenStorageService } from './token-storage.service';
import { TokenManager } from './token-manager';
import { ToolExecutorService } from './tool-executor.service';
import { AuthService } from './auth.service';
import { ContactService } from './contact.service';
import { GmailService } from './email/gmail.service';
import { CalendarService } from './calendar/calendar.service';
import { OpenAIService } from './openai.service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { AIServiceCircuitBreaker } from './ai-circuit-breaker.service';
import { AIClassificationService } from './ai-classification.service';
import { SlackEventHandler } from './slack/slack-event-handler.service';
import { SlackOAuthManager } from './slack/slack-oauth-manager.service';
import { SlackConfirmationHandler } from './slack/slack-confirmation-handler.service';
import { SlackMessageProcessor } from './slack/slack-message-processor.service';
import { SlackResponseFormatter } from './slack/slack-response-formatter.service';
import { SlackEventValidator } from './slack/slack-event-validator.service';
import { SlackContextExtractor } from './slack/slack-context-extractor.service';
import { EmailOperationHandler } from './email/email-operation-handler.service';
import { ContactResolver } from './email/contact-resolver.service';
import { EmailValidator } from './email/email-validator.service';
import { EmailFormatter } from './email/email-formatter.service';
import { CalendarEventManager } from './calendar/calendar-event-manager.service';
import { CalendarAvailabilityChecker } from './calendar/calendar-availability-checker.service';
import { CalendarFormatter } from './calendar/calendar-formatter.service';
import { CalendarValidator } from './calendar/calendar-validator.service';
import { SlackMessageAnalyzer } from './slack/slack-message-analyzer.service';
import { SlackDraftManager } from './slack/slack-draft-manager.service';
import { SlackFormatter } from './slack/slack-formatter.service';
import { GmailCacheService } from './email/gmail-cache.service';
import { ContactCacheService } from './contact/contact-cache.service';
import { SlackCacheService } from './slack/slack-cache.service';
import { CachePerformanceMonitoringService } from './cache-performance-monitoring.service';
import { ConfigService } from '../config/config.service';
import { AIConfigService } from '../config/ai-config';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';
import { SLACK_SERVICE_CONSTANTS } from '../config/slack-service-constants';
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

    // 12. CalendarService - No dependencies (handles auth internally)
    const calendarService = new CalendarService();
    serviceManager.registerService('calendarService', calendarService, {
      dependencies: [], // No dependencies - uses OAuth tokens passed to methods
      priority: 20, // Higher priority since it has no dependencies
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

    // 10.5. ToolRoutingService - AI-powered tool selection
    const { ToolRoutingService } = await import('./tool-routing.service');
    const toolRoutingService = new ToolRoutingService();
    serviceManager.registerService('toolRoutingService', toolRoutingService, {
      dependencies: ['openaiService', 'aiClassificationService'],
      priority: 18, // After AI classification service
      autoStart: true
    });

    // 11. SlackEventHandler - Focused service for Slack event processing
    if (ENV_VALIDATION.isSlackConfigured()) {
      const { WebClient } = await import('@slack/web-api');
      const client = new WebClient(ENVIRONMENT.slack.botToken);
      const slackEventHandler = new SlackEventHandler({
        enableDeduplication: true,
        deduplicationTTL: 5 * 60 * 1000, // 5 minutes
        enableBotMessageFiltering: true,
        enableDMOnlyMode: true
      }, client);
      serviceManager.registerService('slackEventHandler', slackEventHandler as any, {
        priority: 70,
        autoStart: true
      });
    }

    // 13. SlackOAuthManager - Focused service for Slack OAuth handling
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackOAuthManager = new SlackOAuthManager({
        clientId: ENVIRONMENT.slack.clientId,
        clientSecret: ENVIRONMENT.slack.clientSecret,
        redirectUri: ENVIRONMENT.slack.redirectUri,
        scopes: ['chat:write', 'im:write', 'im:read']
      });
      serviceManager.registerService('slackOAuthManager', slackOAuthManager, {
        dependencies: ['tokenManager', 'aiClassificationService'],
        priority: 75,
        autoStart: true
      });
    }

    // 14. SlackConfirmationHandler - Focused service for Slack confirmation handling
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackConfirmationHandler = new SlackConfirmationHandler({
        confirmationTimeout: 10 * 60 * 1000, // 10 minutes
        maxPendingConfirmations: 100,
        enableProposalParsing: true,
        enableAIClassification: true
      });
      serviceManager.registerService('slackConfirmationHandler', slackConfirmationHandler, {
        dependencies: ['aiClassificationService', 'toolExecutorService'],
        priority: 80,
        autoStart: true
      });
    }

    // 15. SlackMessageProcessor - Focused service for message processing pipeline
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackMessageProcessor = new SlackMessageProcessor({
        enableOAuthDetection: true,
        enableConfirmationDetection: true,
        enableDMOnlyMode: true
      });
      serviceManager.registerService('slackMessageProcessor', slackMessageProcessor, {
        dependencies: ['tokenManager', 'toolExecutorService', 'aiClassificationService'],
        priority: 81,
        autoStart: true
      });
    }

    // 16. SlackResponseFormatter - Focused service for response formatting
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackResponseFormatter = new SlackResponseFormatter({
        enableRichFormatting: true,
        maxTextLength: 3800,
        enableProposalFormatting: true
      });
      serviceManager.registerService('slackResponseFormatter', slackResponseFormatter, {
        dependencies: ['emailFormatter'],
        priority: 82,
        autoStart: true
      });
    }

    // 17. SlackEventValidator - Focused service for event validation and deduplication
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackEventValidator = new SlackEventValidator({
        enableDeduplication: true,
        enableBotMessageFiltering: true,
        maxEventAge: 300000, // 5 minutes
        maxProcessedEvents: 1000
      });
      serviceManager.registerService('slackEventValidator', slackEventValidator, {
        priority: 83,
        autoStart: true
      });
    }

    // 18. SlackContextExtractor - Focused service for context extraction
    if (ENV_VALIDATION.isSlackConfigured()) {
      const { WebClient } = await import('@slack/web-api');
      const client = new WebClient(ENVIRONMENT.slack.botToken);
      const slackContextExtractor = new SlackContextExtractor({
        enableUserInfoFetching: true,
        enableEmailExtraction: true,
        maxRetries: 3,
        retryDelay: 1000
      }, client);
      serviceManager.registerService('slackContextExtractor', slackContextExtractor, {
        priority: 84,
        autoStart: true
      });
    }

    // 15. EmailOperationHandler - Focused service for Gmail API operations
    const emailOperationHandler = new EmailOperationHandler();
    serviceManager.registerService('emailOperationHandler', emailOperationHandler, {
      dependencies: ['gmailService'],
      priority: 85,
      autoStart: true
    });

    // 16. ContactResolver - Focused service for contact resolution
    const contactResolver = new ContactResolver();
    serviceManager.registerService('contactResolver', contactResolver, {
      dependencies: ['contactService'],
      priority: 86,
      autoStart: true
    });

    // 17. EmailValidator - Focused service for email validation
    const emailValidator = new EmailValidator();
    serviceManager.registerService('emailValidator', emailValidator, {
      priority: 87,
      autoStart: true
    });

    // 18. EmailFormatter - Focused service for email response formatting
    const emailFormatter = new EmailFormatter();
    serviceManager.registerService('emailFormatter', emailFormatter, {
      priority: 88,
      autoStart: true
    });

    // 19. CalendarEventManager - Focused service for calendar event operations
    const calendarEventManager = new CalendarEventManager();
    serviceManager.registerService('calendarEventManager', calendarEventManager, {
      dependencies: ['calendarService'],
      priority: 90,
      autoStart: true
    });

    // 20. CalendarAvailabilityChecker - Focused service for calendar availability operations
    const calendarAvailabilityChecker = new CalendarAvailabilityChecker();
    serviceManager.registerService('calendarAvailabilityChecker', calendarAvailabilityChecker, {
      dependencies: ['calendarService'],
      priority: 91,
      autoStart: true
    });

    // 21. CalendarFormatter - Focused service for calendar response formatting
    const calendarFormatter = new CalendarFormatter();
    serviceManager.registerService('calendarFormatter', calendarFormatter, {
      priority: 92,
      autoStart: true
    });

    // 22. CalendarValidator - Focused service for calendar event validation
    const calendarValidator = new CalendarValidator();
    serviceManager.registerService('calendarValidator', calendarValidator, {
      priority: 93,
      autoStart: true
    });

    // 23. SlackMessageAnalyzer - Focused service for Slack message analysis
    const slackMessageAnalyzer = new SlackMessageAnalyzer();
    serviceManager.registerService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_MESSAGE_ANALYZER, slackMessageAnalyzer, {
      priority: 95,
      autoStart: true
    });

    // 24. SlackDraftManager - Focused service for Slack draft management
    const slackDraftManager = new SlackDraftManager();
    serviceManager.registerService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_DRAFT_MANAGER, slackDraftManager, {
      priority: 96,
      autoStart: true
    });

    // 25. SlackFormatter - Focused service for Slack response formatting
    const slackFormatter = new SlackFormatter();
    serviceManager.registerService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_FORMATTER, slackFormatter, {
      priority: 97,
      autoStart: true
    });

    // 26. GmailCacheService - Smart caching for Gmail API calls
    const gmailCacheService = new GmailCacheService();
    serviceManager.registerService('gmailCacheService', gmailCacheService, {
      dependencies: ['cacheService', 'gmailService'],
      priority: 98,
      autoStart: true
    });

    // 27. ContactCacheService - Smart caching for contact resolution
    const contactCacheService = new ContactCacheService();
    serviceManager.registerService('contactCacheService', contactCacheService, {
      dependencies: ['cacheService', 'contactService'],
      priority: 99,
      autoStart: true
    });

    // 28. SlackCacheService - Smart caching for Slack API calls
    const slackCacheService = new SlackCacheService();
    serviceManager.registerService('slackCacheService', slackCacheService, {
      dependencies: ['cacheService'],
      priority: 100,
      autoStart: true
    });

    // 29. CachePerformanceMonitoringService - Monitor all cache performance
    const cachePerformanceMonitoringService = new CachePerformanceMonitoringService();
    serviceManager.registerService('cachePerformanceMonitoringService', cachePerformanceMonitoringService, {
      dependencies: ['gmailCacheService', 'contactCacheService', 'slackCacheService'],
      priority: 101,
      autoStart: true
    });

    // 26. SlackAgent - Main Slack agent for context gathering and operations
    // Note: SlackAgent is not a service but an agent, so we'll register it differently
    // It will be instantiated by AgentFactory instead

    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application

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