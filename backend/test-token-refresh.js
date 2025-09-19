const { TokenManager } = require('./dist/services/token-manager.js');
const { serviceManager } = require('./dist/services/service-manager.js');
const { initializeAllCoreServices } = require('./dist/services/service-initialization.js');

async function testTokenRefresh() {
  try {
    console.log('🔧 Initializing services...');
    await initializeAllCoreServices();
    
    const tokenManager = serviceManager.getService('tokenManager');
    if (!tokenManager) {
      throw new Error('TokenManager not available');
    }
    
    const teamId = 'T09CAEM8EVA';
    const userId = 'U09CAEM99DJ';
    
    console.log('🔍 Checking current token status...');
    const tokenStatus = await tokenManager.getTokenStatus(teamId, userId);
    console.log('Token Status:', JSON.stringify(tokenStatus, null, 2));
    
    console.log('🔄 Attempting to get valid tokens (with refresh if needed)...');
    const accessToken = await tokenManager.getValidTokens(teamId, userId);
    
    if (accessToken) {
      console.log('✅ Valid access token retrieved:', accessToken.substring(0, 20) + '...');
    } else {
      console.log('❌ No valid access token available');
    }
    
    console.log('🔍 Checking token status after refresh attempt...');
    const newTokenStatus = await tokenManager.getTokenStatus(teamId, userId);
    console.log('New Token Status:', JSON.stringify(newTokenStatus, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testTokenRefresh();
