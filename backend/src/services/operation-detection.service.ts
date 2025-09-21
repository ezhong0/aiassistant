import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';

/**
 * Operation detection result
 */
export interface OperationDetection {
  operation: string;
  confidence: number;
  reasoning: string;
  extractedParameters: Record<string, any>;
}

/**
 * Agent capabilities for operation detection
 */
export interface AgentCapabilities {
  name: string;
  operations: string[];
  description: string;
  operationDescriptions: Record<string, string>;
}

/**
 * OperationDetectionService - LLM-driven operation detection
 *
 * Replaces all hard string matching with intelligent LLM-based operation detection.
 * Analyzes user intent and parameters to determine the correct operation for any agent.
 */
export class OperationDetectionService extends BaseService {
  private openaiService: OpenAIService | null = null;

  // Agent capabilities for operation detection
  private readonly AGENT_CAPABILITIES: Record<string, AgentCapabilities> = {
    emailAgent: {
      name: 'emailAgent',
      operations: ['search', 'send', 'read', 'compose', 'reply', 'forward', 'delete'],
      description: 'Gmail operations including search, composition, and management',
      operationDescriptions: {
        search: 'Search for emails based on criteria like sender, subject, content, date range',
        send: 'Send new emails to recipients with subject and body content',
        read: 'Read and retrieve specific emails or email threads',
        compose: 'Compose new email content with formatting and attachments',
        reply: 'Reply to existing emails with quoted content',
        forward: 'Forward emails to other recipients',
        delete: 'Delete emails or move them to trash'
      }
    },
    calendarAgent: {
      name: 'calendarAgent',
      operations: ['search', 'create', 'update', 'delete', 'check_availability', 'suggest_times'],
      description: 'Google Calendar operations for event management and scheduling',
      operationDescriptions: {
        search: 'Search for calendar events based on title, date, attendees, or content',
        create: 'Create new calendar events with time, attendees, and details',
        update: 'Modify existing calendar events including time, attendees, or content',
        delete: 'Delete calendar events or cancel meetings',
        check_availability: 'Check availability of people or resources for scheduling',
        suggest_times: 'Suggest available meeting times based on constraints'
      }
    },
    contactAgent: {
      name: 'contactAgent',
      operations: ['search', 'create', 'update', 'delete', 'resolve'],
      description: 'Contact management and resolution operations',
      operationDescriptions: {
        search: 'Search for contacts by name, email, phone, or other criteria',
        create: 'Create new contact entries with personal and professional information',
        update: 'Update existing contact information',
        delete: 'Remove contacts from the system',
        resolve: 'Resolve contact information from partial data or names'
      }
    },
    slackAgent: {
      name: 'slackAgent',
      operations: ['send_message', 'gather_context', 'search', 'analyze'],
      description: 'Slack operations for messaging and context gathering',
      operationDescriptions: {
        send_message: 'Send messages to Slack channels or direct messages',
        gather_context: 'Gather context and information from Slack conversations',
        search: 'Search Slack messages, channels, or user information',
        analyze: 'Analyze Slack conversations for insights or summaries'
      }
    },
    thinkAgent: {
      name: 'thinkAgent',
      operations: ['analyze', 'reason', 'summarize', 'compare', 'recommend'],
      description: 'AI reasoning and analysis for complex decision making',
      operationDescriptions: {
        analyze: 'Analyze complex data, situations, or problems',
        reason: 'Apply logical reasoning to solve problems or make decisions',
        summarize: 'Create concise summaries of information or conversations',
        compare: 'Compare options, data, or alternatives',
        recommend: 'Provide recommendations based on analysis and reasoning'
      }
    }
  };

  constructor() {
    super('operationDetectionService');
  }

  protected async onInitialize(): Promise<void> {
    this.openaiService = getService<OpenAIService>('openaiService') || null;

    if (!this.openaiService) {
      throw new Error('OpenAIService is required for OperationDetectionService');
    }

    logger.debug('OperationDetectionService initialized', {
      correlationId: `operation-detection-init-${Date.now()}`,
      operation: 'operation_detection_init',
      metadata: {
        service: 'operationDetectionService',
        hasOpenAIService: !!this.openaiService,
        supportedAgents: Object.keys(this.AGENT_CAPABILITIES)
      }
    });
  }

  /**
   * Detect the intended operation for an agent based on user input and parameters
   */
  async detectOperation(
    agentName: string,
    userQuery: string,
    parameters: Record<string, any>,
    context?: any
  ): Promise<OperationDetection> {
    if (!this.openaiService) {
      throw new Error('OpenAIService not available');
    }

    const agentCapabilities = this.AGENT_CAPABILITIES[agentName];
    if (!agentCapabilities) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    try {
      const detectionPrompt = this.createOperationDetectionPrompt(
        agentCapabilities,
        userQuery,
        parameters,
        context
      );

      const response = await this.openaiService.generateText(
        detectionPrompt,
        'You are an intelligent operation detector. Analyze the request and determine the intended operation. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1000 }
      );

      let detection;
      try {
        detection = JSON.parse(response);
      } catch (parseError) {
        throw new Error(`LLM returned invalid JSON for operation detection: ${response.substring(0, 200)}... Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Validate the detected operation
      if (!agentCapabilities.operations.includes(detection.operation)) {
        throw new Error(`Invalid operation '${detection.operation}' for agent '${agentName}'`);
      }

      // Validate confidence score
      if (typeof detection.confidence !== 'number' || detection.confidence < 0 || detection.confidence > 1) {
        throw new Error(`Invalid confidence score: ${detection.confidence}`);
      }

      logger.debug('Operation detected', {
        correlationId: `operation-detection-${Date.now()}`,
        operation: 'operation_detection',
        metadata: {
          agentName,
          detectedOperation: detection.operation,
          confidence: detection.confidence,
          userQuery: userQuery.substring(0, 100)
        }
      });

      return detection;
    } catch (error) {
      logger.error('Failed to detect operation', error as Error, {
        correlationId: `operation-detection-error-${Date.now()}`,
        operation: 'operation_detection_error',
        metadata: {
          agentName,
          userQuery: userQuery.substring(0, 100)
        }
      });
      throw error;
    }
  }

  /**
   * Analyze and classify errors with LLM intelligence
   */
  async analyzeError(
    error: Error,
    context: {
      agent: string;
      operation: string;
      parameters: Record<string, any>;
      userRequest: string;
    }
  ): Promise<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    userFriendlyMessage: string;
    suggestedAction: string;
    recoverable: boolean;
  }> {
    if (!this.openaiService) {
      throw new Error('OpenAIService not available');
    }

    try {
      const analysisPrompt = this.createErrorAnalysisPrompt(error, context);

      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are an intelligent error analyzer. Analyze the error and provide user-friendly insights. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1500 }
      );

      const analysis = JSON.parse(response);

      logger.debug('Error analyzed', {
        correlationId: `error-analysis-${Date.now()}`,
        operation: 'error_analysis',
        metadata: {
          category: analysis.category,
          severity: analysis.severity,
          recoverable: analysis.recoverable,
          agent: context.agent,
          operation: context.operation
        }
      });

      return analysis;
    } catch (analysisError) {
      logger.error('Failed to analyze error', analysisError as Error, {
        correlationId: `error-analysis-error-${Date.now()}`,
        operation: 'error_analysis_error',
        metadata: {
          originalError: error.message,
          agent: context.agent,
          operation: context.operation
        }
      });
      throw analysisError;
    }
  }

  /**
   * Create operation detection prompt
   */
  private createOperationDetectionPrompt(
    agentCapabilities: AgentCapabilities,
    userQuery: string,
    parameters: Record<string, any>,
    context?: any
  ): string {
    const operationsList = agentCapabilities.operations
      .map(op => `${op}: ${agentCapabilities.operationDescriptions[op]}`)
      .join('\n');

    const contextInfo = context ? `\nCONTEXT: ${JSON.stringify(context, null, 2)}` : '';

    return `
You are an intelligent operation detector for the ${agentCapabilities.name}.

USER QUERY: "${userQuery}"
PARAMETERS: ${JSON.stringify(parameters, null, 2)}${contextInfo}

AGENT: ${agentCapabilities.name}
DESCRIPTION: ${agentCapabilities.description}

AVAILABLE OPERATIONS:
${operationsList}

TASK: Analyze the user query and parameters to determine the intended operation.

ANALYSIS REQUIREMENTS:
1. Consider the user's actual intent, not just keywords
2. Analyze the provided parameters for clues
3. Factor in the context if available
4. Choose the most appropriate operation from the available list
5. Provide high confidence score only when certain
6. Extract any relevant parameters that can be inferred

RESPONSE FORMAT (JSON only):
{
  "operation": "detected_operation_name",
  "confidence": 0.95,
  "reasoning": "Detailed explanation of why this operation was chosen",
  "extractedParameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

Analyze intelligently and choose the most appropriate operation!
`;
  }

  /**
   * Create error analysis prompt
   */
  private createErrorAnalysisPrompt(
    error: Error,
    context: {
      agent: string;
      operation: string;
      parameters: Record<string, any>;
      userRequest: string;
    }
  ): string {
    return `
You are an intelligent error analyzer. Analyze the error and provide user-friendly insights.

ERROR DETAILS:
Message: ${error.message}
Name: ${error.name}
Stack: ${error.stack?.substring(0, 500) || 'Not available'}

EXECUTION CONTEXT:
Agent: ${context.agent}
Operation: ${context.operation}
Parameters: ${JSON.stringify(context.parameters, null, 2)}
User Request: "${context.userRequest}"

TASK: Analyze this error and provide actionable insights.

ANALYSIS REQUIREMENTS:
1. Categorize the error type (authentication, network, validation, etc.)
2. Assess severity (low, medium, high, critical)
3. Create a user-friendly error message
4. Suggest actionable next steps
5. Determine if the error is recoverable

RESPONSE FORMAT (JSON only):
{
  "category": "error_category",
  "severity": "medium",
  "userFriendlyMessage": "Clear, non-technical explanation of what went wrong",
  "suggestedAction": "Specific action the user can take to resolve or proceed",
  "recoverable": true
}

Provide helpful, actionable analysis!
`;
  }

  /**
   * Get supported agents and their capabilities
   */
  getSupportedAgents(): Record<string, AgentCapabilities> {
    return this.AGENT_CAPABILITIES;
  }

  protected async onDestroy(): Promise<void> {
    logger.debug('OperationDetectionService destroyed', {
      correlationId: `operation-detection-destroy-${Date.now()}`,
      operation: 'operation_detection_destroy',
      metadata: { service: 'operationDetectionService' }
    });
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.openaiService,
      details: {
        service: 'operationDetectionService',
        hasOpenAIService: !!this.openaiService,
        supportedAgents: Object.keys(this.AGENT_CAPABILITIES),
        llmDrivenDetection: true
      }
    };
  }
}