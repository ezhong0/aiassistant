import { serviceManager } from "./service-manager";
import logger from '../utils/logger';
import { TokenStorageService } from './token-storage.service';
import { TokenManager } from './token-manager';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { OAuthStateService } from './oauth-state.service';
import { AIServiceCircuitBreaker } from './ai-circuit-breaker.service';
import { AuthStatusService } from './auth-status.service';
import { EncryptionService } from './encryption.service';
import { SentryService } from './sentry.service';
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


    // 2. DatabaseService - No dependencies, high priority
    // In development, we'll handle database failures gracefully in TokenStorageService
    const databaseService = new DatabaseService();
    serviceManager.registerService('databaseService', databaseService, []);

    // 3. EncryptionService - No dependencies, high priority
    const encryptionService = new EncryptionService();
    serviceManager.registerService('encryptionService', encryptionService, []);

    // 4. SentryService - No dependencies, high priority (error tracking)
    const sentryService = new SentryService();
    serviceManager.registerService('sentryService', sentryService, []);

    // 5. CacheService - Always register, handles DISABLE_REDIS internally
    const cacheService = new CacheService();
    serviceManager.registerService('cacheService', cacheService, []);

    // 3b. OAuthStateService - depends on cacheService
    const oauthStateService = new OAuthStateService();
    serviceManager.registerService('oauthStateService', oauthStateService, ['cacheService']);

    // 6. TokenStorageService - Depends on databaseService and encryptionService (replaces SessionService)
    const tokenStorageService = new TokenStorageService();
    serviceManager.registerService('tokenStorageService', tokenStorageService, ['databaseService', 'encryptionService']);

    // 4b. AuthStatusService - Depends on tokenStorageService
    const authStatusService = new AuthStatusService();
    serviceManager.registerService('authStatusService', authStatusService, ['tokenStorageService']);

    // 5. AuthService - No external dependencies
    const authService = new AuthService();
    serviceManager.registerService('authService', authService, []);

    // 6. TokenManager - Depends on tokenStorageService and authService
    const tokenManager = new TokenManager();
    serviceManager.registerService('tokenManager', tokenManager, ['tokenStorageService', 'authService']);


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


















    // 26. SlackAgent - Main Slack agent for context gathering and operations
    // Note: SlackAgent is not a service but an agent, so we'll register it differently
    // It will be instantiated by AgentFactory instead



    // 44. ContextManager - Extracted from MasterAgent for SRP compliance
    const { ContextManager } = await import('./context-manager.service');
    const contextManager = new ContextManager();
    serviceManager.registerService('contextManager', contextManager, ['cacheService']);

    // 45. AgentFactory - Initialize all SubAgents for workflow execution
    const { initializeAgentFactory } = await import('../framework/agent-factory');
    await initializeAgentFactory();

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
 */
export async function getServiceHealthReport(): Promise<{
  timestamp: string;
  environment: string;
  overall: string;
  services: Record<string, any>;
  capabilities: Record<string, string[]>;
  recommendations: string[];
}> {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  
  // Get service manager stats
  const serviceStats = serviceManager.getServiceStats();
  const services: Record<string, any> = {};
  const capabilities: Record<string, string[]> = {};
  const recommendations: string[] = [];
  
  // Check each service
  const serviceNames = [
    'genericAIService',
    'contextManager', 
    'tokenManager',
    'databaseService',
    'cacheService',
    'authService',
    'workflowExecutor'
  ];
  
  let healthyServices = 0;
  let totalServices = serviceNames.length;
  
  for (const serviceName of serviceNames) {
    try {
      const service = serviceManager.getService(serviceName);
      const isHealthy = service !== null;
      
      services[serviceName] = {
        status: isHealthy ? 'healthy' : 'unavailable',
        initialized: isHealthy,
        lastChecked: timestamp
      };
      
      if (isHealthy) {
        healthyServices++;
      } else {
        recommendations.push(`Service ${serviceName} is not available`);
      }
    } catch (error) {
      services[serviceName] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: timestamp
      };
      recommendations.push(`Service ${serviceName} has errors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Add agent capabilities
  try {
    const agentFactory = await import('../framework/agent-factory');
    const agentCapabilities = agentFactory.AgentFactory.getAgentCapabilities();
    
    for (const [agentName, agentCap] of Object.entries(agentCapabilities)) {
      capabilities[agentName] = agentCap.operations;
    }
  } catch (error) {
    recommendations.push('Failed to get agent capabilities');
  }
  
  // Determine overall health
  const overall = healthyServices === totalServices ? 'healthy' : 
                  healthyServices > totalServices / 2 ? 'degraded' : 'unhealthy';
  
  // Add general recommendations
  if (serviceStats.errorServices > 0) {
    recommendations.push(`${serviceStats.errorServices} services have errors`);
  }
  
  if (serviceStats.initializingServices > 0) {
    recommendations.push(`${serviceStats.initializingServices} services are still initializing`);
  }
  
  return {
    timestamp,
    environment,
    overall,
    services,
    capabilities,
    recommendations
  };
}

/**
 * Get enhanced service manager for advanced operations
 */
export function getEnhancedServiceManager() {
  return serviceManager;
}