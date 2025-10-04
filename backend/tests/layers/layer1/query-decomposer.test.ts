/**
 * Layer 1: Query Decomposer Tests
 *
 * Tests for query decomposition into execution graphs.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryDecomposerService } from '../../../src/layers/layer1-decomposition/query-decomposer.service';
import { DecompositionInput, ExecutionGraph } from '../../../src/layers/layer1-decomposition/execution-graph.types';
import { AIDomainService } from '../../../src/services/domain/ai-domain.service';

describe('Layer 1: QueryDecomposerService', () => {
  let decomposer: QueryDecomposerService;
  let mockAIService: jest.Mocked<AIDomainService>;

  beforeEach(() => {
    // Create mock AI service
    mockAIService = {
      executePrompt: jest.fn(),
    } as any;

    decomposer = new QueryDecomposerService(mockAIService);
  });

  describe('Query Classification', () => {
    it('should classify "what\'s on my calendar today?" as direct', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['calendar'],
          reasoning: 'Simple calendar lookup for specific date'
        },
        information_needs: [
          {
            id: 'today_events',
            description: 'Get today\'s calendar events',
            type: 'metadata_filter',
            strategy: {
              method: 'calendar_events_by_date',
              params: { date: '2025-10-03', max_results: 50 }
            },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.3 }
          }
        ],
        synthesis_instructions: {
          task: 'List events chronologically',
          ranking_criteria: 'by time',
          presentation_format: 'list',
          user_preferences: 'concise'
        },
        resource_estimate: {
          total_items_accessed: 10,
          total_llm_calls: 0,
          estimated_tokens: 500,
          estimated_time_seconds: 1,
          estimated_cost_usd: 0.001,
          user_should_confirm: false
        }
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(mockGraph),
        parsed: mockGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 500, processingTime: 800, success: true }
      });

      const input: DecompositionInput = {
        user_query: "what's on my calendar today?",
        conversation_history: [],
        user_context: { timezone: 'America/Los_Angeles' },
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      const result = await decomposer.decompose(input);

      expect(result.query_classification.type).toBe('direct');
      expect(result.query_classification.complexity).toBe('simple');
      expect(result.information_needs).toHaveLength(1);
    });

    it('should classify "what emails am I blocking people on?" as investigative', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'complex',
          domains: ['email'],
          reasoning: 'Requires multi-step reasoning to identify threads where others are waiting'
        },
        information_needs: [
          {
            id: 'recent_unreplied',
            description: 'Find emails where user received last message',
            type: 'metadata_filter',
            strategy: {
              method: 'gmail_search',
              params: { filters: ['is:unread'], max_results: 100 }
            },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'waiting_indicators',
            description: 'Find emails with waiting language',
            type: 'keyword_search',
            strategy: {
              method: 'gmail_search',
              params: { patterns: ['following up', 'checking in'], max_results: 100 }
            },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'candidate_threads',
            description: 'Intersect results',
            type: 'cross_reference',
            strategy: {
              method: 'intersect_and_rank',
              params: { sources: ['recent_unreplied', 'waiting_indicators'], take_top: 20 }
            },
            depends_on: ['recent_unreplied', 'waiting_indicators'],
            parallel_group: 2,
            expected_cost: { tokens: 2000, llm_calls: 1, time_seconds: 0.8 }
          },
          {
            id: 'thread_analysis',
            description: 'Analyze threads',
            type: 'batch_thread_read',
            strategy: {
              method: 'analyze_threads_batch',
              params: {
                thread_ids: '{{candidate_threads.top_20}}',
                batch_size: 5
              }
            },
            depends_on: ['candidate_threads'],
            parallel_group: 3,
            expected_cost: { tokens: 40000, llm_calls: 20, time_seconds: 2.5 }
          }
        ],
        synthesis_instructions: {
          task: 'Identify who is waiting',
          ranking_criteria: 'by urgency and time waiting',
          presentation_format: 'grouped by priority',
          user_preferences: 'specific about who and what'
        },
        resource_estimate: {
          total_items_accessed: 120,
          total_llm_calls: 21,
          estimated_tokens: 45000,
          estimated_time_seconds: 4.5,
          estimated_cost_usd: 0.028,
          user_should_confirm: false
        }
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(mockGraph),
        parsed: mockGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 2500, processingTime: 1200, success: true }
      });

      const input: DecompositionInput = {
        user_query: "what emails am I blocking people on?",
        conversation_history: [],
        user_context: { timezone: 'America/Los_Angeles' },
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      const result = await decomposer.decompose(input);

      expect(result.query_classification.type).toBe('investigative');
      expect(result.query_classification.complexity).toBe('complex');
      expect(result.information_needs).toHaveLength(4);
      expect(result.information_needs[0].parallel_group).toBe(1);
      expect(result.information_needs[1].parallel_group).toBe(1);
      expect(result.information_needs[2].parallel_group).toBe(2);
      expect(result.information_needs[3].parallel_group).toBe(3);
    });

    it('should classify "show me urgent emails" as filtered_search', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'filtered_search',
          complexity: 'simple',
          domains: ['email'],
          reasoning: 'Simple search with urgency filter'
        },
        information_needs: [
          {
            id: 'urgent_emails',
            description: 'Find urgent emails',
            type: 'metadata_filter',
            strategy: {
              method: 'gmail_search',
              params: { filters: ['is:important', 'is:unread'], max_results: 50 }
            },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          }
        ],
        synthesis_instructions: {
          task: 'List urgent emails',
          ranking_criteria: 'by date',
          presentation_format: 'list',
          user_preferences: 'show sender and subject'
        },
        resource_estimate: {
          total_items_accessed: 50,
          total_llm_calls: 0,
          estimated_tokens: 800,
          estimated_time_seconds: 1.5,
          estimated_cost_usd: 0.0012,
          user_should_confirm: false
        }
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(mockGraph),
        parsed: mockGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 600, processingTime: 700, success: true }
      });

      const input: DecompositionInput = {
        user_query: "show me urgent emails",
        conversation_history: [],
        user_context: { timezone: 'America/Los_Angeles' },
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      const result = await decomposer.decompose(input);

      expect(result.query_classification.type).toBe('filtered_search');
      expect(result.query_classification.complexity).toBe('simple');
    });
  });

  describe('Execution Graph Generation', () => {
    it('should create valid DAG with dependencies', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'moderate',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'First node',
            type: 'metadata_filter',
            strategy: { method: 'test', params: { max_results: 100 } },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'node2',
            description: 'Second node',
            type: 'cross_reference',
            strategy: { method: 'test', params: { take_top: 20 } },
            depends_on: ['node1'],
            parallel_group: 2,
            expected_cost: { tokens: 2000, llm_calls: 1, time_seconds: 0.8 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 100,
          total_llm_calls: 1,
          estimated_tokens: 3000,
          estimated_time_seconds: 2,
          estimated_cost_usd: 0.0045,
          user_should_confirm: false
        }
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(mockGraph),
        parsed: mockGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 1200, processingTime: 900, success: true }
      });

      const input: DecompositionInput = {
        user_query: "test query",
        conversation_history: [],
        user_context: {},
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      const result = await decomposer.decompose(input);

      // Verify DAG structure
      expect(result.information_needs[0].depends_on).toHaveLength(0);
      expect(result.information_needs[1].depends_on).toContain('node1');
      expect(result.information_needs[0].parallel_group).toBe(1);
      expect(result.information_needs[1].parallel_group).toBe(2);
    });

    it('should assign parallel groups correctly', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'complex',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'parallel1',
            description: 'Parallel node 1',
            type: 'metadata_filter',
            strategy: { method: 'test', params: { max_results: 50 } },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'parallel2',
            description: 'Parallel node 2',
            type: 'keyword_search',
            strategy: { method: 'test', params: { max_results: 50 } },
            depends_on: [],
            parallel_group: 1, // Same group as parallel1
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'sequential',
            description: 'Sequential node',
            type: 'cross_reference',
            strategy: { method: 'test', params: { take_top: 20 } },
            depends_on: ['parallel1', 'parallel2'],
            parallel_group: 2,
            expected_cost: { tokens: 2000, llm_calls: 1, time_seconds: 0.8 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 100,
          total_llm_calls: 1,
          estimated_tokens: 3000,
          estimated_time_seconds: 2,
          estimated_cost_usd: 0.0045,
          user_should_confirm: false
        }
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(mockGraph),
        parsed: mockGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 1500, processingTime: 1000, success: true }
      });

      const input: DecompositionInput = {
        user_query: "test parallel query",
        conversation_history: [],
        user_context: {},
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      const result = await decomposer.decompose(input);

      // Verify parallel groups
      expect(result.information_needs[0].parallel_group).toBe(1);
      expect(result.information_needs[1].parallel_group).toBe(1);
      expect(result.information_needs[2].parallel_group).toBe(2);

      // Verify dependencies
      expect(result.information_needs[2].depends_on).toContain('parallel1');
      expect(result.information_needs[2].depends_on).toContain('parallel2');
    });

    it('should set bounds on all searches', async () => {
      const mockGraph: ExecutionGraph = {
        query_classification: {
          type: 'filtered_search',
          complexity: 'moderate',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'search1',
            description: 'Search with bounds',
            type: 'metadata_filter',
            strategy: {
              method: 'gmail_search',
              params: {
                filters: ['is:unread'],
                max_results: 100, // Bounded
                time_range: 'after:30_days_ago' // Bounded
              }
            },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'thread_read',
            description: 'Thread read with batch bounds',
            type: 'batch_thread_read',
            strategy: {
              method: 'analyze_threads',
              params: {
                thread_ids: '{{search1.top_20}}', // Bounded to top 20
                batch_size: 5 // Batch size limit
              }
            },
            depends_on: ['search1'],
            parallel_group: 2,
            expected_cost: { tokens: 30000, llm_calls: 20, time_seconds: 2 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 120,
          total_llm_calls: 20,
          estimated_tokens: 32000,
          estimated_time_seconds: 3,
          estimated_cost_usd: 0.048,
          user_should_confirm: false
        }
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(mockGraph),
        parsed: mockGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 1800, processingTime: 1100, success: true }
      });

      const input: DecompositionInput = {
        user_query: "test bounded query",
        conversation_history: [],
        user_context: {},
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      const result = await decomposer.decompose(input);

      // Verify bounds are present
      expect(result.information_needs[0].strategy.params.max_results).toBeDefined();
      expect(result.information_needs[1].strategy.params.batch_size).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should reject empty queries', async () => {
      const input: DecompositionInput = {
        user_query: '',
        conversation_history: [],
        user_context: {},
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      await expect(decomposer.decompose(input)).rejects.toThrow('cannot be empty');
    });

    it('should reject queries over 5000 characters', async () => {
      const input: DecompositionInput = {
        user_query: 'a'.repeat(5001),
        conversation_history: [],
        user_context: {},
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      await expect(decomposer.decompose(input)).rejects.toThrow('too long');
    });

    it('should reject missing timestamp', async () => {
      const input: any = {
        user_query: 'test',
        conversation_history: [],
        user_context: {}
        // Missing current_timestamp
      };

      await expect(decomposer.decompose(input)).rejects.toThrow('timestamp required');
    });
  });

  describe('Graph Validation', () => {
    it('should reject invalid graphs from AI', async () => {
      const invalidGraph: any = {
        // Missing query_classification
        information_needs: [],
        synthesis_instructions: {},
        resource_estimate: {}
      };

      mockAIService.executePrompt.mockResolvedValue({
        content: JSON.stringify(invalidGraph),
        parsed: invalidGraph,
        context: '',
        metadata: { model: 'gpt-5-nano', tokens: 500, processingTime: 800, success: true }
      });

      const input: DecompositionInput = {
        user_query: "test query",
        conversation_history: [],
        user_context: {},
        current_timestamp: '2025-10-03T12:00:00Z'
      };

      await expect(decomposer.decompose(input)).rejects.toThrow('Invalid execution graph');
    });
  });
});
