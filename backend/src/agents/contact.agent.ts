import { BaseAgent } from '../framework/base-agent';
import { ToolExecutionContext, ContactAgentParams } from '../types/tools';
import { getService } from '../services/service-manager';
import { ContactService } from '../services/contact.service';
import {
  Contact,
  ContactSearchRequest
} from '../types/contact.types';
import { CONTACT_CONSTANTS } from '../config/constants';

/**
 * Contact operation result interface
 */
export interface ContactResult {
  contacts: Contact[];
  totalCount: number;
  operation: 'search' | 'create' | 'update';
  searchTerm?: string;
}

/**
 * Contact agent parameters with access token
 */
export interface ContactAgentRequest extends ContactAgentParams {
  accessToken: string;
  operation?: 'search' | 'create' | 'update';
}

/**
 * Enhanced ContactAgent using BaseAgent framework
 * Handles contact search and management using Google Contacts API
 */
export class ContactAgent extends BaseAgent<ContactAgentRequest, ContactResult> {
  
  constructor() {
    super({
      name: 'contactAgent',
      description: 'Search and manage contacts from Google Contacts and email history',
      enabled: true,
      timeout: 15000,
      retryCount: 2
    });
  }
  
  /**
   * Core contact processing logic - simplified and focused
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async processQuery(params: ContactAgentRequest, _context: ToolExecutionContext): Promise<ContactResult> {
    const { query } = params;
    
    // Determine the operation type
    const operation = params.operation || this.determineOperation(query);
    
    switch (operation) {
      case 'search':
        return await this.handleSearchContacts(params);
      case 'create':
        return await this.handleCreateContact(params);
      case 'update':
        return await this.handleUpdateContact(params);
      default:
        // Default to search for most queries
        return await this.handleSearchContacts(params);
    }
  }
  
  /**
   * Enhanced parameter validation for contact operations
   */
  protected validateParams(params: ContactAgentRequest): void {
    super.validateParams(params);
    
    if (!params.accessToken || typeof params.accessToken !== 'string') {
      throw this.createError('Access token is required for contact operations', 'MISSING_ACCESS_TOKEN');
    }
    
    if (params.query && params.query.length > CONTACT_CONSTANTS.MAX_NAME_LENGTH * 2) {
      throw this.createError('Query is too long for contact search', 'QUERY_TOO_LONG');
    }
  }
  
  /**
   * Pre-execution hook - validate Google Contacts access
   */
  protected async beforeExecution(params: ContactAgentRequest, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    
    // Log contact operation start
    this.logger.debug('Google Contacts access validated', { 
      sessionId: context.sessionId,
      operation: params.operation || 'search'
    });
  }
  
  /**
   * Post-execution hook - log contact metrics
   */
  protected async afterExecution(result: ContactResult, context: ToolExecutionContext): Promise<void> {
    await super.afterExecution(result, context);
    
    // Log contact operation metrics
    this.logger.info('Contact operation completed', {
      operation: result.operation,
      contactsFound: result.totalCount,
      searchTerm: result.searchTerm?.substring(0, 50),
      sessionId: context.sessionId
    });
  }
  
  /**
   * Sanitize sensitive data from logs
   */
  protected sanitizeForLogging(params: ContactAgentRequest): any {
    return {
      query: params.query?.substring(0, 100) + (params.query?.length > 100 ? '...' : ''),
      accessToken: '[REDACTED]',
      operation: params.operation,
      name: params.name,
      email: params.email ? '[EMAIL]' : undefined,
      phone: params.phone ? '[PHONE]' : undefined
    };
  }
  
  // PRIVATE IMPLEMENTATION METHODS
  
  /**
   * Handle contact search queries
   */
  private async handleSearchContacts(params: ContactAgentRequest): Promise<ContactResult> {
    // Extract search parameters from query
    const searchParams = this.extractSearchParameters(params.query);
    
    const searchRequest: ContactSearchRequest = {
      query: searchParams.searchTerm,
      maxResults: Math.min(
        searchParams.maxResults || CONTACT_CONSTANTS.DEFAULT_SEARCH_RESULTS,
        CONTACT_CONSTANTS.MAX_SEARCH_RESULTS
      ),
      includeOtherContacts: true // Always include frequently contacted
    };

    // Use retry mechanism from BaseAgent for reliability
    const searchResult = await this.withRetries(async () => {
      const contactService = getService<ContactService>('contactService');
      if (!contactService) {
        throw new Error('Contact service not available');
      }
      return await contactService.searchContacts(searchRequest.query, params.accessToken);
    });

    this.logger.info('Contact search completed successfully', {
      query: searchParams.searchTerm,
      foundCount: searchResult.contacts.length
    });

    return {
      contacts: searchResult.contacts,
      totalCount: searchResult.totalCount,
      operation: 'search',
      searchTerm: searchParams.searchTerm
    };
  }
  
  /**
   * Handle contact creation (placeholder - requires additional permissions)
   */
  private async handleCreateContact(params: ContactAgentRequest): Promise<ContactResult> {
    this.logger.info('Contact creation requested (not implemented)', { query: params.query });
    
    throw this.createError(
      'Contact creation not yet implemented. This requires additional Google API permissions.',
      'NOT_IMPLEMENTED'
    );
  }
  
  /**
   * Handle contact updates (placeholder - requires additional permissions)
   */
  private async handleUpdateContact(params: ContactAgentRequest): Promise<ContactResult> {
    this.logger.info('Contact update requested (not implemented)', { query: params.query });
    
    throw this.createError(
      'Contact updates not yet implemented. This requires additional Google API permissions.',
      'NOT_IMPLEMENTED'
    );
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
    
    // Look for result limit requests
    let maxResults: number | undefined;
    const limitMatch = query.match(/(?:first|top|limit)\s+(\d+)/i);
    if (limitMatch && limitMatch[1]) {
      maxResults = Math.min(parseInt(limitMatch[1]), CONTACT_CONSTANTS.MAX_SEARCH_RESULTS);
    }

    return {
      searchTerm: cleanedQuery || query,
      maxResults
    };
  }
  
  // STATIC UTILITY METHODS (for other agents to use)
  
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
    return contacts[0] || null;
  }
  
  /**
   * Check if a search result is ambiguous (multiple good matches)
   */
  static isAmbiguous(contacts: Contact[], confidenceThreshold: number = CONTACT_CONSTANTS.HIGH_CONFIDENCE_THRESHOLD): boolean {
    if (contacts.length < 2) return false;
    
    // Check if we have multiple contacts with high confidence
    const highConfidenceContacts = contacts.filter(c => (c.confidence || 0) >= confidenceThreshold);
    return highConfidenceContacts.length > 1;
  }
  
  /**
   * Filter contacts by minimum confidence score
   */
  static filterByConfidence(contacts: Contact[], minConfidence: number = CONTACT_CONSTANTS.MIN_CONFIDENCE_SCORE): Contact[] {
    return contacts.filter(contact => (contact.confidence || 0) >= minConfidence);
  }
}

// Export the class for use with AgentFactory
export { ContactAgent };