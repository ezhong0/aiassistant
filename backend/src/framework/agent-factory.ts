import { AIAgent } from './ai-agent';
import { ToolExecutionContext, ToolResult, AgentConfig } from '../types/tools';
import { ToolMetadata } from '../types/agents/agent.types';
import { EmailAgent } from '../agents/email.agent';
import { CalendarAgent } from '../agents/calendar.agent';
import { ContactAgent } from '../agents/contact.agent';
import { ThinkAgent } from '../agents/think.agent';
import { SlackAgent } from '../agents/slack.agent';
import { AGENT_CONFIG } from '../config/agent-config';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

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
  private static agents = new Map<string, AIAgent>();
  private static toolMetadata = new Map<string, ToolMetadata>();
  private static initialized = false;
  
  /**
   * Register a single agent instance with automatic tool discovery
   */
  static registerAgent(name: string, agent: AIAgent): void {
    if (this.agents.has(name)) {
      EnhancedLogger.warn(`Agent ${name} is already registered, replacing with new instance`, {
        correlationId: `agent-register-${Date.now()}`,
        operation: 'agent_registration_warning',
        metadata: { agentName: name }
      });
    }
    
    this.agents.set(name, agent);
    
    // Auto-register agent's tools using dynamic discovery
    this.autoRegisterTools(name, agent);
    
    EnhancedLogger.debug(`Framework agent registered: ${name}`, {
      correlationId: `agent-register-${Date.now()}`,
      operation: 'agent_registration_success',
      metadata: {
        agentName: name,
        enabled: agent.isEnabled(),
        toolCount: this.getToolsForAgent(name).length
      }
    });
  }
  
  /**
   * Register an agent class with configuration
   */
  static registerAgentClass<TParams, TResult>(
    name: string, 
    AgentClass: new () => AIAgent<TParams, TResult>
  ): void {
    try {
      const agent = new AgentClass();
      this.registerAgent(name, agent);
    } catch (error) {
      EnhancedLogger.error(`Failed to register agent class ${name}`, error as Error, {
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
  static getAgent(name: string): AIAgent | undefined {
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
  static getAgentByToolName(toolName: string): AIAgent | undefined {
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
  private static autoRegisterTools(agentName: string, agent: AIAgent): void {
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
  static getAllAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get only enabled agents
   */
  static getEnabledAgents(): AIAgent[] {
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
  static generateOpenAIFunctions(): OpenAIFunctionSchema[] {
    return Array.from(this.toolMetadata.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Generate enhanced OpenAI function definitions with agent schemas
   */
  static async generateEnhancedOpenAIFunctions(): Promise<OpenAIFunctionSchema[]> {
    const functions: OpenAIFunctionSchema[] = [];

    // Get agent schemas from agent classes
    try {
      const { EmailAgent } = await import('../agents/email.agent');
      const { ContactAgent } = await import('../agents/contact.agent');
      const { CalendarAgent } = await import('../agents/calendar.agent');
      
      // Add agent-specific function schemas
      functions.push(EmailAgent.getOpenAIFunctionSchema());
      functions.push(ContactAgent.getOpenAIFunctionSchema() as any);
      functions.push(CalendarAgent.getOpenAIFunctionSchema());
      
      // Add other tools from metadata
      const otherTools = Array.from(this.toolMetadata.values())
        .filter(tool => !['emailAgent', 'contactAgent', 'calendarAgent'].includes(tool.name))
        .map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
      
      functions.push(...otherTools);
      
    } catch (error) {
      
      // Fallback to basic functions
      return this.generateOpenAIFunctions();
    }
    
    return functions;
  }

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
        schema: EmailAgent.getOpenAIFunctionSchema(),
        capabilities: EmailAgent.getCapabilities(),
        limitations: EmailAgent.getLimitations(),
        enabled: this.hasAgent('emailAgent')
      };
      
      metadata.contactAgent = {
        schema: ContactAgent.getOpenAIFunctionSchema(),
        capabilities: ContactAgent.getCapabilities(),
        limitations: ContactAgent.getLimitations(),
        enabled: this.hasAgent('contactAgent')
      };
      
      metadata.calendarAgent = {
        schema: CalendarAgent.getOpenAIFunctionSchema(),
        capabilities: CalendarAgent.getCapabilities(),
        limitations: CalendarAgent.getLimitations(),
        enabled: this.hasAgent('calendarAgent')
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

  /**
   * Check if a tool requires confirmation at the agent level
   * This should be used in combination with operation-specific logic
   */
  static toolNeedsConfirmation(toolName: string): boolean {
    const metadata = this.toolMetadata.get(toolName);
    return metadata?.requiresConfirmation || false;
  }

  /**
   * Check if a tool requires confirmation based on operation using AI
   * This is the preferred method for determining confirmation needs
   */
  static async toolNeedsConfirmationForOperation(toolName: string, operation: string): Promise<boolean> {
    // Import AGENT_HELPERS dynamically to avoid circular imports
    const { AGENT_HELPERS } = await import('../config/agent-config');
    
    // Map AgentFactory tool names to AGENT_CONFIG names
    const toolNameMapping: Record<string, string> = {
      'emailAgent': 'email',
      'manage_emails': 'email',
      'contactAgent': 'contact',
      'search_contacts': 'contact',
      'calendarAgent': 'calendar',
      'manage_calendar': 'calendar',
      'Think': 'think',
      'slackAgent': 'slack',
      'read_slack_messages': 'slack'
    };
    
    const configAgentName = toolNameMapping[toolName] || toolName;
    return await AGENT_HELPERS.operationRequiresConfirmation(configAgentName as any, operation);
  }

  /**
   * Detect operation from tool parameters using AI classification
   * Maps AgentFactory tool names to AGENT_CONFIG names
   */
  static async detectOperationFromParameters(toolName: string, parameters: Record<string, any>): Promise<string> {
    const { AGENT_HELPERS } = await import('../config/agent-config');
    
    // Map AgentFactory tool names to AGENT_CONFIG names
    const toolNameMapping: Record<string, string> = {
      'emailAgent': 'email',
      'manage_emails': 'email',
      'contactAgent': 'contact',
      'search_contacts': 'contact',
      'calendarAgent': 'calendar',
      'manage_calendar': 'calendar',
      'Think': 'think',
      'slackAgent': 'slack',
      'read_slack_messages': 'slack'
    };
    
    const configAgentName = toolNameMapping[toolName] || toolName;
    const query = parameters.query || parameters.query || '';
    
    if (typeof query === 'string') {
      return await AGENT_HELPERS.detectOperation(configAgentName as any, query);
    }
    
    // Check for explicit action parameter (used by calendar agent)
    if (parameters.action) {
      return parameters.action;
    }
    
    return 'unknown';
  }

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
    
    try {
      
      
      // Register core agents
      this.registerAgentClass('emailAgent', EmailAgent);
      this.registerAgentClass('contactAgent', ContactAgent);
      this.registerAgentClass('Think', ThinkAgent);
      this.registerAgentClass('calendarAgent', CalendarAgent);
      this.registerAgentClass('slackAgent', SlackAgent);
      
      // Register tool metadata for all agents
      this.registerToolMetadata({
        name: 'Think',
        description: 'Analyze and reason about user requests, verify correct actions were taken',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The query or request to analyze and think about'
            },
            context: {
              type: 'string',
              description: 'Additional context for analysis',
              nullable: true
            },
            previousActions: {
              type: 'array',
              description: 'Previous tool calls that were executed',
              items: { type: 'object' },
              nullable: true
            }
          },
          required: ['query']
        },
        requiresConfirmation: AGENT_CONFIG.think.requiresConfirmation,
        isCritical: AGENT_CONFIG.think.isCritical
      });

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
    
    // Note: AIAgent doesn't have enable/disable methods in current implementation
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
    
    // Note: AIAgent doesn't have enable/disable methods in current implementation
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
export const getAgent = (name: string): AIAgent | undefined => {
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
