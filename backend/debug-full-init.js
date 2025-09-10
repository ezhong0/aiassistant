// Debug script to check full initialization
const { initializeAllCoreServices } = require('./dist/services/service-initialization');
const { initializeAgentFactory } = require('./dist/config/agent-factory-init');
const { serviceManager } = require('./dist/services/service-manager');

async function debugInit() {
  try {
    console.log('Initializing services...');
    await initializeAllCoreServices();
    console.log('Services initialized');
    
    console.log('All services:', Object.keys(serviceManager.getAllServices()));
    
    const openaiService = serviceManager.getService('openaiService');
    console.log('OpenAI service found:', !!openaiService);
    console.log('OpenAI service ready:', openaiService?.isReady());
    
    console.log('Initializing AgentFactory...');
    initializeAgentFactory();
    console.log('AgentFactory initialized');
    
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

debugInit();
