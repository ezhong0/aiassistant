import logger from '../utils/logger';
import { toolRegistry } from '../registry/tool.registry';
import { TOOL_DEFINITIONS } from './tool-definitions';

/**
 * Initialize and register all tools with the registry
 */
export function initializeToolRegistry(): void {
  try {
    logger.info('Initializing tool registry...');
    
    // Register all tools from configuration
    for (const toolDef of TOOL_DEFINITIONS) {
      toolRegistry.registerTool(toolDef);
    }

    // Log registry statistics
    const stats = toolRegistry.getStats();
    logger.info('Tool registry initialized successfully', {
      totalTools: stats.totalTools,
      criticalTools: stats.criticalTools,
      confirmationTools: stats.confirmationTools,
      toolNames: stats.toolNames
    });

    // Generate and log OpenAI functions for debugging
    const openAIFunctions = toolRegistry.generateOpenAIFunctions();
    logger.debug('Generated OpenAI functions', { 
      functionCount: openAIFunctions.length,
      functions: openAIFunctions.map(f => ({ name: f.name, description: f.description }))
    });

  } catch (error) {
    logger.error('Failed to initialize tool registry:', error);
    throw error;
  }
}

/**
 * Get the initialized tool registry instance
 */
export function getToolRegistry() {
  return toolRegistry;
}

/**
 * Check if registry is properly initialized
 */
export function isRegistryInitialized(): boolean {
  const stats = toolRegistry.getStats();
  return stats.totalTools > 0;
}