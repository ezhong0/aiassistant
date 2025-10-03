/**
 * Tests for SemanticAnalysisStrategy
 */

import { SemanticAnalysisStrategy } from '../../../../src/layers/layer2-execution/strategies/semantic-analysis-strategy';
import { IAIDomainService } from '../../../../src/services/domain/interfaces/ai-domain.interface';

describe('SemanticAnalysisStrategy', () => {
  let strategy: SemanticAnalysisStrategy;
  let mockAiService: jest.Mocked<IAIDomainService>;

  beforeEach(() => {
    mockAiService = {
      generateStructuredData: jest.fn(),
    } as any;

    strategy = new SemanticAnalysisStrategy(mockAiService);
  });

  describe('Intent classification', () => {
    it('should classify items by intent', async () => {
      mockAiService.generateStructuredData.mockResolvedValue({
        items: [
          {
            item_id: 'item1',
            intent_classification: 'question',
            directed_at_user: true,
            urgency_level: 'high',
            key_phrases: ['can you help', 'urgent'],
            reasoning: 'Direct question with urgency indicators',
          },
          {
            item_id: 'item2',
            intent_classification: 'statement',
            directed_at_user: false,
            urgency_level: 'low',
            key_phrases: ['for your information', 'fyi'],
            reasoning: 'Informational message',
          },
        ],
      });

      const params = {
        items: [
          {
            item_id: 'item1',
            snippet: 'Can you help me with this urgent matter?',
            metadata: { subject: 'Urgent Help Needed' },
          },
          {
            item_id: 'item2',
            snippet: 'FYI - Project update for next week',
            metadata: { subject: 'Project Update' },
          },
        ],
        analysis_task: 'Classify intent and urgency',
        batch_size: 5,
        node_id: 'semantic_1',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.item_results).toHaveLength(2);
      expect(result.data?.item_results[0].intent_classification).toBe('question');
      expect(result.data?.item_results[0].urgency_level).toBe('high');
      expect(result.data?.item_results[1].intent_classification).toBe('statement');
      expect(mockAiService.generateStructuredData).toHaveBeenCalled();
    });
  });

  describe('Batch processing', () => {
    it('should process items in batches', async () => {
      // Mock AI response for each batch
      mockAiService.generateStructuredData
        .mockResolvedValueOnce({
          items: [
            {
              item_id: 'item1',
              intent_classification: 'request',
              directed_at_user: true,
              urgency_level: 'medium',
              key_phrases: ['please review'],
              reasoning: 'Request for action',
            },
            {
              item_id: 'item2',
              intent_classification: 'question',
              directed_at_user: true,
              urgency_level: 'low',
              key_phrases: ['wondering if'],
              reasoning: 'Casual question',
            },
          ],
        })
        .mockResolvedValueOnce({
          items: [
            {
              item_id: 'item3',
              intent_classification: 'statement',
              directed_at_user: false,
              urgency_level: 'low',
              key_phrases: ['update'],
              reasoning: 'Information sharing',
            },
          ],
        });

      const params = {
        items: [
          { item_id: 'item1', snippet: 'Please review this document' },
          { item_id: 'item2', snippet: 'Wondering if you got my email' },
          { item_id: 'item3', snippet: 'Update on the project status' },
        ],
        analysis_task: 'Analyze intent',
        batch_size: 2, // Process in batches of 2
        node_id: 'semantic_2',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.item_results).toHaveLength(3);
      expect(mockAiService.generateStructuredData).toHaveBeenCalledTimes(2); // 2 batches
    });
  });

  describe('Analysis summary', () => {
    it('should provide accurate summary statistics', async () => {
      mockAiService.generateStructuredData.mockResolvedValue({
        items: [
          {
            item_id: 'item1',
            intent_classification: 'question',
            directed_at_user: true,
            urgency_level: 'high',
            key_phrases: ['urgent question'],
            reasoning: 'Direct question',
          },
          {
            item_id: 'item2',
            intent_classification: 'request',
            directed_at_user: true,
            urgency_level: 'medium',
            key_phrases: ['please provide'],
            reasoning: 'Request for information',
          },
          {
            item_id: 'item3',
            intent_classification: 'statement',
            directed_at_user: false,
            urgency_level: 'low',
            key_phrases: ['update'],
            reasoning: 'Informational',
          },
          {
            item_id: 'item4',
            intent_classification: 'mixed',
            directed_at_user: true,
            urgency_level: 'medium',
            key_phrases: ['question', 'request'],
            reasoning: 'Both question and request',
          },
        ],
      });

      const params = {
        items: [
          { item_id: 'item1', snippet: 'Urgent question' },
          { item_id: 'item2', snippet: 'Please provide info' },
          { item_id: 'item3', snippet: 'Update' },
          { item_id: 'item4', snippet: 'Can you help with this?' },
        ],
        analysis_task: 'Analyze all',
        batch_size: 10,
        node_id: 'semantic_3',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.analysis_summary.total_items_analyzed).toBe(4);
      expect(result.data?.analysis_summary.items_with_questions).toBe(2); // question + mixed
      expect(result.data?.analysis_summary.items_with_requests).toBe(2); // request + mixed
      expect(result.data?.analysis_summary.items_informational_only).toBe(1); // statement
    });
  });

  describe('Edge cases', () => {
    it('should handle empty item list', async () => {
      const params = {
        items: [],
        analysis_task: 'Analyze intent',
        batch_size: 5,
        node_id: 'semantic_empty',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.analysis_summary.total_items_analyzed).toBe(0);
      expect(result.data?.item_results).toHaveLength(0);
      expect(mockAiService.generateStructuredData).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      mockAiService.generateStructuredData.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const params = {
        items: [
          { item_id: 'item1', snippet: 'Test message' },
        ],
        analysis_task: 'Analyze intent',
        batch_size: 5,
        node_id: 'semantic_error',
      };

      const result = await strategy.execute(params, 'user123');

      // Should still succeed but with placeholder results for failed batches
      expect(result.success).toBe(true);
      expect(result.data?.item_results).toHaveLength(1);
      expect(result.data?.item_results[0].reasoning).toBe('Error analyzing item');
    });
  });

  describe('Token usage', () => {
    it('should estimate token usage', async () => {
      mockAiService.generateStructuredData.mockResolvedValue({
        items: [
          {
            item_id: 'item1',
            intent_classification: 'question',
            directed_at_user: true,
            urgency_level: 'medium',
            key_phrases: ['question'],
            reasoning: 'Question',
          },
        ],
      });

      const params = {
        items: [
          { item_id: 'item1', snippet: 'This is a test question' },
        ],
        analysis_task: 'Analyze',
        batch_size: 5,
        node_id: 'semantic_tokens',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.metadata.tokens_used).toBeGreaterThan(0);
      expect(result.data?.metadata.llm_calls).toBe(1);
    });
  });
});
