#!/usr/bin/env node

/**
 * Test script to verify PostgreSQL integration
 * This script tests the database service and session persistence
 */

import { DatabaseService } from '../src/services/database.service';
import { SessionService } from '../src/services/session.service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testDatabaseIntegration() {
  console.log('🧪 Testing PostgreSQL integration...\n');

  try {
    // Test DatabaseService
    console.log('1. Testing DatabaseService...');
    const databaseService = new DatabaseService();
    await databaseService.initialize();
    console.log('✅ DatabaseService initialized successfully');

    // Test session creation
    console.log('\n2. Testing session creation...');
    const testSessionId = 'test-session-' + Date.now();
    const testUserId = 'test-user-123';
    
    await databaseService.createSession({
      sessionId: testSessionId,
      userId: testUserId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      lastActivity: new Date(),
      conversationHistory: [],
      toolCalls: [],
      toolResults: []
    });
    console.log('✅ Session created in database');

    // Test session retrieval
    console.log('\n3. Testing session retrieval...');
    const retrievedSession = await databaseService.getSession(testSessionId);
    if (retrievedSession && retrievedSession.userId === testUserId) {
      console.log('✅ Session retrieved successfully');
    } else {
      throw new Error('Session retrieval failed');
    }

    // Test OAuth token storage
    console.log('\n4. Testing OAuth token storage...');
    await databaseService.storeOAuthTokens({
      sessionId: testSessionId,
      accessToken: 'test-access-token-123',
      refreshToken: 'test-refresh-token-456',
      expiresAt: new Date(Date.now() + 3600000),
      tokenType: 'Bearer',
      scope: 'email profile',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ OAuth tokens stored in database');

    // Test OAuth token retrieval
    console.log('\n5. Testing OAuth token retrieval...');
    const retrievedTokens = await databaseService.getOAuthTokens(testSessionId);
    if (retrievedTokens && retrievedTokens.accessToken === 'test-access-token-123') {
      console.log('✅ OAuth tokens retrieved successfully');
    } else {
      throw new Error('OAuth token retrieval failed');
    }

    // Test SessionService with database
    console.log('\n6. Testing SessionService with database...');
    const sessionService = new SessionService();
    
    // Mock service manager to inject database service
    (sessionService as any).serviceManager = {
      getService: (name: string) => {
        if (name === 'databaseService') return databaseService;
        return null;
      }
    };
    
    await sessionService.initialize();
    console.log('✅ SessionService initialized with database');

    // Test session creation through SessionService
    console.log('\n7. Testing SessionService session creation...');
    const sessionServiceSessionId = 'session-service-test-' + Date.now();
    const session = await sessionService.getOrCreateSession(sessionServiceSessionId, testUserId);
    if (session && session.userId === testUserId) {
      console.log('✅ SessionService session creation successful');
    } else {
      throw new Error('SessionService session creation failed');
    }

    // Test OAuth token storage through SessionService
    console.log('\n8. Testing SessionService OAuth token storage...');
    const tokenStorageResult = await sessionService.storeOAuthTokens(sessionServiceSessionId, {
      google: {
        access_token: 'google-access-token-789',
        refresh_token: 'google-refresh-token-012',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'email profile'
      }
    });
    
    if (tokenStorageResult) {
      console.log('✅ SessionService OAuth token storage successful');
    } else {
      throw new Error('SessionService OAuth token storage failed');
    }

    // Test OAuth token retrieval through SessionService
    console.log('\n9. Testing SessionService OAuth token retrieval...');
    const sessionTokens = await sessionService.getOAuthTokens(sessionServiceSessionId);
    if (sessionTokens?.google?.access_token === 'google-access-token-789') {
      console.log('✅ SessionService OAuth token retrieval successful');
    } else {
      throw new Error('SessionService OAuth token retrieval failed');
    }

    // Cleanup
    console.log('\n10. Cleaning up test data...');
    await databaseService.deleteSession(testSessionId);
    await databaseService.deleteSession(sessionServiceSessionId);
    console.log('✅ Test data cleaned up');

    // Shutdown services
    await sessionService.destroy();
    await databaseService.destroy();

    console.log('\n🎉 All PostgreSQL integration tests passed!');
    console.log('\nYour database integration is working correctly.');
    console.log('Slack authentication will now persist across server restarts.');

  } catch (error) {
    console.error('\n❌ PostgreSQL integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDatabaseIntegration().catch(console.error);
