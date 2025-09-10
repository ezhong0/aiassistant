import { BaseService } from './base-service';
import { WebClient } from '@slack/web-api';
import logger from '../utils/logger';

/**
 * SlackMigrationService - Handles migration from channel-based to DM-only mode
 * Provides graceful transition for existing users and workspace administrators
 */
export class SlackMigrationService extends BaseService {
  private client: WebClient;
  private migrationMode: 'graceful' | 'immediate' | 'disabled';

  constructor(botToken: string, migrationMode: 'graceful' | 'immediate' | 'disabled' = 'graceful') {
    super('SlackMigrationService');
    this.client = new WebClient(botToken);
    this.migrationMode = migrationMode;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Starting Slack migration service initialization...', {
        migrationMode: this.migrationMode
      });

      // Test Slack client connection
      await this.testSlackConnection();

      this.logInfo('Slack migration service initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Slack migration service destroyed successfully');
    } catch (error) {
      this.logError('Error during Slack migration service destruction', error);
    }
  }

  /**
   * Test Slack client connection
   */
  private async testSlackConnection(): Promise<void> {
    try {
      const authTest = await this.client.auth.test();
      this.logInfo('Slack connection verified for migration service', {
        teamId: authTest.team_id,
        userId: authTest.user_id,
        botId: authTest.bot_id
      });
    } catch (error) {
      this.logError('Failed to verify Slack connection for migration service', error);
      throw new Error('Slack client authentication failed');
    }
  }

  /**
   * Send migration notification to workspace administrators
   */
  async notifyWorkspaceAdmins(teamId: string, adminUserIds: string[]): Promise<void> {
    try {
      const migrationMessage = {
        text: "🔒 AI Assistant Privacy Update",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🔒 AI Assistant Privacy Update"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "We're updating AI Assistant to work exclusively through direct messages to enhance privacy and security."
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*What's changing:*\n• AI Assistant will only respond to direct messages\n• Channel mentions will be redirected to DM\n• Enhanced privacy protection for all users"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*What users need to do:*\n• Send direct messages to @AI Assistant\n• Use `/assistant` command as usual\n• No action required - the transition is automatic"
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_This change takes effect immediately. Users will be automatically guided to use direct messages._"
              }
            ]
          }
        ]
      };

      // Send to each admin user
      for (const adminUserId of adminUserIds) {
        try {
          await this.client.chat.postMessage({
            channel: adminUserId,
            ...migrationMessage
          });
          this.logInfo('Migration notification sent to admin', { adminUserId, teamId });
        } catch (error) {
          this.logError('Failed to send migration notification to admin', error, { adminUserId, teamId });
        }
      }
    } catch (error) {
      this.logError('Error sending migration notifications', error, { teamId, adminCount: adminUserIds.length });
    }
  }

  /**
   * Send migration guidance to users who try to use channels
   */
  async sendChannelMigrationGuidance(channelId: string, userId: string, threadTs?: string): Promise<void> {
    try {
      const guidanceMessage = {
        text: "🔒 AI Assistant Privacy Update - Please use direct messages",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🔒 *AI Assistant Privacy Update*\n\nTo protect your privacy, AI Assistant now works exclusively through direct messages."
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*How to get help:*\n• Send me a direct message\n• Use `/assistant` followed by your request\n• All conversations are private and secure"
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "💬 Start Direct Message"
                },
                action_id: "start_dm",
                url: `slack://user?team=${channelId.split('-')[0]}&id=${userId}`,
                style: "primary"
              }
            ]
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_This change enhances privacy by keeping all AI Assistant conversations private._"
              }
            ]
          }
        ]
      };

      await this.client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        ...guidanceMessage
      });

      this.logInfo('Channel migration guidance sent', { channelId, userId, threadTs });
    } catch (error) {
      this.logError('Error sending channel migration guidance', error, { channelId, userId, threadTs });
    }
  }

  /**
   * Get workspace administrators
   */
  async getWorkspaceAdmins(teamId: string): Promise<string[]> {
    try {
      const members = await this.client.users.list({});
      const admins = members.members?.filter(member => 
        member.is_admin || member.is_owner
      ).map(member => member.id!) || [];

      this.logInfo('Retrieved workspace admins', { teamId, adminCount: admins.length });
      return admins;
    } catch (error) {
      this.logError('Error retrieving workspace admins', error, { teamId });
      return [];
    }
  }

  /**
   * Execute migration strategy based on mode
   */
  async executeMigration(teamId: string): Promise<void> {
    try {
      this.logInfo('Executing Slack migration', { teamId, mode: this.migrationMode });

      switch (this.migrationMode) {
        case 'graceful':
          await this.executeGracefulMigration(teamId);
          break;
        case 'immediate':
          await this.executeImmediateMigration(teamId);
          break;
        case 'disabled':
          this.logInfo('Migration disabled - no action taken', { teamId });
          break;
        default:
          throw new Error(`Unknown migration mode: ${this.migrationMode}`);
      }

      this.logInfo('Migration execution completed', { teamId, mode: this.migrationMode });
    } catch (error) {
      this.logError('Error executing migration', error, { teamId, mode: this.migrationMode });
      throw error;
    }
  }

  /**
   * Execute graceful migration with notifications
   */
  private async executeGracefulMigration(teamId: string): Promise<void> {
    try {
      // Get workspace administrators
      const adminUserIds = await this.getWorkspaceAdmins(teamId);
      
      // Notify administrators
      if (adminUserIds.length > 0) {
        await this.notifyWorkspaceAdmins(teamId, adminUserIds);
      }

      this.logInfo('Graceful migration completed', { teamId, notifiedAdmins: adminUserIds.length });
    } catch (error) {
      this.logError('Error in graceful migration', error, { teamId });
      throw error;
    }
  }

  /**
   * Execute immediate migration (no notifications)
   */
  private async executeImmediateMigration(teamId: string): Promise<void> {
    try {
      this.logInfo('Immediate migration completed - DM-only mode active', { teamId });
    } catch (error) {
      this.logError('Error in immediate migration', error, { teamId });
      throw error;
    }
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded(teamId: string): Promise<boolean> {
    try {
      // Check if the workspace has been using channel-based interactions
      // This could be implemented by checking logs or database records
      // For now, we'll assume migration is always needed for existing installations
      
      this.logDebug('Checking migration need', { teamId });
      return true; // Always migrate for safety
    } catch (error) {
      this.logError('Error checking migration need', error, { teamId });
      return true; // Default to migration needed
    }
  }

  /**
   * Get migration status for a workspace
   */
  async getMigrationStatus(teamId: string): Promise<{
    migrated: boolean;
    mode: string;
    lastMigration?: Date;
    adminNotified: boolean;
  }> {
    try {
      // This would typically check a database or cache for migration status
      // For now, return a default status
      
      return {
        migrated: true,
        mode: this.migrationMode,
        adminNotified: false
      };
    } catch (error) {
      this.logError('Error getting migration status', error, { teamId });
      return {
        migrated: false,
        mode: this.migrationMode,
        adminNotified: false
      };
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy && !!this.client,
      details: {
        ...baseHealth.details,
        migrationMode: this.migrationMode,
        hasClient: !!this.client
      }
    };
  }
}
