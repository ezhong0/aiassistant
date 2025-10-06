/**
 * Layer 2: Execution Coordinator Service
 *
 * Orchestrates execution of the DAG created by Layer 1.
 * Executes nodes in parallel stages while respecting dependencies.
 * Production-ready implementation with 5 strategy types.
 */

import { BaseService } from '../../services/base-service';
import { ExecutionGraph } from '../layer1-decomposition/execution-graph.types';
import { ExecutionResults, NodeResult, InformationNode } from './execution.types';
import { StrategyRegistry } from './strategy-registry';

export class ExecutionCoordinatorService extends BaseService {
  constructor(private strategyRegistry: StrategyRegistry) {
    super('ExecutionCoordinatorService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('ExecutionCoordinatorService initialized');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ExecutionCoordinatorService destroyed');
  }

  /**
   * Execute the full execution graph
   * @param graph - Execution graph from Layer 1
   * @param userId - User ID for API calls
   * @returns Results from all executed nodes
   */
  async execute(graph: ExecutionGraph, userId: string): Promise<ExecutionResults> {
    const nodeResults = new Map<string, NodeResult>();

    this.logInfo('Executing graph', {
      userId,
      nodeCount: graph.information_needs.length
    });

    // Group nodes by parallel_group
    const stages = this.groupByStage(graph.information_needs);

    this.logInfo('Grouped nodes into stages', {
      stageCount: stages.size,
      stages: Array.from(stages.entries()).map(([stageNum, nodes]) => ({
        stage: stageNum,
        nodeCount: nodes.length
      }))
    });

    // Execute each stage sequentially, nodes within stage in parallel
    for (const [stageNum, nodes] of stages.entries()) {
      this.logInfo(`Executing stage ${stageNum}`, { nodeCount: nodes.length });

      // Execute all nodes in this stage concurrently
      const stageResults = await Promise.allSettled(
        nodes.map(node => this.executeNode(node, nodeResults, userId))
      );

      // Store results
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const result = stageResults[i];

        if (result.status === 'fulfilled') {
          nodeResults.set(node.id, result.value);
          this.logInfo('Node execution succeeded', {
            nodeId: node.id,
            nodeType: node.type,
            tokensUsed: result.value.tokens_used
          });
        } else {
          // Handle failure - store error but continue
          this.logError('Node execution failed', {
            nodeId: node.id,
            nodeType: node.type,
            error: result.reason.message
          });

          nodeResults.set(node.id, {
            success: false,
            error: result.reason.message,
            node_id: node.id,
            tokens_used: 0
          });
        }
      }
    }

    const totalTokens = Array.from(nodeResults.values()).reduce(
      (sum, result) => sum + result.tokens_used,
      0
    );

    this.logInfo('Graph execution complete', {
      totalNodes: nodeResults.size,
      successfulNodes: Array.from(nodeResults.values()).filter(r => r.success).length,
      totalTokens
    });

    return { nodeResults };
  }

  /**
   * Group nodes by parallel_group for stage-based execution
   */
  private groupByStage(nodes: InformationNode[]): Map<number, InformationNode[]> {
    const stages = new Map<number, InformationNode[]>();

    for (const node of nodes) {
      const stageNodes = stages.get(node.parallel_group) || [];
      stageNodes.push(node);
      stages.set(node.parallel_group, stageNodes);
    }

    return stages;
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: InformationNode,
    previousResults: Map<string, NodeResult>,
    userId: string
  ): Promise<NodeResult> {
    try {
      // Resolve params that reference other nodes
      const resolvedParams = this.resolveParams(node.strategy.params, previousResults);

      // Add node_id to params
      const paramsWithId = {
        ...resolvedParams,
        node_id: node.id
      };

      // Get strategy executor
      const strategy = this.strategyRegistry.get(node.type);

      // Execute strategy
      // For cross-reference strategy, we need to pass previousResults
      if (node.type === 'cross_reference') {
        // Cross-reference needs access to previous results
        return await (strategy as any).execute(paramsWithId, userId, previousResults);
      } else {
        return await strategy.execute(paramsWithId, userId);
      }
    } catch (error: any) {
      this.logError('Error executing node', {
        nodeId: node.id,
        nodeType: node.type,
        error: error.message
      });

      return {
        success: false,
        node_id: node.id,
        error: error.message,
        tokens_used: 0
      };
    }
  }

  /**
   * Resolve params that reference other nodes ({{node_id.field}})
   */
  private resolveParams(
    params: Record<string, unknown>,
    previousResults: Map<string, NodeResult>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // This is a reference to another node's result
        const reference = value.slice(2, -2); // Remove {{ and }}
        const [nodeId, ...fieldPath] = reference.split('.');

        const nodeResult = previousResults.get(nodeId);
        if (!nodeResult || !nodeResult.success) {
          this.logWarn('Referenced node not found or failed', { nodeId, reference });
          resolved[key] = null;
          continue;
        }

        // Navigate the field path to get the value
        let resolvedValue: any = nodeResult.data;
        for (const field of fieldPath) {
          if (resolvedValue && typeof resolvedValue === 'object') {
            resolvedValue = resolvedValue[field];
          } else {
            resolvedValue = null;
            break;
          }
        }

        resolved[key] = resolvedValue;
      } else if (Array.isArray(value)) {
        // Resolve array elements
        resolved[key] = value.map(item => {
          if (typeof item === 'string' && item.startsWith('{{') && item.endsWith('}}')) {
            const reference = item.slice(2, -2);
            const [nodeId, ...fieldPath] = reference.split('.');

            const nodeResult = previousResults.get(nodeId);
            if (!nodeResult || !nodeResult.success) {
              return null;
            }

            let resolvedValue: any = nodeResult.data;
            for (const field of fieldPath) {
              if (resolvedValue && typeof resolvedValue === 'object') {
                resolvedValue = resolvedValue[field];
              } else {
                return null;
              }
            }

            return resolvedValue;
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveParams(value as Record<string, unknown>, previousResults);
      } else {
        // Copy value as-is
        resolved[key] = value;
      }
    }

    return resolved;
  }

  getHealth() {
    return {
      healthy: true,
      service: 'ExecutionCoordinatorService',
      status: 'operational'
    };
  }
}
