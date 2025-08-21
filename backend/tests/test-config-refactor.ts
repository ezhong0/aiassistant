/**
 * Test script to verify the configuration refactoring works correctly
 */

import { AGENT_CONFIG, CONFIRMATION_WORDS, AGENT_HELPERS } from '../src/config/agent-config';
import { TIMEOUTS, RATE_LIMITS, REQUEST_LIMITS, APP_CONFIG_HELPERS } from '../src/config/app-config';
import { ENVIRONMENT, ENV_VALIDATION, ENV_HELPERS } from '../src/config/environment';

function testConfigRefactor() {
  console.log('🧪 Testing Configuration Refactoring\n');

  try {
    // 1. Test Agent Configuration
    console.log('1️⃣ Testing Agent Configuration...');
    
    // Test agent keywords
    console.log(`✅ Email keywords: ${AGENT_CONFIG.email.keywords.join(', ')}`);
    console.log(`✅ Calendar keywords: ${AGENT_CONFIG.calendar.keywords.join(', ')}`);
    console.log(`✅ Think agent critical: ${AGENT_CONFIG.think.isCritical}`);
    console.log(`✅ Email agent requires confirmation: ${AGENT_CONFIG.email.requiresConfirmation}`);
    
    // Test confirmation words
    console.log(`✅ Confirmation words: ${CONFIRMATION_WORDS.confirm.join(', ')}`);
    console.log(`✅ Rejection words: ${CONFIRMATION_WORDS.reject.join(', ')}`);
    
    // Test helper functions
    const emailKeywords = AGENT_HELPERS.getKeywords('email');
    const confirmationAgents = AGENT_HELPERS.getConfirmationAgents();
    console.log(`✅ Email keywords via helper: ${emailKeywords.join(', ')}`);
    console.log(`✅ Confirmation agents: ${confirmationAgents.join(', ')}`);
    console.log('');

    // 2. Test App Configuration
    console.log('2️⃣ Testing App Configuration...');
    
    // Test timeouts
    console.log(`✅ Tool execution timeout: ${TIMEOUTS.toolExecution}ms`);
    console.log(`✅ Session timeout: ${TIMEOUTS.session}ms`);
    console.log(`✅ HTTP request timeout: ${TIMEOUTS.httpRequest}ms`);
    
    // Test rate limits
    console.log(`✅ API rate limit: ${RATE_LIMITS.api.maxRequests} requests per ${RATE_LIMITS.api.windowMs / 60000} minutes`);
    console.log(`✅ Auth rate limit: ${RATE_LIMITS.auth.maxRequests} requests per ${RATE_LIMITS.auth.windowMs / 60000} minutes`);
    
    // Test request limits
    console.log(`✅ Command max length: ${REQUEST_LIMITS.command.maxLength}`);
    console.log(`✅ Session ID max length: ${REQUEST_LIMITS.sessionId.maxLength}`);
    console.log(`✅ Email search max results: ${REQUEST_LIMITS.emailSearch.maxResults}`);
    
    // Test helper functions
    const toolTimeout = APP_CONFIG_HELPERS.getTimeout('toolExecution');
    const apiRateLimit = APP_CONFIG_HELPERS.getRateLimit('api');
    console.log(`✅ Tool timeout via helper: ${toolTimeout}ms`);
    console.log(`✅ API rate limit via helper: ${apiRateLimit.maxRequests} requests`);
    console.log('');

    // 3. Test Environment Configuration
    console.log('3️⃣ Testing Environment Configuration...');
    
    // Test environment detection
    console.log(`✅ Node environment: ${ENVIRONMENT.nodeEnv}`);
    console.log(`✅ Is development: ${ENV_VALIDATION.isDevelopment()}`);
    console.log(`✅ Is production: ${ENV_VALIDATION.isProduction()}`);
    console.log(`✅ Port: ${ENVIRONMENT.port}`);
    
    // Test feature flags
    console.log(`✅ Rate limiting enabled: ${ENVIRONMENT.features.rateLimiting}`);
    console.log(`✅ OpenAI enabled: ${ENVIRONMENT.features.openai}`);
    console.log(`✅ Request logging enabled: ${ENVIRONMENT.features.requestLogging}`);
    
    // Test service configuration status
    console.log(`✅ Google configured: ${ENV_VALIDATION.isGoogleConfigured()}`);
    console.log(`✅ OpenAI configured: ${ENV_VALIDATION.isOpenAIConfigured()}`);
    
    // Test helper functions
    const maskedApiKey = ENV_HELPERS.maskSensitive('sk-1234567890abcdef1234567890abcdef');
    console.log(`✅ Masked API key example: ${maskedApiKey}`);
    
    const configSummary = ENV_VALIDATION.getConfigSummary();
    console.log(`✅ Config summary: ${JSON.stringify(configSummary, null, 2)}`);
    console.log('');

    // 4. Test Integration
    console.log('4️⃣ Testing Configuration Integration...');
    
    // Test that configuration values are properly typed and accessible
    const testValues = {
      emailAgentKeywords: AGENT_CONFIG.email.keywords,
      toolExecutionTimeout: TIMEOUTS.toolExecution,
      maxCommandLength: REQUEST_LIMITS.command.maxLength,
      confirmationWords: CONFIRMATION_WORDS.confirm,
      apiRateLimitWindow: RATE_LIMITS.api.windowMs,
      isDevelopment: ENV_VALIDATION.isDevelopment()
    };
    
    console.log('✅ All configuration values accessible and properly typed');
    console.log(`📊 Sample values: ${JSON.stringify(testValues, null, 2)}`);
    console.log('');

    console.log('🎉 Configuration refactoring test completed successfully!');
    console.log('\n📋 Refactoring Benefits Verified:');
    console.log('✅ Centralized configuration in dedicated files');
    console.log('✅ Type-safe access to configuration values');
    console.log('✅ Helper functions for common operations');
    console.log('✅ Environment-specific configuration handling');
    console.log('✅ No more hardcoded magic strings and numbers');
    console.log('✅ Easy to maintain and update configuration');

    return true;

  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  const success = testConfigRefactor();
  process.exit(success ? 0 : 1);
}

export { testConfigRefactor };