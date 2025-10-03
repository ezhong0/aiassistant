/**
 * Execution Graph Validator Tests
 */

import { describe, it, expect } from '@jest/globals';
import { ExecutionGraphValidator } from '../../../src/layers/layer1-decomposition/execution-graph-validator';
import { ExecutionGraph } from '../../../src/layers/layer1-decomposition/execution-graph.types';

describe('ExecutionGraphValidator', () => {
  let validator: ExecutionGraphValidator;

  beforeEach(() => {
    validator = new ExecutionGraphValidator();
  });

  describe('Basic Structure Validation', () => {
    it('should validate a well-formed graph', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['calendar'],
          reasoning: 'Simple calendar lookup'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'Get today events',
            type: 'metadata_filter',
            strategy: {
              method: 'calendar_lookup',
              params: { date: '2025-10-03', max_results: 50 }
            },
            depends_on: [],
            parallel_group: 1,
            expected_cost: {
              tokens: 0,
              llm_calls: 0,
              time_seconds: 0.3
            }
          }
        ],
        synthesis_instructions: {
          task: 'List events',
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

      const result = validator.validate(graph);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing query_classification', () => {
      const graph: any = {
        information_needs: [],
        synthesis_instructions: {},
        resource_estimate: {}
      };

      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing query_classification');
    });

    it('should detect empty information_needs', () => {
      const graph: any = {
        query_classification: { type: 'direct', complexity: 'simple', domains: [], reasoning: '' },
        information_needs: [],
        synthesis_instructions: {},
        resource_estimate: {}
      };

      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or empty information_needs array');
    });
  });

  describe('Node Validation', () => {
    it('should detect duplicate node IDs', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'First',
            type: 'metadata_filter',
            strategy: { method: 'test', params: {} },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'node1', // Duplicate!
            description: 'Second',
            type: 'metadata_filter',
            strategy: { method: 'test', params: {} },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
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

      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate node ID'))).toBe(true);
    });

    it('should detect invalid parallel_group', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'Test',
            type: 'metadata_filter',
            strategy: { method: 'test', params: {} },
            depends_on: [],
            parallel_group: 0, // Invalid!
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
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

      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid parallel_group'))).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    it('should detect non-existent dependencies', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'moderate',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'First',
            type: 'metadata_filter',
            strategy: { method: 'test', params: {} },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'node2',
            description: 'Second',
            type: 'cross_reference',
            strategy: { method: 'test', params: {} },
            depends_on: ['node1', 'nonexistent'], // Nonexistent!
            parallel_group: 2,
            expected_cost: { tokens: 1000, llm_calls: 1, time_seconds: 0.8 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 20,
          total_llm_calls: 1,
          estimated_tokens: 1500,
          estimated_time_seconds: 2,
          estimated_cost_usd: 0.003,
          user_should_confirm: false
        }
      };

      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-existent node'))).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'complex',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'First',
            type: 'metadata_filter',
            strategy: { method: 'test', params: {} },
            depends_on: ['node2'], // Circular!
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
          },
          {
            id: 'node2',
            description: 'Second',
            type: 'cross_reference',
            strategy: { method: 'test', params: {} },
            depends_on: ['node1'], // Circular!
            parallel_group: 2,
            expected_cost: { tokens: 1000, llm_calls: 1, time_seconds: 0.8 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 20,
          total_llm_calls: 1,
          estimated_tokens: 1500,
          estimated_time_seconds: 2,
          estimated_cost_usd: 0.003,
          user_should_confirm: false
        }
      };

      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular dependencies'))).toBe(true);
    });
  });

  describe('Bounds Validation', () => {
    it('should warn if metadata_filter missing max_results', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'filtered_search',
          complexity: 'simple',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'Search emails',
            type: 'metadata_filter',
            strategy: { method: 'gmail_search', params: { filters: [] } }, // No max_results!
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 0.5 }
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
          total_llm_calls: 0,
          estimated_tokens: 1000,
          estimated_time_seconds: 1,
          estimated_cost_usd: 0.002,
          user_should_confirm: false
        }
      };

      const result = validator.validate(graph);
      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings.some(w => w.includes('missing max_results'))).toBe(true);
    });

    it('should warn about very large operations', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'investigative',
          complexity: 'complex',
          domains: ['email'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'Huge search',
            type: 'metadata_filter',
            strategy: { method: 'test', params: { max_results: 1000 } },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 0, llm_calls: 0, time_seconds: 1 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 1000, // Very large!
          total_llm_calls: 0,
          estimated_tokens: 150000, // Very high!
          estimated_time_seconds: 45, // Very long!
          estimated_cost_usd: 0.5,
          user_should_confirm: true
        }
      };

      const result = validator.validate(graph);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('large operation'))).toBe(true);
    });
  });

  describe('Resource Estimate Validation', () => {
    it('should warn about inconsistent estimates', () => {
      const graph: ExecutionGraph = {
        query_classification: {
          type: 'direct',
          complexity: 'simple',
          domains: ['calendar'],
          reasoning: 'test'
        },
        information_needs: [
          {
            id: 'node1',
            description: 'Test',
            type: 'batch_thread_read',
            strategy: { method: 'test', params: { batch_size: 5 } },
            depends_on: [],
            parallel_group: 1,
            expected_cost: { tokens: 10000, llm_calls: 10, time_seconds: 2 }
          }
        ],
        synthesis_instructions: {
          task: 'test',
          ranking_criteria: 'test',
          presentation_format: 'test',
          user_preferences: 'test'
        },
        resource_estimate: {
          total_items_accessed: 10,
          total_llm_calls: 10,
          estimated_tokens: 10000,
          estimated_time_seconds: 3,
          estimated_cost_usd: 0.0, // Inconsistent with tokens!
          user_should_confirm: false
        }
      };

      const result = validator.validate(graph);
      expect(result.warnings.some(w => w.includes('Cost estimate may be incorrect'))).toBe(true);
    });
  });
});
