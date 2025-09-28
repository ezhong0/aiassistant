import { ServiceManager } from '../../services/service-manager';
import { ISlackDomainService } from '../../services/domain/interfaces/domain-service.interfaces';
import { SlackConfig } from './slack.types';
import { ENVIRONMENT, ENV_VALIDATION } from '../../config/environment';

export interface InterfaceManager {
  slackInterface?: ISlackDomainService;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Initialize all interface layers
 * Note: Interfaces are NOT services - they handle input/output and route to services
 */
export const initializeInterfaces = async (
  serviceManager: ServiceManager
): Promise<InterfaceManager> => {
  const interfaces: InterfaceManager = {
    async start() {
      // SlackDomainService is already initialized by DomainServiceResolver
      // No additional initialization needed
    },
    async stop() {
      // SlackDomainService cleanup is handled by DomainServiceResolver
      // No additional cleanup needed
    }
  };

  try {
    // Initialize Slack interface if configured
    if (ENV_VALIDATION.isSlackConfigured()) {
      const slackConfig: SlackConfig = {
        signingSecret: ENVIRONMENT.slack.signingSecret,
        botToken: ENVIRONMENT.slack.botToken,
        clientId: ENVIRONMENT.slack.clientId,
        clientSecret: ENVIRONMENT.slack.clientSecret,
        redirectUri: ENVIRONMENT.slack.redirectUri,
        development: !ENV_VALIDATION.isProduction()
      };

      // Get the already-initialized SlackDomainService from DomainServiceResolver
      interfaces.slackInterface = require('../../services/domain').DomainServiceResolver.getSlackService();
      // Don't initialize here - let startInterfaces handle it
      
    } else {
      
    }

    

    return interfaces;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Start all interfaces
 */
export const startInterfaces = async (interfaces: InterfaceManager): Promise<void> => {
  try {
    if (interfaces.slackInterface) {
      await interfaces.slackInterface.initialize();
    }
    
    
  } catch (error) {
    
    throw error;
  }
};

/**
 * Stop all interfaces
 */
export const stopInterfaces = async (interfaces: InterfaceManager): Promise<void> => {
  try {
    if (interfaces.slackInterface) {
      await interfaces.slackInterface.destroy();
    }
    
    
  } catch (error) {
    
    throw error;
  }
};

// Export individual interfaces for direct use
export * from './slack.types';
export type { SlackConfig } from './slack.types';
