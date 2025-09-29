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
import { IContactsDomainService, IDomainService } from '../services/domain/interfaces/domain-service.interfaces';

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
   * Get domain-specific system prompt
   */
  protected getSystemPrompt(): string {
    return `
You are a contact management sub-agent specialized in Google Contacts operations.

Available tools:
- search_contacts: Search contacts using names, emails, or other details
- get_contact: Retrieve detailed information about a specific contact
- list_contacts: List contacts with pagination and sorting options
- create_contact: Create new contacts with complete information
- update_contact: Modify existing contact information
- delete_contact: Remove contacts from the address book

Your job is to help users manage their contacts effectively by:
1. Finding people using intelligent search across all contact fields
2. Creating comprehensive contact records with proper formatting
3. Updating contact information while preserving data integrity
4. Organizing contacts for easy retrieval and management
5. Providing clear summaries of contact operations

Always extract userId from parameters and handle contact data carefully.
Focus on creating user-friendly contact management experiences.
Be respectful of privacy and ensure data accuracy.
    `;
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
          // createContact doesn't need userId as first parameter
          return await service.createContact(serviceParams);
        case 'update_contact':
          // updateContact doesn't need userId as first parameter
          return await service.updateContact(serviceParams);
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

  // Legacy compatibility methods for existing code
  /**
   * Process contact request (legacy compatibility)
   */
  async processRequest(input: string, userId?: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      const context = {
        sessionId: `legacy-${Date.now()}`,
        userId,
        correlationId: `contact-legacy-${Date.now()}`,
        timestamp: new Date()
      };

      const result = await this.processNaturalLanguageRequest(input, context);
      
      return {
        success: result.success,
        message: result.message,
        data: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Contact operation failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}