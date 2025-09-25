import { AgentFactory } from '../framework/agent-factory';
import logger from '../utils/logger';
import { MasterAgent } from '../agents/master.agent';
import { MasterAgentConfig } from '../types/tools';
import { serviceManager } from '../services/service-manager';

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
    
    const masterAgent = new MasterAgent();
    
    // If config is provided, we need to ensure the OpenAI service uses the correct API key
    if (config?.openaiApiKey) {
      // Get the existing OpenAI service and update its API key
      const openaiService = serviceManager.getService('openaiService');
      if (openaiService) {
        // Update the client with the new API key
        (openaiService as any).client = new (require('openai').OpenAI)({
          apiKey: config.openaiApiKey,
        });
        (openaiService as any).apiKey = config.openaiApiKey;
        
        // Update model if provided
        if (config.model) {
          (openaiService as any).model = config.model;
        }
        
        logger.info('Updated OpenAI service with provided configuration', {
          hasApiKey: !!config.openaiApiKey,
          model: config.model || 'default',
          operation: 'openai_service_config_update'
        });
      }
    }
    
    return masterAgent;
  } catch (error) {
    logger.error('Failed to create MasterAgent', error as Error, {
      correlationId: `master-agent-create-error-${Date.now()}`,
      operation: 'master_agent_creation_error'
    });
    throw error;
  }
}
