import { AgentFactory } from '../framework/agent-factory';
import logger from '../utils/logger';
import { MasterAgent } from '../agents/master.agent';
import { MasterAgentConfig } from '../types/tools';

/**
 * Simple initialization function that only uses AgentFactory
 * This provides a clean, consolidated agent initialization system
 */
export const initializeAgentFactory = (): void => {
  try {
    logger.debug('Initializing AgentFactory...', {
      correlationId: `agent-factory-init-${Date.now()}`,
      operation: 'agent_factory_initialization'
    });
    
    // Initialize AgentFactory with all agents and metadata
    AgentFactory.initialize();
    
    // Log initialization statistics
    const stats = AgentFactory.getStats();
    logger.debug('AgentFactory initialized successfully', {
      correlationId: `agent-factory-init-${Date.now()}`,
      operation: 'agent_factory_initialization_success',
      metadata: {
        totalAgents: stats.totalAgents,
        enabledAgents: stats.enabledAgents,
        totalTools: stats.totalTools,
        criticalTools: stats.criticalTools,
        confirmationTools: stats.confirmationTools,
        agentNames: stats.agentNames,
        toolNames: stats.toolNames
      }
    });


  } catch (error) {
    logger.error('Failed to initialize AgentFactory', error as Error, {
      correlationId: `agent-factory-init-error-${Date.now()}`,
      operation: 'agent_factory_initialization_error'
    });
    throw error;
  }
}



/**
 * Create a MasterAgent instance with consistent configuration
 * This standardizes MasterAgent creation across the application
 */
export const createMasterAgent = (config?: MasterAgentConfig): MasterAgent => {
  try {
    // AgentFactory is already initialized by the main application
    // No need to check or initialize it again here
    
    const masterAgent = new MasterAgent(config);
    
    return masterAgent;
  } catch (error) {
    
    throw error;
  }
}
