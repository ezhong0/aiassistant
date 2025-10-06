/**
 * Orchestrator Service (3-Layer Architecture)
 *
 * Coordinates all 3 layers to process user input.
 * Drop-in replacement for current MasterAgent with same API.
 * Production-ready implementation.
 */

import { BaseService } from '../services/base-service';
import { OrchestratorInput, OrchestratorResult } from './orchestrator.types';
import { QueryDecomposerService } from './layer1-decomposition/query-decomposer.service';
import { ExecutionCoordinatorService } from './layer2-execution/execution-coordinator.service';
import { SynthesisService } from './layer3-synthesis/synthesis.service';
import { ConversationMessage } from './layer1-decomposition/execution-graph.types';
import { UserContextService } from '../services/user-context.service';
import { UserPreferencesService } from '../services/user-preferences.service';

export class OrchestratorService extends BaseService {
  constructor(
    private queryDecomposer: QueryDecomposerService,
    private executionCoordinator: ExecutionCoordinatorService,
    private synthesisService: SynthesisService,
    private userContextService: UserContextService,
    private userPreferencesService: UserPreferencesService
  ) {
    super('OrchestratorService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('OrchestratorService initialized');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('OrchestratorService destroyed');
  }

  /**
   * Process user input through all 3 layers
   * Same API as current MasterAgent.processUserInput
   *
   * @param userInput - User's message
   * @param userId - User ID for authentication
   * @param conversationHistory - Full conversation history from client
   * @param previousState - Previous state (optional, for multi-turn)
   * @returns Processing result with message and updated state
   */
  async processUserInput(
    userInput: string,
    userId: string,
    conversationHistory: ConversationMessage[] = [],
    previousState?: unknown
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const layer1Start = Date.now();

    this.logInfo('Processing user input (3-layer)', {
      userId,
      inputLength: userInput.length,
      historyLength: conversationHistory.length
    });

    try {
      // LAYER 1: Query Decomposition
      this.logInfo('Layer 1: Query Decomposition');

      const userContext = await this.getUserContext(userId);

      const executionGraph = await this.queryDecomposer.decompose({
        user_query: userInput,
        conversation_history: conversationHistory.slice(-3), // Last 3 turns only
        user_context: userContext,
        current_timestamp: new Date().toISOString()
      });

      const layer1Time = Date.now() - layer1Start;
      const layer1Tokens = this.estimateTokens(JSON.stringify(executionGraph));

      this.logInfo('Layer 1 complete', {
        nodeCount: executionGraph.information_needs.length,
        queryType: executionGraph.query_classification.type,
        tokensUsed: layer1Tokens,
        timeMs: layer1Time
      });

      // Check if user confirmation needed (expensive query)
      if (executionGraph.resource_estimate.user_should_confirm) {
        const confirmationMessage = this.buildConfirmationMessage(executionGraph);

        return {
          message: confirmationMessage,
          success: true,
          masterState: {
            executionGraph,
            awaiting_confirmation: true,
            last_query: userInput
          },
          metadata: {
            workflowAction: 'awaiting_confirmation',
            processingTime: Date.now() - startTime,
            tokensUsed: layer1Tokens
          }
        };
      }

      // LAYER 2: Execution
      const layer2Start = Date.now();
      this.logInfo('Layer 2: Parallel Execution', {
        stageCount: this.countStages(executionGraph),
        nodeCount: executionGraph.information_needs.length
      });

      const executionResults = await this.executionCoordinator.execute(executionGraph, userId);

      const layer2Time = Date.now() - layer2Start;
      const layer2Tokens = Array.from(executionResults.nodeResults.values())
        .reduce((sum, r) => sum + r.tokens_used, 0);

      this.logInfo('Layer 2 complete', {
        nodesExecuted: executionResults.nodeResults.size,
        tokensUsed: layer2Tokens,
        timeMs: layer2Time
      });

      // LAYER 3: Synthesis
      const layer3Start = Date.now();
      this.logInfo('Layer 3: Synthesis');

      const userPreferences = await this.getUserPreferences(userId);

      const synthesis = await this.synthesisService.synthesize(
        userInput,
        executionGraph,
        executionResults,
        userPreferences
      );

      const layer3Time = Date.now() - layer3Start;

      this.logInfo('Layer 3 complete', {
        findingsCount: synthesis.metadata.findings_count,
        tokensUsed: synthesis.metadata.tokens_used,
        timeMs: layer3Time
      });

      const totalTime = Date.now() - startTime;
      const totalTokens = layer1Tokens + layer2Tokens + synthesis.metadata.tokens_used;

      this.logInfo('Processing complete', {
        totalTimeMs: totalTime,
        totalTokens,
        layers: {
          layer1: `${layer1Time}ms, ${layer1Tokens} tokens`,
          layer2: `${layer2Time}ms, ${layer2Tokens} tokens`,
          layer3: `${layer3Time}ms, ${synthesis.metadata.tokens_used} tokens`
        }
      });

      return {
        message: synthesis.message,
        success: true,
        masterState: { executionGraph, executionResults },
        metadata: {
          processingTime: totalTime,
          totalSteps: executionGraph.information_needs.length,
          tokensUsed: totalTokens,
          layers: {
            layer1_tokens: layer1Tokens,
            layer1_time_ms: layer1Time,
            layer2_tokens: layer2Tokens,
            layer2_time_ms: layer2Time,
            layer2_stages: this.countStages(executionGraph),
            layer3_tokens: synthesis.metadata.tokens_used,
            layer3_time_ms: layer3Time
          }
        }
      };

    } catch (error: any) {
      this.logError('Failed to process user input', {
        userId,
        error: error.message,
        stack: error.stack
      });

      return {
        message: 'I encountered an error while processing your request. Please try again.',
        success: false,
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Build confirmation message for expensive queries
   */
  private buildConfirmationMessage(executionGraph: any): string {
    const estimate = executionGraph.resource_estimate;

    let message = `This query will access approximately ${estimate.total_items_accessed} items `;
    message += `and use ~${estimate.estimated_tokens.toLocaleString()} tokens `;
    message += `(estimated cost: $${estimate.estimated_cost_usd.toFixed(4)}). `;
    message += `\n\nEstimated time: ${estimate.estimated_time_seconds} seconds.\n\n`;
    message += `Would you like me to proceed?`;

    return message;
  }

  /**
   * Count number of execution stages
   */
  private countStages(executionGraph: any): number {
    const stages = new Set(
      executionGraph.information_needs.map((node: any) => node.parallel_group)
    );
    return stages.size;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get user context (accounts, timezone, etc.)
   */
  private async getUserContext(userId: string) {
    return await this.userContextService.getUserContext(userId);
  }

  /**
   * Get user preferences for synthesis
   */
  private async getUserPreferences(userId: string) {
    return await this.userPreferencesService.getPreferences(userId);
  }

  getHealth() {
    return {
      healthy: true,
      service: 'OrchestratorService',
      status: 'operational',
      layers: {
        layer1: this.queryDecomposer.getHealth(),
        layer2: this.executionCoordinator.getHealth(),
        layer3: this.synthesisService.getHealth()
      }
    };
  }
}
