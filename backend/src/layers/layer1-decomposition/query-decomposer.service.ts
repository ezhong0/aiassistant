/**
 * Layer 1: Query Decomposer Service
 *
 * Transforms natural language queries into structured execution graphs.
 * Phase 1 implementation complete.
 */

import { BaseService } from '../../services/base-service';
import { DecompositionInput, ExecutionGraph } from './execution-graph.types';
import { GenericAIService } from '../../services/generic-ai.service';
import { DecompositionPromptBuilder } from './decomposition-prompt-builder';
import { ExecutionGraphValidator } from './execution-graph-validator';
import { ErrorFactory } from '../../errors/error-factory';

export class QueryDecomposerService extends BaseService {
  private promptBuilder: DecompositionPromptBuilder;
  private validator: ExecutionGraphValidator;

  constructor(private aiService: GenericAIService) {
    super('QueryDecomposerService');
    this.promptBuilder = new DecompositionPromptBuilder(aiService);
    this.validator = new ExecutionGraphValidator();
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('QueryDecomposerService initialized');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('QueryDecomposerService destroyed');
  }

  /**
   * Decompose user query into execution graph
   * @param input - Query and context information
   * @returns Execution graph with dependencies and resource estimates
   */
  async decompose(input: DecompositionInput): Promise<ExecutionGraph> {
    const startTime = Date.now();

    this.logInfo('Decomposing query', {
      query: input.user_query.substring(0, 100),
      historyLength: input.conversation_history.length,
      hasUserContext: !!input.user_context
    });

    try {
      // Validate input
      this.validateInput(input);

      // Execute decomposition prompt
      const graph = await this.promptBuilder.execute(input);

      // Validate the generated graph
      const validationResult = this.validator.validate(graph);

      if (!validationResult.valid) {
        this.logError('Generated execution graph is invalid', new Error('Invalid graph'), {
          errors: validationResult.errors,
          query: input.user_query.substring(0, 100)
        });
        throw ErrorFactory.domain.serviceError(
          'QueryDecomposer',
          `Invalid execution graph: ${validationResult.errors.join(', ')}`
        );
      }

      // Log warnings (but don't fail)
      if (validationResult.warnings.length > 0) {
        this.logWarn('Execution graph has warnings', {
          warnings: validationResult.warnings,
          query: input.user_query.substring(0, 100)
        });
      }

      const decompositionTime = Date.now() - startTime;

      this.logInfo('Query decomposed successfully', {
        query: input.user_query.substring(0, 100),
        queryType: graph.query_classification.type,
        complexity: graph.query_classification.complexity,
        nodeCount: graph.information_needs.length,
        parallelGroups: this.countParallelGroups(graph),
        estimatedTokens: graph.resource_estimate.estimated_tokens,
        decompositionTimeMs: decompositionTime
      });

      return graph;
    } catch (error) {
      this.logError('Failed to decompose query', error as Error, {
        query: input.user_query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Validate decomposition input
   */
  private validateInput(input: DecompositionInput): void {
    if (!input.user_query || input.user_query.trim().length === 0) {
      throw ErrorFactory.api.badRequest('User query cannot be empty');
    }

    if (input.user_query.length > 5000) {
      throw ErrorFactory.api.badRequest('User query too long (max 5000 characters)');
    }

    if (!input.current_timestamp) {
      throw ErrorFactory.api.badRequest('Current timestamp required');
    }
  }

  /**
   * Count number of parallel groups in graph
   */
  private countParallelGroups(graph: ExecutionGraph): number {
    const groups = new Set(graph.information_needs.map(n => n.parallel_group));
    return groups.size;
  }

  /**
   * Health check for service
   */
  getHealth() {
    return {
      healthy: true,
      service: 'QueryDecomposerService',
      status: 'operational'
    };
  }
}

