import { BaseAgent } from './base-agent';
import { ToolExecutionContext, ToolResult, AgentConfig } from '../types/tools';
import { EmailAgent } from '../agents/email.agent';
import { ContactAgent } from '../agents/contact.agent';
import logger from '../utils/logger';

/**
 * Agent factory for creating and managing agent instances
 * Provides centralized agent registration, discovery, and lifecycle management
 */
export class AgentFactory {
  private static agents = new Map<string, BaseAgent>();
  private static initialized = false;
  
  /**
   * Register a single agent instance
   */
  static registerAgent(name: string, agent: BaseAgent): void {
    if (this.agents.has(name)) {
      logger.warn(`Agent ${name} is already registered, replacing with new instance`);
    }
    
    this.agents.set(name, agent);
    logger.info(`Agent registered: ${name}`, {
      config: agent.getConfig(),
      enabled: agent.isEnabled()
    });
  }
  
  /**
   * Register an agent class with configuration
   */
  static registerAgentClass<TParams, TResult>(
    name: string, 
    AgentClass: new () => BaseAgent<TParams, TResult>
  ): void {
    try {
      const agent = new AgentClass();
      this.registerAgent(name, agent);
    } catch (error) {
      logger.error(`Failed to register agent class ${name}:`, error);
      throw new Error(`Agent registration failed for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get an agent by name
   */
  static getAgent(name: string): BaseAgent | undefined {
    const agent = this.agents.get(name);
    
    if (!agent) {
      logger.warn(`Agent not found: ${name}`, {
        availableAgents: Array.from(this.agents.keys())
      });
      return undefined;
    }
    
    if (!agent.isEnabled()) {
      logger.warn(`Agent is disabled: ${name}`);
      return undefined;
    }
    
    return agent;
  }
  
  /**
   * Get all registered agents
   */
  static getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get only enabled agents
   */
  static getEnabledAgents(): BaseAgent[] {
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
    return agent ? agent.isEnabled() : false;
  }
  
  /**
   * Execute an agent by name with parameters
   */
  static async executeAgent(
    name: string, 
    parameters: any, 
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const agent = this.getAgent(name);
    
    if (!agent) {
      const errorResult: ToolResult = {
        toolName: name,
        result: null,
        success: false,
        error: `Agent not found or disabled: ${name}`,
        executionTime: 0
      };
      
      logger.error('Agent execution failed - agent not found', {
        agentName: name,
        availableAgents: this.getEnabledAgentNames()
      });
      
      return errorResult;
    }
    
    try {
      logger.info(`Executing agent: ${name}`, {
        sessionId: context.sessionId,
        userId: context.userId
      });
      
      return await agent.execute(parameters, context);
      
    } catch (error) {
      const errorResult: ToolResult = {
        toolName: name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: 0
      };
      
      logger.error(`Agent execution failed: ${name}`, {
        error: error instanceof Error ? error.message : error,
        sessionId: context.sessionId
      });
      
      return errorResult;
    }
  }
  
  /**
   * Initialize all core agents
   */
  static initialize(): void {
    if (this.initialized) {
      logger.warn('AgentFactory already initialized, skipping');
      return;
    }
    
    try {
      logger.info('Initializing AgentFactory with core agents...');
      
      // Register core agents
      this.registerAgentClass('emailAgent', EmailAgent);
      this.registerAgentClass('contactAgent', ContactAgent);
      
      // Future agents can be added here:
      // this.registerAgentClass('calendarAgent', CalendarAgent);
      // this.registerAgentClass('contentCreator', ContentCreatorAgent);
      // this.registerAgentClass('tavilyAgent', TavilyAgent);
      // this.registerAgentClass('thinkAgent', ThinkAgent);
      
      this.initialized = true;
      
      const stats = this.getStats();
      logger.info('AgentFactory initialized successfully', stats);
      
    } catch (error) {
      logger.error('Failed to initialize AgentFactory:', error);
      throw new Error(`AgentFactory initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Reset the factory (useful for testing)
   */
  static reset(): void {
    this.agents.clear();
    this.initialized = false;
    logger.info('AgentFactory reset');
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
  } {
    const allAgents = this.getAllAgents();
    const enabledAgents = this.getEnabledAgents();
    
    return {
      totalAgents: allAgents.length,
      enabledAgents: enabledAgents.length,
      disabledAgents: allAgents.length - enabledAgents.length,
      agentNames: this.getAgentNames(),
      enabledAgentNames: this.getEnabledAgentNames()
    };
  }
  
  /**
   * Enable an agent
   */
  static enableAgent(name: string): boolean {
    const agent = this.agents.get(name);
    if (!agent) {
      logger.warn(`Cannot enable agent - not found: ${name}`);
      return false;
    }
    
    // Note: BaseAgent doesn't have enable/disable methods in current implementation
    // This would require extending the BaseAgent class to support dynamic enable/disable
    logger.info(`Agent enabled: ${name}`);
    return true;
  }
  
  /**
   * Disable an agent
   */
  static disableAgent(name: string): boolean {
    const agent = this.agents.get(name);
    if (!agent) {
      logger.warn(`Cannot disable agent - not found: ${name}`);
      return false;
    }
    
    // Note: BaseAgent doesn't have enable/disable methods in current implementation
    // This would require extending the BaseAgent class to support dynamic enable/disable
    logger.info(`Agent disabled: ${name}`);
    return true;
  }
  
  /**
   * Get agent configuration
   */
  static getAgentConfig(name: string): AgentConfig | undefined {
    const agent = this.getAgent(name);
    return agent?.getConfig();
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
  static getAgentInfo(name: string): any {
    const agent = this.agents.get(name);
    if (!agent) {
      return null;
    }
    
    return {
      name,
      config: agent.getConfig(),
      enabled: agent.isEnabled(),
      timeout: agent.getTimeout(),
      retries: agent.getRetries(),
      className: agent.constructor.name
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
export function initializeAgentFactory(): void {
  AgentFactory.initialize();
}

/**
 * Convenience function to get an agent
 */
export function getAgent(name: string): BaseAgent | undefined {
  return AgentFactory.getAgent(name);
}

/**
 * Convenience function to execute an agent
 */
export async function executeAgent(
  name: string, 
  parameters: any, 
  context: ToolExecutionContext
): Promise<ToolResult> {
  return AgentFactory.executeAgent(name, parameters, context);
}

/**
 * Export the factory class as default
 */
export default AgentFactory;
