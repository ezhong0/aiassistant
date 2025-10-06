/**
 * Layer 2: Execution Coordinator Service
 *
 * Orchestrates execution of the DAG created by Layer 1.
 * Executes nodes in parallel stages while respecting dependencies.
 * Production-ready implementation with 5 strategy types.
 */

import { BaseService } from '../../services/base-service';
import { ExecutionGraph, NodeImportance } from '../layer1-decomposition/execution-graph.types';
import { ExecutionResults, NodeResult, InformationNode, ExecutionTelemetry, NodeFailure } from './execution.types';
import { StrategyRegistry } from './strategy-registry';
import { unifiedConfig } from '../../config/unified-config';

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
   * @returns Results from all executed nodes with telemetry
   */
  async execute(graph: ExecutionGraph, userId: string): Promise<ExecutionResults> {
    const nodeResults = new Map<string, NodeResult>();
    const telemetry: ExecutionTelemetry = {
      totalNodes: graph.information_needs.length,
      successfulNodes: 0,
      failedNodes: 0,
      fallbacksUsed: 0,
      executionStatus: 'complete',
      failures: []
    };

    const executionMode = unifiedConfig.featureFlags.executionMode;

    this.logInfo('Executing graph', {
      userId,
      nodeCount: graph.information_needs.length,
      executionMode
    });

    // Group nodes by parallel_group
    const stages = this.groupByStage(graph.information_needs);

    this.logInfo('Grouped nodes into stages', {
      stageCount: stages.size,
      executionMode,
      stages: Array.from(stages.entries()).map(([stageNum, nodes]) => ({
        stage: stageNum,
        nodeCount: nodes.length
      }))
    });

    // Execute each stage based on execution mode
    for (const [stageNum, nodes] of stages.entries()) {
      this.logInfo(`Executing stage ${stageNum}`, {
        nodeCount: nodes.length,
        executionMode
      });

      if (executionMode === 'strict') {
        await this.executeStageStrict(stageNum, nodes, nodeResults, userId, telemetry);
      } else if (executionMode === 'hybrid') {
        await this.executeStageHybrid(stageNum, nodes, nodeResults, userId, telemetry);
      } else {
        await this.executeStageGraceful(stageNum, nodes, nodeResults, userId, telemetry);
      }
    }

    // Calculate final telemetry
    telemetry.successfulNodes = Array.from(nodeResults.values()).filter(r => r.success).length;
    telemetry.failedNodes = telemetry.totalNodes - telemetry.successfulNodes;

    if (telemetry.failedNodes > 0) {
      telemetry.executionStatus = telemetry.failedNodes === telemetry.totalNodes ? 'failed' : 'partial';
    }

    const totalTokens = Array.from(nodeResults.values()).reduce(
      (sum, result) => sum + result.tokens_used,
      0
    );

    this.logInfo('Graph execution complete', {
      totalNodes: nodeResults.size,
      successfulNodes: telemetry.successfulNodes,
      failedNodes: telemetry.failedNodes,
      fallbacksUsed: telemetry.fallbacksUsed,
      executionStatus: telemetry.executionStatus,
      totalTokens
    });

    return { nodeResults, telemetry };
  }

  /**
   * STRICT MODE: Fail-fast on any node failure
   * Used for development and testing to find all bugs
   */
  private async executeStageStrict(
    stageNum: number,
    nodes: InformationNode[],
    results: Map<string, NodeResult>,
    userId: string,
    telemetry: ExecutionTelemetry
  ): Promise<void> {
    // Promise.all = any failure throws immediately
    const stageResults = await Promise.all(
      nodes.map(node => this.executeNode(node, results, userId))
    );

    // Store all results
    stageResults.forEach((result, idx) => {
      const node = nodes[idx];
      if (!node) return;  // Skip if node is undefined

      results.set(node.id, result);
      this.logInfo('Node execution succeeded (strict mode)', {
        stage: stageNum,
        nodeId: node.id,
        nodeType: node.type,
        tokensUsed: result.tokens_used
      });
    });
  }

  /**
   * HYBRID MODE: Fail-fast for critical nodes, graceful for optional
   * Used for staging/production with explicit criticality marking
   */
  private async executeStageHybrid(
    stageNum: number,
    nodes: InformationNode[],
    results: Map<string, NodeResult>,
    userId: string,
    telemetry: ExecutionTelemetry
  ): Promise<void> {
    // Separate critical and non-critical nodes
    const criticalNodes = nodes.filter(n => n.importance === NodeImportance.CRITICAL);
    const otherNodes = nodes.filter(n => n.importance !== NodeImportance.CRITICAL);

    // Critical nodes: fail-fast (Promise.all)
    if (criticalNodes.length > 0) {
      const criticalResults = await Promise.all(
        criticalNodes.map(node => this.executeNode(node, results, userId))
      );

      criticalResults.forEach((result, idx) => {
        const node = criticalNodes[idx];
        if (!node) return;  // Skip if node is undefined

        results.set(node.id, result);
        this.logInfo('Critical node execution succeeded', {
          stage: stageNum,
          nodeId: node.id,
          nodeType: node.type,
          tokensUsed: result.tokens_used
        });
      });
    }

    // Other nodes: graceful (Promise.allSettled)
    if (otherNodes.length > 0) {
      const otherResults = await Promise.allSettled(
        otherNodes.map(node => this.executeNode(node, results, userId))
      );

      otherResults.forEach((result, idx) => {
        const node = otherNodes[idx];
        if (!node) return;  // Skip if node is undefined

        if (result.status === 'fulfilled') {
          results.set(node.id, result.value);
          this.logInfo('Optional node execution succeeded', {
            stage: stageNum,
            nodeId: node.id,
            nodeType: node.type,
            tokensUsed: result.value.tokens_used
          });
        } else {
          // Track fallback
          telemetry.fallbacksUsed++;
          const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);

          this.logWarn('Optional node failed, continuing (hybrid mode)', {
            stage: stageNum,
            nodeId: node.id,
            nodeType: node.type,
            importance: node.importance || NodeImportance.IMPORTANT,
            error: errorMessage
          });

          // Record failure details
          telemetry.failures.push({
            nodeId: node.id,
            nodeType: node.type,
            importance: node.importance || NodeImportance.IMPORTANT,
            reason: errorMessage,
            isRetryable: this.isRetryableError(result.reason),
            impact: `Optional ${node.type} operation unavailable`
          });

          // Store error result
          results.set(node.id, {
            success: false,
            node_id: node.id,
            error: errorMessage,
            tokens_used: 0
          });
        }
      });
    }
  }

  /**
   * GRACEFUL MODE: Continue on all failures, maximize results
   * Used for production to maximize user success rate
   */
  private async executeStageGraceful(
    stageNum: number,
    nodes: InformationNode[],
    results: Map<string, NodeResult>,
    userId: string,
    telemetry: ExecutionTelemetry
  ): Promise<void> {
    // Promise.allSettled = all nodes execute, failures tracked
    const stageResults = await Promise.allSettled(
      nodes.map(node => this.executeNode(node, results, userId))
    );

    stageResults.forEach((result, idx) => {
      const node = nodes[idx];
      if (!node) return;  // Skip if node is undefined

      if (result.status === 'fulfilled') {
        results.set(node.id, result.value);
        this.logInfo('Node execution succeeded (graceful mode)', {
          stage: stageNum,
          nodeId: node.id,
          nodeType: node.type,
          tokensUsed: result.value.tokens_used
        });
      } else {
        // Track fallback
        telemetry.fallbacksUsed++;
        const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);

        this.logWarn('Node failed, continuing (graceful mode)', {
          stage: stageNum,
          nodeId: node.id,
          nodeType: node.type,
          importance: node.importance || NodeImportance.IMPORTANT,
          error: errorMessage
        });

        // Record failure details
        telemetry.failures.push({
          nodeId: node.id,
          nodeType: node.type,
          importance: node.importance || NodeImportance.IMPORTANT,
          reason: errorMessage,
          isRetryable: this.isRetryableError(result.reason),
          impact: this.describeFailureImpact(node)
        });

        // Store error result
        results.set(node.id, {
          success: false,
          node_id: node.id,
          error: errorMessage,
          tokens_used: 0
        });
      }
    });
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
             message.includes('rate limit') ||
             message.includes('503') ||
             message.includes('429');
    }
    return false;
  }

  /**
   * Describe the impact of a node failure for user messaging
   */
  private describeFailureImpact(node: InformationNode): string {
    switch (node.type) {
      case 'metadata_filter':
        return 'Some email filtering unavailable';
      case 'keyword_search':
        return 'Text search results may be incomplete';
      case 'semantic_analysis':
        return 'Urgency/intent analysis unavailable';
      case 'cross_reference':
        return 'Result ranking may be less accurate';
      case 'batch_thread_read':
        return 'Full conversation context unavailable';
      default:
        return 'Some functionality unavailable';
    }
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

        if (!nodeId) {
          this.logWarn('Invalid reference format', { reference });
          resolved[key] = null;
          continue;
        }

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

            if (!nodeId) return null;

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
