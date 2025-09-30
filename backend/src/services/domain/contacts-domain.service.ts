import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError, APIClientErrorCode } from '../../errors/api-client.errors';
import { ValidationHelper, ContactsValidationSchemas } from '../../validation/api-client.validation';
import { IContactsDomainService, Contact, ContactInput } from './interfaces/contacts-domain.interface';
import { GoogleOAuthManager } from '../oauth/google-oauth-manager';
import { SlackContext } from '../../types/slack/slack.types';

/**
 * Contacts Domain Service - High-level contacts operations using standardized API client
 * 
 * This service provides domain-specific contacts operations that wrap the Google People API.
 * It handles contact creation, management, searching, and organization with a clean interface
 * that's easy to use from agents and other services.
 * 
 * Features:
 * - Create, update, and delete contacts
 * - Search and list contacts with filtering
 * - Manage contact groups and labels
 * - Handle contact photos and metadata
 * - OAuth2 authentication management
 */
export class ContactsDomainService extends BaseService implements Partial<IContactsDomainService> {
  private googleClient: GoogleAPIClient | null = null;

  constructor(private readonly googleOAuthManager: GoogleOAuthManager) {
    super('ContactsDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Contacts Domain Service');
      
      // Get Google API client
      this.googleClient = await getAPIClient<GoogleAPIClient>('google');
      
      this.logInfo('Contacts Domain Service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Contacts Domain Service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.googleClient = null;
      this.logInfo('Contacts Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Contacts Domain Service', error);
    }
  }

  /**
   * OAuth management methods
   */
  async initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const authUrl = await this.googleOAuthManager.generateAuthUrl(context);
    return { authUrl, state: 'generated' }; // TODO: Return actual state from OAuth manager
  }

  async completeOAuth(userId: string, code: string, state: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const result = await this.googleOAuthManager.exchangeCodeForTokens(code, state);
    if (!result.success) {
      throw new Error(result.error || 'OAuth completion failed');
    }
  }

  async refreshTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const success = await this.googleOAuthManager.refreshTokens(userId);
    if (!success) {
      throw new Error('Token refresh failed');
    }
  }

  async revokeTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const success = await this.googleOAuthManager.revokeTokens(userId);
    if (!success) {
      throw new Error('Token revocation failed');
    }
  }

  async requiresOAuth(userId: string): Promise<boolean> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      return true; // Assume OAuth required if manager not available
    }
    
    return await this.googleOAuthManager.requiresOAuth(userId);
  }


  /**
   * List contacts (with automatic authentication)
   */
  async listContacts(userId: string, params?: {
    pageSize?: number;
    pageToken?: string;
    readMask?: string;
    sources?: string[];
    syncToken?: string;
    sortOrder?: 'LAST_MODIFIED_ASCENDING' | 'LAST_MODIFIED_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'LAST_NAME_ASCENDING';
  }): Promise<{
    connections: Array<{
      resourceName: string;
      etag: string;
      metadata: {
        sources: Array<{
          type: string;
          id: string;
          etag?: string;
          updateTime?: string;
        }>;
        objectType: 'PERSON';
      };
      names?: Array<{
        givenName?: string;
        familyName?: string;
        middleName?: string;
        honorificPrefix?: string;
        honorificSuffix?: string;
        phoneticGivenName?: string;
        phoneticFamilyName?: string;
        phoneticMiddleName?: string;
        displayName?: string;
        displayNameLastFirst?: string;
        unstructuredName?: string;
        metadata: {
          primary?: boolean;
          source: {
            type: string;
            id: string;
          };
        };
      }>;
      phoneNumbers?: Array<{
        value: string;
        type: 'home' | 'work' | 'mobile' | 'fax' | 'other';
        primary?: boolean;
      }>;
      emailAddresses?: Array<{
        value: string;
        type: 'home' | 'work' | 'other';
        primary?: boolean;
      }>;
      addresses?: Array<{
        street?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
        type: 'home' | 'work' | 'other';
        primary?: boolean;
      }>;
      organizations?: Array<{
        name?: string;
        title?: string;
        department?: string;
        symbol?: string;
        domain?: string;
        location?: string;
        type?: string;
        primary?: boolean;
      }>;
      photos?: Array<{
        url: string;
        metadata: {
          primary?: boolean;
          source: {
            type: string;
            id: string;
          };
        };
      }>;
    }>;
    nextPageToken?: string;
    nextSyncToken?: string;
    totalPeople?: number;
    totalItems?: number;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'ContactsDomainService' }
      );
    }

    try {
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(ContactsValidationSchemas.listContacts, params);

      this.logInfo('Listing contacts', {
        pageSize: validatedParams.pageSize || 100,
        personFields: validatedParams.personFields || ['names', 'emailAddresses', 'phoneNumbers']
      });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/me/connections',
        query: {
          pageSize: validatedParams.pageSize || 100,
          pageToken: validatedParams.pageToken,
          personFields: (validatedParams.personFields || ['names', 'emailAddresses', 'phoneNumbers']).join(','),
          sortOrder: validatedParams.sortOrder || 'LAST_NAME_ASCENDING'
        }
      });

      const result = {
        connections: response.data.connections || [],
        nextPageToken: response.data.nextPageToken,
        nextSyncToken: response.data.nextSyncToken,
        totalPeople: response.data.totalPeople,
        totalItems: response.data.totalItems
      };

      this.logInfo('Contacts listed successfully', {
        count: result.connections.length,
        totalItems: result.totalItems
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'ContactsDomainService',
        endpoint: 'listContacts',
        method: 'GET'
      });
    }
  }

  /**
   * Create a contact
   */
  async createContact(userId: string, contact: ContactInput): Promise<Contact> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Creating contact', {
        hasNames: !!(contact.names?.length),
        hasEmails: !!(contact.emailAddresses?.length),
        hasPhones: !!(contact.phoneNumbers?.length)
      });

      const contactData = {
        names: contact.names,
        emailAddresses: contact.emailAddresses,
        phoneNumbers: contact.phoneNumbers,
        addresses: contact.addresses,
        organizations: contact.organizations,
        birthdays: contact.birthdays
      };

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/people/v1/people:createContact',
        data: contactData
      });

      const result = {
        resourceName: response.data.resourceName,
        etag: response.data.etag,
        metadata: {
          sources: response.data.metadata?.sources || [],
          objectType: response.data.metadata?.objectType || 'PERSON'
        },
        names: response.data.names,
        emailAddresses: response.data.emailAddresses,
        phoneNumbers: response.data.phoneNumbers,
        addresses: response.data.addresses,
        organizations: response.data.organizations
      };

      this.logInfo('Contact created successfully', {
        resourceName: result.resourceName
      });

      return result;
    } catch (error) {
      this.logError('Failed to create contact', error);
      throw error;
    }
  }

  /**
   * Get a specific contact
   */
  async getContact(contactId: string): Promise<Contact> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Getting contact', { contactId });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/get',
        query: {
          resourceName: contactId,
          personFields: ['names', 'emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'photos'].join(',')
        }
      });

      const result = {
        resourceName: response.data.resourceName,
        etag: response.data.etag,
        metadata: {
          sources: response.data.metadata?.sources || [],
          objectType: response.data.metadata?.objectType || 'PERSON'
        },
        names: response.data.names,
        emailAddresses: response.data.emailAddresses,
        phoneNumbers: response.data.phoneNumbers,
        addresses: response.data.addresses,
        organizations: response.data.organizations,
        photos: response.data.photos
      };

      this.logInfo('Contact retrieved successfully', {
        resourceName: result.resourceName
      });

      return result;
    } catch (error) {
      this.logError('Failed to get contact', error, { contactId });
      throw error;
    }
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, contact: ContactInput, updatePersonFields?: string): Promise<Contact> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Updating contact', { contactId });

      const contactData = {
        names: contact.names,
        emailAddresses: contact.emailAddresses,
        phoneNumbers: contact.phoneNumbers,
        addresses: contact.addresses,
        organizations: contact.organizations,
        birthdays: contact.birthdays
      };

      const response = await this.googleClient.makeRequest({
        method: 'PATCH',
        endpoint: '/people/v1/people/updateContact',
        query: {
          resourceName: contactId,
          updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses,organizations,birthdays'
        },
        data: contactData
      });

      const result = {
        resourceName: response.data.resourceName,
        etag: response.data.etag,
        metadata: {
          sources: response.data.metadata?.sources || [],
          objectType: response.data.metadata?.objectType || 'PERSON'
        },
        names: response.data.names,
        emailAddresses: response.data.emailAddresses,
        phoneNumbers: response.data.phoneNumbers,
        addresses: response.data.addresses,
        organizations: response.data.organizations
      };

      this.logInfo('Contact updated successfully', {
        resourceName: result.resourceName
      });

      return result;
    } catch (error) {
      this.logError('Failed to update contact', error, { contactId });
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(resourceName: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Deleting contact', { resourceName });

      await this.googleClient.makeRequest({
        method: 'DELETE',
        endpoint: '/people/v1/people/deleteContact',
        query: { resourceName }
      });

      this.logInfo('Contact deleted successfully', { resourceName });
    } catch (error) {
      this.logError('Failed to delete contact', error, { resourceName });
      throw error;
    }
  }

  /**
   * Search contacts
   */
  async searchContacts(userId: string, params: {
    query?: string;
    pageSize?: number;
    pageToken?: string;
    readMask?: string;
    sources?: string[];
  }): Promise<{
    results: Array<{
      person: {
        resourceName: string;
        etag: string;
        metadata: {
          sources: Array<{
            type: string;
            id: string;
            etag?: string;
            updateTime?: string;
          }>;
          objectType: 'PERSON';
        };
        names?: Array<{
          givenName?: string;
          familyName?: string;
          middleName?: string;
          honorificPrefix?: string;
          honorificSuffix?: string;
          phoneticGivenName?: string;
          phoneticFamilyName?: string;
          phoneticMiddleName?: string;
          displayName?: string;
          displayNameLastFirst?: string;
          unstructuredName?: string;
          metadata: {
            primary?: boolean;
            source: {
              type: string;
              id: string;
            };
          };
        }>;
        phoneNumbers?: Array<{
          value: string;
          type: 'home' | 'work' | 'mobile' | 'fax' | 'other';
          primary?: boolean;
        }>;
        emailAddresses?: Array<{
          value: string;
          type: 'home' | 'work' | 'other';
          primary?: boolean;
        }>;
        addresses?: Array<{
          street?: string;
          city?: string;
          region?: string;
          postalCode?: string;
          country?: string;
          type: 'home' | 'work' | 'other';
          primary?: boolean;
        }>;
        organizations?: Array<{
          name?: string;
          title?: string;
          department?: string;
          symbol?: string;
          domain?: string;
          location?: string;
          type?: string;
          primary?: boolean;
        }>;
        photos?: Array<{
          url: string;
          metadata: {
            primary?: boolean;
            source: {
              type: string;
              id: string;
            };
          };
        }>;
      };
    }>;
    nextPageToken?: string;
    totalSize?: number;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Searching contacts', {
        query: params.query,
        pageSize: params.pageSize || 100
      });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/me/connections',
        query: {
          pageSize: params.pageSize || 100,
          pageToken: params.pageToken,
          personFields: ['names', 'emailAddresses', 'phoneNumbers'].join(','),
          query: params.query
        }
      });

      const result = {
        results: response.data.connections?.map((contact: any) => ({
          person: contact
        })) || [],
        nextPageToken: response.data.nextPageToken,
        totalSize: response.data.totalItems
      };

      this.logInfo('Contacts search completed', {
        query: params.query,
        count: result.results.length,
        totalSize: result.totalSize
      });

      return result;
    } catch (error) {
      this.logError('Failed to search contacts', error);
      throw error;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.googleClient;
      const details = {
        initialized: this.initialized,
        hasGoogleClient: !!this.googleClient,
        authenticated: this.googleClient?.isAuthenticated() || false
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
