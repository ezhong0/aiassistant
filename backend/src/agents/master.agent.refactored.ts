import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
import { AIServiceCircuitBreaker, AIServiceUnavailableError } from '../services/ai-circuit-breaker.service';
import { ToolCall, ToolResult, MasterAgentConfig } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { initializeAgentFactory } from '../config/agent-factory-init';
import { getService } from '../services/service-manager';
import { SlackMessageReaderService } from '../services/slack-message-reader.service';
import { SlackContext } from '../types/slack.types';
import { SlackMessage } from '../types/slack-message-reader.types';

export interface MasterAgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  needsThinking?: boolean;
  proposal?: ProposalResponse;
  contextGathered?: ContextGatheringResult;
}

export interface ProposalResponse {
  text: string;
  actionType: string;
  confidence: number;
  requiresConfirmation: boolean;
  originalToolCalls: ToolCall[];
}

export interface ContextGatheringResult {
  messages: SlackMessage[];
  relevantContext: string;
  contextType: 'recent_messages' | 'thread_history' | 'search_results' | 'none';
  confidence: number;
}

export interface ContextDetectionResult {
  needsContext: boolean;
  contextType: 'recent_messages' | 'thread_history' | 'search_results' | 'none';
  confidence: number;
  reasoning: string;
}

/**
 * AI-First MasterAgent - Requires OpenAI service for all operations
 * No string matching fallbacks - pure LLM-driven intelligence
 */
export class MasterAgent {
  private systemPrompt: string;
  private agentSchemas: Map<string, any> = new Map();
  private lastMemoryCheck: number = Date.now();
  private slackMessageReaderService: SlackMessageReaderService | null = null;
  private aiCircuitBreaker: AIServiceCircuitBreaker | null = null;

  constructor(config?: MasterAgentConfig) {
    // Initialize AgentFactory if not already done
    if (!AgentFactory.getStats().totalTools) {
      initializeAgentFactory();
    }

    // Generate dynamic system prompt from AgentFactory
    this.systemPrompt = this.generateSystemPrompt();
    
    // Initialize agent schemas for OpenAI function calling
    this.initializeAgentSchemas();
    
    // Initialize services (AI-first - these are required)
    this.initializeRequiredServices();
    
    logger.info('MasterAgent initialized with AI-first architecture (OpenAI required)');
  }

  /**
   * Initialize required services - OpenAI and supporting services
   */
  private initializeRequiredServices(): void {
    try {
      // Get AI circuit breaker (required)
      const circuitBreakerService = getService<AIServiceCircuitBreaker>('aiCircuitBreakerService');
      if (!circuitBreakerService) {
        throw new Error('AIServiceCircuitBreaker is required for AI-first operation');
      }
      this.aiCircuitBreaker = circuitBreakerService;

      // Get SlackMessageReaderService (optional for context gathering)
      this.slackMessageReaderService = getService<SlackMessageReaderService>('slackMessageReaderService') || null;
      if (this.slackMessageReaderService) {
        logger.info('SlackMessageReaderService initialized for context gathering');
      } else {
        logger.warn('SlackMessageReaderService not available - context gathering will be limited');
      }

      logger.info('Required AI services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize required services:', error);
      throw new Error(`MasterAgent initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Main entry point for processing user input with AI-first approach
   * NO string matching fallbacks - pure LLM intelligence only
   */
  async processUserInput(
    userInput: string, 
    sessionId: string, 
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    try {
      // Ensure AI circuit breaker is available
      if (!this.aiCircuitBreaker) {
        throw new AIServiceUnavailableError(
          'AI service is not properly configured. Please contact support.',
          'CIRCUIT_BREAKER_NOT_AVAILABLE'
        );
      }

      logger.info('Processing user input with AI-first approach', {
        userInput: userInput.substring(0, 100) + (userInput.length > 100 ? '...' : ''),
        sessionId,
        hasSlackContext: !!slackContext
      });

      // Step 1: Detect if context gathering is needed (using AI)
      const contextDetection = await this.detectContextNeeds(userInput, slackContext);
      
      // Step 2: Gather context if needed
      let contextGatheringResult: ContextGatheringResult | undefined;
      if (contextDetection.needsContext && this.slackMessageReaderService && slackContext) {
        contextGatheringResult = await this.gatherContext(userInput, contextDetection, slackContext);
      }

      // Step 3: Generate tool calls using AI (with context)
      const systemPromptWithContext = this.buildSystemPromptWithContext(contextGatheringResult);
      const toolCallsResponse = await this.generateToolCallsWithAI(
        userInput, 
        systemPromptWithContext, 
        sessionId
      );

      // Step 4: Enhance tool calls with agent-specific context
      const enhancedToolCalls = await this.enhanceToolCallsWithContext(
        toolCallsResponse.toolCalls, 
        userInput
      );

      // Step 5: Check if this requires a proposal (write operations)
      const needsProposal = await this.determineIfNeedsProposal(enhancedToolCalls, userInput);
      
      let proposal: ProposalResponse | undefined;
      if (needsProposal) {
        proposal = await this.generateProposal(enhancedToolCalls, userInput, contextGatheringResult);
      }

      return {
        message: toolCallsResponse.message,
        toolCalls: enhancedToolCalls,
        proposal,
        contextGathered: contextGatheringResult
      };

    } catch (error) {
      logger.error('Failed to process user input:', {
        error: error instanceof Error ? error.message : error,
        userInput: userInput.substring(0, 50),
        sessionId
      });

      // Handle AI service errors with user-friendly messages
      if (error instanceof AIServiceUnavailableError) {
        return {
          message: error.message,
          toolCalls: []
        };
      }

      // Generic error handling - never fall back to string matching
      return {
        message: 'I encountered an issue processing your request. Please try again or rephrase your message.',
        toolCalls: []
      };
    }
  }

  /**
   * Generate tool calls using AI with circuit breaker protection
   * NO string matching fallback - AI-first only
   */
  private async generateToolCallsWithAI(
    userInput: string,
    systemPrompt: string,
    sessionId: string
  ): Promise<{ toolCalls: ToolCall[]; message: string }> {
    if (!this.aiCircuitBreaker) {
      throw new AIServiceUnavailableError(
        'AI service is not available',
        'CIRCUIT_BREAKER_NOT_AVAILABLE'
      );
    }

    return await this.aiCircuitBreaker.execute(async (openaiService: OpenAIService) => {
      try {
        logger.debug('Generating tool calls with AI', {
          userInputLength: userInput.length,
          sessionId
        });

        const response = await openaiService.generateToolCalls(
          userInput,
          systemPrompt,
          sessionId
        );

        if (!response.toolCalls || response.toolCalls.length === 0) {
          // AI didn't suggest any tools - this is valid, not an error
          return {
            toolCalls: [],
            message: response.message || 'I understand your request, but I\'m not sure how to help with that right now.'
          };
        }

        logger.debug('AI generated tool calls successfully', {
          toolCallCount: response.toolCalls.length,
          tools: response.toolCalls.map(tc => tc.name),
          sessionId
        });

        return {
          toolCalls: response.toolCalls,
          message: response.message || 'I\'ll help you with that.'
        };

      } catch (error) {
        logger.error('OpenAI tool call generation failed:', error);
        throw error;
      }
    });
  }

  /**
   * Detect if context gathering is needed using AI classification
   * NO string matching - pure AI decision making
   */
  private async detectContextNeeds(
    userInput: string, 
    slackContext?: SlackContext
  ): Promise<ContextDetectionResult> {
    if (!this.aiCircuitBreaker) {
      return {
        needsContext: false,
        contextType: 'none',
        confidence: 0,
        reasoning: 'AI service not available'
      };
    }

    try {
      return await this.aiCircuitBreaker.execute(async (openaiService: OpenAIService) => {
        const contextPrompt = `Analyze this user request and determine if gathering additional context from Slack conversation history would be helpful:

User Request: "${userInput}"

Available Context Types:
- recent_messages: Get recent messages from the channel
- thread_history: Get full thread conversation history  
- search_results: Search for specific messages or topics
- none: No additional context needed

Consider:
- Does the request reference "this", "that", "it", "the email", "the meeting" without clear antecedent?
- Does it seem to be a follow-up to a previous conversation?
- Would recent message history help understand the full intent?

Respond with JSON: {
  "needsContext": boolean,
  "contextType": "recent_messages" | "thread_history" | "search_results" | "none",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

        const response = await openaiService.generateText(
          contextPrompt,
          'You are a context analysis specialist. Always respond with valid JSON only.',
          { temperature: 0.1, maxTokens: 200 }
        );

        try {
          const parsed = JSON.parse(response);
          return {
            needsContext: parsed.needsContext || false,
            contextType: parsed.contextType || 'none',
            confidence: parsed.confidence || 0,
            reasoning: parsed.reasoning || 'AI analysis completed'
          };
        } catch (parseError) {
          logger.warn('Failed to parse context detection response, defaulting to no context', {
            response,
            parseError
          });
          return {
            needsContext: false,
            contextType: 'none',
            confidence: 0,
            reasoning: 'Failed to parse AI response'
          };
        }
      });
    } catch (error) {
      logger.error('Context detection failed:', error);
      return {
        needsContext: false,
        contextType: 'none',
        confidence: 0,
        reasoning: 'Context detection error'
      };
    }
  }

  /**
   * Determine if tool calls require a proposal using AI analysis
   * NO string matching - AI determines write vs read operations
   */
  private async determineIfNeedsProposal(
    toolCalls: ToolCall[], 
    userInput: string
  ): Promise<boolean> {
    if (!this.aiCircuitBreaker || toolCalls.length === 0) {
      return false;
    }

    try {
      return await this.aiCircuitBreaker.execute(async (openaiService: OpenAIService) => {
        const proposalPrompt = `Analyze these planned actions and determine if user confirmation is needed before execution:

User Request: "${userInput}"

Planned Actions:
${toolCalls.map(tc => `- ${tc.name}: ${JSON.stringify(tc.parameters)}`).join('\n')}

Actions that typically need confirmation (write operations):
- Sending emails
- Creating/modifying calendar events
- Making external API calls that change data
- Deleting or modifying existing content

Actions that don't need confirmation (read operations):
- Searching/reading emails, contacts, calendar
- Retrieving information
- Showing current data
- Analysis or thinking operations

Respond with JSON: { "needsConfirmation": boolean, "reasoning": "brief explanation" }`;

        const response = await openaiService.generateText(
          proposalPrompt,
          'You are a safety analysis specialist. Always respond with valid JSON only.',
          { temperature: 0.1, maxTokens: 150 }
        );

        try {
          const parsed = JSON.parse(response);
          return parsed.needsConfirmation || false;
        } catch (parseError) {
          logger.warn('Failed to parse proposal determination response, defaulting to no confirmation', {
            response,
            parseError
          });
          return false;
        }
      });
    } catch (error) {
      logger.error('Proposal determination failed:', error);
      return false; // Default to no confirmation on error
    }
  }

  /**
   * Generate proposal for write operations using AI
   */
  private async generateProposal(
    toolCalls: ToolCall[],
    userInput: string,
    contextGathering?: ContextGatheringResult
  ): Promise<ProposalResponse> {
    if (!this.aiCircuitBreaker) {
      throw new AIServiceUnavailableError(
        'AI service required for proposal generation',
        'CIRCUIT_BREAKER_NOT_AVAILABLE'
      );
    }

    return await this.aiCircuitBreaker.execute(async (openaiService: OpenAIService) => {
      const proposalPrompt = `Generate a clear, conversational proposal for the user to confirm these planned actions:

User Request: "${userInput}"

Planned Actions:
${toolCalls.map(tc => `- ${tc.name}: ${JSON.stringify(tc.parameters)}`).join('\n')}

${contextGathering ? `Context: ${contextGathering.relevantContext}` : ''}

Create a natural language proposal that:
1. Summarizes what will be done
2. Highlights key details (recipients, times, subjects)
3. Asks for confirmation in a conversational way
4. Is clear and not too technical

Respond with JSON: {
  "text": "conversational proposal text",
  "actionType": "brief description of action",
  "confidence": 0.0-1.0
}`;

      const response = await openaiService.generateText(
        proposalPrompt,
        'You are a helpful assistant creating user-friendly proposals. Always respond with valid JSON only.',
        { temperature: 0.2, maxTokens: 300 }
      );

      try {
        const parsed = JSON.parse(response);
        return {
          text: parsed.text || 'I\'d like to perform some actions for you. Should I proceed?',
          actionType: parsed.actionType || 'user request',
          confidence: parsed.confidence || 0.8,
          requiresConfirmation: true,
          originalToolCalls: toolCalls
        };
      } catch (parseError) {
        logger.warn('Failed to parse proposal response, using default', {
          response,
          parseError
        });
        return {
          text: 'I\'d like to perform some actions for you. Should I proceed?',
          actionType: 'user request',
          confidence: 0.5,
          requiresConfirmation: true,
          originalToolCalls: toolCalls
        };
      }
    });
  }

  /**
   * Enhance tool calls with agent-specific context using AI analysis
   * NO string matching for contact lookup or other enhancements
   */
  private async enhanceToolCallsWithContext(
    toolCalls: ToolCall[],
    userInput: string
  ): Promise<ToolCall[]> {
    if (!this.aiCircuitBreaker) {
      return toolCalls; // Return as-is if no AI available
    }

    const enhancedToolCalls: ToolCall[] = [];

    for (const toolCall of toolCalls) {
      try {
        const enhancedCall = await this.enhanceToolCallWithAIContext(toolCall, userInput);
        enhancedToolCalls.push(enhancedCall);
      } catch (error) {
        logger.warn('Failed to enhance tool call, using original:', {
          toolCall: toolCall.name,
          error: error instanceof Error ? error.message : error
        });
        enhancedToolCalls.push(toolCall);
      }
    }

    return enhancedToolCalls;
  }

  /**
   * Enhance individual tool call with AI-based context analysis
   * Replaces string matching with AI entity extraction and context understanding
   */
  private async enhanceToolCallWithAIContext(
    toolCall: ToolCall,
    userInput: string
  ): Promise<ToolCall> {
    if (!this.aiCircuitBreaker) {
      return toolCall;
    }

    // For email and calendar operations, check if entity extraction is needed
    if (['send_email', 'manage_calendar'].includes(toolCall.name)) {
      return await this.aiCircuitBreaker.execute(async (openaiService: OpenAIService) => {
        const enhancementPrompt = `Analyze this tool call and user request to identify if contact lookup or other enhancements are needed:

User Request: "${userInput}"
Tool Call: ${toolCall.name}
Parameters: ${JSON.stringify(toolCall.parameters)}

Tasks:
1. Extract person names that need contact resolution (not email addresses)
2. Identify missing parameters that could be inferred
3. Suggest enhancements for better execution

Respond with JSON: {
  "needsContactLookup": boolean,
  "contactNames": ["name1", "name2"],
  "suggestedEnhancements": {
    "parameterName": "suggestedValue"
  },
  "reasoning": "brief explanation"
}`;

        const response = await openaiService.generateText(
          enhancementPrompt,
          'You are a tool enhancement specialist. Always respond with valid JSON only.',
          { temperature: 0.1, maxTokens: 250 }
        );

        try {
          const enhancement = JSON.parse(response);
          const enhancedParameters = { ...toolCall.parameters };

          // Add enhancement flags based on AI analysis
          if (enhancement.needsContactLookup && enhancement.contactNames?.length > 0) {
            enhancedParameters.requiresContactLookup = true;
            enhancedParameters.contactNames = enhancement.contactNames;
          }

          // Apply suggested parameter enhancements
          if (enhancement.suggestedEnhancements) {
            Object.assign(enhancedParameters, enhancement.suggestedEnhancements);
          }

          // Add specific enhancements for calendar operations
          if (toolCall.name === 'manage_calendar') {
            enhancedParameters.enableConflictDetection = true;
          }

          return {
            name: toolCall.name,
            parameters: enhancedParameters
          };
        } catch (parseError) {
          logger.warn('Failed to parse tool enhancement response, using original:', {
            response,
            parseError
          });
          return toolCall;
        }
      });
    }

    return toolCall;
  }

  /**
   * Gather context using SlackMessageReaderService
   */
  private async gatherContext(
    userInput: string,
    contextDetection: ContextDetectionResult,
    slackContext: SlackContext
  ): Promise<ContextGatheringResult> {
    if (!this.slackMessageReaderService) {
      return {
        messages: [],
        relevantContext: '',
        contextType: 'none',
        confidence: 0
      };
    }

    try {
      let messages: SlackMessage[] = [];
      
      switch (contextDetection.contextType) {
        case 'recent_messages':
          if (slackContext.channelId) {
            messages = await this.slackMessageReaderService.readRecentMessages(
              slackContext.channelId,
              10
            );
          }
          break;
          
        case 'thread_history':
          if (slackContext.threadTs && slackContext.channelId) {
            messages = await this.slackMessageReaderService.readThreadMessages(
              slackContext.channelId,
              slackContext.threadTs,
              { limit: 50 }
            );
          }
          break;
          
        default:
          break;
      }

      // Summarize context using AI if we have messages
      let relevantContext = '';
      if (messages.length > 0 && this.aiCircuitBreaker) {
        try {
          relevantContext = await this.aiCircuitBreaker.execute(async (openaiService: OpenAIService) => {
            const contextSummaryPrompt = `Summarize this conversation context in relation to the user's current request:

Current Request: "${userInput}"

Recent Messages:
${messages.map(msg => `${msg.userId}: ${msg.text}`).join('\n')}

Provide a brief summary focusing on information relevant to the current request.`;

            return await openaiService.generateText(
              contextSummaryPrompt,
              'You are a context summarization specialist.',
              { temperature: 0.1, maxTokens: 200 }
            );
          });
        } catch (error) {
          logger.warn('Failed to generate context summary:', error);
          relevantContext = `Found ${messages.length} recent messages in conversation.`;
        }
      }

      return {
        messages,
        relevantContext,
        contextType: contextDetection.contextType,
        confidence: contextDetection.confidence
      };

    } catch (error) {
      logger.error('Failed to gather context:', error);
      return {
        messages: [],
        relevantContext: '',
        contextType: 'none',
        confidence: 0
      };
    }
  }

  // Helper methods (keep existing implementations but remove string matching)

  /**
   * Initialize OpenAI function schemas for all agents
   */
  private initializeAgentSchemas(): void {
    try {
      // Import agent classes dynamically to avoid circular imports
      const { EmailAgent } = require('./email.agent');
      const { CalendarAgent } = require('./calendar.agent');
      const { ContactAgent } = require('./contact.agent');
      const { ThinkAgent } = require('./think.agent');
      const { SlackAgent } = require('./slack.agent');

      // Get schemas from agent classes
      this.agentSchemas.set('send_email', EmailAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('manage_calendar', CalendarAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('search_contacts', ContactAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('Think', ThinkAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('slack_operations', SlackAgent.getOpenAIFunctionSchema());

      logger.debug('Agent schemas initialized', {
        schemaCount: this.agentSchemas.size
      });
    } catch (error) {
      logger.error('Failed to initialize agent schemas:', error);
    }
  }

  /**
   * Generate system prompt from agent factory
   */
  private generateSystemPrompt(): string {
    const stats = AgentFactory.getStats();
    const agentNames = AgentFactory.getEnabledAgentNames();
    const toolMappings = AgentFactory.getAllToolMappings();
    
    const toolDescriptions = Object.entries(toolMappings).map(([tool, agent]) => 
      `- ${tool}: Handled by ${agent} agent`
    ).join('\n');

    return `You are an intelligent AI assistant that helps users with email, calendar, and contact management through natural conversation.

Available tools:
${toolDescriptions}

IMPORTANT GUIDELINES:
- Use tools to help users accomplish their goals
- For email operations, be helpful with drafting and sending
- For calendar operations, help with scheduling and availability
- Always consider the user's context and previous conversation
- When in doubt, ask for clarification rather than making assumptions
- Be conversational and helpful in your responses

You have access to ${stats.totalTools} specialized tools across ${stats.totalAgents} agents to help users.`;
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPromptWithContext(contextGathering?: ContextGatheringResult): string {
    let prompt = this.systemPrompt;
    
    if (contextGathering?.relevantContext) {
      prompt += `\n\nConversation Context: ${contextGathering.relevantContext}`;
    }
    
    return prompt;
  }

  /**
   * Get agent capabilities (for tool enhancement)
   */
  private getAgentCapabilities(): Record<string, any> {
    return {
      emailAgent: {
        capabilities: ['send_email', 'search_email', 'draft_email'],
        requiresAuth: true
      },
      calendarAgent: {
        capabilities: ['create_event', 'search_events', 'update_event'],
        requiresAuth: true
      },
      contactAgent: {
        capabilities: ['search_contacts', 'get_contact_info'],
        requiresAuth: true
      },
      slackAgent: {
        capabilities: ['read_messages', 'send_messages'],
        requiresAuth: true
      }
    };
  }
}