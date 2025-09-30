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
import { DomainServiceResolver } from '../services/domain/service-resolver-compat';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import { ISlackDomainService } from '../services/domain/interfaces/slack-domain.interface';

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
          // uploadFile needs userId as first parameter
          return await service.uploadFile(userId, serviceParams);
        default:
          // Most methods follow the pattern: method(params)
          return await (service as any)[serviceMethod](serviceParams);
      }
    } catch (error) {
      throw new Error(`Slack ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      examples: examples.slice(0, 6) // Limit to 6 examples
    };
  }

}