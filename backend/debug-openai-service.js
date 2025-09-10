// Debug script to check OpenAI service availability
const { getService } = require('./dist/services/service-manager');

console.log('Checking OpenAI service...');

try {
  const openaiService = getService('openaiService');
  console.log('OpenAI service found:', !!openaiService);
  console.log('OpenAI service ready:', openaiService?.isReady());
  console.log('OpenAI service config:', openaiService?.getConfig());
} catch (error) {
  console.error('Error getting OpenAI service:', error);
}
