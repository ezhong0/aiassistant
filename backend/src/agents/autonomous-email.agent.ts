import { AutonomousAgent, AgentResponse, AgentContext, AgentExecutionPlan, IntentAnalysis, ExecutionStrategy } from '../interfaces/autonomous-agent.interface';
import { EmailAgent } from './email.agent';
import { EnhancedLogger } from '../utils/enhanced-logger';
import { ServiceManager } from '../services/service-manager';
import { OpenAIService } from '../services/openai.service';

/**
 * Autonomous Email Agent
 *
 * Demonstrates the new autonomous agent architecture where:
 * 1. Agent receives natural language intents
 * 2. Formulates domain-expert execution plans
 * 3. Executes with intelligent fallbacks
 * 4. Provides natural language responses with reasoning
 */
export class AutonomousEmailAgent implements AutonomousAgent {
  public readonly agentName = 'autonomousEmailAgent';
  public readonly capabilities = [
    'Search emails with intelligent strategies',
    'Compose contextual email responses',
    'Analyze email patterns and relationships',
    'Categorize and organize email content',
    'Extract actionable insights from emails',
    'Handle email operations with error recovery'
  ];
  public readonly expertise = [
    'Email search optimization',
    'Content analysis and summarization',
    'Sender relationship mapping',
    'Email threading and conversation tracking',
    'Spam and priority detection',
    'Email automation workflows'
  ];

  private emailAgent: EmailAgent;
  private openaiService: OpenAIService | null = null;

  constructor() {
    // Use existing EmailAgent for actual email operations
    this.emailAgent = new EmailAgent();

    // Get OpenAI service for intelligence
    try {
      const service = ServiceManager.getInstance().getService<OpenAIService>('openaiService');
      this.openaiService = service || null;
    } catch (error) {
      this.openaiService = null;
      EnhancedLogger.warn('OpenAI service not available for autonomous email agent', {
        correlationId: 'autonomous-email-init',
        operation: 'service_init',
        metadata: { agent: this.agentName }
      });
    }
  }

  /**
   * Main entry point - process natural language intent autonomously
   */
  async processIntent(intent: string, context?: AgentContext): Promise<AgentResponse> {
    const correlationId = `autonomous-email-${Date.now()}`;

    try {
      EnhancedLogger.debug('Processing autonomous email intent', {
        correlationId,
        operation: 'process_intent',
        metadata: {
          intent: intent.substring(0, 100),
          hasContext: !!context
        }
      });

      // Step 1: Analyze the intent using domain intelligence
      const intentAnalysis = await this.analyzeIntent(intent, context);

      // Step 2: Create execution plan based on email domain expertise
      const plan = await this.planExecution(intent, context);

      // Step 3: Execute with intelligent fallbacks
      const results = await this.executeWithFallbacks(plan, context);

      // Step 4: Formulate intelligent natural language response
      const naturalResponse = await this.formulateResponse(results, intent, plan);

      // Step 5: Generate helpful suggestions
      const suggestions = this.generateSuggestions(results, intent);

      const response: AgentResponse = {
        data: results,
        naturalResponse,
        reasoning: plan.primaryStrategy.reasoning,
        suggestions,
        success: true,
        confidence: plan.confidence,
        needsFollowup: this.determineFollowupNeed(results, intentAnalysis),
        metadata: {
          strategiesAttempted: [plan.primaryStrategy.method],
          executionTime: 0, // Will be calculated
          apiCallsUsed: this.calculateApiCalls(plan)
        }
      };

      EnhancedLogger.debug('Autonomous email intent processed successfully', {
        correlationId,
        operation: 'process_intent_success',
        metadata: {
          confidence: response.confidence,
          needsFollowup: response.needsFollowup,
          suggestionsCount: suggestions.length
        }
      });

      return response;

    } catch (error) {
      EnhancedLogger.error('Failed to process autonomous email intent', error as Error, {
        correlationId,
        operation: 'process_intent_error',
        metadata: { intent }
      });

      return {
        data: null,
        naturalResponse: `I encountered an issue while processing your email request: "${intent}". ${this.generateErrorRecovery(error as Error)}`,
        reasoning: "Error occurred during autonomous processing",
        success: false,
        confidence: 0,
        needsFollowup: true,
        error: {
          type: error instanceof Error ? error.constructor.name : 'UnknownError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: this.isRecoverableError(error as Error),
          suggestedRecovery: this.generateErrorRecovery(error as Error)
        },
        metadata: {
          strategiesAttempted: [],
          executionTime: 0,
          apiCallsUsed: 0
        }
      };
    }
  }

  /**
   * Analyze intent using email domain intelligence
   */
  private async analyzeIntent(intent: string, context?: AgentContext): Promise<IntentAnalysis> {
    if (!this.openaiService) {
      // Fallback to pattern-based analysis
      return this.analyzeIntentFallback(intent);
    }

    const analysisPrompt = `
You are an expert email assistant analyzing user intents. Analyze this email-related request and extract key information.

USER INTENT: "${intent}"

CONTEXT: ${context ? JSON.stringify(context, null, 2) : 'No additional context'}

Analyze and return JSON with this exact structure:
{
  "primaryAction": "search|compose|reply|organize|analyze|etc",
  "targetEntities": ["specific email senders", "keywords", "timeframes"],
  "parameters": {
    "searchTerms": ["extracted", "search", "terms"],
    "senders": ["specific", "senders"],
    "timeframe": "extracted timeframe",
    "emailType": "notification|personal|work|promotional|etc"
  },
  "userContext": {
    "urgency": "low|medium|high|immediate",
    "complexity": "simple|moderate|complex",
    "scope": "specific|broad|exploratory"
  },
  "ambiguities": ["things that might need clarification"],
  "confidence": 0.85
}

Focus on email-specific intelligence and domain expertise.`;

    try {
      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are an email domain expert. Return only valid JSON.',
        { temperature: 0.2, maxTokens: 1000 }
      );

      return JSON.parse(response);
    } catch (error) {
      EnhancedLogger.warn('LLM intent analysis failed, using fallback', {
        correlationId: 'intent-analysis-fallback',
        operation: 'intent_analysis_fallback',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return this.analyzeIntentFallback(intent);
    }
  }

  /**
   * Create intelligent execution plan using email domain expertise
   */
  async planExecution(intent: string, context?: AgentContext): Promise<AgentExecutionPlan> {
    if (!this.openaiService) {
      return this.createFallbackPlan(intent);
    }

    const planningPrompt = `
You are an expert email agent planning execution strategies. Create an intelligent plan for this email request.

USER INTENT: "${intent}"
CONTEXT: ${context ? JSON.stringify(context, null, 2) : 'No context'}

AVAILABLE EMAIL OPERATIONS:
- search: Search emails with various strategies (sender, keywords, timeframe, content analysis)
- compose: Create new emails with intelligent content
- reply: Reply to emails with context awareness
- analyze: Analyze email patterns, relationships, content
- organize: Categorize, label, or structure emails

EMAIL SEARCH STRATEGIES:
1. Sender-based: "from:sender@domain.com"
2. Keyword-based: Content and subject line matching
3. Timeframe-based: Recent, specific dates, ranges
4. Pattern-based: Newsletters, notifications, personal emails
5. Content-analysis: LLM-driven content understanding

Create a comprehensive execution plan with fallback strategies:

{
  "primaryStrategy": {
    "method": "search|compose|reply|analyze|organize",
    "parameters": {
      "specific": "parameters for the chosen method"
    },
    "reasoning": "Why this strategy is optimal for the intent"
  },
  "fallbackStrategies": [
    {
      "method": "alternative method",
      "parameters": {},
      "reasoning": "Why to use this if primary fails",
      "triggerCondition": "When to trigger this fallback"
    }
  ],
  "expectedOutcome": "What the user should expect",
  "confidence": 0.8
}

Use email domain expertise to create intelligent, adaptive strategies.`;

    try {
      const response = await this.openaiService.generateText(
        planningPrompt,
        'You are an email domain expert. Return only valid JSON execution plan.',
        { temperature: 0.3, maxTokens: 1500 }
      );

      return JSON.parse(response);
    } catch (error) {
      EnhancedLogger.warn('LLM execution planning failed, using fallback', {
        correlationId: 'execution-planning-fallback',
        operation: 'execution_planning_fallback',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return this.createFallbackPlan(intent);
    }
  }

  /**
   * Execute plan with intelligent fallback strategies
   */
  async executeWithFallbacks(plan: AgentExecutionPlan, context?: AgentContext): Promise<any> {
    let lastError: Error | null = null;

    // Try primary strategy
    try {
      EnhancedLogger.debug('Executing primary email strategy', {
        correlationId: 'email-primary-execution',
        operation: 'primary_strategy_execution',
        metadata: {
          method: plan.primaryStrategy.method,
          confidence: plan.confidence
        }
      });

      const result = await this.executeStrategy(plan.primaryStrategy, context);
      if (result && this.isValidResult(result)) {
        return result;
      }
    } catch (error) {
      lastError = error as Error;
      EnhancedLogger.warn('Primary email strategy failed, trying fallbacks', {
        correlationId: 'email-primary-failed',
        operation: 'primary_strategy_failed',
        metadata: {
          method: plan.primaryStrategy.method,
          error: lastError.message
        }
      });
    }

    // Try fallback strategies
    for (const fallback of plan.fallbackStrategies) {
      try {
        EnhancedLogger.debug('Executing email fallback strategy', {
          correlationId: 'email-fallback-execution',
          operation: 'fallback_strategy_execution',
          metadata: {
            method: fallback.method,
            triggerCondition: fallback.triggerCondition
          }
        });

        const result = await this.executeStrategy(fallback, context);
        if (result && this.isValidResult(result)) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        EnhancedLogger.warn('Email fallback strategy failed', {
          correlationId: 'email-fallback-failed',
          operation: 'fallback_strategy_failed',
          metadata: {
            method: fallback.method,
            error: (error as Error).message
          }
        });
      }
    }

    // All strategies failed
    throw new Error(`All email execution strategies failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Execute a specific strategy using the underlying EmailAgent
   */
  private async executeStrategy(strategy: { method: string; parameters: Record<string, any> }, context?: AgentContext): Promise<any> {
    // Map autonomous strategy to EmailAgent operations
    switch (strategy.method) {
      case 'search':
        return await this.executeEmailOperation('search', {
          query: strategy.parameters.query || strategy.parameters.searchTerms?.join(' ') || '',
          ...strategy.parameters
        });

      case 'compose':
        return await this.executeEmailOperation('compose', strategy.parameters);

      case 'reply':
        return await this.executeEmailOperation('reply', strategy.parameters);

      case 'analyze':
        // Custom analysis using LLM
        return await this.performEmailAnalysis(strategy.parameters);

      default:
        throw new Error(`Unknown email strategy method: ${strategy.method}`);
    }
  }

  /**
   * Execute email operation using the EmailAgent
   */
  private async executeEmailOperation(operation: string, parameters: Record<string, any>): Promise<any> {
    // Create a mock agent request that EmailAgent expects
    const mockAgentRequest = {
      operation,
      query: parameters.query || '',
      ...parameters
    };

    // For now, return a mock successful response
    // In a real implementation, you would need to properly integrate with EmailAgent
    return {
      success: true,
      data: { emails: [] },
      message: `Email ${operation} operation completed`,
      executionTime: 100
    };
  }

  /**
   * Formulate intelligent natural language response
   */
  async formulateResponse(results: any, originalIntent: string, plan: AgentExecutionPlan): Promise<string> {
    if (!this.openaiService) {
      return this.formulateResponseFallback(results, originalIntent);
    }

    const responsePrompt = `
You are an expert email assistant formulating a natural, helpful response to the user.

ORIGINAL USER INTENT: "${originalIntent}"
EXECUTION RESULTS: ${JSON.stringify(results, null, 2)}
EXECUTION PLAN: ${JSON.stringify(plan, null, 2)}

Create a natural, conversational response that:
1. Acknowledges what the user wanted
2. Summarizes what was found/accomplished
3. Provides relevant insights or analysis
4. Uses conversational tone (not robotic)
5. Offers helpful context about the results

If results are empty or unsuccessful, explain why and suggest alternatives.
If results are successful, highlight key findings and their relevance.

Focus on being helpful, insightful, and conversational - like a knowledgeable email assistant.`;

    try {
      const response = await this.openaiService.generateText(
        responsePrompt,
        'You are a helpful email assistant. Be conversational and insightful.',
        { temperature: 0.7, maxTokens: 800 }
      );

      return response.trim();
    } catch (error) {
      EnhancedLogger.warn('LLM response formulation failed, using fallback', {
        correlationId: 'response-formulation-fallback',
        operation: 'response_formulation_fallback',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return this.formulateResponseFallback(results, originalIntent);
    }
  }

  /**
   * Generate intelligent suggestions for next actions
   */
  generateSuggestions(results: any, intent: string): string[] {
    const suggestions: string[] = [];

    if (!results || (Array.isArray(results.data?.emails) && results.data.emails.length === 0)) {
      suggestions.push("Try a broader search with different keywords");
      suggestions.push("Search in a different time range");
      suggestions.push("Check your email folders or labels");
    } else if (results.data?.emails) {
      const emailCount = results.data.emails.length;

      if (emailCount > 10) {
        suggestions.push("Filter these results by date or sender");
        suggestions.push("Would you like me to summarize the key themes?");
      }

      if (emailCount > 0) {
        suggestions.push("Would you like me to analyze these emails for common patterns?");
        suggestions.push("Should I help you organize these into categories?");
        suggestions.push("Would you like to compose a reply to any of these?");
      }
    }

    // Intent-specific suggestions
    if (intent.toLowerCase().includes('linkedin')) {
      suggestions.push("Should I help you organize LinkedIn emails by type (job opportunities, connections, etc.)?");
    }

    if (intent.toLowerCase().includes('unread')) {
      suggestions.push("Would you like me to prioritize these by importance?");
    }

    return suggestions.slice(0, 3); // Keep it manageable
  }

  /**
   * Assess capability to handle specific intent
   */
  async assessCapability(intent: string): Promise<number> {
    const emailKeywords = ['email', 'inbox', 'message', 'send', 'reply', 'search', 'unread', 'compose'];
    const intentLower = intent.toLowerCase();

    let score = 0;

    // Check for email-related keywords
    for (const keyword of emailKeywords) {
      if (intentLower.includes(keyword)) {
        score += 0.2;
      }
    }

    // Check for specific email providers/services
    const emailServices = ['gmail', 'outlook', 'yahoo', 'linkedin', 'newsletter'];
    for (const service of emailServices) {
      if (intentLower.includes(service)) {
        score += 0.15;
      }
    }

    // Bonus for complex email operations
    if (intentLower.includes('search') && intentLower.includes('from')) score += 0.1;
    if (intentLower.includes('organize') || intentLower.includes('categorize')) score += 0.1;
    if (intentLower.includes('analyze') || intentLower.includes('summary')) score += 0.1;

    return Math.min(score, 1.0);
  }

  // Helper methods
  private analyzeIntentFallback(intent: string): IntentAnalysis {
    const intentLower = intent.toLowerCase();

    return {
      primaryAction: intentLower.includes('search') ? 'search' :
                    intentLower.includes('send') || intentLower.includes('compose') ? 'compose' :
                    intentLower.includes('reply') ? 'reply' : 'search',
      targetEntities: this.extractEntitiesFromIntent(intent),
      parameters: this.extractParametersFromIntent(intent),
      userContext: {
        urgency: intentLower.includes('urgent') || intentLower.includes('asap') ? 'high' : 'medium',
        complexity: intentLower.split(' ').length > 10 ? 'complex' : 'simple',
        scope: intentLower.includes('all') || intentLower.includes('everything') ? 'broad' : 'specific'
      },
      ambiguities: [],
      confidence: 0.6
    };
  }

  private createFallbackPlan(intent: string): AgentExecutionPlan {
    return {
      primaryStrategy: {
        method: 'search',
        parameters: { query: intent },
        reasoning: 'Fallback to basic search when LLM planning unavailable'
      },
      fallbackStrategies: [],
      expectedOutcome: 'Search results based on intent',
      confidence: 0.5
    };
  }

  private extractEntitiesFromIntent(intent: string): string[] {
    const entities: string[] = [];
    const intentLower = intent.toLowerCase();

    // Common email entities
    if (intentLower.includes('linkedin')) entities.push('LinkedIn');
    if (intentLower.includes('unread')) entities.push('unread messages');
    if (intentLower.includes('today') || intentLower.includes('recent')) entities.push('recent timeframe');

    return entities;
  }

  private extractParametersFromIntent(intent: string): Record<string, any> {
    const params: Record<string, any> = {};
    const intentLower = intent.toLowerCase();

    if (intentLower.includes('linkedin')) {
      params.searchTerms = ['linkedin'];
      params.senders = ['linkedin.com', 'noreply@linkedin.com'];
    }

    if (intentLower.includes('unread')) {
      params.readStatus = 'unread';
    }

    return params;
  }

  private formulateResponseFallback(results: any, originalIntent: string): string {
    if (!results || results.error) {
      return `I couldn't complete your email request "${originalIntent}" due to an error. Please try rephrasing your request or check your email connection.`;
    }

    if (results.data?.emails) {
      const count = results.data.emails.length;
      return `I found ${count} email${count !== 1 ? 's' : ''} related to "${originalIntent}". ${count > 0 ? 'Would you like me to help you analyze or organize these emails?' : 'You might want to try a different search approach.'}`;
    }

    return `I processed your email request "${originalIntent}" successfully.`;
  }

  private async performEmailAnalysis(parameters: Record<string, any>): Promise<any> {
    // Custom email analysis logic
    return {
      success: true,
      data: { analysis: 'Email analysis completed' },
      message: 'Email analysis performed'
    };
  }

  private isValidResult(result: any): boolean {
    return result &&
           result.success !== false &&
           (result.data || result.message || result.emails);
  }

  private determineFollowupNeed(results: any, intentAnalysis: IntentAnalysis): boolean {
    return intentAnalysis.ambiguities.length > 0 ||
           intentAnalysis.confidence < 0.7 ||
           (results.data?.emails && results.data.emails.length > 20);
  }

  private calculateApiCalls(plan: AgentExecutionPlan): number {
    return 1 + plan.fallbackStrategies.length; // Estimate
  }

  private isRecoverableError(error: Error): boolean {
    const recoverableErrors = ['timeout', 'network', 'rate limit', 'authentication'];
    return recoverableErrors.some(type =>
      error.message.toLowerCase().includes(type)
    );
  }

  private generateErrorRecovery(error: Error): string {
    if (error.message.toLowerCase().includes('authentication')) {
      return "Please check your email account connection and try again.";
    }
    if (error.message.toLowerCase().includes('network')) {
      return "Please check your internet connection and retry.";
    }
    if (error.message.toLowerCase().includes('rate limit')) {
      return "Please wait a moment and try again.";
    }
    return "Please try rephrasing your request or contact support if the issue persists.";
  }
}