import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
import { SessionService } from '../services/session.service';
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
  private sessionService: SessionService | null = null;
  private useOpenAI: boolean = false;
  private systemPrompt: string;

  constructor(config?: MasterAgentConfig) {
    // Don't create SessionService here - it will be obtained from the service registry
    // this.sessionService = new SessionService(config?.sessionTimeoutMinutes);
    
    // Initialize AgentFactory if not already done
    if (!AgentFactory.getStats().totalTools) {
      initializeAgentFactory();
    }

    // Generate dynamic system prompt from AgentFactory
    this.systemPrompt = this.generateSystemPrompt();
    
    if (config?.openaiApiKey) {
      // Use shared OpenAI service from service registry instead of creating a new instance
      this.useOpenAI = true;
      logger.info('MasterAgent initialized with OpenAI integration');
    } else {
      logger.info('MasterAgent initialized with rule-based routing only');
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

  /**
   * Get or initialize the session service from the registry
   */
  private getSessionService(): SessionService {
    if (!this.sessionService) {
      const service = getService<SessionService>('sessionService');
      if (!service) {
        throw new Error('SessionService not available from service registry. Ensure services are initialized.');
      }
      if (!service.isReady()) {
        throw new Error(`SessionService is not ready. Current state: ${service.state}. Ensure services are fully initialized.`);
      }
      this.sessionService = service;
    }
    return this.sessionService;
  }

  /**
   * Process user input and determine which tools to call
   */
  async processUserInput(userInput: string, sessionId: string, userId?: string): Promise<MasterAgentResponse> {
    try {
      logger.info(`MasterAgent processing input: "${userInput}" for session: ${sessionId}`);
      
      // Get session service from registry
      const sessionService = this.getSessionService();
      
      // Get or create session
      const session = sessionService.getOrCreateSession(sessionId, userId);
      
      let toolCalls: ToolCall[];
      let message: string;

      // Use OpenAI only - no fallback to rule-based routing
      const openaiService = this.getOpenAIService();
      if (!this.useOpenAI || !openaiService) {
        throw new Error('OpenAI service is required but not available. Please check OpenAI configuration.');
      }

      const context = sessionService.getConversationContext(sessionId);
      const systemPromptWithContext = context ? 
        `${this.systemPrompt}\n\n${context}` : 
        this.systemPrompt;

      const response = await openaiService.generateToolCalls(
        userInput, 
        systemPromptWithContext, 
        sessionId
      );
      
      toolCalls = response.toolCalls;
      message = response.message;

      logger.info(`MasterAgent determined ${toolCalls.length} tool calls:`, toolCalls.map(tc => tc.name));
      
      return {
        message,
        toolCalls,
        needsThinking: toolCalls.some(tc => tc.name === 'Think')
      };
      
    } catch (error) {
      logger.error('Error in MasterAgent.processUserInput:', error);
      return {
        message: 'I encountered an error processing your request. Please try again.',
        toolCalls: [{
          name: 'Think',
          parameters: { query: `Error occurred while processing: ${userInput}` }
        }]
      };
    }
  }



  /**
   * Generate dynamic system prompt from registry
   */
  private generateSystemPrompt(): string {
    const basePrompt = `# Overview
You are the ultimate personal assistant. Your job is to send the user's query to the correct tool. You should never be writing emails, or creating even summaries, you just need to call the correct tool.

## Rules
- Some actions require you to look up contact information first. For the following actions, you must get contact information and send that to the agent who needs it:
  - sending emails TO A PERSON'S NAME (not email address)
  - drafting emails TO A PERSON'S NAME (not email address)  
  - creating calendar event with attendee BY NAME (not email address)
- IMPORTANT: If an email address (containing @) is already provided, DO NOT call contactAgent - call only the emailAgent directly
- IMPORTANT: For email/calendar actions that require contact lookup, you should call BOTH contactAgent AND the main action tool (emailAgent/calendarAgent) in the SAME response
- You must ALWAYS call the "Think" tool at the end to verify you took the right steps

## Instructions
1) Analyze the user request
2) If email address (with @) is provided: call only emailAgent directly 
3) If person's name is provided: call contactAgent AND the action tool (emailAgent/calendarAgent)
4) For other direct actions: call the appropriate tool directly
5) ALWAYS call the "Think" tool last to verify

## Final Reminders
- Call multiple tools in one response when needed
- Always include Think tool at the end
- Current date/time: ${new Date().toISOString()}`;

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