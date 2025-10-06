/**
 * Execution Graph Validator
 *
 * Validates execution graphs to ensure they are well-formed and safe to execute.
 */

import { ExecutionGraph, InformationNode } from './execution-graph.types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ExecutionGraphValidator {
  // Allowed Gmail API filter prefixes
  private static readonly ALLOWED_GMAIL_FILTERS = new Set([
    'from:',
    'to:',
    'subject:',
    'has:',
    'is:',
    'label:',
    'newer_than:',
    'older_than:',
    'in:',
    'after:',
    'before:'
  ]);

  // Allowed strategy types
  private static readonly ALLOWED_STRATEGY_TYPES = new Set([
    'metadata_filter',
    'keyword_search',
    'urgency_detector',
    'sender_classifier',
    'action_detector',
    'batch_thread_read',
    'cross_reference',
    'semantic_analysis'
  ]);

  // Forbidden filter patterns
  private static readonly FORBIDDEN_FILTERS = new Set([
    'isUrgent',
    'priority',
    'urgency',
    'requiresResponse',
    'requires_response',
    'needsReply',
    'senderType',
    'sender_type',
    'dueToday',
    'due_today',
    'deadline'
  ]);

  /**
   * Validate an execution graph
   */
  validate(graph: ExecutionGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate basic structure
    if (!graph.query_classification) {
      errors.push('Missing query_classification');
    }

    if (!graph.information_needs || graph.information_needs.length === 0) {
      errors.push('Missing or empty information_needs array');
    }

    if (!graph.synthesis_instructions) {
      errors.push('Missing synthesis_instructions');
    }

    if (!graph.resource_estimate) {
      errors.push('Missing resource_estimate');
    }

    // 2. Validate information nodes
    if (graph.information_needs) {
      const nodeIds = new Set<string>();

      for (const node of graph.information_needs) {
        // Check for duplicate IDs
        if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node ID: ${node.id}`);
        }
        nodeIds.add(node.id);

        // Validate node structure
        this.validateNode(node, errors, warnings);
      }

      // 3. Validate dependencies
      this.validateDependencies(graph.information_needs, errors);

      // 4. Validate parallel groups
      this.validateParallelGroups(graph.information_needs, warnings);
    }

    // 5. Validate bounds
    this.validateBounds(graph, warnings);

    // 6. Validate resource estimate
    this.validateResourceEstimate(graph, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single node
   */
  private validateNode(node: InformationNode, errors: string[], warnings: string[]): void {
    if (!node.id) {
      errors.push('Node missing ID');
    }

    if (!node.type) {
      errors.push(`Node ${node.id} missing type`);
    } else {
      // Validate strategy type is allowed
      if (!ExecutionGraphValidator.ALLOWED_STRATEGY_TYPES.has(node.type)) {
        errors.push(
          `Node ${node.id} has invalid strategy type: "${node.type}". ` +
          `Allowed types: ${Array.from(ExecutionGraphValidator.ALLOWED_STRATEGY_TYPES).join(', ')}`
        );
      }
    }

    if (!node.strategy) {
      errors.push(`Node ${node.id} missing strategy`);
    } else {
      if (!node.strategy.method) {
        errors.push(`Node ${node.id} strategy missing method`);
      }
      if (!node.strategy.params) {
        errors.push(`Node ${node.id} strategy missing params`);
      }
    }

    if (node.parallel_group === undefined || node.parallel_group < 1) {
      errors.push(`Node ${node.id} has invalid parallel_group (must be >= 1)`);
    }

    if (!node.expected_cost) {
      errors.push(`Node ${node.id} missing expected_cost`);
    }

    // Validate filters for metadata_filter nodes
    if (node.type === 'metadata_filter') {
      this.validateMetadataFilters(node, errors);
    }

    // Check for bounds in params
    this.validateNodeBounds(node, warnings);
  }

  /**
   * Validate that metadata_filter nodes only use allowed Gmail filters
   */
  private validateMetadataFilters(node: InformationNode, errors: string[]): void {
    const params = node.strategy?.params;
    if (!params || !params.filters) return;

    const filters = Array.isArray(params.filters) ? params.filters : [params.filters];

    for (const filter of filters) {
      if (typeof filter !== 'string') continue;

      // Check if filter starts with forbidden pattern
      const filterLower = filter.toLowerCase();
      for (const forbidden of ExecutionGraphValidator.FORBIDDEN_FILTERS) {
        if (filterLower.includes(forbidden.toLowerCase())) {
          errors.push(
            `Node ${node.id} uses forbidden filter: "${filter}". ` +
            `This is a semantic filter that requires a strategy node (urgency_detector, sender_classifier, or action_detector).`
          );
          return;
        }
      }

      // Check if filter uses allowed Gmail operator
      const isAllowed = Array.from(ExecutionGraphValidator.ALLOWED_GMAIL_FILTERS).some(
        allowed => filter.startsWith(allowed)
      );

      if (!isAllowed) {
        errors.push(
          `Node ${node.id} uses invalid Gmail filter: "${filter}". ` +
          `Allowed filters: ${Array.from(ExecutionGraphValidator.ALLOWED_GMAIL_FILTERS).join(', ')}. ` +
          `For semantic filtering (urgency, sender type, action required), use a strategy node instead.`
        );
      }
    }
  }

  /**
   * Validate that searches have bounds
   */
  private validateNodeBounds(node: InformationNode, warnings: string[]): void {
    const params = node.strategy?.params;
    if (!params) return;

    // Searches should have max_results
    if (node.type === 'metadata_filter' || node.type === 'keyword_search') {
      if (!params.max_results) {
        warnings.push(`Node ${node.id} (${node.type}) missing max_results parameter`);
      }
    }

    // Batch operations should have batch_size
    if (node.type === 'batch_thread_read') {
      if (!params.batch_size) {
        warnings.push(`Node ${node.id} (batch_thread_read) missing batch_size parameter`);
      }
    }

    // Cross-reference should have take_top
    if (node.type === 'cross_reference') {
      if (!params.take_top && !params.max_results) {
        warnings.push(`Node ${node.id} (cross_reference) missing take_top or max_results parameter`);
      }
    }
  }

  /**
   * Validate dependencies form a valid DAG
   */
  private validateDependencies(nodes: InformationNode[], errors: string[]): void {
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const node of nodes) {
      // Check all dependencies exist
      for (const depId of node.depends_on) {
        if (!nodeIds.has(depId)) {
          errors.push(`Node ${node.id} depends on non-existent node: ${depId}`);
        }
      }
    }

    // Check for circular dependencies
    const cycles = this.detectCycles(nodes);
    if (cycles.length > 0) {
      errors.push(`Circular dependencies detected: ${cycles.join(', ')}`);
    }
  }

  /**
   * Detect cycles in the dependency graph
   */
  private detectCycles(nodes: InformationNode[]): string[] {
    const cycles: string[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const dfs = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) return false;

      for (const depId of node.depends_on) {
        if (!visited.has(depId)) {
          if (dfs(depId, [...path])) {
            return true;
          }
        } else if (recStack.has(depId)) {
          // Found a cycle
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart).concat(depId);
          cycles.push(cycle.join(' -> '));
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Validate parallel groups are correctly assigned
   */
  private validateParallelGroups(nodes: InformationNode[], warnings: string[]): void {
    // Nodes in the same parallel group should have the same dependencies
    const groupMap = new Map<number, InformationNode[]>();

    for (const node of nodes) {
      const group = node.parallel_group;
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(node);
    }

    for (const [group, groupNodes] of groupMap.entries()) {
      if (groupNodes.length > 1) {
        // Check if dependencies are consistent
        const firstNode = groupNodes[0];
        if (!firstNode) continue;

        const firstDeps = firstNode.depends_on.sort().join(',');

        for (let i = 1; i < groupNodes.length; i++) {
          const currentNode = groupNodes[i];
          if (!currentNode) continue;

          const currentDeps = currentNode.depends_on.sort().join(',');
          if (currentDeps !== firstDeps) {
            warnings.push(
              `Nodes in parallel_group ${group} have different dependencies: ` +
              `${firstNode.id} (${firstDeps}) vs ${currentNode.id} (${currentDeps})`
            );
          }
        }
      }
    }

    // Check that parallel groups are sequential (1, 2, 3, ...) with no gaps
    const groups = Array.from(groupMap.keys()).sort((a, b) => a - b);
    for (let i = 0; i < groups.length; i++) {
      if (groups[i] !== i + 1) {
        warnings.push(`Parallel groups are not sequential: expected ${i + 1}, got ${groups[i]}`);
      }
    }
  }

  /**
   * Validate that the graph has reasonable bounds
   */
  private validateBounds(graph: ExecutionGraph, warnings: string[]): void {
    // Check for extremely large operations
    if (graph.resource_estimate.total_items_accessed > 500) {
      warnings.push(
        `Very large operation: ${graph.resource_estimate.total_items_accessed} items. ` +
        'Consider reducing scope.'
      );
    }

    if (graph.resource_estimate.estimated_tokens > 100000) {
      warnings.push(
        `Very high token count: ${graph.resource_estimate.estimated_tokens} tokens. ` +
        'Consider reducing batch sizes or scope.'
      );
    }

    if (graph.resource_estimate.estimated_time_seconds > 30) {
      warnings.push(
        `Long execution time: ${graph.resource_estimate.estimated_time_seconds}s. ` +
        'Consider breaking into smaller queries.'
      );
    }
  }

  /**
   * Validate resource estimate is reasonable
   */
  private validateResourceEstimate(graph: ExecutionGraph, warnings: string[]): void {
    const estimate = graph.resource_estimate;

    // Check if estimate seems off
    if (estimate.total_llm_calls > 0 && estimate.estimated_tokens === 0) {
      warnings.push('Resource estimate has LLM calls but zero tokens');
    }

    if (estimate.estimated_tokens > 0 && estimate.total_llm_calls === 0) {
      warnings.push('Resource estimate has tokens but zero LLM calls');
    }

    // Check cost calculation
    const estimatedCost = (estimate.estimated_tokens / 1000000) * 0.15; // $0.15 per 1M tokens
    if (Math.abs(estimate.estimated_cost_usd - estimatedCost) > 0.01) {
      warnings.push(
        `Cost estimate may be incorrect: ${estimate.estimated_cost_usd} ` +
        `(expected ~${estimatedCost.toFixed(4)} based on tokens)`
      );
    }

    // Flag expensive queries for user confirmation
    if (estimate.estimated_tokens > 50000 && !estimate.user_should_confirm) {
      warnings.push(
        'Expensive query (>50K tokens) should request user confirmation'
      );
    }
  }
}
