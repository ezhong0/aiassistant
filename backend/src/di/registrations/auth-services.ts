import { asClass, asFunction } from 'awilix';
import { AppContainer } from '../container';
import { SupabaseTokenProvider } from '../../services/supabase-token-provider';

/**
 * Register authentication and authorization services
 *
 * OAuth is handled by Supabase Auth.
 * This module registers services for fetching provider tokens from Supabase.
 */
export function registerAuthServices(container: AppContainer): void {
  // Only register Supabase token provider if Supabase is configured
  const supabaseUrl = container.cradle.supabaseUrl;
  const supabaseServiceRoleKey = container.cradle.supabaseServiceRoleKey;

  if (supabaseUrl && supabaseServiceRoleKey) {
    container.register({
      // Supabase token provider - fetches OAuth provider tokens from Supabase
      supabaseTokenProvider: asFunction(() => {
        return new SupabaseTokenProvider(supabaseUrl, supabaseServiceRoleKey);
      }).singleton(),
    });
  } else {
    // Register a no-op placeholder to prevent dependency resolution errors
    container.register({
      supabaseTokenProvider: asFunction(() => null).singleton(),
    });
  }
}
