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
import { ToolExecutionContext } from '../framework/tool-execution';
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import { IContactsDomainService } from '../services/domain/interfaces/contacts-domain.interface';

export class ContactAgent extends BaseSubAgent {
  private contactsService: IContactsDomainService;

  constructor() {
    super('contacts', {
      name: 'ContactSubAgent',
      description: 'Contact management sub-agent for searching, creating, and managing contacts',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });

    // Get existing domain service from container
    this.contactsService = DomainServiceResolver.getContactsService();
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
  protected getService(): IDomainService {
    return this.contactsService;
  }

  /**
   * Execute tool call by mapping to contacts service method
   */
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw new Error(`Unknown contact tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw new Error('userId is required for contact operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService() as IContactsDomainService;
    
    try {
      // Handle different method signatures
      switch (toolName) {
        case 'create_contact':
          // createContact needs userId as first parameter
          return await service.createContact(userId, serviceParams);
        case 'update_contact':
          // updateContact needs contactId as first parameter
          return await service.updateContact(serviceParams.contactId || serviceParams.resourceName, serviceParams);
        default:
          // Most methods follow the pattern: method(userId, params)
          return await (service as any)[serviceMethod](userId, serviceParams);
      }
    } catch (error) {
      throw new Error(`Contact ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      examples: examples.slice(0, 6) // Limit to 6 examples
    };
  }

}