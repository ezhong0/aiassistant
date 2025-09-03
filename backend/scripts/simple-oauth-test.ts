#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { AuthService } from '../src/services/auth.service';
import { SlackSessionManager } from '../src/services/slack-session-manager';
import { SessionService } from '../src/services/session.service';
import { DatabaseService } from '../src/services/database.service';
import { serviceManager } from '../src/services/service-manager';
import logger from '../src/utils/logger';

async function simpleOAuthTest() {
  console.log('🔍 Simple OAuth Token Persistence Test...\n');

  try {
    // Check environment variables
    console.log('📋 Environment Check:');
    console.log(`  → NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  → GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`  → GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`  → GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI}`);
    console.log(`  → JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);

    // Test the issue: Is it database vs memory storage?
    console.log('\n🗄️ Testing Storage Backend...');
    
    // Register services
    const databaseService = new DatabaseService();
    serviceManager.registerService('databaseService', databaseService, {
      priority: 5,
      autoStart: true
    });

    const sessionService = new SessionService();
    serviceManager.registerService('sessionService', sessionService, {
      dependencies: ['databaseService'],
      priority: 10,
      autoStart: true
    });

    // Initialize services
    await serviceManager.initializeAllServices();
    
    console.log('✅ Services initialized successfully');
    console.log(`  → Database service ready: ${databaseService.isReady()}`);
    console.log(`  → Session service ready: ${sessionService.isReady()}`);

    // Test token storage
    const testSessionId = 'user:T123456:U123456';
    const testTokens = {
      google: {
        access_token: 'test_access_token_123',
        refresh_token: 'test_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        expiry_date: Date.now() + (3600 * 1000)
      }
    };

    console.log('\n💾 Testing Token Storage...');
    console.log(`  → Session ID: ${testSessionId}`);
    
    // Store tokens
    const stored = await sessionService.storeOAuthTokens(testSessionId, testTokens);
    console.log(`  → Tokens stored: ${stored ? '✅ Success' : '❌ Failed'}`);

    // Retrieve tokens immediately
    const retrieved = await sessionService.getOAuthTokens(testSessionId);
    console.log(`  → Tokens retrieved immediately: ${retrieved ? '✅ Success' : '❌ Failed'}`);
    
    if (retrieved) {
      console.log(`  → Access token present: ${retrieved.google?.access_token ? '✅ Yes' : '❌ No'}`);
      console.log(`  → Refresh token present: ${retrieved.google?.refresh_token ? '✅ Yes' : '❌ No'}`);
      console.log(`  → Expiry date: ${retrieved.google?.expiry_date ? new Date(retrieved.google.expiry_date).toISOString() : 'Not set'}`);
    }

    // Test SlackSessionManager (which is what the app actually uses)
    console.log('\n🎯 Testing SlackSessionManager...');
    const slackSessionManager = new SlackSessionManager(sessionService);
    await slackSessionManager.initialize();
    
    const teamId = 'T123456';
    const userId = 'U123456';
    
    // Store tokens via SlackSessionManager
    const slackStored = await slackSessionManager.storeOAuthTokens(teamId, userId, testTokens);
    console.log(`  → Tokens stored via SlackSessionManager: ${slackStored ? '✅ Success' : '❌ Failed'}`);

    // Retrieve tokens via SlackSessionManager
    const slackRetrieved = await slackSessionManager.getOAuthTokens(teamId, userId);
    console.log(`  → Tokens retrieved via SlackSessionManager: ${slackRetrieved ? '✅ Success' : '❌ Failed'}`);

    if (slackRetrieved) {
      console.log(`  → Access token via Slack manager: ${slackRetrieved.google?.access_token ? '✅ Yes' : '❌ No'}`);
      console.log(`  → Refresh token via Slack manager: ${slackRetrieved.google?.refresh_token ? '✅ Yes' : '❌ No'}`);
    }

    // Test token validation
    const hasValidTokens = await slackSessionManager.hasValidOAuthTokens(teamId, userId);
    console.log(`  → Has valid OAuth tokens: ${hasValidTokens ? '✅ Yes' : '❌ No'}`);

    console.log('\n📊 Summary:');
    console.log(`  • Storage backend: ${databaseService.isReady() ? 'Database' : 'Memory'}`);
    console.log(`  • Direct storage/retrieval: ${stored && retrieved ? '✅ Working' : '❌ Failed'}`);
    console.log(`  • SlackSessionManager storage/retrieval: ${slackStored && slackRetrieved ? '✅ Working' : '❌ Failed'}`);
    console.log(`  • Token validation: ${hasValidTokens ? '✅ Working' : '❌ Failed'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  simpleOAuthTest().then(() => {
    console.log('\n🎉 OAuth test completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 OAuth test failed:', error);
    process.exit(1);
  });
}

export { simpleOAuthTest };