import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
import { SessionService } from '../services/session.service';
import { ToolCall, ToolResult, MasterAgentConfig } from '../types/tools';
import { AgentFactory } from '../framework/agent-factory';
import { initializeAgentFactory } from '../config/agent-factory-init';

export interface MasterAgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  needsThinking?: boolean;
}

export class MasterAgent {
  private openaiService: OpenAIService | null = null;
  private sessionService: SessionService;
  private useOpenAI: boolean = false;
  private systemPrompt: string;

  constructor(config?: MasterAgentConfig) {
    this.sessionService = new SessionService(config?.sessionTimeoutMinutes);
    
    // Initialize AgentFactory if not already done
    if (!AgentFactory.getStats().totalTools) {
      initializeAgentFactory();
    }

    // Generate dynamic system prompt from AgentFactory
    this.systemPrompt = this.generateSystemPrompt();
    
    if (config?.openaiApiKey) {
      this.openaiService = new OpenAIService({
        apiKey: config.openaiApiKey,
        model: config.model
      });
      this.useOpenAI = true;
      logger.info('MasterAgent initialized with OpenAI integration');
    } else {
      logger.info('MasterAgent initialized with rule-based routing only');
    }
  }

  /**
   * Process user input and determine which tools to call
   */
  async processUserInput(userInput: string, sessionId: string, userId?: string): Promise<MasterAgentResponse> {
    try {
      logger.info(`MasterAgent processing input: "${userInput}" for session: ${sessionId}`);
      
      // Get or create session
      const session = this.sessionService.getOrCreateSession(sessionId, userId);
      
      let toolCalls: ToolCall[];
      let message: string;

      // Use OpenAI if available, otherwise fall back to rule-based routing
      if (this.useOpenAI && this.openaiService) {
        try {
          const context = this.sessionService.getConversationContext(sessionId);
          const systemPromptWithContext = context ? 
            `${this.systemPrompt}\n\n${context}` : 
            this.systemPrompt;

          const response = await this.openaiService.generateToolCalls(
            userInput, 
            systemPromptWithContext, 
            sessionId
          );
          
          toolCalls = response.toolCalls;
          message = response.message;
          
        } catch (openaiError) {
          logger.warn('OpenAI failed, falling back to rule-based routing:', openaiError);
          toolCalls = this.determineToolCalls(userInput);
          message = this.generateResponse(userInput, toolCalls);
        }
      } else {
        toolCalls = this.determineToolCalls(userInput);
        message = this.generateResponse(userInput, toolCalls);
      }

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
   * Rule-based tool determination using registry
   */
  private determineToolCalls(userInput: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Use registry to find matching tools
          const matchingTools = AgentFactory.findMatchingTools(userInput);
    
    if (matchingTools.length > 0) {
      // Get the best matching tool
      const primaryTool = matchingTools[0];
      
      if (primaryTool) {
        // Check if we need contact lookup first for email/calendar operations
        const needsContactLookup = this.needsContactLookup(userInput, primaryTool.name);
        
        if (needsContactLookup) {
          const contactName = this.extractContactName(userInput);
          if (contactName) {
            toolCalls.push({
              name: 'contactAgent',
              parameters: { query: `get contact information for ${contactName}` }
            });
          }
        }
        
        // Add the primary tool
        toolCalls.push({
          name: primaryTool.name,
          parameters: { query: userInput }
        });
      }
    } else {
      // If no tools match, use Think to analyze
      toolCalls.push({
        name: 'Think',
        parameters: { query: `Analyze this user request and determine the correct tool to use: "${userInput}"` }
      });
    }

    // Always add Think tool at the end for verification
    toolCalls.push({
      name: 'Think',
      parameters: { 
        query: `Verify that the correct steps were taken for the user request: "${userInput}"`,
        previousActions: toolCalls.slice(0, -1) // Pass previous actions for analysis
      }
    });

    return toolCalls;
  }

  /**
   * Check if a tool needs contact lookup
   */
  private needsContactLookup(userInput: string, toolName: string): boolean {
    const input = userInput.toLowerCase();
    
    // Only email and calendar agents typically need contact lookup
    if (!['emailAgent', 'calendarAgent'].includes(toolName)) {
      return false;
    }
    
    // Don't need lookup if email address is already provided
    if (input.includes('@')) {
      return false;
    }
    
    // Check for name patterns in email/calendar contexts
    const hasNameReference = /\b(?:send|email|meeting|schedule|invite).*?(?:to|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i.test(input);
    
    return hasNameReference;
  }

  /**
   * Extract potential contact name from user input
   */
  private extractContactName(input: string): string | null {
    // Simple regex to find names after common phrases
    const patterns = [
      /(?:email|send|to|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
      /(?:meeting with|schedule with|invite)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Generate dynamic system prompt from registry
   */
  private generateSystemPrompt(): string {
    const basePrompt = `# Overview
You are the ultimate personal assistant. Your job is to send the user's query to the correct tool. You should never be writing emails, or creating even summaries, you just need to call the correct tool.

## Rules
- Some actions require you to look up contact information first. For the following actions, you must get contact information and send that to the agent who needs it:
  - sending emails
  - drafting emails
  - creating calendar event with attendee
- IMPORTANT: For email/calendar actions that require contact lookup, you should call BOTH contactAgent AND the main action tool (emailAgent/calendarAgent) in the SAME response
- You must ALWAYS call the "Think" tool at the end to verify you took the right steps

## Instructions
1) Analyze the user request
2) If it needs contact lookup + action, call contactAgent AND the action tool (emailAgent/calendarAgent)
3) If it's a direct action, call the appropriate tool directly
4) ALWAYS call the "Think" tool last to verify

## Final Reminders
- Call multiple tools in one response when needed
- Always include Think tool at the end
- Current date/time: ${new Date().toISOString()}`;

    // Get dynamic tool information from AgentFactory
    const toolsSection = AgentFactory.generateSystemPrompts();
    
    return `${basePrompt}\n\n${toolsSection}`;
  }

  /**
   * Generate appropriate response message
   */
  private generateResponse(userInput: string, toolCalls: ToolCall[]): string {
    const mainTool = toolCalls.find(call => call.name !== 'Think');
    
    if (!mainTool) {
      return "I'm analyzing your request to determine the best way to help you.";
    }

    switch (mainTool.name) {
      case 'emailAgent':
        return "I'm processing your email request and will send it once I have all the necessary information.";
      case 'calendarAgent':
        return "I'm working on your calendar request and will create the event with the details you provided.";
      case 'contactAgent':
        return "I'm looking up the contact information you requested.";
      case 'contentCreator':
        return "I'm generating the content you requested.";
      case 'Tavily':
        return "I'm searching for the information you requested.";
      default:
        return "I'm processing your request.";
    }
  }

  /**
   * Get the system prompt for external use (e.g., when integrating with OpenAI)
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}