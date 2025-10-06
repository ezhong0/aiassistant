/**
 * Query Planner
 *
 * Translates QueryIntent → ExecutionGraph using CODE, not LLM.
 * Knows Gmail API syntax, available strategies, execution patterns.
 * Zero hallucination - all filter generation is deterministic.
 */

import { QueryIntent, QueryCriterion, CriterionType } from './query-intent.types';
import { ExecutionGraph, InformationNode, NodeImportance } from './execution-graph.types';

export class QueryPlannerService {
  /**
   * Plan execution graph from intent
   */
  planExecution(intent: QueryIntent): ExecutionGraph {
    if (intent.action === 'filter_emails') {
      return this.planEmailFilter(intent);
    } else if (intent.action === 'filter_calendar') {
      return this.planCalendarFilter(intent);
    }

    // Fallback for other actions (can implement later)
    throw new Error(`Action ${intent.action} not yet implemented in QueryPlanner`);
  }

  /**
   * Plan email filtering query
   */
  private planEmailFilter(intent: QueryIntent): ExecutionGraph {
    const nodes: InformationNode[] = [];
    let nodeIdCounter = 1;

    // STAGE 1: Build base metadata filter (Gmail API only)
    const baseFilters = this.buildGmailFilters(intent);
    const baseNode: InformationNode = {
      id: 'base_filter',
      description: 'Get candidate emails using Gmail API filters',
      type: 'metadata_filter',
      importance: NodeImportance.CRITICAL,
      strategy: {
        method: 'gmail_search',
        params: {
          domain: 'email',
          filters: baseFilters,
          max_results: intent.output?.max_results || 100,
          time_range: this.mapTimeFrame(intent.time_frame)
        }
      },
      depends_on: [],
      parallel_group: 1,
      expected_cost: {
        tokens: 0,
        llm_calls: 0,
        time_seconds: 0.5
      }
    };
    nodes.push(baseNode);

    // STAGE 2: Add strategy nodes for semantic criteria
    const semanticCriteria = intent.criteria.filter(c => this.needsStrategy(c.type));

    if (semanticCriteria.length > 0) {
      // Determine which strategies to use
      const strategies = this.selectStrategies(semanticCriteria);

      for (const strategy of strategies) {
        const strategyNode = this.buildStrategyNode(
          strategy,
          semanticCriteria,
          baseNode.id,
          nodeIdCounter++
        );
        nodes.push(strategyNode);
      }
    }

    // Build execution graph
    return {
      query_classification: {
        type: semanticCriteria.length > 0 ? 'filtered_search' : 'direct',
        complexity: semanticCriteria.length > 1 ? 'moderate' : 'simple',
        domains: ['email'],
        reasoning: `Filter emails${semanticCriteria.length > 0 ? ' with semantic detection' : ''}`
      },
      information_needs: nodes,
      synthesis_instructions: {
        task: this.buildSynthesisTask(intent),
        ranking_criteria: intent.output?.sort_by || 'by date desc',
        presentation_format: intent.output?.format || 'list',
        user_preferences: intent.output?.group_by ? `Group by ${intent.output.group_by}` : ''
      },
      resource_estimate: {
        total_items_accessed: intent.output?.max_results || 100,
        total_llm_calls: semanticCriteria.length,
        estimated_tokens: semanticCriteria.length * 3000,
        estimated_time_seconds: 1 + semanticCriteria.length,
        estimated_cost_usd: semanticCriteria.length * 0.005,
        user_should_confirm: false
      }
    };
  }

  /**
   * Build Gmail API filters from simple criteria
   * GUARANTEED to only use valid Gmail syntax
   */
  private buildGmailFilters(intent: QueryIntent): string[] {
    const filters: string[] = [];

    for (const criterion of intent.criteria) {
      const filter = this.criterionToGmailFilter(criterion);
      if (filter) {
        filters.push(filter);
      }
    }

    // Add scope filter
    if (intent.scope) {
      filters.push(`in:${intent.scope}`);
    }

    // If no filters, default to recent inbox
    if (filters.length === 0) {
      filters.push('in:inbox');
    }

    return filters;
  }

  /**
   * Map criterion to Gmail filter (only for simple criteria)
   * Returns null if criterion needs a strategy instead
   */
  private criterionToGmailFilter(criterion: QueryCriterion): string | null {
    const { type, value, modifier } = criterion;

    // Only map simple criteria to Gmail filters
    switch (type) {
      case 'sender_name':
      case 'sender_email':
        return `from:${value}`;

      case 'recipient':
        return `to:${value}`;

      case 'subject_contains':
        return `subject:${value}`;

      case 'body_contains':
        return value.toString();

      case 'has_attachment':
        return value ? 'has:attachment' : null;

      case 'is_read':
        return value ? 'is:read' : 'is:unread';

      case 'is_starred':
        return value ? 'is:starred' : null;

      case 'label':
        return `label:${value}`;

      case 'in_folder':
        return `in:${value}`;

      // Semantic criteria - need strategies, not Gmail filters
      case 'urgency':
      case 'sender_type':
      case 'requires_response':
      case 'has_commitment':
      case 'is_question':
      case 'is_escalation':
        return null; // Will be handled by strategies

      default:
        return null;
    }
  }

  /**
   * Check if criterion needs a strategy (vs simple Gmail filter)
   */
  private needsStrategy(type: CriterionType): boolean {
    const SEMANTIC_TYPES: CriterionType[] = [
      'urgency',
      'sender_type',
      'requires_response',
      'has_commitment',
      'is_question',
      'is_escalation'
    ];
    return SEMANTIC_TYPES.includes(type);
  }

  /**
   * Select which strategies to use for semantic criteria
   */
  private selectStrategies(criteria: QueryCriterion[]): string[] {
    const strategies: string[] = [];

    for (const criterion of criteria) {
      switch (criterion.type) {
        case 'urgency':
          if (!strategies.includes('urgency_detector')) {
            strategies.push('urgency_detector');
          }
          break;

        case 'sender_type':
          if (!strategies.includes('sender_classifier')) {
            strategies.push('sender_classifier');
          }
          break;

        case 'requires_response':
        case 'is_question':
          if (!strategies.includes('action_detector')) {
            strategies.push('action_detector');
          }
          break;
      }
    }

    return strategies;
  }

  /**
   * Build strategy node
   */
  private buildStrategyNode(
    strategyType: string,
    criteria: QueryCriterion[],
    baseNodeId: string,
    nodeId: number
  ): InformationNode {
    const relevantCriteria = criteria.filter(c => this.isRelevantCriterion(c, strategyType));

    if (strategyType === 'urgency_detector') {
      return {
        id: `urgency_detect_${nodeId}`,
        description: 'Detect urgent emails from candidates',
        type: 'urgency_detector',
        importance: NodeImportance.CRITICAL,
        strategy: {
          method: 'analyze_urgency',
          params: {
            input_email_ids: `{{${baseNodeId}.email_ids}}`,
            threshold: this.getUrgencyThreshold(relevantCriteria),
            signals: ['subject_keywords', 'importance_markers', 'sender_type']
          }
        },
        depends_on: [baseNodeId],
        parallel_group: 2,
        expected_cost: {
          tokens: 3000,
          llm_calls: 1,
          time_seconds: 1.0
        }
      };
    }

    if (strategyType === 'sender_classifier') {
      return {
        id: `sender_classify_${nodeId}`,
        description: 'Classify senders by type',
        type: 'sender_classifier',
        importance: NodeImportance.CRITICAL,
        strategy: {
          method: 'classify_senders',
          params: {
            input_email_ids: `{{${baseNodeId}.email_ids}}`,
            filter_types: this.getSenderTypes(relevantCriteria),
            confidence_threshold: 70
          }
        },
        depends_on: [baseNodeId],
        parallel_group: 2,
        expected_cost: {
          tokens: 2000,
          llm_calls: 1,
          time_seconds: 0.8
        }
      };
    }

    if (strategyType === 'action_detector') {
      return {
        id: `action_detect_${nodeId}`,
        description: 'Detect emails requiring response/action',
        type: 'action_detector',
        importance: NodeImportance.CRITICAL,
        strategy: {
          method: 'detect_required_actions',
          params: {
            input_email_ids: `{{${baseNodeId}.email_ids}}`,
            action_types: ['reply', 'review'],
            check_thread_context: true
          }
        },
        depends_on: [baseNodeId],
        parallel_group: 2,
        expected_cost: {
          tokens: 4000,
          llm_calls: 1,
          time_seconds: 1.2
        }
      };
    }

    throw new Error(`Unknown strategy type: ${strategyType}`);
  }

  /**
   * Check if criterion is relevant to strategy
   */
  private isRelevantCriterion(criterion: QueryCriterion, strategyType: string): boolean {
    if (strategyType === 'urgency_detector') {
      return criterion.type === 'urgency';
    }
    if (strategyType === 'sender_classifier') {
      return criterion.type === 'sender_type';
    }
    if (strategyType === 'action_detector') {
      return criterion.type === 'requires_response' || criterion.type === 'is_question';
    }
    return false;
  }

  /**
   * Get urgency threshold from criteria
   */
  private getUrgencyThreshold(criteria: QueryCriterion[]): string {
    const urgencyCriterion = criteria.find(c => c.type === 'urgency');
    if (!urgencyCriterion) return 'medium';

    if (urgencyCriterion.modifier === 'HIGH' || urgencyCriterion.value === 'high') {
      return 'high';
    }
    if (urgencyCriterion.modifier === 'LOW' || urgencyCriterion.value === 'low') {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Get sender types from criteria
   */
  private getSenderTypes(criteria: QueryCriterion[]): string[] {
    return criteria
      .filter(c => c.type === 'sender_type')
      .map(c => c.value.toString());
  }

  /**
   * Map time frame to time_range parameter
   */
  private mapTimeFrame(timeFrame?: string): string {
    if (!timeFrame) return 'last_30_days';

    if (timeFrame === 'today') return 'today';
    if (timeFrame === 'yesterday') return 'yesterday';
    if (timeFrame === 'this_week') return 'this_week';
    if (timeFrame === 'recent') return 'last_7_days';
    if (timeFrame.startsWith('last_')) return timeFrame;

    // Handle "7d", "30d" format → convert to "last_X_days"
    const match = timeFrame.match(/^(\d+)d$/);
    if (match) {
      return `last_${match[1]}_days`;
    }

    return timeFrame;
  }

  /**
   * Build synthesis task description
   */
  private buildSynthesisTask(intent: QueryIntent): string {
    const action = intent.action === 'filter_emails' ? 'Present filtered emails' : 'Present results';
    const criteria = intent.criteria.map(c => c.type).join(', ');
    return `${action} matching: ${criteria || 'all'}`;
  }

  /**
   * Plan calendar filtering query
   */
  private planCalendarFilter(intent: QueryIntent): ExecutionGraph {
    // Similar to email but simpler (calendar doesn't have as many semantic needs)
    const nodes: InformationNode[] = [{
      id: 'calendar_events',
      description: 'Get calendar events',
      type: 'metadata_filter',
      importance: NodeImportance.CRITICAL,
      strategy: {
        method: 'calendar_events_by_date',
        params: {
          domain: 'calendar',
          time_range: this.mapTimeFrame(intent.time_frame || 'today'),
          max_results: intent.output?.max_results || 50
        }
      },
      depends_on: [],
      parallel_group: 1,
      expected_cost: {
        tokens: 0,
        llm_calls: 0,
        time_seconds: 0.3
      }
    }];

    return {
      query_classification: {
        type: 'direct',
        complexity: 'simple',
        domains: ['calendar'],
        reasoning: 'Simple calendar lookup'
      },
      information_needs: nodes,
      synthesis_instructions: {
        task: 'Present calendar events chronologically',
        ranking_criteria: 'by time',
        presentation_format: 'list',
        user_preferences: ''
      },
      resource_estimate: {
        total_items_accessed: 50,
        total_llm_calls: 0,
        estimated_tokens: 0,
        estimated_time_seconds: 0.5,
        estimated_cost_usd: 0,
        user_should_confirm: false
      }
    };
  }
}
