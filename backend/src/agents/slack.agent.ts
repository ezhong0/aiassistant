/**
 * Slack SubAgent - Slack management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for Slack operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with SlackDomainService
 * - Natural language interface
 * - Tool-to-service mapping using unified ToolRegistry
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { ToolRegistry } from '../framework/tool-registry';
import { GenericAIService } from '../services/generic-ai.service';
import { SlackDomainService } from '../services/domain/slack-domain.service';
import { ErrorFactory } from '../errors/error-factory';

export class SlackAgent extends BaseSubAgent {
  private slackService: SlackDomainService;

  constructor(slackService: SlackDomainService, aiService: GenericAIService) {
    super('slack', aiService, {
      name: 'SlackSubAgent',
      description: 'Slack management sub-agent for reading messages, managing channels, and handling interactions',
      enabled: true,
      timeout: 30000,
      retryCount: 3,
    });

    // Store injected domain service
    this.slackService = slackService;
  }

  /**
   * Get available tools from the unified registry
   */
  protected getAvailableTools(): string[] {
    return ToolRegistry.getToolNamesForDomain('slack');
  }

  /**
   * Tool-to-service method mapping using registry
   */
  protected getToolToServiceMap(): Record<string, string> {
    const tools = ToolRegistry.getToolsForDomain('slack');
    const mapping: Record<string, string> = {};
    
    for (const tool of tools) {
      mapping[tool.name] = tool.serviceMethod;
    }
    
    return mapping;
  }

  /**
   * Get the Slack domain service
   */
  protected getService(): SlackDomainService {
    return this.slackService;
  }

  /**
   * Execute tool call by mapping to Slack service method
   */
  protected async executeToolCall(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw ErrorFactory.domain.serviceError('SlackAgent', `Unknown Slack tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw ErrorFactory.api.badRequest('userId is required for Slack operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService();
    
    try {
      // Handle different method signatures
      switch (toolName) {
        case 'send_message':
          // sendMessage follows userId, params pattern
          return await service.sendMessage(userId as string, serviceParams as unknown as {
            channel: string;
            text?: string;
            blocks?: unknown[];
            attachments?: unknown[];
            threadTs?: string;
            replyBroadcast?: boolean;
            unfurlLinks?: boolean;
            unfurlMedia?: boolean;
          }) as unknown as Record<string, unknown>;
        case 'get_user_info':
          // getUserInfo only needs userId parameter (different from the method userId)
          return await service.getUserInfo((serviceParams.userId || serviceParams.user) as string) as unknown as Record<string, unknown>;
        case 'list_users':
          // listUsers just needs params
          return await service.listUsers(serviceParams) as unknown as Record<string, unknown>;
        case 'update_message':
          // updateMessage doesn't need userId
          return await service.updateMessage(serviceParams as unknown as {
            channel: string;
            ts: string;
            text?: string;
            blocks?: unknown[];
            attachments?: unknown[];
            asUser?: boolean;
          }) as unknown as Record<string, unknown>;
        case 'delete_message':
          // deleteMessage doesn't need userId
          return await service.deleteMessage(serviceParams.channel as string, serviceParams.ts as string) as unknown as Record<string, unknown>;
        case 'upload_file':
          // uploadFile needs userId as first parameter
          return await service.uploadFile(userId as string, serviceParams) as unknown as Record<string, unknown>;
        default: {
          // Most methods follow the pattern: method(params)
          const serviceRecord = service as unknown as Record<string, (params: Record<string, unknown>) => Promise<unknown>>;
          const method = serviceRecord[serviceMethod];
          if (!method) {
            throw ErrorFactory.domain.serviceError('SlackAgent', `Method ${serviceMethod} not found on SlackDomainService`);
          }
          return await method(serviceParams) as Record<string, unknown>;
        }
      }
    } catch (error) {
      throw ErrorFactory.domain.serviceError('SlackAgent', `Slack ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery using registry
   */
  getCapabilityDescription(): AgentCapabilities {
    const tools = ToolRegistry.getToolsForDomain('slack');
    const examples = tools.flatMap(tool => tool.examples);
    
    return {
      name: 'SlackSubAgent',
      description: 'Comprehensive Slack management including messaging, file sharing, and conversation analysis',
      operations: tools.map(tool => tool.name),
      requiresAuth: true,
      requiresConfirmation: tools.some(tool => tool.requiresConfirmation),
      isCritical: tools.some(tool => tool.isCritical),
      examples: examples.slice(0, 6), // Limit to 6 examples
    };
  }

}