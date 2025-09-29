/**
 * Slack SubAgent - Slack management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for Slack operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with SlackDomainService
 * - Natural language interface
 * - Tool-to-service mapping
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { ISlackDomainService, IDomainService } from '../services/domain/interfaces/domain-service.interfaces';

export class SlackAgent extends BaseSubAgent {
  private slackService: ISlackDomainService;

  constructor() {
    super('slack', {
      name: 'SlackSubAgent',
      description: 'Slack management sub-agent for reading messages, managing channels, and handling interactions',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });

    // Get existing domain service from container
    this.slackService = DomainServiceResolver.getSlackService();
  }

  /**
   * Get domain-specific system prompt
   */
  protected getSystemPrompt(): string {
    return `
You are a Slack management sub-agent specialized in Slack workspace operations.

Available tools:
- send_message: Send messages to channels or direct messages
- get_channel_history: Retrieve message history from channels
- get_thread_replies: Get replies from specific message threads
- get_user_info: Get information about Slack users
- list_users: List users in the workspace
- upload_file: Upload files to channels with comments
- update_message: Edit existing messages
- delete_message: Remove messages from channels

Your job is to help users manage their Slack communications effectively by:
1. Reading and analyzing message history and conversations
2. Sending well-formatted messages with proper context
3. Managing file uploads and sharing
4. Providing insights from conversation threads
5. Handling user and channel information

Always extract userId from parameters and respect Slack permissions.
Focus on creating user-friendly Slack experiences.
Be mindful of workspace etiquette and privacy considerations.
    `;
  }

  /**
   * Tool-to-service method mapping
   */
  protected getToolToServiceMap(): Record<string, string> {
    return {
      'send_message': 'sendMessage',
      'get_channel_history': 'getChannelHistory',
      'get_thread_replies': 'getThreadReplies',
      'get_user_info': 'getUserInfo',
      'list_users': 'listUsers',
      'upload_file': 'uploadFile',
      'update_message': 'updateMessage',
      'delete_message': 'deleteMessage'
    };
  }

  /**
   * Get the Slack domain service
   */
  protected getService(): IDomainService {
    return this.slackService;
  }

  /**
   * Execute tool call by mapping to Slack service method
   */
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw new Error(`Unknown Slack tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw new Error('userId is required for Slack operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService() as ISlackDomainService;
    
    try {
      // Handle different method signatures
      switch (toolName) {
        case 'send_message':
          // sendMessage follows userId, params pattern
          return await service.sendMessage(userId, serviceParams);
        case 'get_user_info':
          // getUserInfo only needs userId parameter (different from the method userId)
          return await service.getUserInfo(serviceParams.userId || serviceParams.user);
        case 'list_users':
          // listUsers just needs params
          return await service.listUsers(serviceParams);
        case 'update_message':
          // updateMessage doesn't need userId
          return await service.updateMessage(serviceParams);
        case 'delete_message':
          // deleteMessage doesn't need userId
          return await service.deleteMessage(serviceParams.channel, serviceParams.ts);
        case 'upload_file':
          // uploadFile doesn't need userId
          return await service.uploadFile(serviceParams);
        default:
          // Most methods follow the pattern: method(params)
          return await (service as any)[serviceMethod](serviceParams);
      }
    } catch (error) {
      throw new Error(`Slack ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'SlackSubAgent',
      description: 'Comprehensive Slack management including messaging, file sharing, and conversation analysis',
      operations: [
        'send_message',
        'get_channel_history',
        'get_thread_replies',
        'get_user_info',
        'list_users',
        'upload_file',
        'update_message',
        'delete_message'
      ],
      requiresAuth: true,
      requiresConfirmation: false, // Most Slack operations are read-only
      isCritical: false,
      examples: [
        'Read the latest messages from the #general channel',
        'Send a message to the team about the project update',
        'Get the conversation thread about yesterday\'s meeting',
        'Find information about user John in Slack',
        'Upload the project file to the #design channel',
        'Check who is in the workspace'
      ]
    };
  }

}