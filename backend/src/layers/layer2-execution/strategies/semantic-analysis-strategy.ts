/**
 * Semantic Analysis Strategy
 *
 * Analyzes items for intent, urgency, and semantic properties using LLM.
 * Processes items in batches to avoid overwhelming the LLM.
 *
 * Use cases:
 * - Classify email intent (question, request, statement)
 * - Determine if message is directed at user
 * - Assess urgency level
 * - Extract key phrases
 * - Understand semantic meaning
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult, SemanticAnalysisParams, SemanticAnalysisResult } from '../execution.types';
import { IAIDomainService, StructuredSchema } from '../../../services/domain/interfaces/ai-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

@Strategy({
  type: StrategyType.SEMANTIC_ANALYSIS,
  name: 'Semantic Analysis',
  description: 'Analyzes items for intent, urgency, and semantic properties using LLM',
})
export class SemanticAnalysisStrategy extends BaseStrategy {
  readonly type = 'semantic_analysis';

  constructor(private aiService: IAIDomainService) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const analysisParams = params as unknown as SemanticAnalysisParams;
    const nodeId = (params as any).node_id || 'semantic_analysis';

    try {
      this.log('Executing semantic analysis', {
        itemCount: analysisParams.items.length,
        batchSize: analysisParams.batch_size,
        analysisTask: analysisParams.analysis_task
      });

      if (analysisParams.items.length === 0) {
        return this.createSuccessResult(nodeId, {
          analysis_summary: {
            total_items_analyzed: 0,
            items_with_questions: 0,
            items_with_requests: 0,
            items_informational_only: 0
          },
          item_results: [],
          metadata: {
            tokens_used: 0,
            llm_calls: 0
          }
        }, 0);
      }

      // Process items in batches
      const batches = this.chunkArray(analysisParams.items, analysisParams.batch_size);
      const allItemResults: any[] = [];
      let totalTokens = 0;

      for (const batch of batches) {
        this.log(`Processing batch of ${batch.length} items`);

        const batchResults = await this.analyzeBatch(
          batch,
          analysisParams.analysis_task
        );

        allItemResults.push(...batchResults);
        totalTokens += this.estimateBatchTokens(batch, batchResults);
      }

      // Summarize results
      const summary = this.summarizeResults(allItemResults);

      const result: SemanticAnalysisResult = {
        analysis_summary: summary,
        item_results: allItemResults,
        metadata: {
          tokens_used: totalTokens,
          llm_calls: batches.length
        }
      };

      return this.createSuccessResult(nodeId, result, totalTokens);
    } catch (error: any) {
      this.log('Error executing semantic analysis', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Analyze a batch of items using LLM
   */
  private async analyzeBatch(items: any[], analysisTask: string): Promise<any[]> {
    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(items, analysisTask);

    // Build schema for analysis response
    const schema = this.buildAnalysisSchema(items.length);

    try {
      // Call LLM for batch analysis
      const result = await this.aiService.generateStructuredData({
        prompt,
        schema,
        systemPrompt: 'You are an expert at analyzing text for intent, urgency, and semantic meaning.',
        temperature: 0.1,
        maxTokens: 2000 // Bounded output
      });

      return result.items || [];
    } catch (error: any) {
      this.log('Error analyzing batch', { error: error.message });

      // Return placeholder results for failed batch
      return items.map(item => ({
        item_id: item.item_id,
        intent_classification: 'statement' as const,
        directed_at_user: false,
        urgency_level: 'low' as const,
        key_phrases: [] as string[],
        reasoning: 'Error analyzing item'
      }));
    }
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(items: any[], analysisTask: string): string {
    let prompt = `Analyze the following items for: ${analysisTask}\n\n`;

    prompt += `ANALYSIS TASK: ${analysisTask}\n\n`;

    prompt += `ITEMS TO ANALYZE (${items.length} total):\n\n`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      prompt += `--- Item ${i + 1} (ID: ${item.item_id}) ---\n`;

      if (item.snippet) {
        prompt += `Content: ${item.snippet}\n`;
      }

      // Add metadata if available
      if (item.metadata) {
        if (item.metadata.subject) {
          prompt += `Subject: ${item.metadata.subject}\n`;
        }
        if (item.metadata.from) {
          prompt += `From: ${item.metadata.from}\n`;
        }
        if (item.metadata.date) {
          prompt += `Date: ${item.metadata.date}\n`;
        }
      }

      prompt += '\n';
    }

    prompt += `ANALYSIS INSTRUCTIONS:\n`;
    prompt += `For each item, determine:\n`;
    prompt += `1. Intent classification: Is it a question, request, statement, or mixed?\n`;
    prompt += `2. Directed at user: Is this specifically asking the user for something?\n`;
    prompt += `3. Urgency level: How urgent is this? (high, medium, low)\n`;
    prompt += `4. Key phrases: What are the most important phrases (max 5)?\n`;
    prompt += `5. Reasoning: Brief explanation of your classification\n\n`;

    prompt += `Be consistent and accurate in your classifications.`;

    return prompt;
  }

  /**
   * Build schema for analysis response
   */
  private buildAnalysisSchema(itemCount: number): StructuredSchema {
    return {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item_id: {
                type: 'string',
                description: 'ID of the item being analyzed'
              },
              intent_classification: {
                type: 'string',
                enum: ['question', 'request', 'statement', 'mixed'],
                description: 'The primary intent of the message'
              },
              directed_at_user: {
                type: 'boolean',
                description: 'Whether this is specifically directed at the user requiring action'
              },
              urgency_level: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'The urgency level of this item'
              },
              key_phrases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Up to 5 key phrases from the content',
                maxLength: 5
              },
              reasoning: {
                type: 'string',
                maxLength: 300,
                description: 'Brief explanation of the classification'
              }
            },
            required: [
              'item_id',
              'intent_classification',
              'directed_at_user',
              'urgency_level',
              'key_phrases',
              'reasoning'
            ]
          },
          minLength: itemCount,
          maxLength: itemCount
        }
      },
      required: ['items'],
      additionalProperties: false
    };
  }

  /**
   * Summarize analysis results
   */
  private summarizeResults(itemResults: any[]): {
    total_items_analyzed: number;
    items_with_questions: number;
    items_with_requests: number;
    items_informational_only: number;
  } {
    const summary = {
      total_items_analyzed: itemResults.length,
      items_with_questions: 0,
      items_with_requests: 0,
      items_informational_only: 0
    };

    for (const item of itemResults) {
      if (item.intent_classification === 'question' || item.intent_classification === 'mixed') {
        summary.items_with_questions++;
      }
      if (item.intent_classification === 'request' || item.intent_classification === 'mixed') {
        summary.items_with_requests++;
      }
      if (item.intent_classification === 'statement') {
        summary.items_informational_only++;
      }
    }

    return summary;
  }

  /**
   * Estimate token usage for a batch
   */
  private estimateBatchTokens(inputItems: any[], results: any[]): number {
    // Rough estimate: input items + output
    const inputText = inputItems.map(i => i.snippet || '').join(' ');
    const inputTokens = Math.ceil(inputText.length / 4);
    const outputTokens = 2000; // Max output per batch
    return inputTokens + outputTokens;
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
