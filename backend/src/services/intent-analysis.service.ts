import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

/**
 * Intent analysis result interface
 */
export interface IntentAnalysis {
  intent: string;
  entities: string[];
  confidence: number;
  plan: WorkflowStep[];
  naturalLanguageDescription: string;
}

/**
 * Workflow step interface for plan creation
 */
export interface WorkflowStep {
  stepId: string;
  stepNumber: number;
  description: string;
  toolCall: {
    name: string;
    parameters: Record<string, any>;
  };
  status: 'pending' | 'awaiting_confirmation' | 'confirmed' | 'executed' | 'failed' | 'skipped';
  retryCount: number;
  maxRetries: number;
}

/**
 * IntentAnalysisService - Dynamic intent understanding and flexible plan creation
 *
 * Uses advanced LLM reasoning to analyze user intent and dynamically create
 * context-aware sequential execution plans without rigid templates.
 */
export class IntentAnalysisService extends BaseService {
  private openaiService: OpenAIService | null = null;

  // Available agents and their capabilities for dynamic plan generation
  private readonly AVAILABLE_AGENTS = {
    emailAgent: {
      capabilities: ['search', 'send', 'read', 'compose', 'reply', 'forward', 'delete'],
      description: 'Gmail operations including search, composition, and management',
      parameters: ['query', 'recipient', 'subject', 'body', 'timeRange', 'maxResults', 'operation']
    },
    calendarAgent: {
      capabilities: ['search', 'create', 'update', 'delete', 'check_availability', 'suggest_times'],
      description: 'Google Calendar operations for event management and scheduling',
      parameters: ['title', 'startTime', 'endTime', 'attendees', 'duration', 'query', 'operation']
    },
    contactAgent: {
      capabilities: ['search', 'create', 'update', 'delete', 'resolve'],
      description: 'Contact management and resolution operations',
      parameters: ['name', 'email', 'phone', 'query', 'operation']
    },
    slackAgent: {
      capabilities: ['send_message', 'gather_context', 'search', 'analyze'],
      description: 'Slack operations for messaging and context gathering',
      parameters: ['channel', 'message', 'user', 'query', 'operation']
    },
    thinkAgent: {
      capabilities: ['analyze', 'reason', 'summarize', 'compare', 'recommend'],
      description: 'AI reasoning and analysis for complex decision making',
      parameters: ['query', 'context', 'data', 'operation']
    }
  };

  constructor() {
    super('intentAnalysisService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      this.openaiService = getService<OpenAIService>('openaiService') || null;
      
      if (!this.openaiService) {
        throw new Error('OpenAIService is required but not available');
      }

      EnhancedLogger.debug('IntentAnalysisService initialized', {
        correlationId: `intent-analysis-init-${Date.now()}`,
        operation: 'intent_analysis_init',
        metadata: {
          service: 'intentAnalysisService',
          hasOpenAIService: !!this.openaiService,
          availableAgents: Object.keys(this.AVAILABLE_AGENTS),
          dynamicPlanGeneration: true
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to initialize IntentAnalysisService', error as Error, {
        correlationId: `intent-analysis-init-error-${Date.now()}`,
        operation: 'intent_analysis_init_error',
        metadata: { service: 'intentAnalysisService' }
      });
      throw error;
    }
  }

  /**
   * Analyze user intent and dynamically create execution plan
   */
  async analyzeIntent(userInput: string, context?: any): Promise<IntentAnalysis> {
    console.log('🎯 INTENT ANALYSIS: Starting intent analysis...');
    console.log('📊 User Input:', userInput);
    console.log('📊 Context:', context ? JSON.stringify(context, null, 2) : 'No context provided');
    
    if (!this.openaiService) {
      throw new Error('OpenAIService not available');
    }

    try {
      console.log('🔍 INTENT ANALYSIS: Creating dynamic analysis prompt...');
      const analysisPrompt = this.createDynamicAnalysisPrompt(userInput, context);

      console.log('🤖 INTENT ANALYSIS: Calling OpenAI for intent analysis...');
      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are an advanced AI planner. Create intelligent, context-aware execution plans. Return only valid JSON.',
        { temperature: 0.2, maxTokens: 3000 }
      );

      console.log('📋 INTENT ANALYSIS: Raw OpenAI response:', response);
      const analysis = JSON.parse(response);
      console.log('✅ INTENT ANALYSIS: Parsed analysis:', JSON.stringify(analysis, null, 2));

      // Validate and enhance the analysis
      console.log('🔧 INTENT ANALYSIS: Enhancing analysis...');
      const enhancedAnalysis = await this.enhanceAnalysis(analysis, userInput, context);
      console.log('🎉 INTENT ANALYSIS: Final enhanced analysis:', JSON.stringify(enhancedAnalysis, null, 2));

      EnhancedLogger.debug('Dynamic intent analysis completed', {
        correlationId: `intent-analysis-${Date.now()}`,
        operation: 'dynamic_intent_analysis',
        metadata: {
          userInput: userInput.substring(0, 100),
          intent: enhancedAnalysis.intent,
          entities: enhancedAnalysis.entities,
          confidence: enhancedAnalysis.confidence,
          planSteps: enhancedAnalysis.plan.length,
          hasContext: !!context
        }
      });

      return enhancedAnalysis;
    } catch (error) {
      EnhancedLogger.error('Failed to analyze intent dynamically', error as Error, {
        correlationId: `intent-analysis-error-${Date.now()}`,
        operation: 'dynamic_intent_analysis_error',
        metadata: { userInput: userInput.substring(0, 100) }
      });
      throw error;
    }
  }

  /**
   * Create execution plan from intent analysis (now fully dynamic)
   */
  async createExecutionPlan(intent: IntentAnalysis): Promise<WorkflowStep[]> {
    try {
      // Return the dynamically generated plan from analysis
      // No more template dependencies - fully flexible
      const plan = intent.plan;

      // Validate the plan structure
      const validatedPlan = this.validatePlanStructure(plan);

      EnhancedLogger.debug('Dynamic execution plan created', {
        correlationId: `plan-creation-${Date.now()}`,
        operation: 'dynamic_plan_creation',
        metadata: {
          intent: intent.intent,
          planSteps: validatedPlan.length,
          confidence: intent.confidence,
          entities: intent.entities.length
        }
      });

      return validatedPlan;
    } catch (error) {
      EnhancedLogger.error('Failed to create dynamic execution plan', error as Error, {
        correlationId: `plan-creation-error-${Date.now()}`,
        operation: 'dynamic_plan_creation_error',
        metadata: { intent: intent.intent }
      });
      throw error;
    }
  }

  /**
   * Generate natural language description of plan
   */
  async generateNaturalLanguageDescription(plan: WorkflowStep[]): Promise<string> {
    try {
      const descriptions = plan.map(step => `${step.stepNumber}. ${step.description}`);
      return descriptions.join(' ');
    } catch (error) {
      EnhancedLogger.error('Failed to generate natural language description', error as Error, {
        correlationId: `description-generation-error-${Date.now()}`,
        operation: 'description_generation_error'
      });
      return 'Execute the planned steps';
    }
  }

  /**
   * Create dynamic analysis prompt based on user input and context
   */
  private createDynamicAnalysisPrompt(userInput: string, context?: any): string {
    const agentCapabilities = Object.entries(this.AVAILABLE_AGENTS)
      .map(([name, agent]) => `${name}: ${agent.description} (${agent.capabilities.join(', ')})`)
      .join('\n');

    const contextInfo = context ? `\nCONTEXT: ${JSON.stringify(context, null, 2)}` : '';

    return `
You are an advanced AI workflow planner with deep understanding of user intent and system capabilities.

USER REQUEST: "${userInput}"${contextInfo}

AVAILABLE AGENTS AND CAPABILITIES:
${agentCapabilities}

TASK: Analyze the user's request and create an intelligent, sequential execution plan.

ANALYSIS REQUIREMENTS:
1. Understand the user's TRUE intent (not just keywords)
2. Consider all necessary steps for successful completion
3. Plan for edge cases and potential failures
4. Include analysis/verification steps where needed
5. Extract all relevant entities and parameters
6. Be flexible - don't force rigid patterns

RESPONSE FORMAT (JSON only):
{
  "intent": "descriptive_intent_category",
  "entities": ["extracted_entity1", "extracted_entity2"],
  "confidence": 0.95,
  "plan": [
    {
      "stepId": "step_1",
      "stepNumber": 1,
      "description": "Clear description of what this step accomplishes",
      "toolCall": {
        "name": "agentName",
        "parameters": {
          "operation": "specific_operation",
          "param1": "extracted_value1",
          "param2": "extracted_value2"
        }
      },
      "status": "pending",
      "retryCount": 0,
      "maxRetries": 3
    }
  ],
  "naturalLanguageDescription": "Natural language summary of the complete plan"
}

DYNAMIC PLANNING GUIDELINES:
- Communication operations: Include search strategies, composition details, recipient resolution
- Scheduling operations: Handle time parsing, conflict checking, attendee management
- Contact operations: Include search strategies, disambiguation, data validation
- Complex requests: Break into logical steps with verification points
- Always consider what could go wrong and plan accordingly
- Include thinkAgent steps for complex analysis or decision points
- Adapt step complexity to request complexity
- Extract specific parameters from user input (times, names, keywords, etc.)

Be creative and intelligent - don't follow rigid templates!
`;
  }

  /**
   * Enhance analysis with additional context and validation
   */
  private async enhanceAnalysis(analysis: any, userInput: string, context?: any): Promise<IntentAnalysis> {
    // Validate required fields - throw errors instead of fallbacks
    if (!analysis.intent) {
      throw new Error(`LLM failed to provide intent for request: ${userInput.substring(0, 100)}`);
    }

    if (!Array.isArray(analysis.entities)) {
      throw new Error(`LLM failed to provide entities array for request: ${userInput.substring(0, 100)}`);
    }

    if (typeof analysis.confidence !== 'number' || analysis.confidence < 0 || analysis.confidence > 1) {
      throw new Error(`LLM provided invalid confidence score: ${analysis.confidence}`);
    }

    if (!Array.isArray(analysis.plan) || analysis.plan.length === 0) {
      throw new Error(`LLM failed to provide execution plan for request: ${userInput.substring(0, 100)}`);
    }

    if (!analysis.naturalLanguageDescription) {
      throw new Error(`LLM failed to provide natural language description for request: ${userInput.substring(0, 100)}`);
    }

    // Validate and enhance plan steps - throw on invalid structure
    const validatedPlan = analysis.plan.map((step: any, index: number) => {
      if (!step.stepId) {
        throw new Error(`Step ${index + 1} missing stepId`);
      }
      if (!step.description) {
        throw new Error(`Step ${index + 1} missing description`);
      }
      if (!step.toolCall || typeof step.toolCall !== 'object') {
        throw new Error(`Step ${index + 1} missing or invalid toolCall`);
      }

      if (!step.toolCall.name || !step.toolCall.parameters) {
        throw new Error(`Step ${index + 1} toolCall missing name or parameters`);
      }

      return {
        stepId: step.stepId,
        stepNumber: step.stepNumber || index + 1,
        description: step.description,
        toolCall: {
          name: step.toolCall.name,
          parameters: step.toolCall.parameters
        },
        status: 'pending' as const,
        retryCount: 0,
        maxRetries: 3
      };
    });

    return {
      intent: analysis.intent,
      entities: analysis.entities,
      confidence: analysis.confidence,
      plan: validatedPlan,
      naturalLanguageDescription: analysis.naturalLanguageDescription
    };
  }

  /**
   * Validate plan structure for consistency
   */
  private validatePlanStructure(plan: any[]): WorkflowStep[] {
    return plan.map((step: any, index: number) => {
      if (!step.stepId) {
        throw new Error(`Step ${index + 1} missing stepId`);
      }
      if (!step.description) {
        throw new Error(`Step ${index + 1} missing description`);
      }
      if (!step.toolCall || typeof step.toolCall !== 'object') {
        throw new Error(`Step ${index + 1} missing or invalid toolCall`);
      }
      if (!step.toolCall.name || !step.toolCall.parameters) {
        throw new Error(`Step ${index + 1} toolCall missing name or parameters`);
      }

      return {
        stepId: step.stepId,
        stepNumber: step.stepNumber || index + 1,
        description: step.description,
        toolCall: {
          name: step.toolCall.name,
          parameters: step.toolCall.parameters
        },
        status: 'pending' as const,
        retryCount: 0,
        maxRetries: 3
      };
    });
  }

  /**
   * Validate tool call structure
   */
  private validateToolCall(toolCall: any): boolean {
    if (!toolCall || typeof toolCall !== 'object') {
      return false;
    }

    const { name, parameters } = toolCall;

    // Check if agent exists in our available agents
    if (!name || !this.AVAILABLE_AGENTS[name as keyof typeof this.AVAILABLE_AGENTS]) {
      return false;
    }

    // Ensure parameters is an object
    if (!parameters || typeof parameters !== 'object') {
      return false;
    }

    return true;
  }




  /**
   * Get available agents and capabilities (replaces template system)
   */
  getAvailableAgents(): Record<string, any> {
    return this.AVAILABLE_AGENTS;
  }

  /**
   * Cleanup resources
   */
  protected async onDestroy(): Promise<void> {
    // Cleanup any resources if needed
    EnhancedLogger.debug('IntentAnalysisService destroyed', {
      correlationId: `intent-analysis-destroy-${Date.now()}`,
      operation: 'intent_analysis_destroy',
      metadata: { service: 'intentAnalysisService' }
    });
  }
  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.openaiService,
      details: {
        service: 'intentAnalysisService',
        hasOpenAIService: !!this.openaiService,
        availableAgents: Object.keys(this.AVAILABLE_AGENTS),
        dynamicPlanGeneration: true,
        templateSystem: false
      }
    };
  }
}
