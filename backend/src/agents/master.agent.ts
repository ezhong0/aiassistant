import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
// Agents are now stateless
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

export class MasterAgent {
  private useOpenAI: boolean = false;
  private systemPrompt: string;
  private agentSchemas: Map<string, any> = new Map();
  private lastMemoryCheck: number = Date.now();
  private slackMessageReaderService: SlackMessageReaderService | null = null;

  constructor(config?: MasterAgentConfig) {
    // Agents are now stateless - no session management needed
    
    // Initialize AgentFactory if not already done
    if (!AgentFactory.getStats().totalTools) {
      initializeAgentFactory();
    }

    // Generate dynamic system prompt from AgentFactory
    this.systemPrompt = this.generateSystemPrompt();
    
    // Initialize agent schemas for OpenAI function calling
    this.initializeAgentSchemas();
    
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
  private initializeAgentSchemas(): void {
    try {
      // Import agent classes dynamically to avoid circular imports
      const { EmailAgent } = require('./email.agent');
      const { ContactAgent } = require('./contact.agent');
      const { CalendarAgent } = require('./calendar.agent');
      
      // Register agent schemas
      this.agentSchemas.set('emailAgent', EmailAgent.getOpenAIFunctionSchema());
      this.agentSchemas.set('contactAgent', ContactAgent.getOpenAIFunctionSchema());
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
  public getAgentSchemas(): any[] {
    return Array.from(this.agentSchemas.values());
  }

  /**
   * Get agent capabilities summary for AI planning
   */
  public getAgentCapabilities(): Record<string, any> {
    try {
      const { EmailAgent } = require('./email.agent');
      const { ContactAgent } = require('./contact.agent');
      const { CalendarAgent } = require('./calendar.agent');
      
      return {
        emailAgent: {
          capabilities: EmailAgent.getCapabilities(),
          limitations: EmailAgent.getLimitations()
        },
        contactAgent: {
          capabilities: ContactAgent.getCapabilities(),
          limitations: ContactAgent.getLimitations()
        },
        calendarAgent: {
          capabilities: CalendarAgent.getCapabilities(),
          limitations: CalendarAgent.getLimitations()
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
      const enhancedSystemPrompt = this.generateEnhancedSystemPrompt(contextGathered);
      
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
    const agentCapabilities = agentName ? this.getAgentCapabilities()[agentName] : null;
    
    if (!agentCapabilities) {
      return toolCall;
    }

    // Add agent-specific enhancements based on capabilities
    const enhancedParameters = { ...toolCall.parameters };

    // For email operations, ensure we have contact context if needed
    if (toolName === 'send_email' && this.needsContactLookup(userInput)) {
      // This will be handled by the MasterAgent's orchestration logic
      enhancedParameters.requiresContactLookup = true;
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
   * Check if user input requires contact lookup
   */
  private needsContactLookup(userInput: string): boolean {
    const lowerInput = userInput.toLowerCase();
    
    // Check for person names (not email addresses)
    const hasEmailAddress = /@/.test(userInput);
    const hasPersonName = /\b(?:send|email|message|contact|reach out to)\s+(?:to\s+)?([a-zA-Z\s]+)/i.test(userInput);
    
    return hasPersonName && !hasEmailAddress;
  }

  /**
   * Detect if context gathering is needed for the user input
   */
  private async detectContextNeeds(userInput: string, slackContext?: SlackContext): Promise<ContextDetectionResult> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService || !slackContext) {
        return {
          needsContext: false,
          contextType: 'none',
          confidence: 1.0,
          reasoning: 'No OpenAI service or Slack context available'
        };
      }

      const contextDetectionPrompt = `Analyze this user request to determine if context from recent Slack messages would be helpful:

User Request: "${userInput}"
Current Context: Direct message conversation

Determine if the user is referring to:
1. Previous messages in this conversation (thread_history)
2. Recent messages from the user (recent_messages)  
3. Specific topics or people mentioned (search_results)
4. No context needed (none)

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
      
      // Force confirmation for email and calendar actions that have external effects
      if (result.actionType === 'email' || result.actionType === 'calendar') {
        result.requiresConfirmation = true;
        logger.info('Forcing confirmation for external action', {
          actionType: result.actionType,
          originalRequiresConfirmation: response.requiresConfirmation
        });
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
  private generateEnhancedSystemPrompt(contextGathered?: ContextGatheringResult): string {
    const basePrompt = this.generateSystemPrompt();
    const agentCapabilities = this.getAgentCapabilities();
    
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

## Agent Orchestration Rules
- When sending emails to person names (not email addresses), ALWAYS call contactAgent first, then emailAgent
- When creating calendar events with attendee names, ALWAYS call contactAgent first, then calendarAgent
- Use agent capabilities to determine the best approach for complex requests
- Always call Think tool at the end to verify correct orchestration

## Current Context
- Current date/time: ${new Date().toISOString()}
- Session-based processing for user context`;

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

    // If heap usage exceeds 400MB, trigger garbage collection and cleanup
    if (heapUsedMB > 400) {
      logger.warn('High memory usage detected, triggering cleanup', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`
      });
      
      // Clear agent schemas to free memory
      if (this.agentSchemas.size > 0) {
        const schemasSize = this.agentSchemas.size;
        this.agentSchemas.clear();
        // Reinitialize immediately to maintain functionality
        this.initializeAgentSchemas();
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
   * Cleanup resources and memory
   */
  public cleanup(): void {
    this.agentSchemas.clear();
    this.slackMessageReaderService = null;
    logger.debug('MasterAgent cleanup completed');
  }
}