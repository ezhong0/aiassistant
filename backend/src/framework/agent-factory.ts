/**
 * AgentFactory - Elegant SubAgent Management
 * 
 * Simplified, type-safe agent registry focused on:
 * - Natural language processing
 * - Capability discovery  
 * - Clean registration
 * - BaseSubAgent architecture
 */

import logger from '../utils/logger';
import { BaseSubAgent, AgentExecutionContext, SubAgentResponse, AgentCapabilities } from './base-subagent';

/**
 * Agent Registry Entry
 */
interface AgentRegistration {
  name: string;
  instance: BaseSubAgent;
  enabled: boolean;
  registeredAt: Date;
}

/**
 * Natural Language Execution Result
 */
export interface NaturalLanguageExecutionResult {
  success: boolean;
  response?: string;
  reasoning?: string;
  metadata?: any;
  error?: string;
  executionTime?: number;
}

/**
 * Elegant AgentFactory for BaseSubAgent management
 */
export class AgentFactory {
  private static agents = new Map<string, AgentRegistration>();
  private static initialized = false;

  // ============================================================================
  // CORE REGISTRATION
  // ============================================================================

  /**
   * Register a SubAgent instance
   */
  static registerAgent(name: string, agent: BaseSubAgent): void {
    if (this.agents.has(name)) {
      logger.warn(`Agent ${name} is already registered, replacing with new instance`, {
        correlationId: `agent-register-${Date.now()}`,
        operation: 'agent_registration_warning',
        metadata: { agentName: name }
      });
    }

    const registration: AgentRegistration = {
      name,
      instance: agent,
      enabled: agent.isEnabled(),
      registeredAt: new Date()
    };

    this.agents.set(name, registration);

    logger.info(`SubAgent registered: ${name}`, {
      correlationId: `agent-register-${Date.now()}`,
      operation: 'agent_registration_success',
      metadata: {
        agentName: name,
        enabled: registration.enabled,
        capabilities: agent.getCapabilityDescription().operations.length
      }
    });
  }

  /**
   * Register a SubAgent class
   */
  static registerAgentClass<T extends BaseSubAgent>(
    name: string,
    AgentClass: new () => T
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

  // ============================================================================
  // AGENT ACCESS
  // ============================================================================

  /**
   * Get an agent by name
   */
  static getAgent(name: string): BaseSubAgent | undefined {
    const registration = this.agents.get(name);
    if (!registration || !registration.enabled) {
      return undefined;
    }
    return registration.instance;
  }

  /**
   * Check if an agent exists and is enabled
   */
  static hasAgent(name: string): boolean {
    const registration = this.agents.get(name);
    return !!(registration && registration.enabled);
  }

  /**
   * Get all enabled agents
   */
  static getEnabledAgents(): BaseSubAgent[] {
    return Array.from(this.agents.values())
      .filter(reg => reg.enabled)
      .map(reg => reg.instance);
  }

  /**
   * Get all enabled agent names
   */
  static getEnabledAgentNames(): string[] {
    return Array.from(this.agents.entries())
      .filter(([_, reg]) => reg.enabled)
      .map(([name, _]) => name);
  }

  // ============================================================================
  // NATURAL LANGUAGE PROCESSING
  // ============================================================================

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
  ): Promise<NaturalLanguageExecutionResult> {
    const startTime = Date.now();
    const agent = this.getAgent(agentName);

    if (!agent) {
      return {
        success: false,
        error: `Agent ${agentName} not found or disabled`,
        executionTime: Date.now() - startTime
      };
    }

    try {
      const executionContext: AgentExecutionContext = {
        sessionId: context.sessionId,
        userId: context.userId,
        accessToken: context.accessToken,
        slackContext: context.slackContext,
        correlationId: context.correlationId || `agent-${agentName}-${Date.now()}`,
        timestamp: new Date()
      };

      const result: SubAgentResponse = await agent.processNaturalLanguageRequest(request, executionContext);

      logger.info(`Agent ${agentName} executed successfully`, {
        correlationId: executionContext.correlationId,
        operation: 'natural_language_execution_success',
        agentName,
        success: result.success,
        executionTime: Date.now() - startTime
      });

      return {
        success: result.success,
        response: result.message,
        metadata: result.metadata,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Natural language execution failed for agent ${agentName}`, error as Error, {
        correlationId: context.correlationId,
        operation: 'natural_language_execution_error',
        agentName,
        executionTime: Date.now() - startTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: Date.now() - startTime
      };
    }
  }

  // ============================================================================
  // CAPABILITY DISCOVERY
  // ============================================================================

  /**
   * Get all agent capabilities for MasterAgent domain selection
   */
  static getAgentCapabilities(): Record<string, AgentCapabilities> {
    const capabilities: Record<string, AgentCapabilities> = {};

    for (const [name, registration] of this.agents) {
      if (registration.enabled) {
        try {
          capabilities[name] = registration.instance.getCapabilityDescription();
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
   * Find agents that can handle a specific type of request
   */
  static findCapableAgents(requestKeywords: string[]): string[] {
    const capableAgents: string[] = [];
    const capabilities = this.getAgentCapabilities();

    for (const [agentName, agentCaps] of Object.entries(capabilities)) {
      // Simple keyword matching in operations and examples
      const searchText = [
        ...agentCaps.operations,
        ...(agentCaps.examples || []),
        agentCaps.description
      ].join(' ').toLowerCase();

      const hasMatchingKeywords = requestKeywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );

      if (hasMatchingKeywords) {
        capableAgents.push(agentName);
      }
    }

    return capableAgents;
  }

  // ============================================================================
  // INITIALIZATION & MANAGEMENT
  // ============================================================================

  /**
   * Initialize all core agents
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('AgentFactory already initialized', {
        correlationId: 'factory-init-skip',
        operation: 'factory_initialization_skip'
      });
      return;
    }

    try {
      // Import and register all SubAgents
      const [
        { CalendarAgent },
        { EmailAgent },
        { ContactAgent },
        { SlackAgent }
      ] = await Promise.all([
        import('../agents/calendar.agent'),
        import('../agents/email.agent'),
        import('../agents/contact.agent'),
        import('../agents/slack.agent')
      ]);

      // Register all core SubAgents
      this.registerAgentClass('calendarAgent', CalendarAgent);
      this.registerAgentClass('emailAgent', EmailAgent);
      this.registerAgentClass('contactAgent', ContactAgent);
      this.registerAgentClass('slackAgent', SlackAgent);

      this.initialized = true;

      const stats = this.getStats();
      logger.info('AgentFactory initialization completed', {
        correlationId: 'factory-init-success',
        operation: 'factory_initialization_success',
        metadata: stats
      });

      // Log capabilities for debugging
      const capabilities = this.getAgentCapabilities();
      logger.debug('Agent capabilities registered', {
        correlationId: 'factory-init-capabilities',
        operation: 'capabilities_summary',
        metadata: {
          agents: Object.keys(capabilities),
          totalOperations: Object.values(capabilities).reduce((total, cap) => total + cap.operations.length, 0)
        }
      });

    } catch (error) {
      logger.error('AgentFactory initialization failed', error as Error, {
        correlationId: 'factory-init-error',
        operation: 'factory_initialization_error'
      });
      throw new Error(`AgentFactory initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset the factory (useful for testing)
   */
  static reset(): void {
    this.agents.clear();
    this.initialized = false;

    logger.debug('AgentFactory reset completed', {
      correlationId: `factory-reset-${Date.now()}`,
      operation: 'factory_reset'
    });
  }

  /**
   * Enable an agent
   */
  static enableAgent(name: string): boolean {
    const registration = this.agents.get(name);
    if (!registration) {
      return false;
    }

    registration.enabled = true;
    logger.info(`Agent ${name} enabled`, {
      correlationId: `agent-enable-${Date.now()}`,
      operation: 'agent_enable',
      agentName: name
    });
    return true;
  }

  /**
   * Disable an agent
   */
  static disableAgent(name: string): boolean {
    const registration = this.agents.get(name);
    if (!registration) {
      return false;
    }

    registration.enabled = false;
    logger.info(`Agent ${name} disabled`, {
      correlationId: `agent-disable-${Date.now()}`,
      operation: 'agent_disable',
      agentName: name
    });
    return true;
  }

  // ============================================================================
  // STATISTICS & DEBUGGING
  // ============================================================================

  /**
   * Get factory statistics
   */
  static getStats(): {
    totalAgents: number;
    enabledAgents: number;
    disabledAgents: number;
    agentNames: string[];
    enabledAgentNames: string[];
    initialized: boolean;
  } {
    const allRegistrations = Array.from(this.agents.values());
    const enabledRegistrations = allRegistrations.filter(reg => reg.enabled);

    return {
      totalAgents: allRegistrations.length,
      enabledAgents: enabledRegistrations.length,
      disabledAgents: allRegistrations.length - enabledRegistrations.length,
      agentNames: Array.from(this.agents.keys()),
      enabledAgentNames: this.getEnabledAgentNames(),
      initialized: this.initialized
    };
  }

  /**
   * Get agent health status
   */
  static getAgentHealth(name: string): { healthy: boolean; details?: any } | null {
    const agent = this.getAgent(name);
    if (!agent) {
      return null;
    }
    return agent.getHealth();
  }

  /**
   * Get all agent health statuses
   */
  static getAllAgentHealth(): Record<string, { healthy: boolean; details?: any }> {
    const health: Record<string, { healthy: boolean; details?: any }> = {};

    for (const [name, registration] of this.agents) {
      if (registration.enabled) {
        health[name] = registration.instance.getHealth();
      }
    }

    return health;
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

    for (const [name, registration] of this.agents) {
      try {
        const config = registration.instance.getConfig();

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
        if (!registration.enabled) {
          warnings.push(`Agent ${name} is disabled`);
        }

        // Validate capabilities
        const capabilities = registration.instance.getCapabilityDescription();
        if (!capabilities.operations || capabilities.operations.length === 0) {
          warnings.push(`Agent ${name} has no operations defined`);
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
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Initialize the factory
 */
export const initializeAgentFactory = async (): Promise<void> => {
  await AgentFactory.initialize();
};

/**
 * Get an agent
 */
export const getAgent = (name: string): BaseSubAgent | undefined => {
  return AgentFactory.getAgent(name);
};

/**
 * Execute an agent with natural language
 */
export const executeAgent = async (
  name: string,
  request: string,
  context: {
    sessionId: string;
    userId?: string;
    accessToken?: string;
    slackContext?: any;
    correlationId?: string;
  }
): Promise<NaturalLanguageExecutionResult> => {
  return AgentFactory.executeAgentWithNaturalLanguage(name, request, context);
};

/**
 * Export the factory class as default
 */
export default AgentFactory;
