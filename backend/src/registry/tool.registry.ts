import logger from '../utils/logger';
import { IAgent, ToolMetadata, ToolRegistryConfig } from '../types/agent.types';
import { ToolCall, ToolResult, ToolExecutionContext } from '../types/tools';
import { BaseAgent } from '../framework/base-agent';
import { AgentFactory } from '../framework/agent-factory';

/**
 * Centralized tool registry that manages all agents and their metadata
 */
export class ToolRegistry {
  private tools: Map<string, ToolMetadata> = new Map();
  private agents: Map<string, IAgent> = new Map();
  private config: ToolRegistryConfig;

  constructor(config: ToolRegistryConfig = { enableOpenAI: true, enableFallback: true }) {
    this.config = config;
    logger.info('ToolRegistry initialized', { config });
  }

  /**
   * Register a tool/agent with the registry
   */
  registerTool(metadata: ToolMetadata): void {
    try {
      // For new BaseAgent framework, tools are registered via AgentFactory
      // Legacy tools with agentClass can still be registered here
      if (metadata.agentClass) {
        const agent = new metadata.agentClass();
        
        // Validate agent implements interface correctly
        this.validateAgent(agent);
        
        // Store metadata and agent
        this.tools.set(metadata.name, metadata);
        this.agents.set(metadata.name, agent);
        
        logger.info(`Legacy tool registered: ${metadata.name}`, {
          keywords: metadata.keywords,
          requiresConfirmation: metadata.requiresConfirmation,
          isCritical: metadata.isCritical
        });
      } else {
        // Store only metadata for new BaseAgent framework tools
        this.tools.set(metadata.name, metadata);
        
        logger.info(`Tool metadata registered: ${metadata.name} (BaseAgent framework)`, {
          keywords: metadata.keywords,
          requiresConfirmation: metadata.requiresConfirmation,
          isCritical: metadata.isCritical
        });
      }
    } catch (error) {
      logger.error(`Failed to register tool: ${metadata.name}`, error);
      throw error;
    }
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool metadata by name
   */
  getToolMetadata(name: string): ToolMetadata | undefined {
    return this.tools.get(name);
  }

  /**
   * Get agent instance by name
   */
  getAgent(name: string): IAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Generate OpenAI function definitions for all registered tools
   */
  generateOpenAIFunctions(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Find tools that match the given input using keywords
   */
  findMatchingTools(input: string): ToolMetadata[] {
    const lowerInput = input.toLowerCase();
    const matches: { tool: ToolMetadata; score: number }[] = [];

    for (const tool of this.tools.values()) {
      let score = 0;
      
      // Check keyword matches
      for (const keyword of tool.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          score += 1;
          // Exact word match gets higher score
          const words = lowerInput.split(/\s+/);
          if (words.includes(keyword.toLowerCase())) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        matches.push({ tool, score });
      }
    }

    // Sort by score (highest first) and return tools
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxSuggestions || 3)
      .map(match => match.tool);
  }

  /**
   * Execute a tool by name - delegated to AgentFactory for BaseAgent instances
   */
  async executeTool(
    toolCall: ToolCall,
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<ToolResult> {
    // First try AgentFactory for BaseAgent instances
    if (AgentFactory.hasAgent(toolCall.name)) {
      // Prepare parameters with access token if needed
      const params = accessToken ? { ...toolCall.parameters, accessToken } : toolCall.parameters;
      return await AgentFactory.executeAgent(toolCall.name, params, context);
    }
    
    // Fallback to legacy agent execution for non-BaseAgent instances
    const startTime = Date.now();
    
    try {
      const agent = this.agents.get(toolCall.name);
      if (!agent) {
        throw new Error(`Tool not found: ${toolCall.name}`);
      }

      // Validate parameters
      const validation = agent.validateParameters(toolCall.parameters);
      if (!validation.valid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      logger.info(`Executing legacy tool: ${toolCall.name}`, {
        toolName: toolCall.name,
        sessionId: context.sessionId
      });

      // Execute the agent
      const result = await agent.execute(toolCall.parameters, context, accessToken);
      
      const executionTime = Date.now() - startTime;

      // Check if execution was successful
      let success = true;
      let error: string | undefined;
      
      if (result && typeof result === 'object' && 'success' in result) {
        success = result.success;
        if (!success && result.error) {
          error = result.error;
        }
      }

      const toolResult: ToolResult = {
        toolName: toolCall.name,
        result,
        success,
        error,
        executionTime
      };

      logger.info(`Legacy tool execution completed: ${toolCall.name}`, {
        success,
        executionTime,
        hasError: !!error
      });

      return toolResult;

    } catch (err) {
      const executionTime = Date.now() - startTime;
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      
      logger.error(`Tool execution failed: ${toolCall.name}`, {
        error,
        executionTime,
        sessionId: context.sessionId
      });

      return {
        toolName: toolCall.name,
        result: null,
        success: false,
        error,
        executionTime
      };
    }
  }

  /**
   * Generate preview for a tool execution
   */
  async generatePreview(
    toolCall: ToolCall,
    accessToken?: string
  ): Promise<any> {
    const agent = this.agents.get(toolCall.name);
    if (!agent) {
      throw new Error(`Tool not found: ${toolCall.name}`);
    }

    const metadata = this.tools.get(toolCall.name);
    if (!metadata?.requiresConfirmation) {
      throw new Error(`Tool ${toolCall.name} does not support preview`);
    }

    if (!agent.generatePreview) {
      // Use default preview if agent doesn't implement custom preview
      return {
        success: true,
        message: `Preview for ${toolCall.name}: ${toolCall.parameters.query || 'action'}`,
        actionId: `preview-${Date.now()}`,
        type: toolCall.name,
        parameters: toolCall.parameters,
        awaitingConfirmation: true,
        confirmationPrompt: `I'm about to execute ${toolCall.name}. Would you like me to proceed?`
      };
    }

    return await agent.generatePreview(toolCall.parameters, accessToken);
  }

  /**
   * Check if a tool requires confirmation
   */
  toolNeedsConfirmation(toolName: string): boolean {
    const metadata = this.tools.get(toolName);
    return metadata?.requiresConfirmation || false;
  }

  /**
   * Check if a tool is critical
   */
  isCriticalTool(toolName: string): boolean {
    const metadata = this.tools.get(toolName);
    return metadata?.isCritical || false;
  }

  /**
   * Get system prompts for all registered agents
   */
  generateSystemPrompts(): string {
    const prompts: string[] = [];
    
    prompts.push('# Available Tools');
    
    for (const [name, metadata] of this.tools) {
      prompts.push(`- ${name}: ${metadata.description}`);
    }

    prompts.push('\n# Tool Usage Guidelines');
    prompts.push('- Analyze the user request to determine which tool(s) to use');
    prompts.push('- Some actions require multiple tools (e.g., contact lookup + email sending)');
    prompts.push('- Always call the "Think" tool at the end to verify correct steps were taken');
    
    return prompts.join('\n');
  }

  /**
   * Validate that an agent properly implements the IAgent interface
   */
  private validateAgent(agent: IAgent): void {
    const requiredMethods = ['execute', 'validateParameters'];
    const requiredProperties = ['name', 'description', 'systemPrompt', 'keywords', 'requiresConfirmation', 'isCritical'];

    for (const method of requiredMethods) {
      if (typeof (agent as any)[method] !== 'function') {
        throw new Error(`Agent must implement method: ${method}`);
      }
    }

    for (const prop of requiredProperties) {
      if ((agent as any)[prop] === undefined) {
        throw new Error(`Agent must have property: ${prop}`);
      }
    }
  }

  /**
   * Clear all registered tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.agents.clear();
    logger.info('ToolRegistry cleared');
  }

  /**
   * Initialize AgentFactory with agents from this registry
   */
  initializeAgentFactory(): void {
    logger.info('Initializing AgentFactory from ToolRegistry...');
    
    // Initialize AgentFactory first
    AgentFactory.initialize();
    
    // Add any additional agents from this registry that aren't in AgentFactory
    for (const [name, agent] of this.agents) {
      if (!AgentFactory.hasAgent(name)) {
        if (agent instanceof BaseAgent) {
          AgentFactory.registerAgent(name, agent);
          logger.info(`Migrated agent to AgentFactory: ${name}`);
        } else {
          logger.warn(`Legacy agent not migrated to AgentFactory: ${name} (not BaseAgent instance)`);
        }
      }
    }
    
    const factoryStats = AgentFactory.getStats();
    const registryStats = this.getStats();
    
    logger.info('AgentFactory initialization from ToolRegistry completed', {
      factoryAgents: factoryStats.enabledAgents,
      registryTools: registryStats.totalTools,
      migratedAgents: factoryStats.enabledAgentNames
    });
  }
  
  /**
   * Get combined statistics from both registry and factory
   */
  getCombinedStats(): {
    registry: {
      totalTools: number;
      criticalTools: number;
      confirmationTools: number;
      toolNames: string[];
    };
    factory: {
      totalAgents: number;
      enabledAgents: number;
      disabledAgents: number;
      agentNames: string[];
      enabledAgentNames: string[];
    };
    totalAvailable: number;
  } {
    const registryStats = this.getStats();
    const factoryStats = AgentFactory.getStats();
    
    return {
      registry: registryStats,
      factory: factoryStats,
      totalAvailable: new Set([...registryStats.toolNames, ...factoryStats.agentNames]).size
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    criticalTools: number;
    confirmationTools: number;
    toolNames: string[];
  } {
    const tools = Array.from(this.tools.values());
    
    return {
      totalTools: tools.length,
      criticalTools: tools.filter(t => t.isCritical).length,
      confirmationTools: tools.filter(t => t.requiresConfirmation).length,
      toolNames: tools.map(t => t.name)
    };
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();