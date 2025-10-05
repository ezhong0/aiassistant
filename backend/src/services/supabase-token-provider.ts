/**
 * Supabase Token Provider
 *
 * Fetches OAuth provider tokens (Google, etc.) from Supabase for authenticated users.
 * Supabase handles the OAuth flow and stores provider tokens.
 * This service retrieves those tokens for backend API calls.
 */

import { BaseService } from './base-service';
import { ErrorFactory } from '../errors';

export interface GoogleProviderTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface ProviderTokensResult {
  provider: string;
  tokens: GoogleProviderTokens;
}

interface SupabaseUserIdentity {
  provider: string;
  identity_data?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
}

interface SupabaseAdminUserResponse {
  user?: {
    identities?: SupabaseUserIdentity[];
  };
}

export class SupabaseTokenProvider extends BaseService {
  private readonly supabaseUrl: string;
  private readonly supabaseServiceKey: string;

  constructor(supabaseUrl?: string, supabaseServiceKey?: string) {
    super('SupabaseTokenProvider');

    this.supabaseUrl = supabaseUrl || process.env.SUPABASE_URL || '';
    this.supabaseServiceKey = supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('Supabase URL and Service Role Key are required');
    }
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('SupabaseTokenProvider initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('SupabaseTokenProvider destroyed');
  }

  /**
   * Get Google OAuth tokens for a Supabase user
   *
   * @param supabaseUserId - The Supabase user ID (from JWT sub claim)
   * @returns Google provider tokens
   */
  async getGoogleTokens(supabaseUserId: string): Promise<GoogleProviderTokens> {
    this.assertReady();

    try {
      // Call Supabase Admin API to get user's provider tokens
      // https://supabase.com/docs/reference/javascript/auth-admin-getuser
      const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${supabaseUserId}`, {
        headers: {
          'Authorization': `Bearer ${this.supabaseServiceKey}`,
          'apikey': this.supabaseServiceKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw ErrorFactory.api.unauthorized(`Failed to fetch user from Supabase: ${error}`);
      }

      const data = await response.json() as SupabaseAdminUserResponse;

      // Extract Google provider tokens from user identities
      const googleIdentity = data.user?.identities?.find(id => id.provider === 'google');

      if (!googleIdentity) {
        throw ErrorFactory.api.unauthorized('User has not connected Google account');
      }

      // Supabase stores provider tokens in identity_data
      const tokens: GoogleProviderTokens = {
        access_token: googleIdentity.identity_data?.access_token,
        refresh_token: googleIdentity.identity_data?.refresh_token,
        expires_at: googleIdentity.identity_data?.expires_at,
        expires_in: googleIdentity.identity_data?.expires_in,
        token_type: googleIdentity.identity_data?.token_type || 'Bearer',
        scope: googleIdentity.identity_data?.scope,
      };

      if (!tokens.access_token) {
        throw ErrorFactory.api.unauthorized('No Google access token found');
      }

      return tokens;
    } catch (error) {
      this.logError('Failed to get Google tokens from Supabase', error as Error, { supabaseUserId });
      throw error;
    }
  }

  /**
   * Check if user has valid Google tokens
   */
  async hasGoogleTokens(supabaseUserId: string): Promise<boolean> {
    try {
      const tokens = await this.getGoogleTokens(supabaseUserId);
      return !!tokens.access_token;
    } catch (error) {
      return false;
    }
  }
}
