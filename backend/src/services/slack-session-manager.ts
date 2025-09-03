import { SessionService } from './session.service';
import { GoogleTokens } from '../types/auth.types';
import { BaseService } from './base-service';
import logger from '../utils/logger';

export interface SlackSessionContext {
  sessionId: string;
  userId: string;
  teamId: string;
  oauthTokens?: {
    google?: GoogleTokens;
    slack?: {
      access_token?: string;
      team_id?: string;
      user_id?: string;
    };
  };
  conversations?: {
    [channelId: string]: {
      [threadTs: string]: {
        lastActivity: Date;
        messageCount: number;
        context?: any;
      }
    }
  };
}

export class SlackSessionManager extends BaseService {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    super('SlackSessionManager');
    this.sessionService = sessionService;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('SlackSessionManager initialized successfully');
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('SlackSessionManager destroyed');
  }

  /**
   * Generate a consistent, canonical session ID for a Slack user
   * Format: user:${teamId}:${userId} (standardized across all services)
   */
  private generateSessionId(teamId: string, userId: string): string {
    // Validate inputs to prevent malformed session IDs
    if (!teamId || !userId || typeof teamId !== 'string' || typeof userId !== 'string') {
      throw new Error(`Invalid session ID parameters: teamId=${teamId}, userId=${userId}`);
    }
    
    // Use standardized format across all services
    return `user:${teamId}:${userId}`;
  }
  
  /**
   * Parse a session ID to extract team and user information
   */
  public static parseSessionId(sessionId: string): { teamId: string; userId: string } | null {
    const match = sessionId.match(/^user:([^:]+):([^:]+)$/);
    if (!match || match.length < 3) {
      return null;
    }
    return {
      teamId: match[1]!,
      userId: match[2]!
    };
  }

  /**
   * Get or create a session for a Slack user
   */
  async getSlackSession(teamId: string, userId: string): Promise<SlackSessionContext> {
    const sessionId = this.generateSessionId(teamId, userId);
    
    logger.debug('Getting/creating Slack session', { 
      sessionId, 
      teamId, 
      userId 
    });
    
    const session = await this.sessionService.getOrCreateSession(sessionId, userId);
    
    // Transform the session tokens to match our interface
    const transformedTokens = session.oauthTokens ? {
      google: session.oauthTokens.google ? {
        access_token: session.oauthTokens.google.access_token,
        refresh_token: session.oauthTokens.google.refresh_token,
        expires_in: session.oauthTokens.google.expires_in || 3600,
        token_type: session.oauthTokens.google.token_type || 'Bearer',
        scope: session.oauthTokens.google.scope,
        expiry_date: session.oauthTokens.google.expiry_date
      } : undefined,
      slack: session.oauthTokens.slack
    } : undefined;
    
    return {
      sessionId: session.sessionId,
      userId: session.userId || userId,
      teamId,
      oauthTokens: transformedTokens,
      conversations: session.conversations
    };
  }

  /**
   * Store OAuth tokens for a Slack user
   */
  async storeOAuthTokens(teamId: string, userId: string, tokens: {
    google?: GoogleTokens;
    slack?: {
      access_token?: string;
      team_id?: string;
      user_id?: string;
    };
  }): Promise<boolean> {
    const sessionId = this.generateSessionId(teamId, userId);
    
    logger.info('Storing OAuth tokens for Slack user', { 
      sessionId, 
      teamId, 
      userId,
      hasAccessToken: !!tokens.google?.access_token,
      hasRefreshToken: !!tokens.google?.refresh_token
    });
    
    // Ensure session exists before storing tokens
    await this.sessionService.getOrCreateSession(sessionId, userId);
    
    return await this.sessionService.storeOAuthTokens(sessionId, tokens);
  }

  /**
   * Get OAuth tokens for a Slack user
   */
  async getOAuthTokens(teamId: string, userId: string): Promise<{
    google?: GoogleTokens;
    slack?: {
      access_token?: string;
      team_id?: string;
      user_id?: string;
    };
  } | null> {
    const sessionId = this.generateSessionId(teamId, userId);
    
    logger.debug('Retrieving OAuth tokens for Slack user', { 
      sessionId, 
      teamId, 
      userId 
    });
    
    const tokens = await this.sessionService.getOAuthTokens(sessionId);
    
    if (!tokens) {
      return null;
    }
    
    // Transform the tokens to match our interface
    return {
      google: tokens.google ? {
        access_token: tokens.google.access_token,
        refresh_token: tokens.google.refresh_token,
        expires_in: tokens.google.expires_in || 3600,
        token_type: tokens.google.token_type || 'Bearer',
        scope: tokens.google.scope,
        expiry_date: tokens.google.expiry_date
      } : undefined,
      slack: tokens.slack
    };
  }

  /**
   * Get Google access token for a Slack user
   */
  async getGoogleAccessToken(teamId: string, userId: string): Promise<string | null> {
    const sessionId = this.generateSessionId(teamId, userId);
    
    logger.debug('Retrieving Google access token for Slack user', { 
      sessionId, 
      teamId, 
      userId 
    });
    
    return await this.sessionService.getGoogleAccessToken(sessionId);
  }

  /**
   * Update conversation context for a specific channel/thread
   */
  async updateConversationContext(
    teamId: string, 
    userId: string, 
    channelId: string, 
    threadTs?: string,
    context?: any
  ): Promise<void> {
    const sessionId = this.generateSessionId(teamId, userId);
    const session = await this.sessionService.getSession(sessionId);
    
    if (!session) {
      logger.warn('Session not found for conversation context update', { 
        sessionId, 
        teamId, 
        userId 
      });
      return;
    }
    
    // Initialize conversations structure if it doesn't exist
    if (!session.conversations) {
      session.conversations = {};
    }
    if (!session.conversations[channelId]) {
      session.conversations[channelId] = {};
    }
    
    const conversationKey = threadTs || 'main';
    const existingConversation = session.conversations[channelId][conversationKey];
    
    session.conversations[channelId][conversationKey] = {
      lastActivity: new Date(),
      messageCount: (existingConversation?.messageCount || 0) + 1,
      context: context || existingConversation?.context
    };
    
    // Update session activity
    session.lastActivity = new Date();
    
    logger.debug('Updated conversation context', { 
      sessionId, 
      channelId, 
      threadTs, 
      messageCount: session.conversations[channelId][conversationKey].messageCount 
    });
  }

  /**
   * Check if a user has valid OAuth tokens
   */
  async hasValidOAuthTokens(teamId: string, userId: string): Promise<boolean> {
    const tokens = await this.getOAuthTokens(teamId, userId);
    
    if (!tokens?.google?.access_token) {
      return false;
    }
    
    // Check if token is expired
    if (tokens.google.expiry_date && Date.now() > tokens.google.expiry_date) {
      logger.debug('OAuth tokens expired for Slack user', { 
        teamId, 
        userId,
        expiryDate: new Date(tokens.google.expiry_date).toISOString()
      });
      return false;
    }
    
    return true;
  }

  /**
   * Get session statistics for debugging
   */
  async getSessionStats(teamId: string, userId: string): Promise<any> {
    const sessionId = this.generateSessionId(teamId, userId);
    const session = await this.sessionService.getSession(sessionId);
    
    if (!session) {
      return { exists: false };
    }
    
    return {
      exists: true,
      sessionId: session.sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      hasOAuthTokens: !!session.oauthTokens,
      hasGoogleTokens: !!session.oauthTokens?.google?.access_token,
      hasSlackTokens: !!session.oauthTokens?.slack,
      conversationChannels: session.conversations ? Object.keys(session.conversations).length : 0,
      totalMessages: session.conversations ? 
        Object.values(session.conversations).reduce((total: number, channel: any) => 
          total + Object.values(channel).reduce((sum: number, conv: any) => sum + conv.messageCount, 0), 0
        ) : 0
    };
  }
}
