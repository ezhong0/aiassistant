#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { SessionService } from '../src/services/session.service';
import logger from '../src/utils/logger';

async function testSlackAuthFix() {
  console.log('🔍 Testing Slack Authentication Fix...\n');

  try {
    // Create services directly
    const sessionService = new SessionService();
    await sessionService.initialize();
    
    console.log('✅ Services initialized');

    // Test data
    const testTeamId = 'T123456';
    const testUserId = 'U123456';
    
    console.log('\n📝 Test Configuration:');
    console.log('  → Team ID:', testTeamId);
    console.log('  → User ID:', testUserId);

    // Step 1: Store tokens (simulating OAuth callback)
    console.log('\n💾 Step 1: Storing tokens (OAuth callback)...');
    const testTokens = {
      google: {
        access_token: 'test_access_token_slack_fix',
        refresh_token: 'test_refresh_token_slack_fix',
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

    const stored = await sessionService.storeSlackOAuthTokens(testTeamId, testUserId, testTokens);
    console.log('  → Tokens stored successfully:', stored);

    // Step 2: Check if tokens can be retrieved (simulating Slack message processing)
    console.log('\n🔍 Step 2: Checking token retrieval (Slack message)...');
    const hasValidTokens = await sessionService.hasSlackValidOAuthTokens(testTeamId, testUserId);
    console.log('  → Has valid tokens:', hasValidTokens);

    // Step 3: Retrieve tokens directly
    console.log('\n🔍 Step 3: Retrieving tokens directly...');
    const retrievedTokens = await sessionService.getSlackOAuthTokens(testTeamId, testUserId);
    console.log('  → Tokens retrieved:', {
      hasTokens: !!retrievedTokens,
      hasGoogle: !!retrievedTokens?.google,
      accessToken: retrievedTokens?.google?.access_token?.substring(0, 20) + '...',
      refreshToken: retrievedTokens?.google?.refresh_token?.substring(0, 20) + '...'
    });

    // Summary
    console.log('\n📊 Slack Authentication Fix Test Summary:');
    console.log('  • Token storage (OAuth callback):', stored ? '✅ Working' : '❌ Failed');
    console.log('  • Token validation (Slack message):', hasValidTokens ? '✅ Working' : '❌ Failed');
    console.log('  • Token retrieval:', retrievedTokens ? '✅ Working' : '❌ Failed');

    if (stored && hasValidTokens && retrievedTokens) {
      console.log('\n🎉 Slack authentication fix is working!');
      console.log('✅ Users will stay authenticated after OAuth!');
    } else {
      console.log('\n❌ Slack authentication fix failed!');
      console.log('❌ Users will still be asked to authenticate again!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    console.log('✅ Test completed');
  }
}

// Run the test
testSlackAuthFix();
