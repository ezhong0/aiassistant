// Debug script to check all services
const { serviceManager } = require('./dist/services/service-manager');

console.log('Checking all services...');

try {
  const allServices = serviceManager.getAllServices();
  console.log('All services:', Object.keys(allServices));
  
  const openaiService = serviceManager.getService('openaiService');
  console.log('OpenAI service found:', !!openaiService);
  
  // Check if it's registered with a different name
  const services = Object.keys(allServices);
  const openaiServices = services.filter(name => name.toLowerCase().includes('openai'));
  console.log('Services with "openai" in name:', openaiServices);
  
} catch (error) {
  console.error('Error checking services:', error);
}
