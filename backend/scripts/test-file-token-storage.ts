#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { SessionService } from '../src/services/session.service';
import { serviceManager } from '../src/services/service-manager';
import logger from '../src/utils/logger';

async function testFileTokenStorage() {
  console.log('🔍 Testing File Token Storage...\n');

  try {
    // Initialize session service without database dependency
    const sessionService = new SessionService();
    serviceManager.registerService('sessionService', sessionService, {
      priority: 10,
      autoStart: true
    });

    // Initialize just the session service (database will fail, triggering file storage)
    await sessionService.initialize();
    
    console.log('✅ Session service initialized');
    console.log(`  → Session service ready: ${sessionService.isReady()}`);

    // Test token storage and retrieval
    const testSessionId = 'user:T123456:U123456';
    const testTokens = {
      google: {
        access_token: 'test_access_token_file_storage',
        refresh_token: 'test_refresh_token_file_storage',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        expiry_date: Date.now() + (3600 * 1000)
      }
    };

    console.log('\n💾 Testing File Token Storage...');
    console.log(`  → Session ID: ${testSessionId}`);
    
    // Create or get session first
    await sessionService.getOrCreateSession(testSessionId, 'U123456');
    
    // Store tokens
    const stored = await sessionService.storeOAuthTokens(testSessionId, testTokens);
    console.log(`  → Tokens stored: ${stored ? '✅ Success' : '❌ Failed'}`);

    // Retrieve tokens immediately
    const retrieved = await sessionService.getOAuthTokens(testSessionId);
    console.log(`  → Tokens retrieved: ${retrieved ? '✅ Success' : '❌ Failed'}`);
    
    if (retrieved) {
      console.log(`  → Access token matches: ${retrieved.google?.access_token === testTokens.google.access_token ? '✅ Yes' : '❌ No'}`);
      console.log(`  → Refresh token matches: ${retrieved.google?.refresh_token === testTokens.google.refresh_token ? '✅ Yes' : '❌ No'}`);
      console.log(`  → Expiry date: ${retrieved.google?.expiry_date ? new Date(retrieved.google.expiry_date).toISOString() : 'Not set'}`);
      console.log(`  → Access token: ${retrieved.google?.access_token?.substring(0, 30)}...`);
      console.log(`  → Refresh token: ${retrieved.google?.refresh_token?.substring(0, 30)}...`);
    }

    // Test persistence - create a new session service instance
    console.log('\n🔄 Testing Persistence After Service Restart...');
    const newSessionService = new SessionService();
    await newSessionService.initialize();
    
    const persistedTokens = await newSessionService.getOAuthTokens(testSessionId);
    console.log(`  → Tokens persist after restart: ${persistedTokens ? '✅ Success' : '❌ Failed'}`);
    
    if (persistedTokens) {
      console.log(`  → Access token matches after restart: ${persistedTokens.google?.access_token === testTokens.google.access_token ? '✅ Yes' : '❌ No'}`);
      console.log(`  → Refresh token matches after restart: ${persistedTokens.google?.refresh_token === testTokens.google.refresh_token ? '✅ Yes' : '❌ No'}`);
    }

    console.log('\n📊 File Storage Test Summary:');
    console.log(`  • Initial storage: ${stored ? '✅ Working' : '❌ Failed'}`);
    console.log(`  • Initial retrieval: ${retrieved ? '✅ Working' : '❌ Failed'}`);
    console.log(`  • Persistence after restart: ${persistedTokens ? '✅ Working' : '❌ Failed'}`);
    console.log(`  • Data integrity: ${retrieved?.google?.access_token === testTokens.google.access_token && persistedTokens?.google?.access_token === testTokens.google.access_token ? '✅ Working' : '❌ Failed'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testFileTokenStorage().then(() => {
    console.log('\n🎉 File token storage test completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 File token storage test failed:', error);
    process.exit(1);
  });
}

export { testFileTokenStorage };