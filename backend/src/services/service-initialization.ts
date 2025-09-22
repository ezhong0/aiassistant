import { serviceManager } from './service-manager';
import logger from '../utils/logger';
// Removed serviceDependencyManager - functionality moved to enhanced ServiceManager
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
// Removed SlackEventValidator - consolidated into SlackAgent
// EmailValidator removed - LLM handles validation directly
// Removed CalendarFormatter and CalendarValidator - consolidated into CalendarAgent
// Removed SlackMessageAnalyzer, SlackDraftManager, SlackFormatter - consolidated into SlackAgent
import { SlackInterfaceService } from './slack/slack-interface.service';
// Removed WorkflowCacheService - replaced with simple in-memory state in MasterAgent
import { DraftManager } from './draft-manager.service';
// Removed IntentAnalysisService - using only NextStepPlanningService for all planning
// import { IntentAnalysisService } from './intent-analysis.service';
import { NextStepPlanningService } from './next-step-planning.service';
// Removed OperationDetectionService - consolidated into individual agents
import { getPersonalityConfig } from '../config/personality.config';
import { ConfigService } from '../config/config.service';
import { AIConfigService } from '../config/ai-config';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';
import { SLACK_SERVICE_CONSTANTS } from '../config/slack-service-constants';

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
      // const healthCheck = await serviceDependencyManager.healthCheck(); // Removed serviceDependencyManager
      
      logger.debug('All services initialized successfully', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization',
        metadata: {
          serviceCount: 19, // Our target service count
          environment: process.env.NODE_ENV
        }
      });

      // Health monitoring simplified after ServiceDependencyManager removal
    } catch (error) {
      logger.warn('Service initialization had minor issues', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization',
        metadata: { phase: 'simplified_health_check' }
      });
    }
  } catch (error) {
    logger.error('Failed to initialize core services', error as Error, {
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

    // 1. AIConfigService - REMOVED: Consolidated into ConfigService

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


    // 17. SlackEventValidator - REMOVED: Consolidated into SlackAgent




    // EmailValidator and EmailFormatter removed - LLM handles validation and formatting directly

    // 19-20. Calendar auxiliary services - REMOVED: Consolidated into CalendarAgent

    // 21. SlackInterfaceService - Central coordinator for all Slack operations
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

      // 24-26. Slack auxiliary services - REMOVED: Consolidated into SlackAgent
    }













    // 26. SlackAgent - Main Slack agent for context gathering and operations
    // Note: SlackAgent is not a service but an agent, so we'll register it differently
    // It will be instantiated by AgentFactory instead

    // 37. WorkflowCacheService - REMOVED: Replaced with simple in-memory state in MasterAgent

    // 38. DraftManager - Draft creation, storage, and execution for confirmation system
    const draftManager = new DraftManager();
    serviceManager.registerService('draftManager', draftManager, {
      dependencies: ['cacheService', 'toolExecutorService'],
      priority: 51, // After cache and tool executor
      autoStart: true
    });

    // 38. IntentAnalysisService - REMOVED to consolidate planning in NextStepPlanningService
    // const intentAnalysisService = new IntentAnalysisService();
    // serviceManager.registerService('intentAnalysisService', intentAnalysisService, {
    //   dependencies: ['openaiService'],
    //   priority: 55, // After OpenAI service, before workflow execution
    //   autoStart: true
    // });


    // 42. NextStepPlanningService - Dynamic step-by-step workflow planning
    const nextStepPlanningService = new NextStepPlanningService();
    serviceManager.registerService('nextStepPlanningService', nextStepPlanningService, {
      dependencies: ['openaiService'],
      priority: 58, // High priority for step planning
      autoStart: true
    });

    // 43. OperationDetectionService - REMOVED: Consolidated into individual agents


    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application

  } catch (error) {
    logger.error('Failed to register core services', error as Error, {
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
      logger.debug('Circuit breaker connected to OpenAI service', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'circuit_breaker_setup',
        metadata: { status: 'connected' }
      });
    } else {
      logger.warn('Failed to connect circuit breaker to OpenAI service', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'circuit_breaker_setup',
        metadata: {
          hasCircuitBreaker: !!circuitBreaker,
          hasOpenAIService: !!openaiService
        }
      });
    }
  } catch (error) {
    logger.error('Failed to setup circuit breaker connections', error as Error, {
      correlationId: `service-init-${Date.now()}`,
      operation: 'circuit_breaker_setup',
      metadata: { phase: 'connection' }
    });
    throw error;
  }
}

/**
 * Get service health report with enhanced monitoring
 * TEMPORARILY DISABLED - ServiceDependencyManager removed
 */
export async function getServiceHealthReport(): Promise<{
  timestamp: string;
  environment: string;
  overall: string;
  services: Record<string, any>;
  capabilities: Record<string, string[]>;
  recommendations: string[];
}> {
  // Simplified version without ServiceDependencyManager
  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    overall: 'healthy',
    services: {},
    capabilities: {},
    recommendations: []
  };
}

/**
 * Get enhanced service manager for advanced operations
 */
export function getEnhancedServiceManager() {
  // return serviceDependencyManager; // Removed - using simplified approach
  return serviceManager;
}