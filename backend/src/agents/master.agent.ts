import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
// Agents are now stateless
import { ToolCall, ToolResult, MasterAgentConfig } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { getService } from '../services/service-manager';
import { SlackContext } from '../types/slack/slack.types';
import { SlackMessage } from '../types/slack/slack-message-reader.types';
import { APP_CONSTANTS } from '../config/constants';
import { OpenAIFunctionSchema } from '../framework/agent-factory';
import { SlackAgent, ContextGatheringResult, ContextDetectionResult } from './slack.agent';

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
    slackContext?: SlackContext | undefined;
    toolResults?: Array<{
      toolName: string;
      success: boolean;
      executionTime: number;
      error?: string | undefined;
      result?: Record<string, unknown> | undefined;
    }> | undefined;
    confirmationFlows?: Array<Record<string, unknown>> | undefined;
    masterAgentResponse?: string | undefined;
    error?: string | undefined;
    errorType?: string | undefined;
    errorContext?: Record<string, unknown> | undefined;
  } | undefined;
}

export interface ProposalResponse {
  text: string;
  actionType: string;
  confidence: number;
  requiresConfirmation: boolean;
  originalToolCalls: ToolCall[];
}

export class MasterAgent {
  private useOpenAI: boolean = false;
  private systemPrompt: string;
  private agentSchemas: Map<string, OpenAIFunctionSchema> = new Map();
  private lastMemoryCheck: number = Date.now();

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
    
    if (config?.openaiApiKey) {
      // Use shared OpenAI service from service registry instead of creating a new instance
      this.useOpenAI = true;
      logger.info('MasterAgent initialized with OpenAI integration and context gathering');
    } else {
      logger.info('MasterAgent initialized with rule-based routing only');
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
   * Get SlackAgent from AgentFactory for context gathering
   */
  private getSlackAgent(): SlackAgent | null {
    try {
      return AgentFactory.getAgent('slackAgent') as SlackAgent;
    } catch (error) {
      logger.warn('SlackAgent not available from AgentFactory:', error);
      return null;
    }
  }

  /**
   * Get ContactAgent for contact operations
   */
  private getContactAgent(): any {
    return AgentFactory.getAgent('contactAgent');
  }

  /**
   * Get AIClassificationService for AI classification operations
   */
  private getAIClassificationService(): any {
    return getService('aiClassificationService');
  }

  /**
   * Get EmailFormatter for proposal generation
   */
  private getEmailFormatter(): any {
    return getService('emailFormatter');
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

      // Step 1: Detect if context is needed (delegate to AIClassificationService)
      const aiClassificationService = this.getAIClassificationService();
      const contextDetection = await aiClassificationService.detectContextNeeds(userInput, slackContext);
      logger.info('Context detection result:', contextDetection);

      // Step 2: Gather context if needed
      let contextGathered: ContextGatheringResult | undefined;
      if (contextDetection.needsContext && slackContext) {
        const slackAgent = this.getSlackAgent();
        if (slackAgent) {
          contextGathered = await slackAgent.gatherContext(userInput, contextDetection, slackContext);
          logger.info('Context gathered via SlackAgent delegation:', { 
            contextType: contextGathered?.contextType, 
            messageCount: contextGathered?.messages.length || 0,
            confidence: contextGathered?.confidence || 0
          });
        } else {
          logger.warn('SlackAgent not available for context gathering');
          contextGathered = {
            messages: [],
            relevantContext: '',
            contextType: 'none',
            confidence: 0.0
          };
        }
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

      // Step 5: Generate conversational proposal if appropriate (delegate to EmailFormatter)
      const emailFormatter = this.getEmailFormatter();
      const proposal = await emailFormatter.generateProposal(userInput, validatedToolCalls, contextGathered, slackContext);
      
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

    // For email operations, ensure we have contact context if needed (delegate to ContactAgent)
    if (toolName === 'send_email') {
      const contactAgent = this.getContactAgent();
      const contactLookup = await contactAgent.detectContactNeeds(userInput);
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
    logger.debug('MasterAgent cleanup completed');
  }
}