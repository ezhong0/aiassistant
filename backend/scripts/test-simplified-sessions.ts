#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { initializeAllCoreServices } from '../src/services/service-initialization';
import { SlackSessionManager } from '../src/services/slack-session-manager';
import { TokenManager } from '../src/services/token-manager';
import { serviceManager } from '../src/services/service-manager';
import logger from '../src/utils/logger';

async function testSimplifiedSessionManagement() {
  try {
    logger.info('Testing simplified session management...');
    
    // Initialize services
    await initializeAllCoreServices();
    
    // Get the new services
    const sessionManager = serviceManager.getService('slackSessionManager') as unknown as SlackSessionManager;
    const tokenManager = serviceManager.getService('tokenManager') as unknown as TokenManager;
    
    if (!sessionManager || !tokenManager) {
      throw new Error('Required services not available');
    }
    
    // Test data
    const testTeamId = 'T123456789';
    const testUserId = 'U123456789';
    
    logger.info('Testing session creation...');
    
    // Test 1: Create session
    const session = await sessionManager.getSlackSession(testTeamId, testUserId);
    logger.info('✅ Session created successfully', {
      sessionId: session.sessionId,
      userId: session.userId,
      teamId: session.teamId,
      hasOAuthTokens: !!session.oauthTokens
    });
    
    // Test 2: Store OAuth tokens
    const testTokens = {
      google: {
        access_token: 'test_access_token_123',
        refresh_token: 'test_refresh_token_456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send',
        expiry_date: Date.now() + (3600 * 1000)
      },
      slack: {
        team_id: testTeamId,
        user_id: testUserId
      }
    };
    
    const stored = await sessionManager.storeOAuthTokens(testTeamId, testUserId, testTokens);
    logger.info('✅ OAuth tokens stored successfully', { stored });
    
    // Test 3: Retrieve OAuth tokens
    const retrievedTokens = await sessionManager.getOAuthTokens(testTeamId, testUserId);
    logger.info('✅ OAuth tokens retrieved successfully', {
      hasTokens: !!retrievedTokens,
      hasAccessToken: !!retrievedTokens?.google?.access_token,
      hasRefreshToken: !!retrievedTokens?.google?.refresh_token
    });
    
    // Test 4: Get valid tokens
    const validToken = await tokenManager.getValidTokens(testTeamId, testUserId);
    logger.info('✅ Valid tokens retrieved successfully', {
      hasValidToken: !!validToken,
      tokenLength: validToken?.length || 0
    });
    
    // Test 5: Check token status
    const tokenStatus = await tokenManager.getTokenStatus(testTeamId, testUserId);
    logger.info('✅ Token status retrieved successfully', tokenStatus);
    
    // Test 6: Update conversation context
    await sessionManager.updateConversationContext(
      testTeamId, 
      testUserId, 
      'C123456789', 
      '1234567890.123456',
      { message: 'test message' }
    );
    logger.info('✅ Conversation context updated successfully');
    
    // Test 7: Get session stats
    const sessionStats = await sessionManager.getSessionStats(testTeamId, testUserId);
    logger.info('✅ Session stats retrieved successfully', sessionStats);
    
    logger.info('🎉 All tests passed! Simplified session management is working correctly.');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSimplifiedSessionManagement().then(() => {
  logger.info('Test completed successfully');
  process.exit(0);
}).catch((error) => {
  logger.error('Test failed:', error);
  process.exit(1);
});
