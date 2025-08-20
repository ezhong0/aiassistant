import logger from '../utils/logger';
import { contactService } from '../services/contact.service';
import {
  Contact,
  ContactAgentRequest,
  ContactAgentResponse,
  ContactSearchRequest,
  ContactServiceError
} from '../types/contact.types';

export class ContactAgent {
  private readonly systemPrompt = `# Contact Agent
You are a specialized contact management agent that helps users find, lookup, and manage their contacts.

## Capabilities
- Search user's Google Contacts and frequently contacted people
- Find contacts by name, partial name, or email address
- Use fuzzy matching for natural language queries
- Rank results by relevance and interaction frequency
- Handle typos and partial matches

## Input Processing
You receive natural language queries about contacts and resolve them to specific contact information.

## Search Strategies
1. Exact name matching (highest priority)
2. Partial name matching
3. Email address matching
4. Fuzzy matching for typos
5. Include frequently contacted people from email history

## Response Format
Always return structured contact information that other agents can use directly.
`;

  /**
   * Process contact-related queries
   */
  async processQuery(request: ContactAgentRequest, accessToken: string): Promise<ContactAgentResponse> {
    try {
      logger.info('ContactAgent processing query', { 
        query: request.query,
        operation: request.operation 
      });

      if (!accessToken) {
        return {
          success: false,
          message: 'Access token required for contact operations',
          error: 'MISSING_ACCESS_TOKEN'
        };
      }

      // Determine the operation type
      const operation = request.operation || this.determineOperation(request.query);

      switch (operation) {
        case 'search':
          return await this.handleSearchContacts(request, accessToken);
        
        case 'create':
          return await this.handleCreateContact(request, accessToken);
        
        case 'update':
          return await this.handleUpdateContact(request, accessToken);
        
        default:
          // Default to search for most queries
          return await this.handleSearchContacts(request, accessToken);
      }

    } catch (error) {
      logger.error('Error in ContactAgent.processQuery:', error);
      return {
        success: false,
        message: 'An error occurred while processing your contact request',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Determine operation type from query
   */
  private determineOperation(query: string): 'search' | 'create' | 'update' {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('add') || lowerQuery.includes('create') || lowerQuery.includes('new contact')) {
      return 'create';
    }

    if (lowerQuery.includes('update') || lowerQuery.includes('change') || lowerQuery.includes('modify')) {
      return 'update';
    }

    // Default to search
    return 'search';
  }

  /**
   * Handle contact search queries
   */
  private async handleSearchContacts(
    request: ContactAgentRequest, 
    accessToken: string
  ): Promise<ContactAgentResponse> {
    try {
      // Extract search parameters from query
      const searchParams = this.extractSearchParameters(request.query);
      
      const searchRequest: ContactSearchRequest = {
        query: searchParams.searchTerm,
        maxResults: searchParams.maxResults || 10,
        includeOtherContacts: true // Always include frequently contacted
      };

      const searchResult = await contactService.searchContacts(accessToken, searchRequest);

      if (searchResult.contacts.length === 0) {
        return {
          success: true,
          message: `No contacts found matching "${searchParams.searchTerm}"`,
          data: {
            contacts: [],
            totalCount: 0
          }
        };
      }

      // Format response message
      const contactNames = searchResult.contacts.slice(0, 3).map(c => c.name).join(', ');
      const message = searchResult.contacts.length === 1
        ? `Found contact: ${searchResult.contacts[0].name} (${searchResult.contacts[0].email})`
        : `Found ${searchResult.contacts.length} contacts: ${contactNames}${searchResult.contacts.length > 3 ? ' and others' : ''}`;

      logger.info('Contact search completed successfully', {
        query: searchParams.searchTerm,
        foundCount: searchResult.contacts.length
      });

      return {
        success: true,
        message,
        data: {
          contacts: searchResult.contacts,
          totalCount: searchResult.totalCount
        }
      };

    } catch (error) {
      logger.error('Failed to search contacts:', error);
      return {
        success: false,
        message: 'Failed to search contacts',
        error: error instanceof ContactServiceError ? error.code : 'SEARCH_FAILED'
      };
    }
  }

  /**
   * Handle contact creation (placeholder - would require People API write permissions)
   */
  private async handleCreateContact(
    request: ContactAgentRequest, 
    accessToken: string
  ): Promise<ContactAgentResponse> {
    // Note: Creating contacts requires additional permissions and implementation
    logger.info('Contact creation requested (not implemented)', { query: request.query });
    
    return {
      success: false,
      message: 'Contact creation not yet implemented. This requires additional Google API permissions.',
      error: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Handle contact updates (placeholder - would require People API write permissions)
   */
  private async handleUpdateContact(
    request: ContactAgentRequest, 
    accessToken: string
  ): Promise<ContactAgentResponse> {
    // Note: Updating contacts requires additional permissions and implementation
    logger.info('Contact update requested (not implemented)', { query: request.query });
    
    return {
      success: false,
      message: 'Contact updates not yet implemented. This requires additional Google API permissions.',
      error: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Extract search parameters from natural language query
   */
  private extractSearchParameters(query: string): {
    searchTerm: string;
    maxResults?: number;
  } {
    // Remove common search phrases to extract the actual search term
    const cleanedQuery = query
      .replace(/^(find|search|look for|get|lookup|contact|contacts?)\s+/i, '')
      .replace(/\s+(contact|contacts?|information|info|details?)$/i, '')
      .trim();

    // Extract search term (everything that's not a number or command)
    let searchTerm = cleanedQuery;
    let maxResults: number | undefined;

    // Look for result limit requests
    const limitMatch = query.match(/(?:first|top|limit)\s+(\d+)/i);
    if (limitMatch) {
      maxResults = parseInt(limitMatch[1]);
      searchTerm = searchTerm.replace(/(?:first|top|limit)\s+\d+/i, '').trim();
    }

    // Handle various query formats
    const queryFormats = [
      // "find contact for john" -> "john"
      /(?:find|search|get)\s+(?:contact|info|information)\s+for\s+(.+)/i,
      // "lookup john smith" -> "john smith"
      /(?:lookup|find|search)\s+(.+)/i,
      // "contact john" -> "john"
      /contact\s+(.+)/i,
      // "get john's email" -> "john"
      /get\s+(.+?)(?:'s\s+(?:email|phone|contact))/i
    ];

    for (const format of queryFormats) {
      const match = searchTerm.match(format);
      if (match && match[1]) {
        searchTerm = match[1].trim();
        break;
      }
    }

    // If no specific pattern matched, use the cleaned query as-is
    if (!searchTerm || searchTerm.length < 1) {
      searchTerm = cleanedQuery || query;
    }

    return {
      searchTerm,
      maxResults
    };
  }

  /**
   * Format contacts for use by other agents (especially EmailAgent)
   */
  static formatContactsForAgent(contacts: Contact[]): Array<{
    name: string;
    email: string;
    phone?: string;
  }> {
    return contacts.map(contact => ({
      name: contact.name,
      email: contact.email,
      phone: contact.phone
    }));
  }

  /**
   * Get the best matching contact from a search result
   */
  static getBestMatch(contacts: Contact[]): Contact | null {
    if (contacts.length === 0) return null;
    
    // Return the first contact (highest confidence due to ranking)
    return contacts[0];
  }

  /**
   * Check if a search result is ambiguous (multiple good matches)
   */
  static isAmbiguous(contacts: Contact[], confidenceThreshold: number = 0.8): boolean {
    if (contacts.length < 2) return false;
    
    // Check if we have multiple contacts with high confidence
    const highConfidenceContacts = contacts.filter(c => (c.confidence || 0) >= confidenceThreshold);
    return highConfidenceContacts.length > 1;
  }

  /**
   * Get system prompt for external use
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}

export const contactAgent = new ContactAgent();