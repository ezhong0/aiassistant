import { serviceManager } from './service-manager';
import { SessionService } from './session.service';
import { ToolExecutorService } from './tool-executor.service';
import { AuthService } from './auth.service';
import { ContactService } from './contact.service';
import { GmailService } from './gmail.service';
import { OpenAIService } from './openai.service';
import logger from '../utils/logger';

/**
 * Register and initialize all core application services
 */
export const initializeAllCoreServices = async (): Promise<void> => {
  if (serviceManager.getServiceCount() > 0) {
    logger.debug('Services already registered');
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
    // 1. SessionService - No dependencies, highest priority
    const sessionService = new SessionService();
    serviceManager.registerService('sessionService', sessionService, {
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

    // 6. OpenAIService - No external dependencies
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
    serviceManager.registerService('openaiService', openaiService, {
      priority: 60,
      autoStart: true
    });

    logger.info('Core services registered successfully', {
      serviceCount: serviceManager.getServiceCount(),
      serviceNames: serviceManager.getRegisteredServices()
    });

  } catch (error) {
    logger.error('Failed to register core services:', error);
    throw error;
  }
}