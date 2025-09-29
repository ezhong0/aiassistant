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
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import { IContactsDomainService } from '../services/domain/interfaces/contacts-domain.interface';

export class ContactAgent extends BaseSubAgent {
  private contactsService: IContactsDomainService;

  constructor() {
    super('contact', {
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
   * Tool-to-service method mapping
   */
  protected getToolToServiceMap(): Record<string, string> {
    return {
      'search_contacts': 'searchContacts',
      'get_contact': 'getContact',
      'list_contacts': 'listContacts',
      'create_contact': 'createContact',
      'update_contact': 'updateContact',
      'delete_contact': 'deleteContact'
    };
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
   * Get agent capabilities for discovery
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'ContactSubAgent',
      description: 'Comprehensive contact management including search, creation, and organization',
      operations: [
        'search_contacts',
        'get_contact',
        'list_contacts',
        'create_contact',
        'update_contact',
        'delete_contact'
      ],
      requiresAuth: true,
      requiresConfirmation: false, // Contact search is usually read-only
      isCritical: false,
      examples: [
        'Find John Smith\'s contact information',
        'Search for contacts at Acme Corporation',
        'Create a new contact for Jane Doe',
        'Update Sarah\'s phone number',
        'List all contacts starting with A',
        'Find contacts with gmail addresses'
      ]
    };
  }

}