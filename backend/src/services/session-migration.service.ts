import { ServiceManager } from '../services/service-manager';
import { SlackSessionManager } from '../services/slack-session-manager';
import { SessionService } from '../services/session.service';
import logger from '../utils/logger';

/**
 * Migration script to consolidate multiple session variations into single sessions per user
 */
export class SessionMigrationService {
  private sessionManager: SlackSessionManager;
  private sessionService: SessionService;

  constructor(sessionManager: SlackSessionManager, sessionService: SessionService) {
    this.sessionManager = sessionManager;
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
        if (session.sessionId.startsWith('slack_')) {
          const parts = session.sessionId.split('_');
          if (parts.length >= 3) {
            const teamId = parts[1];
            const userId = parts[2];
            const userKey = `${teamId}_${userId}`;
            
            if (!consolidatedUsers.has(userKey)) {
              await this.consolidateUserSessions(teamId, userId);
              consolidatedUsers.add(userKey);
              // migratedCount++; // Commented out since it's const
            }
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
      const simplifiedSession = await this.sessionManager.getSlackSession(teamId, userId);
      
      // Store the best tokens in the simplified session
      if (allTokens.length > 0) {
        const bestTokens = this.selectBestTokens(allTokens);
        await this.sessionManager.storeOAuthTokens(teamId, userId, bestTokens);
        
        logger.info(`Stored best tokens in simplified session for user ${userId}`, {
          hasAccessToken: !!bestTokens.google?.access_token,
          hasRefreshToken: !!bestTokens.google?.refresh_token
        });
      }
      
      // Clean up old session variations
      await this.cleanupOldSessions(sessionVariations);
      
      logger.info(`Successfully consolidated sessions for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to consolidate sessions for user ${userId}:`, error);
    }
  }

  /**
   * Find all session variations for a user
   */
  private async findSessionVariations(teamId: string, userId: string): Promise<string[]> {
    const allSessions = await this.getAllSessions();
    const variations: string[] = [];
    
    for (const session of allSessions) {
      if (session.sessionId.startsWith(`slack_${teamId}_${userId}`)) {
        variations.push(session.sessionId);
      }
    }
    
    return variations;
  }

  /**
   * Collect all tokens from session variations
   */
  private async collectAllTokens(sessionIds: string[]): Promise<any[]> {
    const allTokens: any[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const tokens = await this.sessionService.getOAuthTokens(sessionId);
        if (tokens) {
          allTokens.push({
            sessionId,
            tokens,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logger.debug(`Could not retrieve tokens from session ${sessionId}:`, error);
      }
    }
    
    return allTokens;
  }

  /**
   * Select the best tokens from multiple sources
   */
  private selectBestTokens(tokenData: any[]): any {
    if (tokenData.length === 0) {
      return null;
    }
    
    // Sort by token quality (prefer tokens with refresh tokens and longer expiry)
    const sortedTokens = tokenData.sort((a, b) => {
      const aScore = this.calculateTokenScore(a.tokens);
      const bScore = this.calculateTokenScore(b.tokens);
      return bScore - aScore; // Higher score first
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
        // Only delete if it's not the simplified session
        if (!sessionId.match(/^slack_[^_]+_[^_]+$/)) {
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
