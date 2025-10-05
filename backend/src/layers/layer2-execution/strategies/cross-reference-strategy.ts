/**
 * Cross Reference Strategy
 *
 * Combines and ranks results from multiple previous nodes using LLM.
 * Receives structured summaries (not raw data) and produces ranked output.
 *
 * Use cases:
 * - Combine results from multiple searches
 * - Rank items by relevance to user query
 * - Filter items by cross-referencing different data sources
 * - Find intersection or union of multiple result sets
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult, CrossReferenceParams, CrossReferenceResult } from '../execution.types';
import { IAIDomainService, StructuredSchema } from '../../../services/domain/interfaces/ai-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

@Strategy({
  type: StrategyType.CROSS_REFERENCE,
  name: 'Cross Reference',
  description: 'Combines and ranks results from multiple nodes using LLM',
})
export class CrossReferenceStrategy extends BaseStrategy {
  readonly type = 'cross_reference';

  constructor(private aiService: IAIDomainService) {
    super();
  }

  async execute(
    params: Record<string, unknown>,
    userId: string,
    previousResults?: Map<string, NodeResult>
  ): Promise<NodeResult> {
    const crossRefParams = params as unknown as CrossReferenceParams;
    const nodeId = (params as any).node_id || 'cross_reference';

    try {
      this.log('Executing cross reference', {
        sources: crossRefParams.sources,
        operation: crossRefParams.operation,
        rankBy: crossRefParams.rank_by,
        takeTop: crossRefParams.take_top
      });

      if (!previousResults) {
        throw new Error('Cross reference requires previous results from dependent nodes');
      }

      // Get source data from previous nodes
      const sourceData = this.getSourceData(crossRefParams.sources, previousResults);

      if (sourceData.length === 0) {
        return this.createSuccessResult(nodeId, {
          operation_summary: {
            total_input_items: 0,
            items_after_filtering: 0,
            operation_type: crossRefParams.operation,
            top_n_selected: 0
          },
          ranked_results: [],
          metadata: {
            tokens_used: 0,
            llm_calls: 0
          }
        }, 0);
      }

      // Perform operation (intersection, union, custom)
      const combinedItems = this.combineSourceData(sourceData, crossRefParams.operation);

      // Use LLM to rank and filter
      const rankedResults = await this.rankItems(
        combinedItems,
        crossRefParams.rank_by,
        crossRefParams.take_top
      );

      const result: CrossReferenceResult = {
        operation_summary: {
          total_input_items: combinedItems.length,
          items_after_filtering: rankedResults.length,
          operation_type: crossRefParams.operation,
          top_n_selected: Math.min(rankedResults.length, crossRefParams.take_top)
        },
        ranked_results: rankedResults.slice(0, crossRefParams.take_top),
        metadata: {
          tokens_used: rankedResults.length > 0 ? this.estimateTokens(combinedItems, rankedResults) : 0,
          llm_calls: rankedResults.length > 0 ? 1 : 0
        }
      };

      return this.createSuccessResult(
        nodeId,
        result,
        result.metadata.tokens_used
      );
    } catch (error: any) {
      this.log('Error executing cross reference', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Get source data from previous node results
   */
  private getSourceData(sourceIds: string[], previousResults: Map<string, NodeResult>): any[] {
    const allItems: any[] = [];

    for (const sourceId of sourceIds) {
      const nodeResult = previousResults.get(sourceId);
      if (!nodeResult || !nodeResult.success) {
        this.log(`Skipping failed or missing source: ${sourceId}`);
        continue;
      }

      // Extract items from node result
      const data = nodeResult.data;
      if (!data) continue;

      // Handle different data formats
      if (data.items && Array.isArray(data.items)) {
        allItems.push(...data.items.map(item => ({
          ...(typeof item === 'object' && item !== null ? item : {}),
          source_node: sourceId
        })));
      } else if (data.threads && Array.isArray(data.threads)) {
        allItems.push(...data.threads.map(thread => ({
          ...thread,
          source_node: sourceId
        })));
      } else if (Array.isArray(data)) {
        allItems.push(...data.map(item => ({
          ...item,
          source_node: sourceId
        })));
      }
    }

    return allItems;
  }

  /**
   * Combine source data based on operation type
   */
  private combineSourceData(items: any[], operation: 'intersection' | 'union' | 'custom'): any[] {
    if (operation === 'union') {
      // Simple union - deduplicate by ID
      const seen = new Set<string>();
      const unique: any[] = [];

      for (const item of items) {
        const id = item.id || item.thread_id || item.item_id;
        if (id && !seen.has(id)) {
          seen.add(id);
          unique.push(item);
        }
      }

      return unique;
    } else if (operation === 'intersection') {
      // Find items that appear in multiple sources
      const idCounts = new Map<string, { item: any; count: number; sources: string[] }>();

      for (const item of items) {
        const id = item.id || item.thread_id || item.item_id;
        if (!id) continue;

        if (!idCounts.has(id)) {
          idCounts.set(id, { item, count: 0, sources: [] });
        }

        const entry = idCounts.get(id)!;
        entry.count++;
        if (!entry.sources.includes(item.source_node)) {
          entry.sources.push(item.source_node);
        }
      }

      // Return items that appear in at least 2 sources
      return Array.from(idCounts.values())
        .filter(entry => entry.count >= 2)
        .map(entry => ({
          ...entry.item,
          intersection_count: entry.count,
          included_sources: entry.sources
        }));
    } else {
      // Custom operation - return all items with metadata
      return items.map(item => ({
        ...item,
        included_sources: [item.source_node]
      }));
    }
  }

  /**
   * Rank items using LLM
   */
  private async rankItems(items: any[], rankBy: string, takeTop: number): Promise<any[]> {
    if (items.length === 0) {
      return [];
    }

    // Build prompt for ranking
    const prompt = this.buildRankingPrompt(items, rankBy, takeTop);

    // Build schema for ranking response
    const schema: StructuredSchema = {
      type: 'object',
      properties: {
        ranked_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item_id: { type: 'string' },
              rank: { type: 'number' },
              score: { type: 'number' },
              ranking_reason: { type: 'string', maxLength: 200 }
            },
            required: ['item_id', 'rank', 'score', 'ranking_reason']
          }
        }
      },
      required: ['ranked_items'],
      additionalProperties: false
    };

    // Call LLM for ranking
    const result = await this.aiService.generateStructuredData({
      prompt,
      schema,
      systemPrompt: 'You are an expert at analyzing and ranking information based on relevance and importance.',
      temperature: 0.2,
      maxTokens: 2000 // Bounded output
    });

    // Merge ranking information with original items
    const rankedItems = result.ranked_items.map((rankedItem: any) => {
      const originalItem = items.find(item =>
        (item.id || item.thread_id || item.item_id) === rankedItem.item_id
      );

      return {
        item_id: rankedItem.item_id,
        rank: rankedItem.rank,
        score: rankedItem.score,
        included_sources: originalItem?.included_sources || [originalItem?.source_node],
        ranking_reason: rankedItem.ranking_reason,
        ...originalItem
      };
    });

    return rankedItems;
  }

  /**
   * Build ranking prompt
   */
  private buildRankingPrompt(items: any[], rankBy: string, takeTop: number): string {
    let prompt = `Rank the following items based on: ${rankBy}\n\n`;

    prompt += `ITEMS TO RANK (${items.length} total):\n\n`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item.id || item.thread_id || item.item_id || `item_${i}`;

      prompt += `Item ${i + 1} (ID: ${itemId}):\n`;

      // Add relevant fields
      if (item.subject) prompt += `  Subject: ${item.subject}\n`;
      if (item.from) prompt += `  From: ${item.from}\n`;
      if (item.date) prompt += `  Date: ${item.date}\n`;
      if (item.snippet) prompt += `  Snippet: ${item.snippet.substring(0, 150)}\n`;
      if (item.context) prompt += `  Context: ${item.context.substring(0, 200)}\n`;

      // Add cross-reference metadata
      if (item.intersection_count) {
        prompt += `  Appears in ${item.intersection_count} sources\n`;
      }
      if (item.included_sources) {
        prompt += `  Sources: ${item.included_sources.join(', ')}\n`;
      }

      // Add urgency/waiting indicators if present
      if (item.urgency_signals) {
        prompt += `  Urgency: ${item.urgency_signals.level}\n`;
      }
      if (item.waiting_indicators?.present) {
        prompt += `  Waiting indicators found\n`;
      }
      if (item.question_or_request?.present) {
        prompt += `  Question/Request: ${item.question_or_request.type}\n`;
      }

      prompt += '\n';
    }

    prompt += `\nRANKING INSTRUCTIONS:\n`;
    prompt += `- Rank all ${items.length} items based on: ${rankBy}\n`;
    prompt += `- Assign scores from 0-100 (100 = highest relevance)\n`;
    prompt += `- Provide a brief reason for each ranking\n`;
    prompt += `- Return items in descending order by score\n`;
    prompt += `- The top ${takeTop} items will be selected\n\n`;

    prompt += `Output the ranked items with their IDs, ranks, scores, and reasons.`;

    return prompt;
  }

  /**
   * Estimate token usage
   */
  private estimateTokens(inputItems: any[], rankedItems: any[]): number {
    // Rough estimate: input items + output
    const inputTokens = Math.ceil(JSON.stringify(inputItems).length / 4);
    const outputTokens = 2000; // Max output
    return inputTokens + outputTokens;
  }
}
