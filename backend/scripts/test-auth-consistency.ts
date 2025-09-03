#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { SessionService } from '../src/services/session.service';
import { TokenManager } from '../src/services/token-manager';
import { AuthService } from '../src/services/auth.service';
import logger from '../src/utils/logger';

async function testAuthenticationFlow() {
  console.log('🔍 Testing Authentication Flow Consistency...\n');

  try {
    // Create services directly
    const sessionService = new SessionService();
    await sessionService.initialize();
    
    const authService = new AuthService();
    await authService.initialize();
    
    const tokenManager = new TokenManager();
    await tokenManager.initialize();

    console.log('✅ All services initialized');

    // Test data
    const testTeamId = 'T123456';
    const testUserId = 'U123456';
    
    console.log('\n📝 Test Configuration:');
    console.log('  → Team ID:', testTeamId);
    console.log('  → User ID:', testUserId);

    // Step 1: Check session ID generation consistency
    console.log('\n🔍 Step 1: Checking session ID generation...');
    const sessionId1 = `user:${testTeamId}:${testUserId}`;
    const sessionId2 = sessionService.generateSlackSessionId(testTeamId, testUserId);
    console.log('  → Manual session ID:', sessionId1);
    console.log('  → SessionService session ID:', sessionId2);
    console.log('  → Session IDs match:', sessionId1 === sessionId2);

    // Step 2: Store tokens using SessionService (like OAuth callback)
    console.log('\n💾 Step 2: Storing tokens via SessionService...');
    const testTokens = {
      google: {
        access_token: 'test_access_token_flow_test',
        refresh_token: 'test_refresh_token_flow_test',
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

    // Step 3: Check if TokenManager can find the tokens
    console.log('\n🔍 Step 3: Checking TokenManager access...');
    const hasValidTokens = await tokenManager.hasValidOAuthTokens(testTeamId, testUserId);
    console.log('  → TokenManager hasValidOAuthTokens:', hasValidTokens);

    // Step 4: Check if SessionService can find the tokens
    console.log('\n🔍 Step 4: Checking SessionService access...');
    const sessionHasValidTokens = await sessionService.hasSlackValidOAuthTokens(testTeamId, testUserId);
    console.log('  → SessionService hasValidOAuthTokens:', sessionHasValidTokens);

    // Step 5: Direct session service check
    console.log('\n🔍 Step 5: Direct SessionService check...');
    const directTokens = await sessionService.getOAuthTokens(sessionId1);
    console.log('  → Direct SessionService tokens:', {
      hasTokens: !!directTokens,
      hasGoogle: !!directTokens?.google,
      accessToken: directTokens?.google?.access_token?.substring(0, 20) + '...'
    });

    // Step 6: Check what TokenManager's sessionService actually gets
    console.log('\n🔍 Step 6: TokenManager sessionService check...');
    const tokenManagerTokens = await sessionService.getSlackOAuthTokens(testTeamId, testUserId);
    console.log('  → TokenManager sessionService tokens:', {
      hasTokens: !!tokenManagerTokens,
      hasGoogle: !!tokenManagerTokens?.google,
      accessToken: tokenManagerTokens?.google?.access_token?.substring(0, 20) + '...'
    });

    // Summary
    console.log('\n📊 Authentication Flow Test Summary:');
    console.log('  • Session ID consistency:', sessionId1 === sessionId2 ? '✅ Consistent' : '❌ Inconsistent');
    console.log('  • Token storage:', stored ? '✅ Successful' : '❌ Failed');
    console.log('  • TokenManager access:', hasValidTokens ? '✅ Working' : '❌ Failed');
    console.log('  • SessionService access:', sessionHasValidTokens ? '✅ Working' : '❌ Failed');
    console.log('  • Direct SessionService access:', directTokens ? '✅ Working' : '❌ Failed');
    console.log('  • TokenManager sessionManager access:', tokenManagerTokens ? '✅ Working' : '❌ Failed');

    if (hasValidTokens && sessionHasValidTokens) {
      console.log('\n🎉 Authentication flow is consistent!');
      console.log('✅ Users should stay authenticated after OAuth!');
    } else {
      console.log('\n❌ Authentication flow has inconsistencies!');
      console.log('❌ Users will be asked to authenticate again!');
      
      // Debug information
      console.log('\n🔧 Debug Information:');
      console.log('  → Session ID used:', sessionId1);
      console.log('  → Tokens stored:', stored);
      console.log('  → TokenManager result:', hasValidTokens);
      console.log('  → SessionService result:', sessionHasValidTokens);
      console.log('  → Direct SessionService result:', !!directTokens);
      console.log('  → TokenManager sessionManager result:', !!tokenManagerTokens);
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
testAuthenticationFlow();
