/**
 * Dependency Injection Module
 * 
 * Exports the DI container and registration functions.
 * This is the main entry point for the DI system.
 */

export { 
  createAppContainer, 
  createTestContainer, 
  initializeAllServices,
  shutdownAllServices,
  type AppContainer,
  type Cradle
} from './container';

export { registerAllServices } from './registrations';
