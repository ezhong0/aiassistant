import { ServiceManager } from '../../services/service-manager';
import { SlackInterfaceService } from '../../services/slack/slack-interface.service';
import { SlackConfig } from './slack-config.types';
import { ENVIRONMENT, ENV_VALIDATION } from '../../config/environment';
import logger from '../../utils/logger';

export interface InterfaceManager {
  slackInterface?: SlackInterfaceService;
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
      if (this.slackInterface) {
        await this.slackInterface.initialize();
      }
    },
    async stop() {
      if (this.slackInterface) {
        await this.slackInterface.destroy();
      }
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

      interfaces.slackInterface = new SlackInterfaceService(slackConfig);
      await interfaces.slackInterface.initialize();
      logger.debug('Slack interface initialized');
    } else {
      logger.info('Slack interface not configured');
    }

    logger.info('All interfaces initialized successfully');

    return interfaces;
  } catch (error) {
    logger.error('Failed to initialize interfaces:', error);
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
    
    logger.debug('All interfaces started');
  } catch (error) {
    logger.error('Failed to start interfaces:', error);
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
    
    logger.info('All interfaces stopped successfully');
  } catch (error) {
    logger.error('Failed to stop interfaces:', error);
    throw error;
  }
};

// Export individual interfaces for direct use
export { SlackInterfaceService } from '../../services/slack/slack-interface.service';
export type { SlackConfig } from './slack-config.types';
