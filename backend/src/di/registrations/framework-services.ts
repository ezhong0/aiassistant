import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { ToolRegistry } from '../../framework/tool-registry';
import { OperationExecutor } from '../../services/domain/strategies/operation-executor';

/**
 * Register framework services
 *
 * These are framework-level services that provide core functionality
 * for the application's domain logic.
 */
export function registerFrameworkServices(container: AppContainer): void {
  container.register({
    // Tool Registry - centralized tool definitions and validation
    toolRegistry: asClass(ToolRegistry).singleton(),

    // Operation Executor - routes operations to strategies
    // Email strategies removed - legacy OAuth pattern no longer used
    // Domain operations now handled directly by domain services with Supabase OAuth
    operationExecutor: asClass(OperationExecutor).singleton(),
  });
}
