/**
 * Email SubAgent - Email management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for email operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with EmailDomainService
 * - Natural language interface
 * - Tool-to-service mapping using unified ToolRegistry
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { ToolRegistry } from '../framework/tool-registry';
import { GenericAIService } from '../services/generic-ai.service';
import { EmailDomainService } from '../services/domain/email-domain.service';
import { ErrorFactory } from '../errors/error-factory';

export class EmailAgent extends BaseSubAgent {
  private emailService: EmailDomainService;

  constructor(emailService: EmailDomainService, aiService: GenericAIService) {
    super('email', aiService, {
      name: 'EmailSubAgent',
      description: 'Email management sub-agent for sending, searching, and managing emails',
      enabled: true,
      timeout: 30000,
      retryCount: 3,
    });

    // Store injected domain service
    this.emailService = emailService;
  }

  /**
   * Get available tools from the unified registry
   */
  protected getAvailableTools(): string[] {
    return ToolRegistry.getToolNamesForDomain('email');
  }

  /**
   * Tool-to-service method mapping using registry
   */
  protected getToolToServiceMap(): Record<string, string> {
    const tools = ToolRegistry.getToolsForDomain('email');
    const mapping: Record<string, string> = {};
    
    for (const tool of tools) {
      mapping[tool.name] = tool.serviceMethod;
    }
    
    return mapping;
  }

  /**
   * Get the email domain service
   */
  protected getService(): EmailDomainService {
    return this.emailService;
  }

  /**
   * Execute tool call by mapping to email service method
   */
  protected async executeToolCall(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw ErrorFactory.domain.serviceError('EmailAgent', `Unknown email tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw ErrorFactory.api.badRequest('userId is required for email operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService();

    try {
      // Handle different method signatures
      switch (toolName) {
        case 'get_email':
          // getEmail only needs messageId, no userId required
          return await service.getEmail(serviceParams.messageId as string) as unknown as Record<string, unknown>;
        case 'reply_to_email':
          // replyToEmail has different signature
          return await service.replyToEmail(serviceParams as {
            messageId: string;
            replyBody: string;
            attachments?: Array<{ filename: string; content: string; contentType: string; }>;
          }) as unknown as Record<string, unknown>;
        case 'get_email_thread':
          // getEmailThread only needs threadId
          return await service.getEmailThread(serviceParams.threadId as string) as unknown as Record<string, unknown>;
        default: {
          // Most methods follow the pattern: method(userId, params)
          const method = (service as unknown as Record<string, (userId: string, params: Record<string, unknown>) => Promise<unknown>>)[serviceMethod];
          if (!method) {
            throw ErrorFactory.domain.serviceError('EmailAgent', `Method ${serviceMethod} not found on EmailDomainService`);
          }
          return await method(userId as string, serviceParams) as Record<string, unknown>;
        }
      }
    } catch (error) {
      throw ErrorFactory.domain.serviceError('EmailAgent', `Email ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery using registry
   */
  getCapabilityDescription(): AgentCapabilities {
    const tools = ToolRegistry.getToolsForDomain('email');
    const examples = tools.flatMap(tool => tool.examples);
    
    return {
      name: 'EmailSubAgent',
      description: 'Comprehensive email management including sending, searching, and conversation handling',
      operations: tools.map(tool => tool.name),
      requiresAuth: true,
      requiresConfirmation: tools.some(tool => tool.requiresConfirmation),
      isCritical: tools.some(tool => tool.isCritical),
      examples: examples.slice(0, 5), // Limit to 5 examples
    };
  }

}