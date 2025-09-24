import { BaseService } from './base-service';
import { TokenManager } from './token-manager';
import { TokenStorageService } from './token-storage.service';
import { serviceManager } from './service-manager';

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
  private tokenManager: TokenManager;
  private tokenStorageService: TokenStorageService | null = null;

  constructor() {
    super('AuthStatusService');
    this.tokenManager = new TokenManager();
  }

  protected async onInitialize(): Promise<void> {
    // Get token storage service from service manager
    this.tokenStorageService = serviceManager.getService<TokenStorageService>('tokenStorageService') || null;
    if (!this.tokenStorageService) {
      this.logWarn('TokenStorageService not available, auth status will be limited');
    }
    this.logInfo('AuthStatusService initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('AuthStatusService destroyed');
  }

  async getUserConnections(teamId: string, userId: string): Promise<ServiceConnection[]> {
    if (!this.tokenStorageService) {
      this.logWarn('TokenStorageService not available, returning disconnected status');
      return [{
        provider: 'google',
        providerName: 'Google',
        emoji: '🔵',
        services: ['Gmail', 'Calendar'],
        status: 'disconnected',
        hasAccessToken: false,
        hasRefreshToken: false
      }];
    }

    try {
      const combinedUserId = `${teamId}:${userId}`;
      const tokens = await this.tokenStorageService.getUserTokens(combinedUserId);

      const googleConnection: ServiceConnection = {
        provider: 'google',
        providerName: 'Google',
        emoji: '🔵',
        services: ['Gmail', 'Calendar'],
        status: this.determineStatus(
          tokens?.googleTokens?.access_token,
          tokens?.googleTokens?.expires_at?.getTime()
        ),
        hasAccessToken: !!tokens?.googleTokens?.access_token,
        hasRefreshToken: !!tokens?.googleTokens?.refresh_token,
        expiresAt: tokens?.googleTokens?.expires_at,
        expiresIn: tokens?.googleTokens?.expires_at
          ? this.formatTimeUntil(tokens.googleTokens.expires_at)
          : undefined
      };

      return [googleConnection];
    } catch (error) {
      this.logError('Failed to get user connections', error as Error, {
        operation: 'getUserConnections_error',
        metadata: { teamId, userId }
      });

      // Return disconnected status on any error
      return [{
        provider: 'google',
        providerName: 'Google',
        emoji: '🔵',
        services: ['Gmail', 'Calendar'],
        status: 'disconnected',
        hasAccessToken: false,
        hasRefreshToken: false
      }];
    }
  }

  private determineStatus(
    accessToken?: string,
    expiryDate?: number
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
      expiring: '⏰'
    };
    return emojis[status] || '⚪';
  }

  buildStatusBlocks(connections: ServiceConnection[]): any[] {
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔐 Your Connections'
        }
      },
      { type: 'divider' }
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
          text: statusText
        }
      });

      const buttons: any[] = [];

      if (conn.status === 'connected' || conn.status === 'expiring') {
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔄 Refresh'
          },
          action_id: `refresh_${conn.provider}`,
          value: JSON.stringify({ provider: conn.provider })
        });
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🧪 Test'
          },
          action_id: `test_${conn.provider}`,
          value: JSON.stringify({ provider: conn.provider })
        });
      } else {
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔗 Connect'
          },
          action_id: `connect_${conn.provider}`,
          value: JSON.stringify({ provider: conn.provider }),
          style: 'primary'
        });
      }

      blocks.push({
        type: 'actions',
        elements: buttons
      });

      blocks.push({ type: 'divider' });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 Tip: Connections refresh automatically, but you can manually refresh anytime.'
        }
      ]
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
      if (provider === 'google') {
        const tokens = await this.tokenManager.getValidTokensForGmail(teamId, userId);

        if (!tokens) {
          return {
            success: false,
            message: 'No valid tokens found. Please reconnect your Google account.'
          };
        }

        return {
          success: true,
          message: 'Google connection is working! ✅'
        };
      }

      return {
        success: false,
        message: `Provider ${provider} is not yet supported for testing.`
      };
    } catch (error) {
      this.logError('Connection test failed', error as Error, {
        teamId,
        userId,
        provider,
        operation: 'test_connection'
      });

      return {
        success: false,
        message: `Connection test failed: ${(error as Error).message}`
      };
    }
  }
}

// AuthStatusService is registered in service-initialization.ts