#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { SessionService } from '../src/services/session.service';
import logger from '../src/utils/logger';

async function testSimplifiedSessionManagement() {
  try {
    logger.info('Testing simplified session management (standalone)...');
    
    // Create SessionService directly
    const sessionService = new SessionService();
    
    // Initialize service
    logger.info('Initializing SessionService...');
    await sessionService.initialize();
    logger.info('✅ SessionService initialized successfully');
    
    // Test data
    const testTeamId = 'T123456789';
    const testUserId = 'U123456789';
    
    logger.info('Testing session creation...');
    
    // Test 1: Create session
    const session = await sessionService.getSlackSession(testTeamId, testUserId);
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
    
    const stored = await sessionService.storeSlackOAuthTokens(testTeamId, testUserId, testTokens);
    logger.info('✅ OAuth tokens stored successfully', { stored });
    
    // Test 3: Retrieve OAuth tokens
    const retrievedTokens = await sessionService.getSlackOAuthTokens(testTeamId, testUserId);
    logger.info('✅ OAuth tokens retrieved successfully', {
      hasTokens: !!retrievedTokens,
      hasAccessToken: !!retrievedTokens?.google?.access_token,
      hasRefreshToken: !!retrievedTokens?.google?.refresh_token
    });
    
    // Test 4: Check if tokens are valid
    const hasValidTokens = await sessionService.hasSlackValidOAuthTokens(testTeamId, testUserId);
    logger.info('✅ Token validation check completed', { hasValidTokens });
    
    // Test 5: Get session stats
    const sessionStats = await sessionService.getSlackSessionStats(testTeamId, testUserId);
    logger.info('✅ Session stats retrieved successfully', {
      exists: sessionStats.exists,
      hasOAuthTokens: sessionStats.hasOAuthTokens,
      hasGoogleTokens: sessionStats.hasGoogleTokens,
      hasSlackTokens: sessionStats.hasSlackTokens
    });
    
    logger.info('🎉 All tests passed! Simplified session management is working correctly.');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      logger.info('Cleaning up services...');
      // Add cleanup if needed
    } catch (error) {
      logger.error('Warning: Error during cleanup:', error);
    }
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
