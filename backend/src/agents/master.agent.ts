import logger from '../utils/logger';
import { OpenAIService } from '../services/openai.service';
import { SessionService } from '../services/session.service';
import { ToolCall, ToolResult, MasterAgentConfig } from '../types/tools';

export interface MasterAgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  needsThinking?: boolean;
}

export class MasterAgent {
  private readonly systemPrompt = `# Overview
You are the ultimate personal assistant. Your job is to send the user's query to the correct tool. You should never be writing emails, or creating even summaries, you just need to call the correct tool.

## Tools
- Think: Use this to think deeply or if you get stuck
- emailAgent: Use this tool to take action in email
- calendarAgent: Use this tool to take action in calendar
- contactAgent: Use this tool to get, update, or add contacts
- contentCreator: Use this tool to create blog posts
- Tavily: Use this tool to search the web

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

## Examples
1) 
- Input: "send an email to nate herkelman asking him what time he wants to leave"
- Expected tool calls: contactAgent(query: "get contact info for nate herkelman") + emailAgent(query: "send email to nate herkelman asking what time he wants to leave") + Think(query: "verify correct steps")

2)
- Input: "schedule a meeting with john and sarah tomorrow at 3pm"
- Expected tool calls: contactAgent(query: "get contact info for john and sarah") + calendarAgent(query: "schedule meeting with john and sarah tomorrow at 3pm") + Think(query: "verify correct steps")

3)
- Input: "create a blog post about AI"
- Expected tool calls: contentCreator(query: "create blog post about AI") + Think(query: "verify correct steps")

## Final Reminders
- Call multiple tools in one response when needed
- Always include Think tool at the end
- Current date/time: ${new Date().toISOString()}`;

  private openaiService: OpenAIService | null = null;
  private sessionService: SessionService;
  private useOpenAI: boolean = false;

  constructor(config?: MasterAgentConfig) {
    this.sessionService = new SessionService(config?.sessionTimeoutMinutes);
    
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
   * Simple rule-based tool determination (will be replaced with OpenAI later)
   */
  private determineToolCalls(userInput: string): ToolCall[] {
    const input = userInput.toLowerCase();
    const toolCalls: ToolCall[] = [];

    // Email-related requests
    if (input.includes('email') || input.includes('send') && (input.includes('@') || input.includes('to '))) {
      // Check if we need contact lookup first
      if (!input.includes('@') && (input.includes('send') || input.includes('email'))) {
        // Extract potential contact name
        const contactName = this.extractContactName(userInput);
        if (contactName) {
          toolCalls.push({
            name: 'contactAgent',
            parameters: { query: `get contact information for ${contactName}` }
          });
        }
      }
      
      toolCalls.push({
        name: 'emailAgent',
        parameters: { query: userInput }
      });
    }
    
    // Calendar-related requests
    else if (input.includes('calendar') || input.includes('meeting') || input.includes('schedule') || input.includes('event')) {
      // Check if we need contact lookup for attendees
      if (input.includes('with ') || input.includes('attendee')) {
        const contactName = this.extractContactName(userInput);
        if (contactName) {
          toolCalls.push({
            name: 'contactAgent',
            parameters: { query: `get contact information for ${contactName}` }
          });
        }
      }
      
      toolCalls.push({
        name: 'calendarAgent',
        parameters: { query: userInput }
      });
    }
    
    // Contact-related requests
    else if (input.includes('contact') || input.includes('find') && (input.includes('person') || input.includes('email'))) {
      toolCalls.push({
        name: 'contactAgent',
        parameters: { query: userInput }
      });
    }
    
    // Content creation requests
    else if (input.includes('blog') || input.includes('write') || input.includes('create') && input.includes('post')) {
      toolCalls.push({
        name: 'contentCreator',
        parameters: { query: userInput }
      });
    }
    
    // Web search requests
    else if (input.includes('search') || input.includes('find') || input.includes('look up') || input.includes('what is')) {
      toolCalls.push({
        name: 'Tavily',
        parameters: { query: userInput }
      });
    }
    
    // If no specific tool determined, use Think to figure it out
    if (toolCalls.length === 0) {
      toolCalls.push({
        name: 'Think',
        parameters: { query: `Analyze this user request and determine the correct tool to use: "${userInput}"` }
      });
    }

    // Always add Think tool at the end (as per the rules)
    toolCalls.push({
      name: 'Think',
      parameters: { query: `Verify that the correct steps were taken for the user request: "${userInput}"` }
    });

    return toolCalls;
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