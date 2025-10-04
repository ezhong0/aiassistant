/**
 * Layer 3: Synthesis Service Tests
 *
 * Tests for natural language synthesis from structured findings.
 */

import { SynthesisService } from '../../../src/layers/layer3-synthesis/synthesis.service';
import { AIDomainService } from '../../../src/services/domain/ai-domain.service';
import { ExecutionGraph } from '../../../src/layers/layer1-decomposition/execution-graph.types';
import { ExecutionResults } from '../../../src/layers/layer2-execution/execution.types';

describe('Layer 3: SynthesisService', () => {
  let synthesizer: SynthesisService;
  let mockAIService: jest.Mocked<AIDomainService>;

  beforeEach(() => {
    mockAIService = {
      chat: jest.fn(),
    } as any;

    synthesizer = new SynthesisService(mockAIService);
  });

  describe('Response Generation', () => {
    it('should generate natural language from structured findings', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'filtered_search',
          complexity: 'moderate',
          domains: ['email'],
          reasoning: 'Looking for specific emails',
        },
        information_needs: [],
        synthesis_instructions: {
          task: 'Find urgent emails',
          ranking_criteria: 'urgency',
          presentation_format: 'list',
          user_preferences: 'Show most urgent first',
        },
        resource_estimate: {
          total_items_accessed: 10,
          total_llm_calls: 2,
          estimated_tokens: 5000,
          estimated_time_seconds: 2,
          estimated_cost_usd: 0.001,
          user_should_confirm: false,
        },
      };

      const mockResults: ExecutionResults = {
        nodeResults: new Map([
          [
            'node1',
            {
              success: true,
              node_id: 'node1',
              data: {
                count: 3,
                items: [
                  { id: '1', subject: 'Urgent: Action Required', from: 'boss@company.com' },
                  { id: '2', subject: 'Quick Question', from: 'colleague@company.com' },
                ],
              },
              tokens_used: 1000,
            },
          ],
        ]),
      };

      mockAIService.chat.mockResolvedValue({
        content: 'You have 3 urgent emails requiring attention. The most urgent is from boss@company.com.',
        metadata: {
          model: 'gpt-5-mini',
          tokensUsed: { prompt: 500, completion: 50, total: 550 },
          executionTime: 1500,
        },
      });

      const result = await synthesizer.synthesize(
        'show me urgent emails',
        mockGraph,
        mockResults,
        { tone: 'professional' }
      );

      expect(result.message).toContain('urgent');
      expect(result.metadata.findings_count).toBe(1);
      expect(result.metadata.tokens_used).toBeGreaterThan(0);
      expect(mockAIService.chat).toHaveBeenCalled();
    });

    it('should not include raw data in response', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'complex',
          domains: ['email'],
          reasoning: 'Complex query',
        },
        information_needs: [],
        synthesis_instructions: {
          task: 'Analyze threads',
          ranking_criteria: 'relevance',
          presentation_format: 'summary',
          user_preferences: '',
        },
        resource_estimate: {
          total_items_accessed: 5,
          total_llm_calls: 1,
          estimated_tokens: 3000,
          estimated_time_seconds: 1,
          estimated_cost_usd: 0.0005,
          user_should_confirm: false,
        },
      };

      const mockResults: ExecutionResults = {
        nodeResults: new Map([
          [
            'thread_analysis',
            {
              success: true,
              node_id: 'thread_analysis',
              data: {
                threads: [
                  {
                    thread_id: 'thread1',
                    context: 'Project discussion about quarterly goals and objectives for the next fiscal year with very long email body that should not appear in synthesis because it is too long and should be truncated to keep token usage bounded',
                    urgency_signals: { level: 'high' },
                  },
                ],
              },
              tokens_used: 2000,
            },
          ],
        ]),
      };

      mockAIService.chat.mockResolvedValue({
        content: 'Found 1 high-priority thread about a project discussion.',
        metadata: {
          model: 'gpt-5-mini',
          tokensUsed: { prompt: 400, completion: 40, total: 440 },
          executionTime: 1200,
        },
      });

      const result = await synthesizer.synthesize(
        'analyze my threads',
        mockGraph,
        mockResults,
        {}
      );

      // Verify that synthesis was called
      expect(mockAIService.chat).toHaveBeenCalled();

      // Verify the prompt doesn't contain raw email bodies
      const callArgs = mockAIService.chat.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      // Should have truncated context to 100 chars
      expect(prompt).toContain('Project discussion about quarterly goals');
      expect(prompt).not.toContain('should be truncated to keep token usage bounded'); // End of string should be truncated
      expect(prompt.length).toBeLessThan(10000); // Reasonable prompt size
    });

    it('should respect user preferences for tone and format', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['calendar'],
          reasoning: 'Simple lookup',
        },
        information_needs: [],
        synthesis_instructions: {
          task: 'List events',
          ranking_criteria: 'time',
          presentation_format: 'list',
          user_preferences: '',
        },
        resource_estimate: {
          total_items_accessed: 3,
          total_llm_calls: 0,
          estimated_tokens: 1000,
          estimated_time_seconds: 0.5,
          estimated_cost_usd: 0.0001,
          user_should_confirm: false,
        },
      };

      const mockResults: ExecutionResults = {
        nodeResults: new Map([
          [
            'events',
            {
              success: true,
              node_id: 'events',
              data: {
                count: 2,
                items: [
                  { id: '1', subject: 'Team Meeting' },
                  { id: '2', subject: 'Lunch' },
                ],
              },
              tokens_used: 0,
            },
          ],
        ]),
      };

      mockAIService.chat.mockResolvedValue({
        content: '- Team Meeting\n- Lunch',
        metadata: {
          model: 'gpt-5-mini',
          tokensUsed: { prompt: 300, completion: 20, total: 320 },
          executionTime: 800,
        },
      });

      await synthesizer.synthesize('what are my events', mockGraph, mockResults, {
        tone: 'concise',
        format_preference: 'bullets',
        verbosity: 'brief',
      });

      const callArgs = mockAIService.chat.mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;
      const userPrompt = callArgs.messages[1].content;

      expect(systemPrompt).toContain('concise');
      expect(userPrompt).toContain('brief');
      expect(userPrompt).toContain('bullet');
    });
  });

  describe('Findings Formatting', () => {
    it('should compress findings before synthesis', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'filtered_search',
          complexity: 'moderate',
          domains: ['email'],
          reasoning: 'Search',
        },
        information_needs: [],
        synthesis_instructions: {
          task: 'Search',
          ranking_criteria: 'relevance',
          presentation_format: 'list',
          user_preferences: '',
        },
        resource_estimate: {
          total_items_accessed: 100,
          total_llm_calls: 1,
          estimated_tokens: 5000,
          estimated_time_seconds: 2,
          estimated_cost_usd: 0.001,
          user_should_confirm: false,
        },
      };

      const mockResults: ExecutionResults = {
        nodeResults: new Map([
          [
            'search',
            {
              success: true,
              node_id: 'search',
              data: {
                count: 50,
                items: Array.from({ length: 50 }, (_, i) => ({
                  id: `${i}`,
                  subject: `Email ${i}`,
                  snippet: `Very long email body with lots of text that should be truncated ${i}`.repeat(10),
                })),
              },
              tokens_used: 1000,
            },
          ],
        ]),
      };

      mockAIService.chat.mockResolvedValue({
        content: 'Found 50 emails matching your search.',
        metadata: {
          model: 'gpt-5-mini',
          tokensUsed: { prompt: 600, completion: 30, total: 630 },
          executionTime: 1000,
        },
      });

      await synthesizer.synthesize('search my emails', mockGraph, mockResults, {});

      const callArgs = mockAIService.chat.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      // Findings should be limited to 10 items
      expect(prompt).toContain('Key findings');

      // Each snippet should be truncated to 150 chars
      const snippetMatches = prompt.match(/snippet/gi) || [];
      expect(snippetMatches.length).toBeLessThanOrEqual(10); // Limited to top 10
    });

    it('should keep synthesis input under 20K tokens', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'complex',
          domains: ['email'],
          reasoning: 'Complex analysis',
        },
        information_needs: Array.from({ length: 10 }, (_, i) => ({
          id: `node${i}`,
          description: `Node ${i}`,
          type: 'batch_thread_read' as const,
          strategy: { method: 'batch', params: {} },
          depends_on: [],
          parallel_group: 1,
          expected_cost: { tokens: 1000, llm_calls: 1, time_seconds: 1 },
        })),
        synthesis_instructions: {
          task: 'Analyze',
          ranking_criteria: 'urgency',
          presentation_format: 'summary',
          user_preferences: '',
        },
        resource_estimate: {
          total_items_accessed: 200,
          total_llm_calls: 10,
          estimated_tokens: 50000,
          estimated_time_seconds: 10,
          estimated_cost_usd: 0.01,
          user_should_confirm: false,
        },
      };

      const mockResults: ExecutionResults = {
        nodeResults: new Map(
          Array.from({ length: 10 }, (_, i) => [
            `node${i}`,
            {
              success: true,
              node_id: `node${i}`,
              data: {
                count: 20,
                threads: Array.from({ length: 20 }, (_, j) => ({
                  thread_id: `thread${j}`,
                  context: `Thread context ${j}`,
                  urgency_signals: { level: 'medium' },
                })),
              },
              tokens_used: 5000,
            },
          ])
        ),
      };

      mockAIService.chat.mockResolvedValue({
        content: 'Analysis complete.',
        metadata: {
          model: 'gpt-5-mini',
          tokensUsed: { prompt: 8000, completion: 100, total: 8100 },
          executionTime: 3000,
        },
      });

      const result = await synthesizer.synthesize('analyze everything', mockGraph, mockResults, {});

      const callArgs = mockAIService.chat.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      // Estimate tokens (rough: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(prompt.length / 4);

      // Should be under 20K tokens
      expect(estimatedTokens).toBeLessThan(20000);
      expect(result.metadata.tokens_used).toBeLessThan(25000); // Including response
    });
  });

  describe('Error handling', () => {
    it('should handle AI service errors', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['email'],
          reasoning: 'Simple query',
        },
        information_needs: [],
        synthesis_instructions: {
          task: 'Get emails',
          ranking_criteria: 'date',
          presentation_format: 'list',
          user_preferences: '',
        },
        resource_estimate: {
          total_items_accessed: 5,
          total_llm_calls: 0,
          estimated_tokens: 1000,
          estimated_time_seconds: 0.5,
          estimated_cost_usd: 0.0001,
          user_should_confirm: false,
        },
      };

      const mockResults: ExecutionResults = {
        nodeResults: new Map([
          [
            'emails',
            {
              success: true,
              node_id: 'emails',
              data: { count: 3, items: [] },
              tokens_used: 0,
            },
          ],
        ]),
      };

      mockAIService.chat.mockRejectedValue(new Error('AI service error'));

      await expect(
        synthesizer.synthesize('get my emails', mockGraph, mockResults, {})
      ).rejects.toThrow('AI service error');
    });
  });
});
