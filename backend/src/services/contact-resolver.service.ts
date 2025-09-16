import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { ContactService } from './contact.service';
import { Contact, ContactSearchResult } from '../types/contact.types';
import logger from '../utils/logger';

/**
 * Contact resolution result
 */
export interface ContactResolutionResult {
  success: boolean;
  contact?: Contact;
  contacts?: Contact[];
  error?: string;
  resolutionMethod: 'exact_match' | 'fuzzy_match' | 'not_found';
}

/**
 * Contact validation result
 */
export interface ContactValidationResult {
  isValid: boolean;
  email?: string;
  error?: string;
  validationType: 'email_format' | 'contact_exists' | 'invalid';
}

/**
 * ContactResolver - Focused service for contact resolution and validation
 * Handles finding contacts by name, email, or other identifiers
 */
export class ContactResolver extends BaseService {
  private contactService: ContactService | null = null;

  constructor() {
    super('ContactResolver');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing ContactResolver...');

      // Get Contact service from service manager
      const serviceManager = ServiceManager.getInstance();
      this.contactService = serviceManager.getService('contactService') as ContactService;

      if (!this.contactService) {
        throw new Error('ContactService not available');
      }

      this.logInfo('ContactResolver initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.contactService = null;
      this.logInfo('ContactResolver destroyed successfully');
    } catch (error) {
      this.logError('Error during ContactResolver destruction', error);
    }
  }

  /**
   * Resolve contact by email address
   */
  async resolveByEmail(email: string, accessToken: string): Promise<ContactResolutionResult> {
    try {
      if (!this.contactService) {
        throw new Error('ContactService not available');
      }

      this.logInfo('Resolving contact by email', { email });

      // First validate email format
      const validation = this.validateEmailFormat(email);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          resolutionMethod: 'not_found'
        };
      }

      // Search for contact by email using existing ContactService interface
      const contacts = await this.contactService.searchContactsByEmail(email, accessToken);

      if (contacts.length === 0) {
        return {
          success: false,
          error: `No contact found with email: ${email}`,
          resolutionMethod: 'not_found'
        };
      }

      // Return exact match if found
      const exactMatch = contacts.find(contact => 
        contact.email.toLowerCase() === email.toLowerCase()
      );

      if (exactMatch) {
        this.logInfo('Contact resolved by exact email match', {
          contactId: exactMatch.id,
          name: exactMatch.name
        });

        return {
          success: true,
          contact: exactMatch,
          resolutionMethod: 'exact_match'
        };
      }

      // Return first fuzzy match
      const firstContact = contacts[0];
      if (firstContact) {
        this.logInfo('Contact resolved by fuzzy email match', {
          contactId: firstContact.id,
          name: firstContact.name
        });

        return {
          success: true,
          contact: firstContact,
          resolutionMethod: 'fuzzy_match'
        };
      }

      return {
        success: false,
        error: 'No contacts found',
        resolutionMethod: 'not_found'
      };
    } catch (error) {
      this.logError('Error resolving contact by email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        resolutionMethod: 'not_found'
      };
    }
  }

  /**
   * Resolve contact by name
   */
  async resolveByName(name: string, accessToken: string): Promise<ContactResolutionResult> {
    try {
      if (!this.contactService) {
        throw new Error('ContactService not available');
      }

      this.logInfo('Resolving contact by name', { name });

      // Search for contacts by name using existing ContactService interface
      const searchResult = await this.contactService.searchContacts(name, accessToken);

      if (!searchResult.contacts || searchResult.contacts.length === 0) {
        return {
          success: false,
          error: `No contact found with name: ${name}`,
          resolutionMethod: 'not_found'
        };
      }

      const contacts = searchResult.contacts;

      // Look for exact name match first
      const exactMatch = contacts.find(contact => 
        contact.name?.toLowerCase() === name.toLowerCase()
      );

      if (exactMatch) {
        this.logInfo('Contact resolved by exact name match', {
          contactId: exactMatch.id,
          name: exactMatch.name
        });

        return {
          success: true,
          contact: exactMatch,
          resolutionMethod: 'exact_match'
        };
      }

      // Return all fuzzy matches for user to choose from
      this.logInfo('Contact resolved by fuzzy name match', {
        matchCount: contacts.length,
        names: contacts.map(c => c.name)
      });

      return {
        success: true,
        contacts: contacts,
        resolutionMethod: 'fuzzy_match'
      };
    } catch (error) {
      this.logError('Error resolving contact by name', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        resolutionMethod: 'not_found'
      };
    }
  }

  /**
   * Validate email format
   */
  validateEmailFormat(email: string): ContactValidationResult {
    try {
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailRegex.test(email)) {
        return {
          isValid: false,
          error: 'Invalid email format',
          validationType: 'email_format'
        };
      }

      return {
        isValid: true,
        email: email.toLowerCase(),
        validationType: 'email_format'
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Email validation failed',
        validationType: 'invalid'
      };
    }
  }

  /**
   * Check if contact exists
   */
  async checkContactExists(email: string, accessToken: string): Promise<ContactValidationResult> {
    try {
      const resolution = await this.resolveByEmail(email, accessToken);
      
      if (resolution.success) {
        return {
          isValid: true,
          email: resolution.contact?.email,
          validationType: 'contact_exists'
        };
      }

      return {
        isValid: false,
        error: resolution.error,
        validationType: 'contact_exists'
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        validationType: 'invalid'
      };
    }
  }

  /**
   * Disambiguate multiple contacts
   */
  async disambiguateContacts(contacts: Contact[], context?: string): Promise<Contact | null> {
    try {
      if (contacts.length === 0) {
        return null;
      }

      if (contacts.length === 1) {
        return contacts[0] || null;
      }

      // Simple disambiguation logic - return contact with most complete info
      const scoredContacts = contacts.map(contact => ({
        contact,
        score: this.calculateContactScore(contact)
      }));

      // Sort by score (highest first)
      scoredContacts.sort((a, b) => b.score - a.score);

      const selectedContact = scoredContacts[0];
      if (selectedContact) {
        this.logInfo('Contact disambiguation completed', {
          totalContacts: contacts.length,
          selectedContact: selectedContact.contact.name,
          score: selectedContact.score
        });

        return selectedContact.contact;
      }

      return null;
    } catch (error) {
      this.logError('Error disambiguating contacts', error);
      return contacts[0] || null; // Fallback to first contact
    }
  }

  /**
   * Calculate contact completeness score
   */
  private calculateContactScore(contact: Contact): number {
    let score = 0;
    
    // Email completeness
    if (contact.email) {
      score += 10;
    }
    
    // Name completeness
    if (contact.name) {
      score += 5;
    }
    
    // Phone completeness
    if (contact.phone) {
      score += 5;
    }
    
    // Note: Contact type doesn't have organization field in current schema

    return score;
  }

  /**
   * Get contact resolver statistics
   */
  getResolverStats(): {
    serviceName: string;
    hasContactService: boolean;
  } {
    return {
      serviceName: 'ContactResolver',
      hasContactService: !!this.contactService
    };
  }
}
