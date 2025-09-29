/**
 * Slack API Mock Responses
 * Realistic mock responses for Slack Web API
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  slackUserId?: string;
  slackTeamId?: string;
  slackChannelId?: string;
  [key: string]: any;
}

export class SlackApiMocks {

  /**
   * Mock Slack message posting
   */
  async postMessage(messageData: any, context: MockContext): Promise<APIResponse<any>> {
    const messageTs = (Date.now() / 1000).toString();
    const channelId = messageData.channel || context.slackChannelId || 'C1234567890';

    return {
      success: true,
      data: {
        ok: true,
        channel: channelId,
        ts: messageTs,
        message: {
          type: 'message',
          user: context.slackUserId || 'U1234567890',
          text: messageData.text || 'Mock message',
          ts: messageTs,
          blocks: messageData.blocks || [],
          attachments: messageData.attachments || []
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/chat.postMessage',
      metadata: {
        requestId: `slack-post-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 120,
        cached: false
      }
    };
  }

  /**
   * Mock Slack message updating
   */
  async updateMessage(messageData: any, context: MockContext): Promise<APIResponse<any>> {
    const channelId = messageData.channel || context.slackChannelId || 'C1234567890';
    const messageTs = messageData.ts || (Date.now() / 1000).toString();

    return {
      success: true,
      data: {
        ok: true,
        channel: channelId,
        ts: messageTs,
        text: messageData.text || 'Updated mock message',
        message: {
          type: 'message',
          user: context.slackUserId || 'U1234567890',
          text: messageData.text || 'Updated mock message',
          ts: messageTs,
          edited: {
            user: context.slackUserId || 'U1234567890',
            ts: (Date.now() / 1000).toString()
          }
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/chat.update',
      metadata: {
        requestId: `slack-update-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 110,
        cached: false
      }
    };
  }

  /**
   * Mock conversation history
   */
  async getConversationHistory(params: any, context: MockContext): Promise<APIResponse<any>> {
    const mockMessages = this.generateMockMessages(params, context);

    return {
      success: true,
      data: {
        ok: true,
        messages: mockMessages,
        has_more: mockMessages.length >= (params.limit || 100),
        pin_count: 0,
        response_metadata: {
          next_cursor: mockMessages.length >= (params.limit || 100) ? 'mock_cursor_next' : undefined
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/conversations.history',
      metadata: {
        requestId: `slack-history-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 180,
        cached: false
      }
    };
  }

  /**
   * Mock user info
   */
  async getUserInfo(params: any, context: MockContext): Promise<APIResponse<any>> {
    const userId = params.user || context.slackUserId || 'U1234567890';

    return {
      success: true,
      data: {
        ok: true,
        user: {
          id: userId,
          team_id: context.slackTeamId || 'T1234567890',
          name: 'testuser',
          deleted: false,
          color: '9f69e7',
          real_name: 'Test User',
          tz: 'America/New_York',
          tz_label: 'Eastern Standard Time',
          tz_offset: -18000,
          profile: {
            title: 'Software Engineer',
            phone: '',
            skype: '',
            real_name: 'Test User',
            real_name_normalized: 'Test User',
            display_name: 'Test User',
            display_name_normalized: 'Test User',
            fields: {},
            status_text: 'Working on E2E tests',
            status_emoji: ':computer:',
            status_expiration: 0,
            avatar_hash: 'abc123',
            email: context.userEmail || 'test@example.com',
            image_24: 'https://example.com/avatar_24.jpg',
            image_32: 'https://example.com/avatar_32.jpg',
            image_48: 'https://example.com/avatar_48.jpg',
            image_72: 'https://example.com/avatar_72.jpg',
            image_192: 'https://example.com/avatar_192.jpg',
            image_512: 'https://example.com/avatar_512.jpg',
            status_text_canonical: '',
            team: context.slackTeamId || 'T1234567890'
          },
          is_admin: false,
          is_owner: false,
          is_primary_owner: false,
          is_restricted: false,
          is_ultra_restricted: false,
          is_bot: false,
          is_app_user: false,
          updated: Math.floor(Date.now() / 1000),
          is_email_confirmed: true,
          who_can_share_contact_card: 'EVERYONE'
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/users.info',
      metadata: {
        requestId: `slack-user-info-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 90,
        cached: false
      }
    };
  }

  /**
   * Mock list users
   */
  async listUsers(params: any, context: MockContext): Promise<APIResponse<any>> {
    const mockUsers = this.generateMockUsers(context);

    return {
      success: true,
      data: {
        ok: true,
        members: mockUsers,
        cache_ts: Math.floor(Date.now() / 1000),
        response_metadata: {
          next_cursor: mockUsers.length >= (params.limit || 1000) ? 'mock_users_cursor' : ''
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/users.list',
      metadata: {
        requestId: `slack-users-list-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 200,
        cached: false
      }
    };
  }

  /**
   * Mock auth test
   */
  async testAuth(params: any, context: MockContext): Promise<APIResponse<any>> {
    return {
      success: true,
      data: {
        ok: true,
        url: 'https://test-workspace.slack.com/',
        team: 'Test Workspace',
        user: 'testuser',
        team_id: context.slackTeamId || 'T1234567890',
        user_id: context.slackUserId || 'U1234567890',
        bot_id: 'B1234567890',
        is_enterprise_install: false
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/auth.test',
      metadata: {
        requestId: `slack-auth-test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false
      }
    };
  }

  /**
   * Generate realistic mock messages
   */
  private generateMockMessages(params: any, context: MockContext): any[] {
    const currentTime = context.currentTime || new Date();
    const baseTime = Math.floor(currentTime.getTime() / 1000);

    return [
      {
        type: 'message',
        user: context.slackUserId || 'U1234567890',
        text: 'Hey team, let\'s schedule a meeting to discuss the project',
        ts: (baseTime - 3600).toString(), // 1 hour ago
        edited: undefined,
        thread_ts: undefined,
        reply_count: 0,
        replies: [],
        attachments: [],
        blocks: []
      },
      {
        type: 'message',
        user: 'U0987654321',
        text: 'Sounds good! How about tomorrow at 2pm?',
        ts: (baseTime - 3000).toString(), // 50 minutes ago
        edited: undefined,
        thread_ts: (baseTime - 3600).toString(),
        reply_count: 0,
        replies: [],
        attachments: [],
        blocks: []
      },
      {
        type: 'message',
        user: context.slackUserId || 'U1234567890',
        text: 'Perfect! I\'ll send out calendar invites',
        ts: (baseTime - 1800).toString(), // 30 minutes ago
        edited: undefined,
        thread_ts: (baseTime - 3600).toString(),
        reply_count: 0,
        replies: [],
        attachments: [],
        blocks: []
      }
    ];
  }

  /**
   * Generate realistic mock users
   */
  private generateMockUsers(context: MockContext): any[] {
    const teamId = context.slackTeamId || 'T1234567890';

    return [
      {
        id: context.slackUserId || 'U1234567890',
        team_id: teamId,
        name: 'testuser',
        deleted: false,
        color: '9f69e7',
        real_name: 'Test User',
        tz: 'America/New_York',
        tz_label: 'Eastern Standard Time',
        tz_offset: -18000,
        profile: {
          real_name: 'Test User',
          display_name: 'Test User',
          email: context.userEmail || 'test@example.com',
          team: teamId
        },
        is_admin: false,
        is_owner: false,
        is_bot: false,
        updated: Math.floor(Date.now() / 1000)
      },
      {
        id: 'U0987654321',
        team_id: teamId,
        name: 'teammate',
        deleted: false,
        color: '3aa3e3',
        real_name: 'Team Mate',
        tz: 'America/New_York',
        tz_label: 'Eastern Standard Time',
        tz_offset: -18000,
        profile: {
          real_name: 'Team Mate',
          display_name: 'Team Mate',
          email: 'teammate@example.com',
          team: teamId
        },
        is_admin: false,
        is_owner: false,
        is_bot: false,
        updated: Math.floor(Date.now() / 1000)
      }
    ];
  }

  /**
   * Default response for unhandled endpoints
   */
  async getDefaultResponse(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return {
      success: true,
      data: {
        ok: true,
        message: 'Mock response for Slack API',
        endpoint: request.endpoint,
        method: request.method,
        timestamp: new Date().toISOString()
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: request.endpoint,
      metadata: {
        requestId: `slack-default-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 80,
        cached: false
      }
    };
  }
}