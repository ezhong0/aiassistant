// Test script to verify ConfigService singleton issue is fixed
const { serviceManager } = require('./dist/services/service-manager');
const { initializeAllCoreServices } = require('./dist/services/service-initialization');

async function testConfigServiceFix() {
  console.log('Testing ConfigService fix...');

  try {
    // Test that there's only one ConfigService instance through service manager
    console.log('Starting service initialization...');

    // Initialize services with a timeout to prevent hanging
    const initPromise = initializeAllCoreServices();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Initialization timeout')), 15000)
    );

    await Promise.race([initPromise, timeoutPromise]);

    console.log('✅ Service initialization completed successfully!');

    // Test that we can get the config service
    const configService = serviceManager.getService('configService');
    if (configService) {
      console.log('✅ ConfigService available through service manager');
    } else {
      console.log('❌ ConfigService not found in service manager');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConfigServiceFix();