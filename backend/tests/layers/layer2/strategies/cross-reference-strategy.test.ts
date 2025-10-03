/**
 * Tests for CrossReferenceStrategy
 */

import { CrossReferenceStrategy } from '../../../../src/layers/layer2-execution/strategies/cross-reference-strategy';
import { IAIDomainService } from '../../../../src/services/domain/interfaces/ai-domain.interface';
import { NodeResult } from '../../../../src/layers/layer2-execution/execution.types';

describe('CrossReferenceStrategy', () => {
  let strategy: CrossReferenceStrategy;
  let mockAiService: jest.Mocked<IAIDomainService>;

  beforeEach(() => {
    mockAiService = {
      generateStructuredData: jest.fn(),
    } as any;

    strategy = new CrossReferenceStrategy(mockAiService);
  });

  describe('Union operation', () => {
    it('should combine items from multiple sources with deduplication', async () => {
      const previousResults = new Map<string, NodeResult>();

      // Source 1
      previousResults.set('source1', {
        success: true,
        node_id: 'source1',
        data: {
          items: [
            { id: 'item1', subject: 'Email 1', from: 'sender@example.com' },
            { id: 'item2', subject: 'Email 2', from: 'sender2@example.com' },
          ],
        },
        tokens_used: 0,
      });

      // Source 2 (has overlap with source 1)
      previousResults.set('source2', {
        success: true,
        node_id: 'source2',
        data: {
          items: [
            { id: 'item2', subject: 'Email 2', from: 'sender2@example.com' }, // Duplicate
            { id: 'item3', subject: 'Email 3', from: 'sender3@example.com' },
          ],
        },
        tokens_used: 0,
      });

      mockAiService.generateStructuredData.mockResolvedValue({
        ranked_items: [
          { item_id: 'item1', rank: 1, score: 95, ranking_reason: 'Most relevant' },
          { item_id: 'item2', rank: 2, score: 85, ranking_reason: 'Relevant' },
          { item_id: 'item3', rank: 3, score: 75, ranking_reason: 'Less relevant' },
        ],
      });

      const params = {
        sources: ['source1', 'source2'],
        operation: 'union' as const,
        rank_by: 'relevance to user query',
        take_top: 5,
        node_id: 'cross_ref_1',
      };

      const result = await strategy.execute(params, 'user123', previousResults);

      expect(result.success).toBe(true);
      expect(result.data?.operation_summary.total_input_items).toBe(3); // Deduplicated
      expect(result.data?.ranked_results).toHaveLength(3);
      expect(mockAiService.generateStructuredData).toHaveBeenCalled();
    });
  });

  describe('Intersection operation', () => {
    it('should find items present in multiple sources', async () => {
      const previousResults = new Map<string, NodeResult>();

      previousResults.set('source1', {
        success: true,
        node_id: 'source1',
        data: {
          items: [
            { id: 'item1', subject: 'Email 1' },
            { id: 'item2', subject: 'Email 2' },
          ],
        },
        tokens_used: 0,
      });

      previousResults.set('source2', {
        success: true,
        node_id: 'source2',
        data: {
          items: [
            { id: 'item2', subject: 'Email 2' }, // Present in both
            { id: 'item3', subject: 'Email 3' },
          ],
        },
        tokens_used: 0,
      });

      mockAiService.generateStructuredData.mockResolvedValue({
        ranked_items: [
          { item_id: 'item2', rank: 1, score: 95, ranking_reason: 'Present in multiple sources' },
        ],
      });

      const params = {
        sources: ['source1', 'source2'],
        operation: 'intersection' as const,
        rank_by: 'intersection count',
        take_top: 10,
        node_id: 'cross_ref_2',
      };

      const result = await strategy.execute(params, 'user123', previousResults);

      expect(result.success).toBe(true);
      expect(result.data?.operation_summary.total_input_items).toBe(1); // Only item2
    });
  });

  describe('Ranking', () => {
    it('should rank items using LLM', async () => {
      const previousResults = new Map<string, NodeResult>();

      previousResults.set('source1', {
        success: true,
        node_id: 'source1',
        data: {
          threads: [
            {
              thread_id: 'thread1',
              context: 'Urgent request from client',
              urgency_signals: { level: 'high', evidence: ['urgent'] },
            },
            {
              thread_id: 'thread2',
              context: 'Regular update',
              urgency_signals: { level: 'low', evidence: [] },
            },
          ],
        },
        tokens_used: 0,
      });

      mockAiService.generateStructuredData.mockResolvedValue({
        ranked_items: [
          { item_id: 'thread1', rank: 1, score: 95, ranking_reason: 'High urgency' },
          { item_id: 'thread2', rank: 2, score: 60, ranking_reason: 'Low urgency' },
        ],
      });

      const params = {
        sources: ['source1'],
        operation: 'custom' as const,
        rank_by: 'urgency level',
        take_top: 5,
        node_id: 'cross_ref_3',
      };

      const result = await strategy.execute(params, 'user123', previousResults);

      expect(result.success).toBe(true);
      expect(result.data?.ranked_results[0].rank).toBe(1);
      expect(result.data?.ranked_results[0].score).toBe(95);
    });

    it('should limit results to take_top', async () => {
      const previousResults = new Map<string, NodeResult>();

      previousResults.set('source1', {
        success: true,
        node_id: 'source1',
        data: {
          items: Array.from({ length: 10 }, (_, i) => ({
            id: `item${i}`,
            subject: `Email ${i}`,
          })),
        },
        tokens_used: 0,
      });

      mockAiService.generateStructuredData.mockResolvedValue({
        ranked_items: Array.from({ length: 10 }, (_, i) => ({
          item_id: `item${i}`,
          rank: i + 1,
          score: 100 - i * 5,
          ranking_reason: `Rank ${i + 1}`,
        })),
      });

      const params = {
        sources: ['source1'],
        operation: 'union' as const,
        rank_by: 'relevance',
        take_top: 3,
        node_id: 'cross_ref_4',
      };

      const result = await strategy.execute(params, 'user123', previousResults);

      expect(result.success).toBe(true);
      expect(result.data?.ranked_results).toHaveLength(3); // Limited to take_top
    });
  });

  describe('Error handling', () => {
    it('should handle missing previous results', async () => {
      const params = {
        sources: ['source1'],
        operation: 'union' as const,
        rank_by: 'relevance',
        take_top: 5,
        node_id: 'cross_ref_error',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires previous results');
    });

    it('should handle empty sources', async () => {
      const previousResults = new Map<string, NodeResult>();

      const params = {
        sources: [],
        operation: 'union' as const,
        rank_by: 'relevance',
        take_top: 5,
        node_id: 'cross_ref_empty',
      };

      const result = await strategy.execute(params, 'user123', previousResults);

      expect(result.success).toBe(true);
      expect(result.data?.operation_summary.total_input_items).toBe(0);
      expect(result.data?.ranked_results).toHaveLength(0);
    });

    it('should skip failed sources', async () => {
      const previousResults = new Map<string, NodeResult>();

      previousResults.set('source1', {
        success: false,
        node_id: 'source1',
        error: 'Failed to fetch',
        tokens_used: 0,
      });

      previousResults.set('source2', {
        success: true,
        node_id: 'source2',
        data: {
          items: [{ id: 'item1', subject: 'Email 1' }],
        },
        tokens_used: 0,
      });

      mockAiService.generateStructuredData.mockResolvedValue({
        ranked_items: [
          { item_id: 'item1', rank: 1, score: 90, ranking_reason: 'Only item' },
        ],
      });

      const params = {
        sources: ['source1', 'source2'],
        operation: 'union' as const,
        rank_by: 'relevance',
        take_top: 5,
        node_id: 'cross_ref_partial',
      };

      const result = await strategy.execute(params, 'user123', previousResults);

      expect(result.success).toBe(true);
      expect(result.data?.operation_summary.total_input_items).toBe(1);
    });
  });
});
