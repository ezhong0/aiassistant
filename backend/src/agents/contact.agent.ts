/**
 * Contact Agent - Contact Management Microservice
 *
 * Google Contacts integration using the NaturalLanguageAgent pattern.
 *
 * This agent only implements 2 methods:
 * 1. getAgentConfig() - Configuration and metadata
 * 2. executeOperation() - Internal contact operations
 *
 * Everything else (LLM analysis, response formatting) is handled by the base class.
 */

import { NaturalLanguageAgent, AgentConfig } from '../framework/natural-language-agent';
import { ContactService } from '../services/contact.service';

interface ContactResult {
  contacts?: any[];
  count?: number;
  contact?: any;
  success: boolean;
}

/**
 * ContactAgent - Contact Management Microservice
 *
 * Microservice API:
 *   Input: Natural language contact request
 *   Output: Natural language result with contact info
 *
 * Examples:
 *   "Find contact for John Smith" → "Found John Smith: john@example.com, +1234567890"
 *   "Search for contacts at Acme Corp" → "Found 3 contacts at Acme Corp..."
 *   "Lookup sarah@example.com" → "Sarah Johnson: Product Manager at..."
 */
export class ContactAgent extends NaturalLanguageAgent {

  /**
   * Agent configuration - defines what this agent can do
   */
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'contactAgent',

      systemPrompt: `You are a contact management agent for Google Contacts.

Your role is to search, lookup, and retrieve contact information on behalf of the user.

Your capabilities:
- Search for contacts by name, email, phone, or company
- Lookup specific contact details
- Find contacts matching criteria
- Retrieve contact information

When handling contact requests:
1. Extract search criteria from natural language (name, email, phone, company)
2. Determine if it's a search (multiple results) or lookup (specific contact)
3. Return relevant contact information clearly
4. Handle cases where no contacts are found

Important:
- Contact operations are read-only (no create/update/delete)
- Provide concise, relevant contact information
- Handle ambiguous searches by returning multiple matches`,

      operations: [
        'search',         // Search contacts by criteria
        'lookup',         // Get specific contact
        'find'            // Find contacts matching pattern
      ],

      services: ['contactService'],

      auth: {
        type: 'oauth',
        provider: 'google'
      },

      capabilities: [
        'Search contacts by name, email, or phone',
        'Lookup specific contact information',
        'Find contacts by company or organization',
        'Retrieve contact details'
      ],

      // Removed draft rules - no longer needed

      limitations: [
        'Read-only access - cannot create or modify contacts',
        'Requires Google Contacts OAuth authentication',
        'Limited to authorized account contacts'
      ]
    };
  }

  /**
   * Execute internal operations - the only agent-specific logic
   */
  protected async executeOperation(
    operation: string,
    parameters: any,
    authToken: string
  ): Promise<ContactResult> {
    const contactService = this.getService('contactService') as ContactService;

    if (!contactService) {
      throw new Error('ContactService not available');
    }

    switch (operation) {
      case 'search':
      case 'find': {
        // Search for contacts
        const { query, name, email, phone, company } = parameters;

        // Build search query
        const searchQuery = query || name || email || phone || company || '';

        const result = await contactService.searchContacts(searchQuery, authToken);

        return {
          success: true,
          contacts: result.contacts || [],
          count: result.totalCount || 0
        };
      }

      case 'lookup': {
        // Lookup specific contact
        const { query, email, phone, contactId } = parameters;

        // If contactId provided, get specific contact
        if (contactId) {
          const contact = await contactService.getContact(contactId, authToken);
          return {
            success: true,
            contact,
            contacts: [contact],
            count: 1
          };
        }

        // Otherwise search and return first match
        const searchQuery = query || email || phone || '';
        const result = await contactService.searchContacts(searchQuery, authToken);

        return {
          success: true,
          contact: result.contacts?.[0],
          contacts: result.contacts || [],
          count: result.totalCount || 0
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }


  /**
   * Get agent capabilities (for MasterAgent discovery)
   */
  static getCapabilities(): string[] {
    const instance = new ContactAgent();
    const config = instance.getAgentConfig();
    return config.capabilities || config.operations;
  }
}
