import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { SupabaseTokenProvider } from '../../services/supabase-token-provider';

/**
 * Register authentication and authorization services
 *
 * OAuth is handled by Supabase Auth.
 * This module registers services for fetching provider tokens from Supabase.
 */
export function registerAuthServices(container: AppContainer): void {
  container.register({
    // Supabase token provider - fetches OAuth provider tokens from Supabase
    supabaseTokenProvider: asClass(SupabaseTokenProvider).singleton(),
  });
}
