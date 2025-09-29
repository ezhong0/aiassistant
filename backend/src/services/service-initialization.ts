import { serviceManager } from "./service-manager";
import logger from '../utils/logger';
import { TokenStorageService } from './token-storage.service';
import { TokenManager } from './token-manager';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { OAuthStateService } from './oauth-state.service';
import { AIServiceCircuitBreaker } from './ai-circuit-breaker.service';
// import { SlackOAuthService } from './slack/slack-oauth.service'; // REMOVED: Replaced by OAuth managers
import { AuthStatusService } from './auth-status.service';
import { unifiedConfig } from '../config/unified-config';
import { initializeDomainServices } from './domain';
import { GenericAIService } from './generic-ai.service';
import { GoogleOAuthManager } from './oauth/google-oauth-manager';
import { SlackOAuthManager } from './oauth/slack-oauth-manager';

/**
 * Register and initialize all core application services
 */
export const initializeAllCoreServices = async (): Promise<void> => {
  // Check if core services are already registered (not just any services)
  if (serviceManager.getService('tokenStorageService')) {
    return;
  }

  try {
    // Validate configuration first (includes production env guardrails)
    const configHealth = unifiedConfig.getHealth();
    if (!configHealth.healthy) {
      logger.error('Configuration validation failed', new Error('Configuration validation failed'), {
        correlationId: 'startup',
        operation: 'environment_validation',
        metadata: { configIssues: configHealth.details.issues }
      });
      throw new Error('Configuration validation failed');
    }

    // Initialize domain services first
    initializeDomainServices();

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
          environment: unifiedConfig.nodeEnv
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
    // 0. UnifiedConfigService - No dependencies, highest priority (configuration)
    // Note: We don't register the config service as it's a singleton used directly
    // All services import and use the unified config singleton

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

    // 7. ToolExecutorService - REMOVED: Not used by any components

    // 8. GenericAIService - Centralized AI operations with structured output
    const genericAIService = new GenericAIService();
    serviceManager.registerService('genericAIService', genericAIService, []);

    // Note: Old services (ContactService, GmailService, CalendarService, OpenAIService) 
    // have been replaced by domain services that are initialized via initializeDomainServices()

    // 9. AIServiceCircuitBreaker - No longer depends on OpenAI service directly
    // The circuit breaker is now integrated into the API client layer
    const aiCircuitBreaker = new AIServiceCircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 3,
      timeout: 30000
    });
    serviceManager.registerService('aiCircuitBreakerService', aiCircuitBreaker, []);




    // 11. SlackService - REMOVED: Replaced by SlackDomainService in domain services

    // 12. GoogleOAuthManager - Shared OAuth manager for all Google services
    const googleAuth = unifiedConfig.googleAuth;
    if (googleAuth?.clientId && googleAuth?.clientSecret) {
      const googleOAuthManager = new GoogleOAuthManager({
        clientId: googleAuth.clientId,
        clientSecret: googleAuth.clientSecret,
        redirectUri: googleAuth.redirectUri || '',
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
      serviceManager.registerService('googleOAuthManager', googleOAuthManager, ['authService', 'tokenManager', 'oauthStateService']);
    }

    // 13. SlackOAuthManager - Shared OAuth manager for Slack services
    const slackAuth = unifiedConfig.slackAuth;
    if (slackAuth?.clientId && slackAuth?.clientSecret) {
      const slackOAuthManager = new SlackOAuthManager({
        clientId: slackAuth.clientId,
        clientSecret: slackAuth.clientSecret,
        redirectUri: slackAuth.redirectUri || '',
        scopes: ['chat:write', 'channels:read', 'users:read']
      });
      serviceManager.registerService('slackOAuthManager', slackOAuthManager, ['tokenManager', 'oauthStateService']);
    }

    // 14. SlackOAuthService - REMOVED: Replaced by GoogleOAuthManager and SlackOAuthManager


    // 17. SlackEventValidator - REMOVED: Consolidated into SlackAgent




    // EmailValidator and EmailFormatter removed - LLM handles validation and formatting directly

    // 19-20. Calendar auxiliary services - REMOVED: Consolidated into CalendarAgent

    // SlackInterfaceService - REMOVED: Functionality consolidated into SlackService













    // 26. SlackAgent - Main Slack agent for context gathering and operations
    // Note: SlackAgent is not a service but an agent, so we'll register it differently
    // It will be instantiated by AgentFactory instead

    // 37. WorkflowCacheService - REMOVED: Replaced with simple in-memory state in MasterAgent

    // 38. DraftManager - Draft creation, storage, and execution for confirmation system
    // Removed DraftManager - no longer needed

    // 39. MasterAgentService - REMOVED: MasterAgent created directly in SlackService
    // 42. LEGACY: NextStepPlanningService - REMOVED: Replaced by StringPlanningService

    // Removed StringPlanningService and IntentAnalysisService - no longer needed

    // 44. ContextManager - Extracted from MasterAgent for SRP compliance
    const { ContextManager } = await import('./context-manager.service');
    const contextManager = new ContextManager();
    serviceManager.registerService('contextManager', contextManager, ['cacheService']);

    // 45. ToolCallGenerator - REMOVED: No longer used by MasterAgent (replaced by natural language flow)

    // Removed ResponseFormatter, PlanReevaluationService, and StepExecutionService - no longer needed

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
 * Note: Circuit breaker is now integrated into API client layer, no manual setup needed
 */
const setupCircuitBreakerConnections = async (): Promise<void> => {
  try {
    // Connect AI circuit breaker to GenericAIService
    const aiCircuitBreaker = serviceManager.getService('aiCircuitBreakerService');
    const genericAIService = serviceManager.getService('genericAIService');

    if (aiCircuitBreaker && genericAIService) {
      (aiCircuitBreaker as any).setAIService(genericAIService);
      logger.debug('AI circuit breaker connected to GenericAIService', {
        correlationId: `service-init-${Date.now()}`,
        operation: 'circuit_breaker_setup',
        metadata: { status: 'connected' }
      });
    }

    logger.debug('Circuit breaker setup completed', {
      correlationId: `service-init-${Date.now()}`,
      operation: 'circuit_breaker_setup',
      metadata: { status: 'completed' }
    });
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