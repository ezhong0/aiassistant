import { ErrorFactory, ERROR_CATEGORIES } from '../../errors';
import { BaseService } from '../base-service';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError } from '../../errors';
import { ValidationHelper, ContactsValidationSchemas } from '../../validation/api-client.validation';
import { IContactsDomainService, Contact, ContactInput } from './interfaces/contacts-domain.interface';
import { SupabaseTokenProvider } from '../supabase-token-provider';

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
 *
 * OAuth is handled by Supabase Auth. This service fetches Google tokens from Supabase.
 * Dependencies are injected via constructor for better testability and explicit dependency management.
 */
export class ContactsDomainService extends BaseService implements Partial<IContactsDomainService> {
  constructor(
    private readonly supabaseTokenProvider: SupabaseTokenProvider,
    private readonly googleAPIClient: GoogleAPIClient
  ) {
    super('ContactsDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Contacts Domain Service');
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
      this.logInfo('Contacts Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Contacts Domain Service', error);
    }
  }

  /**
   * Helper: Get OAuth2 credentials for a user
   * @private
   */
  private async getGoogleCredentials(userId: string): Promise<AuthCredentials> {
    const tokens = await this.supabaseTokenProvider.getGoogleTokens(userId);

    if (!tokens.access_token) {
      throw ErrorFactory.api.unauthorized('OAuth required - call initializeOAuth first');
    }

    return {
      type: 'oauth2',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    };
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

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError('ContactsDomainService', 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      // Validate input parameters
      const validatedParams = ValidationHelper.validate(ContactsValidationSchemas.listContacts, params);

      this.logInfo('Listing contacts', {
        pageSize: validatedParams.pageSize || 100,
        personFields: validatedParams.personFields || ['names', 'emailAddresses', 'phoneNumbers']
      });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/me/connections',
        query: {
          pageSize: validatedParams.pageSize || 100,
          pageToken: validatedParams.pageToken,
          personFields: (validatedParams.personFields || ['names', 'emailAddresses', 'phoneNumbers']).join(','),
          sortOrder: validatedParams.sortOrder || 'LAST_NAME_ASCENDING'
        },
        credentials
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
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'ContactsDomainService',
        metadata: { endpoint: 'listContacts', method: 'GET' }
      });
    }
  }

  /**
   * Create a contact
   */
  async createContact(userId: string, contact: ContactInput): Promise<Contact> {
    this.assertReady();
    
    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

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

      const response = await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/people/v1/people:createContact',
        data: contactData,
        credentials
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
  async getContact(userId: string, contactId: string): Promise<Contact> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Getting contact', { contactId });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/get',
        query: {
          resourceName: contactId,
          personFields: ['names', 'emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'photos'].join(',')
        },
        credentials
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
  async updateContact(userId: string, contactId: string, contact: ContactInput, updatePersonFields?: string): Promise<Contact> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Updating contact', { contactId });

      const contactData = {
        names: contact.names,
        emailAddresses: contact.emailAddresses,
        phoneNumbers: contact.phoneNumbers,
        addresses: contact.addresses,
        organizations: contact.organizations,
        birthdays: contact.birthdays
      };

      const response = await this.googleAPIClient.makeRequest({
        method: 'PATCH',
        endpoint: '/people/v1/people/updateContact',
        query: {
          resourceName: contactId,
          updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses,organizations,birthdays'
        },
        data: contactData,
        credentials
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
  async deleteContact(userId: string, resourceName: string): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Deleting contact', { resourceName });

      await this.googleAPIClient.makeRequest({
        method: 'DELETE',
        endpoint: '/people/v1/people/deleteContact',
        query: { resourceName },
        credentials
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
    
    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Searching contacts', {
        query: params.query,
        pageSize: params.pageSize || 100
      });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/me/connections',
        query: {
          pageSize: params.pageSize || 100,
          pageToken: params.pageToken,
          personFields: ['names', 'emailAddresses', 'phoneNumbers'].join(','),
          query: params.query
        },
        credentials
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
   * Batch get contacts by resource names
   * Can retrieve up to 200 contacts in a single call (vs N individual calls)
   */
  async batchGetContacts(userId: string, params: {
    resourceNames: string[];
    personFields?: string[];
  }): Promise<Array<Contact>> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    if (!params.resourceNames || params.resourceNames.length === 0) {
      throw ErrorFactory.domain.validationFailed('At least one resource name is required');
    }

    if (params.resourceNames.length > 200) {
      throw ErrorFactory.domain.validationFailed('Cannot get more than 200 contacts at once');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Batch getting contacts', {
        count: params.resourceNames.length
      });

      const personFields = params.personFields || ['names', 'emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'photos'];

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people:batchGet',
        query: {
          resourceNames: params.resourceNames,
          personFields: personFields.join(',')
        },
        credentials
      });

      const contacts = response.data.responses?.map((item: any) => ({
        resourceName: item.person?.resourceName,
        etag: item.person?.etag,
        metadata: {
          sources: item.person?.metadata?.sources || [],
          objectType: item.person?.metadata?.objectType || 'PERSON'
        },
        names: item.person?.names,
        emailAddresses: item.person?.emailAddresses,
        phoneNumbers: item.person?.phoneNumbers,
        addresses: item.person?.addresses,
        organizations: item.person?.organizations,
        photos: item.person?.photos
      })) || [];

      this.logInfo('Batch get contacts completed', {
        count: contacts.length
      });

      return contacts;
    } catch (error) {
      this.logError('Failed to batch get contacts', error, {
        count: params.resourceNames.length
      });
      throw error;
    }
  }

  /**
   * List other contacts (autocomplete suggestions)
   * These are contacts from user interactions but not explicitly saved
   */
  async listOtherContacts(userId: string, params?: {
    pageSize?: number;
    pageToken?: string;
    readMask?: string;
  }): Promise<{
    otherContacts: Array<{
      resourceName: string;
      etag: string;
      metadata: {
        sources: Array<{
          type: string;
          id: string;
        }>;
      };
      names?: Array<{
        displayName?: string;
        givenName?: string;
        familyName?: string;
      }>;
      emailAddresses?: Array<{
        value: string;
        type?: string;
      }>;
      phoneNumbers?: Array<{
        value: string;
        type?: string;
      }>;
    }>;
    nextPageToken?: string;
    totalSize?: number;
  }> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'ContactsDomainService',
        operation: 'contacts-operation'
      });
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Listing other contacts', {
        pageSize: params?.pageSize || 100
      });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/otherContacts',
        query: {
          pageSize: params?.pageSize || 100,
          pageToken: params?.pageToken,
          readMask: params?.readMask || 'names,emailAddresses,phoneNumbers'
        },
        credentials
      });

      const result = {
        otherContacts: response.data.otherContacts || [],
        nextPageToken: response.data.nextPageToken,
        totalSize: response.data.totalSize
      };

      this.logInfo('Other contacts listed successfully', {
        count: result.otherContacts.length,
        totalSize: result.totalSize
      });

      return result;
    } catch (error) {
      this.logError('Failed to list other contacts', error);
      throw error;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.googleAPIClient;
      const details = {
        initialized: this.initialized,
        hasGoogleClient: !!this.googleAPIClient,
        authenticated: this.googleAPIClient?.isAuthenticated() || false
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
