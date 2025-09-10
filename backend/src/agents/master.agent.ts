import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
// Agents are now stateless
import { ToolCall, ToolResult, MasterAgentConfig } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { initializeAgentFactory } from '../config/agent-factory-init';
import { getService } from '../services/service-manager';

export interface MasterAgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  needsThinking?: boolean;
}

export class MasterAgent {
  private useOpenAI: boolean = false;
  private systemPrompt: string;
  private agentSchemas: Map<string, any> = new Map();

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
    
    if (config?.openaiApiKey) {
      // Use shared OpenAI service from service registry instead of creating a new instance
      this.useOpenAI = true;
      logger.info('MasterAgent initialized with OpenAI integration');
    } else {
      logger.info('MasterAgent initialized with rule-based routing only');
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
   * Process user input using AI planning only - single execution path
   */
  async processUserInput(userInput: string, sessionId: string, _userId?: string): Promise<MasterAgentResponse> {
    try {
      logger.info(`MasterAgent processing input: "${userInput}" for session: ${sessionId}`);
      
      // AI-first execution - no fallback routing
      const openaiService = this.getOpenAIService();
      if (!this.useOpenAI || !openaiService) {
        throw new Error('OpenAI service is required but not available. Please check OpenAI configuration.');
      }

      // Enhanced AI planning for multi-agent orchestration
      const enhancedSystemPrompt = this.generateEnhancedSystemPrompt();
      
      // Use enhanced system prompt with agent capabilities
      const response = await openaiService.generateToolCalls(
        userInput, 
        enhancedSystemPrompt, 
        sessionId
      );
      
      const toolCalls = response.toolCalls;
      const message = response.message;

      // Validate tool calls against available agents
      const validatedToolCalls = await this.validateAndEnhanceToolCalls(toolCalls, userInput);

      logger.info(`MasterAgent determined ${validatedToolCalls.length} tool calls:`, validatedToolCalls.map(tc => tc.name));
      
      return {
        message,
        toolCalls: validatedToolCalls,
        needsThinking: validatedToolCalls.some(tc => tc.name === 'Think')
      };
      
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
      'create_content': 'contentCreator',
      'search_web': 'Tavily'
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
   * Generate enhanced system prompt with agent capabilities
   */
  private generateEnhancedSystemPrompt(): string {
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
- Always call Think tool at the end to verify correct orchestration
`;

    return `${basePrompt}\n\n${capabilitiesSection}`;
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
}