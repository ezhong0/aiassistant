import { BaseService } from './base-service';
import { TokenManager } from './token-manager';
import { TokenStorageService } from './token-storage.service';
import { GoogleOAuthManager } from './oauth/google-oauth-manager';
import { SlackOAuthManager } from './oauth/slack-oauth-manager';

export interface ServiceConnection {
  provider: string;
  providerName: string;
  emoji: string;
  services: string[];
  status: 'connected' | 'disconnected' | 'expired' | 'expiring';
  lastUsed?: Date;
  expiresAt?: Date;
  expiresIn?: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  elements?: any[];
  accessory?: any;
}

export class AuthStatusService extends BaseService {
  constructor(
    private readonly tokenStorageService: TokenStorageService,
    private readonly tokenManager: TokenManager,
    private readonly googleOAuthManager: GoogleOAuthManager,
    private readonly slackOAuthManager: SlackOAuthManager,
  ) {
    super('AuthStatusService');
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('AuthStatusService initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('AuthStatusService destroyed');
  }

  async getUserConnections(teamId: string, userId: string): Promise<ServiceConnection[]> {
    const connections: ServiceConnection[] = [];
    const combinedUserId = `${teamId}:${userId}`;

    try {
      // Get Google connection status
      if (this.googleOAuthManager) {
        const googleStatus = await this.getGoogleConnectionStatus(combinedUserId);
        connections.push(googleStatus);
      }

      // Get Slack connection status
      if (this.slackOAuthManager) {
        const slackStatus = await this.getSlackConnectionStatus(combinedUserId);
        connections.push(slackStatus);
      }

      // If no OAuth managers available, return disconnected status
      if (connections.length === 0) {
        return [{
          provider: 'google',
          providerName: 'Google',
          emoji: '🔵',
          services: ['Gmail', 'Calendar', 'Contacts'],
          status: 'disconnected',
          hasAccessToken: false,
          hasRefreshToken: false,
        }];
      }

      return connections;
    } catch (error) {
      this.logError('Failed to get user connections', error as Error, {
        operation: 'getUserConnections_error',
        metadata: { teamId, userId },
      });

      // Return disconnected status on any error
      return [{
        provider: 'google',
        providerName: 'Google',
        emoji: '🔵',
        services: ['Gmail', 'Calendar', 'Contacts'],
        status: 'disconnected',
        hasAccessToken: false,
        hasRefreshToken: false,
      }];
    }
  }

  private async getGoogleConnectionStatus(userId: string): Promise<ServiceConnection> {
    try {
      if (!this.googleOAuthManager) {
        return this.createDisconnectedConnection('google', 'Google', '🔵', ['Gmail', 'Calendar', 'Contacts']);
      }

      const validation = await this.googleOAuthManager.validateTokens(userId);
      const tokens = await this.googleOAuthManager.getValidTokens(userId);

      return {
        provider: 'google',
        providerName: 'Google',
        emoji: '🔵',
        services: ['Gmail', 'Calendar', 'Contacts'],
        status: validation.isValid ? 'connected' : 'disconnected',
        hasAccessToken: !!tokens,
        hasRefreshToken: false, // Google refresh tokens are handled internally
        expiresAt: undefined, // OAuth manager handles expiry
        expiresIn: undefined,
      };
    } catch (error) {
      this.logError('Failed to get Google connection status', error as Error, { userId });
      return this.createDisconnectedConnection('google', 'Google', '🔵', ['Gmail', 'Calendar', 'Contacts']);
    }
  }

  private async getSlackConnectionStatus(userId: string): Promise<ServiceConnection> {
    try {
      if (!this.slackOAuthManager) {
        return this.createDisconnectedConnection('slack', 'Slack', '🟣', ['Messaging', 'Channels']);
      }

      const validation = await this.slackOAuthManager.validateTokens(userId);
      const tokens = await this.slackOAuthManager.getValidTokens(userId);

      return {
        provider: 'slack',
        providerName: 'Slack',
        emoji: '🟣',
        services: ['Messaging', 'Channels'],
        status: validation.isValid ? 'connected' : 'disconnected',
        hasAccessToken: !!tokens,
        hasRefreshToken: false, // Slack doesn't use refresh tokens
        expiresAt: undefined,
        expiresIn: undefined,
      };
    } catch (error) {
      this.logError('Failed to get Slack connection status', error as Error, { userId });
      return this.createDisconnectedConnection('slack', 'Slack', '🟣', ['Messaging', 'Channels']);
    }
  }

  private createDisconnectedConnection(
    provider: string,
    providerName: string,
    emoji: string,
    services: string[],
  ): ServiceConnection {
    return {
      provider,
      providerName,
      emoji,
      services,
      status: 'disconnected',
      hasAccessToken: false,
      hasRefreshToken: false,
    };
  }

  private determineStatus(
    accessToken?: string,
    expiryDate?: number,
  ): 'connected' | 'disconnected' | 'expired' | 'expiring' {
    if (!accessToken) return 'disconnected';

    if (!expiryDate) return 'connected';

    const now = Date.now();
    const expiry = new Date(expiryDate).getTime();

    if (expiry < now) return 'expired';

    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (expiry - now < threeDays) return 'expiring';

    return 'connected';
  }

  private formatTimeUntil(date: Date): string {
    const now = Date.now();
    const diff = date.getTime() - now;

    if (diff < 0) return 'expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return 'less than 1 hour';
  }

  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      connected: '✅',
      disconnected: '❌',
      expired: '⚠️',
      expiring: '⏰',
    };
    return emojis[status] || '⚪';
  }

  buildStatusBlocks(connections: ServiceConnection[]): any[] {
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔐 Your Connections',
        },
      },
      { type: 'divider' },
    ];

    for (const conn of connections) {
      let statusText = `${conn.emoji} *${conn.providerName}*\n`;
      statusText += `${this.getStatusEmoji(conn.status)} ${this.capitalize(conn.status)}\n`;
      statusText += `Services: ${conn.services.join(', ')}\n`;

      if (conn.expiresIn) {
        statusText += `⏰ Expires in: ${conn.expiresIn}`;
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: statusText,
        },
      });

      const buttons: any[] = [];

      if (conn.status === 'connected' || conn.status === 'expiring') {
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔄 Refresh',
          },
          action_id: `refresh_${conn.provider}`,
          value: JSON.stringify({ provider: conn.provider }),
        });
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🧪 Test',
          },
          action_id: `test_${conn.provider}`,
          value: JSON.stringify({ provider: conn.provider }),
        });
      } else {
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔗 Connect',
          },
          action_id: `connect_${conn.provider}`,
          value: JSON.stringify({ provider: conn.provider }),
          style: 'primary',
        });
      }

      blocks.push({
        type: 'actions',
        elements: buttons,
      });

      blocks.push({ type: 'divider' });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 Tip: Connections refresh automatically, but you can manually refresh anytime.',
        },
      ],
    });

    return blocks;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async testConnection(teamId: string, userId: string, provider: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const combinedUserId = `${teamId}:${userId}`;

      if (provider === 'google') {
        if (!this.googleOAuthManager) {
          return {
            success: false,
            message: 'Google OAuth manager not available.',
          };
        }

        const validation = await this.googleOAuthManager.validateTokens(combinedUserId);
        if (!validation.isValid) {
          return {
            success: false,
            message: 'Google connection is not valid. Please reconnect your account.',
          };
        }

        return {
          success: true,
          message: 'Google connection is working! ✅',
        };
      }

      if (provider === 'slack') {
        if (!this.slackOAuthManager) {
          return {
            success: false,
            message: 'Slack OAuth manager not available.',
          };
        }

        const validation = await this.slackOAuthManager.validateTokens(combinedUserId);
        if (!validation.isValid) {
          return {
            success: false,
            message: 'Slack connection is not valid. Please reconnect your account.',
          };
        }

        return {
          success: true,
          message: 'Slack connection is working! ✅',
        };
      }

      return {
        success: false,
        message: `Provider ${provider} is not yet supported for testing.`,
      };
    } catch (error) {
      this.logError('Connection test failed', error as Error, {
        teamId,
        userId,
        provider,
        operation: 'test_connection',
      });

      return {
        success: false,
        message: `Connection test failed: ${(error as Error).message}`,
      };
    }
  }
}

// AuthStatusService is registered in service-initialization.ts