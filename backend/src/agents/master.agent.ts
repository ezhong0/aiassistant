import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
// Agents are now stateless
import { ToolCall, ToolResult, MasterAgentConfig } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { getService } from '../services/service-manager';
import { SlackMessageReaderService } from '../services/slack-message-reader.service';
import { SlackContext } from '../types/slack.types';
import { SlackMessage } from '../types/slack-message-reader.types';
import { APP_CONSTANTS } from '../config/constants';
import { OpenAIFunctionSchema } from '../framework/agent-factory';

// Agent capabilities interface
interface AgentCapability {
  capabilities: string[];
  limitations: string[];
  schema: OpenAIFunctionSchema;
}

export interface MasterAgentResponse {
  message: string;
  toolCalls?: ToolCall[] | undefined;
  toolResults?: ToolResult[] | undefined;
  needsThinking?: boolean | undefined;
  proposal?: ProposalResponse | undefined;
  contextGathered?: ContextGatheringResult | undefined;
  executionMetadata?: {
    processingTime?: number | undefined;
    totalExecutionTime?: number | undefined;
    toolsExecuted?: number | undefined;
    successfulTools?: number | undefined;
    slackContext?: any | undefined;
    toolResults?: Array<{
      toolName: string;
      success: boolean;
      executionTime: number;
      error?: string | undefined;
      result?: any | undefined;
    }> | undefined;
    confirmationFlows?: Array<any> | undefined;
    masterAgentResponse?: string | undefined;
    error?: string | undefined;
    errorType?: string | undefined;
    errorContext?: any | undefined;
  } | undefined;
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

export class MasterAgent {
  private useOpenAI: boolean = false;
  private systemPrompt: string;
  private agentSchemas: Map<string, OpenAIFunctionSchema> = new Map();
  private lastMemoryCheck: number = Date.now();
  private slackMessageReaderService: SlackMessageReaderService | null = null;

  constructor(config?: MasterAgentConfig) {
    // Agents are now stateless - no session management needed
    
    // AgentFactory should already be initialized by the main application
    // No need to initialize it again here

    // Generate dynamic system prompt from AgentFactory
    this.systemPrompt = this.generateSystemPrompt();
    
    // Initialize agent schemas for OpenAI function calling
    this.initializeAgentSchemas().catch(error => {
      logger.error('Failed to initialize agent schemas:', error);
    });
    
    // Initialize SlackMessageReaderService for context gathering
    this.initializeSlackMessageReader();
    
    if (config?.openaiApiKey) {
      // Use shared OpenAI service from service registry instead of creating a new instance
      this.useOpenAI = true;
      logger.info('MasterAgent initialized with OpenAI integration and context gathering');
    } else {
      logger.info('MasterAgent initialized with rule-based routing only');
    }
  }

  /**
   * Initialize SlackMessageReaderService for context gathering
   */
  private initializeSlackMessageReader(): void {
    try {
      // Get SlackMessageReaderService from service registry
      this.slackMessageReaderService = getService<SlackMessageReaderService>('slackMessageReaderService') || null;
      if (this.slackMessageReaderService) {
        logger.info('SlackMessageReaderService initialized for context gathering');
      } else {
        logger.warn('SlackMessageReaderService not available - context gathering will be limited');
      }
    } catch (error) {
      logger.error('Failed to initialize SlackMessageReaderService:', error);
      this.slackMessageReaderService = null;
    }
  }

  /**
   * Initialize OpenAI function schemas for all agents
   */
  private async initializeAgentSchemas(): Promise<void> {
    try {
      // Import agent classes dynamically to avoid circular imports
      const { EmailAgent } = await import('./email.agent');
      const { ContactAgent } = await import('./contact.agent');
      const { CalendarAgent } = await import('./calendar.agent');
      
      // Register agent schemas
      this.agentSchemas.set('emailAgent', EmailAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('contactAgent', ContactAgent.getOpenAIFunctionSchema() as any);
      this.agentSchemas.set('calendarAgent', CalendarAgent.getOpenAIFunctionSchema());
      
      logger.info('Agent schemas initialized for OpenAI function calling', {
        schemas: Array.from(this.agentSchemas.keys())
      });
    } catch (error) {
      logger.error('Failed to initialize agent schemas:', error);
      // Clear schemas on error to prevent memory leaks from partial initialization
      this.agentSchemas.clear();
    }
  }

  /**
   * Get all agent schemas for OpenAI function calling
   */
  public getAgentSchemas(): OpenAIFunctionSchema[] {
    return Array.from(this.agentSchemas.values());
  }

  /**
   * Get agent capabilities summary for AI planning
   */
  public async getAgentCapabilities(): Promise<Record<string, AgentCapability>> {
    try {
      const { EmailAgent } = await import('./email.agent');
      const { ContactAgent } = await import('./contact.agent');
      const { CalendarAgent } = await import('./calendar.agent');
      
      return {
        emailAgent: {
          capabilities: EmailAgent.getCapabilities(),
          limitations: EmailAgent.getLimitations(),
          schema: EmailAgent.getOpenAIFunctionSchema()
        },
        contactAgent: {
          capabilities: ContactAgent.getCapabilities(),
          limitations: ContactAgent.getLimitations(),
          schema: ContactAgent.getOpenAIFunctionSchema() as any
        },
        calendarAgent: {
          capabilities: CalendarAgent.getCapabilities(),
          limitations: CalendarAgent.getLimitations(),
          schema: CalendarAgent.getOpenAIFunctionSchema()
        }
      };
    } catch (error) {
      logger.error('Failed to get agent capabilities:', error);
      return {};
    }
  }

  /**
   * Get OpenAI service from the registry
   */
  public getOpenAIService(): OpenAIService | null {
    if (!this.useOpenAI) return null;
    
    const openaiService = getService<OpenAIService>('openaiService');
    if (!openaiService) {
      logger.warn('OpenAI service not available from service registry');
      return null;
    }
    return openaiService;
  }

  // Agents are now stateless - no session service needed

  /**
   * Process user input using AI planning with context detection and proposal generation
   */
  async processUserInput(
    userInput: string, 
    sessionId: string, 
    userId?: string,
    slackContext?: SlackContext
  ): Promise<MasterAgentResponse> {
    try {
      logger.info(`MasterAgent processing input: "${userInput}" for session: ${sessionId}`);
      
      // Check memory usage periodically
      this.checkMemoryUsage();
      
      // AI-first execution - no fallback routing
      const openaiService = this.getOpenAIService();
      if (!this.useOpenAI || !openaiService) {
        throw new Error('OpenAI service is required but not available. Please check OpenAI configuration.');
      }

      // Step 1: Detect if context is needed
      const contextDetection = await this.detectContextNeeds(userInput, slackContext);
      logger.info('Context detection result:', contextDetection);

      // Step 2: Gather context if needed
      let contextGathered: ContextGatheringResult | undefined;
      if (contextDetection.needsContext && this.slackMessageReaderService && slackContext) {
        contextGathered = await this.gatherContext(userInput, contextDetection, slackContext);
        logger.info('Context gathered:', { 
          contextType: contextGathered.contextType, 
          messageCount: contextGathered.messages.length,
          confidence: contextGathered.confidence 
        });
      }

      // Step 3: Enhanced AI planning with context
      const enhancedSystemPrompt = await this.generateEnhancedSystemPrompt(contextGathered);
      
      // Use enhanced system prompt with agent capabilities and context
      const response = await openaiService.generateToolCalls(
        userInput, 
        enhancedSystemPrompt, 
        sessionId
      );
      
      const toolCalls = response.toolCalls;
      const message = response.message;

      // Step 4: Validate tool calls against available agents
      const validatedToolCalls = await this.validateAndEnhanceToolCalls(toolCalls, userInput);

      logger.info(`MasterAgent determined ${validatedToolCalls.length} tool calls:`, validatedToolCalls.map(tc => tc.name));

      // Step 5: Generate conversational proposal if appropriate
      const proposal = await this.generateProposal(userInput, validatedToolCalls, contextGathered, slackContext);
      
      const result = {
        message: proposal?.text || message,
        toolCalls: validatedToolCalls,
        needsThinking: validatedToolCalls.some(tc => tc.name === 'Think'),
        proposal,
        contextGathered
      };
      
      logger.info('MasterAgent processUserInput result', {
        hasProposal: !!proposal,
        proposalRequiresConfirmation: proposal?.requiresConfirmation,
        toolCallsCount: validatedToolCalls.length,
        toolCallNames: validatedToolCalls.map(tc => tc.name)
      });
      
      return result;
      
    } catch (error) {
      logger.error('Error in MasterAgent.processUserInput:', error);
      
      // Provide user-friendly error message
      const errorMessage = this.createUserFriendlyErrorMessage(error as Error, userInput);
      
      return {
        message: errorMessage,
        toolCalls: [{
          name: 'Think',
          parameters: { query: `Error occurred while processing: ${userInput}` }
        }]
      };
    }
  }

  /**
   * Create user-friendly error messages for MasterAgent failures
   */
  private createUserFriendlyErrorMessage(error: Error, userInput: string): string {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('openai') || errorMessage.includes('api key')) {
      return 'I\'m having trouble connecting to my AI services. Please check the configuration and try again.';
    }
    
    if (errorMessage.includes('timeout')) {
      return 'Your request is taking longer than expected. Please try with a simpler request.';
    }
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
      return 'I need proper authorization to process your request. Please check your authentication settings.';
    }
    
    if (errorMessage.includes('rate limit')) {
      return 'I\'m receiving too many requests. Please wait a moment and try again.';
    }
    
    return 'I encountered an unexpected error while processing your request. Please try again or contact support if the issue continues.';
  }

  /**
   * Validate and enhance tool calls using agent capabilities
   */
  private async validateAndEnhanceToolCalls(toolCalls: ToolCall[], userInput: string): Promise<ToolCall[]> {
    const enhancedToolCalls: ToolCall[] = [];
    
    for (const toolCall of toolCalls) {
      // Check if agent exists and is enabled using tool name mapping
      const agent = AgentFactory.getAgentByToolName(toolCall.name);
      if (!agent) {
          logger.warn(`Tool call for disabled/missing agent: ${toolCall.name}`);
        continue;
      }

      // Enhance tool call with agent-specific parameters
      const enhancedCall = await this.enhanceToolCallWithAgentContext(toolCall, userInput);
      enhancedToolCalls.push(enhancedCall);
    }

    return enhancedToolCalls;
  }

  /**
   * Enhance tool call with agent-specific context and parameters
   */
  private async enhanceToolCallWithAgentContext(toolCall: ToolCall, userInput: string): Promise<ToolCall> {
    const toolName = toolCall.name;
    
    // Map tool names to agent names for capability lookup
    const toolToAgentMap: Record<string, string> = {
      'send_email': 'emailAgent',
      'search_contacts': 'contactAgent', 
      'manage_calendar': 'calendarAgent',
      'Think': 'Think',
      'slack_operations': 'slackAgent'
    };

    const agentName = toolToAgentMap[toolName];
    const agentCapabilities = agentName ? (await this.getAgentCapabilities())[agentName] : null;
    
    if (!agentCapabilities) {
      return toolCall;
    }

    // Add agent-specific enhancements based on capabilities
    const enhancedParameters = { ...toolCall.parameters };

    // For email operations, ensure we have contact context if needed
    if (toolName === 'send_email') {
      const contactLookup = await this.needsContactLookup(userInput);
      if (contactLookup.needed) {
        // This will be handled by the MasterAgent's orchestration logic
        enhancedParameters.requiresContactLookup = true;
        enhancedParameters.contactNames = contactLookup.names;
      }
    }

    // For calendar operations, add conflict detection
    if (toolName === 'manage_calendar') {
      enhancedParameters.enableConflictDetection = true;
    }

    return {
      name: toolCall.name,
      parameters: enhancedParameters
    };
  }

  /**
   * Check if user input requires contact lookup using AI entity extraction
   */
  private async needsContactLookup(userInput: string): Promise<{needed: boolean, names: string[]}> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        throw new Error('OpenAI service is not available. AI contact lookup detection is required for this operation.');
      }

      const response = await openaiService.generateText(
        `Extract person names that need contact lookup: "${userInput}"
        
        Return JSON: {"needed": boolean, "names": ["name1", "name2"]}
        
        Examples:
        - "Send email to John" → {"needed": true, "names": ["John"]}
        - "Email john@example.com" → {"needed": false, "names": []}
        - "What's on my calendar?" → {"needed": false, "names": []}`,
        'Extract contact names from user requests. Always return valid JSON.',
        { temperature: 0, maxTokens: 100 }
      );

      const result = JSON.parse(response);
      return {
        needed: Boolean(result.needed),
        names: Array.isArray(result.names) ? result.names : []
      };
    } catch (error) {
      logger.error('Failed to extract contact names:', error);
      throw new Error('AI contact lookup detection failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Detect if context gathering is needed for the user input
   */
  private async detectContextNeeds(userInput: string, slackContext?: SlackContext): Promise<ContextDetectionResult> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService || !slackContext) {
        throw new Error('OpenAI service or Slack context is not available. AI context detection is required for this operation.');
      }

      const contextDetectionPrompt = `Analyze this user request to determine if context from recent Slack messages would be helpful:

User Request: "${userInput}"
Current Context: Direct message conversation

IMPORTANT: Be proactive about gathering context! When in doubt, choose to gather context rather than asking for clarification.

Determine if the user is referring to:
1. Previous messages in this conversation (thread_history)
2. Recent messages from the user (recent_messages)
3. Specific topics or people mentioned (search_results)
4. No context needed (none)

BIAS TOWARD CONTEXT GATHERING for these patterns:
- Follow-up questions like "what about...", "other...", "also...", "more..."
- Ambiguous requests that could benefit from conversation history
- References to "emails", "messages", "meetings" without specifics
- Pronouns or incomplete information

Return JSON with:
{
  "needsContext": boolean,
  "contextType": "recent_messages" | "thread_history" | "search_results" | "none",
  "confidence": number (0-1),
  "reasoning": "explanation of decision"
}

Examples:
- "Send that email we discussed" → needsContext: true, contextType: "thread_history"
- "Email John about the project" → needsContext: false, contextType: "none"
- "what about my other emails?" → needsContext: true, contextType: "thread_history"
- "other emails" → needsContext: true, contextType: "recent_messages"
- "more details" → needsContext: true, contextType: "thread_history"
- "Follow up on my last message" → needsContext: true, contextType: "recent_messages"
- "What did Sarah say about the meeting?" → needsContext: true, contextType: "search_results"`;

      const response = await openaiService.generateStructuredData<ContextDetectionResult>(
        userInput,
        contextDetectionPrompt,
        {
          type: 'object',
          properties: {
            needsContext: { type: 'boolean' },
            contextType: { 
              type: 'string', 
              enum: ['recent_messages', 'thread_history', 'search_results', 'none'] 
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string' }
          },
          required: ['needsContext', 'contextType', 'confidence', 'reasoning']
        },
        { temperature: 0.1, maxTokens: 200 }
      );

      logger.debug('Context detection completed', response);
      return response;

    } catch (error) {
      logger.error('Error in context detection:', error);
      return {
        needsContext: false,
        contextType: 'none',
        confidence: 0.5,
        reasoning: 'Error occurred during context detection'
      };
    }
  }

  /**
   * Gather context from Slack messages based on detection result
   */
  private async gatherContext(
    userInput: string, 
    contextDetection: ContextDetectionResult, 
    slackContext: SlackContext
  ): Promise<ContextGatheringResult> {
    try {
      if (!this.slackMessageReaderService) {
        throw new Error('SlackMessageReaderService not available');
      }

      let messages: SlackMessage[] = [];
      let contextType: ContextGatheringResult['contextType'] = 'none';
      let relevantContext = '';

      switch (contextDetection.contextType) {
        case 'thread_history':
          if (slackContext.threadTs) {
            messages = await this.slackMessageReaderService.readThreadMessages(
              slackContext.channelId,
              slackContext.threadTs,
              { limit: 20 }
            );
            contextType = 'thread_history';
            relevantContext = this.extractRelevantContext(messages, userInput);
          }
          break;

        case 'recent_messages':
          messages = await this.slackMessageReaderService.readRecentMessages(
            slackContext.channelId,
            10,
            { 
              filter: {
                userIds: [slackContext.userId],
                excludeBotMessages: true
              }
            }
          );
          contextType = 'recent_messages';
          relevantContext = this.extractRelevantContext(messages, userInput);
          break;

        case 'search_results':
          // Extract key terms from user input for search
          const searchTerms = this.extractSearchTerms(userInput);
          if (searchTerms.length > 0) {
            messages = await this.slackMessageReaderService.searchMessages(
              searchTerms.join(' '),
              { 
                channels: [slackContext.channelId],
                limit: 10 
              }
            );
            contextType = 'search_results';
            relevantContext = this.extractRelevantContext(messages, userInput);
          }
          break;

        default:
          contextType = 'none';
      }

      return {
        messages,
        relevantContext,
        contextType,
        confidence: contextDetection.confidence
      };

    } catch (error) {
      logger.error('Error gathering context:', error);
      return {
        messages: [],
        relevantContext: '',
        contextType: 'none',
        confidence: 0.0
      };
    }
  }

  /**
   * Extract relevant context from messages for the user input
   */
  private extractRelevantContext(messages: SlackMessage[], userInput: string): string {
    if (messages.length === 0) return '';

    // Simple relevance scoring based on keyword overlap
    const userKeywords = userInput.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    const relevantMessages = messages
      .map(msg => ({
        message: msg,
        score: this.calculateRelevanceScore(msg.text, userKeywords)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 most relevant messages

    return relevantMessages
      .map(item => `[${item.message.timestamp.toISOString()}] ${item.message.text}`)
      .join('\n');
  }

  /**
   * Calculate relevance score between message text and user keywords
   */
  private calculateRelevanceScore(messageText: string, keywords: string[]): number {
    const text = messageText.toLowerCase();
    return keywords.reduce((score, keyword) => {
      return score + (text.includes(keyword) ? 1 : 0);
    }, 0);
  }

  /**
   * Extract search terms from user input
   */
  private extractSearchTerms(userInput: string): string[] {
    // Simple extraction of potential search terms
    const words = userInput.toLowerCase().split(/\s+/);
    return words.filter(word => 
      word.length > 2 && 
      !['the', 'and', 'or', 'but', 'for', 'with', 'about', 'from', 'that', 'this'].includes(word)
    );
  }

  /**
   * Generate conversational proposal from tool calls
   */
  private async generateProposal(
    userInput: string,
    toolCalls: ToolCall[],
    contextGathered?: ContextGatheringResult,
    slackContext?: SlackContext
  ): Promise<ProposalResponse | undefined> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService || toolCalls.length === 0) {
        return undefined;
      }

      // Only generate proposals for non-Thinking tool calls
      const actionToolCalls = toolCalls.filter(tc => tc.name !== 'Think');
      logger.info('Proposal generation - filtering tool calls', {
        originalToolCalls: toolCalls.map(tc => tc.name),
        actionToolCalls: actionToolCalls.map(tc => tc.name),
        filteredCount: actionToolCalls.length
      });
      
      if (actionToolCalls.length === 0) {
        logger.warn('No action tool calls found for proposal generation');
        return undefined;
      }

      const proposalPrompt = `Transform these technical tool calls into a conversational proposal for the user:

User Request: "${userInput}"
Tool Calls: ${JSON.stringify(actionToolCalls, null, 2)}
${contextGathered ? `Context: ${contextGathered.relevantContext}` : ''}

Generate a natural, conversational proposal that:
1. Explains what action will be taken in plain language
2. Includes ALL relevant details from the tool calls (recipient, subject, body content, etc.)
3. Shows the full email body content when it's an email action
4. Asks for confirmation in a friendly way
5. Uses "I'll" or "I will" language

IMPORTANT: For email and calendar actions, ALWAYS set requiresConfirmation to true.

Return JSON:
{
  "text": "conversational proposal text",
  "actionType": "email|calendar|contact|other",
  "confidence": number (0-1),
  "requiresConfirmation": boolean (true for email/calendar actions)
}

Examples:
- Tool call: send_email with recipient="john@example.com", subject="Project Update", body="Here is the latest status..."
  Proposal: "I'll send an email to john@example.com with the subject 'Project Update' and the following content:\n\nHere is the latest status...\n\nShould I go ahead?"

- Tool call: manage_calendar with title="Team Meeting", attendees=["john@example.com"]
  Proposal: "I'll create a calendar event called 'Team Meeting' and invite john@example.com. Does this look right?"

IMPORTANT: For email actions, always include the full body content in the proposal text.`;

      const response = await openaiService.generateStructuredData<ProposalResponse>(
        userInput,
        proposalPrompt,
        {
          type: 'object',
          properties: {
            text: { type: 'string' },
            actionType: { 
              type: 'string', 
              enum: ['email', 'calendar', 'contact', 'other'] 
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            requiresConfirmation: { type: 'boolean' }
          },
          required: ['text', 'actionType', 'confidence', 'requiresConfirmation']
        },
        { temperature: 0.3, maxTokens: 300 }
      );

      const result = {
        ...response,
        originalToolCalls: actionToolCalls
      };
      
      // Use AI-powered operation-aware confirmation logic instead of blanket forcing
      if (result.actionType === 'email' || result.actionType === 'calendar') {
        // Detect operation from the user input using AI
        const { AGENT_HELPERS } = await import('../config/agent-config');
        const operation = await AGENT_HELPERS.detectOperation(result.actionType, userInput);
        const operationRequiresConfirmation = await AGENT_HELPERS.operationRequiresConfirmation(result.actionType, operation);
        
        // Only force confirmation if the operation actually requires it
        if (operationRequiresConfirmation) {
          result.requiresConfirmation = true;
          logger.info('Forcing confirmation for external action', {
            actionType: result.actionType,
            detectedOperation: operation,
            originalRequiresConfirmation: response.requiresConfirmation
          });
        } else {
          logger.info('Read-only operation detected, no confirmation needed', {
            actionType: result.actionType,
            detectedOperation: operation,
            originalRequiresConfirmation: response.requiresConfirmation
          });
        }
      }
      
      logger.info('Proposal generated successfully', {
        proposalText: result.text.substring(0, 150),
        actionType: result.actionType,
        requiresConfirmation: result.requiresConfirmation,
        confidence: result.confidence
      });
      
      return result;

    } catch (error) {
      logger.error('Error generating proposal:', error);
      return undefined;
    }
  }

  /**
   * Generate enhanced system prompt with agent capabilities and context
   */
  private async generateEnhancedSystemPrompt(contextGathered?: ContextGatheringResult): Promise<string> {
    const basePrompt = this.generateSystemPrompt();
    const agentCapabilities = await this.getAgentCapabilities();
    
    const capabilitiesSection = `
## Agent Capabilities and Limitations

### Email Agent (emailAgent)
**Capabilities:**
${agentCapabilities.emailAgent?.capabilities.map((cap: string) => `- ${cap}`).join('\n') || 'No capabilities available'}

**Limitations:**
${agentCapabilities.emailAgent?.limitations.map((lim: string) => `- ${lim}`).join('\n') || 'No limitations available'}

### Contact Agent (contactAgent)
**Capabilities:**
${agentCapabilities.contactAgent?.capabilities.map((cap: string) => `- ${cap}`).join('\n') || 'No capabilities available'}

**Limitations:**
${agentCapabilities.contactAgent?.limitations.map((lim: string) => `- ${lim}`).join('\n') || 'No limitations available'}

### Calendar Agent (calendarAgent)
**Capabilities:**
${agentCapabilities.calendarAgent?.capabilities.map((cap: string) => `- ${cap}`).join('\n') || 'No capabilities available'}

**Limitations:**
${agentCapabilities.calendarAgent?.limitations.map((lim: string) => `- ${lim}`).join('\n') || 'No limitations available'}

## Multi-Agent Orchestration Rules
- When sending emails to person names (not email addresses), ALWAYS call contactAgent first, then emailAgent
- When creating calendar events with attendee names, ALWAYS call contactAgent first, then calendarAgent
- Use agent capabilities to determine the best approach for complex requests
- Consider agent limitations when planning multi-step operations
- Always call Think tool at the end to verify correct orchestration`;

    let contextSection = '';
    if (contextGathered && contextGathered.relevantContext) {
      contextSection = `

## Current Context
Based on recent Slack messages, here's relevant context for this request:

${contextGathered.relevantContext}

Use this context to better understand the user's intent and provide more accurate responses.`;
    }

    return `${basePrompt}\n\n${capabilitiesSection}${contextSection}`;
  }



  /**
   * Generate AI-driven system prompt with dynamic agent capabilities
   */
  private generateSystemPrompt(): string {
    const basePrompt = `# AI-Powered Personal Assistant
You are an intelligent personal assistant that uses AI planning to understand user requests and orchestrate multiple specialized agents to complete complex tasks.

## Core Principles
- Use AI planning to understand user intent and break down complex requests
- Route requests to the most appropriate specialized agents
- Coordinate multiple agents when needed for complex workflows
- Always provide clear, helpful responses to users

## Universal AI Assistant Personality
- **Helpful but not overwhelming**: Focus on solving the user's actual need without unnecessary elaboration
- **Professional yet approachable**: Maintain business-appropriate language while being conversational
- **Proactive and intelligent**: Take action based on context clues rather than asking for clarification when intent is reasonably clear
- **Context-detective**: Always use available tools (especially Slack) to gather conversation context before responding
- **Empathetic and understanding**: Acknowledge user frustration and provide reassuring, supportive responses
- **Clear and actionable**: Always prioritize clear, understandable communication with specific next steps
- **Context-aware**: Reference previous interactions and user patterns to provide personalized assistance
- **Respectful of boundaries**: Honor user preferences and maintain appropriate professional boundaries

## Agent Orchestration Rules
- When sending emails to person names (not email addresses), ALWAYS call contactAgent first, then emailAgent
- When creating calendar events with attendee names, ALWAYS call contactAgent first, then calendarAgent
- **CRITICAL: Use Slack agent proactively** when user requests are ambiguous or lack context - read recent messages first
- When user asks follow-up questions (like "what about X?" or "other Y?"), ALWAYS check Slack context before responding
- Use agent capabilities to determine the best approach for complex requests
- Prefer taking intelligent action over asking for clarification when context provides reasonable clues
- Always call Think tool at the end to verify correct orchestration

## Context Gathering Strategy
- **For ambiguous requests**: FIRST call Slack agent to read recent conversation history
- **For follow-up questions**: Use previous message context to infer what user likely wants
- **For email requests**: If unclear, show recent emails, unread emails, or broader email list rather than asking
- **For calendar requests**: If unclear, show today's/upcoming events rather than asking for specifics
- **Default to helpful action**: When in doubt, provide useful information rather than requesting clarification

## Current Context
- Current date/time: ${new Date().toISOString()}
- Today is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current time: ${new Date().toLocaleTimeString('en-US', { hour12: true, timeZoneName: 'short' })}
- Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Session-based processing for user context

## Time and Date Guidelines
- When users ask about "today", "tomorrow", "this week", etc., use the current date/time above as reference
- For calendar operations, always specify explicit dates and times, not relative terms
- Default to user's local timezone unless specified otherwise
- When listing calendar events, ALWAYS show them in strict chronological order from earliest to latest with clear time labels
- IMPORTANT: Sort all calendar events by start time before displaying to ensure proper chronological ordering

## Response Quality Standards
- **Specificity over vagueness**: Always provide specific, actionable information rather than general statements
- **Structured information**: Use clear formatting (bullet points, numbered lists) for multiple items or complex information
- **Proactive suggestions**: Include relevant next steps or related actions when appropriate
- **Context integration**: Reference previous conversation context and user patterns when relevant
- **Error transparency**: When something fails, explain what happened and provide clear recovery options
- **Progress indication**: For multi-step operations, keep users informed of progress and next steps

## Error Communication Framework
- **Level 1 (Default)**: Simple, user-friendly explanation with immediate next steps
- **Level 2 (When requested)**: More detailed guidance with alternative approaches
- **Level 3 (Technical details)**: Full technical information only when specifically requested
- **Always offer alternatives**: When primary approach fails, suggest practical alternatives
- **Acknowledge impact**: Recognize how errors affect the user and provide empathetic responses
- **Learning opportunity**: When appropriate, briefly explain how to prevent similar issues`;

    // Get dynamic tool information from AgentFactory
    const toolsSection = AgentFactory.generateSystemPrompts();
    
    return `${basePrompt}\n\n${toolsSection}`;
  }


  /**
   * Get the system prompt for external use (e.g., when integrating with OpenAI)
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    const now = Date.now();
    // Check memory every 30 seconds
    if (now - this.lastMemoryCheck < 30000) {
      return;
    }

    this.lastMemoryCheck = now;
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    logger.debug('Memory usage check', {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    });

    // If heap usage exceeds threshold, trigger garbage collection and cleanup
    if (heapUsedMB > APP_CONSTANTS.MEMORY_WARNING_THRESHOLD_MB) {
      logger.warn('High memory usage detected, triggering cleanup', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`
      });
      
      // Clear agent schemas to free memory
      if (this.agentSchemas.size > 0) {
        const schemasSize = this.agentSchemas.size;
        this.agentSchemas.clear();
        // Reinitialize immediately to maintain functionality
        this.initializeAgentSchemas().catch(error => {
          logger.error('Failed to reinitialize agent schemas:', error);
        });
        logger.debug('Agent schemas cleared and reinitialized', { previousSize: schemasSize });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.debug('Forced garbage collection completed');
      }
    }
  }

  /**
   * Process tool results through LLM to generate natural language responses
   */
  async processToolResultsWithLLM(
    userInput: string, 
    toolResults: ToolResult[], 
    sessionId: string
  ): Promise<string> {
    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      throw new Error('OpenAI service is not available. AI natural language processing is required for this operation.');
    }

    try {
      const toolResultsSummary = toolResults.map(tr => ({
        toolName: tr.toolName,
        success: tr.success,
        result: tr.result,
        error: tr.error
      }));

      const prompt = `Based on the user's request and the tool execution results, provide a natural, conversational response.

User Request: "${userInput}"

Tool Results:
${JSON.stringify(toolResultsSummary, null, 2)}

IMPORTANT: Be proactive and intelligent in your response. If the user asked a follow-up or ambiguous question, provide the most helpful information available rather than asking for clarification.

Provide a natural language response that:
1. **Takes intelligent action**: If the user said "what about my other emails?" or similar, show additional emails, unread emails, or expand the email list
2. **Uses conversational tone**: Professional but friendly and approachable
3. **Includes relevant details**: From tool results with proper formatting
4. **Organizes information clearly**: Use bullet points, numbers, or sections for multiple items
5. **Suggests relevant next steps**: When helpful, but don't overwhelm
6. **Doesn't mention technical details**: Like tool names or execution times

Special handling for follow-up questions:
- "what about X?" → Show more of X or related information
- "other Y?" → Expand the search or show additional Y items
- Ambiguous requests → Provide the most likely helpful information based on context

Guidelines:
- **Be specific and actionable** rather than vague
- **Use proper formatting** for readability (bullet points, bold text, etc.)
- **Include important details** like dates, names, counts, subject lines
- **Avoid asking for clarification** - take intelligent action instead
- **For email results**: Include subject, sender, date, and brief content preview when available
- **For calendar results**: Include time, title, attendees, and location when available
- **Show enthusiasm** when providing helpful information

Response:`;

      const response = await openaiService.generateText(
        prompt,
        'Generate natural language responses from tool execution results',
        { temperature: 0.7, maxTokens: 500 }
      );

      return response.trim();
    } catch (error) {
      logger.error('Error processing tool results with LLM:', error);
      throw new Error('AI natural language processing failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Cleanup resources and memory
   */
  public cleanup(): void {
    this.agentSchemas.clear();
    this.slackMessageReaderService = null;
    logger.debug('MasterAgent cleanup completed');
  }
}