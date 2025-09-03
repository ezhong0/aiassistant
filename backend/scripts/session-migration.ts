import { ServiceManager } from '../src/services/service-manager';
import { SessionService } from '../src/services/session.service';
import logger from '../src/utils/logger';

/**
 * Migration script to consolidate multiple session variations into single sessions per user
 */
export class SessionMigrationService {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * Migrate existing complex sessions to simplified sessions
   */
  async migrateToSimplifiedSessions(): Promise<void> {
    logger.info('Starting session migration to simplified sessions...');
    
    try {
      // Get all existing sessions
      const allSessions = await this.getAllSessions();
      logger.info(`Found ${allSessions.length} existing sessions to migrate`);
      
      const migratedCount = 0;
      const consolidatedUsers = new Set<string>();
      
      for (const session of allSessions) {
        // Handle both old slack_ format and new user: format
        let teamId: string | null = null;
        let userId: string | null = null;
        
        if (session.sessionId.startsWith('slack_')) {
          // Old format: slack_${teamId}_${userId}
          const parts = session.sessionId.split('_');
          if (parts.length >= 3) {
            teamId = parts[1];
            userId = parts[2];
          }
        } else if (session.sessionId.startsWith('user:')) {
          // New format: user:${teamId}:${userId}
          const parsed = SessionService.parseSlackSessionId(session.sessionId);
          if (parsed) {
            teamId = parsed.teamId;
            userId = parsed.userId;
          }
        }
        
        if (teamId && userId) {
          const userKey = `${teamId}_${userId}`;
          
          if (!consolidatedUsers.has(userKey)) {
            await this.consolidateUserSessions(teamId, userId);
            consolidatedUsers.add(userKey);
          }
        }
      }
      
      logger.info(`Migration completed. Consolidated ${consolidatedUsers.size} users into simplified sessions`);
    } catch (error) {
      logger.error('Session migration failed:', error);
      throw error;
    }
  }

  /**
   * Consolidate all sessions for a specific user
   */
  private async consolidateUserSessions(teamId: string, userId: string): Promise<void> {
    logger.info(`Consolidating sessions for user ${userId} in team ${teamId}`);
    
    try {
      // Find all session variations for this user
      const sessionVariations = await this.findSessionVariations(teamId, userId);
      logger.info(`Found ${sessionVariations.length} session variations for user ${userId}`);
      
      // Collect all tokens from different sessions
      const allTokens = await this.collectAllTokens(sessionVariations);
      
      // Create simplified session
      const simplifiedSession = await this.sessionService.getSlackSession(teamId, userId);
      
      // Store the best tokens in the simplified session
      if (allTokens.length > 0) {
        const bestTokens = this.selectBestTokens(allTokens);
        await this.sessionService.storeSlackOAuthTokens(teamId, userId, bestTokens);
        
        logger.info(`Stored best tokens in simplified session for user ${userId}`, {
          hasAccessToken: !!bestTokens.google?.access_token,
          hasRefreshToken: !!bestTokens.google?.refresh_token
        });
      }
      
      // Clean up old session variations
      await this.cleanupOldSessions(sessionVariations);
      
    } catch (error) {
      logger.error(`Error consolidating sessions for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Find all session variations for a user
   */
  private async findSessionVariations(teamId: string, userId: string): Promise<string[]> {
    const variations: string[] = [];
    
    // Check for old format variations
    const oldFormatPatterns = [
      `slack_${teamId}_${userId}`,
      `slack_${teamId}_${userId}_main`,
      `slack_${teamId}_${userId}_thread_*`,
      `slack_${teamId}_${userId}_channel_*`
    ];
    
    // Check for new format
    const newFormat = `user:${teamId}:${userId}`;
    
    // In a real implementation, you'd query the database for these patterns
    // For now, we'll just return the new format as it should be the canonical one
    variations.push(newFormat);
    
    return variations;
  }

  /**
   * Collect all OAuth tokens from session variations
   */
  private async collectAllTokens(sessionIds: string[]): Promise<any[]> {
    const allTokens: any[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const tokens = await this.sessionService.getOAuthTokens(sessionId);
        if (tokens && Object.keys(tokens).length > 0) {
          allTokens.push({
            sessionId,
            tokens,
            score: this.calculateTokenScore(tokens)
          });
        }
      } catch (error) {
        logger.debug(`Could not get tokens for session ${sessionId}:`, error);
      }
    }
    
    return allTokens;
  }

  /**
   * Select the best tokens from multiple variations
   */
  private selectBestTokens(tokenVariations: any[]): any {
    if (tokenVariations.length === 0) {
      return {};
    }
    
    // Sort by score (highest first)
    const sortedTokens = tokenVariations.sort((a, b) => b.score - a.score);
    
    logger.info(`Selected best tokens from ${tokenVariations.length} variations`, {
      bestScore: sortedTokens[0].score,
      bestSessionId: sortedTokens[0].sessionId
    });
    
    return sortedTokens[0].tokens;
  }

  /**
   * Calculate a score for token quality
   */
  private calculateTokenScore(tokens: any): number {
    let score = 0;
    
    if (tokens?.google?.access_token) {
      score += 10;
    }
    
    if (tokens?.google?.refresh_token) {
      score += 20; // Refresh tokens are very valuable
    }
    
    if (tokens?.google?.expiry_date) {
      const timeUntilExpiry = tokens.google.expiry_date - Date.now();
      if (timeUntilExpiry > 0) {
        score += Math.min(10, timeUntilExpiry / (1000 * 60 * 60)); // Up to 10 points for time remaining
      }
    }
    
    return score;
  }

  /**
   * Clean up old session variations
   */
  private async cleanupOldSessions(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      try {
        // Keep the canonical new format (user:teamId:userId)
        // Delete old formats (slack_teamId_userId_*) and other variations
        const isCanonicalFormat = sessionId.match(/^user:[^:]+:[^:]+$/);
        const isOldFormat = sessionId.startsWith('slack_') && sessionId.split('_').length > 3;
        
        if (!isCanonicalFormat && (isOldFormat || sessionId.startsWith('slack_'))) {
          await this.sessionService.deleteSession(sessionId);
          logger.debug(`Deleted old session variation: ${sessionId}`);
        }
      } catch (error) {
        logger.debug(`Could not delete old session ${sessionId}:`, error);
      }
    }
  }

  /**
   * Get all sessions (implementation depends on storage backend)
   */
  private async getAllSessions(): Promise<any[]> {
    // This is a simplified implementation
    // In a real implementation, you'd query the database or storage system
    const sessions: any[] = [];
    
    // For now, return empty array - this would need to be implemented
    // based on your actual storage mechanism
    logger.warn('getAllSessions not implemented - skipping migration');
    
    return sessions;
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<any> {
    try {
      const allSessions = await this.getAllSessions();
      const slackSessions = allSessions.filter(s => s.sessionId.startsWith('slack_'));
      
      const userCounts = new Map<string, number>();
      
      for (const session of slackSessions) {
        const parts = session.sessionId.split('_');
        if (parts.length >= 3) {
          const userKey = `${parts[1]}_${parts[2]}`;
          userCounts.set(userKey, (userCounts.get(userKey) || 0) + 1);
        }
      }
      
      const usersWithMultipleSessions = Array.from(userCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([userKey, count]) => ({ userKey, sessionCount: count }));
      
      return {
        totalSessions: allSessions.length,
        slackSessions: slackSessions.length,
        usersWithMultipleSessions,
        needsMigration: usersWithMultipleSessions.length > 0
      };
    } catch (error) {
      logger.error('Error getting migration status:', error instanceof Error ? error.message : 'Unknown error');
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      console.log('Session Migration Tool');
      console.log('====================');
      
      // Initialize services
      const serviceManager = ServiceManager.getInstance();
      await serviceManager.initializeAllServices();
      
      const sessionService = serviceManager.getService('sessionService') as SessionService;
      
      if (!sessionService) {
        console.error('Required services not available');
        process.exit(1);
      }
      
      const migrationService = new SessionMigrationService(sessionService);
      
      // Check migration status
      const status = await migrationService.getMigrationStatus();
      console.log('Migration Status:', JSON.stringify(status, null, 2));
      
      if (status.needsMigration) {
        console.log('Migration needed. Running migration...');
        await migrationService.migrateToSimplifiedSessions();
        console.log('Migration completed successfully!');
      } else {
        console.log('No migration needed.');
      }
      
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}
