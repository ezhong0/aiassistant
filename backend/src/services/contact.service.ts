import { google, people_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { authService } from './auth.service';
import logger from '../utils/logger';
import {
  Contact,
  ContactSearchRequest,
  ContactSearchResult,
  GoogleContact,
  GooglePeopleResponse,
  GoogleOtherContactsResponse,
  ContactServiceError
} from '../types/contact.types';

export class ContactService {
  private people: people_v1.People;

  constructor() {
    this.people = google.people('v1');
    logger.info('Contact service initialized');
  }

  /**
   * Get authenticated People API client for a user
   */
  private getAuthenticatedClient(accessToken: string): OAuth2Client {
    const oauth2Client = authService.getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
  }

  /**
   * Set authentication for People API
   */
  private setAuth(accessToken: string): void {
    const oauth2Client = this.getAuthenticatedClient(accessToken);
    google.options({ auth: oauth2Client });
  }

  /**
   * Search contacts by query string
   */
  async searchContacts(
    accessToken: string, 
    searchRequest: ContactSearchRequest
  ): Promise<ContactSearchResult> {
    try {
      this.setAuth(accessToken);
      
      logger.info('Searching contacts', { 
        query: searchRequest.query,
        includeOtherContacts: searchRequest.includeOtherContacts 
      });

      const allContacts: Contact[] = [];

      // Search regular contacts
      const regularContacts = await this.searchRegularContacts(
        searchRequest.query, 
        searchRequest.maxResults
      );
      allContacts.push(...regularContacts);

      // Search other contacts (frequently contacted) if enabled
      if (searchRequest.includeOtherContacts !== false) {
        const otherContacts = await this.searchOtherContacts(
          searchRequest.query,
          searchRequest.maxResults
        );
        allContacts.push(...otherContacts);
      }

      // Sort by confidence score and interaction frequency
      const sortedContacts = this.rankContactsByRelevance(allContacts, searchRequest.query);
      
      // Limit results
      const maxResults = searchRequest.maxResults || 10;
      const limitedContacts = sortedContacts.slice(0, maxResults);

      logger.info('Contact search completed', { 
        totalFound: allContacts.length,
        returned: limitedContacts.length,
        query: searchRequest.query 
      });

      return {
        contacts: limitedContacts,
        totalCount: allContacts.length,
        searchQuery: searchRequest.query,
        hasMore: allContacts.length > maxResults
      };

    } catch (error) {
      logger.error('Failed to search contacts', { error, query: searchRequest.query });
      throw this.handleContactError(error, 'SEARCH_FAILED');
    }
  }

  /**
   * Search regular Google Contacts
   */
  private async searchRegularContacts(query: string, maxResults?: number): Promise<Contact[]> {
    try {
      const response = await this.people.people.connections.list({
        resourceName: 'people/me',
        personFields: 'names,emailAddresses,phoneNumbers,metadata',
        pageSize: maxResults || 100
      });

      if (!response.data.connections) {
        return [];
      }

      return this.filterAndConvertContacts(response.data.connections, query, 'contacts');
    } catch (error) {
      logger.error('Failed to search regular contacts', { error, query });
      return [];
    }
  }

  /**
   * Search other contacts (frequently contacted people)
   */
  private async searchOtherContacts(query: string, maxResults?: number): Promise<Contact[]> {
    try {
      const response = await this.people.otherContacts.list({
        pageSize: maxResults || 100,
        readMask: 'names,emailAddresses,phoneNumbers,metadata'
      });

      if (!response.data.otherContacts) {
        return [];
      }

      return this.filterAndConvertContacts(response.data.otherContacts, query, 'other_contacts');
    } catch (error) {
      logger.error('Failed to search other contacts', { error, query });
      return [];
    }
  }

  /**
   * Filter contacts by query and convert to our Contact format
   */
  private filterAndConvertContacts(
    googleContacts: GoogleContact[], 
    query: string, 
    source: 'contacts' | 'other_contacts'
  ): Contact[] {
    const contacts: Contact[] = [];

    for (const googleContact of googleContacts) {
      const contact = this.convertGoogleContact(googleContact, source);
      if (contact && this.matchesQuery(contact, query)) {
        contact.confidence = this.calculateMatchConfidence(contact, query);
        contacts.push(contact);
      }
    }

    return contacts;
  }

  /**
   * Convert Google Contact to our Contact format
   */
  private convertGoogleContact(
    googleContact: GoogleContact, 
    source: 'contacts' | 'other_contacts'
  ): Contact | null {
    try {
      // Extract name
      const name = googleContact.names?.[0]?.displayName || 
                   `${googleContact.names?.[0]?.givenName || ''} ${googleContact.names?.[0]?.familyName || ''}`.trim();
      
      // Extract primary email
      const email = googleContact.emailAddresses?.[0]?.value;
      
      if (!name || !email) {
        return null; // Skip contacts without name or email
      }

      // Extract phone (optional)
      const phone = googleContact.phoneNumbers?.[0]?.value;

      // Extract metadata for interaction info
      const metadata = googleContact.metadata?.sources?.[0];
      const lastInteraction = metadata?.updateTime ? new Date(metadata.updateTime) : undefined;

      return {
        id: googleContact.resourceName || `${source}_${Date.now()}`,
        name,
        email,
        phone,
        source,
        lastInteraction,
        interactionCount: source === 'other_contacts' ? 1 : undefined, // Other contacts imply interaction
        confidence: 0 // Will be calculated later
      };
    } catch (error) {
      logger.warn('Failed to convert Google contact', { error, googleContact });
      return null;
    }
  }

  /**
   * Check if contact matches search query
   */
  private matchesQuery(contact: Contact, query: string): boolean {
    const searchTerms = query.toLowerCase().split(/\s+/);
    const contactText = `${contact.name} ${contact.email}`.toLowerCase();

    // Check if all search terms are found in contact
    return searchTerms.every(term => 
      contactText.includes(term) || 
      this.fuzzyMatch(contactText, term)
    );
  }

  /**
   * Simple fuzzy matching for typos and partial matches
   */
  private fuzzyMatch(text: string, term: string): boolean {
    if (term.length < 3) return false; // Skip fuzzy match for very short terms
    
    // Check for partial matches at word boundaries
    const words = text.split(/\s+/);
    return words.some(word => 
      word.startsWith(term) || 
      this.levenshteinDistance(word, term) <= 1
    );
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate match confidence score (0-1)
   */
  private calculateMatchConfidence(contact: Contact, query: string): number {
    const queryLower = query.toLowerCase();
    const nameLower = contact.name.toLowerCase();
    const emailLower = contact.email.toLowerCase();

    let confidence = 0;

    // Exact name match gets highest score
    if (nameLower === queryLower) {
      confidence = 1.0;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      confidence = 0.9;
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      confidence = 0.7;
    }
    // Email matches
    else if (emailLower.includes(queryLower)) {
      confidence = 0.6;
    }
    // Fuzzy match
    else {
      const nameWords = nameLower.split(/\s+/);
      const maxWordMatch = Math.max(...nameWords.map(word => {
        if (word.startsWith(queryLower)) return 0.8;
        if (this.levenshteinDistance(word, queryLower) <= 1) return 0.5;
        return 0;
      }));
      confidence = maxWordMatch;
    }

    // Boost confidence for frequently contacted people
    if (contact.source === 'other_contacts') {
      confidence = Math.min(1.0, confidence + 0.1);
    }

    return confidence;
  }

  /**
   * Rank contacts by relevance (confidence, frequency, recency)
   */
  private rankContactsByRelevance(contacts: Contact[], query: string): Contact[] {
    return contacts.sort((a, b) => {
      // Primary sort by confidence
      if (a.confidence !== b.confidence) {
        return (b.confidence || 0) - (a.confidence || 0);
      }

      // Secondary sort by source (regular contacts first for equal confidence)
      if (a.source !== b.source) {
        return a.source === 'contacts' ? -1 : 1;
      }

      // Tertiary sort by interaction frequency
      if (a.interactionCount !== b.interactionCount) {
        return (b.interactionCount || 0) - (a.interactionCount || 0);
      }

      // Final sort by last interaction time
      if (a.lastInteraction && b.lastInteraction) {
        return b.lastInteraction.getTime() - a.lastInteraction.getTime();
      }

      // Fallback to alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get a specific contact by email
   */
  async getContactByEmail(accessToken: string, email: string): Promise<Contact | null> {
    try {
      const searchResult = await this.searchContacts(accessToken, {
        query: email,
        maxResults: 1,
        includeOtherContacts: true
      });

      // Return exact email match if found
      const exactMatch = searchResult.contacts.find(contact => 
        contact.email.toLowerCase() === email.toLowerCase()
      );

      return exactMatch || null;
    } catch (error) {
      logger.error('Failed to get contact by email', { error, email });
      return null;
    }
  }

  /**
   * Handle Contact API errors
   */
  private handleContactError(error: any, operation: string): ContactServiceError {
    if (error instanceof ContactServiceError) {
      return error;
    }

    const message = error?.message || 'Unknown Contact API error';
    const code = error?.code || operation;
    
    logger.error('Contact API error', { operation, error: message, code });
    
    return new ContactServiceError(message, code, error);
  }
}

// Export singleton instance
export const contactService = new ContactService();