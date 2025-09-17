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

      // Step 3: Parse intent and resolve dependencies
      const intentAnalysis = await this.parseIntentAndResolveDependencies(userInput, contextGathered);
      logger.info('Intent analysis result:', intentAnalysis);

      // Step 4: Enhanced AI planning with context and resolved dependencies
      const enhancedSystemPrompt = await this.generateEnhancedSystemPrompt(contextGathered, intentAnalysis);
      
      // Use enhanced system prompt with agent capabilities and context
      const response = await openaiService.generateToolCalls(
        userInput, 
        enhancedSystemPrompt, 
        sessionId
      );
      
      const toolCalls = response.toolCalls;
      const message = response.message;

      // Step 5: Validate tool calls against available agents
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

    // Fix email parameter mapping: Handle both recipientName and recipients properly
    logger.info(`Parameter mapping for ${toolName}:`, {
      original: enhancedParameters,
      hasRecipientName: !!enhancedParameters.recipientName,
      hasRecipients: !!enhancedParameters.recipients
    });

    if (toolName === "manage_emails") {
      // Handle recipientName -> recipients conversion
      if (enhancedParameters.recipientName && !enhancedParameters.recipients) {
        enhancedParameters.recipients = [enhancedParameters.recipientName];
        delete enhancedParameters.recipientName;
        logger.info(`Converted recipientName to recipients for ${toolName}:`, {
          recipients: enhancedParameters.recipients
        });
      }
      // Ensure recipients is always an array
      if (enhancedParameters.recipients && !Array.isArray(enhancedParameters.recipients)) {
        enhancedParameters.recipients = [enhancedParameters.recipients];
        logger.info(`Converted recipients to array for ${toolName}:`, {
          recipients: enhancedParameters.recipients
        });
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
   * Parse user intent and resolve dependencies (like contact names)
   */
  private async parseIntentAndResolveDependencies(
    userInput: string, 
    contextGathered?: ContextGatheringResult
  ): Promise<{resolvedContacts: Array<{name: string, email: string}>, intent: string}> {
    try {
      const openaiService = this.getOpenAIService();
      if (!openaiService) {
        throw new Error('OpenAI service is required for intent parsing');
      }

      // Extract contact names that need resolution
      const contactExtractionResponse = await openaiService.generateText(
        `Extract person names and email addresses from: "${userInput}"
        
        Return JSON: {"needed": boolean, "names": ["name1", "name2"], "emails": ["email1@example.com"]}
        
        Examples:
        - "Send email to John" → {"needed": true, "names": ["John"]}
        - "Email john@example.com" → {"needed": true, "names": [], "emails": ["john@example.com"]}
        - "Schedule meeting with Sarah" → {"needed": true, "names": ["Sarah"]}
        - "What's on my calendar?" → {"needed": false, "names": []}`,
        'Extract contact names from user requests. Always return valid JSON.',
        { temperature: 0, maxTokens: 100 }
      );

      const contactExtraction = this.extractJsonFromResponse(contactExtractionResponse);
      const resolvedContacts: Array<{name: string, email: string}> = [];
      // Add email addresses directly (no resolution needed)
      if (contactExtraction.emails && contactExtraction.emails.length > 0) {
        for (const email of contactExtraction.emails) {
          resolvedContacts.push({
            name: email,
            email: email
          });
        }
      }

      // Resolve contacts if needed - but skip during intent parsing since we don't have access token yet
      // Contact resolution will happen during actual tool execution with proper access token
      if (contactExtraction.needed && contactExtraction.names.length > 0) {
        logger.info('Contact names detected for later resolution', {
          names: contactExtraction.names,
          stage: 'intent-parsing'
        });

        // Store contact names for resolution during tool execution
        for (const name of contactExtraction.names) {
          resolvedContacts.push({
            name: name,
            email: '' // Will be resolved during actual execution with proper access token
          });
        }
      }

      return {
        resolvedContacts,
        intent: userInput
      };
    } catch (error) {
      logger.error('Failed to parse intent and resolve dependencies:', error);
      return {
        resolvedContacts: [],
        intent: userInput
      };
    }
  }

  /**
   * Extract JSON from OpenAI response, handling markdown code blocks
   */
  private extractJsonFromResponse(response: string): any {
    try {
      // First, try to parse directly
      return JSON.parse(response);
    } catch (error) {
      // If direct parsing fails, try to extract from markdown code blocks
      try {
        // Look for JSON in markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1]);
        }
        
        // Look for JSON without code blocks
        const jsonMatch2 = response.match(/\{[\s\S]*\}/);
        if (jsonMatch2 && jsonMatch2[0]) {
          return JSON.parse(jsonMatch2[0]);
        }
        
        // If all else fails, return default structure
        logger.warn('Failed to parse JSON from OpenAI response', { 
          response: response.substring(0, 200),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        return {
          needed: false,
          names: [],
          emails: []
        };
      } catch (extractError) {
        logger.error('Failed to extract JSON from response', { 
          response: response.substring(0, 200),
          extractError: extractError instanceof Error ? extractError.message : 'Unknown error'
        });
        
        return {
          needed: false,
          names: [],
          emails: []
        };
      }
    }
  }

  /**
   * Generate enhanced system prompt with agent capabilities and context
   */
  private async generateEnhancedSystemPrompt(contextGathered?: ContextGatheringResult, intentAnalysis?: any): Promise<string> {
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

### Email Operations
- **DIRECT EMAIL ADDRESSES**: When user provides email addresses (contains @domain.com), call emailAgent DIRECTLY
  - Example: "send email to john@company.com" → generate ONLY emailAgent call
  - NO contact resolution needed
- **PERSON NAMES**: When user provides person names (no @ symbol), use TWO-STEP process:
  1. First: contactAgent with search operation for the person's name
  2. Second: emailAgent with the resolved email address from step 1
  - Example: "send email to John Smith" → generate contactAgent call, then emailAgent call

### Calendar Operations
- **EMAIL ATTENDEES**: When attendees are email addresses, call calendarAgent DIRECTLY
- **NAME ATTENDEES**: When attendees are person names, use TWO-STEP process:
  1. First: contactAgent with search operation for attendee names
  2. Second: calendarAgent with resolved email addresses from step 1

### General Rules
- **SMART DETECTION**: Analyze the input to distinguish between email addresses and person names
- **NO UNNECESSARY STEPS**: Don't call contactAgent when email addresses are already provided
- **CONFIRMATION REQUIRED**: Both email and calendar operations should require user confirmation
- Always call Think tool at the end to verify correct orchestration

## Tool Call Generation Rules
- **"send email to john@company.com"** → Generate emailAgent call ONLY (no contactAgent)
- **"send email to John Smith"** → Generate contactAgent call first, then emailAgent call
- **"schedule meeting with john@company.com"** → Generate calendarAgent call ONLY (no contactAgent)
- **"schedule meeting with John Smith"** → Generate contactAgent call first, then calendarAgent call

## Email Address Detection
- Pattern: contains @ symbol and domain (e.g., user@domain.com)
- If detected: Skip contact resolution, go directly to emailAgent
- If NOT detected: Use contact resolution workflow`;

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
    const basePrompt = `# AI Personal Assistant
You're a smart personal assistant that helps users by coordinating different tools and agents.

Be helpful, professional, and take intelligent action rather than asking for clarification when possible.

## Agent Orchestration Rules
- **SMART EMAIL ROUTING**: When user provides email addresses (with @ symbol), call emailAgent DIRECTLY - NO contact resolution needed
- **SMART PERSON ROUTING**: When user provides person names (no @ symbol), call contactAgent first, then emailAgent
- **CONFIRMATION REQUIRED**: All email and calendar operations require user confirmation before execution
- **CRITICAL: Use Slack agent proactively** when user requests are ambiguous or lack context - read recent messages first
- When user asks follow-up questions (like "what about X?" or "other Y?"), ALWAYS check Slack context before responding
- Use agent capabilities to determine the best approach for complex requests
- Prefer taking intelligent action over asking for clarification when context provides reasonable clues
- **DISTINGUISH EMAIL vs NAME**: Analyze input to detect email addresses vs person names automatically
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

## Response Guidelines
- Be specific and actionable
- Use clear formatting for multiple items
- When things fail, explain what happened and suggest next steps

## Error Handling
- Give simple, clear explanations when things go wrong
- Always suggest what to try next`;

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
        result: this.truncateToolResultForLLM(tr.result),
        error: tr.error
      }));

      logger.info('Processing tool results with LLM', {
        userInput,
        toolResultsCount: toolResults.length,
        toolResultsSummary: JSON.stringify(toolResultsSummary, null, 2),
        sessionId
      });

      const prompt = `User asked: "${userInput}"

Here's the data from your tools:
${JSON.stringify(toolResultsSummary, null, 2)}

Respond naturally and conversationally. Skip technical details like URLs, IDs, and metadata. Don't use markdown formatting - just plain text that's easy to read.`;

      const response = await openaiService.generateText(
        prompt,
        'Generate natural language responses from tool execution results',
        { temperature: 0.7, maxTokens: 1000 }
      );

      return response.trim();
    } catch (error) {
      logger.error('Error processing tool results with LLM:', error);
      
      // Check if it's a context length error
      if (error instanceof Error && error.message.includes('maximum context length')) {
        logger.warn('Context length exceeded, using fallback response');
        return this.generateFallbackResponse(userInput, toolResults);
      }
      
      throw new Error('AI natural language processing failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Truncate tool results to prevent context length issues
   */
  private truncateToolResultForLLM(result: any): any {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Create a copy to avoid modifying the original
    const truncated = { ...result };

    // Truncate email content specifically
    if (truncated.emails && Array.isArray(truncated.emails)) {
      truncated.emails = truncated.emails.map((email: any) => {
        if (email && typeof email === 'object') {
          const truncatedEmail = { ...email };
          
          // Truncate email body content
          if (truncatedEmail.body) {
            if (truncatedEmail.body.text && truncatedEmail.body.text.length > 500) {
              truncatedEmail.body.text = truncatedEmail.body.text.substring(0, 500) + '...';
            }
            if (truncatedEmail.body.html && truncatedEmail.body.html.length > 500) {
              truncatedEmail.body.html = truncatedEmail.body.html.substring(0, 500) + '...';
            }
          }
          
          // Truncate snippet
          if (truncatedEmail.snippet && truncatedEmail.snippet.length > 200) {
            truncatedEmail.snippet = truncatedEmail.snippet.substring(0, 200) + '...';
          }
          
          return truncatedEmail;
        }
        return email;
      });
    }

    // Truncate other large text fields
    if (truncated.message && truncated.message.length > 1000) {
      truncated.message = truncated.message.substring(0, 1000) + '...';
    }

    return truncated;
  }

  /**
   * Generate fallback response when context length is exceeded
   */
  private generateFallbackResponse(userInput: string, toolResults: ToolResult[]): string {
    const successfulTools = toolResults.filter(tr => tr.success);
    const failedTools = toolResults.filter(tr => !tr.success);

    if (successfulTools.length === 0) {
      return "I encountered an issue while processing your request. Please try again or rephrase your question.";
    }

    // Generate a simple response based on tool results
    const toolNames = successfulTools.map(tr => tr.toolName).join(', ');
    
    if (userInput.toLowerCase().includes('email')) {
      const emailCount = successfulTools.find(tr => tr.toolName === 'manage_emails')?.result?.count || 0;
      if (emailCount > 0) {
        return `I found ${emailCount} email${emailCount === 1 ? '' : 's'} in your inbox. The content was too large to display here, but I can help you with specific questions about these emails.`;
      } else {
        return "I searched your emails but didn't find any recent messages matching your criteria.";
      }
    }

    return `I completed the requested operation using ${toolNames}. The results were processed successfully, but the response was too large to display in full. Please let me know if you need specific information about the results.`;
  }

  /**
   * Cleanup resources and memory
   */
  public cleanup(): void {
    this.agentSchemas.clear();
    logger.debug('MasterAgent cleanup completed');
  }
}