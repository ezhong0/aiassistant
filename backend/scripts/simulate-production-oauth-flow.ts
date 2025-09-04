#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { initializeServices, serviceManager } from '../src/services/service-manager';
import { TokenStorageService } from '../src/services/token-storage.service';
import { TokenManager } from '../src/services/token-manager';
import logger from '../src/utils/logger';

async function simulateProductionOAuthFlow() {
  try {
    logger.info('🔍 Simulating production OAuth flow...');
    
    // Initialize services
    await initializeServices();
    
    // Get services
    const tokenStorageService = serviceManager.getService<TokenStorageService>('tokenStorageService');
    const tokenManager = serviceManager.getService<TokenManager>('tokenManager');
    
    if (!tokenStorageService || !tokenManager) {
      throw new Error('Required services not available');
    }
    
    // Simulate the exact flow from production logs
    const teamId = 'T09CAEM8EVA';
    const userId = 'U09C27B5W1Z';
    const userId_key = `${teamId}:${userId}`;
    
    logger.info('🔍 Step 1: Simulating OAuth token storage (like at 15:53:23)...');
    
    // Store tokens similar to what happens in auth callback
    const mockGoogleTokens = {
      access_token: 'mock_access_token_12345',
      refresh_token: 'mock_refresh_token_67890',
      expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      token_type: 'Bearer',
      scope: 'email profile'
    };
    
    const mockSlackTokens = {
      access_token: 'mock_slack_access_token',
      team_id: teamId,
      user_id: userId
    };
    
    await tokenStorageService.storeUserTokens(userId_key, {
      google: mockGoogleTokens,
      slack: mockSlackTokens
    });
    
    logger.info('✅ Step 1 completed: Tokens stored');
    
    // Wait a moment like in production (5-6 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('🔍 Step 2: Checking if tokens can be retrieved (like at 15:53:28)...');
    
    // Test retrieval like what happens when next message comes in
    try {
      const hasValidTokens = await tokenManager.hasValidOAuthTokens(teamId, userId);
      logger.info(`✅ Step 2 result: hasValidOAuthTokens = ${hasValidTokens}`);
      
      if (!hasValidTokens) {
        logger.warn('❌ Tokens were stored but hasValidOAuthTokens returned false!');
        
        // Debug deeper
        const tokenStatus = await tokenManager.getTokenStatus(teamId, userId);
        logger.info('🔍 Detailed token status:', JSON.stringify(tokenStatus, null, 2));
        
        const validTokens = await tokenManager.getValidTokens(teamId, userId);
        logger.info(`🔍 getValidTokens result: ${validTokens ? 'has token' : 'null'}`);
      } else {
        logger.info('✅ OAuth flow simulation successful!');
      }
      
    } catch (error) {
      logger.error('💥 Step 2 failed with error:', error);
      
      if (error instanceof Error) {
        logger.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
    }
    
  } catch (error) {
    logger.error('💥 Simulation failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the simulation
if (require.main === module) {
  simulateProductionOAuthFlow()
    .then(() => {
      logger.info('🎉 Production OAuth flow simulation completed');
    })
    .catch((error) => {
      logger.error('💔 Production OAuth flow simulation failed:', error);
      process.exit(1);
    });
}