/**
 * Think Agent V2 - Meta-Reasoning Microservice
 *
 * Reflection and analysis agent using the NaturalLanguageAgent pattern.
 *
 * This agent only implements 2 methods:
 * 1. getAgentConfig() - Configuration and metadata
 * 2. executeOperation() - Internal thinking/analysis operations
 *
 * Everything else (LLM analysis, response formatting) is handled by the base class.
 */

import { NaturalLanguageAgent, AgentConfig } from '../framework/natural-language-agent';
import { OpenAIService } from '../services/openai.service';

interface ThinkResult {
  analysis?: string;
  suggestions?: string[];
  reasoning?: string;
  confidence?: number;
  success: boolean;
}

/**
 * ThinkAgentV2 - Meta-Reasoning Microservice
 *
 * Microservice API:
 *   Input: Natural language analysis/reflection request
 *   Output: Natural language insights and suggestions
 *
 * Examples:
 *   "Analyze my approach to this problem" → "Your approach is sound because..."
 *   "Verify this aligns with user intent" → "Yes, this matches the user's goal..."
 *   "Suggest improvements" → "Consider these enhancements: 1. ... 2. ..."
 */
export class ThinkAgentV2 extends NaturalLanguageAgent {

  /**
   * Agent configuration - defines what this agent can do
   */
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'Think',

      systemPrompt: `You are a meta-reasoning and analysis agent.

Your role is to analyze approaches, verify alignment with intent, reflect on decisions, and suggest improvements.

Your capabilities:
- Analyze tool selection and approach appropriateness
- Verify actions align with user intent
- Reflect on reasoning and decision-making processes
- Suggest workflow or approach improvements
- Evaluate completeness and efficiency

When handling analysis requests:
1. Understand what needs to be analyzed (approach, tool choice, alignment, etc.)
2. Apply logical reasoning and best practices
3. Identify strengths and potential issues
4. Provide actionable insights and suggestions
5. Be constructive and helpful

Important:
- Think critically but constructively
- Focus on helping improve outcomes
- Consider both technical correctness and user intent
- Provide clear, actionable recommendations`,

      operations: [
        'analyze',        // Analyze approach/tool selection
        'verify',         // Verify alignment with intent
        'reflect',        // Reflect on reasoning
        'suggest',        // Suggest improvements
        'evaluate'        // Evaluate completeness
      ],

      services: ['openaiService'],

      auth: {
        type: 'none'
      },

      capabilities: [
        'Analyze problem-solving approaches',
        'Verify actions align with user goals',
        'Reflect on decision-making processes',
        'Suggest workflow improvements',
        'Evaluate solution completeness and efficiency'
      ],

      // Think operations are analysis-only, no risk
      draftRules: {
        operations: [],
        defaultRiskLevel: 'low'
      },

      limitations: [
        'Provides analysis and suggestions only',
        'Cannot execute actions directly',
        'Effectiveness depends on context provided'
      ]
    };
  }

  /**
   * Execute internal operations - the only agent-specific logic
   */
  protected async executeOperation(
    operation: string,
    parameters: any,
    authToken: string | null
  ): Promise<ThinkResult> {
    const openaiService = this.getService('openaiService') as OpenAIService;

    if (!openaiService) {
      throw new Error('OpenAIService not available');
    }

    const { query, analysisType, toolsToAnalyze, userIntent, executionContext } = parameters;

    switch (operation) {
      case 'analyze': {
        // Analyze approach or tool selection
        const prompt = `Analyze this approach or tool selection:

Query: ${query || 'No query provided'}
${toolsToAnalyze ? `Tools/Actions: ${JSON.stringify(toolsToAnalyze)}` : ''}
${executionContext ? `Context: ${JSON.stringify(executionContext)}` : ''}

Provide:
1. Assessment of the approach (is it appropriate?)
2. Strengths and potential issues
3. Suggestions for improvement

Be concise and actionable.`;

        const response = await openaiService.createChatCompletion([
          { role: 'system', content: 'You are a technical analyst providing constructive feedback.' },
          { role: 'user', content: prompt }
        ], 500);

        return {
          success: true,
          analysis: response.content,
          reasoning: 'Analyzed approach and tool selection',
          confidence: 0.9
        };
      }

      case 'verify': {
        // Verify alignment with user intent
        const prompt = `Verify if these actions align with the user's intent:

User Intent: ${userIntent || query || 'Not specified'}
${toolsToAnalyze ? `Proposed Actions: ${JSON.stringify(toolsToAnalyze)}` : ''}
${executionContext ? `Execution Context: ${JSON.stringify(executionContext)}` : ''}

Answer:
1. Do the actions match the user's goal? (Yes/No/Partially)
2. Why or why not?
3. Any misalignments to address?

Be clear and concise.`;

        const response = await openaiService.createChatCompletion([
          { role: 'system', content: 'You are verifying alignment between actions and user intent.' },
          { role: 'user', content: prompt }
        ], 400);

        return {
          success: true,
          analysis: response.content,
          reasoning: 'Verified alignment with user intent',
          confidence: 0.85
        };
      }

      case 'reflect': {
        // Reflect on reasoning and decisions
        const prompt = `Reflect on this reasoning or decision-making process:

${query || 'No context provided'}
${executionContext ? `\nContext: ${JSON.stringify(executionContext)}` : ''}

Provide:
1. Quality of the reasoning
2. Alternative perspectives or approaches
3. Lessons learned or insights

Be thoughtful and constructive.`;

        const response = await openaiService.createChatCompletion([
          { role: 'system', content: 'You are reflecting on reasoning and decision-making.' },
          { role: 'user', content: prompt }
        ], 500);

        return {
          success: true,
          analysis: response.content,
          reasoning: 'Reflected on reasoning process',
          confidence: 0.8
        };
      }

      case 'suggest': {
        // Suggest improvements
        const prompt = `Suggest improvements for this workflow or approach:

${query || 'No context provided'}
${toolsToAnalyze ? `Current Approach: ${JSON.stringify(toolsToAnalyze)}` : ''}
${executionContext ? `Context: ${JSON.stringify(executionContext)}` : ''}

Provide:
1. Specific, actionable suggestions
2. Rationale for each suggestion
3. Priority (high/medium/low)

Focus on practical improvements.`;

        const response = await openaiService.createChatCompletion([
          { role: 'system', content: 'You are suggesting practical improvements.' },
          { role: 'user', content: prompt }
        ], 500);

        // Try to extract suggestions as list
        const suggestions = response.content
          .split('\n')
          .filter(line => line.trim().match(/^[0-9\-•]/))
          .map(line => line.trim());

        return {
          success: true,
          analysis: response.content,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          reasoning: 'Generated improvement suggestions',
          confidence: 0.85
        };
      }

      case 'evaluate': {
        // Evaluate completeness and efficiency
        const prompt = `Evaluate the completeness and efficiency of this solution:

${query || 'No context provided'}
${executionContext ? `Execution: ${JSON.stringify(executionContext)}` : ''}

Assess:
1. Completeness: Does it fully address the problem?
2. Efficiency: Is it the most efficient approach?
3. Missing elements or improvements needed

Provide a clear evaluation.`;

        const response = await openaiService.createChatCompletion([
          { role: 'system', content: 'You are evaluating solution completeness and efficiency.' },
          { role: 'user', content: prompt }
        ], 500);

        return {
          success: true,
          analysis: response.content,
          reasoning: 'Evaluated completeness and efficiency',
          confidence: 0.8
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Get OpenAI function schema (auto-generated from config)
   */
  static getOpenAIFunctionSchema(): any {
    const instance = new ThinkAgentV2();
    const config = instance.getAgentConfig();

    return {
      name: config.name,
      description: 'Meta-reasoning agent for analyzing approaches, verifying intent alignment, reflecting on decisions, and suggesting improvements. Use this to think critically about problem-solving strategies.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language analysis request (e.g., "Analyze my approach", "Verify this aligns with user intent", "Suggest improvements")'
          }
        },
        required: ['query']
      }
    };
  }

  /**
   * Get agent capabilities (for MasterAgent discovery)
   */
  static getCapabilities(): string[] {
    const instance = new ThinkAgentV2();
    const config = instance.getAgentConfig();
    return config.capabilities || config.operations;
  }
}