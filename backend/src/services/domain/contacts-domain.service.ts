import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError, APIClientErrorCode } from '../../errors/api-client.errors';
import { ValidationHelper, ContactsValidationSchemas } from '../../validation/api-client.validation';
import { IContactsDomainService } from './interfaces/domain-service.interfaces';
import { GoogleOAuthManager } from '../oauth/google-oauth-manager';
import { serviceManager } from '../service-manager';
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
export class ContactsDomainService extends BaseService implements IContactsDomainService {
  private googleClient: GoogleAPIClient | null = null;
  private googleOAuthManager: GoogleOAuthManager | null = null;

  constructor() {
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
      
      // Get OAuth manager
      this.googleOAuthManager = serviceManager.getService<GoogleOAuthManager>('googleOAuthManager') || null;
      
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
   * Legacy authentication method (to be removed)
   */
  async authenticate(accessToken: string, refreshToken?: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'ContactsDomainService' }
      );
    }

    try {
      const credentials: AuthCredentials = {
        type: 'oauth2',
        accessToken,
        refreshToken
      };

      await this.googleClient.authenticate(credentials);
      this.logInfo('Contacts service authenticated successfully');
    } catch (error) {
      throw APIClientError.fromError(error, {
        serviceName: 'ContactsDomainService',
        endpoint: 'authenticate'
      });
    }
  }

  /**
   * List contacts (with automatic authentication)
   */
  async listContacts(userId: string, params: {
    pageSize?: number;
    pageToken?: string;
    personFields?: string[];
    sortOrder?: 'LAST_NAME_ASCENDING' | 'LAST_NAME_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'FIRST_NAME_DESCENDING';
  }): Promise<{
    contacts: Array<{
      resourceName: string;
      names?: Array<{
        displayName?: string;
        givenName?: string;
        familyName?: string;
        middleName?: string;
      }>;
      emailAddresses?: Array<{
        value: string;
        type?: string;
        displayName?: string;
      }>;
      phoneNumbers?: Array<{
        value: string;
        type?: string;
      }>;
      addresses?: Array<{
        formattedValue?: string;
        type?: string;
        streetAddress?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
      }>;
      organizations?: Array<{
        name?: string;
        title?: string;
        type?: string;
      }>;
      photos?: Array<{
        url: string;
        default?: boolean;
      }>;
    }>;
    nextPageToken?: string;
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
        contacts: response.data.connections?.map((contact: any) => ({
          resourceName: contact.resourceName,
          names: contact.names,
          emailAddresses: contact.emailAddresses,
          phoneNumbers: contact.phoneNumbers,
          addresses: contact.addresses,
          organizations: contact.organizations,
          photos: contact.photos
        })) || [],
        nextPageToken: response.data.nextPageToken,
        totalItems: response.data.totalItems
      };

      this.logInfo('Contacts listed successfully', {
        count: result.contacts.length,
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
  async createContact(params: {
    names?: Array<{
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      type?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
    birthdays?: Array<{
      date?: {
        year?: number;
        month?: number;
        day?: number;
      };
    }>;
  }): Promise<{
    resourceName: string;
    names?: Array<{
      displayName?: string;
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      formattedValue?: string;
      type?: string;
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Creating contact', {
        hasNames: !!(params.names?.length),
        hasEmails: !!(params.emailAddresses?.length),
        hasPhones: !!(params.phoneNumbers?.length)
      });

      const contactData = {
        names: params.names,
        emailAddresses: params.emailAddresses,
        phoneNumbers: params.phoneNumbers,
        addresses: params.addresses,
        organizations: params.organizations,
        birthdays: params.birthdays
      };

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/people/v1/people:createContact',
        data: contactData
      });

      const result = {
        resourceName: response.data.resourceName,
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
  async getContact(userId: string, resourceName: string, personFields?: string[]): Promise<{
    resourceName: string;
    names?: Array<{
      displayName?: string;
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      formattedValue?: string;
      type?: string;
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
    photos?: Array<{
      url: string;
      default?: boolean;
    }>;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
      this.logInfo('Getting contact', { resourceName });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/people/v1/people/get',
        query: {
          resourceName,
          personFields: (personFields || ['names', 'emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'photos']).join(',')
        }
      });

      const result = {
        resourceName: response.data.resourceName,
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
      this.logError('Failed to get contact', error, { resourceName });
      throw error;
    }
  }

  /**
   * Update a contact
   */
  async updateContact(params: {
    resourceName: string;
    names?: Array<{
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      type?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
    birthdays?: Array<{
      date?: {
        year?: number;
        month?: number;
        day?: number;
      };
    }>;
  }): Promise<{
    resourceName: string;
    names?: Array<{
      displayName?: string;
      givenName?: string;
      familyName?: string;
      middleName?: string;
    }>;
    emailAddresses?: Array<{
      value: string;
      type?: string;
      displayName?: string;
    }>;
    phoneNumbers?: Array<{
      value: string;
      type?: string;
    }>;
    addresses?: Array<{
      formattedValue?: string;
      type?: string;
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    organizations?: Array<{
      name?: string;
      title?: string;
      type?: string;
    }>;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Updating contact', { resourceName: params.resourceName });

      const contactData = {
        names: params.names,
        emailAddresses: params.emailAddresses,
        phoneNumbers: params.phoneNumbers,
        addresses: params.addresses,
        organizations: params.organizations,
        birthdays: params.birthdays
      };

      const response = await this.googleClient.makeRequest({
        method: 'PATCH',
        endpoint: '/people/v1/people/updateContact',
        query: {
          resourceName: params.resourceName,
          updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses,organizations,birthdays'
        },
        data: contactData
      });

      const result = {
        resourceName: response.data.resourceName,
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
      this.logError('Failed to update contact', error, { resourceName: params.resourceName });
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
    query: string;
    pageSize?: number;
    pageToken?: string;
    personFields?: string[];
  }): Promise<{
    contacts: Array<{
      resourceName: string;
      names?: Array<{
        displayName?: string;
        givenName?: string;
        familyName?: string;
        middleName?: string;
      }>;
      emailAddresses?: Array<{
        value: string;
        type?: string;
        displayName?: string;
      }>;
      phoneNumbers?: Array<{
        value: string;
        type?: string;
      }>;
      addresses?: Array<{
        formattedValue?: string;
        type?: string;
        streetAddress?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
      }>;
      organizations?: Array<{
        name?: string;
        title?: string;
        type?: string;
      }>;
    }>;
    nextPageToken?: string;
    totalItems?: number;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
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
          personFields: (params.personFields || ['names', 'emailAddresses', 'phoneNumbers']).join(','),
          query: params.query
        }
      });

      const result = {
        contacts: response.data.connections?.map((contact: any) => ({
          resourceName: contact.resourceName,
          names: contact.names,
          emailAddresses: contact.emailAddresses,
          phoneNumbers: contact.phoneNumbers,
          addresses: contact.addresses,
          organizations: contact.organizations
        })) || [],
        nextPageToken: response.data.nextPageToken,
        totalItems: response.data.totalItems
      };

      this.logInfo('Contacts search completed', {
        query: params.query,
        count: result.contacts.length,
        totalItems: result.totalItems
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
