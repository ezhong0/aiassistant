#!/usr/bin/env ts-node

import { serviceManager } from '../src/services/service-manager';
import { DatabaseService } from '../src/services/database.service';
import { SessionService } from '../src/services/session.service';
import logger from '../src/utils/logger';

/**
 * Diagnostic script to check OAuth token persistence
 * This will help identify why authentication isn't persisting across redeploys
 */

async function diagnoseOAuthPersistence() {
  console.log('🔍 Diagnosing OAuth Token Persistence Issues...\n');

  try {
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

    // Test 1: Check if database service is available
    console.log('\n📊 Test 1: Database Service Availability');
    const dbService = serviceManager.getService('databaseService') as DatabaseService;
    const sessionServiceInstance = serviceManager.getService('sessionService') as SessionService;
    
    console.log(`  → Database service available: ${!!dbService}`);
    console.log(`  → Session service available: ${!!sessionServiceInstance}`);
    
    if (dbService) {
      console.log(`  → Database service state: ${dbService.state}`);
      console.log(`  → Database service ready: ${dbService.isReady()}`);
    }

    // Test 2: Check session service database dependency
    console.log('\n🔗 Test 2: Session Service Database Dependency');
    const sessionDbService = (sessionServiceInstance as any).databaseService;
    console.log(`  → Session service has database service: ${!!sessionDbService}`);
    console.log(`  → Database service in session service: ${sessionDbService?.constructor?.name}`);

    // Test 3: Test session creation and OAuth token storage
    console.log('\n💾 Test 3: Session Creation and OAuth Token Storage');
    const testSessionId = 'slack_T123456_U123456_main';
    const testUserId = 'U123456';
    
    // Create session
    console.log(`  → Creating session: ${testSessionId}`);
    const session = await sessionServiceInstance.getOrCreateSession(testSessionId, testUserId);
    console.log(`  → Session created: ${!!session}`);
    console.log(`  → Session ID: ${session.sessionId}`);
    console.log(`  → User ID: ${session.userId}`);

    // Store OAuth tokens
    console.log('\n  → Storing OAuth tokens...');
    const tokensStored = await sessionServiceInstance.storeOAuthTokens(testSessionId, {
      google: {
        access_token: 'test_access_token_123',
        refresh_token: 'test_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send',
        expiry_date: Date.now() + (3600 * 1000)
      },
      slack: {
        team_id: 'T123456',
        user_id: 'U123456'
      }
    });
    console.log(`  → Tokens stored: ${tokensStored}`);

    // Retrieve OAuth tokens
    console.log('\n  → Retrieving OAuth tokens...');
    const retrievedTokens = await sessionServiceInstance.getOAuthTokens(testSessionId);
    console.log(`  → Tokens retrieved: ${!!retrievedTokens}`);
    if (retrievedTokens) {
      console.log(`  → Has Google tokens: ${!!retrievedTokens.google}`);
      console.log(`  → Has Slack tokens: ${!!retrievedTokens.slack}`);
      console.log(`  → Access token: ${retrievedTokens.google?.access_token?.substring(0, 20)}...`);
    }

    // Test 4: Check if tokens persist after session service restart
    console.log('\n🔄 Test 4: Token Persistence After Service Restart');
    
    // Create new session service instance (simulating restart)
    const newSessionService = new SessionService();
    serviceManager.registerService('sessionService2', newSessionService, {
      dependencies: ['databaseService'],
      priority: 10,
      autoStart: true
    });
    
    await newSessionService.initialize();
    
    // Try to retrieve tokens with new service instance
    const persistedTokens = await newSessionService.getOAuthTokens(testSessionId);
    console.log(`  → Tokens persist after restart: ${!!persistedTokens}`);
    if (persistedTokens) {
      console.log(`  → Has Google tokens after restart: ${!!persistedTokens.google}`);
      console.log(`  → Access token after restart: ${persistedTokens.google?.access_token?.substring(0, 20)}...`);
    }

    // Test 5: Check database directly
    console.log('\n🗄️ Test 5: Direct Database Check');
    if (dbService && dbService.isReady()) {
      try {
        const dbTokens = await dbService.getOAuthTokens(testSessionId);
        console.log(`  → Tokens found in database: ${!!dbTokens}`);
        if (dbTokens) {
          console.log(`  → Database access token: ${dbTokens.accessToken.substring(0, 20)}...`);
          console.log(`  → Database expires at: ${dbTokens.expiresAt.toISOString()}`);
        }
      } catch (error: any) {
        console.log(`  → Database query failed: ${error?.message || 'Unknown error'}`);
      }
    } else {
      console.log('  → Database service not ready');
    }

    // Test 6: Check session ID generation consistency
    console.log('\n🆔 Test 6: Session ID Generation Consistency');
    const testContext = {
      userId: 'U123456',
      teamId: 'T123456',
      channelId: 'C123456',
      threadTs: undefined as string | undefined,
      isDirectMessage: true,
      userName: 'Test User',
      userEmail: 'test@example.com'
    };
    
    const possibleSessionIds = [];
    if (testContext.threadTs) {
      possibleSessionIds.push(`slack_${testContext.teamId}_${testContext.userId}_thread_${testContext.threadTs.replace('.', '_')}`);
    }
    if (!testContext.isDirectMessage) {
      possibleSessionIds.push(`slack_${testContext.teamId}_${testContext.userId}_channel_${testContext.channelId}`);
    }
    possibleSessionIds.push(`slack_${testContext.teamId}_${testContext.userId}_main`);
    
    console.log('  → Possible session IDs:');
    possibleSessionIds.forEach((id, index) => {
      console.log(`    ${index + 1}. ${id}`);
    });
    console.log(`  → Expected session ID: ${testSessionId}`);
    console.log(`  → Session ID matches: ${possibleSessionIds.includes(testSessionId)}`);

    console.log('\n✅ Diagnosis completed!');
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`  • Database service: ${dbService?.isReady() ? '✅ Ready' : '❌ Not ready'}`);
    console.log(`  • Session service: ${sessionServiceInstance?.isReady() ? '✅ Ready' : '❌ Not ready'}`);
    console.log(`  • OAuth tokens stored: ${tokensStored ? '✅ Yes' : '❌ No'}`);
    console.log(`  • Tokens persist after restart: ${persistedTokens ? '✅ Yes' : '❌ No'}`);
    console.log(`  • Database contains tokens: ${dbService?.isReady() && persistedTokens ? '✅ Yes' : '❌ No'}`);

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  }
}

// Run the diagnosis
if (require.main === module) {
  diagnoseOAuthPersistence().then(() => {
    console.log('\n🎉 OAuth persistence diagnosis completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 OAuth persistence diagnosis failed:', error);
    process.exit(1);
  });
}

export { diagnoseOAuthPersistence };
