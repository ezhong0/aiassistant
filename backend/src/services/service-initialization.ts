import { serviceManager } from "./service-manager";
import logger from '../utils/logger';
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
import { OAuthStateService } from './oauth-state.service';
import { AIServiceCircuitBreaker } from './ai-circuit-breaker.service';
import { SlackService } from './slack/slack.service';
import { SlackOAuthService } from './slack/slack-oauth.service';
import { DraftManager } from './draft-manager.service';
import { AuthStatusService } from './auth-status.service';
import { ConfigService } from './config.service';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';

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
      
      logger.debug('All services initialized successfully', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'service_initialization',
        metadata: {
          serviceCount: 20, // Updated count after cleanup
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
    serviceManager.registerService('configService', configService, []);

    // 1. AIConfigService - REMOVED: Consolidated into ConfigService

    // 2. DatabaseService - No dependencies, high priority
    // In development, we'll handle database failures gracefully in TokenStorageService
    const databaseService = new DatabaseService();
    serviceManager.registerService('databaseService', databaseService, []);

    // 3. CacheService - Always register, handles DISABLE_REDIS internally
    const cacheService = new CacheService();
    serviceManager.registerService('cacheService', cacheService, []);

    // 3b. OAuthStateService - depends on cacheService
    const oauthStateService = new OAuthStateService();
    serviceManager.registerService('oauthStateService', oauthStateService, ['cacheService']);

    // 4. TokenStorageService - Depends on databaseService (replaces SessionService)
    const tokenStorageService = new TokenStorageService();
    serviceManager.registerService('tokenStorageService', tokenStorageService, ['databaseService']);

    // 4b. AuthStatusService - Depends on tokenStorageService
    const authStatusService = new AuthStatusService();
    serviceManager.registerService('authStatusService', authStatusService, ['tokenStorageService']);

    // 5. AuthService - No external dependencies
    const authService = new AuthService();
    serviceManager.registerService('authService', authService, []);

    // 6. TokenManager - Depends on tokenStorageService and authService
    const tokenManager = new TokenManager();
    serviceManager.registerService('tokenManager', tokenManager, ['tokenStorageService', 'authService']);

    // 7. ToolExecutorService - Now depends on tokenStorageService instead of sessionService
    // Note: confirmationService depends on toolExecutorService, so we can't add it as a dependency here
    const toolExecutorService = new ToolExecutorService();
    serviceManager.registerService('toolExecutorService', toolExecutorService, ['tokenStorageService']);

    // 10. ContactService - Depends on authService
    const contactService = new ContactService();
    serviceManager.registerService('contactService', contactService, ['authService']);

    // 11. GmailService - Depends on authService
    const gmailService = new GmailService();
    serviceManager.registerService('gmailService', gmailService, ['authService']);

    // 12. CalendarService - No dependencies (handles auth internally)
    const calendarService = new CalendarService();
    serviceManager.registerService('calendarService', calendarService, []);

    // 8. OpenAIService - Critical AI service, high priority
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
    serviceManager.registerService('openaiService', openaiService, []);

    // 9. AIServiceCircuitBreaker - Depends on OpenAI service
    const aiCircuitBreaker = new AIServiceCircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 3,
      timeout: 30000
    });
    serviceManager.registerService('aiCircuitBreakerService', aiCircuitBreaker, ['openaiService']);




    // 11. SlackService - Consolidated service for all main Slack operations
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackService = new SlackService({
        signingSecret: ENVIRONMENT.slack.signingSecret,
        botToken: ENVIRONMENT.slack.botToken,
        clientId: ENVIRONMENT.slack.clientId,
        clientSecret: ENVIRONMENT.slack.clientSecret,
        redirectUri: ENVIRONMENT.slack.redirectUri,
        development: ENVIRONMENT.nodeEnv === 'development',
        enableDeduplication: true,
        enableBotMessageFiltering: true,
        enableDMOnlyMode: true,
        enableAsyncProcessing: true
      });
      serviceManager.registerService('slackService', slackService, ['tokenManager', 'toolExecutorService']);
    }

    // 12. SlackOAuthService - Dedicated service for Slack OAuth operations
    // Note: This service handles Google OAuth flows within Slack, so it needs Google OAuth credentials
    if (ENV_VALIDATION.isSlackConfigured() && ENV_VALIDATION.isGoogleConfigured()) {
      const slackOAuthService = new SlackOAuthService({
        clientId: ENVIRONMENT.google.clientId,
        clientSecret: ENVIRONMENT.google.clientSecret,
        redirectUri: ENVIRONMENT.google.redirectUri,
        scopes: [
          'openid',
          'email', 
          'profile',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/contacts.readonly'
        ]
      });
      serviceManager.registerService('slackOAuthService', slackOAuthService, ['tokenManager']);
    }


    // 17. SlackEventValidator - REMOVED: Consolidated into SlackAgent




    // EmailValidator and EmailFormatter removed - LLM handles validation and formatting directly

    // 19-20. Calendar auxiliary services - REMOVED: Consolidated into CalendarAgent

    // SlackInterfaceService - REMOVED: Functionality consolidated into SlackService













    // 26. SlackAgent - Main Slack agent for context gathering and operations
    // Note: SlackAgent is not a service but an agent, so we'll register it differently
    // It will be instantiated by AgentFactory instead

    // 37. WorkflowCacheService - REMOVED: Replaced with simple in-memory state in MasterAgent

    // 38. DraftManager - Draft creation, storage, and execution for confirmation system
    const draftManager = new DraftManager();
    serviceManager.registerService('draftManager', draftManager, ['cacheService', 'toolExecutorService']);

    // 39. MasterAgentService - REMOVED: MasterAgent created directly in SlackService
    // 42. LEGACY: NextStepPlanningService - REMOVED: Replaced by StringPlanningService

    // 42b. StringPlanningService - Simple string-based workflow planning
    const { StringPlanningService } = await import('./string-planning.service');
    const stringPlanningService = new StringPlanningService();
    serviceManager.registerService('stringPlanningService', stringPlanningService, ['openaiService']);

    // 43. IntentAnalysisService - Extracted from MasterAgent for SRP compliance
    const { IntentAnalysisService } = await import('./intent-analysis.service');
    const intentAnalysisService = new IntentAnalysisService();
    serviceManager.registerService('intentAnalysisService', intentAnalysisService, ['openaiService', 'draftManager']);

    // 44. ContextManager - Extracted from MasterAgent for SRP compliance
    const { ContextManager } = await import('./context-manager.service');
    const contextManager = new ContextManager();
    serviceManager.registerService('contextManager', contextManager, ['cacheService']);

    // 45. ToolCallGenerator - REMOVED: No longer used by MasterAgent (replaced by natural language flow)

    // 46. ResponseFormatter - Extracted from MasterAgent for SRP compliance
    const { ResponseFormatter } = await import('./response-formatter.service');
    const responseFormatter = new ResponseFormatter();
    serviceManager.registerService('responseFormatter', responseFormatter, ['openaiService']);

    // 47. PlanReevaluationService - Analyzes step results and modifies plans
    const { PlanReevaluationService } = await import('./plan-reevaluation.service');
    const planReevaluationService = new PlanReevaluationService();
    serviceManager.registerService('planReevaluationService', planReevaluationService, ['openaiService']);

    // 48. StepExecutionService - Single step execution with context-aware agent selection
    const { StepExecutionService } = await import('./step-execution.service');
    const stepExecutionService = new StepExecutionService();
    serviceManager.registerService('stepExecutionService', stepExecutionService, ['openaiService']);

    // 47. ServiceCoordinator - REMOVED: No longer used by MasterAgent (replaced by natural language flow)

    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application

    // ServiceManager is now simplified and doesn't need separate components

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
  return serviceManager;
}