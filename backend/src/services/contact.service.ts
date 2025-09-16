import { google } from 'googleapis';
import { Contact, ContactSearchResult, ContactServiceError } from '../types/contact.types';
import { BaseService } from './base-service';
import logger from '../utils/logger';

interface GooglePerson {
  resourceName: string;
  names?: Array<{
    displayName?: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value?: string;
    type?: string;
  }>;
  phoneNumbers?: Array<{
    value?: string;
    type?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  photos?: Array<{
    url?: string;
  }>;
}

interface GooglePeopleResponse {
  people?: GooglePerson[];
  connections?: GooglePerson[];
}

export class ContactService extends BaseService {
  private peopleService: any;

  constructor() {
    super('ContactService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Initialize Google People API service
      this.peopleService = google.people('v1');
      
      this.logInfo('Contact service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize contact service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('Contact service destroyed');
  }

  /**
   * Search for contacts by name or email
   */
  async searchContacts(query: string, accessToken: string): Promise<ContactSearchResult> {
    this.assertReady();
    
    try {
      this.logDebug('Searching contacts', { query, queryLength: query.length });

      const response = await this.peopleService.people.searchDirectoryPeople({
        query,
        readMask: 'names,emailAddresses,photos',
        sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'],
        access_token: accessToken
      });

      if (!response.data.people) {
        this.logDebug('No contacts found', { query });
        return {
          contacts: [],
          totalCount: 0,
          totalResults: 0,
          searchQuery: query,
          query,
          hasMore: false
        };
      }

      const contacts: Contact[] = response.data.people.map((person: GooglePerson) => ({
        id: person.resourceName,
        name: person.names?.[0]?.displayName || 'Unknown',
        email: person.emailAddresses?.[0]?.value || '',
        photo: person.photos?.[0]?.url || null,
        source: 'contacts'
      }));

      this.logInfo('Contact search completed', { 
        query, 
        foundCount: contacts.length 
      });

      return {
        contacts,
        totalCount: contacts.length,
        totalResults: contacts.length,
        searchQuery: query,
        query,
        hasMore: false
      };
    } catch (error) {
      this.handleError(error, 'searchContacts');
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: string, accessToken: string): Promise<Contact | null> {
    this.assertReady();
    
    try {
      this.logDebug('Getting contact by ID', { contactId });

      const response = await this.peopleService.people.get({
        resourceName: contactId,
        personFields: 'names,emailAddresses,photos',
        access_token: accessToken
      });

      if (!response.data) {
        this.logDebug('Contact not found', { contactId });
        return null;
      }

      const person = response.data;
      const contact: Contact = {
        id: person.resourceName,
        name: person.names?.[0]?.displayName || 'Unknown',
        email: person.emailAddresses?.[0]?.value || '',
        photo: person.photos?.[0]?.url || null,
        source: 'contacts'
      };

      this.logDebug('Contact retrieved successfully', { 
        contactId, 
        name: contact.name,
        hasEmail: !!contact.email 
      });

      return contact;
    } catch (error) {
      this.handleError(error, 'getContact');
    }
  }

  /**
   * Create a new contact
   */
  async createContact(contactData: Omit<Contact, 'id'>, accessToken: string): Promise<Contact> {
    this.assertReady();
    
    try {
      this.logDebug('Creating new contact', { 
        name: contactData.name,
        hasEmail: !!contactData.email 
      });

      const person = {
        names: [{ displayName: contactData.name }],
        emailAddresses: contactData.email ? [{ value: contactData.email }] : []
      };

      const response = await this.peopleService.people.createContact({
        requestBody: person,
        access_token: accessToken
      });

      if (!response.data.resourceName) {
        throw new Error('Failed to create contact: no resource name returned');
      }

      const newContact: Contact = {
        id: response.data.resourceName,
        name: contactData.name,
        email: contactData.email || '',
        photo: contactData.photo,
        source: 'contacts'
      };

      this.logInfo('Contact created successfully', { 
        contactId: newContact.id,
        name: newContact.name 
      });

      return newContact;
    } catch (error) {
      this.handleError(error, 'createContact');
    }
  }

  /**
   * Update an existing contact
   */
  async updateContact(contactId: string, updates: Partial<Contact>, accessToken: string): Promise<Contact> {
    this.assertReady();
    
    try {
      this.logDebug('Updating contact', { 
        contactId, 
        updateFields: Object.keys(updates) 
      });

      // Get current contact first
      const currentContact = await this.getContact(contactId, accessToken);
      if (!currentContact) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {};
      
      if (updates.name !== undefined) {
        updateData.names = [{ displayName: updates.name }];
      }
      
      if (updates.email !== undefined) {
        updateData.emailAddresses = updates.email ? [{ value: updates.email }] : [];
      }

      const response = await this.peopleService.people.updateContact({
        resourceName: contactId,
        requestBody: updateData,
        updatePersonFields: Object.keys(updateData).join(','),
        access_token: accessToken
      });

      if (!response.data.resourceName) {
        throw new Error('Failed to update contact: no resource name returned');
      }

      const updatedContact: Contact = {
        id: contactId,
        name: updates.name ?? currentContact.name,
        email: updates.email ?? currentContact.email,
        photo: updates.photo ?? currentContact.photo,
        source: 'contacts'
      };

      this.logInfo('Contact updated successfully', { 
        contactId, 
        name: updatedContact.name 
      });

      return updatedContact;
    } catch (error) {
      this.handleError(error, 'updateContact');
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string, accessToken: string): Promise<void> {
    this.assertReady();
    
    try {
      this.logDebug('Deleting contact', { contactId });

      await this.peopleService.people.deleteContact({
        resourceName: contactId,
        access_token: accessToken
      });

      this.logInfo('Contact deleted successfully', { contactId });
    } catch (error) {
      this.handleError(error, 'deleteContact');
    }
  }

  /**
   * Search contacts by email address
   */
  async searchContactsByEmail(email: string, accessToken: string): Promise<Contact[]> {
    this.assertReady();
    
    try {
      this.logDebug('Searching contacts by email', { email });

      const response = await this.peopleService.people.searchDirectoryPeople({
        query: email,
        readMask: 'names,emailAddresses,photos',
        sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'],
        access_token: accessToken
      });

      if (!response.data.people) {
        this.logDebug('No contacts found by email', { email });
        return [];
      }

      const contacts: Contact[] = response.data.people
        .filter((person: GooglePerson) => 
          person.emailAddresses?.some((emailAddr) => 
            emailAddr.value?.toLowerCase() === email.toLowerCase()
          )
        )
        .map((person: GooglePerson) => ({
          id: person.resourceName,
          name: person.names?.[0]?.displayName || 'Unknown',
          email: person.emailAddresses?.[0]?.value || '',
          photo: person.photos?.[0]?.url || null,
          source: 'contacts'
        }));

      this.logInfo('Email search completed', { 
        email, 
        foundCount: contacts.length 
      });

      return contacts;
    } catch (error) {
      this.handleError(error, 'searchContactsByEmail');
    }
  }

  /**
   * Get all contacts for a user
   */
  async getAllContacts(accessToken: string, maxResults: number = 100): Promise<Contact[]> {
    this.assertReady();
    
    try {
      this.logDebug('Getting all contacts', { maxResults });

      const response = await this.peopleService.people.connections.list({
        resourceName: 'people/me',
        pageSize: maxResults,
        personFields: 'names,emailAddresses,photos',
        access_token: accessToken
      });

      if (!response.data.connections) {
        this.logDebug('No contacts found');
        return [];
      }

      const contacts: Contact[] = response.data.connections.map((person: GooglePerson) => ({
        id: person.resourceName,
        name: person.names?.[0]?.displayName || 'Unknown',
        email: person.emailAddresses?.[0]?.value || '',
        photo: person.photos?.[0]?.url || null
      }));

      this.logInfo('All contacts retrieved', { 
        totalCount: contacts.length 
      });

      return contacts;
    } catch (error) {
      this.handleError(error, 'getAllContacts');
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.peopleService;
      const details = {
        initialized: this.initialized,
        peopleService: !!this.peopleService,
        googleapis: !!google
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Handle contact service errors
   */
  private handleContactError(error: unknown, operation: string): ContactServiceError {
    let message = 'Unknown error occurred';
    let code = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      message = error.message;
      
      if (message.includes('not found')) {
        code = 'NOT_FOUND';
      } else if (message.includes('permission')) {
        code = 'PERMISSION_DENIED';
      } else if (message.includes('invalid')) {
        code = 'INVALID_INPUT';
      } else if (message.includes('quota')) {
        code = 'QUOTA_EXCEEDED';
      }
    }

    return new ContactServiceError(message, code, error instanceof Error ? error : undefined);
  }
}

// Export the class for registration with ServiceManager