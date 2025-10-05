import { BaseService } from '../base-service';
import { AuthCredentials } from '../../types/api/api-client.types';
import { ErrorFactory } from '../../errors';
import { SupabaseTokenProvider } from '../supabase-token-provider';
import { GoogleAPIClient } from '../api/clients/google-api-client';

/**
 * Base Domain Service
 *
 * Abstract base class for all Google domain services (Email, Calendar, Contacts).
 * Provides common functionality for authentication, client management, and health checks.
 *
 * This eliminates code duplication across EmailDomainService, CalendarDomainService,
 * and ContactsDomainService which all share identical credential and health check patterns.
 *
 * @abstract
 * @extends BaseService
 */
export abstract class BaseDomainService extends BaseService {
  constructor(
    serviceName: string,
    protected readonly supabaseTokenProvider: SupabaseTokenProvider,
    protected readonly googleAPIClient: GoogleAPIClient
  ) {
    super(serviceName);
  }

  /**
   * Get OAuth2 credentials for a user from Supabase
   *
   * This method is shared across all Google domain services and eliminates
   * the duplicate getGoogleCredentials implementation in each service.
   *
   * @param userId - User ID to fetch credentials for
   * @returns OAuth2 credentials with access and refresh tokens
   * @throws {APIClientError} When OAuth is not configured or tokens are missing
   * @protected
   */
  protected async getGoogleCredentials(userId: string): Promise<AuthCredentials> {
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
   * Get service health information
   *
   * Standard health check implementation shared across all Google domain services.
   * Checks initialization status, client availability, and authentication state.
   *
   * @returns Health status with details
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

  /**
   * Assert that the Google API client is available
   *
   * Helper method to validate client availability before operations.
   * Throws appropriate error if client is not available.
   *
   * @throws {DomainError} When Google API client is not available
   * @protected
   */
  protected assertGoogleClientAvailable(): void {
    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(
        this.name,
        'Google client not available'
      );
    }
  }
}
