import { serviceManager } from './service-manager';
import { SessionService } from './session.service';
import { ToolExecutorService } from './tool-executor.service';
import { AuthService } from './auth.service';
import { ContactService } from './contact.service';
import { GmailService } from './gmail.service';
import { CalendarService } from './calendar.service';
import { OpenAIService } from './openai.service';
import { SlackFormatterService } from './slack-formatter.service';
import { DatabaseService } from './database.service';
import { ENVIRONMENT, ENV_VALIDATION } from '../config/environment';
import logger from '../utils/logger';

/**
 * Register and initialize all core application services
 */
export const initializeAllCoreServices = async (): Promise<void> => {
  // Check if core services are already registered (not just any services)
  if (serviceManager.getService('sessionService')) {
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
    // 0. DatabaseService - No dependencies, highest priority
    const databaseService = new DatabaseService();
    serviceManager.registerService('databaseService', databaseService, {
      priority: 5,
      autoStart: true
    });

    // 1. SessionService - Depends on databaseService
    const sessionService = new SessionService();
    serviceManager.registerService('sessionService', sessionService, {
      dependencies: ['databaseService'],
      priority: 10,
      autoStart: true
    });

    // 2. ToolExecutorService - Depends on sessionService
    const toolExecutorService = new ToolExecutorService();
    serviceManager.registerService('toolExecutorService', toolExecutorService, {
      dependencies: ['sessionService'],
      priority: 20,
      autoStart: true
    });

    // 3. AuthService - No external dependencies
    const authService = new AuthService();
    serviceManager.registerService('authService', authService, {
      priority: 30,
      autoStart: true
    });

    // 4. ContactService - Depends on authService
    const contactService = new ContactService();
    serviceManager.registerService('contactService', contactService, {
      dependencies: ['authService'],
      priority: 40,
      autoStart: true
    });

    // 5. GmailService - Depends on authService
    const gmailService = new GmailService();
    serviceManager.registerService('gmailService', gmailService, {
      dependencies: ['authService'],
      priority: 50,
      autoStart: true
    });

    // 6. CalendarService - Depends on authService
    const calendarService = new CalendarService();
    serviceManager.registerService('calendarService', calendarService, {
      dependencies: ['authService'],
      priority: 60,
      autoStart: true
    });

    // 7. OpenAIService - No external dependencies
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
    serviceManager.registerService('openaiService', openaiService, {
      priority: 70,
      autoStart: true
    });

    // 8. SlackFormatterService - No external dependencies
    const slackFormatterService = new SlackFormatterService();
    serviceManager.registerService('slackFormatterService', slackFormatterService, {
      priority: 80,
      autoStart: true
    });

    // Note: Slack is now an interface layer, not a service
    // It will be initialized separately in the main application

    logger.info('Core services registered successfully', {
      serviceCount: serviceManager.getServiceCount(),
      serviceNames: serviceManager.getRegisteredServices()
    });

  } catch (error) {
    logger.error('Failed to register core services:', error);
    throw error;
  }
}