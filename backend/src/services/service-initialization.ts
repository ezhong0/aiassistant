import { serviceManager } from './service-manager';
import { serviceDependencyManager, ServiceHealth } from './service-dependency-manager';
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
import { SlackEventHandler } from './slack/slack-event-handler.service';
import { SlackOAuthManager } from './slack/slack-oauth-manager.service';
import { SlackMessageProcessor } from './slack/slack-message-processor.service';
import { SlackEventValidator } from './slack/slack-event-validator.service';
import { EmailValidator } from './email/email-validator.service';
import { CalendarEventManager } from './calendar/calendar-event-manager.service';
import { CalendarAvailabilityChecker } from './calendar/calendar-availability-checker.service';
import { CalendarFormatter } from './calendar/calendar-formatter.service';
import { CalendarValidator } from './calendar/calendar-validator.service';
import { SlackMessageAnalyzer } from './slack/slack-message-analyzer.service';
import { SlackDraftManager } from './slack/slack-draft-manager.service';
import { SlackFormatter } from './slack/slack-formatter.service';
import { SlackInterfaceService } from './slack/slack-interface.service';
import { WorkflowCacheService } from './workflow-cache.service';
import { IntentAnalysisService } from './intent-analysis.service';
import { SequentialExecutionService } from './sequential-execution.service';
import { PlanModificationService } from './plan-modification.service';
import { ContextAnalysisService } from './context-analysis.service';
import { NextStepPlanningService } from './next-step-planning.service';
import { OperationDetectionService } from './operation-detection.service';
import { getPersonalityConfig } from '../config/personality.config';
import { ConfigService } from '../config/config.service';
import { AIConfigService } from '../config/ai-config';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';
import { SLACK_SERVICE_CONSTANTS } from '../config/slack-service-constants';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

/**
 * Register and initialize all core application services
 */
export const initializeAllCoreServices = async (): Promise<void> => {
  // Check if core services are already registered (not just any services)
  if (serviceManager.getService('tokenStorageService')) {
    return;
  }

  try {
    // Register core services with dependencies
    await registerCoreServices();

    // Initialize all services in dependency order
    await serviceManager.initializeAllServices();

    // Connect circuit breaker to OpenAI service after initialization
    await setupCircuitBreakerConnections();

    // Enhanced health monitoring and logging
    try {
      const healthCheck = await serviceDependencyManager.healthCheck();
      
      EnhancedLogger.debug('All services initialized successfully', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization',
        metadata: {
          overall: healthCheck.overall,
          summary: healthCheck.summary,
          environment: process.env.NODE_ENV
        }
      });

      // Log degraded services for awareness
      const degradedServices = Object.entries(healthCheck.services)
        .filter(([, health]) => health.health === ServiceHealth.DEGRADED)
        .map(([name, health]) => ({
          name,
          capabilities: health.capabilities,
          limitations: health.limitations
        }));

      if (degradedServices.length > 0) {
        EnhancedLogger.warn('Services running in degraded mode', {
          correlationId: `service-init-${Date.now()}`,
          operation: 'service_initialization',
          metadata: { degradedServices }
        });
      }

      // Log disabled services
      const disabledServices = Object.entries(healthCheck.services)
        .filter(([, health]) => health.health === ServiceHealth.DISABLED)
        .map(([name]) => name);

      if (disabledServices.length > 0) {
        EnhancedLogger.debug('Disabled services', {
          correlationId: `service-init-${Date.now()}`,
          operation: 'service_initialization',
          metadata: { disabledServices }
        });
      }
    } catch (healthError) {
      EnhancedLogger.warn('Could not retrieve enhanced health information', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization',
        metadata: { phase: 'health_check', error: healthError }
      });
      EnhancedLogger.debug('All services initialized successfully', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization',
        metadata: { phase: 'fallback_success' }
      });
    }
  } catch (error) {
    EnhancedLogger.error('Failed to initialize core services', error as Error, {
      correlationId: `service-init-${Date.now()}`,
      operation: 'service_initialization',
      metadata: { phase: 'initialization' }
    });
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

    // 3. CacheService - Always register, handles DISABLE_REDIS internally
    const cacheService = new CacheService();
    serviceManager.registerService('cacheService', cacheService, {
      priority: 6,
      autoStart: true
    });

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
        dependencies: ['tokenManager'],
        priority: 75,
        autoStart: true
      });
    }


    // 15. SlackMessageProcessor - Focused service for message processing pipeline
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackMessageProcessor = new SlackMessageProcessor({
        enableOAuthDetection: true,
        enableConfirmationDetection: true,
        enableDMOnlyMode: true,
        enableAsyncProcessing: true
      });
      serviceManager.registerService('slackMessageProcessor', slackMessageProcessor, {
        dependencies: ['tokenManager', 'toolExecutorService'],
        priority: 81,
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

    // SlackContextExtractor removed during cleanup

    // EmailOperationHandler removed during cleanup

    // ContactResolver removed during cleanup

    // 17. EmailValidator - Focused service for email validation
    const emailValidator = new EmailValidator();
    serviceManager.registerService('emailValidator', emailValidator, {
      priority: 87,
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

    // 23. SlackInterfaceService - Central coordinator for all Slack operations
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackInterfaceService = new SlackInterfaceService({
        signingSecret: ENVIRONMENT.slack.signingSecret,
        botToken: ENVIRONMENT.slack.botToken,
        clientId: ENVIRONMENT.slack.clientId,
        clientSecret: ENVIRONMENT.slack.clientSecret,
        redirectUri: ENVIRONMENT.slack.redirectUri,
        development: ENVIRONMENT.nodeEnv === 'development'
      });
      serviceManager.registerService('slackInterfaceService', slackInterfaceService, {
        dependencies: ['slackMessageProcessor'],
        priority: 94,
        autoStart: true
      });

      // 24. SlackMessageAnalyzer - Focused service for Slack message analysis (requires SlackInterfaceService)
      const slackMessageAnalyzer = new SlackMessageAnalyzer();
      serviceManager.registerService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_MESSAGE_ANALYZER, slackMessageAnalyzer, {
        dependencies: ['slackInterfaceService'],
        priority: 95,
        autoStart: true
      });

      // 25. SlackDraftManager - Focused service for Slack draft management
      const slackDraftManager = new SlackDraftManager();
      serviceManager.registerService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_DRAFT_MANAGER, slackDraftManager, {
        priority: 96,
        autoStart: true
      });

      // 26. SlackFormatter - Focused service for Slack response formatting
      const slackFormatter = new SlackFormatter();
      serviceManager.registerService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_FORMATTER, slackFormatter, {
        priority: 97,
        autoStart: true
      });
    }













    // 26. SlackAgent - Main Slack agent for context gathering and operations
    // Note: SlackAgent is not a service but an agent, so we'll register it differently
    // It will be instantiated by AgentFactory instead

    // 37. WorkflowCacheService - Redis-based workflow state management
    const workflowCacheService = new WorkflowCacheService();
    serviceManager.registerService('workflowCacheService', workflowCacheService, {
      dependencies: ['cacheService'],
      priority: 50, // High priority for workflow management
      autoStart: true
    });

    // 38. IntentAnalysisService - Enhanced intent understanding and plan creation
    const intentAnalysisService = new IntentAnalysisService();
    serviceManager.registerService('intentAnalysisService', intentAnalysisService, {
      dependencies: ['openaiService'],
      priority: 55, // After OpenAI service, before workflow execution
      autoStart: true
    });

    // 39. SequentialExecutionService - Core step-by-step execution engine with reevaluation
    const sequentialExecutionService = new SequentialExecutionService();
    serviceManager.registerService('sequentialExecutionService', sequentialExecutionService, {
      dependencies: ['toolExecutorService', 'workflowCacheService', 'openaiService'],
      priority: 60, // After all dependencies, core workflow execution
      autoStart: true
    });

    // 40. PlanModificationService - Advanced dynamic plan adaptation with LLM intelligence
    const planModificationService = new PlanModificationService();
    serviceManager.registerService('planModificationService', planModificationService, {
      dependencies: ['openaiService', 'workflowCacheService'],
      priority: 58, // Before sequential execution, for plan optimization
      autoStart: true
    });

    // 41. ContextAnalysisService - Intelligent conversation flow and interruption handling
    const contextAnalysisService = new ContextAnalysisService();
    serviceManager.registerService('contextAnalysisService', contextAnalysisService, {
      dependencies: ['openaiService', 'workflowCacheService'],
      priority: 57, // High priority for context management
      autoStart: true
    });

    // 42. NextStepPlanningService - Dynamic step-by-step workflow planning
    const nextStepPlanningService = new NextStepPlanningService();
    serviceManager.registerService('nextStepPlanningService', nextStepPlanningService, {
      dependencies: ['openaiService'],
      priority: 58, // High priority for step planning
      autoStart: true
    });

    // 43. OperationDetectionService - LLM-driven operation detection
    const operationDetectionService = new OperationDetectionService();
    serviceManager.registerService('operationDetectionService', operationDetectionService, {
      dependencies: ['openaiService'],
      priority: 59, // High priority for operation detection
      autoStart: true
    });


    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application

  } catch (error) {
    EnhancedLogger.error('Failed to register core services', error as Error, {
      correlationId: `service-init-${Date.now()}`,
      operation: 'service_registration',
      metadata: { phase: 'registration' }
    });
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
      EnhancedLogger.debug('Circuit breaker connected to OpenAI service', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'circuit_breaker_setup',
        metadata: { status: 'connected' }
      });
    } else {
      EnhancedLogger.warn('Failed to connect circuit breaker to OpenAI service', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'circuit_breaker_setup',
        metadata: {
          hasCircuitBreaker: !!circuitBreaker,
          hasOpenAIService: !!openaiService
        }
      });
    }
  } catch (error) {
    EnhancedLogger.error('Failed to setup circuit breaker connections', error as Error, {
      correlationId: `service-init-${Date.now()}`,
      operation: 'circuit_breaker_setup',
      metadata: { phase: 'connection' }
    });
    throw error;
  }
}

/**
 * Get service health report with enhanced monitoring
 */
export async function getServiceHealthReport(): Promise<{
  timestamp: string;
  environment: string;
  overall: ServiceHealth;
  services: Record<string, any>;
  capabilities: Record<string, string[]>;
  recommendations: string[];
}> {
  const healthCheck = await serviceDependencyManager.healthCheck();

  // Generate capability map
  const capabilities: Record<string, string[]> = {};
  for (const [serviceName] of Object.entries(healthCheck.services)) {
    capabilities[serviceName] = serviceDependencyManager.getServiceCapabilities(serviceName);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (healthCheck.summary.degraded > 0) {
    recommendations.push(`${healthCheck.summary.degraded} service(s) running in degraded mode - check dependencies`);
  }

  if (healthCheck.summary.unhealthy > 0) {
    recommendations.push(`${healthCheck.summary.unhealthy} service(s) unhealthy - immediate attention required`);
  }

  if (process.env.NODE_ENV === 'production' && healthCheck.overall !== ServiceHealth.HEALTHY) {
    recommendations.push('Production environment has non-healthy services - review configuration');
  }

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    overall: healthCheck.overall,
    services: healthCheck.services,
    capabilities,
    recommendations
  };
}

/**
 * Get enhanced service manager for advanced operations
 */
export function getEnhancedServiceManager() {
  return serviceDependencyManager;
}