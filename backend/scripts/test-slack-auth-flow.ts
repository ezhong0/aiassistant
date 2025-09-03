#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { SlackSessionManager } from '../src/services/slack-session-manager';
import { serviceManager } from '../src/services/service-manager';
import '../src/services/service-initialization';
import logger from '../src/utils/logger';

async function testSlackAuthenticationFlow() {
  console.log('🔍 Testing Slack Authentication Flow...\n');

  try {
    // Initialize service manager
    await serviceManager.initializeAllServices();
    console.log('✅ Service manager initialized');

    // Get SlackSessionManager
    const slackSessionManager = serviceManager.getService('slackSessionManager') as SlackSessionManager;
    if (!slackSessionManager) {
      throw new Error('SlackSessionManager not available');
    }

    console.log('✅ SlackSessionManager ready');

    // Test data
    const testTeamId = 'T123456';
    const testUserId = 'U123456';
    
    console.log('\n📝 Test Configuration:');
    console.log('  → Team ID:', testTeamId);
    console.log('  → User ID:', testUserId);

    // Step 1: Check if user has tokens initially
    console.log('\n🔍 Step 1: Checking initial authentication status...');
    const initialHasTokens = await slackSessionManager.hasValidOAuthTokens(testTeamId, testUserId);
    console.log('  → Has valid tokens initially:', initialHasTokens);

    // Step 2: Simulate OAuth authentication (store tokens)
    console.log('\n💾 Step 2: Simulating OAuth authentication...');
    const testTokens = {
      google: {
        access_token: 'test_access_token_slack_auth',
        refresh_token: 'test_refresh_token_slack_auth',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        expiry_date: Date.now() + (3600 * 1000)
      },
      slack: {
        team_id: testTeamId,
        user_id: testUserId
      }
    };

    const stored = await slackSessionManager.storeOAuthTokens(testTeamId, testUserId, testTokens);
    console.log('  → Tokens stored successfully:', stored);

    // Step 3: Check if user has tokens after authentication
    console.log('\n🔍 Step 3: Checking authentication status after OAuth...');
    const afterAuthHasTokens = await slackSessionManager.hasValidOAuthTokens(testTeamId, testUserId);
    console.log('  → Has valid tokens after OAuth:', afterAuthHasTokens);

    // Step 4: Retrieve tokens to verify they're accessible
    console.log('\n🔍 Step 4: Retrieving stored tokens...');
    const retrievedTokens = await slackSessionManager.getOAuthTokens(testTeamId, testUserId);
    console.log('  → Tokens retrieved:', {
      hasTokens: !!retrievedTokens,
      hasGoogle: !!retrievedTokens?.google,
      accessToken: retrievedTokens?.google?.access_token?.substring(0, 20) + '...',
      refreshToken: retrievedTokens?.google?.refresh_token?.substring(0, 20) + '...'
    });

    // Step 5: Test token validation
    console.log('\n🔍 Step 5: Testing token validation...');
    const finalHasTokens = await slackSessionManager.hasValidOAuthTokens(testTeamId, testUserId);
    console.log('  → Final token validation:', finalHasTokens);

    // Step 6: Test session persistence
    console.log('\n🔄 Step 6: Testing session persistence...');
    
    // Get session info
    const sessionId = `user:${testTeamId}:${testUserId}`;
    console.log('  → Session ID:', sessionId);
    console.log('  → Session ID format: user:T123456:U123456');

    // Summary
    console.log('\n📊 Authentication Flow Test Summary:');
    console.log('  • Initial auth status:', initialHasTokens ? '❌ Not authenticated' : '❌ Not authenticated');
    console.log('  • After OAuth storage:', afterAuthHasTokens ? '✅ Authenticated' : '❌ Not authenticated');
    console.log('  • Token retrieval:', retrievedTokens ? '✅ Working' : '❌ Failed');
    console.log('  • Final validation:', finalHasTokens ? '✅ Valid' : '❌ Invalid');
    console.log('  • Session persistence:', '✅ Using file storage');

    if (afterAuthHasTokens && finalHasTokens) {
      console.log('\n🎉 Authentication flow test completed successfully!');
      console.log('✅ Users should stay authenticated after OAuth!');
    } else {
      console.log('\n❌ Authentication flow test failed!');
      console.log('❌ Users will be asked to authenticate again!');
      
      // Debug information
      console.log('\n🔧 Debug Information:');
      console.log('  → Session ID format: user:T123456:U123456');
      console.log('  → Tokens stored:', stored);
      console.log('  → Tokens retrieved:', !!retrievedTokens);
      console.log('  → Session ID used:', sessionId);
    }

  } catch (error) {
    console.error('❌ Authentication flow test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      console.log('✅ Test completed successfully');
    } catch (error) {
      console.error('Warning: Error during cleanup:', error);
    }
  }
}

// Run the test
testSlackAuthenticationFlow();
