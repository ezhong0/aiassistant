import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { ContextManager } from '../../services/context-manager.service';

/**
 * Register workflow and context management services
 * 
 * These services handle workflow execution, context gathering,
 * and orchestration of complex operations.
 */
export function registerWorkflowServices(container: AppContainer): void {
  container.register({
    // Context manager (depends on cacheService)
    contextManager: asClass(ContextManager).singleton(),
  });
}
