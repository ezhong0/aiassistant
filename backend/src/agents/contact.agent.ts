/**
 * Contact SubAgent - Contact management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for contact operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with ContactsDomainService
 * - Natural language interface
 * - Tool-to-service mapping
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { ToolRegistry } from '../framework/tool-registry';
import { GenericAIService } from '../services/generic-ai.service';
import { ContactsDomainService } from '../services/domain/contacts-domain.service';
import { ErrorFactory } from '../errors/error-factory';

export class ContactAgent extends BaseSubAgent {
  private contactsService: ContactsDomainService;

  constructor(contactsService: ContactsDomainService, aiService: GenericAIService) {
    super('contacts', aiService, {
      name: 'ContactSubAgent',
      description: 'Contact management sub-agent for searching, creating, and managing contacts',
      enabled: true,
      timeout: 30000,
      retryCount: 3,
    });

    // Store injected domain service
    this.contactsService = contactsService;
  }

  /**
   * Get available tools from the unified registry
   */
  protected getAvailableTools(): string[] {
    return ToolRegistry.getToolNamesForDomain('contacts');
  }

  /**
   * Tool-to-service method mapping using registry
   */
  protected getToolToServiceMap(): Record<string, string> {
    const tools = ToolRegistry.getToolsForDomain('contacts');
    const mapping: Record<string, string> = {};
    
    for (const tool of tools) {
      mapping[tool.name] = tool.serviceMethod;
    }
    
    return mapping;
  }

  /**
   * Get the contacts domain service
   */
  protected getService(): ContactsDomainService {
    return this.contactsService;
  }

  /**
   * Execute tool call by mapping to contacts service method
   */
  protected async executeToolCall(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw ErrorFactory.domain.serviceError('ContactAgent', `Unknown contact tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw ErrorFactory.api.badRequest('userId is required for contact operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService();

    try {
      // Handle different method signatures
      switch (toolName) {
        case 'create_contact':
          // createContact needs userId as first parameter
          return await service.createContact(userId as string, serviceParams) as unknown as Record<string, unknown>;
        case 'update_contact':
          // updateContact needs contactId as first parameter
          return await service.updateContact(serviceParams.contactId as string || serviceParams.resourceName as string, serviceParams) as unknown as Record<string, unknown>;
        default: {
          // Most methods follow the pattern: method(userId, params)
          const method = (service as unknown as Record<string, (userId: string, params: Record<string, unknown>) => Promise<unknown>>)[serviceMethod];
          if (!method) {
            throw ErrorFactory.domain.serviceError('ContactAgent', `Method ${serviceMethod} not found on ContactsDomainService`);
          }
          return await method(userId as string, serviceParams) as Record<string, unknown>;
        }
      }
    } catch (error) {
      throw ErrorFactory.domain.serviceError('ContactAgent', `Contact ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery using registry
   */
  getCapabilityDescription(): AgentCapabilities {
    const tools = ToolRegistry.getToolsForDomain('contacts');
    const examples = tools.flatMap(tool => tool.examples);
    
    return {
      name: 'ContactSubAgent',
      description: 'Comprehensive contact management including search, creation, and organization',
      operations: tools.map(tool => tool.name),
      requiresAuth: true,
      requiresConfirmation: tools.some(tool => tool.requiresConfirmation),
      isCritical: tools.some(tool => tool.isCritical),
      examples: examples.slice(0, 6), // Limit to 6 examples
    };
  }

}