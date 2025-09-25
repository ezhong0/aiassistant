import logger from '../utils/logger';
import { serviceManager } from '../services/service-manager';
import { OpenAIService } from '../services/openai.service';
import { ToolExecutionContext, ToolResult, AgentConfig } from '../types/tools';
import { ToolMetadata } from '../types/agents/agent.types';
import { EmailAgent } from '../agents/email.agent';
import { CalendarAgent } from '../agents/calendar.agent';
import { ContactAgent } from '../agents/contact.agent';
import { SlackAgent } from '../agents/slack.agent';
import { AGENT_CONFIG } from '../config/agent-config';
import { AgentCapabilities } from '../types/agents/natural-language.types';

// OpenAI Function Schema interface
export interface OpenAIFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// Agent class interface
export interface AgentClass {
  getOpenAIFunctionSchema(): OpenAIFunctionSchema;
  getCapabilities(): string[];
  getLimitations(): string[];
}

/**
 * Enhanced AgentFactory that handles all agent management including tool metadata
 * This replaces the need for a separate tool registry system
 */
export class AgentFactory {
  private static agents = new Map<string, any>();
  private static toolMetadata = new Map<string, ToolMetadata>();
  private static initialized = false;
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static lastCleanup = Date.now();
  
  /**
   * Register a single agent instance with automatic tool discovery
   */
  static registerAgent(name: string, agent: any | any): void {
    if (this.agents.has(name)) {
      logger.warn(`Agent ${name} is already registered, replacing with new instance`, {
        correlationId: `agent-register-${Date.now()}`,
        operation: 'agent_registration_warning',
        metadata: { agentName: name }
      });
    }
    
    this.agents.set(name, agent);
    
    // Auto-register agent's tools using dynamic discovery
    this.autoRegisterTools(name, agent);
    
    logger.debug(`Framework agent registered: ${name}`, {
      correlationId: `agent-register-${Date.now()}`,
      operation: 'agent_registration_success',
      metadata: {
        agentName: name,
        toolCount: this.getToolsForAgent(name).length
      }
    });
  }
  
  /**
   * Register an agent class with configuration
   */
  static registerAgentClass<TParams, TResult>(
    name: string,
    AgentClass: new () => any | any
  ): void {
    try {
      const agent = new AgentClass();
      this.registerAgent(name, agent);
    } catch (error) {
      logger.error(`Failed to register agent class ${name}`, error as Error, {
        correlationId: `agent-register-error-${Date.now()}`,
        operation: 'agent_registration_error',
        metadata: { agentName: name }
      });
      throw new Error(`Agent registration failed for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Register tool metadata for an agent
   */
  static registerToolMetadata(metadata: ToolMetadata): void {
    this.toolMetadata.set(metadata.name, metadata);
    
  }
  
  /**
   * Get an agent by name
   */
  static getAgent(name: string): any | undefined {
    const agent = this.agents.get(name);
    
    if (!agent) {
      return undefined;
    }
    
    // Check if agent is enabled
    if (!agent.isEnabled()) {
      
      return undefined;
    }
    
    return agent;
  }

  /**
   * Dynamic tool-to-agent mapping registry
   */
  private static toolToAgentMap = new Map<string, string>();

  /**
   * Get agent by tool name using dynamic discovery
   */
  static getAgentByToolName(toolName: string): any | undefined {
    const agentName = this.toolToAgentMap.get(toolName);
    if (!agentName) {
      return undefined;
    }

    return this.getAgent(agentName);
  }

  /**
   * Get tool metadata by name
   */
  static getToolMetadata(name: string): ToolMetadata | undefined {
    return this.toolMetadata.get(name);
  }

  /**
   * Auto-register tools for an agent using dynamic discovery
   */
  private static autoRegisterTools(agentName: string, agent: any): void {
    const agentClass = agent.constructor as any;
    
    try {
      // Strategy 1: Check for getOpenAIFunctionSchema static method
      if (typeof agentClass.getOpenAIFunctionSchema === 'function') {
        const schema = agentClass.getOpenAIFunctionSchema();
        if (schema?.name) {
          this.toolToAgentMap.set(schema.name, agentName);
          // Auto-registered via getOpenAIFunctionSchema
        }
      }
      
      // Strategy 2: Check for getToolNames static method (if agents implement it)
      if (typeof agentClass.getToolNames === 'function') {
        const toolNames = agentClass.getToolNames();
        if (Array.isArray(toolNames)) {
          toolNames.forEach((toolName: string) => {
            this.toolToAgentMap.set(toolName, agentName);
            // Auto-registered via getToolNames
          });
        }
      }
      
      // Strategy 3: Convention-based registration for common patterns
      this.registerConventionalTools(agentName, agentClass);
      
    } catch (error) {
    }
  }

  /**
   * Register tools based on naming conventions
   */
  private static registerConventionalTools(agentName: string, agentClass: AgentClass): void {
    const conventionalMappings: Record<string, string[]> = {
      'emailAgent': ['manage_emails', 'send_email', 'search_emails', 'emailAgent'],
      'contactAgent': ['search_contacts', 'contactAgent'],
      'calendarAgent': ['manage_calendar', 'calendarAgent'], 
      'Think': ['Think'],
      'slackAgent': ['slack_operations', 'slackAgent']
    };
    
    const toolNames = conventionalMappings[agentName];
    if (toolNames) {
      toolNames.forEach(toolName => {
        // Only register if not already registered by other methods
        if (!this.toolToAgentMap.has(toolName)) {
          this.toolToAgentMap.set(toolName, agentName);
          // Auto-registered via convention
        }
      });
    }
  }

  /**
   * Get all tools registered for a specific agent
   */
  static getToolsForAgent(agentName: string): string[] {
    const tools: string[] = [];
    for (const [toolName, mappedAgentName] of this.toolToAgentMap) {
      if (mappedAgentName === agentName) {
        tools.push(toolName);
      }
    }
    return tools;
  }

  /**
   * Get all registered tool mappings
   */
  static getAllToolMappings(): Record<string, string> {
    return Object.fromEntries(this.toolToAgentMap);
  }

  /**
   * Get all registered agents
   */
  static getAllAgents(): any[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get only enabled agents
   */
  static getEnabledAgents(): any[] {
    return Array.from(this.agents.values()).filter(agent => agent.isEnabled());
  }
  
  /**
   * Get agent names
   */
  static getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }
  
  /**
   * Get enabled agent names
   */
  static getEnabledAgentNames(): string[] {
    return Array.from(this.agents.entries())
      .filter(([_, agent]) => agent.isEnabled())
      .map(([name, _]) => name);
  }
  
  /**
   * Check if an agent exists and is enabled
   */
  static hasAgent(name: string): boolean {
    const agent = this.agents.get(name);
    if (!agent) return false;
    return agent.isEnabled();
  }

  // ============================================================================
  // NATURAL LANGUAGE CAPABILITY DISCOVERY
  // ============================================================================

  /**
   * Get all agent capabilities for MasterAgent domain selection
   */
  static getAgentCapabilities(): Record<string, AgentCapabilities> {
    const capabilities: Record<string, AgentCapabilities> = {};

    for (const [name, agent] of this.agents) {
      if (agent && agent.isEnabled() && typeof agent.getCapabilityDescription === 'function') {
        try {
          capabilities[name] = agent.getCapabilityDescription();
        } catch (error) {
          logger.warn(`Failed to get capabilities for agent ${name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            operation: 'get_agent_capabilities'
          });
        }
      }
    }

    return capabilities;
  }

  /**
   * Check if an agent supports natural language processing
   */
  static supportsNaturalLanguage(agentName: string): boolean {
    const agent = this.getAgent(agentName);
    return !!(agent && typeof agent.processNaturalLanguageRequest === 'function');
  }

  /**
   * Get a list of all agents that support natural language processing
   */
  static getNaturalLanguageAgents(): string[] {
    const nlAgents: string[] = [];

    for (const [name, agent] of this.agents) {
      if (agent && agent.isEnabled() && typeof agent.processNaturalLanguageRequest === 'function') {
        nlAgents.push(name);
      }
    }

    return nlAgents;
  }

  /**
   * Execute an agent using natural language
   */
  static async executeAgentWithNaturalLanguage(
    agentName: string,
    request: string,
    context: {
      sessionId: string;
      userId?: string;
      accessToken?: string;
      slackContext?: any;
      correlationId?: string;
    }
  ): Promise<{
    success: boolean;
    response?: string;
    reasoning?: string;
    metadata?: any;
    error?: string;
  }> {
    const agent = this.getAgent(agentName);

    if (!agent) {
      return {
        success: false,
        error: `Agent ${agentName} not found or disabled`
      };
    }

    if (!this.supportsNaturalLanguage(agentName)) {
      return {
        success: false,
        error: `Agent ${agentName} does not support natural language processing`
      };
    }

    try {
      const result = await agent.processNaturalLanguageRequest(request, {
        sessionId: context.sessionId,
        userId: context.userId,
        accessToken: context.accessToken,
        slackContext: context.slackContext,
        correlationId: context.correlationId || `agent-${agentName}-${Date.now()}`,
        timestamp: new Date()
      });

      return {
        success: true,
        response: result.response,
        reasoning: result.reasoning,
        metadata: result.metadata
      };

    } catch (error) {
      logger.error(`Natural language execution failed for agent ${agentName}`, error as Error, {
        correlationId: context.correlationId,
        operation: 'natural_language_execution',
        agentName
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  /**
   * Find the best agent for a natural language request
   */
  static async findBestAgentForRequest(request: string): Promise<{
    agentName: string | null;
    confidence: number;
    reasoning: string;
  }> {
    const capabilities = this.getAgentCapabilities();
    const nlAgents = this.getNaturalLanguageAgents();

    if (nlAgents.length === 0) {
      return {
        agentName: null,
        confidence: 0,
        reasoning: 'No natural language agents available'
      };
    }

    // Use LLM to determine the best agent
    const openaiService = serviceManager.getService<OpenAIService>('openaiService');
    if (!openaiService) {
      return {
        agentName: null,
        confidence: 0,
        reasoning: 'OpenAI service not available for agent selection'
      };
    }

    // Build agent descriptions for LLM
    const agentDescriptions = nlAgents.map(agentName => {
      const caps = capabilities[agentName];
      if (!caps) return '';
      
      return `${caps.name}: ${caps.description || 'No description available'}
Capabilities: ${caps.capabilities?.join(', ') || 'No capabilities listed'}
Examples: ${caps.examples?.join(', ') || 'No examples provided'}
Domains: ${caps.domains?.join(', ') || 'No domains specified'}`;
    }).filter(desc => desc.length > 0);

    const prompt = `You are an AI agent selector. Your job is to determine which agent should handle a user request.

AVAILABLE AGENTS:
${agentDescriptions.join('\n\n')}

USER REQUEST: "${request}"

ANALYZE STEP-BY-STEP:
1. What does the user want to accomplish?
2. Which agent's capabilities best match this request?
3. What is your confidence level?

Return JSON:
{
  "reasoning": "Step-by-step analysis of why this agent was selected",
  "selectedAgent": "agent_name",
  "confidence": 0.95
}`;

    try {
      const response = await openaiService.generateStructuredData(
        request,
        prompt,
        {
          type: 'object',
          properties: {
            reasoning: { type: 'string' },
            selectedAgent: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['reasoning', 'selectedAgent', 'confidence']
        },
        { temperature: 0.3, maxTokens: 400 }
      ) as {
        reasoning: string;
        selectedAgent: string;
        confidence: number;
      };

      // Validate that the selected agent exists
      if (nlAgents.includes(response.selectedAgent)) {
        return {
          agentName: response.selectedAgent,
          confidence: response.confidence,
          reasoning: response.reasoning
        };
      } else {
        return {
          agentName: null,
          confidence: 0,
          reasoning: `Selected agent '${response.selectedAgent}' not found in available agents`
        };
      }

    } catch (error) {
      logger.error('LLM-based agent selection failed', { error, request });
      return {
        agentName: null,
        confidence: 0,
        reasoning: 'LLM-based agent selection failed'
      };
    }
  }

  /**
   * Simple similarity calculation for text matching
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ').filter(w => w.length > 2);
    const words2 = str2.split(' ').filter(w => w.length > 2);
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length, 1);
  }
  
  /**
   * Execute an agent by name with parameters
   */
  static async executeAgent(
    name: string, 
    parameters: Record<string, any>,
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<ToolResult> {
    const agent = this.getAgentByToolName(name);
    
    if (!agent) {
      const errorResult: ToolResult = {
        toolName: name,
        result: null,
        success: false,
        error: `Agent not found or disabled: ${name}`,
        executionTime: 0
      };
      
      // Log error for missing agent
      
      return errorResult;
    }
    
    try {
        
      
      // Add access token to parameters if provided
      const executionParameters = accessToken 
        ? { ...parameters, accessToken }
        : parameters;
      
      // Execute the framework AIAgent
      return await agent.execute(executionParameters, context);
      
    } catch (error) {
      const errorResult: ToolResult = {
        toolName: name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: 0
      };
      
      // Log error for execution failure
      
      return errorResult;
    }
  }

  /**
   * Generate OpenAI function definitions for all registered tools
   */


  /**
   * Get agent discovery metadata for AI planning
   */
  static async getAgentDiscoveryMetadata(): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    try {
      const { EmailAgent } = await import('../agents/email.agent');
      const { ContactAgent } = await import('../agents/contact.agent');
      const { CalendarAgent } = await import('../agents/calendar.agent');

      metadata.emailAgent = {
        schema: { name: 'emailAgent', description: 'Email management agent', parameters: {} },
        capabilities: EmailAgent.getCapabilities(),
        limitations: [],
        enabled: this.hasAgent('emailAgent'),
        draftType: 'email'
      };

      metadata.contactAgent = {
        schema: { name: 'contactAgent', description: 'Contact management agent', parameters: {} },
        capabilities: ContactAgent.getCapabilities(),
        limitations: [],
        enabled: this.hasAgent('contactAgent'),
        draftType: 'contact'
      };

      metadata.calendarAgent = {
        schema: { name: 'calendarAgent', description: 'Calendar management agent', parameters: {} },
        capabilities: CalendarAgent.getCapabilities(),
        limitations: [],
        enabled: this.hasAgent('calendarAgent'),
        draftType: 'calendar'
      };

      
      // Add slackAgent metadata
      const { SlackAgent } = await import('../agents/slack.agent');
      metadata.slackAgent = {
        schema: { name: 'slackAgent', description: 'Slack management agent', parameters: {} },
        capabilities: SlackAgent.getCapabilities(),
        limitations: [],
        enabled: this.hasAgent('slackAgent'),
        draftType: 'slack'
      };
      
    } catch (error) {
      
    }
    
    return metadata;
  }


  /**
   * Generate system prompts for all registered agents
   */
  static generateSystemPrompts(): string {
    const prompts: string[] = [];
    
    prompts.push('# Available Tools');
    
    for (const [name, metadata] of this.toolMetadata) {
      prompts.push(`- ${name}: ${metadata.description}`);
    }

    prompts.push('\n# Tool Usage Guidelines');
    prompts.push('- Analyze the user request to determine which tool(s) to use');
    prompts.push('- Some actions require multiple tools (e.g., contact lookup + email sending)');
    prompts.push('- Always call the "Think" tool at the end to verify correct steps were taken');
    
    return prompts.join('\n');
  }

  // Preview-era confirmation checks removed
  // Preview-era operation detection removed; agents handle their own operations

  /**
   * Check if a tool is critical
   */
  static isCriticalTool(toolName: string): boolean {
    const metadata = this.toolMetadata.get(toolName);
    return metadata?.isCritical || false;
  }
  
  /**
   * Initialize all core agents and their metadata
   */
  static initialize(): void {
    if (this.initialized) {
      
      return;
    }
    
    // Start cleanup process
    this.startCleanup();
    
    try {
      
      
      // Register core agents
      this.registerAgentClass('emailAgent', EmailAgent);
      this.registerAgentClass('contactAgent', ContactAgent);
      this.registerAgentClass('calendarAgent', CalendarAgent);
      this.registerAgentClass('slackAgent', SlackAgent);
      

      this.registerToolMetadata({
        name: 'emailAgent',
        description: 'Send, reply to, search, and manage emails using Gmail API',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The email request in natural language'
            },
            contacts: {
              type: 'array',
              description: 'Contact information if provided by contact agent',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string', nullable: true }
                }
              },
              nullable: true
            },
            contactResults: {
              type: 'array',
              description: 'Raw contact results from contact agent',
              items: { type: 'object' },
              nullable: true
            }
          },
          required: ['query']
        },
        requiresConfirmation: AGENT_CONFIG.email.requiresConfirmation,
        isCritical: AGENT_CONFIG.email.isCritical
      });

      this.registerToolMetadata({
        name: 'contactAgent',
        description: 'Search and manage contacts from Google Contacts and email history',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The contact search request in natural language'
            },
            operation: {
              type: 'string',
              description: 'The type of operation to perform',
              enum: ['search', 'create', 'update'],
              nullable: true
            }
          },
          required: ['query']
        },
        requiresConfirmation: AGENT_CONFIG.contact.requiresConfirmation,
        isCritical: AGENT_CONFIG.contact.isCritical
      });

      this.registerToolMetadata({
        name: 'calendarAgent',
        description: 'Create, update, and manage calendar events',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The calendar request in natural language'
            },
            title: {
              type: 'string',
              description: 'Event title',
              nullable: true
            },
            startTime: {
              type: 'string',
              description: 'Event start time in ISO format',
              nullable: true
            },
            endTime: {
              type: 'string',
              description: 'Event end time in ISO format',
              nullable: true
            },
            attendees: {
              type: 'array',
              description: 'List of attendee email addresses',
              items: { type: 'string' },
              nullable: true
            },
            description: {
              type: 'string',
              description: 'Event description',
              nullable: true
            }
          },
          required: ['query']
        },
        requiresConfirmation: AGENT_CONFIG.calendar.requiresConfirmation,
        isCritical: AGENT_CONFIG.calendar.isCritical
      });

      this.registerToolMetadata({
        name: 'slackAgent',
        description: 'Read Slack message history, detect drafts, and manage confirmation workflows',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The Slack operation request in natural language'
            },
            operation: {
              type: 'string',
              description: 'The type of operation to perform',
              enum: ['read_messages', 'read_thread', 'detect_drafts', 'manage_drafts', 'confirmation_handling'],
              nullable: true
            },
            channelId: {
              type: 'string',
              description: 'Specific channel ID to read messages from',
              nullable: true
            },
            threadTs: {
              type: 'string',
              description: 'Specific thread timestamp to read messages from',
              nullable: true
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to retrieve',
              nullable: true
            },
            includeReactions: {
              type: 'boolean',
              description: 'Whether to include message reactions',
              nullable: true
            },
            includeAttachments: {
              type: 'boolean',
              description: 'Whether to include message attachments',
              nullable: true
            }
          },
          required: ['query']
        },
        requiresConfirmation: false, // Read-only operations don't require confirmation
        isCritical: false
      });
      
      this.initialized = true;
      
      const stats = this.getStats();
      
    } catch (error) {
      
      throw new Error(`AgentFactory initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Reset the factory (useful for testing)
   */
  static reset(): void {
    this.agents.clear();
    this.toolMetadata.clear();
    this.toolToAgentMap.clear();
    this.initialized = false;
    this.stopCleanup();
    
    logger.debug('AgentFactory reset completed', {
      correlationId: `factory-reset-${Date.now()}`,
      operation: 'factory_reset'
    });
  }

  /**
   * Start periodic cleanup to prevent memory leaks
   */
  static startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    // Clean up every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 10 * 60 * 1000);

    logger.debug('AgentFactory cleanup started', {
      correlationId: `factory-cleanup-start-${Date.now()}`,
      operation: 'cleanup_start'
    });
  }

  /**
   * Stop periodic cleanup
   */
  static stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      
      logger.debug('AgentFactory cleanup stopped', {
        correlationId: `factory-cleanup-stop-${Date.now()}`,
        operation: 'cleanup_stop'
      });
    }
  }

  /**
   * Perform memory cleanup
   */
  private static performCleanup(): void {
    const now = Date.now();
    
    // Only cleanup every 10 minutes
    if (now - this.lastCleanup < 10 * 60 * 1000) {
      return;
    }

    this.lastCleanup = now;
    const statsBefore = this.getStats();
    
    // Clean up agents that might have been destroyed
    const agentsToRemove: string[] = [];
    for (const [name, agent] of this.agents.entries()) {
      if (!agent || typeof agent.destroy === 'function') {
        try {
          // Check if agent is still valid
          if (agent && typeof agent.isEnabled === 'function' && !agent.isEnabled()) {
            agentsToRemove.push(name);
          }
        } catch (error) {
          // Agent is likely destroyed, mark for removal
          agentsToRemove.push(name);
        }
      }
    }

    // Remove invalid agents
    for (const name of agentsToRemove) {
      this.agents.delete(name);
      // Also clean up related tool metadata
      const tools = this.getToolsForAgent(name);
      for (const toolName of tools) {
        this.toolMetadata.delete(toolName);
        this.toolToAgentMap.delete(toolName);
      }
    }

    const statsAfter = this.getStats();
    
    if (agentsToRemove.length > 0) {
      logger.debug('AgentFactory cleanup completed', {
        correlationId: `factory-cleanup-${Date.now()}`,
        operation: 'cleanup_completed',
        metadata: {
          removedAgents: agentsToRemove.length,
          agentsBefore: statsBefore.totalAgents,
          agentsAfter: statsAfter.totalAgents,
          toolsBefore: statsBefore.totalTools,
          toolsAfter: statsAfter.totalTools
        }
      });
    }
  }
  
  /**
   * Get factory statistics
   */
  static getStats(): {
    totalAgents: number;
    enabledAgents: number;
    disabledAgents: number;
    agentNames: string[];
    enabledAgentNames: string[];
    totalTools: number;
    criticalTools: number;
    confirmationTools: number;
    toolNames: string[];
    toolMappings: Record<string, string>;
    registeredToolCount: number;
  } {
    const allAgents = this.getAllAgents();
    const enabledAgents = this.getEnabledAgents();
    const tools = Array.from(this.toolMetadata.values());
    
    return {
      totalAgents: allAgents.length,
      enabledAgents: enabledAgents.length,
      disabledAgents: allAgents.length - enabledAgents.length,
      agentNames: this.getAgentNames(),
      enabledAgentNames: this.getEnabledAgentNames(),
      totalTools: tools.length,
      criticalTools: tools.filter(t => t.isCritical).length,
      confirmationTools: tools.filter(t => t.requiresConfirmation).length,
      toolNames: tools.map(t => t.name),
      toolMappings: this.getAllToolMappings(),
      registeredToolCount: this.toolToAgentMap.size
    };
  }
  
  /**
   * Enable an agent
   */
  static enableAgent(name: string): boolean {
    const agent = this.agents.get(name);
    if (!agent) {
      
      return false;
    }
    
    // Note: any doesn't have enable/disable methods in current implementation
    // This would require extending the AIAgent class to support dynamic enable/disable
    
    return true;
  }
  
  /**
   * Disable an agent
   */
  static disableAgent(name: string): boolean {
    const agent = this.agents.get(name);
    if (!agent) {
      
      return false;
    }
    
    // Note: any doesn't have enable/disable methods in current implementation
    // This would require extending the AIAgent class to support dynamic enable/disable
    
    return true;
  }
  
  /**
   * Get agent configuration
   */
  static getAgentConfig(name: string): AgentConfig | undefined {
    const agent = this.getAgentByToolName(name);
    if (agent) {
      return agent.getConfig();
    }
    return undefined;
  }
  
  /**
   * Validate all registered agents
   */
  static validateAgents(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    for (const [name, agent] of this.agents.entries()) {
      try {
        const config = agent.getConfig();
        
        // Validate agent configuration
        if (!config.name) {
          errors.push(`Agent ${name} has no name in config`);
        }
        
        if (!config.description) {
          warnings.push(`Agent ${name} has no description`);
        }
        
        if (config.timeout && config.timeout < 1000) {
          warnings.push(`Agent ${name} has very short timeout: ${config.timeout}ms`);
        }
        
        // Check if agent is properly configured
        if (!agent.isEnabled()) {
          warnings.push(`Agent ${name} is disabled`);
        }
        
      } catch (error) {
        errors.push(`Agent ${name} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Get detailed agent information for debugging
   */
  static getAgentInfo(name: string): AgentConfig | null {
    const agent = this.agents.get(name);
    if (!agent) {
      return null;
    }
    
    return {
      name,
      description: agent.getConfig().description,
      enabled: agent.isEnabled(),
      timeout: agent.getTimeout(),
      retryCount: agent.getRetries()
    };
  }
  
  /**
   * Get all agent information for debugging
   */
  static getAllAgentInfo(): Record<string, any> {
    const info: Record<string, any> = {};
    
    for (const name of this.getAgentNames()) {
      info[name] = this.getAgentInfo(name);
    }
    
    return info;
  }
}

/**
 * Convenience function to initialize the factory
 */
export const initializeAgentFactory = (): void => {
  AgentFactory.initialize();
}

/**
 * Convenience function to get an agent
 */
export const getAgent = (name: string): any | undefined => {
  return AgentFactory.getAgent(name);
}

/**
 * Convenience function to execute an agent
 */
export async function executeAgent(
  name: string, 
  parameters: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  return AgentFactory.executeAgent(name, parameters, context);
}

/**
 * Export the factory class as default
 */
export default AgentFactory;
