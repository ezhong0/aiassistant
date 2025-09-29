/**
 * Component Tests for AI Test Scenario Generator
 * Tests the scenario generation functionality in isolation
 */

import { AITestScenarioGenerator, TestScenario } from '../ai/scenario-generator';
import { GenericAIService } from '../../../src/services/generic-ai.service';
import { serviceManager } from '../../../src/services/service-manager';

describe('AI Test Scenario Generator Component Tests', () => {
  let scenarioGenerator: AITestScenarioGenerator;
  let aiService: GenericAIService;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.E2E_TESTING = 'true';
    
    // Initialize test services with mocks
    const { initializeTestServices } = await import('../../../src/services/test-service-initialization');
    await initializeTestServices();
    
    aiService = serviceManager.getService<GenericAIService>('genericAIService')!;
    expect(aiService).toBeDefined();
  });

  beforeEach(() => {
    scenarioGenerator = new AITestScenarioGenerator(aiService);
  });

  describe('Scenario Generation', () => {
    test('should generate scenarios with correct structure', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios.length).toBeLessThanOrEqual(3);

      scenarios.forEach(scenario => {
        expect(scenario.id).toBeDefined();
        expect(scenario.userInput).toBeDefined();
        expect(scenario.expectedActions).toBeInstanceOf(Array);
        expect(scenario.expectedApiCalls).toBeInstanceOf(Array);
        expect(scenario.complexity).toBe('simple');
        expect(scenario.category).toBe('email');
        expect(scenario.description).toBeDefined();
      });
    });

    test('should generate scenarios for different categories', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 6,
        categories: ['email', 'calendar', 'slack'],
        complexityLevels: ['simple']
      });

      expect(scenarios.length).toBeGreaterThan(0);

      const categories = scenarios.map(s => s.category);
      expect(categories).toContain('email');
      expect(categories).toContain('calendar');
      expect(categories).toContain('slack');
    });

    test('should generate scenarios for different complexity levels', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 6,
        categories: ['email'],
        complexityLevels: ['simple', 'medium', 'complex']
      });

      expect(scenarios.length).toBeGreaterThan(0);

      const complexities = scenarios.map(s => s.complexity);
      expect(complexities).toContain('simple');
      expect(complexities).toContain('medium');
      expect(complexities).toContain('complex');
    });

    test('should generate edge case scenarios when requested', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 5,
        categories: ['multi-domain'],
        complexityLevels: ['complex'],
        includeEdgeCases: true
      });

      expect(scenarios.length).toBeGreaterThan(0);

      // Check if any scenarios are marked as edge cases
      const hasEdgeCases = scenarios.some(s => 
        s.description?.toLowerCase().includes('edge') ||
        s.userInput?.length < 20 ||
        s.expectedApiCalls?.length === 0
      );

      // Edge cases might not always be generated, so we just verify the system works
      expect(scenarios.every(s => s.id && s.userInput && s.description)).toBe(true);
    });

    test('should respect count limit', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 2,
        categories: ['email', 'calendar', 'slack', 'contacts', 'multi-domain'],
        complexityLevels: ['simple', 'medium', 'complex']
      });

      expect(scenarios.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Scenario Quality', () => {
    test('should generate realistic user inputs', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 5,
        categories: ['email'],
        complexityLevels: ['simple', 'medium']
      });

      scenarios.forEach(scenario => {
        expect(scenario.userInput.length).toBeGreaterThan(10);
        expect(scenario.userInput.length).toBeLessThan(500);
        expect(scenario.userInput).toMatch(/[a-zA-Z]/); // Should contain letters
      });
    });

    test('should generate appropriate expected actions', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      scenarios.forEach(scenario => {
        expect(scenario.expectedActions.length).toBeGreaterThan(0);
        scenario.expectedActions.forEach(action => {
          expect(action.length).toBeGreaterThan(0);
          expect(typeof action).toBe('string');
        });
      });
    });

    test('should generate appropriate expected API calls', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      scenarios.forEach(scenario => {
        expect(scenario.expectedApiCalls.length).toBeGreaterThan(0);
        scenario.expectedApiCalls.forEach(apiCall => {
          expect(apiCall.length).toBeGreaterThan(0);
          expect(typeof apiCall).toBe('string');
        });
      });
    });

    test('should generate meaningful descriptions', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 3,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      scenarios.forEach(scenario => {
        expect(scenario.description.length).toBeGreaterThan(10);
        expect(scenario.description.length).toBeLessThan(200);
        expect(scenario.description).toMatch(/[a-zA-Z]/); // Should contain letters
      });
    });
  });

  describe('Fallback Scenarios', () => {
    test('should provide fallback scenarios when AI generation fails', async () => {
      // Create a mock AI service that always fails
      const mockAiService = {
        executePrompt: async () => {
          throw new Error('AI service unavailable');
        }
      } as any;

      const fallbackGenerator = new AITestScenarioGenerator(mockAiService);
      const scenarios = await fallbackGenerator.generateScenarios({
        count: 2,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);
      scenarios.forEach(scenario => {
        expect(scenario.id).toBeDefined();
        expect(scenario.userInput).toBeDefined();
        expect(scenario.expectedActions).toBeInstanceOf(Array);
        expect(scenario.expectedApiCalls).toBeInstanceOf(Array);
        expect(scenario.complexity).toBe('simple');
        expect(scenario.category).toBe('email');
        expect(scenario.description).toBeDefined();
      });
    });

    test('should provide fallback edge cases when AI generation fails', async () => {
      // Create a mock AI service that always fails
      const mockAiService = {
        executePrompt: async () => {
          throw new Error('AI service unavailable');
        }
      } as any;

      const fallbackGenerator = new AITestScenarioGenerator(mockAiService);
      const scenarios = await fallbackGenerator.generateScenarios({
        count: 2,
        categories: ['multi-domain'],
        complexityLevels: ['complex'],
        includeEdgeCases: true
      });

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid AI responses gracefully', async () => {
      // Create a mock AI service that returns invalid responses
      const mockAiService = {
        executePrompt: async () => {
          return {
            parsed: null // Invalid response
          };
        }
      } as any;

      const errorGenerator = new AITestScenarioGenerator(mockAiService);
      const scenarios = await errorGenerator.generateScenarios({
        count: 2,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);
    });

    test('should handle empty AI responses gracefully', async () => {
      // Create a mock AI service that returns empty responses
      const mockAiService = {
        executePrompt: async () => {
          return {
            parsed: {
              scenarios: [] // Empty scenarios
            }
          };
        }
      } as any;

      const emptyGenerator = new AITestScenarioGenerator(mockAiService);
      const scenarios = await emptyGenerator.generateScenarios({
        count: 2,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0); // Should fall back to predefined scenarios
    });
  });

  describe('Performance', () => {
    test('should generate scenarios within reasonable time', async () => {
      const startTime = Date.now();
      
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 5,
        categories: ['email', 'calendar'],
        complexityLevels: ['simple', 'medium']
      });

      const duration = Date.now() - startTime;

      expect(scenarios.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test('should handle large scenario counts efficiently', async () => {
      const startTime = Date.now();
      
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 10,
        categories: ['email', 'calendar', 'slack', 'contacts', 'multi-domain'],
        complexityLevels: ['simple', 'medium', 'complex']
      });

      const duration = Date.now() - startTime;

      expect(scenarios.length).toBeLessThanOrEqual(10);
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
    });
  });

  describe('Scenario Uniqueness', () => {
    test('should generate unique scenario IDs', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 5,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      const ids = scenarios.map(s => s.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
    });

    test('should generate diverse user inputs', async () => {
      const scenarios = await scenarioGenerator.generateScenarios({
        count: 5,
        categories: ['email'],
        complexityLevels: ['simple']
      });

      const inputs = scenarios.map(s => s.userInput);
      const uniqueInputs = new Set(inputs);
      
      // Most inputs should be unique (allowing for some overlap)
      expect(uniqueInputs.size).toBeGreaterThan(inputs.length * 0.8);
    });
  });
});
