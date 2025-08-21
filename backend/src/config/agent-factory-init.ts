import logger from '../utils/logger';
import { AgentFactory } from '../framework/agent-factory';

/**
 * Simple initialization function that only uses AgentFactory
 * This replaces the complex tool registry initialization
 */
export function initializeAgentFactory(): void {
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
export function getAgentFactory() {
  return AgentFactory;
}

/**
 * Check if AgentFactory is properly initialized
 */
export function isAgentFactoryInitialized(): boolean {
  const stats = AgentFactory.getStats();
  return stats.totalAgents > 0 && stats.totalTools > 0;
}
