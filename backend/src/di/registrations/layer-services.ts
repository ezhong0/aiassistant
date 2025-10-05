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

// Phase 2: Strategy Executors
import { MetadataFilterStrategy } from '../../layers/layer2-execution/strategies/metadata-filter-strategy';
import { KeywordSearchStrategy } from '../../layers/layer2-execution/strategies/keyword-search-strategy';
import { BatchThreadReadStrategy } from '../../layers/layer2-execution/strategies/batch-thread-read-strategy';
import { CrossReferenceStrategy } from '../../layers/layer2-execution/strategies/cross-reference-strategy';
import { SemanticAnalysisStrategy } from '../../layers/layer2-execution/strategies/semantic-analysis-strategy';

/**
 * Register 3-layer architecture services
 *
 * Note: These are stub implementations during Phase 0.
 * They will be completed in subsequent phases.
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

  // Phase 2: Register strategy executors
  container.register({
    metadataFilterStrategy: asClass(MetadataFilterStrategy, { lifetime: Lifetime.SINGLETON }),
    keywordSearchStrategy: asClass(KeywordSearchStrategy, { lifetime: Lifetime.SINGLETON }),
    batchThreadReadStrategy: asClass(BatchThreadReadStrategy, { lifetime: Lifetime.SINGLETON }),
    crossReferenceStrategy: asClass(CrossReferenceStrategy, { lifetime: Lifetime.SINGLETON }),
    semanticAnalysisStrategy: asClass(SemanticAnalysisStrategy, { lifetime: Lifetime.SINGLETON }),
  });

  // Register strategies with the StrategyRegistry
  const registry = container.resolve<StrategyRegistry>('strategyRegistry');
  const metadataFilter = container.resolve<MetadataFilterStrategy>('metadataFilterStrategy');
  const keywordSearch = container.resolve<KeywordSearchStrategy>('keywordSearchStrategy');
  const batchThreadRead = container.resolve<BatchThreadReadStrategy>('batchThreadReadStrategy');
  const crossReference = container.resolve<CrossReferenceStrategy>('crossReferenceStrategy');
  const semanticAnalysis = container.resolve<SemanticAnalysisStrategy>('semanticAnalysisStrategy');

  registry.register('metadata_filter', metadataFilter);
  registry.register('keyword_search', keywordSearch);
  registry.register('batch_thread_read', batchThreadRead);
  registry.register('cross_reference', crossReference);
  registry.register('semantic_analysis', semanticAnalysis);

  return container;
}
