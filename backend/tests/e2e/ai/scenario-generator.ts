/**
 * AI-Powered Test Scenario Generator
 * Generates realistic user inputs for comprehensive E2E testing
 */

import { GenericAIService } from '../../../src/services/generic-ai.service';
import logger from '../../../src/utils/logger';

export interface TestScenario {
  id: string;
  userInput: string;
  expectedActions: string[];
  expectedApiCalls: string[];
  complexity: 'simple' | 'medium' | 'complex';
  category: 'email' | 'calendar' | 'slack' | 'contacts' | 'multi-domain';
  description: string;
}

export interface ScenarioGenerationConfig {
  count: number;
  categories?: string[];
  complexityLevels?: string[];
  includeEdgeCases?: boolean;
}

/**
 * AI-powered test scenario generator
 */
export class AITestScenarioGenerator {
  private aiService: GenericAIService;

  constructor(aiService: GenericAIService) {
    this.aiService = aiService;
  }

  /**
   * Generate multiple test scenarios using AI
   */
  async generateScenarios(config: ScenarioGenerationConfig): Promise<TestScenario[]> {
    const scenarios: TestScenario[] = [];

    logger.info('Generating AI test scenarios', {
      operation: 'ai_scenario_generation',
      config
    });

    // Generate different types of scenarios
    const categories = config.categories || ['email', 'calendar', 'slack', 'contacts', 'multi-domain'];
    const complexityLevels = config.complexityLevels || ['simple', 'medium', 'complex'];

    for (const category of categories) {
      for (const complexity of complexityLevels) {
        const scenarioCount = Math.ceil(config.count / (categories.length * complexityLevels.length));

        const categoryScenarios = await this.generateCategoryScenarios(
          category,
          complexity as 'simple' | 'medium' | 'complex',
          scenarioCount
        );

        scenarios.push(...categoryScenarios);
      }
    }

    // Generate edge cases if requested
    if (config.includeEdgeCases) {
      const edgeCaseScenarios = await this.generateEdgeCaseScenarios(5);
      scenarios.push(...edgeCaseScenarios);
    }

    logger.info('AI test scenarios generated successfully', {
      operation: 'ai_scenario_generation_complete',
      totalScenarios: scenarios.length,
      breakdown: this.getScenarioBreakdown(scenarios)
    });

    return scenarios.slice(0, config.count);
  }

  /**
   * Generate scenarios for a specific category and complexity
   */
  private async generateCategoryScenarios(
    category: string,
    complexity: 'simple' | 'medium' | 'complex',
    count: number
  ): Promise<TestScenario[]> {
    const prompt = this.buildScenarioGenerationPrompt(category, complexity, count);

    try {
      const response = await this.aiService.executePrompt(prompt, {
        type: 'object',
        properties: {
          scenarios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userInput: { type: 'string' },
                expectedActions: {
                  type: 'array',
                  items: { type: 'string' }
                },
                expectedApiCalls: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: { type: 'string' }
              },
              required: ['userInput', 'expectedActions', 'expectedApiCalls', 'description']
            }
          }
        },
        required: ['scenarios']
      });

      return response.scenarios.map((scenario: any, index: number) => ({
        id: `${category}_${complexity}_${Date.now()}_${index}`,
        userInput: scenario.userInput,
        expectedActions: scenario.expectedActions,
        expectedApiCalls: scenario.expectedApiCalls,
        complexity,
        category: category as any,
        description: scenario.description
      }));

    } catch (error) {
      logger.error('Failed to generate AI scenarios', error as Error, {
        category,
        complexity,
        count
      });

      // Fallback to predefined scenarios
      return this.getFallbackScenarios(category, complexity, count);
    }
  }

  /**
   * Generate edge case scenarios
   */
  private async generateEdgeCaseScenarios(count: number): Promise<TestScenario[]> {
    const edgeCasePrompt = `
Generate ${count} edge case scenarios for testing an AI assistant that handles email, calendar, contacts, and Slack operations.

Edge cases should include:
- Ambiguous requests
- Requests with missing information
- Requests that require clarification
- Requests that might fail or need error handling
- Unusual but valid requests
- Requests that test system limits

For each scenario, provide:
- userInput: The edge case user request
- expectedActions: What the system should do (may include asking for clarification)
- expectedApiCalls: Expected API calls (may be empty if clarification needed)
- description: Why this is an edge case

Return as JSON with a scenarios array.
    `;

    try {
      const response = await this.aiService.executePrompt(edgeCasePrompt, {
        type: 'object',
        properties: {
          scenarios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userInput: { type: 'string' },
                expectedActions: {
                  type: 'array',
                  items: { type: 'string' }
                },
                expectedApiCalls: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: { type: 'string' }
              }
            }
          }
        }
      });

      return response.scenarios.map((scenario: any, index: number) => ({
        id: `edge_case_${Date.now()}_${index}`,
        userInput: scenario.userInput,
        expectedActions: scenario.expectedActions,
        expectedApiCalls: scenario.expectedApiCalls,
        complexity: 'complex' as const,
        category: 'multi-domain' as const,
        description: scenario.description
      }));

    } catch (error) {
      logger.error('Failed to generate edge case scenarios', error as Error);
      return this.getFallbackEdgeCases();
    }
  }

  /**
   * Build prompt for scenario generation
   */
  private buildScenarioGenerationPrompt(
    category: string,
    complexity: 'simple' | 'medium' | 'complex',
    count: number
  ): string {
    const complexityGuides = {
      simple: 'Single action, clear intent, minimal ambiguity',
      medium: 'Multiple actions, some context needed, moderate complexity',
      complex: 'Multi-step workflows, context dependencies, advanced reasoning required'
    };

    const categoryGuides = {
      email: 'Gmail operations: send, search, read, organize emails',
      calendar: 'Google Calendar: create events, schedule meetings, check availability',
      slack: 'Slack messaging: send messages, check conversations, team communication',
      contacts: 'Google Contacts: find people, add contacts, get contact info',
      'multi-domain': 'Cross-service operations involving 2+ services'
    };

    return `
Generate ${count} realistic test scenarios for an AI assistant that handles ${category} operations.

Complexity Level: ${complexity} - ${complexityGuides[complexity]}
Category Focus: ${categoryGuides[category as keyof typeof categoryGuides] || 'General operations'}

For each scenario, provide:
- userInput: Natural language request a user might make
- expectedActions: Array of high-level actions the system should take
- expectedApiCalls: Array of specific API calls expected (e.g., "gmail_search", "calendar_create", "slack_post")
- description: Brief description of what this scenario tests

Make the scenarios realistic and diverse. Include different:
- Request styles (formal, casual, urgent)
- Time references (today, tomorrow, next week)
- Specificity levels (very specific vs general requests)
- User contexts (work, personal, mixed)

Return as JSON with a scenarios array.
    `;
  }

  /**
   * Get scenario breakdown for logging
   */
  private getScenarioBreakdown(scenarios: TestScenario[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    scenarios.forEach(scenario => {
      const key = `${scenario.category}_${scenario.complexity}`;
      breakdown[key] = (breakdown[key] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Fallback scenarios if AI generation fails
   */
  private getFallbackScenarios(
    category: string,
    complexity: 'simple' | 'medium' | 'complex',
    count: number
  ): TestScenario[] {
    const fallbackScenarios: Record<string, Record<string, TestScenario[]>> = {
      email: {
        simple: [{
          id: `fallback_email_simple_${Date.now()}`,
          userInput: 'Send an email to john@example.com about the meeting',
          expectedActions: ['compose_email', 'send_email'],
          expectedApiCalls: ['gmail_send'],
          complexity: 'simple',
          category: 'email',
          description: 'Simple email sending scenario'
        }],
        medium: [{
          id: `fallback_email_medium_${Date.now()}`,
          userInput: 'Find emails about the project proposal and forward the latest one to the team',
          expectedActions: ['search_emails', 'select_latest', 'forward_email'],
          expectedApiCalls: ['gmail_search', 'gmail_send'],
          complexity: 'medium',
          category: 'email',
          description: 'Email search and forward scenario'
        }],
        complex: [{
          id: `fallback_email_complex_${Date.now()}`,
          userInput: 'Search for all emails from clients this month, categorize by project, and send a summary to my manager',
          expectedActions: ['search_emails', 'categorize_by_project', 'generate_summary', 'send_summary'],
          expectedApiCalls: ['gmail_search', 'gmail_send'],
          complexity: 'complex',
          category: 'email',
          description: 'Complex email analysis and reporting scenario'
        }]
      }
    };

    const categoryScenarios = fallbackScenarios[category]?.[complexity] || [];
    return categoryScenarios.slice(0, count);
  }

  /**
   * Fallback edge case scenarios
   */
  private getFallbackEdgeCases(): TestScenario[] {
    return [
      {
        id: `fallback_edge_${Date.now()}_1`,
        userInput: 'Do something with the thing',
        expectedActions: ['request_clarification'],
        expectedApiCalls: [],
        complexity: 'complex',
        category: 'multi-domain',
        description: 'Extremely vague request requiring clarification'
      },
      {
        id: `fallback_edge_${Date.now()}_2`,
        userInput: 'Send email to',
        expectedActions: ['request_recipient_info'],
        expectedApiCalls: [],
        complexity: 'complex',
        category: 'email',
        description: 'Incomplete email request missing recipient'
      }
    ];
  }
}