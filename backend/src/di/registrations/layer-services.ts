/**
 * Layer Services Registration (3-Layer Architecture)
 *
 * Registers all services for the new 3-layer architecture:
 * - Layer 1: Query decomposition
 * - Layer 2: Execution strategies and coordinator
 * - Layer 3: Synthesis
 * - Orchestrator: Coordinates all layers
 *
 * These services are registered alongside existing agent services
 * during the migration period (Phase 0-6).
 */

import { AppContainer } from '../container';
import { asClass, Lifetime } from 'awilix';

// Layer services (stubs for now, to be implemented in Phase 1-5)
import { QueryDecomposerService } from '../../layers/layer1-decomposition/query-decomposer.service';
import { DecompositionPromptBuilder } from '../../layers/layer1-decomposition/decomposition-prompt-builder';
import { ExecutionGraphValidator } from '../../layers/layer1-decomposition/execution-graph-validator';
import { ExecutionCoordinatorService } from '../../layers/layer2-execution/execution-coordinator.service';
import { SynthesisService } from '../../layers/layer3-synthesis/synthesis.service';
import { OrchestratorService } from '../../layers/orchestrator.service';
import { StrategyRegistry } from '../../layers/layer2-execution/strategy-registry';

// Phase 2: Strategy Executors (import to trigger decorators)
import '../../layers/layer2-execution/strategies/metadata-filter-strategy';
import '../../layers/layer2-execution/strategies/keyword-search-strategy';
import '../../layers/layer2-execution/strategies/batch-thread-read-strategy';
import '../../layers/layer2-execution/strategies/cross-reference-strategy';
import '../../layers/layer2-execution/strategies/semantic-analysis-strategy';

// Strategy metadata store for auto-registration
import { strategyMetadataStore, strategyTypeToString, strategyTypeToNodeType } from '../../layers/layer2-execution/strategy-metadata';
import { InformationNodeType } from '../../layers/layer2-execution/execution.types';

/**
 * Register 3-layer architecture services
 *
 * Strategy auto-registration:
 * - Strategies use @Strategy decorator to self-register
 * - No manual registration needed for new strategies
 * - Zero-config approach for adding strategies
 */
export function registerLayerServices(container: AppContainer): AppContainer {
  // Strategy Registry (singleton)
  container.register({
    strategyRegistry: asClass(StrategyRegistry, {
      lifetime: Lifetime.SINGLETON,
    }),
  });

  // Layer 1: Query Decomposer and helpers
  container.register({
    decompositionPromptBuilder: asClass(DecompositionPromptBuilder, {
      lifetime: Lifetime.SINGLETON,
    }),
    executionGraphValidator: asClass(ExecutionGraphValidator, {
      lifetime: Lifetime.SINGLETON,
    }),
    queryDecomposer: asClass(QueryDecomposerService, {
      lifetime: Lifetime.SINGLETON,
    }),
  });

  // Layer 2: Execution Coordinator
  container.register({
    executionCoordinator: asClass(ExecutionCoordinatorService, {
      lifetime: Lifetime.SINGLETON,
    }),
  });

  // Layer 3: Synthesis Service
  container.register({
    synthesisService: asClass(SynthesisService, {
      lifetime: Lifetime.SINGLETON,
    }),
  });

  // Orchestrator (coordinates all 3 layers)
  // Note: This is the drop-in replacement for MasterAgent
  container.register({
    orchestrator: asClass(OrchestratorService, {
      lifetime: Lifetime.SINGLETON,
    }),
  });

  // Phase 2: Auto-register strategies from metadata store
  const registry = container.resolve<StrategyRegistry>('strategyRegistry');

  for (const metadata of strategyMetadataStore.getAll()) {
    // Register strategy class with DI container
    const strategyKey = `${strategyTypeToString(metadata.type)}Strategy`;
    container.register({
      [strategyKey]: asClass(metadata.constructor, { lifetime: Lifetime.SINGLETON }),
    });

    // Resolve and register with StrategyRegistry
    const strategyInstance = container.resolve(strategyKey) as import('../../layers/layer2-execution/execution.types').StrategyExecutor;
    const strategyNodeType = strategyTypeToNodeType(metadata.type) as InformationNodeType;
    registry.register(strategyNodeType, strategyInstance);

    console.log(`✅ Auto-registered strategy: ${metadata.name} (${strategyNodeType})`);
  }

  return container;
}
