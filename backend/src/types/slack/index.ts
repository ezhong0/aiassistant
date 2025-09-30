import { AppContainer } from '../../di';
import { ISlackDomainService } from '../../services/domain/interfaces/slack-domain.interface';
import { SlackConfig } from './slack.types';
import { config } from '../../config';

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
  container: AppContainer
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
    if (config.slackAuth?.clientId && config.slackAuth?.clientSecret) {
      const slackConfig: SlackConfig = {
        signingSecret: config.slackAuth.signingSecret || '',
        botToken: config.slackAuth.botToken || '',
        clientId: config.slackAuth.clientId,
        clientSecret: config.slackAuth.clientSecret,
        redirectUri: config.slackAuth.redirectUri || '',
        development: !config.isProduction
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
