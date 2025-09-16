import logger from '../utils/logger';
import { AgentFactory } from '../framework/agent-factory';
import { MasterAgent } from '../agents/master.agent';
import { MasterAgentConfig } from '../types/tools';

/**
 * Simple initialization function that only uses AgentFactory
 * This provides a clean, consolidated agent initialization system
 */
export const initializeAgentFactory = (): void => {
  try {
    logger.info('Initializing AgentFactory...');
    
    // Initialize AgentFactory with all agents and metadata
    AgentFactory.initialize();
    
    // Log initialization statistics
    const stats = AgentFactory.getStats();
    logger.info('AgentFactory initialized successfully', {
      totalAgents: stats.totalAgents,
      enabledAgents: stats.enabledAgents,
      totalTools: stats.totalTools,
      criticalTools: stats.criticalTools,
      confirmationTools: stats.confirmationTools,
      agentNames: stats.agentNames,
      toolNames: stats.toolNames
    });

    // Generate and log OpenAI functions for debugging
    const openAIFunctions = AgentFactory.generateOpenAIFunctions();
    logger.debug('Generated OpenAI functions', { 
      functionCount: openAIFunctions.length,
      functions: openAIFunctions.map(f => ({ name: f.name, description: f.description }))
    });

  } catch (error) {
    logger.error('Failed to initialize AgentFactory:', error);
    throw error;
  }
}

/**
 * Get the initialized AgentFactory instance
 */
export const getAgentFactory = () => {
  return AgentFactory;
}

/**
 * Check if AgentFactory is properly initialized
 */
export const isAgentFactoryInitialized = (): boolean => {
  const stats = AgentFactory.getStats();
  return stats.totalAgents > 0 && stats.totalTools > 0;
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
    logger.info('MasterAgent created successfully', {
      hasOpenAI: !!config?.openaiApiKey,
      model: config?.model || 'default'
    });
    
    return masterAgent;
  } catch (error) {
    logger.error('Failed to create MasterAgent:', error);
    throw error;
  }
}
